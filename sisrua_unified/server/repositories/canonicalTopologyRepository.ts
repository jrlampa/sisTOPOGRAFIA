/**
 * canonicalTopologyRepository.ts — Repositório do modelo Poste-Driven canônico.
 *
 * Fase B2: leitura prioritária das tabelas canonical_poles / canonical_edges.
 * Fallback controlado para dados legados (dxf_tasks.payload) quando o canônico
 * está vazio ou incompleto.
 *
 * Arquitetura dual-read:
 *   1. Tenta ler de canonical_poles / canonical_edges.
 *   2. Se a tabela estiver vazia OU a feature flag indicar legado, lê do payload JSONB.
 *   3. Registra a fonte usada no campo `source` do resultado.
 *
 * NUNCA escreve no legado — apenas leitura.
 */
import { getDbClient } from "./dbClient.js";
import { logger } from "../utils/logger.js";
import { config } from "../config.js";
import { getTenantFlagValue } from "../services/tenantFeatureFlagService.js";
import type {
  CanonicalPoleNode,
  CanonicalNetworkEdge,
  CanonicalNetworkTopology,
} from "../../src/types.canonical.js";

// ─── Tipos internos ───────────────────────────────────────────────────────────

export type TopologyReadSource = "canonical" | "legacy";

export interface TopologyReadResult {
  topology: CanonicalNetworkTopology;
  /** Indica de qual fonte os dados foram lidos. */
  source: TopologyReadSource;
  /** Número de postes lidos. */
  poleCount: number;
  /** Número de arestas lidas. */
  edgeCount: number;
}

export interface ICanonicalTopologyRepository {
  /**
   * Lê a topologia canônica completa filtrada por tenant.
   * Retorna canonical se houver dados; caso contrário legado (se taskId fornecido).
   *
   * @param tenantId ID do tenant para isolamento.
   * @param taskId  ID da tarefa DXF para fallback legado (opcional).
   * @param forceLegacy  Força leitura do legado independente do canônico.
   */
  readTopology(
    tenantId: string,
    taskId?: string,
    forceLegacy?: boolean,
  ): Promise<TopologyReadResult>;

  /** Lê apenas postes canônicos filtrados por tenant. */
  readPoles(
    tenantId: string,
    source?: "legacy_bt" | "legacy_mt" | "canonical",
  ): Promise<CanonicalPoleNode[]>;

  /** Lê apenas arestas canônicas filtradas por tenant. */
  readEdges(
    tenantId: string,
    source?: "legacy_bt" | "legacy_mt" | "canonical",
  ): Promise<CanonicalNetworkEdge[]>;

  /** Conta postes e arestas no canônico para um tenant. */
  countCanonical(tenantId: string): Promise<{ poles: number; edges: number }>;
}

type CountRow = { cnt?: unknown };

// ─── Mapeadores de linha DB → tipo canônico ───────────────────────────────────

