import { Router, Request, Response } from 'express';
import { analysisSchema } from '../../schemas/apiSchemas.js';
import { AnalysisService } from '../../services/analysisService.js';
import { logger } from '../../utils/logger.js';

const router = Router();
const MAX_ERROR_MESSAGE_LENGTH = 200;
const smallBodyParser = (await import('express')).default.json({ limit: '100kb' });

// POST /api/analyze
router.post('/', smallBodyParser, async (req: Request, res: Response) => {
    try {
        const validation = analysisSchema.safeParse(req.body);
        if (!validation.success) {
            logger.warn('Analysis validation failed', { issues: validation.error.issues, ip: req.ip });
            return res.status(400).json({
                error: 'Requisição inválida',
                details: validation.error.issues.map(i => i.message).join(', ')
            });
        }

        const { stats, locationName } = validation.data;
        const apiKey = process.env.GROQ_API_KEY;
        const location = locationName || 'Área Selecionada';

        logger.info('GROQ API analysis requested', { locationName: location, hasApiKey: !!apiKey });

        if (!apiKey) {
            logger.warn('Analysis requested but GROQ_API_KEY not configured');
            return res.status(503).json({
                error: 'GROQ_API_KEY não configurada',
                message: 'Análise AI indisponível. Configure GROQ_API_KEY no .env para habilitar.',
                analysis: '**Análise AI Indisponível**\n\nConfigure a variável `GROQ_API_KEY` no arquivo `.env`.\n\nChave gratuita em: https://console.groq.com/keys'
            });
        }

        const result = await AnalysisService.analyzeArea(stats, location, apiKey!);
        logger.info('AI analysis completed successfully', { locationName: location });
        return res.json(result);

    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        const typeName = error instanceof Error ? error.constructor.name : typeof error;
        logger.error('Analysis error', {
            error: msg,
            errorType: typeName,
            isRateLimitError: msg.includes('rate limit') || msg.includes('429'),
            isAuthError: msg.includes('401') || msg.includes('unauthorized'),
            isNetworkError: msg.includes('ECONNREFUSED') || msg.includes('ETIMEDOUT')
        });

        const sanitizedMessage = msg.slice(0, MAX_ERROR_MESSAGE_LENGTH);
        let userMessage = '**Erro na Análise AI**\n\nNão foi possível processar a análise. Por favor, tente novamente.';

        if (msg.includes('rate limit') || msg.includes('429'))
            userMessage = '**Limite de Taxa Excedido**\n\nAguarde alguns momentos e tente novamente.';
        else if (msg.includes('401') || msg.includes('unauthorized'))
            userMessage = '**Erro de Autenticação**\n\nVerifique a GROQ_API_KEY no Cloud Run.';
        else if (msg.includes('ECONNREFUSED') || msg.includes('ETIMEDOUT'))
            userMessage = '**Erro de Conexão**\n\nNão foi possível conectar à API Groq.';

        return res.status(500).json({ error: 'Análise falhou', details: sanitizedMessage, analysis: userMessage });
    }
});

export default router;
