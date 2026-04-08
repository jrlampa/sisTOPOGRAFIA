/**
 * ConstantsService — DB-backed lookup table catalog with in-memory cache.
 *
 * Usage pattern:
 *   1. Call `constantsService.warmUp(namespaces)` once at server startup.
 *   2. Callers use `constantsService.getSync<T>(namespace, key)` — always
 *      fast (synchronous, from Map) after warmup.
 *   3. If warmup failed or the flag is off, callers fall back to hardcoded values.
 *
 * When `DATABASE_URL` is not set the service silently no-ops (no connection,
 * no crash) — the hardcoded fallback remains in effect.
 */
import postgres from 'postgres';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

interface CatalogRow {
    namespace: string;
    key: string;
    value: unknown;
    version_hash: string;
}

interface CacheEntry {
    value: unknown;
    version_hash: string;
    loadedAt: number;
}

interface RefreshEventRow {
    namespaces: string[];
    success: boolean;
    http_status: number;
    actor: string;
    duration_ms: number | null;
    error_message: string | null;
    created_at: string;
}

interface RefreshStatsSummaryRow {
    total_count: string;
    success_count: string;
    failure_count: string;
    avg_duration_ms: string | null;
    max_duration_ms: number | null;
    min_success_duration_ms: number | null;
    last_success_at: string | null;
    first_refresh_at: string | null;
}

interface NsFreqRow {
    ns: string;
    refresh_count: string;
}

interface ActorFreqRow {
    actor: string;
    refresh_count: string;
    success_count: string;
    last_seen_at: string;
}

export interface ConstantsRefreshStats {
    totalRefreshes: number;
    successCount: number;
    failureCount: number;
    successRate: number;
    avgDurationMs: number | null;
    maxDurationMs: number | null;
    minSuccessDurationMs: number | null;
    lastSuccessAt: string | null;
    firstRefreshAt: string | null;
    namespaceFrequency: Record<string, number>;
    topActors: Array<{ actor: string; refreshCount: number; successCount: number; lastSeenAt: string }>;
}

interface SnapshotRow {
    id: string;
    namespace: string;
    actor: string;
    label: string | null;
    data: Record<string, unknown>;
    entry_count: number;
    created_at: string;
}

export interface CatalogSnapshot {
    id: number;
    namespace: string;
    actor: string;
    label: string | null;
    data: Record<string, unknown>;
    entryCount: number;
    createdAt: string;
}

export interface ConstantsRefreshEvent {
    namespaces: string[];
    success: boolean;
    httpStatus: number;
    actor: string;
    durationMs?: number;
    errorMessage?: string;
    createdAt?: string;
}

// Cache TTL: 24 hours. Values are warmed at startup; this TTL prevents stale
// values if the process stays alive very long without a restart.
const CACHE_TTL_MS = 24 * 60 * 60 * 1_000;

class ConstantsService {
    private readonly cache = new Map<string, CacheEntry>();
    private sql: ReturnType<typeof postgres> | null = null;

    private cacheKey(namespace: string, key: string): string {
        return `${namespace}:${key}`;
    }

    private getSqlClient(): ReturnType<typeof postgres> | null {
        if (!config.DATABASE_URL) return null;
        if (!this.sql) {
            this.sql = postgres(config.DATABASE_URL, {
                max: 2, // small pool — constants reads are rare
                idle_timeout: 30,
                connect_timeout: 5,
                ssl: config.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
            });
        }
        return this.sql;
    }

    /**
     * Load all active entries for the given namespaces from the DB into the
     * in-memory cache. Safe to call with an empty array (no-op).
     *
     * On any DB error the method logs a warning and returns — the cache is left
     * with whatever was already loaded, and callers fall back to hardcoded data.
     */
    async warmUp(namespaces: string[]): Promise<void> {
        if (namespaces.length === 0) return;

        const sql = this.getSqlClient();
        if (!sql) {
            logger.warn('[ConstantsService] warmUp skipped — DATABASE_URL not configured');
            return;
        }

        try {
            // Make warmup authoritative for requested namespaces so removed DB keys
            // do not remain stale in memory.
            for (const ns of namespaces) {
                this.invalidateNamespace(ns);
            }

            const rows = await sql<CatalogRow[]>`
                SELECT namespace, key, value, version_hash
                FROM   constants_catalog
                WHERE  namespace   = ANY(${sql.array(namespaces)})
                  AND  is_active   = true
                  AND  environment = ${config.NODE_ENV}
            `;

            const now = Date.now();
            let loaded = 0;

            for (const row of rows) {
                this.cache.set(this.cacheKey(row.namespace, row.key), {
                    value: row.value,
                    version_hash: row.version_hash,
                    loadedAt: now,
                });
                loaded++;
            }

            logger.info('[ConstantsService] warmUp complete', {
                namespaces,
                loaded,
            });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            logger.warn('[ConstantsService] warmUp failed — falling back to hardcoded', {
                error: message,
            });
        }
    }

