import postgres from 'postgres';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

export interface BtExportHistoryPayload {
    exportedAt: string;
    projectType: 'ramais' | 'clandestino';
    btContextUrl: string;
    criticalPoleId: string;
    criticalAccumulatedClients: number;
    criticalAccumulatedDemandKva: number;
    verifiedPoles?: number;
    totalPoles?: number;
    verifiedEdges?: number;
    totalEdges?: number;
    verifiedTransformers?: number;
    totalTransformers?: number;
    cqt?: {
        scenario?: 'atual' | 'proj1' | 'proj2';
        dmdi?: number;
        p31?: number;
        p32?: number;
        k10QtMttr?: number;
        parityStatus?: 'complete' | 'partial' | 'missing';
        parityPassed?: number;
        parityFailed?: number;
    };
}

export interface BtExportHistoryListResult {
    entries: BtExportHistoryPayload[];
    total: number;
    limit: number;
    offset: number;
}

export interface BtExportHistoryClearResult {
    deleted: number;
}

export interface BtExportHistoryListFilters {
    projectType?: 'ramais' | 'clandestino';
    cqtScenario?: 'atual' | 'proj1' | 'proj2';
}

export interface BtExportHistoryIngestPayload {
    projectType: 'ramais' | 'clandestino';
    btContextUrl: string;
    btContext: unknown;
    exportedAt?: string;
}

export interface BtExportHistoryIngestResult {
    stored: boolean;
    entry: BtExportHistoryPayload | null;
}

type SqlClient = ReturnType<typeof postgres>;

interface BtExportHistoryRow {
    created_at: string;
    project_type: 'ramais' | 'clandestino';
    bt_context_url: string;
    critical_pole_id: string;
    critical_accumulated_clients: number;
    critical_accumulated_demand_kva: string | number;
    verified_poles: number | null;
    total_poles: number | null;
    verified_edges: number | null;
    total_edges: number | null;
    verified_transformers: number | null;
    total_transformers: number | null;
    cqt_scenario: 'atual' | 'proj1' | 'proj2' | null;
    cqt_dmdi: string | number | null;
    cqt_p31: string | number | null;
    cqt_p32: string | number | null;
    cqt_k10_qt_mttr: string | number | null;
    cqt_parity_status: 'complete' | 'partial' | 'missing' | null;
    cqt_parity_passed: number | null;
    cqt_parity_failed: number | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const toNumberOrUndefined = (value: unknown): number | undefined =>
    typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const toNonEmptyStringOrUndefined = (value: unknown): string | undefined =>
    typeof value === 'string' && value.trim().length > 0 ? value : undefined;

const toScenarioOrUndefined = (value: unknown): 'atual' | 'proj1' | 'proj2' | undefined => {
    if (value === 'atual' || value === 'proj1' || value === 'proj2') {
        return value;
    }

    return undefined;
};

const toParityStatusOrUndefined = (value: unknown): 'complete' | 'partial' | 'missing' | undefined => {
    if (value === 'complete' || value === 'partial' || value === 'missing') {
        return value;
    }

    return undefined;
};

class BtExportHistoryService {
    private sql: SqlClient | null = null;

    private getSql(): SqlClient | null {
        if (!config.DATABASE_URL) {
            return null;
        }

        if (!this.sql) {
            this.sql = postgres(config.DATABASE_URL, {
                max: 2,
                idle_timeout: 30,
                connect_timeout: 5,
                ssl: 'require',
            });
        }

        return this.sql;
    }

    private mapRowToEntry(row: BtExportHistoryRow): BtExportHistoryPayload {
        const cqtEnabled =
            row.cqt_scenario !== null ||
            row.cqt_dmdi !== null ||
            row.cqt_p31 !== null ||
            row.cqt_p32 !== null ||
            row.cqt_k10_qt_mttr !== null ||
            row.cqt_parity_status !== null ||
            row.cqt_parity_passed !== null ||
            row.cqt_parity_failed !== null;

        return {
            exportedAt: row.created_at,
            projectType: row.project_type,
            btContextUrl: row.bt_context_url,
            criticalPoleId: row.critical_pole_id,
            criticalAccumulatedClients: row.critical_accumulated_clients,
            criticalAccumulatedDemandKva: Number(row.critical_accumulated_demand_kva),
            verifiedPoles: row.verified_poles ?? undefined,
            totalPoles: row.total_poles ?? undefined,
            verifiedEdges: row.verified_edges ?? undefined,
            totalEdges: row.total_edges ?? undefined,
            verifiedTransformers: row.verified_transformers ?? undefined,
            totalTransformers: row.total_transformers ?? undefined,
            cqt: cqtEnabled
                ? {
                      scenario: row.cqt_scenario ?? undefined,
                      dmdi: row.cqt_dmdi !== null ? Number(row.cqt_dmdi) : undefined,
                      p31: row.cqt_p31 !== null ? Number(row.cqt_p31) : undefined,
                      p32: row.cqt_p32 !== null ? Number(row.cqt_p32) : undefined,
                      k10QtMttr: row.cqt_k10_qt_mttr !== null ? Number(row.cqt_k10_qt_mttr) : undefined,
                      parityStatus: row.cqt_parity_status ?? undefined,
                      parityPassed: row.cqt_parity_passed ?? undefined,
                      parityFailed: row.cqt_parity_failed ?? undefined,
                  }
                : undefined,
        };
    }