function rowToPoleNode(r: Record<string, unknown>): CanonicalPoleNode {
  let lat = 0;
  let lng = 0;

  if (r["geom_json"]) {
    try {
      const geo = JSON.parse(r["geom_json"] as string);
      if (geo && geo.coordinates) {
        lng = geo.coordinates[0];
        lat = geo.coordinates[1];
      }
    } catch (_e) {
      // fallback para lat/lng diretos se o JSON falhar
      lat = (r["lat"] as number) ?? 0;
      lng = (r["lng"] as number) ?? 0;
    }
  } else {
    lat = (r["lat"] as number) ?? 0;
    lng = (r["lng"] as number) ?? 0;
  }

  return {
    id: r["id"] as string,
    lat,
    lng,
    title: (r["title"] as string) ?? "",
    hasBt: (r["has_bt"] as boolean) ?? false,
    hasMt: (r["has_mt"] as boolean) ?? false,
    btStructures: r["bt_structures"]
      ? typeof r["bt_structures"] === "string"
        ? JSON.parse(r["bt_structures"] as string)
        : r["bt_structures"]
      : undefined,
    mtStructures: r["mt_structures"]
      ? typeof r["mt_structures"] === "string"
        ? JSON.parse(r["mt_structures"] as string)
        : r["mt_structures"]
      : undefined,
    ramais: r["ramais"]
      ? typeof r["ramais"] === "string"
        ? JSON.parse(r["ramais"] as string)
        : r["ramais"]
      : undefined,
    poleSpec: r["pole_spec"]
      ? typeof r["pole_spec"] === "string"
        ? JSON.parse(r["pole_spec"] as string)
        : r["pole_spec"]
      : undefined,
    conditionStatus: r["condition_status"] as
      | CanonicalPoleNode["conditionStatus"]
      | undefined,
    equipmentNotes: r["equipment_notes"] as string | undefined,
    generalNotes: r["general_notes"] as string | undefined,
    circuitBreakPoint: (r["circuit_break_point"] as boolean) ?? false,
    verified: (r["verified"] as boolean) ?? false,
    nodeChangeFlag: r["node_change_flag"] as
      | CanonicalPoleNode["nodeChangeFlag"]
      | undefined,
  };
}

function rowToEdge(r: Record<string, unknown>): CanonicalNetworkEdge {
  return {
    id: r["id"] as string,
    fromPoleId: r["from_pole_id"] as string,
    toPoleId: r["to_pole_id"] as string,
    lengthMeters:
      r["length_meters"] != null ? (r["length_meters"] as number) : undefined,
    cqtLengthMeters:
      r["cqt_length_meters"] != null
        ? (r["cqt_length_meters"] as number)
        : undefined,
    btConductors: r["bt_conductors"]
      ? typeof r["bt_conductors"] === "string"
        ? JSON.parse(r["bt_conductors"] as string)
        : r["bt_conductors"]
      : undefined,
    mtConductors: r["mt_conductors"]
      ? typeof r["mt_conductors"] === "string"
        ? JSON.parse(r["mt_conductors"] as string)
        : r["mt_conductors"]
      : undefined,
    btReplacementConductors: r["bt_replacement_conductors"]
      ? typeof r["bt_replacement_conductors"] === "string"
        ? JSON.parse(r["bt_replacement_conductors"] as string)
        : r["bt_replacement_conductors"]
      : undefined,
    removeOnExecution: (r["remove_on_execution"] as boolean) ?? false,
    verified: (r["verified"] as boolean) ?? false,
    edgeChangeFlag: r["edge_change_flag"] as
      | CanonicalNetworkEdge["edgeChangeFlag"]
      | undefined,
  };
}

// ─── Fallback legado: extrai topologia do payload JSONB de um dxf_task ────────

