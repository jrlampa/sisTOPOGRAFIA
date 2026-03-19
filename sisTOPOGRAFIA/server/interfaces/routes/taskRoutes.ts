import { Router, Request, Response } from 'express';
import { generateDxf } from '../../pythonBridge.js';
import {
    createJob, updateJobStatus, completeJob, failJob, getJob
} from '../../services/jobStatusServiceFirestore.js';
import { setCachedFilename } from '../../services/cacheServiceFirestore.js';
import { scheduleDxfDeletion } from '../../services/dxfCleanupService.js';
import { webhookRateLimiter } from '../../middleware/auth.js';
import { verifyCloudTasksToken } from '../../middleware/auth.js';
import { logger } from '../../utils/logger.js';

const router = Router();

// POST /api/tasks/process-dxf — Cloud Tasks webhook (OIDC protected)
router.post(
    '/process-dxf',
    webhookRateLimiter,
    verifyCloudTasksToken,
    async (req: Request, res: Response) => {
        try {
            logger.info('DXF task webhook processing authenticated request', { taskId: req.body.taskId });

            const {
                taskId, lat, lon, radius, mode,
                polygon, layers, projection,
                outputFile, filename, cacheKey, downloadUrl
            } = req.body;

            if (!taskId) return res.status(400).json({ error: 'Task ID é obrigatório' });

            await updateJobStatus(taskId, 'processing', 10);
            logger.info('Processing DXF generation task', { taskId, lat, lon, radius, mode, cacheKey });

            try {
                await generateDxf({ lat, lon, radius, mode, polygon, layers, projection, outputFile });

                await setCachedFilename(cacheKey, filename);
                scheduleDxfDeletion(outputFile);
                await completeJob(taskId, { url: downloadUrl, filename });

                logger.info('DXF generation completed', { taskId, filename, cacheKey });
                return res.status(200).json({ status: 'success', taskId, url: downloadUrl, filename });

            } catch (error: unknown) {
                const msg = error instanceof Error ? error.message : String(error);
                const stack = error instanceof Error ? error.stack : undefined;
                logger.error('DXF generation failed', { taskId, error: msg, stack });
                await failJob(taskId, msg);
                return res.status(500).json({ status: 'failed', taskId, error: msg });
            }

        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            const stack = error instanceof Error ? error.stack : undefined;
            logger.error('Task webhook error', { error: msg, stack });
            return res.status(500).json({ error: 'Task processing failed', details: msg });
        }
    }
);

// GET /api/jobs/:id — Status de processamento assíncrono
router.get('/jobs/:id', async (req: Request, res: Response) => {
    try {
        const job = await getJob(req.params.id);
        if (!job) return res.status(404).json({ error: 'Job não encontrado' });
        return res.json({ id: job.id, status: job.status, progress: job.progress, result: job.result, error: job.error });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error('Job status lookup failed', { error: msg });
        return res.status(500).json({ error: 'Falha ao buscar status do job', details: msg });
    }
});

export default router;
