/**
 * formulaVersioningService.ts — T3.73: Versionamento Semântico de Fórmulas de Cálculo
 *
 * Mantém catálogo versionado das fórmulas de cálculo elétrico utilizadas no sistema.
 * Permite rastreabilidade regulatória: qual versão de fórmula foi usada em cada entrega.
 *
 * Padrões: ANEEL PRODIST Módulo 8, ABNT NBR 5410, Light S.A. práticas operacionais.
 */

import { createHash } from "node:crypto";
import postgres from "postgres";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

export type FormulaCategory =
  | "bt_radial"
  | "cqt"
  | "conductor"
  | "transformer"
  | "standards";

export type VersionStatus = "active" | "deprecated" | "draft" | "withdrawn";

export interface FormulaVersion {
  id: string;
  formulaId: string;
  version: string; // semver: "1.0.0"
  status: VersionStatus;
  name: string;
  description: string;
  /** Expressão textual da fórmula (LaTeX-like para documentação) */
  expression: string;
  /** Constantes e parâmetros da fórmula */
  constants: Record<string, number | string>;
  /** Referência normativa (ex: "ANEEL PRODIST Módulo 8, §4.2") */
  standardReference: string;
  effectiveDate: string; // ISO date
  deprecatedDate?: string;
  /** Hash SHA-256 da definição da fórmula para detecção de adulteração */
  definitionHash: string;
  /** Razão da mudança em relação à versão anterior */
  changeReason?: string;
}

export interface FormulaDefinition {
  id: string;
  category: FormulaCategory;
  /** Versão ativa no momento */
  activeVersion: string;
  versions: FormulaVersion[];
}

export interface FormulaDiff {
  formulaId: string;
  v1: string;
  v2: string;
  changedFields: Array<{
    field: string;
    before: unknown;
    after: unknown;
  }>;
  isBreaking: boolean;
  breakingReason?: string;
}

// ─── Utilidades ─────────────────────────────────────────────────────────────

/**
 * Computa um hash SHA-256 determinístico da definição da fórmula.
 */
export function computeDefinitionHash(
  expression: string,
  constants: Record<string, number | string>,
): string {
  const canonicalPayload = JSON.stringify({
    expression,
    constants: Object.fromEntries(
      Object.entries(constants).sort(([a], [b]) => a.localeCompare(b)),
    ),
  });

  return createHash("sha256").update(canonicalPayload).digest("hex");
}

// ─── Catálogo inicial ────────────────────────────────────────────────────────

