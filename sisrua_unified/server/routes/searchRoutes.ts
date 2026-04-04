import { Router, Request, Response } from 'express';
import { GeocodingService } from '../services/geocodingService.js';
import { logger } from '../utils/logger.js';
import { searchSchema } from '../schemas/apiSchemas.js';

const router = Router();

// Coordinate Search Endpoint
router.post('/', async (req: Request, res: Response) => {
    try {
        const validation = searchSchema.safeParse(req.body);
        if (!validation.success) {
            logger.warn('Search validation failed', {
                issues: validation.error.issues,
                ip: req.ip
            });
            return res.status(400).json({
                error: 'Invalid request',
                details: validation.error.issues.map(i => i.message).join(', ')
            });
        }

        const { query } = validation.data;
        const location = await GeocodingService.resolveLocation(query);

        if (location) {
            return res.json(location);
        } else {
            return res.status(404).json({ error: 'Location not found' });
        }
    } catch (error: any) {
        logger.error('Search error', { error });
        return res.status(500).json({ error: error.message });
    }
});

export default router;
