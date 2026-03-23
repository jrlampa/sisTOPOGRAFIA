import Groq from 'groq-sdk';
import { logger } from '../utils/logger.js';

type AnalysisStats = {
    buildings?: number;
    roads?: number;
    trees?: number;
    water?: number;
    landuse?: number;
    railways?: number;
    totalElements?: number;
    area?: number;
} & Record<string, unknown>;

/** Maximum number of Groq API call attempts before giving up. */
const MAX_RETRY_ATTEMPTS = parseInt(process.env.GROQ_MAX_RETRIES || '3', 10);
/** Base delay (ms) for exponential backoff — doubles on each retry. */
const RETRY_BASE_DELAY_MS = parseInt(process.env.GROQ_RETRY_BASE_DELAY_MS || '500', 10);

/**
 * Determines whether a Groq API error is transient (worth retrying).
 * Retries on rate-limit (429), server errors (5xx), and network issues.
 */
function isRetryableError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    const msg = error.message;
    return (
        msg.includes('429') ||
        msg.includes('rate limit') ||
        msg.includes('503') ||
        msg.includes('500') ||
        msg.includes('ECONNREFUSED') ||
        msg.includes('ETIMEDOUT') ||
        msg.includes('ENOTFOUND')
    );
}

/**
 * Calls an async function with exponential backoff retry on transient errors.
 * Exported for testability.
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    maxAttempts: number = MAX_RETRY_ATTEMPTS,
    baseDelayMs: number = RETRY_BASE_DELAY_MS
): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error: unknown) {
            lastError = error;
            if (!isRetryableError(error) || attempt === maxAttempts) {
                throw error;
            }
            const delay = baseDelayMs * Math.pow(2, attempt - 1);
            logger.warn('Groq API call failed, retrying with backoff', {
                attempt,
                maxAttempts,
                delayMs: delay,
                // Cast is safe: isRetryableError() returns true only when error instanceof Error
                error: (error as Error).message
            });
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    /* istanbul ignore next */
    throw lastError;
}

export class AnalysisService {
    /**
     * Analyzes urban stats using AI (Groq LLaMA)
     * Provides intelligent insights for urban planning and CAD engineering.
     * Retries up to MAX_RETRY_ATTEMPTS on transient failures (rate limits, 5xx).
     */
    static async analyzeArea(stats: AnalysisStats, locationName: string, apiKey: string) {
        if (!apiKey) {
            logger.error('GROQ_API_KEY is missing');
            throw new Error('GROQ_API_KEY is missing');
        }

        try {
            const groq = new Groq({ apiKey });
            const hasData = (stats.buildings ?? 0) > 0 || (stats.roads ?? 0) > 0 || (stats.trees ?? 0) > 0;

            const prompt = hasData ?
                `Analise urbana profissional em Português BR para ${locationName}: ${JSON.stringify(stats)}. Sugira melhorias focadas em mobilidade, infraestrutura e áreas verdes. Formate como Markdown profissional. Responda APENAS JSON: { "analysis": "markdown" }` :
                `Explique em Português BR a falta de dados estruturais em ${locationName} e como o OSM pode ser complementado. JSON: { "analysis": "markdown" }`;

            logger.info('Requesting Groq AI analysis', {
                locationName,
                hasData,
                model: 'llama-3.3-70b-versatile'
            });

            const completion = await withRetry(() =>
                groq.chat.completions.create({
                    messages: [{ role: "user", content: prompt }],
                    model: "llama-3.3-70b-versatile",
                    temperature: 0.2
                })
            );

            const text = completion.choices[0]?.message?.content || "";
            const jsonMatch = text.match(/\{[\s\S]*\}/);

            if (jsonMatch) {
                logger.info('Groq AI analysis completed successfully');
                return JSON.parse(jsonMatch[0]) as Record<string, unknown>;
            } else {
                logger.warn('Groq AI response format invalid', { response: text });
                return { analysis: "Erro ao processar análise AI. Formato inválido." };
            }

        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            const stack = error instanceof Error ? error.stack : undefined;
            logger.error('Groq AI analysis failed', {
                error: msg,
                locationName,
                stack
            });

            // Return a helpful error message instead of crashing
            return {
                analysis: `**Erro na análise AI**: ${msg}\n\nNão foi possível gerar a análise para ${locationName}. Por favor, tente novamente.`
            };
        }
    }
}