const INITIAL_CATALOG: FormulaDefinition[] = [
  {
    id: "QT_SEGMENTO_BT",
    category: "bt_radial",
    activeVersion: "2.0.0",
    versions: [
      {
        id: "QT_SEGMENTO_BT-1.0.0",
        formulaId: "QT_SEGMENTO_BT",
        version: "1.0.0",
        status: "deprecated",
        name: "Queda de Tensão por Segmento BT",
        description:
          "Versão original — sem distinção de fator de fase para MONO vs BIF/TRI.",
        expression:
          "QT = (P_kVA × Z_Ω_km × L_m) / V_phase_V²",
        constants: {
          V_phase_V: 127,
          Z_unit: "Ω/km",
          L_unit: "m",
        },
        standardReference: "ABNT NBR 5410 §6.5",
        effectiveDate: "2025-01-01",
        deprecatedDate: "2026-05-01",
        definitionHash: computeDefinitionHash(
          "QT = (P_kVA × Z_Ω_km × L_m) / V_phase_V²",
          { V_phase_V: 127, Z_unit: "Ω/km", L_unit: "m" },
        ),
        changeReason: "Introduzido fator de fase MONO/BIF/TRI na v2.0.0.",
      },
      {
        id: "QT_SEGMENTO_BT-2.0.0",
        formulaId: "QT_SEGMENTO_BT",
        version: "2.0.0",
        status: "active",
        name: "Queda de Tensão por Segmento BT (com fator de fase)",
        description:
          "Fórmula conforme ANEEL PRODIST Módulo 8. Fator φ=2 para MONO (circuito ida+volta), φ=1 para BIF/TRI.",
        expression:
          "QT_trecho = φ × P_kVA × Z_Ω_km × L_m / V_phase_V²\n" +
          "onde φ = 2 (MONO) | 1 (BIF, TRI)",
        constants: {
          V_phase_V: 127,
          phi_MONO: 2,
          phi_BIF: 1,
          phi_TRI: 1,
          Z_unit: "Ω/km",
          L_unit: "m",
        },
        standardReference: "ANEEL PRODIST Módulo 8, §4.2 + ABNT NBR 5410 §6.5",
        effectiveDate: "2026-05-01",
        definitionHash: computeDefinitionHash(
          "QT_trecho = φ × P_kVA × Z_Ω_km × L_m / V_phase_V²",
          { V_phase_V: 127, phi_MONO: 2, phi_BIF: 1, phi_TRI: 1 },
        ),
        changeReason:
          "Auditoria técnica BT (2026-05-05): incluído fator φ para rede monofásica.",
      },
    ],
  },
  {
    id: "RESISTENCIA_CORRIGIDA",
    category: "conductor",
    activeVersion: "1.0.0",
    versions: [
      {
        id: "RESISTENCIA_CORRIGIDA-1.0.0",
        formulaId: "RESISTENCIA_CORRIGIDA",
        version: "1.0.0",
        status: "active",
        name: "Resistência Elétrica Corrigida por Temperatura",
        description:
          "Correção da resistência nominal do condutor para a temperatura de operação, " +
          "conforme tabela ABNT NBR 7285 e coeficiente de temperatura do alumínio/cobre.",
        expression:
          "R_corr = (R_nom / divisorR) × [1 + α × (T_op − 20)]",
        constants: {
          alpha_Al: 0.00403,
          alpha_Cu: 0.00393,
          T_ref_C: 20,
          T_default_C: 75,
          divisorR_Al_XLPE: 1.2821,
          divisorR_Cu_XLPE: 1.2751,
          divisorR_Al_PVC: 1.2015,
        },
        standardReference:
          "ABNT NBR 7285 + IEC 60228, coeficiente α conforme PRODIST §8.3",
        effectiveDate: "2025-01-01",
        definitionHash: computeDefinitionHash(
          "R_corr = (R_nom / divisorR) × [1 + α × (T_op − 20)]",
          {
            alpha_Al: 0.00403,
            alpha_Cu: 0.00393,
            T_ref_C: 20,
            T_default_C: 75,
          },
        ),
      },
    ],
  },
  {
    id: "LIMITE_CQT_ANEEL",
    category: "cqt",
    activeVersion: "2.0.0",
    versions: [
      {
        id: "LIMITE_CQT_ANEEL-1.0.0",
        formulaId: "LIMITE_CQT_ANEEL",
        version: "1.0.0",
        status: "deprecated",
        name: "Limite de Queda de Tensão ANEEL (valor incorreto)",
        description:
          "Versão com threshold de 50% — erro de implementação detectado em auditoria.",
        expression: "CQT_HIGH se qtTotal > 0.50",
        constants: { limite_percentual: 50 },
        standardReference: "—",
        effectiveDate: "2025-01-01",
        deprecatedDate: "2026-05-05",
        definitionHash: computeDefinitionHash("CQT_HIGH se qtTotal > 0.50", {
          limite_percentual: 50,
        }),
        changeReason:
          "Auditoria técnica (2026-05-05): limite incorreto. ANEEL PRODIST Módulo 8 define 8%.",
      },
      {
        id: "LIMITE_CQT_ANEEL-2.0.0",
        formulaId: "LIMITE_CQT_ANEEL",
        version: "2.0.0",
        status: "active",
        name: "Limite de Queda de Tensão ANEEL (PRODIST Módulo 8)",
        description:
          "Limite regulatório ANEEL de 8% (urgente) para queda de tensão acumulada em BT.",
        expression: "CQT_HIGH se qtTotal > ANEEL_CQT_LIMIT (0.08 = 8%)",
        constants: {
          ANEEL_CQT_LIMIT: 0.08,
          limite_percentual: 8,
        },
        standardReference:
          "ANEEL PRODIST Módulo 8, §6.1 — Limite Urgente de QT em BT",
        effectiveDate: "2026-05-05",
        definitionHash: computeDefinitionHash(
          "CQT_HIGH se qtTotal > ANEEL_CQT_LIMIT (0.08 = 8%)",
          { ANEEL_CQT_LIMIT: 0.08, limite_percentual: 8 },
        ),
        changeReason:
          "Corrigido para 8% conforme ANEEL PRODIST Módulo 8 — auditoria técnica BT (2026-05-05).",
      },
    ],
  },
  {
    id: "TENSAO_PISO_OPERACIONAL",
    category: "bt_radial",
    activeVersion: "2.0.0",
    versions: [
      {
        id: "TENSAO_PISO_OPERACIONAL-1.0.0",
        formulaId: "TENSAO_PISO_OPERACIONAL",
        version: "1.0.0",
        status: "deprecated",
        name: "Tensão Mínima BT (teórica)",
        description:
          "Tensão de piso calculada como 127 × (1 − 0.08) = 116,84 V. Valor teórico sem arredondamento operacional.",
        expression: "V_min = V_phase × (1 − CQT_limit) = 127 × 0,92 = 116,84 V",
        constants: {
          V_phase_V: 127,
          CQT_limit: 0.08,
          V_min_V: 116.84,
        },
        standardReference: "ANEEL PRODIST Módulo 8",
        effectiveDate: "2025-01-01",
        deprecatedDate: "2026-05-05",
        definitionHash: computeDefinitionHash(
          "V_min = V_phase × (1 − CQT_limit) = 127 × 0,92 = 116,84 V",
          { V_phase_V: 127, CQT_limit: 0.08, V_min_V: 116.84 },
        ),
        changeReason: "Ajustado para prática operacional Light S.A.: 117 V.",
      },
      {
        id: "TENSAO_PISO_OPERACIONAL-2.0.0",
        formulaId: "TENSAO_PISO_OPERACIONAL",
        version: "2.0.0",
        status: "active",
        name: "Tensão Mínima BT (prática operacional Light S.A.)",
        description:
          "Tensão de piso de 117 V conforme prática operacional da Light S.A. " +
          "Arredondamento conservador acima do teórico 116,84 V.",
        expression: "V_min = 117 V (piso operacional)",
        constants: {
          V_min_V: 117,
          V_phase_V: 127,
          margem_V: 0.16,
        },
        standardReference:
          "Light S.A. — Norma Operacional BT + ANEEL PRODIST Módulo 8 (base)",
        effectiveDate: "2026-05-05",
        definitionHash: computeDefinitionHash(
          "V_min = 117 V (piso operacional)",
          { V_min_V: 117, V_phase_V: 127, margem_V: 0.16 },
        ),
        changeReason:
          "Alinhado à prática Light S.A.: 117 V ao invés de 116,84 V calculado.",
      },
    ],
  },
  {
    id: "K8_QT_MT_TRAFO",
    category: "transformer",
    activeVersion: "1.0.0",
    versions: [
      {
        id: "K8_QT_MT_TRAFO-1.0.0",
        formulaId: "K8_QT_MT_TRAFO",
        version: "1.0.0",
        status: "active",
        name: "QT no Trafo — Contribuição MT (K8)",
        description:
          "Queda de tensão na parcela MT + trafo, indicador K8 do workbook CQT Light.",
        expression:
          "K8 = (DEM_kVA / TR_kVA) × zFactor\n" +
          "onde zFactor = impedância relativa do trafo (padrão 3,5%)",
        constants: {
          zFactor_default: 0.035,
          QT_MT_fraction: 0.0183,
        },
        standardReference:
          "Workbook CQT Light S.A. — Planilha K8, coluna H1",
        effectiveDate: "2025-01-01",
        definitionHash: computeDefinitionHash(
          "K8 = (DEM_kVA / TR_kVA) × zFactor",
          { zFactor_default: 0.035, QT_MT_fraction: 0.0183 },
        ),
      },
    ],
  },
];