async function readTopologyFromLegacyTask(
  taskId: string,
  tenantId: string,
): Promise<CanonicalNetworkTopology | null> {
  const sql = getDbClient();
  if (!sql) return null;

  try {
    const rows = await sql.unsafe(
      `SELECT payload->'btContext'->'topology' AS bt_topology,
              payload->'mtContext'->'topology' AS mt_topology
       FROM dxf_tasks
       WHERE task_id = $1 AND tenant_id = $2
       LIMIT 1`,
      [taskId, tenantId],
    );

    if (!rows.length) return null;

    const row = rows[0] as Record<string, unknown>;
    const btTopo =
      typeof row["bt_topology"] === "string"
        ? JSON.parse(row["bt_topology"] as string)
        : row["bt_topology"];
    const mtTopo =
      typeof row["mt_topology"] === "string"
        ? JSON.parse(row["mt_topology"] as string)
        : row["mt_topology"];

    const poles: CanonicalPoleNode[] = [];
    const edges: CanonicalNetworkEdge[] = [];

    // Mapear postes BT legados
    if (Array.isArray(btTopo?.poles)) {
      for (const p of btTopo.poles as Record<string, unknown>[]) {
        if (typeof p["id"] !== "string") continue;
        poles.push({
          id: p["id"] as string,
          lat: p["lat"] as number,
          lng: p["lng"] as number,
          title: (p["title"] as string) ?? "",
          hasBt: true,
          hasMt: false,
          btStructures: p["btStructures"] as CanonicalPoleNode["btStructures"],
          ramais: p["ramais"] as CanonicalPoleNode["ramais"],
          poleSpec: p["poleSpec"] as CanonicalPoleNode["poleSpec"],
          conditionStatus: p[
            "conditionStatus"
          ] as CanonicalPoleNode["conditionStatus"],
          equipmentNotes: p["equipmentNotes"] as string | undefined,
          generalNotes: p["generalNotes"] as string | undefined,
          circuitBreakPoint: (p["circuitBreakPoint"] as boolean) ?? false,
          verified: (p["verified"] as boolean) ?? false,
          nodeChangeFlag: p[
            "nodeChangeFlag"
          ] as CanonicalPoleNode["nodeChangeFlag"],
        });
      }
    }

    // Mapear postes MT legados (merge por id se já existe BT)
    // Pré-construir Map<id, pole> para lookup O(1) em vez de O(n) por .find()
    const poleById = new Map<string, CanonicalPoleNode>(
      poles.map((p) => [p.id, p]),
    );
    if (Array.isArray(mtTopo?.poles)) {
      for (const p of mtTopo.poles as Record<string, unknown>[]) {
        if (typeof p["id"] !== "string") continue;
        const existing = poleById.get(p["id"] as string);
        if (existing) {
          existing.hasMt = true;
          existing.mtStructures = p[
            "mtStructures"
          ] as CanonicalPoleNode["mtStructures"];
        } else {
          const newPole: CanonicalPoleNode = {
            id: p["id"] as string,
            lat: p["lat"] as number,
            lng: p["lng"] as number,
            title: (p["title"] as string) ?? "",
            hasBt: false,
            hasMt: true,
            mtStructures: p[
              "mtStructures"
            ] as CanonicalPoleNode["mtStructures"],
            verified: (p["verified"] as boolean) ?? false,
            nodeChangeFlag: p[
              "nodeChangeFlag"
            ] as CanonicalPoleNode["nodeChangeFlag"],
          };
          poles.push(newPole);
          poleById.set(newPole.id, newPole);
        }
      }
    }

    // Mapear arestas BT legadas
    if (Array.isArray(btTopo?.edges)) {
      for (const e of btTopo.edges as Record<string, unknown>[]) {
        if (typeof e["id"] !== "string") continue;
        edges.push({
          id: e["id"] as string,
          fromPoleId: e["fromPoleId"] as string,
          toPoleId: e["toPoleId"] as string,
          lengthMeters: e["lengthMeters"] as number | undefined,
          btConductors: e["conductors"] as CanonicalNetworkEdge["btConductors"],
          verified: (e["verified"] as boolean) ?? false,
          edgeChangeFlag: e[
            "edgeChangeFlag"
          ] as CanonicalNetworkEdge["edgeChangeFlag"],
        });
      }
    }

    // Mapear arestas MT legadas
    if (Array.isArray(mtTopo?.edges)) {
      for (const e of mtTopo.edges as Record<string, unknown>[]) {
        if (typeof e["id"] !== "string") continue;
        edges.push({
          id: e["id"] as string,
          fromPoleId: e["fromPoleId"] as string,
          toPoleId: e["toPoleId"] as string,
          lengthMeters: e["lengthMeters"] as number | undefined,
          verified: (e["verified"] as boolean) ?? false,
          edgeChangeFlag: e[
            "edgeChangeFlag"
          ] as CanonicalNetworkEdge["edgeChangeFlag"],
        });
      }
    }

    const btTransformers =
      btTopo && typeof btTopo === "object"
        ? (btTopo as Record<string, unknown>)["transformers"]
        : undefined;
    const transformers = Array.isArray(btTransformers)
      ? (btTransformers as CanonicalNetworkTopology["transformers"])
      : [];

    return { poles, edges, transformers };
  } catch (err) {
    logger.warn("[CanonicalTopologyRepository] fallback legado falhou", {
      taskId,
      err,
    });
    return null;
  }
}

