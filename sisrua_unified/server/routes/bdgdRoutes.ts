/**
 * BDGD Routes (Item 53 – T1)
 *
 * GET  /api/bdgd/layers          – lista camadas BDGD suportadas e seus campos
 * POST /api/bdgd/validate        – valida registros contra a especificação ANEEL
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { listBdgdLayers } from '../constants/bdgdAneel.js';
import {
    buildBdgdValidationReport,
    isBdgdConformant,
} from '../services/bdgdValidatorService.js';
import { logger } from '../utils/logger.js';

const router = Router();

// ─── Schema de validação de entrada ──────────────────────────────────────────

const bdgdRecordSchema = z.record(z.unknown());

const bdgdValidateInputSchema = z.object({
    layers: z.record(z.array(bdgdRecordSchema)).refine(
        (layers) => Object.keys(layers).length > 0,
        { message: 'Ao menos uma camada deve ser informada.' },
    ),
});

// ─── GET /api/bdgd/layers ─────────────────────────────────────────────────────

/**
 * @openapi
 * /api/bdgd/layers:
 *   get:
 *     summary: Lista camadas BDGD suportadas
 *     description: Retorna definição das camadas ANEEL disponíveis para validação.
 *     tags: [BDGD ANEEL]
 *     responses:
 *       200:
 *         description: Camadas disponíveis
 */
router.get('/layers', (_req: Request, res: Response) => {
    const layers = listBdgdLayers().map((layer) => ({
        code: layer.code,
        description: layer.description,
        fields: layer.fields.map((f) => ({
            name: f.name,
            type: f.type,
            required: f.required,
            ...(f.maxLength !== undefined && { maxLength: f.maxLength }),
            ...(f.min !== undefined && { min: f.min }),
            ...(f.max !== undefined && { max: f.max }),
            ...(f.allowedCodes !== undefined && {
                allowedCodes: [...(f.allowedCodes as Set<unknown>)],
            }),
        })),
    }));

    res.json({ layers });
});

// ─── POST /api/bdgd/validate ──────────────────────────────────────────────────

/**
 * @openapi
 * /api/bdgd/validate:
 *   post:
 *     summary: Valida registros BDGD contra a especificação ANEEL
 *     description: >
 *       Recebe registros por camada (SEGBT, PONNOT, EQTRAT, RAMBT) e retorna
 *       relatório de conformidade com regras R1–R6.
 *     tags: [BDGD ANEEL]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [layers]
 *             properties:
 *               layers:
 *                 type: object
 *                 description: Mapa de camada para array de registros
 *     responses:
 *       200:
 *         description: Relatório de conformidade
 *       400:
 *         description: Entrada inválida
 */
router.post('/validate', (req: Request, res: Response) => {
    const parsed = bdgdValidateInputSchema.safeParse(req.body);

    if (!parsed.success) {
        return res.status(400).json({
            error: 'Entrada inválida',
            details: parsed.error.issues.map((i) => i.message),
        });
    }

    const report = buildBdgdValidationReport(parsed.data);
    const statusCode = isBdgdConformant(report) ? 200 : 422;

    logger.info('BDGD validation completed', {
        layersChecked: report.totals.layersChecked,
        totalRecords: report.totals.totalRecords,
        errors: report.totals.errors,
        conformant: report.conformant,
    });

    return res.status(statusCode).json(report);
});

export default router;