// ─── Store em memória ────────────────────────────────────────────────────────

let catalog: FormulaDefinition[] = INITIAL_CATALOG.map((def) => ({
  ...def,
  versions: def.versions.map((v) => ({ ...v })),
}));

type FormulaRow = {
  formula_id: string;
  category: FormulaCategory;
  version: string;
  status: VersionStatus;
  name: string;
  description: string;
  expression: string;
  constants: Record<string, number | string>;
  standard_reference: string;
  effective_date: string;
  deprecated_date: string | null;
  definition_hash: string;
  change_reason: string | null;
};

type SqlClient = ReturnType<typeof postgres>;

let sqlClient: SqlClient | null = null;
let postgresAvailable = false;
let initPromise: Promise<void> | null = null;

function cloneInitialCatalog(): FormulaDefinition[] {
  return INITIAL_CATALOG.map((def) => ({
    ...def,
    versions: def.versions.map((v) => ({ ...v })),
  }));
}

async function initializeStorage(): Promise<void> {
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    if (!config.DATABASE_URL) {
      postgresAvailable = false;
      return;
    }

    try {
      sqlClient = postgres(config.DATABASE_URL, {
        ssl: config.NODE_ENV === "production" ? "require" : undefined,
        max: 2,
        connect_timeout: 8,
        idle_timeout: 10,
      });

      await sqlClient`select 1`;
      postgresAvailable = true;
    } catch (error) {
      postgresAvailable = false;
      logger.warn("formulaVersioningService using in-memory fallback", {
        error: error instanceof Error ? error.message : String(error),
      });
      if (sqlClient) {
        await sqlClient.end({ timeout: 3 }).catch(() => undefined);
      }
      sqlClient = null;
    }
  })();

  return initPromise;
}

