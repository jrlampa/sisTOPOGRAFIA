import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { computeBtDerivedState } from '../services/btDerivedService.js';
import { calculateBtRadial, BtRadialValidationError } from '../services/btRadialCalculationService.js';
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
    /**
     * Optional: when provided, also runs the BT radial calculation engine and
     * includes `radialCalcOutput` in the response.  Existing consumers that do
     * not send this field are unaffected (Phase 6 – non-breaking extension).
     */
    radialCalcInput: z.object({
        transformer: z.object({
            id: z.string().min(1),
            rootNodeId: z.string().min(1),
            kva: z.number().positive(),
            zPercent: z.number().nonnegative(),
            qtMt: z.number().nonnegative(),
        }),
        nodes: z.array(z.object({
            id: z.string().min(1),
            load: z.object({
                localDemandKva: z.number().nonnegative(),
                ramal: z.object({
                    conductorId: z.string().min(1),
                    lengthMeters: z.number().positive(),
                }).optional(),
            }),
        })).min(1),
        edges: z.array(z.object({
            fromNodeId: z.string().min(1),
            toNodeId: z.string().min(1),
            conductorId: z.string().min(1),
            lengthMeters: z.number().positive(),
        })),
        phase: z.enum(['MONO', 'BIF', 'TRI']),
        temperatureC: z.number().positive().optional(),
        nominalVoltageV: z.number().positive().optional(),
    }).optional(),
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

        const { topology, projectType, clandestinoAreaM2, radialCalcInput } = validation.data;
        const payload = computeBtDerivedState(topology, projectType, clandestinoAreaM2);

        // Phase 6 – non-breaking extension: run radial calc when input is provided.
        if (radialCalcInput) {
            try {
                const radialCalcOutput = calculateBtRadial(radialCalcInput);
                return res.json({ ...payload, radialCalcOutput });
            } catch (calcErr) {
                if (calcErr instanceof BtRadialValidationError) {
                    return res.status(422).json({
                        error: 'Radial calculation topology validation failed',
                        code: calcErr.code,
                        message: calcErr.message,
                    });
                }
                logger.error('BT radial calc error inside derived endpoint', { error: calcErr });
                return res.status(500).json({ error: 'Radial calculation failed' });
            }
        }

        return res.json(payload);
    } catch (error) {
        logger.error('BT derived computation error', { error });
        return res.status(500).json({ error: 'Failed to compute BT derived state' });
    }
});

export default router;
