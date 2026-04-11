import { Router, Request, Response } from 'express';
import { createDxfTask } from '../services/cloudTasksService.js';
import {
    createCacheKey,
    deleteCachedFilename,
    getCachedFilename
} from '../services/cacheService.js';
import { logger } from '../utils/logger.js';
import { dxfRequestSchema } from '../schemas/dxfRequest.js';
import { dxfRateLimiter } from '../middleware/rateLimiter.js';
import { metricsService } from '../services/metricsService.js';
import { config } from '../config.js';
import { attachCqtSnapshotToBtContext } from '../services/cqtContextService.js';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { resolveDxfDirectory } from '../utils/dxfDirectory.js';

const router = Router();

const DEFAULT_ALLOWED_HOSTS = new Set(['localhost', '127.0.0.1']);

const safeParseUrl = (value: string): URL | null => {
    try {
        return new URL(value);
    } catch {
        return null;
    }
};

const getFallbackBaseUrl = (): string => {
    if (config.APP_PUBLIC_URL) {
        return config.APP_PUBLIC_URL.replace(/\/+$/, '');
    }

    if (config.CORS_ORIGIN) {
        const firstOrigin = config.CORS_ORIGIN.split(',').map((entry) => entry.trim()).find(Boolean);
        if (firstOrigin) {
            const parsed = safeParseUrl(firstOrigin);
            if (parsed) {
                return parsed.origin;
            }
        }
    }

    return `http://localhost:${config.PORT}`;
};

const buildAllowedHosts = (): Set<string> => {
    const hosts = new Set<string>(DEFAULT_ALLOWED_HOSTS);

    if (config.APP_PUBLIC_URL) {
        const parsed = safeParseUrl(config.APP_PUBLIC_URL);
        if (parsed?.hostname) {
            hosts.add(parsed.hostname.toLowerCase());
        }
    }

    if (config.CORS_ORIGIN) {
        const origins = config.CORS_ORIGIN.split(',').map((entry) => entry.trim()).filter(Boolean);
        for (const origin of origins) {
            const parsed = safeParseUrl(origin);
            if (parsed?.hostname) {
                hosts.add(parsed.hostname.toLowerCase());
            }
        }
    }

    return hosts;
};

const ALLOWED_HOSTS = buildAllowedHosts();

const normalizeProtocol = (value: unknown): 'http' | 'https' | null => {
    if (typeof value !== 'string' || value.trim().length === 0) {
        return null;
    }

    const token = value.split(',')[0].trim().toLowerCase();
    if (token === 'http' || token === 'https') {
        return token;
    }

    return null;
};

// Exported for focused unit tests.
export function getBaseUrl(req: Request): string {
    if (config.APP_PUBLIC_URL) {
        return config.APP_PUBLIC_URL.replace(/\/+$/, '');
    }

    const hostname = String(req.hostname || '').trim().toLowerCase();
    if (!hostname || !ALLOWED_HOSTS.has(hostname)) {
        const fallback = getFallbackBaseUrl();
        logger.warn('Unsafe host header detected when building DXF download URL', {
            receivedHost: req.headers.host,
            hostname,
            fallback
        });
        return fallback;
    }

    const protocol =
        normalizeProtocol(req.headers['x-forwarded-proto']) ||
        normalizeProtocol(req.protocol) ||
        (config.NODE_ENV === 'production' ? 'https' : 'http');

    const hostHeader = typeof req.headers.host === 'string' ? req.headers.host : '';
    const portMatch = hostHeader.match(/:(\d{1,5})$/);
    const port = portMatch ? Number.parseInt(portMatch[1], 10) : NaN;
    const hasValidPort = Number.isInteger(port) && port >= 1 && port <= 65535;
    const portSegment = hasValidPort ? `:${port}` : '';

    return `${protocol}://${hostname}${portSegment}`;
}

function extractCqtSummary(btContext: unknown): Record<string, unknown> | null {
    if (!btContext || typeof btContext !== 'object') {
        return null;
    }

    const context = btContext as Record<string, unknown>;
    const cqtSnapshotRaw = context.cqtSnapshot;
    if (!cqtSnapshotRaw || typeof cqtSnapshotRaw !== 'object') {
        return null;
    }

    const cqtSnapshot = cqtSnapshotRaw as Record<string, any>;
    const parity = cqtSnapshot.parity as Record<string, any> | undefined;

    return {
        scenario: typeof cqtSnapshot.scenario === 'string' ? cqtSnapshot.scenario : undefined,
        dmdi: typeof cqtSnapshot.dmdi?.dmdi === 'number' ? cqtSnapshot.dmdi.dmdi : undefined,
        p31: typeof cqtSnapshot.geral?.p31CqtNoPonto === 'number' ? cqtSnapshot.geral.p31CqtNoPonto : undefined,
        p32: typeof cqtSnapshot.geral?.p32CqtNoPonto === 'number' ? cqtSnapshot.geral.p32CqtNoPonto : undefined,
        k10QtMttr: typeof cqtSnapshot.db?.k10QtMttr === 'number' ? cqtSnapshot.db.k10QtMttr : undefined,
        parityStatus: typeof parity?.referenceStatus === 'string' ? parity.referenceStatus : undefined,
        parityPassed: typeof parity?.passed === 'number' ? parity.passed : undefined,
        parityFailed: typeof parity?.failed === 'number' ? parity.failed : undefined
    };
}