function mapRowToVersion(row: FormulaRow): FormulaVersion {
  return {
    id: `${row.formula_id}-${row.version}`,
    formulaId: row.formula_id,
    version: row.version,
    status: row.status,
    name: row.name,
    description: row.description,
    expression: row.expression,
    constants: row.constants,
    standardReference: row.standard_reference,
    effectiveDate: row.effective_date,
    deprecatedDate: row.deprecated_date ?? undefined,
    definitionHash: row.definition_hash,
    changeReason: row.change_reason ?? undefined,
  };
}

function rowsToCatalog(rows: FormulaRow[]): FormulaDefinition[] {
  const grouped = new Map<string, FormulaDefinition>();

  for (const row of rows) {
    const version = mapRowToVersion(row);
    const existing = grouped.get(row.formula_id);

    if (!existing) {
      grouped.set(row.formula_id, {
        id: row.formula_id,
        category: row.category,
        activeVersion: row.status === "active" ? row.version : "",
        versions: [version],
      });
      continue;
    }

    existing.versions.push(version);
    if (row.status === "active") {
      existing.activeVersion = row.version;
    }
  }

  return Array.from(grouped.values()).map((def) => {
    const sortedVersions = [...def.versions].sort((a, b) =>
      b.version.localeCompare(a.version, undefined, { numeric: true }),
    );
    const activeVersion =
      def.activeVersion || sortedVersions.find((v) => v.status === "active")?.version || "";
    return {
      ...def,
      activeVersion,
      versions: sortedVersions,
    };
  });
}

async function seedDatabaseFromInitialCatalog(sql: any): Promise<void> {
  for (const def of INITIAL_CATALOG) {
    for (const version of def.versions) {
      await sql`
        insert into public.formula_versions (
          formula_id,
          category,
          version,
          status,
          name,
          description,
          expression,
          constants,
          standard_reference,
          effective_date,
          deprecated_date,
          definition_hash,
          change_reason
        )
        values (
          ${version.formulaId},
          ${def.category},
          ${version.version},
          ${version.status},
          ${version.name},
          ${version.description},
          ${version.expression},
          ${sql.json(version.constants)},
          ${version.standardReference},
          ${version.effectiveDate},
          ${version.deprecatedDate ?? null},
          ${version.definitionHash},
          ${version.changeReason ?? null}
        )
        on conflict (formula_id, version) do nothing
      `;
    }
  }
}

