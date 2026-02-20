import { Router, Request, Response } from 'express';
import { spawn } from 'child_process';
import { logger } from '../../utils/logger.js';

const router = Router();
const ALLOWED_PYTHON_COMMANDS = ['python3', 'python'];

// GET /health
router.get('/', async (_req: Request, res: Response) => {
    try {
        const pythonCommand = process.env.PYTHON_COMMAND || 'python3';

        if (!ALLOWED_PYTHON_COMMANDS.includes(pythonCommand)) {
            logger.error('Invalid PYTHON_COMMAND', { pythonCommand });
            return res.json({
                status: 'degraded',
                service: 'sisTOPOGRAFIA Backend',
                version: '1.2.0',
                python: 'unavailable',
                error: 'Invalid Python command configuration'
            });
        }

        const pythonAvailable = await new Promise<boolean>((resolve) => {
            const timeout = setTimeout(() => resolve(false), 2000);
            const proc = spawn(pythonCommand, ['--version']);
            proc.on('close', (code) => { clearTimeout(timeout); resolve(code === 0); });
            proc.on('error', () => { clearTimeout(timeout); resolve(false); });
        });

        return res.json({
            status: 'online',
            service: 'sisTOPOGRAFIA Backend',
            version: '1.2.0',
            python: pythonAvailable ? 'available' : 'unavailable',
            environment: process.env.NODE_ENV || 'development',
            dockerized: process.env.DOCKER_ENV === 'true',
            groqApiKey: { configured: !!process.env.GROQ_API_KEY }
        });
    } catch {
        return res.json({
            status: 'degraded',
            service: 'sisTOPOGRAFIA Backend',
            version: '1.2.0',
            error: 'Health check encountered an error'
        });
    }
});

// GET /api/firestore/status
router.get('/firestore/status', (_req: Request, res: Response) => {
    res.json({
        enabled: process.env.USE_FIRESTORE === 'true',
        message: 'Firestore DDD Infrastructure active. Usage is monitored internally.'
    });
});

export default router;
