import { Router, Request, Response } from 'express';
import { config } from '../config.js';
import { getRateLimitPolicySnapshot, refreshRateLimitersFromCatalog } from '../middleware/rateLimiter.js';
import { constantsService } from '../services/constantsService.js';
import { getDxfCleanupPolicySnapshot } from '../services/dxfCleanupService.js';
import { logger } from '../utils/logger.js';

const router = Router();

const isNumberRecord = (value: unknown): value is Record<string, number> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return false;
    }

    return Object.values(value).every((item) => typeof item === 'number' && Number.isFinite(item));
};

const getDbConstantsNamespaces = (): string[] => [
    ...(config.useDbConstantsCqt ? ['cqt'] : []),
    ...(config.useDbConstantsClandestino ? ['clandestino'] : []),
    ...(config.useDbConstantsConfig ? ['config'] : []),
];

const isRefreshAuthorized = (req: Request): boolean => {
    if (!config.CONSTANTS_REFRESH_TOKEN) {
        return config.NODE_ENV !== 'production';
    }

    return req.get('x-constants-refresh-token') === config.CONSTANTS_REFRESH_TOKEN;
};

const getRefreshActor = (req: Request): string => {
    return req.get('x-refresh-actor') || req.ip || 'unknown';
};

router.get('/status', async (_req: Request, res: Response) => {
    const lastRefreshEvent = await constantsService.getLastRefreshEvent();

    return res.json({
        flags: {
            cqt: config.useDbConstantsCqt,
            clandestino: config.useDbConstantsClandestino,
            config: config.useDbConstantsConfig,
        },
        cache: constantsService.stats(),
        rateLimitPolicy: getRateLimitPolicySnapshot(),
        dxfCleanupPolicy: getDxfCleanupPolicySnapshot(),
        lastRefreshEvent,
    });
});

router.get('/refresh-events', async (req: Request, res: Response) => {
    if (!isRefreshAuthorized(req)) {
        return res.status(401).json({ error: 'Unauthorized refresh events request' });
    }

    const rawLimit = Number.parseInt(String(req.query.limit ?? '20'), 10);
    const limit = Number.isFinite(rawLimit) ? rawLimit : 20;
    const events = await constantsService.getRefreshEvents(limit);

    return res.json({ events, limit: Math.max(1, Math.min(limit, 100)) });
});

router.post('/refresh', async (req: Request, res: Response) => {
    const actor = getRefreshActor(req);
    const startedAt = Date.now();

    if (!isRefreshAuthorized(req)) {
        await constantsService.recordRefreshEvent({
            namespaces: [],
            success: false,
            httpStatus: 401,
            actor,
            durationMs: Date.now() - startedAt,
            errorMessage: 'unauthorized',
        });
        return res.status(401).json({ error: 'Unauthorized refresh request' });
    }

    const namespaces = getDbConstantsNamespaces();
    if (namespaces.length === 0) {
        await constantsService.recordRefreshEvent({
            namespaces,
            success: false,
            httpStatus: 400,
            actor,
            durationMs: Date.now() - startedAt,
            errorMessage: 'no_enabled_namespaces',
        });
        return res.status(400).json({ error: 'No DB constants namespace is enabled' });
    }

    try {
        await constantsService.warmUp(namespaces);
        refreshRateLimitersFromCatalog();
        await constantsService.recordRefreshEvent({
            namespaces,
            success: true,
            httpStatus: 200,
            actor,
            durationMs: Date.now() - startedAt,
        });

        // Capture cache snapshot immediately after successful refresh so
        // operators can roll back to this state later.
        const snapshots = await constantsService.saveSnapshot(namespaces, actor);

        return res.json({
            ok: true,
            refreshedNamespaces: namespaces,
            snapshotIds: snapshots.map((s) => s.id),
            cache: constantsService.stats(),
            rateLimitPolicy: getRateLimitPolicySnapshot(),
            dxfCleanupPolicy: getDxfCleanupPolicySnapshot(),
        });
    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        await constantsService.recordRefreshEvent({
            namespaces,
            success: false,
            httpStatus: 500,
            actor,
            durationMs: Date.now() - startedAt,
            errorMessage,
        });
        logger.warn('Manual constants refresh failed', {
            error: errorMessage,
            namespaces,
        });
        return res.status(500).json({ error: 'Manual constants refresh failed' });
    }
});

router.get('/refresh-stats', async (req: Request, res: Response) => {
    if (!isRefreshAuthorized(req)) {
        return res.status(401).json({ error: 'Unauthorized refresh stats request' });
    }

    const stats = await constantsService.getRefreshStats();
    return res.json(stats);
});

router.get('/snapshots', async (req: Request, res: Response) => {
    if (!isRefreshAuthorized(req)) {
        return res.status(401).json({ error: 'Unauthorized snapshots request' });
    }

    const rawLimit = Number.parseInt(String(req.query.limit ?? '20'), 10);
    const limit = Number.isFinite(rawLimit) ? rawLimit : 20;
    const namespace = typeof req.query.namespace === 'string' ? req.query.namespace : undefined;
    const snapshots = await constantsService.listSnapshots(limit, namespace);

    return res.json({ snapshots, limit: Math.max(1, Math.min(limit, 100)) });
});

router.post('/snapshots/:id/restore', async (req: Request, res: Response) => {
    if (!isRefreshAuthorized(req)) {
        return res.status(401).json({ error: 'Unauthorized restore request' });
    }

    const rawId = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(rawId) || rawId <= 0) {
        return res.status(400).json({ error: 'Invalid snapshot id' });
    }

    const actor = getRefreshActor(req);
    const snapshot = await constantsService.restoreSnapshot(rawId);

    if (!snapshot) {
        return res.status(404).json({ error: `Snapshot ${rawId} not found` });
    }

    logger.info('Snapshot restore applied by operator', { snapshotId: rawId, actor });

    return res.json({
        ok: true,
        restoredSnapshotId: snapshot.id,
        namespace: snapshot.namespace,
        entryCount: snapshot.entryCount,
        snapshotCreatedAt: snapshot.createdAt,
        cache: constantsService.stats(),
    });
});

router.get('/clandestino', (_req: Request, res: Response) => {
    if (!config.useDbConstantsClandestino) {
        return res.status(404).json({ error: 'DB-backed clandestino constants are disabled' });
    }

    try {
        const areaToKva = constantsService.getSync<Record<string, number>>('clandestino', 'AREA_TO_KVA');
        const clientToDiversifFactor = constantsService.getSync<Record<string, number>>('clandestino', 'CLIENT_TO_DIVERSIF_FACTOR');

        if (!isNumberRecord(areaToKva) || !isNumberRecord(clientToDiversifFactor)) {
            return res.status(503).json({ error: 'Clandestino constants catalog is not ready' });
        }

        return res.json({ areaToKva, clientToDiversifFactor });
    } catch (err: unknown) {
        logger.warn('Failed to serve clandestino constants', {
            error: err instanceof Error ? err.message : String(err)
        });
        return res.status(500).json({ error: 'Failed to load clandestino constants' });
    }
});

export default router;