// DXF Generation Endpoint
router.post('/', dxfRateLimiter, async (req: Request, res: Response) => {
    try {
        const validation = dxfRequestSchema.safeParse(req.body);
        if (!validation.success) {
            logger.warn('DXF validation failed', {
                issues: validation.error.issues,
                ip: req.ip
            });
            return res.status(400).json({ error: 'Invalid request body', details: validation.error.issues });
        }

        const { lat, lon, radius, mode, polygon, layers, projection, contourRenderMode, btContext: validatedBtContext } = validation.data;
        const btContext = attachCqtSnapshotToBtContext(validatedBtContext ?? undefined);
        const cqtSummary = extractCqtSummary(btContext);
        const resolvedContourRenderMode = contourRenderMode === 'polyline' ? 'polyline' : 'spline';
        const resolvedMode = mode || 'circle';
        const cacheKey = createCacheKey({
            lat,
            lon,
            radius,
            mode: resolvedMode,
            contourRenderMode: resolvedContourRenderMode,
            polygon: typeof polygon === 'string' ? polygon : polygon ?? null,
            layers: layers ?? {},
            btContext: btContext ?? null
        });

        const cachedFilename = getCachedFilename(cacheKey);
        if (cachedFilename) {
            const dxfDirectory = resolveDxfDirectory();
            const cachedFilePath = path.join(dxfDirectory, cachedFilename);
            if (fs.existsSync(cachedFilePath)) {
                const baseUrl = getBaseUrl(req);
                const cachedUrl = `${baseUrl}/downloads/${cachedFilename}`;
                logger.info('DXF cache hit', { cacheKey, filename: cachedFilename, ip: req.ip });
                metricsService.recordDxfRequest('cache_hit');
                return res.json({
                    status: 'success',
                    message: 'DXF Generated',
                    url: cachedUrl,
                    ...(cqtSummary && { cqtSummary })
                });
            }
            deleteCachedFilename(cacheKey);
            logger.warn('DXF cache entry missing file', { cacheKey, filename: cachedFilename, ip: req.ip });
        } else {
            logger.info('DXF cache miss', { cacheKey, ip: req.ip });
        }

        const baseUrl = getBaseUrl(req);
        const filename = `dxf_${Date.now()}_${crypto.randomUUID()}.dxf`;
        const dxfDirectory = resolveDxfDirectory();
        fs.mkdirSync(dxfDirectory, { recursive: true });
        const outputFile = path.join(dxfDirectory, filename);
        const downloadUrl = `${baseUrl}/downloads/${filename}`;

        logger.info('Queueing DXF generation', {
            lat, lon, radius, mode: resolvedMode,
            projection: projection || 'local',
            contourRenderMode: resolvedContourRenderMode,
            hasBtContext: !!btContext,
            hasCqtSnapshot: !!(btContext && typeof btContext === 'object' && 'cqtSnapshot' in btContext),
            cacheKey
        });

        const { taskId, alreadyCompleted } = await createDxfTask({
            lat, lon, radius,
            mode: resolvedMode,
            polygon: typeof polygon === 'string' ? polygon : JSON.stringify(polygon || []),
            layers: layers || {},
            projection: projection || 'local',
            contourRenderMode: resolvedContourRenderMode,
            btContext: btContext ?? null,
            outputFile, filename, cacheKey, downloadUrl
        });

        const responseStatus = alreadyCompleted ? 'success' : 'queued';
        metricsService.recordDxfRequest('generated');
        return res.status(alreadyCompleted ? 200 : 202).json({
            status: responseStatus,
            jobId: taskId,
            ...(cqtSummary && { cqtSummary }),
            ...(alreadyCompleted && {
                url: downloadUrl,
                message: 'DXF generated immediately in development mode'
            })
        });

    } catch (err: unknown) {
        logger.error('DXF generation error', {
            error: err instanceof Error ? err.message : String(err),
            ip: req.ip
        });
        metricsService.recordDxfRequest('failed');
        return res.status(500).json({ error: 'Generation failed' });
    }
});

export default router;
