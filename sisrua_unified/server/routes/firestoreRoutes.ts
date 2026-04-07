import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger.js';
import { config } from '../config.js';

const router = Router();

// Firestore Health Check - Simplified
router.get('/health', async (_req: Request, res: Response) => {
    try {
        return res.json({
            status: config.useFirestore ? 'enabled' : 'disabled',
            timestamp: new Date().toISOString()
        });
    } catch (error: any) {
        logger.error('Firestore health check failed', { error });
        return res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
});

// Firestore Quota Status - Simplified
router.get('/quota', async (_req: Request, res: Response) => {
    try {
        return res.json({
            enabled: config.useFirestore,
            message: 'Quota tracking not implemented in this version',
            timestamp: new Date().toISOString()
        });
    } catch (error: any) {
        logger.error('Firestore status check failed', { error });
        return res.status(500).json({
            enabled: false,
            error: error.message,
            message: 'Failed to retrieve Firestore status'
        });
    }
});

export default router;
