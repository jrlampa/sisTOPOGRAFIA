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

import { INITIAL_CATALOG } from "./formulaCatalog.js";

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

