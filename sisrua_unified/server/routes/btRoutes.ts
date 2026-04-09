import { Router, Request, Response } from 'express';
import { btCalculationRequestSchema } from '../schemas/btSchema.js';
import { BtCalculationService } from '../services/btCalculationService.js';
import { logger } from '../utils/logger.js';

const router = Router();
const MAX_ERROR_LENGTH = 200;

/**
 * POST /api/bt/calculate
 *
 * Synchronous BT topology calculation endpoint.
 * Accepts a validated BtCalculationRequest and returns a BtCalculationResponse
 * (versioned contract v1).
 *
 * @swagger
 * /api/bt/calculate:
 *   post:
 *     summary: Calculate BT topology demand, voltage drop and sectioning impact
 *     tags: [BT]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [topology]
 *             properties:
 *               topology:
 *                 type: object
 *               settings:
 *                 type: object
 *               constants:
 *                 type: object
 *               mode:
 *                 type: string
 *                 enum: [standard, sectioning, clandestine, full]
 *     responses:
 *       200:
 *         description: Calculation result
 *       400:
 *         description: Validation error
 *       500:
 *         description: Internal server error
 */
router.post('/calculate', (req: Request, res: Response) => {
    const validation = btCalculationRequestSchema.safeParse(req.body);

    if (!validation.success) {
        logger.warn('BT calculation validation failed', {
            issues: validation.error.issues,
            ip: req.ip,
        });
        return res.status(400).json({
            error: 'Invalid BT calculation request',
            details: validation.error.issues.map((i) => i.message).join(', '),
        });
    }

    try {
        const result = BtCalculationService.calculate(validation.data);

        logger.info('BT calculation completed', {
            version: result.version,
            totalConsumers: result.summary.totalConsumers,
            totalDemandKw: result.summary.totalDemandKw,
            ip: req.ip,
        });

        return res.json(result);
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        logger.error('BT calculation engine error', { error: msg });
        return res.status(500).json({
            error: 'BT calculation failed',
            details: msg.slice(0, MAX_ERROR_LENGTH),
        });
    }
});

export default router;