    private buildEntryFromContext(payload: BtExportHistoryIngestPayload): BtExportHistoryPayload | null {
        if (!isRecord(payload.btContext)) {
            return null;
        }

        const criticalPole = isRecord(payload.btContext.criticalPole) ? payload.btContext.criticalPole : null;
        const poleId = toNonEmptyStringOrUndefined(criticalPole?.poleId);
        if (!poleId) {
            return null;
        }

        const cqtSnapshot = isRecord(payload.btContext.cqtSnapshot) ? payload.btContext.cqtSnapshot : null;
        const cqtGeral = isRecord(cqtSnapshot?.geral) ? cqtSnapshot.geral : null;
        const cqtDb = isRecord(cqtSnapshot?.db) ? cqtSnapshot.db : null;
        const cqtDmdi = isRecord(cqtSnapshot?.dmdi) ? cqtSnapshot.dmdi : null;
        const cqtParity = isRecord(cqtSnapshot?.parity) ? cqtSnapshot.parity : null;

        const cqtSummary = cqtSnapshot
            ? {
                  scenario: toScenarioOrUndefined(cqtSnapshot.scenario),
                  dmdi: toNumberOrUndefined(cqtDmdi?.dmdi),
                  p31: toNumberOrUndefined(cqtGeral?.p31CqtNoPonto),
                  p32: toNumberOrUndefined(cqtGeral?.p32CqtNoPonto),
                  k10QtMttr: toNumberOrUndefined(cqtDb?.k10QtMttr),
                  parityStatus: toParityStatusOrUndefined(cqtParity?.referenceStatus),
                  parityPassed: toNumberOrUndefined(cqtParity?.passed),
                  parityFailed: toNumberOrUndefined(cqtParity?.failed),
              }
            : undefined;

        return {
            exportedAt: payload.exportedAt && !Number.isNaN(Date.parse(payload.exportedAt))
                ? payload.exportedAt
                : new Date().toISOString(),
            projectType: payload.projectType,
            btContextUrl: payload.btContextUrl,
            criticalPoleId: poleId,
            criticalAccumulatedClients: toNumberOrUndefined(criticalPole?.accumulatedClients) ?? 0,
            criticalAccumulatedDemandKva: toNumberOrUndefined(criticalPole?.accumulatedDemandKva) ?? 0,
            verifiedPoles: toNumberOrUndefined(payload.btContext.verifiedPoles),
            totalPoles: toNumberOrUndefined(payload.btContext.totalPoles),
            verifiedEdges: toNumberOrUndefined(payload.btContext.verifiedEdges),
            totalEdges: toNumberOrUndefined(payload.btContext.totalEdges),
            verifiedTransformers: toNumberOrUndefined(payload.btContext.verifiedTransformers),
            totalTransformers: toNumberOrUndefined(payload.btContext.totalTransformers),
            cqt: cqtSummary,
        };
    }

    async create(entry: BtExportHistoryPayload): Promise<boolean> {
        const sql = this.getSql();
        if (!sql) {
            return false;
        }

        try {
            await sql`
                INSERT INTO bt_export_history (
                    project_type,
                    bt_context_url,
                    critical_pole_id,
                    critical_accumulated_clients,
                    critical_accumulated_demand_kva,
                    verified_poles,
                    total_poles,
                    verified_edges,
                    total_edges,
                    verified_transformers,
                    total_transformers,
                    cqt_scenario,
                    cqt_dmdi,
                    cqt_p31,
                    cqt_p32,
                    cqt_k10_qt_mttr,
                    cqt_parity_status,
                    cqt_parity_passed,
                    cqt_parity_failed,
                    metadata
                ) VALUES (
                    ${entry.projectType},
                    ${entry.btContextUrl},
                    ${entry.criticalPoleId},
                    ${entry.criticalAccumulatedClients},
                    ${entry.criticalAccumulatedDemandKva},
                    ${entry.verifiedPoles ?? null},
                    ${entry.totalPoles ?? null},
                    ${entry.verifiedEdges ?? null},
                    ${entry.totalEdges ?? null},
                    ${entry.verifiedTransformers ?? null},
                    ${entry.totalTransformers ?? null},
                    ${entry.cqt?.scenario ?? null},
                    ${entry.cqt?.dmdi ?? null},
                    ${entry.cqt?.p31 ?? null},
                    ${entry.cqt?.p32 ?? null},
                    ${entry.cqt?.k10QtMttr ?? null},
                    ${entry.cqt?.parityStatus ?? null},
                    ${entry.cqt?.parityPassed ?? null},
                    ${entry.cqt?.parityFailed ?? null},
                    ${sql.json({ exportedAt: entry.exportedAt })}
                )
            `;

            return true;
        } catch (err: unknown) {
            logger.warn('[BtExportHistoryService] failed to insert row', {
                error: err instanceof Error ? err.message : String(err),
            });
            return false;
        }
    }

