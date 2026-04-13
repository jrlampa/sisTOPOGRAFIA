import { logger } from './logger.js';

interface RetryOptions {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    factor?: number;
    retryableStatuses?: number[];
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

            if (!retryableStatuses.includes(response.status)) {
                return response;
            }

            // Retryable error status
            const errorMsg = `API Request failed with status ${response.status} (Attempt ${attempt + 1}/${maxRetries + 1})`;
            logger.warn(errorMsg, { url, attempt });
            lastError = new Error(errorMsg);

        } catch (error) {
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
