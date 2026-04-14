import { logger } from './logger.js';

interface RetryOptions {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    factor?: number;
    retryableStatuses?: number[];
}

/**
 * Sentinel error class for non-retryable HTTP errors.
 * Using a distinct class ensures the outer catch does NOT swallow it.
 */
class NonRetryableError extends Error {
    public readonly status: number;
    constructor(status: number) {
        super(`HTTP error! status: ${status}`);
        this.name = 'NonRetryableError';
        this.status = status;
    }
}

/**
 * Utilitário de fetch resiliente com Exponential Backoff
 */
export async function fetchWithRetry(
    url: string | URL,
    init?: RequestInit,
    options: RetryOptions = {}
): Promise<Response> {
    const {
        maxRetries = 3,
        initialDelay = 500,
        maxDelay = 5000,
        factor = 2,
        retryableStatuses = [408, 429, 500, 502, 503, 504]
    } = options;

    let lastError: Error | null = null;
    let delay = initialDelay;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(url, init);

            if (response.ok) {
                return response;
            }

            // Non-retryable status: throw immediately and escape the loop
            if (!retryableStatuses.includes(response.status)) {
                throw new NonRetryableError(response.status);
            }

            // Retryable error status — record and continue
            const errorMsg = `API Request failed with status ${response.status} (Attempt ${attempt + 1}/${maxRetries + 1})`;
            logger.warn(errorMsg, { url, attempt });
            lastError = new Error(errorMsg);

        } catch (error) {
            // Re-throw non-retryable errors immediately without delay
            if (error instanceof NonRetryableError) {
                throw error;
            }

            const errorMsg = `API Request network error: ${error instanceof Error ? error.message : 'Unknown error'} (Attempt ${attempt + 1}/${maxRetries + 1})`;
            logger.error(errorMsg, { url, attempt });
            lastError = error instanceof Error ? error : new Error(errorMsg);
        }

        if (attempt < maxRetries) {
            logger.info(`Retrying in ${delay}ms...`, { url, nextAttempt: attempt + 2 });
            await new Promise(resolve => setTimeout(resolve, delay));
            delay = Math.min(delay * factor, maxDelay);
        }
    }

    throw lastError || new Error('All retries failed');
}
