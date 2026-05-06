/**
 * Circuit Breaker for external API calls (TOPODATA, IBGE, INDE, OSM).
 *
 * States:
 *   CLOSED   – normal operation; failures are counted
 *   OPEN     – circuit is tripped; calls are rejected immediately
 *   HALF_OPEN – a single probe call is allowed to test recovery
 */
import { logger } from './logger.js';

export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
    name: string;
    /** Number of consecutive failures before opening. Default: 5 */
    failureThreshold?: number;
    /** Number of consecutive successes in HALF_OPEN before closing. Default: 2 */
    successThreshold?: number;
    /** Milliseconds the circuit stays OPEN before moving to HALF_OPEN. Default: 30000 */
    timeout?: number;
    onStateChange?: (name: string, from: CircuitBreakerState, to: CircuitBreakerState) => void;
}

export interface CircuitBreakerStats {
    failures: number;
    successes: number;
    totalCalls: number;
    state: CircuitBreakerState;
}

export interface NamedCircuitBreakerStats {
    name: string;
    failures: number;
    successes: number;
    totalCalls: number;
    state: CircuitBreakerState;
}

export class CircuitBreaker {
    private readonly name: string;
    private readonly failureThreshold: number;
    private readonly successThreshold: number;
    private readonly timeout: number;
    private readonly onStateChange?: (name: string, from: CircuitBreakerState, to: CircuitBreakerState) => void;

    private state: CircuitBreakerState = 'CLOSED';
    private failures = 0;
    private successes = 0;
    private totalCalls = 0;
    private openedAt = 0;

    constructor(options: CircuitBreakerOptions) {
        this.name = options.name;
        this.failureThreshold = options.failureThreshold ?? 5;
        this.successThreshold = options.successThreshold ?? 2;
        this.timeout = options.timeout ?? 30_000;
        this.onStateChange = options.onStateChange;
    }

    async execute<T>(fn: () => Promise<T>, fallback?: () => T | Promise<T>): Promise<T> {
        this.totalCalls++;

        if (this.state === 'OPEN') {
            if (Date.now() - this.openedAt >= this.timeout) {
                this.transition('HALF_OPEN');
            } else {
                if (fallback) return fallback();
                throw new Error(`CircuitBreaker [${this.name}] is OPEN`);
            }
        }

        try {
            const result = await fn();
            this.onSuccess();
            return result;
        } catch (err) {
            this.onFailure();
            if (fallback) return fallback();
            throw err;
        }
    }

    getState(): CircuitBreakerState {
        return this.state;
    }

    getStats(): CircuitBreakerStats {
        return {
            failures: this.failures,
            successes: this.successes,
            totalCalls: this.totalCalls,
            state: this.state,
        };
    }

    reset(): void {
        this.state = 'CLOSED';
        this.failures = 0;
        this.successes = 0;
        this.totalCalls = 0;
        this.openedAt = 0;
    }

    private onSuccess(): void {
        this.failures = 0;
        if (this.state === 'HALF_OPEN') {
            this.successes++;
            if (this.successes >= this.successThreshold) {
                this.successes = 0;
                this.transition('CLOSED');
            }
        }
    }

    private onFailure(): void {
        this.successes = 0;
        this.failures++;
        if (
            this.state === 'CLOSED' && this.failures >= this.failureThreshold ||
            this.state === 'HALF_OPEN'
        ) {
            this.openedAt = Date.now();
            this.transition('OPEN');
        }
    }

    private transition(to: CircuitBreakerState): void {
        const from = this.state;
        this.state = to;
        logger.warn(`CircuitBreaker [${this.name}] ${from} → ${to}`);
        this.onStateChange?.(this.name, from, to);
    }
}

// ── Registry / factory ────────────────────────────────────────────────────────

const registry = new Map<string, CircuitBreaker>();

/**
 * Returns an existing circuit breaker by name, or creates a new one with the
 * supplied options.  Options are only applied on creation.
 */
export function getCircuitBreaker(name: string, options?: Omit<CircuitBreakerOptions, 'name'>): CircuitBreaker {
    if (!registry.has(name)) {
        registry.set(name, new CircuitBreaker({ name, ...options }));
    }
    return registry.get(name)!;
}

/** Returns an operational snapshot for all registered breakers. */
export function listCircuitBreakers(): NamedCircuitBreakerStats[] {
    return Array.from(registry.entries())
        .map(([name, breaker]) => ({
            name,
            ...breaker.getStats(),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
}

/** Clear the registry (useful for testing). */
export function clearCircuitBreakerRegistry(): void {
    registry.clear();
}
