import { Router, Request, Response } from 'express';
import { IbgeService } from '../services/ibgeService.js';
import { logger } from '../utils/logger.js';

const router = Router();
const IBGE_INTERNAL_ERROR_RESPONSE = { error: 'IBGE service temporarily unavailable' };

// Get location info by coordinates (reverse geocoding)
router.get('/location', async (req: Request, res: Response) => {
    try {
        const { lat, lng } = req.query;

        if (!lat || !lng) {
            return res.status(400).json({ error: 'lat and lng query parameters required' });
        }

        const latitude = parseFloat(lat as string);
        const longitude = parseFloat(lng as string);

        if (isNaN(latitude) || isNaN(longitude)) {
            return res.status(400).json({ error: 'Invalid coordinates' });
        }

        logger.info('IBGE reverse geocoding', { lat: latitude, lng: longitude });

        const locationInfo = await IbgeService.findMunicipioByCoordinates(latitude, longitude);

        if (locationInfo) {
            return res.json(locationInfo);
        } else {
            return res.status(404).json({ error: 'Location not found in Brazilian territory' });
        }
    } catch (error: any) {
        logger.error('IBGE location endpoint error', { error });
        return res.status(500).json(IBGE_INTERNAL_ERROR_RESPONSE);
    }
});

// Get all states
router.get('/states', async (_req: Request, res: Response) => {
    try {
        const states = await IbgeService.getStates();
        return res.json(states);
    } catch (error: any) {
        logger.error('IBGE states endpoint error', { error });
        return res.status(500).json(IBGE_INTERNAL_ERROR_RESPONSE);
    }
});

// Get municipalities by state
router.get('/municipios/:uf', async (req: Request, res: Response) => {
    try {
        const { uf } = req.params;
        const municipios = await IbgeService.getMunicipiosByState(uf.toUpperCase());
        return res.json(municipios);
    } catch (error: any) {
        logger.error('IBGE municipios endpoint error', { error, uf: req.params.uf });
        return res.status(500).json(IBGE_INTERNAL_ERROR_RESPONSE);
    }
});

// Get municipality boundary (GeoJSON)
router.get('/boundary/municipio/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const boundary = await IbgeService.getMunicipalityBoundary(id);

        if (boundary) {
            return res.json(boundary);
        } else {
            return res.status(404).json({ error: 'Municipality boundary not found' });
        }
    } catch (error: any) {
        logger.error('IBGE boundary endpoint error', { error, id: req.params.id });
        return res.status(500).json(IBGE_INTERNAL_ERROR_RESPONSE);
    }
});

export default router;
