/**
 * useMtRouter – Hook de estado e integração com o motor MT Router.
 *
 * Gerencia:
 *   – seleção interativa de source e terminais no mapa
 *   – upload KMZ para pré-preenchimento automático
 *   – chamada POST /api/dg/mt-router
 *   – resultado, estado de loading/erro e aplicação ao projeto
 */

import { useState, useCallback, useRef } from "react";
import type { MtTopology, MtPoleNode, MtEdge } from "../types";

// ─── Tipos espelhados do servidor (dgTypes.ts / kmzPreprocessingService.ts) ────

export interface MtLatLon {
  lat: number;
  lon: number;
}

export interface MtTerminal {
  id: string;
  name?: string;
  position: MtLatLon;
}

export interface MtRoadCorridor {
  id: string;
  label?: string;
  centerPoints: MtLatLon[];
  bufferMeters: number;
}

/** Padrão de rede MT aplicado aos vãos e postes gerados. */
export interface MtNetworkProfile {
  conductorId: string; // ex: "AS 3x95mm²"
  structureType: string; // ex: "N1"
}

/** Lista predefinida de perfis de rede MT disponíveis. */
export const MT_NETWORK_PROFILES: MtNetworkProfile[] = [
  { conductorId: "AS 3x95mm²", structureType: "N1" },
  { conductorId: "AS 3x185mm²", structureType: "N2" },
  { conductorId: "XLPE 3x95mm²", structureType: "N1" },
  { conductorId: "XLPE 3x185mm²", structureType: "N2" },
];

export interface MtRouterPath {
  terminalId: string;
  reachable: boolean;
  routeNodeIds: string[];
  totalDistanceMeters: number;
}

export interface MtRouterEdge {
  fromNodeId: string;
  toNodeId: string;
  distanceMeters: number;
  latLon: [MtLatLon, MtLatLon];
  conductorId?: string;
  structureType?: string;
  isExistingPoleFrom?: boolean;
  isExistingPoleTo?: boolean;
}

export interface MtRouterResult {
  feasible: boolean;
  source: MtLatLon;
  connectedTerminals: number;
  paths: MtRouterPath[];
  edges: MtRouterEdge[];
  totalEdgeLengthMeters: number;
  unreachableTerminals: string[];
  mtTopologyDraft?: MtTopology;
}

export interface KmzParseResult {
  source?: MtLatLon;
  terminals: MtTerminal[];
  roadCorridors: MtRoadCorridor[];
  warnings: string[];
}

// ─── Modo de seleção interativa ────────────────────────────────────────────────

export type MtSelectionMode = "idle" | "picking_source" | "picking_terminals";

// ─── Estado do hook ────────────────────────────────────────────────────────────

export interface MtRouterState {
  selectionMode: MtSelectionMode;
  source: MtLatLon | null;
  terminals: MtTerminal[];
  roadCorridors: MtRoadCorridor[];
  maxSnapDistanceMeters: number;
  networkProfile: MtNetworkProfile;
  result: MtRouterResult | null;
  isCalculating: boolean;
  isParsingKmz: boolean;
  isApplying: boolean;
  error: string | null;
  kmzWarnings: string[];
}

const INITIAL_STATE: MtRouterState = {
  selectionMode: "idle",
  source: null,
  terminals: [],
  roadCorridors: [],
  maxSnapDistanceMeters: 100,
  networkProfile: MT_NETWORK_PROFILES[0],
  result: null,
  isCalculating: false,
  isParsingKmz: false,
  isApplying: false,
  error: null,
  kmzWarnings: [],
};

// ─── Helpers internos ─────────────────────────────────────────────────────────

