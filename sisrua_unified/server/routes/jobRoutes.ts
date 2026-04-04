import { Router, Request, Response } from 'express';
import { getJob } from '../services/jobStatusService.js';
import { logger } from '../utils/logger.js';

const router = Router();

// Job Status Endpoint
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const job = getJob(req.params.id);
        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        return res.json({
            id: job.id,
            status: job.status,
            progress: job.progress,
            result: job.result,
            error: job.error
        });
    } catch (err: any) {
        logger.error('Job status lookup failed', { error: err });
        return res.status(500).json({ error: 'Failed to retrieve job status', details: err.message });
    }
});

export default router;
