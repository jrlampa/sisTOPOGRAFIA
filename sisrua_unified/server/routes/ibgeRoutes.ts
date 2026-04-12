import { Router, Request, Response } from 'express';
import { IbgeService } from '../services/ibgeService.js';
import { logger } from '../utils/logger.js';
import { ibgeCoordinatesSchema, ibgeUfSchema, ibgeMunicipioIdSchema } from '../schemas/apiSchemas.js';

const router = Router();
const IBGE_INTERNAL_ERROR_RESPONSE = { error: 'IBGE service temporarily unavailable' };

// Get location info by coordinates (reverse geocoding)
router.get('/location', async (req: Request, res: Response) => {
    try {
        const validation = ibgeCoordinatesSchema.safeParse(req.query);
        if (!validation.success) {
            return res.status(400).json({
                error: 'Invalid coordinates',
                details: validation.error.issues.map((i) => i.message).join(', '),
            });
        }

        const { lat: latitude, lng: longitude } = validation.data;

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
        const validation = ibgeUfSchema.safeParse({ uf: req.params.uf?.toUpperCase() });
        if (!validation.success) {
            return res.status(400).json({
                error: 'Invalid UF code',
                details: validation.error.issues.map((i) => i.message).join(', '),
            });
        }
        const municipios = await IbgeService.getMunicipiosByState(validation.data.uf);
        return res.json(municipios);
    } catch (error: any) {
        logger.error('IBGE municipios endpoint error', { error, uf: req.params.uf });
        return res.status(500).json(IBGE_INTERNAL_ERROR_RESPONSE);
    }
});

// Get municipality boundary (GeoJSON)
router.get('/boundary/municipio/:id', async (req: Request, res: Response) => {
    try {
        const validation = ibgeMunicipioIdSchema.safeParse({ id: req.params.id });
        if (!validation.success) {
            return res.status(400).json({
                error: 'Invalid municipality id',
                details: validation.error.issues.map((i) => i.message).join(', '),
            });
        }

        const boundary = await IbgeService.getMunicipalityBoundary(validation.data.id);

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
