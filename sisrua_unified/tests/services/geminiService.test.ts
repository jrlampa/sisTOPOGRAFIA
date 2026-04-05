import { afterEach, describe, expect, it, vi } from 'vitest';
import { analyzeArea } from '../../src/services/geminiService';

describe('geminiService analysis parsing', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns analysis text from JSON success response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ analysis: 'Analise OK' }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    );

    const result = await analyzeArea({ buildings: 1 }, 'Area Teste', true);
    expect(result).toBe('Analise OK');
  });

  it('returns ollama help text on 503 with invalid body', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('', {
        status: 503,
        headers: { 'content-type': 'text/plain' }
      })
    );

    const result = await analyzeArea({ buildings: 1 }, 'Area Teste', true);
    expect(result).toContain('Use o Ollama local');
    expect(result).toContain('ollama serve');
  });
});