async function loadCatalogSnapshot(): Promise<FormulaDefinition[]> {
  await initializeStorage();

  if (!postgresAvailable || !sqlClient) {
    return catalog;
  }

  const rows = await sqlClient<FormulaRow[]>`
    select
      formula_id,
      category,
      version,
      status,
      name,
      description,
      expression,
      constants,
      standard_reference,
      effective_date::text,
      deprecated_date::text,
      definition_hash,
      change_reason
    from public.formula_versions
    order by formula_id asc, effective_date desc, version desc
  `;

  if (rows.length === 0) {
    await seedDatabaseFromInitialCatalog(sqlClient);
    const seededRows = await sqlClient<FormulaRow[]>`
      select
        formula_id,
        category,
        version,
        status,
        name,
        description,
        expression,
        constants,
        standard_reference,
        effective_date::text,
        deprecated_date::text,
        definition_hash,
        change_reason
      from public.formula_versions
      order by formula_id asc, effective_date desc, version desc
    `;
    return rowsToCatalog(seededRows);
  }

  return rowsToCatalog(rows);
}

// ─── Funções públicas ────────────────────────────────────────────────────────

/** Lista todas as fórmulas com sua versão ativa. */
export async function listFormulas(): Promise<Array<{
  id: string;
  category: FormulaCategory;
  activeVersion: string;
  activeEntry: FormulaVersion;
}>> {
  const snapshot = await loadCatalogSnapshot();
  return snapshot.map((def) => {
    const activeEntry = def.versions.find((v) => v.version === def.activeVersion);
    if (!activeEntry) throw new Error(`Formula ${def.id} missing active version`);
    return {
      id: def.id,
      category: def.category,
      activeVersion: def.activeVersion,
      activeEntry,
    };
  });
}

/** Retorna a definição completa de uma fórmula pelo ID. */
export async function getFormulaById(
  formulaId: string,
): Promise<FormulaDefinition | null> {
  const snapshot = await loadCatalogSnapshot();
  return snapshot.find((d) => d.id === formulaId) ?? null;
}

/** Retorna a versão ativa de uma fórmula. */
export async function getActiveVersion(
  formulaId: string,
): Promise<FormulaVersion | null> {
  const snapshot = await loadCatalogSnapshot();
  const def = snapshot.find((d) => d.id === formulaId);
  if (!def) return null;
  return def.versions.find((v) => v.version === def.activeVersion) ?? null;
}

/** Retorna o histórico de versões de uma fórmula em ordem decrescente. */
export async function getVersionHistory(
  formulaId: string,
): Promise<FormulaVersion[]> {
  const snapshot = await loadCatalogSnapshot();
  const def = snapshot.find((d) => d.id === formulaId);
  if (!def) return [];
  return [...def.versions].sort((a, b) =>
    b.version.localeCompare(a.version, undefined, { numeric: true }),
  );
}

/** Calcula o diff entre duas versões de uma fórmula. */
export async function diffVersions(
  formulaId: string,
  v1: string,
  v2: string,
): Promise<FormulaDiff | null> {
  const snapshot = await loadCatalogSnapshot();
  const def = snapshot.find((d) => d.id === formulaId);
  if (!def) return null;

  const ver1 = def.versions.find((v) => v.version === v1);
  const ver2 = def.versions.find((v) => v.version === v2);
  if (!ver1 || !ver2) return null;

  const changedFields: FormulaDiff["changedFields"] = [];

  const fields: Array<keyof FormulaVersion> = [
    "expression",
    "constants",
    "standardReference",
    "status",
  ];

  for (const field of fields) {
    const before = ver1[field];
    const after = ver2[field];
    const beforeStr = JSON.stringify(before);
    const afterStr = JSON.stringify(after);
    if (beforeStr !== afterStr) {
      changedFields.push({ field, before, after });
    }
  }

  const isBreaking =
    changedFields.some((f) => f.field === "expression" || f.field === "constants");

  return {
    formulaId,
    v1,
    v2,
    changedFields,
    isBreaking,
    breakingReason: isBreaking
      ? "Alteração em expressão ou constantes pode alterar resultados de cálculo."
      : undefined,
  };
}

/**
 * Registra uma nova versão de fórmula (ou cria nova fórmula).
 * Retorna a versão registrada.
 */
