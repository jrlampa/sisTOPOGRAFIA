import { fetchWithRetry } from '../utils/externalApi';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('externalApi: fetchWithRetry', () => {
    beforeEach(() => {
        mockFetch.mockReset();
    });

    it('should return successfully on the first attempt', async () => {
        mockFetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ data: 'success' })
        });

        const result = await fetchWithRetry('https://api.test.com');
        const data = await result.json();

        expect(data.data).toBe('success');
        expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should NOT retry on non-retryable 404 error — throws immediately', async () => {
        mockFetch.mockResolvedValue({
            ok: false,
            status: 404,
            statusText: 'Not Found'
        });

        await expect(
            fetchWithRetry('https://api.test.com', undefined, {
                maxRetries: 3,
                initialDelay: 1,
                maxDelay: 5
            })
        ).rejects.toThrow('HTTP error! status: 404');

        // Confirmed: only 1 call, no retries
        expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should retry on 500 up to maxRetries and then throw', async () => {
        mockFetch.mockResolvedValue({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error'
        });

        await expect(
            fetchWithRetry('https://api.test.com', undefined, {
                maxRetries: 2,
                initialDelay: 1,
                maxDelay: 5
            })
        ).rejects.toThrow(/API Request failed with status 500/);

        // Initial call + 2 retries = 3 total
        expect(mockFetch).toHaveBeenCalledTimes(3);
    }, 10000);

    it('should retry on 429 and eventually succeed', async () => {
        mockFetch
            .mockResolvedValueOnce({ ok: false, status: 429, statusText: 'Too Many Requests' })
            .mockResolvedValueOnce({ ok: false, status: 429, statusText: 'Too Many Requests' })
            .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: 'recovered' }) });

        const result = await fetchWithRetry('https://api.test.com', undefined, {
            maxRetries: 3,
            initialDelay: 1,
            maxDelay: 5
        });
        const data = await result.json();

        expect(data.data).toBe('recovered');
        expect(mockFetch).toHaveBeenCalledTimes(3);
    }, 10000);

    it('should retry on network error (fetch throws) and succeed', async () => {
        mockFetch
            .mockRejectedValueOnce(new Error('ECONNRESET'))
            .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true }) });

        const result = await fetchWithRetry('https://api.test.com', undefined, {
            maxRetries: 2,
            initialDelay: 1,
            maxDelay: 5
        });

        expect(mockFetch).toHaveBeenCalledTimes(2);
    }, 10000);
});
