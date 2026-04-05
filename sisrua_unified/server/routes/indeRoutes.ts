import { Router, Request, Response } from 'express';
import { IndeService } from '../services/indeService.js';
import { logger } from '../utils/logger.js';

const router = Router();

// Get WFS capabilities (available layers)
router.get('/capabilities/:source', async (req: Request, res: Response) => {
    try {
        const { source } = req.params;
        const validSources = ['ibge', 'icmbio', 'ana', 'dnit'];

        if (!validSources.includes(source)) {
            return res.status(400).json({ error: 'Invalid source', validSources });
        }

        const capabilities = await IndeService.getWfsCapabilities(source as any);
        return res.json({ source, layers: capabilities });
    } catch (error: any) {
        logger.error('INDE capabilities endpoint error', { error, source: req.params.source });
        return res.status(500).json({ error: error.message });
    }
});

// Get features by bounding box
router.get('/features/:source', async (req: Request, res: Response) => {
    try {
        const { source } = req.params;
        const { layer, west, south, east, north, limit = '1000' } = req.query;

        if (!layer || !west || !south || !east || !north) {
            return res.status(400).json({
                error: 'Required parameters: layer, west, south, east, north'
            });
        }

        const features = await IndeService.getFeaturesByBBox(
            layer as string,
            parseFloat(west as string),
            parseFloat(south as string),
            parseFloat(east as string),
            parseFloat(north as string),
            source as any,
            parseInt(limit as string)
        );

        if (features) {
            return res.json(features);
        } else {
            return res.status(404).json({ error: 'No features found' });
        }
    } catch (error: any) {
        logger.error('INDE features endpoint error', { error });
        return res.status(500).json({ error: error.message });
    }
});

// Get WMS map URL
router.get('/wms/:source', async (req: Request, res: Response) => {
    try {
        const { source } = req.params;
        const { layer, west, south, east, north, width = '1024', height = '768' } = req.query;

        if (!layer || !west || !south || !east || !north) {
            return res.status(400).json({
                error: 'Required parameters: layer, west, south, east, north'
            });
        }

        const mapUrl = IndeService.getWmsMapUrl(
            layer as string,
            parseFloat(west as string),
            parseFloat(south as string),
            parseFloat(east as string),
            parseFloat(north as string),
            parseInt(width as string),
            parseInt(height as string),
            source as any
        );

        return res.json({ url: mapUrl });
    } catch (error: any) {
        logger.error('INDE WMS endpoint error', { error });
        return res.status(500).json({ error: error.message });
    }
});

export default router;
