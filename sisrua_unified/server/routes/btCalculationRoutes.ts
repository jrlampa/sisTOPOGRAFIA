/**
 * BT Calculation Routes (E6-H1)
 *
 * POST /api/bt/calculate  – radial voltage-drop + demand calculation
 * GET  /api/bt/catalog    – conductor/transformer catalog info
 * GET  /api/bt/parity     – parity suite report
 *
 * Feature flag: BT_RADIAL_ENABLED (env var).
 * - With flag OFF: 404 (no impact on existing consumers).
 * - With flag ON:  full calculation response + optional fields.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { calculateBtRadial, BtRadialValidationError } from '../services/btRadialCalculationService.js';
import { getBtCatalog, getCatalogVersion } from '../services/btCatalogService.js';
import { runBtParitySuite, listBtParityScenarios } from '../services/btParityService.js';
import { logger } from '../utils/logger.js';

const router = Router();

// ─── Input schemas ────────────────────────────────────────────────────────────

const ramalSchema = z.object({
    conductorId: z.string().min(1),
    lengthMeters: z.number().positive(),
});

const nodeLoadSchema = z.object({
    localDemandKva: z.number().nonnegative(),
    ramal: ramalSchema.optional(),
});

const nodeSchema = z.object({
    id: z.string().min(1),
    load: nodeLoadSchema,
});

const edgeSchema = z.object({
    fromNodeId: z.string().min(1),
    toNodeId: z.string().min(1),
    conductorId: z.string().min(1),
    lengthMeters: z.number().positive(),
});

const transformerSchema = z.object({
    id: z.string().min(1),
    rootNodeId: z.string().min(1),
    kva: z.number().positive(),
    zPercent: z.number().nonnegative(),
    qtMt: z.number().nonnegative(),
});

const btCalculateRequestSchema = z.object({
    transformer: transformerSchema,
    nodes: z.array(nodeSchema).min(1),
    edges: z.array(edgeSchema),
    phase: z.enum(['MONO', 'BIF', 'TRI']),
    temperatureC: z.number().positive().optional(),
    nominalVoltageV: z.number().positive().optional(),
    eta: z.number().positive().max(1.0).optional(),
});

// ─── Feature-flag middleware ──────────────────────────────────────────────────

function requireBtRadialEnabled(req: Request, res: Response, next: () => void): void {
    if (!config.btRadialEnabled) {
        res.status(404).json({ error: 'BT radial calculation is not enabled.' });
        return;
    }
    next();
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * POST /api/bt/calculate
 * Validate radial topology and compute voltage drop + demand.
 */
router.post('/calculate', requireBtRadialEnabled, (req: Request, res: Response) => {
    const validation = btCalculateRequestSchema.safeParse(req.body);
    if (!validation.success) {
        return res.status(400).json({
            error: 'Invalid request payload',
            details: validation.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
        });
    }

    try {
        const result = calculateBtRadial(validation.data);
        return res.json(result);
    } catch (err) {
        if (err instanceof BtRadialValidationError) {
            return res.status(422).json({
                error: 'Topology validation failed',
                code: err.code,
                message: err.message,
            });
        }
        logger.error('BT radial calculation error', { error: err });
        return res.status(500).json({ error: 'Internal calculation error' });
    }
});

/**
 * GET /api/bt/catalog
 * Return conductor/transformer catalog with version and checksum.
 */
router.get('/catalog', (req: Request, res: Response) => {
    const catalog = getBtCatalog();
    return res.json(catalog);
});

/**
 * GET /api/bt/catalog/version
 * Return only the catalog version info (lightweight health check).
 */
router.get('/catalog/version', (req: Request, res: Response) => {
    return res.json(getCatalogVersion());
});

/**
 * GET /api/bt/parity
 * Run the full parity suite and return the report.
 * Available regardless of feature flag (used by CI).
 */
router.get('/parity', (req: Request, res: Response) => {
    try {
        const report = runBtParitySuite();
        const status = report.p0Gate ? 200 : 422;
        return res.status(status).json(report);
    } catch (err) {
        logger.error('BT parity suite error', { error: err });
        return res.status(500).json({ error: 'Parity suite execution failed' });
    }
});

/**
 * GET /api/bt/parity/scenarios
 * List available parity scenarios without running them.
 */
router.get('/parity/scenarios', (req: Request, res: Response) => {
    return res.json(listBtParityScenarios());
});

export default router;
