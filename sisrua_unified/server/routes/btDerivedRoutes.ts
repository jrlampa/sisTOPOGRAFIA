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

const btTransformerSchema = z.object({
    id: z.string().min(1),
    poleId: z.string().optional(),
    demandKw: z.coerce.number().default(0),
    readings: z.array(z.object({ id: z.string().optional() }).passthrough()).default([]),
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
        logger.error('BT derived computation error', { error });
        return res.status(500).json({ error: 'Failed to compute BT derived state' });
    }
});

export default router;