export async function registerFormulaVersion(
  formulaId: string,
  category: FormulaCategory,
  versionEntry: Omit<FormulaVersion, "id" | "formulaId" | "definitionHash">,
): Promise<FormulaVersion> {
  const hash = computeDefinitionHash(
    versionEntry.expression,
    versionEntry.constants,
  );

  const newVersion: FormulaVersion = {
    ...versionEntry,
    id: `${formulaId}-${versionEntry.version}`,
    formulaId,
    definitionHash: hash,
  };

  await initializeStorage();

  if (postgresAvailable && sqlClient) {
    const duplicate = await sqlClient<Pick<FormulaRow, "version">[]>`
      select version
      from public.formula_versions
      where formula_id = ${formulaId} and version = ${versionEntry.version}
      limit 1
    `;

    if (duplicate.length > 0) {
      throw new Error(
        `Versão ${versionEntry.version} já existe para fórmula ${formulaId}.`,
      );
    }

    await sqlClient.begin(async (sql) => {
      if (versionEntry.status === "active") {
        await sql`
          update public.formula_versions
          set status = 'deprecated',
              deprecated_date = ${versionEntry.effectiveDate}
          where formula_id = ${formulaId}
            and status = 'active'
            and version <> ${versionEntry.version}
        `;
      }

      await sql`
        insert into public.formula_versions (
          formula_id,
          category,
          version,
          status,
          name,
          description,
          expression,
          constants,
          standard_reference,
          effective_date,
          deprecated_date,
          definition_hash,
          change_reason
        )
        values (
          ${formulaId},
          ${category},
          ${versionEntry.version},
          ${versionEntry.status},
          ${versionEntry.name},
          ${versionEntry.description},
          ${versionEntry.expression},
          ${sql.json(versionEntry.constants)},
          ${versionEntry.standardReference},
          ${versionEntry.effectiveDate},
          ${versionEntry.deprecatedDate ?? null},
          ${newVersion.definitionHash},
          ${versionEntry.changeReason ?? null}
        )
      `;
    });

    return newVersion;
  }

  const existing = catalog.find((d) => d.id === formulaId);
  if (existing) {
    const duplicate = existing.versions.find(
      (v) => v.version === versionEntry.version,
    );
    if (duplicate) {
      throw new Error(
        `Versão ${versionEntry.version} já existe para fórmula ${formulaId}.`,
      );
    }
    existing.versions.push(newVersion);
    if (versionEntry.status === "active") {
      // Deprecar versão anteriormente ativa
      for (const v of existing.versions) {
        if (v.version !== versionEntry.version && v.status === "active") {
          v.status = "deprecated";
          v.deprecatedDate = versionEntry.effectiveDate;
        }
      }
      existing.activeVersion = versionEntry.version;
    }
  } else {
    catalog.push({
      id: formulaId,
      category,
      activeVersion:
        versionEntry.status === "active" ? versionEntry.version : "",
      versions: [newVersion],
    });
  }

  return newVersion;
}

/** Retorna sumário de fórmulas com versões depreciadas que ainda não têm substituto. */
export async function getDeprecationReport(): Promise<Array<{
  formulaId: string;
  deprecatedVersion: string;
  replacedBy?: string;
}>> {
  const snapshot = await loadCatalogSnapshot();
  const result: Array<{
    formulaId: string;
    deprecatedVersion: string;
    replacedBy?: string;
  }> = [];
  for (const def of snapshot) {
    for (const v of def.versions) {
      if (v.status === "deprecated") {
        const newer = def.versions.find(
          (other) =>
            other.status === "active" &&
            other.version.localeCompare(v.version, undefined, { numeric: true }) > 0,
        );
        result.push({
          formulaId: def.id,
          deprecatedVersion: v.version,
          replacedBy: newer?.version,
        });
      }
    }
  }
  return result;
}

/** Reseta o catálogo para o estado inicial (uso em testes). */
export async function resetCatalog(): Promise<void> {
  catalog = cloneInitialCatalog();
  await initializeStorage();

  if (!postgresAvailable || !sqlClient) {
    return;
  }

  await sqlClient.begin(async (sql) => {
    await sql`delete from public.formula_versions`;
    await seedDatabaseFromInitialCatalog(sql);
  });
}

