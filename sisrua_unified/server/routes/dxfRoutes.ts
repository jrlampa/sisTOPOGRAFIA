import { Router, Request, Response } from 'express';
import { createDxfTask } from '../services/cloudTasksService.js';
import { createJob } from '../services/jobStatusService.js';
import {
    createCacheKey,
    deleteCachedFilename,
    getCachedFilename
} from '../services/cacheService.js';
import { logger } from '../utils/logger.js';
import { dxfRequestSchema } from '../schemas/dxfRequest.js';
import { dxfRateLimiter } from '../middleware/rateLimiter.js';
import path from 'path';
import fs from 'fs';

const router = Router();

// Helper to get base URL
function getBaseUrl(req: Request): string {
    const host = req.headers.host || 'localhost:3001';
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    return `${protocol}://${host}`;
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

        const { lat, lon, radius, mode } = validation.data;
        const { polygon, layers, projection, contourRenderMode } = req.body;
        const resolvedContourRenderMode = contourRenderMode === 'polyline' ? 'polyline' : 'spline';
        const resolvedMode = mode || 'circle';
        const cacheKey = createCacheKey({
            lat,
            lon,
            radius,
            mode: resolvedMode,
            contourRenderMode: resolvedContourRenderMode,
            polygon: typeof polygon === 'string' ? polygon : polygon ?? null,
            layers: layers ?? {}
        });

        const cachedFilename = getCachedFilename(cacheKey);
        if (cachedFilename) {
            const dxfDirectory = process.env.DXF_DIRECTORY || './public/dxf';
            const cachedFilePath = path.join(dxfDirectory, cachedFilename);
            if (fs.existsSync(cachedFilePath)) {
                const baseUrl = getBaseUrl(req);
                const cachedUrl = `${baseUrl}/downloads/${cachedFilename}`;
                logger.info('DXF cache hit', { cacheKey, filename: cachedFilename, ip: req.ip });
                return res.json({
                    status: 'success',
                    message: 'DXF Generated',
                    url: cachedUrl
                });
            }
            deleteCachedFilename(cacheKey);
            logger.warn('DXF cache entry missing file', { cacheKey, filename: cachedFilename, ip: req.ip });
        } else {
            logger.info('DXF cache miss', { cacheKey, ip: req.ip });
        }

        const baseUrl = getBaseUrl(req);
        const filename = `dxf_${Date.now()}.dxf`;
        const dxfDirectory = process.env.DXF_DIRECTORY || './public/dxf';
        fs.mkdirSync(dxfDirectory, { recursive: true });
        const outputFile = path.join(dxfDirectory, filename);
        const downloadUrl = `${baseUrl}/downloads/${filename}`;

        logger.info('Queueing DXF generation', {
            lat, lon, radius, mode: resolvedMode,
            projection: projection || 'local',
            contourRenderMode: resolvedContourRenderMode,
            cacheKey
        });

        const { taskId, alreadyCompleted } = await createDxfTask({
            lat, lon, radius,
            mode: resolvedMode,
            polygon: typeof polygon === 'string' ? polygon : JSON.stringify(polygon || []),
            layers: layers || {},
            projection: projection || 'local',
            contourRenderMode: resolvedContourRenderMode,
            outputFile, filename, cacheKey, downloadUrl
        });

        if (!alreadyCompleted) {
            createJob(taskId);
        }

        const responseStatus = alreadyCompleted ? 'success' : 'queued';
        return res.status(alreadyCompleted ? 200 : 202).json({
            status: responseStatus,
            jobId: taskId,
            ...(alreadyCompleted && {
                url: downloadUrl,
                message: 'DXF generated immediately in development mode'
            })
        });

    } catch (err: any) {
        logger.error('DXF generation error', { error: err });
        return res.status(500).json({ error: 'Generation failed', details: err.message });
    }
});

export default router;
