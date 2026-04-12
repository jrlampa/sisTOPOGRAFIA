import { withRetry } from '../utils/withRetry';

describe('withRetry', () => {
    it('should return result on first successful attempt', async () => {
        const fn = jest.fn().mockResolvedValue('ok');
        const result = await withRetry(fn, { maxAttempts: 3 });
        expect(result).toBe('ok');
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry and succeed on second attempt', async () => {
        const fn = jest
            .fn()
            .mockRejectedValueOnce(new Error('transient'))
            .mockResolvedValueOnce('recovered');

        const result = await withRetry(fn, { maxAttempts: 3, baseDelayMs: 5, jitter: 0 });
        expect(result).toBe('recovered');
        expect(fn).toHaveBeenCalledTimes(2);
    }, 10000);

    it('should throw after exhausting all attempts', async () => {
        const error = new Error('always fails');
        const fn = jest.fn().mockRejectedValue(error);

        await expect(
            withRetry(fn, { maxAttempts: 3, baseDelayMs: 5, jitter: 0 })
        ).rejects.toThrow('always fails');
        expect(fn).toHaveBeenCalledTimes(3);
    }, 10000);

    it('should not retry when isRetryable returns false', async () => {
        const error = new Error('non-retryable');
        const fn = jest.fn().mockRejectedValue(error);

        await expect(
            withRetry(fn, {
                maxAttempts: 3,
                baseDelayMs: 5,
                jitter: 0,
                isRetryable: () => false,
            })
        ).rejects.toThrow('non-retryable');
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should apply exponential backoff (delays grow between attempts)', async () => {
        const delays: number[] = [];
        const originalSetTimeout = global.setTimeout;
        jest.spyOn(global, 'setTimeout').mockImplementation(((cb: () => void, ms: number) => {
            if (ms > 0) delays.push(ms);
            return originalSetTimeout(cb, 0);
        }) as typeof setTimeout);

        const fn = jest.fn().mockRejectedValue(new Error('fail'));
        await expect(
            withRetry(fn, { maxAttempts: 3, baseDelayMs: 100, jitter: 0 })
        ).rejects.toThrow();

        jest.restoreAllMocks();

        // First delay: 100ms, second delay: 200ms
        expect(delays.length).toBe(2);
        expect(delays[1]).toBeGreaterThan(delays[0]);
    }, 10000);

    it('should cap delay at maxDelayMs', async () => {
        const delays: number[] = [];
        const originalSetTimeout = global.setTimeout;
        jest.spyOn(global, 'setTimeout').mockImplementation(((cb: () => void, ms: number) => {
            if (ms > 0) delays.push(ms);
            return originalSetTimeout(cb, 0);
        }) as typeof setTimeout);

        const fn = jest.fn().mockRejectedValue(new Error('fail'));
        await expect(
            withRetry(fn, { maxAttempts: 4, baseDelayMs: 10000, maxDelayMs: 50, jitter: 0 })
        ).rejects.toThrow();

        jest.restoreAllMocks();

        delays.forEach((d) => expect(d).toBeLessThanOrEqual(50));
    }, 10000);
});
