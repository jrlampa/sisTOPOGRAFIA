import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { computeBtDerivedState } from '../services/btDerivedService.js';
import { logger } from '../utils/logger.js';

const router = Router();

const btRamalSchema = z.object({
    quantity: z.coerce.number().int().nonnegative(),
    ramalType: z.string().optional(),
}).passthrough();

const btPoleSchema = z.object({
    id: z.string().min(1),
    lat: z.coerce.number(),
    lng: z.coerce.number(),
    circuitBreakPoint: z.boolean().optional(),
    ramais: z.array(btRamalSchema).optional(),
}).passthrough();

const btTransformerReadingSchema = z.object({
    id: z.string().optional(),
    currentMaxA: z.coerce.number().optional(),
    temperatureFactor: z.coerce.number().optional(),
    billedBrl: z.coerce.number().optional(),
    unitRateBrlPerKwh: z.coerce.number().optional(),
    autoCalculated: z.boolean().optional(),
}).passthrough();

const btTransformerSchema = z.object({
    id: z.string().min(1),
    poleId: z.string().optional(),
    demandKw: z.coerce.number().default(0),
    readings: z.array(btTransformerReadingSchema).default([]),
}).passthrough();

const btEdgeSchema = z.object({
    fromPoleId: z.string().min(1),
    toPoleId: z.string().min(1),
    lengthMeters: z.coerce.number().optional(),
    removeOnExecution: z.boolean().optional(),
    edgeChangeFlag: z.enum(['existing', 'new', 'remove', 'replace']).optional(),
}).passthrough();

const btDerivedRequestSchema = z.object({
    projectType: z.enum(['ramais', 'geral', 'clandestino']),
    clandestinoAreaM2: z.coerce.number().nonnegative().optional().default(0),
    topology: z.object({
        poles: z.array(btPoleSchema),
        transformers: z.array(btTransformerSchema),
        edges: z.array(btEdgeSchema),
    }),
});

router.post('/derived', (req: Request, res: Response) => {
    try {
        const validation = btDerivedRequestSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({
                error: 'Invalid request',
                details: validation.error.issues.map((i) => i.message).join(', '),
            });
        }

        const { topology, projectType, clandestinoAreaM2 } = validation.data;
        const payload = computeBtDerivedState(topology, projectType, clandestinoAreaM2);
        return res.json(payload);
    } catch (error) {
        logger.error('BT derived computation error', { 
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            projectType: req.body?.projectType,
            topologySize: {
                poles: req.body?.topology?.poles?.length,
                transformers: req.body?.topology?.transformers?.length,
                edges: req.body?.topology?.edges?.length
            }
        });
        return res.status(500).json({ error: 'Failed to compute BT derived state' });
    }
});

export default router;
