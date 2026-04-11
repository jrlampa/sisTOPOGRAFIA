import { Router, Request, Response } from 'express';
import { OllamaService } from '../services/ollamaService.js';
import { logger } from '../utils/logger.js';
import { analysisSchema } from '../schemas/apiSchemas.js';

const router = Router();
const MAX_ERROR_MESSAGE_LENGTH = 200;
const MAX_BODY_PREVIEW_LENGTH = 200;

const getBodyMetadata = (body: unknown): {
    hasBody: boolean;
    bodyType: string;
    topLevelKeyCount: number;
    topLevelKeys: string[];
    serializedSize: number;
    bodyPreview: string;
    bodyPreviewTruncated: boolean;
} => {
    const hasBody = body !== undefined && body !== null;
    const bodyType = Array.isArray(body) ? 'array' : typeof body;
    const topLevelKeys = body && typeof body === 'object' && !Array.isArray(body)
        ? Object.keys(body as Record<string, unknown>).slice(0, 10)
        : [];

    const safeSerializedBody = (() => {
        try {
            return body === undefined ? '' : JSON.stringify(body) || '';
        } catch {
            return '[unserializable-body]';
        }
    })();

    return {
        hasBody,
        bodyType,
        topLevelKeyCount: topLevelKeys.length,
        topLevelKeys,
        serializedSize: safeSerializedBody.length,
        bodyPreview: safeSerializedBody.slice(0, MAX_BODY_PREVIEW_LENGTH),
        bodyPreviewTruncated: safeSerializedBody.length > MAX_BODY_PREVIEW_LENGTH
    };
};

// AI Analyze Endpoint using Ollama local LLM
router.post('/', async (req: Request, res: Response) => {
    try {
        const validation = analysisSchema.safeParse(req.body);
        if (!validation.success) {
            logger.warn('Analysis validation failed', {
                issues: validation.error.issues,
                ip: req.ip
            });
            return res.status(400).json({
                error: 'Invalid request',
                details: validation.error.issues.map(i => i.message).join(', ')
            });
        }

        const { stats, locationName } = validation.data;
        const location = locationName || 'Área Selecionada';

        // Check if Ollama is available
        const ollamaAvailable = await OllamaService.isAvailable();

        logger.info('Ollama AI analysis requested', {
            locationName: location,
            ollamaAvailable,
            timestamp: new Date().toISOString()
        });

        if (!ollamaAvailable) {
            logger.warn('Ollama service not available');
            return res.status(503).json({
                error: 'Ollama not available',
                message: 'O serviço Ollama não está disponível. Verifique a instalação.',
                analysis: '**Análise AI Indisponível**\n\nO serviço Ollama não está disponível. Verifique se:\n1. O Ollama está instalado: https://ollama.com\n2. O serviço está rodando: `ollama serve`\n3. O modelo llama3.2 está disponível: `ollama pull llama3.2`'
            });
        }

        logger.info('Processing Ollama AI analysis request', { locationName: location, hasStats: !!stats });
        const result = await OllamaService.analyzeArea(stats, location);
        logger.info('Ollama AI analysis completed successfully', { locationName: location });
        return res.json(result);
    } catch (error: any) {
        const bodyMetadata = getBodyMetadata(req.body);
        logger.error('Ollama analysis error', {
            error: error.message,
            stack: error.stack,
            request: bodyMetadata,
            errorType: error.constructor.name
        });

        return res.status(500).json({
            error: 'Analysis failed',
            details: 'Internal Server Error',
            analysis: `**Erro na Análise AI**\n\nNão foi possível processar a análise. Ocorreu um erro interno durante a comunicação com o serviço remoto.`
        });
    }
});

export default router;
