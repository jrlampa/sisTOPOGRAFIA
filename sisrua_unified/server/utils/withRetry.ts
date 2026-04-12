import { logger } from './logger.js';

export interface RetryOptions {
    /** Maximum number of attempts (including the first). Default: 3 */
    maxAttempts?: number;
    /** Base delay in milliseconds for exponential backoff. Default: 200 */
    baseDelayMs?: number;
    /** Maximum delay cap in milliseconds. Default: 10000 */
    maxDelayMs?: number;
    /** Jitter factor (0-1). Adds randomness to avoid thundering herd. Default: 0.2 */
    jitter?: number;
    /** Optional label for log messages */
    label?: string;
    /** Predicate to decide if an error is retryable. Default: always retry */
    isRetryable?: (err: unknown) => boolean;
}

/**
 * Executes an async function with exponential backoff retry.
 * On each failure the delay doubles: baseDelayMs * 2^attempt + jitter.
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
): Promise<T> {
    const {
        maxAttempts = 3,
        baseDelayMs = 200,
        maxDelayMs = 10_000,
        jitter = 0.2,
        label = 'withRetry',
        isRetryable = () => true,
    } = options;

    let lastError: unknown;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (err) {
            lastError = err;

            const isLast = attempt === maxAttempts - 1;
            if (isLast || !isRetryable(err)) {
                throw err;
            }

            const exponential = baseDelayMs * Math.pow(2, attempt);
            const jitterMs = exponential * jitter * Math.random();
            const delayMs = Math.min(exponential + jitterMs, maxDelayMs);

            logger.warn(`${label}: attempt ${attempt + 1}/${maxAttempts} failed — retrying in ${Math.round(delayMs)}ms`, {
                error: err instanceof Error ? err.message : String(err),
            });

            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
    }

    throw lastError;
}