/** Parseia um nodeId `"lat,lon"` em { lat, lon }. Retorna null se inválido. */
function parseNodeLatLon(nodeId: string): MtLatLon | null {
  const parts = nodeId.split(",");
  if (parts.length !== 2) return null;
  const lat = parseFloat(parts[0]);
  const lon = parseFloat(parts[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
}

/**
 * Adapta a resposta bruta da API (com nodeIds como chave lat/lon) para o
 * formato de frontend com `latLon` explícito e paths mapeados.
 */
function adaptApiResponse(
  raw: Record<string, unknown>,
  source: MtLatLon,
): MtRouterResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawEdges = (raw.edges as any[]) ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawPaths = (raw.paths as any[]) ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawDraft = raw.mtTopologyDraft as any;

  const edges: MtRouterEdge[] = rawEdges.map((e) => {
    const from: MtLatLon =
      e.fromLatLon ?? parseNodeLatLon(e.fromNodeId) ?? source;
    const to: MtLatLon = e.toLatLon ?? parseNodeLatLon(e.toNodeId) ?? source;
    return {
      fromNodeId: e.fromNodeId,
      toNodeId: e.toNodeId,
      distanceMeters: e.lengthMeters ?? 0,
      latLon: [from, to],
      conductorId: e.conductorId,
      structureType: e.structureType,
      isExistingPoleFrom: e.isExistingPoleFrom,
      isExistingPoleTo: e.isExistingPoleTo,
    };
  });

  const paths: MtRouterPath[] = rawPaths.map((p) => ({
    terminalId: p.terminalId,
    reachable: true,
    routeNodeIds: p.nodeIds ?? [],
    totalDistanceMeters: p.lengthMeters ?? 0,
  }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const unreachable: string[] = (raw.unreachableTerminals as string[]) ?? [];

  // mtTopologyDraft: converter do formato servidor para MtTopology do frontend
  let mtTopologyDraft: MtTopology | undefined;
  if (rawDraft) {
    const poles: MtPoleNode[] = (rawDraft.poles ?? []).map((p: any) => ({
      id: p.id,
      lat: p.lat,
      lng: p.lng,
      title: p.title,
      mtStructures: p.structureType ? { n1: p.structureType } : undefined,
      nodeChangeFlag: p.nodeChangeFlag ?? "new",
    }));
    const mtEdges: MtEdge[] = (rawDraft.edges ?? []).map((e: any) => ({
      id: e.id,
      fromPoleId: e.fromPoleId,
      toPoleId: e.toPoleId,
      lengthMeters: e.lengthMeters,
    }));
    mtTopologyDraft = { poles, edges: mtEdges };
  }

  return {
    feasible: Boolean(raw.feasible),
    source,
    connectedTerminals:
      typeof raw.connectedTerminals === "number"
        ? raw.connectedTerminals
        : paths.length,
    paths,
    edges,
    totalEdgeLengthMeters:
      typeof raw.totalLengthMeters === "number"
        ? raw.totalLengthMeters
        : edges.reduce((s, e) => s + e.distanceMeters, 0),
    unreachableTerminals: unreachable,
    mtTopologyDraft,
  };
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useMtRouter() {
  const [state, setStateRaw] = useState<MtRouterState>(INITIAL_STATE);
  const stateRef = useRef<MtRouterState>(INITIAL_STATE);
  const terminalCounterRef = useRef(0);

  const patch = useCallback((updater: (s: MtRouterState) => MtRouterState) => {
    setStateRaw((prev) => {
      const next = updater(prev);
      stateRef.current = next;
      return next;
    });
  }, []);

  // ── Helpers de estado ───────────────────────────────────────────────────────

  const setSelectionMode = useCallback(
    (mode: MtSelectionMode) => {
      patch((s) => ({ ...s, selectionMode: mode, error: null }));
    },
    [patch],
  );

  const setSource = useCallback(
    (pos: MtLatLon) => {
      patch((s) => ({
        ...s,
        source: pos,
        selectionMode: "idle",
        result: null,
        error: null,
      }));
    },
    [patch],
  );

  const addTerminal = useCallback(
    (pos: MtLatLon) => {
      terminalCounterRef.current += 1;
      const id = `t${terminalCounterRef.current}`;
      patch((s) => ({
        ...s,
        terminals: [...s.terminals, { id, position: pos }],
        result: null,
        error: null,
      }));
    },
    [patch],
  );

  const removeTerminal = useCallback(
    (id: string) => {
      patch((s) => ({
        ...s,
        terminals: s.terminals.filter((t) => t.id !== id),
        result: null,
      }));
    },
    [patch],
  );

  const setMaxSnapDistance = useCallback(
    (meters: number) => {
      patch((s) => ({ ...s, maxSnapDistanceMeters: meters, result: null }));
    },
    [patch],
  );

  const setNetworkProfile = useCallback(
    (profile: MtNetworkProfile) => {
      patch((s) => ({ ...s, networkProfile: profile, result: null }));
    },
    [patch],
  );

  const reset = useCallback(() => {
    terminalCounterRef.current = 0;
    patch(() => INITIAL_STATE);
  }, [patch]);

  // ── Clique no mapa ──────────────────────────────────────────────────────────

  const handleMapClick = useCallback(
    (pos: MtLatLon) => {
      patch((s) => {
        if (s.selectionMode === "picking_source") {
          return {
            ...s,
            source: pos,
            selectionMode: "idle",
            result: null,
            error: null,
          };
        }
        if (s.selectionMode === "picking_terminals") {
          terminalCounterRef.current += 1;
          const id = `t${terminalCounterRef.current}`;
          return {
            ...s,
            terminals: [...s.terminals, { id, position: pos }],
            result: null,
            error: null,
          };
        }
        return s;
      });
    },
    [patch],
  );

  // ── Upload KMZ ──────────────────────────────────────────────────────────────

  const uploadKmz = useCallback(
    async (file: File) => {
      patch((s) => ({
        ...s,
        isParsingKmz: true,
        error: null,
        kmzWarnings: [],
      }));
      try {
        const form = new FormData();
        form.append("file", file);
        const resp = await fetch("/api/dg/mt-router/parse-kmz", {
          method: "POST",
          body: form,
          credentials: "same-origin",
        });
        if (!resp.ok) {
          const body = await resp
            .json()
            .catch(() => ({ error: "Erro desconhecido." }));
          throw new Error(body.error ?? `HTTP ${resp.status}`);
        }
        const data: KmzParseResult = await resp.json();
        terminalCounterRef.current = data.terminals.length;
        patch((s) => ({
          ...s,
          source: data.source ?? s.source,
          terminals: data.terminals.length > 0 ? data.terminals : s.terminals,
          roadCorridors:
            data.roadCorridors.length > 0
              ? data.roadCorridors
              : s.roadCorridors,
          kmzWarnings: data.warnings,
          isParsingKmz: false,
          result: null,
          error: null,
        }));
      } catch (err) {
        patch((s) => ({
          ...s,
          isParsingKmz: false,
          error: (err as Error).message,
        }));
      }
    },
    [patch],
  );

  // ── Cálculo de roteamento ───────────────────────────────────────────────────

  const calculate = useCallback(async () => {
    const s = stateRef.current;
    if (!s.source) {
      patch((prev) => ({ ...prev, error: "Defina o ponto de origem da MT." }));
      return;
    }
    if (s.terminals.length === 0) {
      patch((prev) => ({ ...prev, error: "Adicione pelo menos um terminal." }));
      return;
    }
    if (s.roadCorridors.length === 0) {
      patch((prev) => ({
        ...prev,
        error: "Importe corredores viários via KMZ ou adicione manualmente.",
      }));
      return;
    }

    patch((prev) => ({ ...prev, isCalculating: true, error: null }));

    const payload = {
      source: s.source,
      terminals: s.terminals.map((t) => ({ id: t.id, position: t.position })),
      roadCorridors: s.roadCorridors,
      maxSnapDistanceMeters: s.maxSnapDistanceMeters,
      networkProfile: s.networkProfile,
    };

    try {
      const resp = await fetch("/api/dg/mt-router", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(payload),
      });
      const body = await resp.json();
      if (!resp.ok && resp.status !== 422) {
        throw new Error(body.error ?? `HTTP ${resp.status}`);
      }
      const result = adaptApiResponse(body, s.source);
      patch((prev) => ({
        ...prev,
        result,
        isCalculating: false,
        error:
          !result.feasible && result.connectedTerminals === 0
            ? "Nenhum terminal alcançável. Verifique a malha viária e a distância de snap."
            : null,
      }));
    } catch (err) {
      patch((prev) => ({
        ...prev,
        isCalculating: false,
        error: (err as Error).message,
      }));
    }
  }, [patch]);

  // ── Aplicar ao projeto (persistência) ──────────────────────────────────────

  /**
   * Mescla o rascunho de topologia MT do resultado ao projeto atual.
   * @param onApply Callback que recebe a topologia parcial (postes + vãos)
   *                gerada pelo MT Router para ser fundida ao estado global.
   */
  const applyToProject = useCallback(
    (onApply: (draft: MtTopology) => void) => {
      const s = stateRef.current;
      if (!s.result?.mtTopologyDraft) {
        patch((prev) => ({
          ...prev,
          error:
            "Nenhum resultado disponível para aplicar. Execute o cálculo primeiro.",
        }));
        return;
      }
      patch((prev) => ({ ...prev, isApplying: true, error: null }));
      try {
        onApply(s.result.mtTopologyDraft);
        patch((prev) => ({ ...prev, isApplying: false }));
      } catch (err) {
        patch((prev) => ({
          ...prev,
          isApplying: false,
          error: (err as Error).message,
        }));
      }
    },
    [patch],
  );

  return {
    state,
    setSelectionMode,
    setSource,
    addTerminal,
    removeTerminal,
    setMaxSnapDistance,
    setNetworkProfile,
    handleMapClick,
    uploadKmz,
    calculate,
    applyToProject,
    reset,
  };
}
