const mockCreate = jest.fn();

jest.mock('groq-sdk', () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
        chat: { completions: { create: mockCreate } }
    }))
}));

import { withRetry, AnalysisService } from '../services/analysisService';

describe('withRetry', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useRealTimers();
    });

    it('returns result on first successful call', async () => {
        const fn = jest.fn().mockResolvedValueOnce('success');
        const result = await withRetry(fn, 3, 10);
        expect(result).toBe('success');
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('retries on 429 rate limit error and succeeds on second attempt', async () => {
        jest.useFakeTimers();
        const fn = jest.fn()
            .mockRejectedValueOnce(new Error('429 rate limit'))
            .mockResolvedValueOnce('ok');
        const promise = withRetry(fn, 2, 100);
        await jest.advanceTimersByTimeAsync(100);
        const result = await promise;
        jest.useRealTimers();
        expect(result).toBe('ok');
        expect(fn).toHaveBeenCalledTimes(2);
    });

    it('retries on 503 error', async () => {
        jest.useFakeTimers();
        const fn = jest.fn()
            .mockRejectedValueOnce(new Error('503 service unavailable'))
            .mockResolvedValueOnce('ok');
        const promise = withRetry(fn, 2, 50);
        await jest.advanceTimersByTimeAsync(50);
        const result = await promise;
        jest.useRealTimers();
        expect(result).toBe('ok');
        expect(fn).toHaveBeenCalledTimes(2);
    });

    it('retries on 500 error', async () => {
        jest.useFakeTimers();
        const fn = jest.fn()
            .mockRejectedValueOnce(new Error('500 internal server error'))
            .mockResolvedValueOnce('ok');
        const promise = withRetry(fn, 2, 50);
        await jest.advanceTimersByTimeAsync(50);
        const result = await promise;
        jest.useRealTimers();
        expect(result).toBe('ok');
        expect(fn).toHaveBeenCalledTimes(2);
    });

    it('retries on ECONNREFUSED', async () => {
        jest.useFakeTimers();
        const fn = jest.fn()
            .mockRejectedValueOnce(new Error('ECONNREFUSED'))
            .mockResolvedValueOnce('ok');
        const promise = withRetry(fn, 2, 50);
        await jest.advanceTimersByTimeAsync(50);
        const result = await promise;
        jest.useRealTimers();
        expect(result).toBe('ok');
        expect(fn).toHaveBeenCalledTimes(2);
    });

    it('retries on ETIMEDOUT', async () => {
        jest.useFakeTimers();
        const fn = jest.fn()
            .mockRejectedValueOnce(new Error('ETIMEDOUT'))
            .mockResolvedValueOnce('ok');
        const promise = withRetry(fn, 2, 50);
        await jest.advanceTimersByTimeAsync(50);
        const result = await promise;
        jest.useRealTimers();
        expect(result).toBe('ok');
        expect(fn).toHaveBeenCalledTimes(2);
    });

    it('retries on ENOTFOUND', async () => {
        jest.useFakeTimers();
        const fn = jest.fn()
            .mockRejectedValueOnce(new Error('ENOTFOUND api.groq.com'))
            .mockResolvedValueOnce('ok');
        const promise = withRetry(fn, 2, 50);
        await jest.advanceTimersByTimeAsync(50);
        const result = await promise;
        jest.useRealTimers();
        expect(result).toBe('ok');
        expect(fn).toHaveBeenCalledTimes(2);
    });

    it('throws immediately on non-retryable error (400)', async () => {
        const fn = jest.fn().mockRejectedValueOnce(new Error('400 bad request'));
        await expect(withRetry(fn, 3, 10)).rejects.toThrow('400 bad request');
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('throws immediately when non-Error value is thrown', async () => {
        const fn = jest.fn().mockRejectedValueOnce('string error');
        await expect(withRetry(fn, 3, 10)).rejects.toBe('string error');
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('throws last error after maxAttempts exhausted', async () => {
        jest.useFakeTimers();
        const err = new Error('503 unavailable');
        const fn = jest.fn().mockRejectedValue(err);
        const promise = withRetry(fn, 3, 50);
        // Set up rejection handler BEFORE advancing timers to avoid unhandled rejection
        const expectation = expect(promise).rejects.toThrow('503 unavailable');
        // advance through 2 retries: 50ms (attempt1->2) + 100ms (attempt2->3)
        await jest.advanceTimersByTimeAsync(50);
        await jest.advanceTimersByTimeAsync(100);
        await expectation;
        jest.useRealTimers();
        expect(fn).toHaveBeenCalledTimes(3);
    });
});

describe('AnalysisService.analyzeArea', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    const stats = { buildings: 10, roads: 5, trees: 3 };
    const emptyStats = { buildings: 0, roads: 0, trees: 0 };

    it('throws when apiKey is empty', async () => {
        await expect(AnalysisService.analyzeArea(stats, 'Test', '')).rejects.toThrow('GROQ_API_KEY is missing');
    });

    it('returns parsed JSON analysis on success', async () => {
        const responseText = '{"analysis":"## Urban Analysis\\n\\nTest analysis"}';
        mockCreate.mockResolvedValueOnce({
            choices: [{ message: { content: responseText } }]
        });
        const result = await AnalysisService.analyzeArea(stats, 'São Paulo', 'test-api-key');
        expect(result).toEqual({ analysis: '## Urban Analysis\n\nTest analysis' });
    });

    it('falls back gracefully when groq returns invalid JSON (no {} match)', async () => {
        mockCreate.mockResolvedValueOnce({
            choices: [{ message: { content: 'No JSON here at all' } }]
        });
        const result = await AnalysisService.analyzeArea(stats, 'Test', 'test-api-key');
        expect(result).toEqual({ analysis: 'Erro ao processar análise AI. Formato inválido.' });
    });

    it('returns error analysis when groq throws', async () => {
        mockCreate.mockRejectedValueOnce(new Error('Network failure'));
        const result = await AnalysisService.analyzeArea(stats, 'TestCity', 'test-api-key');
        expect((result as Record<string, unknown>).analysis).toContain('Erro na análise AI');
        expect((result as Record<string, unknown>).analysis).toContain('TestCity');
    });

    it('uses hasData=true prompt when stats have data', async () => {
        mockCreate.mockResolvedValueOnce({
            choices: [{ message: { content: '{"analysis":"with data"}' } }]
        });
        const result = await AnalysisService.analyzeArea(stats, 'City', 'test-api-key');
        expect(result).toEqual({ analysis: 'with data' });
        const callArgs = mockCreate.mock.calls[0][0];
        expect(callArgs.messages[0].content).toContain('Analise urbana profissional');
    });

    it('uses hasData=false prompt when stats are empty', async () => {
        mockCreate.mockResolvedValueOnce({
            choices: [{ message: { content: '{"analysis":"no data"}' } }]
        });
        const result = await AnalysisService.analyzeArea(emptyStats, 'EmptyCity', 'test-api-key');
        expect(result).toEqual({ analysis: 'no data' });
        const callArgs = mockCreate.mock.calls[0][0];
        expect(callArgs.messages[0].content).toContain('falta de dados');
    });

    it('handles empty choices gracefully', async () => {
        mockCreate.mockResolvedValueOnce({ choices: [] });
        const result = await AnalysisService.analyzeArea(stats, 'Test', 'test-api-key');
        expect((result as Record<string, unknown>).analysis).toBe('Erro ao processar análise AI. Formato inválido.');
    });
});