    async ingestFromContext(payload: BtExportHistoryIngestPayload): Promise<BtExportHistoryIngestResult> {
        const entry = this.buildEntryFromContext(payload);
        if (!entry) {
            return { stored: false, entry: null };
        }

        const stored = await this.create(entry);
        return { stored, entry };
    }

    async list(limit: number, offset: number, filters: BtExportHistoryListFilters = {}): Promise<BtExportHistoryListResult> {
        const safeLimit = Math.max(1, Math.min(limit, 200));
        const safeOffset = Math.max(0, offset);

        const sql = this.getSql();
        if (!sql) {
            return { entries: [], total: 0, limit: safeLimit, offset: safeOffset };
        }

        try {
            const filterProjectType = filters.projectType ?? null;
            const filterCqtScenario = filters.cqtScenario ?? null;
            const rows = await sql<BtExportHistoryRow[]>`
                SELECT
                    created_at,
                    project_type,
                    bt_context_url,
                    critical_pole_id,
                    critical_accumulated_clients,
                    critical_accumulated_demand_kva,
                    verified_poles,
                    total_poles,
                    verified_edges,
                    total_edges,
                    verified_transformers,
                    total_transformers,
                    cqt_scenario,
                    cqt_dmdi,
                    cqt_p31,
                    cqt_p32,
                    cqt_k10_qt_mttr,
                    cqt_parity_status,
                    cqt_parity_passed,
                    cqt_parity_failed
                FROM bt_export_history
                WHERE (${filterProjectType}::text IS NULL OR project_type = ${filterProjectType})
                                    AND (${filterCqtScenario}::text IS NULL OR cqt_scenario = ${filterCqtScenario})
                ORDER BY created_at DESC
                LIMIT ${safeLimit}
                OFFSET ${safeOffset}
            `;

            const totalRows = await sql<Array<{ total: string }>>`
                SELECT COUNT(*)::text AS total
                FROM bt_export_history
                WHERE (${filterProjectType}::text IS NULL OR project_type = ${filterProjectType})
                                    AND (${filterCqtScenario}::text IS NULL OR cqt_scenario = ${filterCqtScenario})
            `;

            return {
                entries: rows.map((row) => this.mapRowToEntry(row)),
                total: Number(totalRows[0]?.total ?? '0'),
                limit: safeLimit,
                offset: safeOffset,
            };
        } catch (err: unknown) {
            logger.warn('[BtExportHistoryService] failed to list rows', {
                error: err instanceof Error ? err.message : String(err),
            });
            return { entries: [], total: 0, limit: safeLimit, offset: safeOffset };
        }
    }

    async clear(filters: BtExportHistoryListFilters = {}): Promise<BtExportHistoryClearResult> {
        const sql = this.getSql();
        if (!sql) {
            return { deleted: 0 };
        }

        try {
            const filterProjectType = filters.projectType ?? null;
            const filterCqtScenario = filters.cqtScenario ?? null;

            const deletedRows = await sql<Array<{ deleted: string }>>`
                WITH deleted_rows AS (
                    DELETE FROM bt_export_history
                    WHERE (${filterProjectType}::text IS NULL OR project_type = ${filterProjectType})
                      AND (${filterCqtScenario}::text IS NULL OR cqt_scenario = ${filterCqtScenario})
                    RETURNING 1
                )
                SELECT COUNT(*)::text AS deleted
                FROM deleted_rows
            `;

            return {
                deleted: Number(deletedRows[0]?.deleted ?? '0')
            };
        } catch (err: unknown) {
            logger.warn('[BtExportHistoryService] failed to clear rows', {
                error: err instanceof Error ? err.message : String(err),
            });
            return { deleted: 0 };
        }
    }
}

export const btExportHistoryService = new BtExportHistoryService();
