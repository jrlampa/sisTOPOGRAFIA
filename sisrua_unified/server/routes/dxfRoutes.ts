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

const router = Router();

// Helper to get base URL
function getBaseUrl(req: Request): string {
    const host = req.headers.host || 'localhost:3001';
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    return `${protocol}://${host}`;
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
            const dxfDirectory = config.DXF_DIRECTORY;
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
        const filename = `dxf_${Date.now()}.dxf`;
        const dxfDirectory = config.DXF_DIRECTORY;
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

    } catch (err: any) {
        logger.error('DXF generation error', { error: err });
        metricsService.recordDxfRequest('failed');
        return res.status(500).json({ error: 'Generation failed', details: err.message });
    }
});

export default router;
