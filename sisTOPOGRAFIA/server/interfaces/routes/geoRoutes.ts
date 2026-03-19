import { Router, Request, Response } from 'express';
import { searchSchema, elevationProfileSchema, analyzePadSchema } from '../../schemas/apiSchemas.js';
import { GeocodingService } from '../../services/geocodingService.js';
import { ElevationService } from '../../services/elevationService.js';
import { analyzePad } from '../../pythonBridge.js';
import { logger } from '../../utils/logger.js';
import multer from 'multer';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const smallBodyParser = (await import('express')).default.json({ limit: '100kb' });

// POST /api/search
router.post('/search', smallBodyParser, async (req: Request, res: Response) => {
    try {
        const validation = searchSchema.safeParse(req.body);
        if (!validation.success) {
            logger.warn('Search validation failed', { issues: validation.error.issues, ip: req.ip });
            return res.status(400).json({
                error: 'Requisição inválida',
                details: validation.error.issues.map(i => i.message).join(', ')
            });
        }
        const location = await GeocodingService.resolveLocation(validation.data.query);
        if (location) return res.json(location);
        return res.status(404).json({ error: 'Localização não encontrada' });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error('Search error', { error });
        return res.status(500).json({ error: msg });
    }
});

// POST /api/elevation/profile
router.post('/elevation/profile', async (req: Request, res: Response) => {
    try {
        const validation = elevationProfileSchema.safeParse(req.body);
        if (!validation.success) {
            logger.warn('Elevation profile validation failed', { issues: validation.error.issues, ip: req.ip });
            return res.status(400).json({
                error: 'Requisição inválida',
                details: validation.error.issues.map(i => i.message).join(', ')
            });
        }
        const { start, end, steps } = validation.data;
        logger.info('Fetching elevation profile', { start, end, steps });
        const profile = await ElevationService.getElevationProfile(start, end, steps);
        return res.json({ profile });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        const stack = error instanceof Error ? error.stack : undefined;
        logger.error('Elevation profile error', { error: msg, stack });
        return res.status(500).json({ error: msg });
    }
});

// POST /api/analyze-pad
router.post('/analyze-pad', upload.none(), async (req: Request, res: Response) => {
    try {
        const validation = analyzePadSchema.safeParse(req.body);
        if (!validation.success) {
            logger.warn('Analyze Pad validation failed', { issues: validation.error.issues, ip: req.ip });
            return res.status(400).json({
                error: 'Requisição inválida',
                details: validation.error.issues.map(i => i.message).join(', ')
            });
        }
        const { polygon, target_z, autoBalance } = validation.data;
        logger.info('Pad Analysis requested', { targetZ: target_z, autoBalance });
        const result = await analyzePad({ polygon, targetZ: target_z, autoBalance });
        return res.json(result);
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        const stack = error instanceof Error ? error.stack : undefined;
        logger.error('Analyze Pad error', { error: msg, stack });
        return res.status(500).json({ error: msg });
    }
});

export default router;