    /**
     * Synchronous cache lookup. Returns `undefined` if the key is not cached
     * or if the entry has expired (callers should fall back to hardcoded data).
     */
    getSync<T>(namespace: string, key: string): T | undefined {
        const entry = this.cache.get(this.cacheKey(namespace, key));
        if (!entry) return undefined;

        if (Date.now() - entry.loadedAt > CACHE_TTL_MS) {
            this.cache.delete(this.cacheKey(namespace, key));
            return undefined;
        }

        return entry.value as T;
    }

    /** True if the key has a live (non-expired) cache entry. */
    has(namespace: string, key: string): boolean {
        return this.getSync(namespace, key) !== undefined;
    }

    /** Return a snapshot of loaded namespaces and their key counts (for /health). */
    stats(): Record<string, number> {
        const counts: Record<string, number> = {};
        for (const k of this.cache.keys()) {
            const ns = k.split(':')[0];
            counts[ns] = (counts[ns] ?? 0) + 1;
        }
        return counts;
    }

    /** Invalidate a specific entry so the next warmUp cycle reloads it. */
    invalidate(namespace: string, key: string): void {
        this.cache.delete(this.cacheKey(namespace, key));
    }

    /** Invalidate all entries for a namespace. */
    invalidateNamespace(namespace: string): void {
        for (const k of [...this.cache.keys()]) {
            if (k.startsWith(`${namespace}:`)) this.cache.delete(k);
        }
    }

    async recordRefreshEvent(event: ConstantsRefreshEvent): Promise<void> {
        const sql = this.getSqlClient();
        if (!sql) return;

        try {
            await sql`
                INSERT INTO constants_refresh_events (namespaces, success, http_status, actor, duration_ms, error_message)
                VALUES (${sql.array(event.namespaces)}, ${event.success}, ${event.httpStatus}, ${event.actor}, ${event.durationMs ?? null}, ${event.errorMessage ?? null})
            `;
        } catch (err: unknown) {
            logger.warn('[ConstantsService] failed to persist refresh event', {
                error: err instanceof Error ? err.message : String(err),
            });
        }
    }

    async getLastRefreshEvent(): Promise<ConstantsRefreshEvent | null> {
        const sql = this.getSqlClient();
        if (!sql) return null;

        try {
            const rows = await sql<RefreshEventRow[]>`
                SELECT namespaces, success, http_status, actor, duration_ms, error_message, created_at
                FROM constants_refresh_events
                ORDER BY created_at DESC
                LIMIT 1
            `;

            const row = rows[0];
            if (!row) return null;

            return {
                namespaces: row.namespaces,
                success: row.success,
                httpStatus: row.http_status,
                actor: row.actor,
                durationMs: row.duration_ms ?? undefined,
                errorMessage: row.error_message ?? undefined,
                createdAt: row.created_at,
            };
        } catch (err: unknown) {
            logger.warn('[ConstantsService] failed to read last refresh event', {
                error: err instanceof Error ? err.message : String(err),
            });
            return null;
        }
    }

    async getRefreshEvents(limit = 20): Promise<ConstantsRefreshEvent[]> {
        const sql = this.getSqlClient();
        if (!sql) return [];

        const safeLimit = Math.max(1, Math.min(limit, 100));

        try {
            const rows = await sql<RefreshEventRow[]>`
                SELECT namespaces, success, http_status, actor, duration_ms, error_message, created_at
                FROM constants_refresh_events
                ORDER BY created_at DESC
                LIMIT ${safeLimit}
            `;

            return rows.map((row) => ({
                namespaces: row.namespaces,
                success: row.success,
                httpStatus: row.http_status,
                actor: row.actor,
                durationMs: row.duration_ms ?? undefined,
                errorMessage: row.error_message ?? undefined,
                createdAt: row.created_at,
            }));
        } catch (err: unknown) {
            logger.warn('[ConstantsService] failed to list refresh events', {
                error: err instanceof Error ? err.message : String(err),
            });
            return [];
        }
    }

