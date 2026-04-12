import { Router, Request, Response } from 'express';
import { IndeService } from '../services/indeService.js';
import { logger } from '../utils/logger.js';

const router = Router();
const INDE_INTERNAL_ERROR_RESPONSE = { error: 'INDE service temporarily unavailable' };

const VALID_SOURCES = ['ibge', 'icmbio', 'ana', 'dnit'] as const;

const parseFiniteNumber = (raw: unknown): number | null => {
    const value = Number.parseFloat(String(raw));
    return Number.isFinite(value) ? value : null;
};

const isValidLongitude = (value: number): boolean => value >= -180 && value <= 180;
const isValidLatitude = (value: number): boolean => value >= -90 && value <= 90;

// Get WFS capabilities (available layers)
router.get('/capabilities/:source', async (req: Request, res: Response) => {
    try {
        const { source } = req.params;

        if (!VALID_SOURCES.includes(source as typeof VALID_SOURCES[number])) {
            return res.status(400).json({ error: 'Invalid source', validSources: VALID_SOURCES });
        }

        const capabilities = await IndeService.getWfsCapabilities(source as any);
        return res.json({ source, layers: capabilities });
    } catch (error: any) {
        logger.error('INDE capabilities endpoint error', { error, source: req.params.source });
        return res.status(500).json(INDE_INTERNAL_ERROR_RESPONSE);
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

        if (!VALID_SOURCES.includes(source as typeof VALID_SOURCES[number])) {
            return res.status(400).json({ error: 'Invalid source', validSources: VALID_SOURCES });
        }

        const westNumber = parseFiniteNumber(west);
        const southNumber = parseFiniteNumber(south);
        const eastNumber = parseFiniteNumber(east);
        const northNumber = parseFiniteNumber(north);
        const limitNumber = Number.parseInt(String(limit), 10);

        if (
            westNumber === null ||
            southNumber === null ||
            eastNumber === null ||
            northNumber === null ||
            !isValidLongitude(westNumber) ||
            !isValidLongitude(eastNumber) ||
            !isValidLatitude(southNumber) ||
            !isValidLatitude(northNumber) ||
            westNumber >= eastNumber ||
            southNumber >= northNumber
        ) {
            return res.status(400).json({
                error: 'Invalid bounding box. Expected west<east, south<north and valid latitude/longitude ranges.'
            });
        }

        if (!Number.isFinite(limitNumber) || limitNumber < 1 || limitNumber > 5000) {
            return res.status(400).json({ error: 'Invalid limit. Expected integer between 1 and 5000.' });
        }

        const features = await IndeService.getFeaturesByBBox(
            layer as string,
            westNumber,
            southNumber,
            eastNumber,
            northNumber,
            source as any,
            limitNumber
        );

        if (features) {
            return res.json(features);
        } else {
            return res.status(404).json({ error: 'No features found' });
        }
    } catch (error: any) {
        logger.error('INDE features endpoint error', { error });
        return res.status(500).json(INDE_INTERNAL_ERROR_RESPONSE);
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

        if (!VALID_SOURCES.includes(source as typeof VALID_SOURCES[number])) {
            return res.status(400).json({ error: 'Invalid source', validSources: VALID_SOURCES });
        }

        const westNumber = parseFiniteNumber(west);
        const southNumber = parseFiniteNumber(south);
        const eastNumber = parseFiniteNumber(east);
        const northNumber = parseFiniteNumber(north);
        const widthNumber = Number.parseInt(String(width), 10);
        const heightNumber = Number.parseInt(String(height), 10);

        if (
            westNumber === null ||
            southNumber === null ||
            eastNumber === null ||
            northNumber === null ||
            !isValidLongitude(westNumber) ||
            !isValidLongitude(eastNumber) ||
            !isValidLatitude(southNumber) ||
            !isValidLatitude(northNumber) ||
            westNumber >= eastNumber ||
            southNumber >= northNumber
        ) {
            return res.status(400).json({
                error: 'Invalid bounding box. Expected west<east, south<north and valid latitude/longitude ranges.'
            });
        }

        if (!Number.isFinite(widthNumber) || !Number.isFinite(heightNumber) || widthNumber < 64 || widthNumber > 4096 || heightNumber < 64 || heightNumber > 4096) {
            return res.status(400).json({ error: 'Invalid width/height. Expected integers between 64 and 4096.' });
        }

        const mapUrl = IndeService.getWmsMapUrl(
            layer as string,
            westNumber,
            southNumber,
            eastNumber,
            northNumber,
            widthNumber,
            heightNumber,
            source as any
        );

        return res.json({ url: mapUrl });
    } catch (error: any) {
        logger.error('INDE WMS endpoint error', { error });
        return res.status(500).json(INDE_INTERNAL_ERROR_RESPONSE);
    }
});

export default router;