function logTopologyDivergenceIfAny(
  canonicalTopology: CanonicalNetworkTopology,
  legacyTopology: CanonicalNetworkTopology,
  taskId: string,
): void {
  const canonicalPoleIds = new Set(
    canonicalTopology.poles.map((pole) => pole.id),
  );
  const legacyPoleIds = new Set(legacyTopology.poles.map((pole) => pole.id));
  const warnings: string[] = [];

  if (canonicalPoleIds.size !== legacyPoleIds.size) {
    warnings.push(
      `pole-count canonical=${canonicalPoleIds.size} legacy=${legacyPoleIds.size}`,
    );
  }

  if (canonicalTopology.edges.length !== legacyTopology.edges.length) {
    warnings.push(
      `edge-count canonical=${canonicalTopology.edges.length} legacy=${legacyTopology.edges.length}`,
    );
  }

  if (warnings.length > 0) {
    logger.warn(
      "[CanonicalTopologyRepository] divergencia canonical x legacy",
      {
        taskId,
        warnings,
      },
    );
  }
}

// ─── Implementação ────────────────────────────────────────────────────────────

export class PostgresCanonicalTopologyRepository implements ICanonicalTopologyRepository {
  async readPoles(
    tenantId: string,
    source?: "legacy_bt" | "legacy_mt" | "canonical",
  ): Promise<CanonicalPoleNode[]> {
    const sql = getDbClient();
    if (!sql) return [];

    try {
      const rows = source
        ? await sql.unsafe(
            `SELECT id, ST_AsGeoJSON(geom) AS geom_json, lat, lng, title, has_bt, has_mt,
                    bt_structures, mt_structures, ramais, pole_spec,
                    condition_status, equipment_notes, general_notes,
                    circuit_break_point, verified, node_change_flag
             FROM public.canonical_poles
             WHERE tenant_id = $1 AND source = $2
             ORDER BY pk ASC`,
            [tenantId, source],
          )
        : await sql.unsafe(
            `SELECT id, ST_AsGeoJSON(geom) AS geom_json, lat, lng, title, has_bt, has_mt,
                    bt_structures, mt_structures, ramais, pole_spec,
                    condition_status, equipment_notes, general_notes,
                    circuit_break_point, verified, node_change_flag
             FROM public.canonical_poles
             WHERE tenant_id = $1
             ORDER BY pk ASC`,
            [tenantId],
          );

      return (rows as Record<string, unknown>[]).map(rowToPoleNode);
    } catch (err) {
      logger.warn("[CanonicalTopologyRepository] readPoles falhou", { tenantId, err });
      return [];
    }
  }

  async readEdges(
    tenantId: string,
    source?: "legacy_bt" | "legacy_mt" | "canonical",
  ): Promise<CanonicalNetworkEdge[]> {
    const sql = getDbClient();
    if (!sql) return [];

    try {
      const rows = source
        ? await sql.unsafe(
            `SELECT id, from_pole_id, to_pole_id, length_meters, cqt_length_meters,
                    bt_conductors, mt_conductors, bt_replacement_conductors,
                    remove_on_execution, verified, edge_change_flag
             FROM public.canonical_edges
             WHERE tenant_id = $1 AND source = $2
             ORDER BY pk ASC`,
            [tenantId, source],
          )
        : await sql.unsafe(
            `SELECT id, from_pole_id, to_pole_id, length_meters, cqt_length_meters,
                    bt_conductors, mt_conductors, bt_replacement_conductors,
                    remove_on_execution, verified, edge_change_flag
             FROM public.canonical_edges
             WHERE tenant_id = $1
             ORDER BY pk ASC`,
            [tenantId],
          );

      return (rows as Record<string, unknown>[]).map(rowToEdge);
    } catch (err) {
      logger.warn("[CanonicalTopologyRepository] readEdges falhou", { tenantId, err });
      return [];
    }
  }

