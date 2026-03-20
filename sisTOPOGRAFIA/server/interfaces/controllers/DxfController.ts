import { Request, Response } from 'express';
import { logger } from '../../utils/logger.js';
import { dxfGenerationRequestSchema } from '../schemas/dxfSchema.js';
import { GenerateDxfUseCase } from '../../application/GenerateDxfUseCase.js';

export class DxfController {
    constructor(private readonly generateDxfUseCase: GenerateDxfUseCase) { }

    async generate(req: Request, res: Response) {
        try {
            // Apply strict validation
            const validation = dxfGenerationRequestSchema.safeParse(req.body);
            if (!validation.success) {
                logger.warn('DXF strict validation failed via DxfController', {
                    issues: validation.error.issues,
                    ip: req.ip
                });
                return res.status(400).json({ error: 'Invalid request body', details: validation.error.issues });
            }

            const result = await this.generateDxfUseCase.execute(validation.data, req);
            return res.status(result.status).json(result.data);

        } catch (err: unknown) {
            logger.error('DXF generation error via controller', { error: err });
            return res.status(500).json({ error: 'Generation failed', details: err instanceof Error ? err.message : String(err) });
        }
    }
}