    async getRefreshStats(): Promise<ConstantsRefreshStats> {
        const empty: ConstantsRefreshStats = {
            totalRefreshes: 0,
            successCount: 0,
            failureCount: 0,
            successRate: 0,
            avgDurationMs: null,
            maxDurationMs: null,
            minSuccessDurationMs: null,
            lastSuccessAt: null,
            firstRefreshAt: null,
            namespaceFrequency: {},
            topActors: [],
        };

        const sql = this.getSqlClient();
        if (!sql) return empty;

        try {
            const [summaryRows, nsRows, actorRows] = await Promise.all([
                sql<RefreshStatsSummaryRow[]>`
                    SELECT
                        COUNT(*)                                              AS total_count,
                        COUNT(*)  FILTER (WHERE success = true)               AS success_count,
                        COUNT(*)  FILTER (WHERE success = false)              AS failure_count,
                        ROUND(AVG(duration_ms))                               AS avg_duration_ms,
                        MAX(duration_ms)                                      AS max_duration_ms,
                        MIN(duration_ms)  FILTER (WHERE success = true)       AS min_success_duration_ms,
                        MAX(created_at)   FILTER (WHERE success = true)       AS last_success_at,
                        MIN(created_at)                                       AS first_refresh_at
                    FROM constants_refresh_events
                `,
                sql<NsFreqRow[]>`
                    SELECT ns, COUNT(*) AS refresh_count
                    FROM   constants_refresh_events,
                           UNNEST(namespaces) AS ns
                    GROUP  BY ns
                    ORDER  BY refresh_count DESC
                    LIMIT  10
                `,
                sql<ActorFreqRow[]>`
                    SELECT
                        actor,
                        COUNT(*)                                    AS refresh_count,
                        COUNT(*) FILTER (WHERE success = true)      AS success_count,
                        MAX(created_at)                             AS last_seen_at
                    FROM   constants_refresh_events
                    GROUP  BY actor
                    ORDER  BY refresh_count DESC
                    LIMIT  5
                `,
            ]);

            const row = summaryRows[0];
            const total = Number(row?.total_count ?? 0);
            const success = Number(row?.success_count ?? 0);

            return {
                totalRefreshes: total,
                successCount: success,
                failureCount: Number(row?.failure_count ?? 0),
                successRate: total > 0 ? Math.round((success / total) * 100) : 0,
                avgDurationMs: row?.avg_duration_ms != null ? Number(row.avg_duration_ms) : null,
                maxDurationMs: row?.max_duration_ms ?? null,
                minSuccessDurationMs: row?.min_success_duration_ms ?? null,
                lastSuccessAt: row?.last_success_at ?? null,
                firstRefreshAt: row?.first_refresh_at ?? null,
                namespaceFrequency: Object.fromEntries(nsRows.map((r) => [r.ns, Number(r.refresh_count)])),
                topActors: actorRows.map((r) => ({
                    actor: r.actor,
                    refreshCount: Number(r.refresh_count),
                    successCount: Number(r.success_count),
                    lastSeenAt: r.last_seen_at,
                })),
            };
        } catch (err: unknown) {
            logger.warn('[ConstantsService] failed to compute refresh stats', {
                error: err instanceof Error ? err.message : String(err),
            });
            return empty;
        }
    }