  async countCanonical(tenantId: string): Promise<{ poles: number; edges: number }> {
    const sql = getDbClient();
    if (!sql) return { poles: 0, edges: 0 };

    try {
      const [pRow, eRow] = await Promise.all([
        sql.unsafe(`SELECT COUNT(*) AS cnt FROM public.canonical_poles WHERE tenant_id = $1`, [tenantId]),
        sql.unsafe(`SELECT COUNT(*) AS cnt FROM public.canonical_edges WHERE tenant_id = $1`, [tenantId]),
      ]);

      const poleCountRows = pRow as CountRow[];
      const edgeCountRows = eRow as CountRow[];

      return {
        poles: Number(poleCountRows[0]?.cnt ?? 0),
        edges: Number(edgeCountRows[0]?.cnt ?? 0),
      };
    } catch (err) {
      logger.warn("[CanonicalTopologyRepository] countCanonical falhou", {
        tenantId,
        err,
      });
      return { poles: 0, edges: 0 };
    }
  }

  async readTopology(
    tenantId: string,
    taskId?: string,
    forceLegacy = false,
  ): Promise<TopologyReadResult> {
    // Verificar se o canônico tem dados para este tenant
    const counts = await this.countCanonical(tenantId);
    const canonicalHasData = counts.poles > 0;

    if (!forceLegacy && canonicalHasData) {
      // Leitura canônica
      const [poles, edges] = await Promise.all([
        this.readPoles(tenantId),
        this.readEdges(tenantId),
      ]);

      let transformers: CanonicalNetworkTopology["transformers"] = [];
      if (taskId) {
        const legacyTopo = await readTopologyFromLegacyTask(taskId, tenantId);
        if (legacyTopo) {
          transformers = legacyTopo.transformers;
          logTopologyDivergenceIfAny({ poles, edges, transformers }, legacyTopo, taskId);
        }
      }

      logger.debug("[CanonicalTopologyRepository] leitura canônica", {
        tenantId,
        poles: poles.length,
        edges: edges.length,
      });
      return {
        topology: { poles, edges, transformers },
        source: "canonical",
        poleCount: poles.length,
        edgeCount: edges.length,
      };
    }

    // Fallback legado
    if (taskId) {
      const legacyTopo = await readTopologyFromLegacyTask(taskId, tenantId);
      if (legacyTopo) {
        logger.info("[CanonicalTopologyRepository] fallback legado ativado", {
          tenantId,
          taskId,
          poles: legacyTopo.poles.length,
          edges: legacyTopo.edges.length,
        });
        return {
          topology: legacyTopo,
          source: "legacy",
          poleCount: legacyTopo.poles.length,
          edgeCount: legacyTopo.edges.length,
        };
      }
    }

    // Sem dados disponíveis — retorna topologia vazia
    logger.warn(
      "[CanonicalTopologyRepository] sem dados para tenant",
      { tenantId, taskId }
    );
    return {
      topology: { poles: [], edges: [], transformers: [] },
      source: "canonical",
      poleCount: 0,
      edgeCount: 0,
    };
  }

  async readTopologyForTenant(
    tenantId: string,
    taskId?: string,
  ): Promise<TopologyReadResult> {
    // Resolução de flag: tenant override tem precedência sobre env var global.
    const tenantFlag = getTenantFlagValue(tenantId, "canonical_topology_read");
    const useCanonical =
      tenantFlag !== null ? tenantFlag : config.canonicalTopologyRead;

    // forceLegacy = true quando a flag está desligada (legado prioritário)
    return this.readTopology(tenantId, taskId, !useCanonical);
  }
}

// ─── Singleton exportado ──────────────────────────────────────────────────────

export const canonicalTopologyRepository =
  new PostgresCanonicalTopologyRepository();
