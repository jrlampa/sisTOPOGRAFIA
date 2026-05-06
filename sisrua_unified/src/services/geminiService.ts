import { GeoLocation } from '../types';
import Logger from '../utils/logger';
import { API_BASE_URL } from '../config/api';
import { buildApiHeaders } from './apiClient';

const API_URL = API_BASE_URL;

type ParsedApiResponse = {
  data: unknown | null;
  rawText: string;
  status: number;
};

const parseApiResponse = async (response: Response): Promise<ParsedApiResponse> => {
  const rawText = await response.text();
  const contentType = (response.headers.get('content-type') || '').toLowerCase();

  if (!rawText || rawText.trim().length === 0) {
    return { data: null, rawText, status: response.status };
  }

  if (!contentType.includes('application/json')) {
    return { data: null, rawText, status: response.status };
  }

  try {
    return { data: JSON.parse(rawText), rawText, status: response.status };
  } catch {
    return { data: null, rawText, status: response.status };
  }
};

const ollamaHelpText = () => {
  return "**Erro na análise**: Serviço de análise indisponível no momento.\n\nUse o Ollama local:\n1. Verifique se está instalado: `ollama --version`\n2. Inicie o serviço: `ollama serve`\n3. Baixe o modelo: `ollama pull llama3.2`\n4. Reinicie o backend.";
};

export const findLocationWithGemini = async (query: string, enableAI: boolean): Promise<GeoLocation | null> => {
  if (!enableAI) {
    Logger.warn("Analysis is disabled. Cannot perform fuzzy search.");
    return null;
    // In a full implementation, we would fallback to a standard Nominatim fetch here.
  }

  try {
    Logger.debug(`Searching for location: ${query}`);
    const response = await fetch(`${API_URL}/search`, {
      method: 'POST',
      headers: buildApiHeaders(),
      body: JSON.stringify({ query })
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    Logger.error("Backend Search Error:", error);
    return null;
  }
};

export const analyzeArea = async (stats: any, locationName: string, enableAI: boolean): Promise<string> => {
  if (!enableAI) return "Analysis summary disabled.";

  try {
    Logger.debug(`Analyzing area: ${locationName}`);
    const response = await fetch(`${API_URL}/analyze`, {
      method: 'POST',
      headers: buildApiHeaders(),
      body: JSON.stringify({ stats, locationName })
    });

    const parsed = await parseApiResponse(response);
    
    // Handle error responses
    if (!response.ok) {
      Logger.warn("Analysis request failed", { status: response.status, body: parsed.data || parsed.rawText });

      if (parsed.data && typeof parsed.data === 'object') {
        const errorData = parsed.data as Record<string, unknown>;
        if (typeof errorData.analysis === 'string' && errorData.analysis.trim().length > 0) {
          return errorData.analysis;
        }

        const errorMsg =
          (typeof errorData.message === 'string' && errorData.message) ||
          (typeof errorData.error === 'string' && errorData.error) ||
          'Analysis failed';
        return `**Erro na análise**: ${errorMsg}`;
      }

      if (response.status === 503 || response.status === 500) {
        return ollamaHelpText();
      }

      return `**Erro na análise**: Resposta inválida do servidor (HTTP ${response.status}).`;
    }

    if (parsed.data && typeof parsed.data === 'object') {
      const data = parsed.data as Record<string, unknown>;
      if (typeof data.analysis === 'string' && data.analysis.trim().length > 0) {
        Logger.info("Analysis completed");
        return data.analysis;
      }
    }

    if (parsed.rawText.trim().length > 0) {
      Logger.info("Analysis completed with plain text response");
      return parsed.rawText;
    }

    Logger.info("Analysis completed");
    return "**Erro na análise**: O servidor não retornou conteúdo de análise.";
  } catch (error) {
    Logger.error("Analysis error:", error);
    return "**Erro de conexão**: Não foi possível contatar o servidor de análise. Verifique se o backend está em execução na porta 3001 e com Ollama ativo.";
  }
};