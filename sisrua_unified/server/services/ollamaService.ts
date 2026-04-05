import { logger } from '../utils/logger.js';

const OLLAMA_BASE_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';

export class OllamaService {
    /**
     * Analyzes urban stats using Ollama (local LLM)
     * Provides intelligent insights for urban planning and CAD engineering
     */
    static async analyzeArea(stats: any, locationName: string) {
        try {
            const hasData = stats.buildings > 0 || stats.roads > 0 || stats.trees > 0;

            const prompt = hasData ?
                `Você é um especialista em urbanismo. Dados da área "${locationName}": ${JSON.stringify(stats)}. Responda SOMENTE com JSON válido no formato: {"analysis":"..."}. O valor de analysis deve ser um resumo CURTO em Português BR com no máximo 5 linhas: destaque os principais números (edificações, vias, vegetação), aponte 1 risco crítico e 1 ação prioritária. Sem introduções, sem listas longas.` :
                `Área "${locationName}" sem dados OSM disponíveis. Responda APENAS JSON: {"analysis":"Área sem dados no OpenStreetMap. Verifique o endereço ou amplie o raio de busca."}`;

            logger.info('Requesting Ollama AI analysis', { 
                locationName, 
                hasData,
                model: OLLAMA_MODEL,
                url: OLLAMA_BASE_URL
            });

            const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: OLLAMA_MODEL,
                    prompt: prompt,
                    stream: false,
                    options: {
                        temperature: 0.2
                    }
                }),
                signal: AbortSignal.timeout(60000) // 60s timeout
            });

            if (!response.ok) {
                throw new Error(`Ollama returned ${response.status}`);
            }

            const data = await response.json();
            const text = data.response || "";
            
            // Try to extract JSON from response
            const jsonMatch = text.match(/\{[\s\S]*\}/);

            if (jsonMatch) {
                logger.info('Ollama AI analysis completed successfully');
                return JSON.parse(jsonMatch[0]);
            } else {
                // Return the raw text as analysis if no JSON found
                logger.info('Ollama returned non-JSON response, using raw text');
                return { analysis: text };
            }

        } catch (error: any) {
            logger.error('Ollama AI analysis failed', {
                error: error.message,
                locationName,
                stack: error.stack
            });
            
            // Return a helpful error message
            return { 
                analysis: `**Análise AI Indisponível**\n\nO serviço Ollama não está disponível. Verifique se:\n1. O Ollama está instalado: https://ollama.com\n2. O serviço está rodando: \`ollama serve\`\n3. O modelo ${OLLAMA_MODEL} está disponível: \`ollama pull ${OLLAMA_MODEL}\`\n\nErro: ${error.message}`
            };
        }
    }

    /**
     * Check if Ollama is available
     */
    static async isAvailable(): Promise<boolean> {
        try {
            const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
                method: 'GET',
                signal: AbortSignal.timeout(5000)
            });
            return response.ok;
        } catch {
            return false;
        }
    }

    /**
     * Get available models
     */
    static async getModels(): Promise<string[]> {
        try {
            const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
                method: 'GET',
                signal: AbortSignal.timeout(5000)
            });
            
            if (!response.ok) {
                return [];
            }

            const data = await response.json();
            return data.models?.map((m: any) => m.name) || [];
        } catch {
            return [];
        }
    }
}
