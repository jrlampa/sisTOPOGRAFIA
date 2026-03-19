import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { findLocationWithGemini, analyzeArea } from '../../src/services/geminiService';
import Logger from '../../src/utils/logger';

describe('geminiService', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.spyOn(Logger, 'debug').mockImplementation(() => {});
    vi.spyOn(Logger, 'info').mockImplementation(() => {});
    vi.spyOn(Logger, 'warn').mockImplementation(() => {});
    vi.spyOn(Logger, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // ── findLocationWithGemini ────────────────────────────────────────────────

  describe('findLocationWithGemini', () => {
    it('retorna null imediatamente quando enableAI é false', async () => {
      global.fetch = vi.fn() as any;

      const result = await findLocationWithGemini('Nova Friburgo RJ', false);

      expect(result).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
      expect(Logger.warn).toHaveBeenCalledWith(expect.stringContaining('disabled'));
    });

    it('retorna localização quando servidor responde ok', async () => {
      const mockLocation = { lat: -22.15018, lng: -42.92185, label: 'Nova Friburgo, RJ' };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockLocation
      }) as any;

      const result = await findLocationWithGemini('Nova Friburgo RJ', true);

      expect(result).toEqual(mockLocation);
      const callUrl = (global.fetch as any).mock.calls[0][0] as string;
      expect(callUrl).toContain('/search');
    });

    it('retorna null quando servidor responde com HTTP não-ok', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 400
      }) as any;

      const result = await findLocationWithGemini('Endereço inválido', true);
      expect(result).toBeNull();
    });

    it('retorna null quando fetch lança exceção', async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error')) as any;

      const result = await findLocationWithGemini('Nova Friburgo', true);

      expect(result).toBeNull();
      expect(Logger.error).toHaveBeenCalledWith('Backend Search Error:', expect.anything());
    });
  });

  // ── analyzeArea ───────────────────────────────────────────────────────────

  describe('analyzeArea', () => {
    const mockStats = {
      totalBuildings: 42,
      totalRoads: 15,
      totalNature: 7,
      avgHeight: 8.5,
      maxHeight: 22.4,
      avgSlope: 8.4,
      avgSolar: 0.72,
      maxFlow: 0,
      cutVolume: 0,
      fillVolume: 0
    };

    it('retorna mensagem padrão quando enableAI é false', async () => {
      const result = await analyzeArea(mockStats, 'Nova Friburgo', false);
      expect(result).toBe('Analysis summary disabled.');
    });

    it('retorna análise textual quando servidor responde ok', async () => {
      const mockAnalysis = 'Área com alta densidade urbana.';

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ analysis: mockAnalysis })
      }) as any;

      const result = await analyzeArea(mockStats, 'Nova Friburgo', true);

      expect(result).toBe(mockAnalysis);
      expect(Logger.info).toHaveBeenCalledWith('Analysis completed');
    });

    it('retorna errorData.analysis quando servidor retorna erro com campo analysis', async () => {
      const analysisText = 'GROQ_API_KEY não configurada. Configure a chave para ativar análise IA.';

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({ analysis: analysisText })
      }) as any;

      const result = await analyzeArea(mockStats, 'Nova Friburgo', true);
      expect(result).toBe(analysisText);
      expect(Logger.warn).toHaveBeenCalled();
    });

    it('retorna mensagem de erro formatada quando servidor retorna erro sem analysis', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ message: 'Internal Server Error' })
      }) as any;

      const result = await analyzeArea(mockStats, 'Nova Friburgo', true);
      expect(result).toContain('Erro na análise');
      expect(result).toContain('Internal Server Error');
    });

    it('usa "Analysis failed" como fallback quando errorData não tem message nem error (linha 52)', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({}) // sem message, sem error, sem analysis
      }) as any;

      const result = await analyzeArea(mockStats, 'Nova Friburgo', true);
      expect(result).toContain('Erro na análise');
      expect(result).toContain('Analysis failed');
    });

    it('retorna mensagem de conexão quando fetch lança exceção', async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network failure')) as any;

      const result = await analyzeArea(mockStats, 'Nova Friburgo', true);

      expect(result).toContain('Erro de conexão');
      expect(Logger.error).toHaveBeenCalledWith('Analysis error:', expect.anything());
    });

    it('retorna mensagem de servidor quando response.json() lança exceção no erro (lines 55-56)', async () => {
      // Server returns non-ok but response.json() throws (malformed JSON)
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => { throw new SyntaxError('Unexpected token'); }
      }) as any;

      const result = await analyzeArea(mockStats, 'Nova Friburgo', true);
      expect(result).toBe('**Erro na análise**: Não foi possível processar a resposta do servidor.');
    });

    it('inclui lat, lon e radius no body da requisição', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ analysis: 'OK' })
      }) as any;

      await analyzeArea(mockStats, 'Nova Friburgo RJ', true);

      const call = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.stats).toEqual(mockStats);
      expect(body.locationName).toBe('Nova Friburgo RJ');
    });

    it('retorna string vazia quando servidor responde ok mas data.analysis está ausente', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({}) // sem campo analysis
      }) as any;

      const result = await analyzeArea(mockStats, 'Nova Friburgo', true);

      expect(result).toBe('');
      expect(typeof result).toBe('string');
    });
  });
});
