/**
 * circuitBreaker.test.ts
 * Tests for CircuitBreaker utility – state transitions, fallback, recovery.
 */

import {
    CircuitBreaker,
    getCircuitBreaker,
    listCircuitBreakers,
    clearCircuitBreakerRegistry,
} from '../utils/circuitBreaker';

jest.mock('../utils/logger', () => ({
    logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

const ok = () => Promise.resolve('ok');
const fail = () => Promise.reject(new Error('upstream error'));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeCb(opts?: { failureThreshold?: number; successThreshold?: number; timeout?: number }) {
    return new CircuitBreaker({
        name: 'test',
        failureThreshold: opts?.failureThreshold ?? 3,
        successThreshold: opts?.successThreshold ?? 2,
        timeout: opts?.timeout ?? 100,
    });
}

// ── Initial state ─────────────────────────────────────────────────────────────

describe('CircuitBreaker – initial state', () => {
    it('starts in CLOSED state', () => {
        const cb = makeCb();
        expect(cb.getState()).toBe('CLOSED');
    });

    it('getStats returns zeroes for a fresh instance', () => {
        const cb = makeCb();
        const stats = cb.getStats();
        expect(stats).toEqual({ failures: 0, successes: 0, totalCalls: 0, state: 'CLOSED' });
    });
});

// ── CLOSED → OPEN transition ──────────────────────────────────────────────────

describe('CircuitBreaker – CLOSED → OPEN', () => {
    it('opens after failureThreshold consecutive failures', async () => {
        const cb = makeCb({ failureThreshold: 3 });
        for (let i = 0; i < 3; i++) {
            await expect(cb.execute(fail)).rejects.toThrow('upstream error');
        }
        expect(cb.getState()).toBe('OPEN');
    });

    it('does NOT open before reaching the failure threshold', async () => {
        const cb = makeCb({ failureThreshold: 3 });
        for (let i = 0; i < 2; i++) {
            await expect(cb.execute(fail)).rejects.toThrow();
        }
        expect(cb.getState()).toBe('CLOSED');
    });

    it('resets failure counter on a successful call', async () => {
        const cb = makeCb({ failureThreshold: 3 });
        await expect(cb.execute(fail)).rejects.toThrow();
        await expect(cb.execute(fail)).rejects.toThrow();
        await cb.execute(ok); // resets failures
        await expect(cb.execute(fail)).rejects.toThrow();
        // only 1 failure after the reset — should still be CLOSED
        expect(cb.getState()).toBe('CLOSED');
    });

    it('invokes onStateChange callback on open', async () => {
        const onChange = jest.fn();
        const cb = new CircuitBreaker({ name: 'x', failureThreshold: 2, onStateChange: onChange });
        for (let i = 0; i < 2; i++) {
            await expect(cb.execute(fail)).rejects.toThrow();
        }
        expect(onChange).toHaveBeenCalledWith('x', 'CLOSED', 'OPEN');
    });
});

// ── OPEN state behaviour ──────────────────────────────────────────────────────

describe('CircuitBreaker – OPEN rejects immediately', () => {
    it('throws without calling fn when OPEN', async () => {
        const cb = makeCb({ failureThreshold: 2, timeout: 60_000 });
        for (let i = 0; i < 2; i++) {
            await expect(cb.execute(fail)).rejects.toThrow();
        }
        const spy = jest.fn(ok);
        await expect(cb.execute(spy)).rejects.toThrow(/OPEN/);
        expect(spy).not.toHaveBeenCalled();
    });

    it('uses fallback when OPEN instead of throwing', async () => {
        const cb = makeCb({ failureThreshold: 2, timeout: 60_000 });
        for (let i = 0; i < 2; i++) {
            await expect(cb.execute(fail)).rejects.toThrow();
        }
        const result = await cb.execute(ok, () => 'fallback-value');
        expect(result).toBe('fallback-value');
    });

    it('uses async fallback when OPEN', async () => {
        const cb = makeCb({ failureThreshold: 2, timeout: 60_000 });
        for (let i = 0; i < 2; i++) {
            await expect(cb.execute(fail)).rejects.toThrow();
        }
        const result = await cb.execute(ok, async () => 'async-fallback');
        expect(result).toBe('async-fallback');
    });
});

// ── OPEN → HALF_OPEN transition ───────────────────────────────────────────────

describe('CircuitBreaker – OPEN → HALF_OPEN after timeout', () => {
    it('moves to HALF_OPEN after the timeout elapses', async () => {
        const cb = makeCb({ failureThreshold: 2, timeout: 50 });
        for (let i = 0; i < 2; i++) {
            await expect(cb.execute(fail)).rejects.toThrow();
        }
        expect(cb.getState()).toBe('OPEN');
        await new Promise(r => setTimeout(r, 60));
        // trigger the transition by attempting a call
        await cb.execute(ok).catch(() => {});
        expect(cb.getState()).not.toBe('OPEN');
    });
});

// ── HALF_OPEN → CLOSED recovery ───────────────────────────────────────────────

describe('CircuitBreaker – HALF_OPEN → CLOSED recovery', () => {
    it('closes after successThreshold successes in HALF_OPEN', async () => {
        const cb = makeCb({ failureThreshold: 2, successThreshold: 2, timeout: 30 });
        for (let i = 0; i < 2; i++) {
            await expect(cb.execute(fail)).rejects.toThrow();
        }
        await new Promise(r => setTimeout(r, 40));
        // probe 1 – moves to HALF_OPEN, success
        await cb.execute(ok);
        // probe 2 – should close
        await cb.execute(ok);
        expect(cb.getState()).toBe('CLOSED');
    });

    it('re-opens immediately on failure in HALF_OPEN', async () => {
        const cb = makeCb({ failureThreshold: 2, successThreshold: 2, timeout: 30 });
        for (let i = 0; i < 2; i++) {
            await expect(cb.execute(fail)).rejects.toThrow();
        }
        await new Promise(r => setTimeout(r, 40));
        await expect(cb.execute(fail)).rejects.toThrow();
        expect(cb.getState()).toBe('OPEN');
    });

    it('invokes onStateChange callback on close', async () => {
        const onChange = jest.fn();
        const cb = new CircuitBreaker({
            name: 'y',
            failureThreshold: 2,
            successThreshold: 1,
            timeout: 30,
            onStateChange: onChange,
        });
        for (let i = 0; i < 2; i++) {
            await expect(cb.execute(fail)).rejects.toThrow();
        }
        await new Promise(r => setTimeout(r, 40));
        await cb.execute(ok);
        const calls = onChange.mock.calls.map(c => [c[1], c[2]]);
        expect(calls).toContainEqual(['CLOSED', 'OPEN']);
        expect(calls).toContainEqual(['OPEN', 'HALF_OPEN']);
        expect(calls).toContainEqual(['HALF_OPEN', 'CLOSED']);
    });
});

// ── reset() ───────────────────────────────────────────────────────────────────

describe('CircuitBreaker – reset()', () => {
    it('resets state and counters to initial values', async () => {
        const cb = makeCb({ failureThreshold: 2 });
        for (let i = 0; i < 2; i++) {
            await expect(cb.execute(fail)).rejects.toThrow();
        }
        cb.reset();
        expect(cb.getState()).toBe('CLOSED');
        expect(cb.getStats()).toEqual({ failures: 0, successes: 0, totalCalls: 0, state: 'CLOSED' });
    });
});

// ── Stats ─────────────────────────────────────────────────────────────────────

describe('CircuitBreaker – stats', () => {
    it('counts totalCalls correctly', async () => {
        const cb = makeCb({ failureThreshold: 10 });
        await cb.execute(ok);
        await expect(cb.execute(fail)).rejects.toThrow();
        await cb.execute(ok);
        expect(cb.getStats().totalCalls).toBe(3);
    });
});

// ── Fallback on upstream error ────────────────────────────────────────────────

describe('CircuitBreaker – fallback on upstream failure', () => {
    it('returns fallback value when fn throws (CLOSED state)', async () => {
        const cb = makeCb({ failureThreshold: 10 });
        const result = await cb.execute(fail, () => 'default');
        expect(result).toBe('default');
    });
});

// ── Registry ──────────────────────────────────────────────────────────────────

describe('getCircuitBreaker registry', () => {
    beforeEach(() => clearCircuitBreakerRegistry());

    it('returns the same instance for the same name', () => {
        const a = getCircuitBreaker('ibge');
        const b = getCircuitBreaker('ibge');
        expect(a).toBe(b);
    });

    it('returns different instances for different names', () => {
        const a = getCircuitBreaker('ibge');
        const b = getCircuitBreaker('osm');
        expect(a).not.toBe(b);
    });

    it('applies options only on first creation', async () => {
        const cb = getCircuitBreaker('topodata', { failureThreshold: 2 });
        for (let i = 0; i < 2; i++) {
            await expect(cb.execute(fail)).rejects.toThrow();
        }
        expect(cb.getState()).toBe('OPEN');
        // second call ignores new options
        const cb2 = getCircuitBreaker('topodata', { failureThreshold: 100 });
        expect(cb2.getState()).toBe('OPEN');
    });

    it('lists all registered breakers in deterministic order', () => {
        getCircuitBreaker('osm');
        getCircuitBreaker('ibge');

        const list = listCircuitBreakers();

        expect(list).toHaveLength(2);
        expect(list.map((item) => item.name)).toEqual(['ibge', 'osm']);
        expect(list[0]).toMatchObject({
            name: 'ibge',
            state: 'CLOSED',
            failures: 0,
            successes: 0,
            totalCalls: 0,
        });
    });
});
