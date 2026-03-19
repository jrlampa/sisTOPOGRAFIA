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

export class AnalysisService {
    /**
     * Analyzes urban stats using AI (Groq LLaMA)
     * Provides intelligent insights for urban planning and CAD engineering
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

            const completion = await groq.chat.completions.create({
                messages: [{ role: "user", content: prompt }],
                model: "llama-3.3-70b-versatile",
                temperature: 0.2
            });

            const text = completion.choices[0]?.message?.content || "";
            const jsonMatch = text.match(/\{[\s\S]*\}/);

            if (jsonMatch) {
                logger.info('Groq AI analysis completed successfully');
                return JSON.parse(jsonMatch[0]);
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