    /**
     * Capture the current in-memory cache for the given namespaces as snapshots.
     * One row is inserted per namespace so each can be listed and restored
     * independently. Safe to call with an empty list (no-op).
     */
    async saveSnapshot(namespaces: string[], actor: string, label?: string): Promise<CatalogSnapshot[]> {
        const sql = this.getSqlClient();
        if (!sql || namespaces.length === 0) return [];

        const snapshots: CatalogSnapshot[] = [];

        for (const ns of namespaces) {
            // Collect all live entries for this namespace from the in-memory cache.
            const data: Record<string, unknown> = {};
            for (const [cacheKey, entry] of this.cache.entries()) {
                const [entryNs, ...keyParts] = cacheKey.split(':');
                if (entryNs === ns) {
                    data[keyParts.join(':')] = entry.value;
                }
            }

            const entryCount = Object.keys(data).length;

            try {
                const rows = await sql<SnapshotRow[]>`
                    INSERT INTO constants_catalog_snapshots (namespace, actor, label, data, entry_count)
                    VALUES (${ns}, ${actor}, ${label ?? null}, ${sql.json(data as Record<string, unknown>)}, ${entryCount})
                    RETURNING id, namespace, actor, label, data, entry_count, created_at
                `;

                const row = rows[0];
                if (row) {
                    snapshots.push({
                        id: Number(row.id),
                        namespace: row.namespace,
                        actor: row.actor,
                        label: row.label,
                        data: row.data,
                        entryCount: row.entry_count,
                        createdAt: row.created_at,
                    });
                }
            } catch (err: unknown) {
                logger.warn('[ConstantsService] failed to save snapshot', {
                    namespace: ns,
                    error: err instanceof Error ? err.message : String(err),
                });
            }
        }

        return snapshots;
    }

    /**
     * List the most recent snapshots across all namespaces (or a specific one).
     * Returns snapshots ordered newest-first, without the data payload to keep
     * the list response small.
     */
    async listSnapshots(limit = 20, namespace?: string): Promise<Omit<CatalogSnapshot, 'data'>[]> {
        const sql = this.getSqlClient();
        if (!sql) return [];

        const safeLimit = Math.max(1, Math.min(limit, 100));

        try {
            const rows = namespace
                ? await sql<SnapshotRow[]>`
                    SELECT id, namespace, actor, label, entry_count, created_at
                    FROM   constants_catalog_snapshots
                    WHERE  namespace = ${namespace}
                    ORDER  BY created_at DESC
                    LIMIT  ${safeLimit}
                  `
                : await sql<SnapshotRow[]>`
                    SELECT id, namespace, actor, label, entry_count, created_at
                    FROM   constants_catalog_snapshots
                    ORDER  BY created_at DESC
                    LIMIT  ${safeLimit}
                  `;

            return rows.map((row) => ({
                id: Number(row.id),
                namespace: row.namespace,
                actor: row.actor,
                label: row.label,
                entryCount: row.entry_count,
                createdAt: row.created_at,
            }));
        } catch (err: unknown) {
            logger.warn('[ConstantsService] failed to list snapshots', {
                error: err instanceof Error ? err.message : String(err),
            });
            return [];
        }
    }

    /**
     * Restore the in-memory cache for the snapshot's namespace from a previously
     * saved snapshot.  This is a soft restore — it only mutates the in-memory
     * cache; the underlying `constants_catalog` table is untouched.
     *
     * Returns the restored snapshot, or null if the id is not found.
     */
    async restoreSnapshot(id: number): Promise<CatalogSnapshot | null> {
        const sql = this.getSqlClient();
        if (!sql) return null;

        try {
            const rows = await sql<SnapshotRow[]>`
                SELECT id, namespace, actor, label, data, entry_count, created_at
                FROM   constants_catalog_snapshots
                WHERE  id = ${id}
                LIMIT  1
            `;

            const row = rows[0];
            if (!row) return null;

            // Invalidate namespace and repopulate from snapshot data.
            this.invalidateNamespace(row.namespace);
            const now = Date.now();

            for (const [key, value] of Object.entries(row.data)) {
                this.cache.set(this.cacheKey(row.namespace, key), {
                    value,
                    version_hash: `snap-${row.id}`,
                    loadedAt: now,
                });
            }

            logger.info('[ConstantsService] restoreSnapshot applied', {
                snapshotId: id,
                namespace: row.namespace,
                entries: Object.keys(row.data).length,
            });

            return {
                id: Number(row.id),
                namespace: row.namespace,
                actor: row.actor,
                label: row.label,
                data: row.data,
                entryCount: row.entry_count,
                createdAt: row.created_at,
            };
        } catch (err: unknown) {
            logger.warn('[ConstantsService] failed to restore snapshot', {
                snapshotId: id,
                error: err instanceof Error ? err.message : String(err),
            });
            return null;
        }
    }
}

// Singleton — shared across all imports.
export const constantsService = new ConstantsService();
