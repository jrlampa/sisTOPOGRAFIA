import { Router, Request, Response } from 'express';
import { spawn } from 'child_process';
import { logger } from '../../utils/logger.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

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
                version: '1.0.0',
                python: 'unavailable',
                error: 'Invalid Python command configuration'
            });
        }

        const pythonAvailable = await new Promise<boolean>((resolve) => {
            /* istanbul ignore next */
            const timeout = setTimeout(() => resolve(false), 2000);
            const proc = spawn(pythonCommand, ['--version']);
            proc.on('close', (code) => { clearTimeout(timeout); resolve(code === 0); });
            proc.on('error', () => { clearTimeout(timeout); resolve(false); });
        });

        // OSM disk cache stats (zero-cost monitoring)
        const osmCacheDir = process.env.OSM_CACHE_DIR || path.join(os.tmpdir(), 'sistopografia_osm_cache');
        let osmCacheStats: Record<string, unknown> = { available: false };
        try {
            if (fs.existsSync(osmCacheDir)) {
                const files = fs.readdirSync(osmCacheDir).filter(f => f.startsWith('osm_') && f.endsWith('.pkl'));
                osmCacheStats = { available: true, entries: files.length, dir: osmCacheDir };
            } else {
                osmCacheStats = { available: true, entries: 0, dir: osmCacheDir };
            }
        } catch {
            osmCacheStats = { available: false };
        }

        return res.status(pythonAvailable ? 200 : 503).json({
            status: pythonAvailable ? 'online' : 'degraded',
            service: 'sisTOPOGRAFIA Backend',
            version: '1.0.0',
            python: pythonAvailable ? 'available' : 'unavailable',
            environment: process.env.NODE_ENV || 'development',
            dockerized: process.env.DOCKER_ENV === 'true',
            groqApiKey: { configured: !!process.env.GROQ_API_KEY },
            firestoreEnabled: process.env.USE_FIRESTORE === 'true',
            osmCache: osmCacheStats
        });
    } catch {
        return res.json({
            status: 'degraded',
            service: 'sisTOPOGRAFIA Backend',
            version: '1.0.0',
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
