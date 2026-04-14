/**
 * metricsAnomalies.test.ts
 * Tests for anomaly detection and SLO compliance tracking in metricsService.
 */

import { metricsService } from '../services/metricsService';

jest.mock('../config', () => ({
    config: { METRICS_PREFIX: 'sisrua_test' },
}));

beforeEach(() => {
    metricsService._resetObservabilityState();
});

// ── recordMetricObservation / getMetricStats ──────────────────────────────────

describe('metricsService – rolling statistics', () => {
    it('returns null for an unknown metric', () => {
        expect(metricsService.getMetricStats('unknown')).toBeNull();
    });

    it('tracks count correctly', () => {
        for (let i = 0; i < 5; i++) metricsService.recordMetricObservation('lat', i);
        expect(metricsService.getMetricStats('lat')?.count).toBe(5);
    });

    it('computes correct mean for a simple sequence', () => {
        [2, 4, 6, 8, 10].forEach(v => metricsService.recordMetricObservation('m', v));
        const stats = metricsService.getMetricStats('m')!;
        expect(stats.mean).toBeCloseTo(6, 5);
    });

    it('computes correct stddev for a known dataset', () => {
        // dataset: [2,4,6,8,10] – population stddev ≈ 2.828, sample stddev ≈ 3.162
        [2, 4, 6, 8, 10].forEach(v => metricsService.recordMetricObservation('sd', v));
        const stats = metricsService.getMetricStats('sd')!;
        expect(stats.stddev).toBeCloseTo(3.162, 2);
    });

    it('handles a single observation without NaN', () => {
        metricsService.recordMetricObservation('single', 42);
        const stats = metricsService.getMetricStats('single')!;
        expect(stats.mean).toBe(42);
        expect(isNaN(stats.stddev)).toBe(false);
    });

    it('tracks multiple independent metrics separately', () => {
        [1, 2, 3].forEach(v => metricsService.recordMetricObservation('a', v));
        [10, 20, 30].forEach(v => metricsService.recordMetricObservation('b', v));
        expect(metricsService.getMetricStats('a')?.mean).toBeCloseTo(2, 5);
        expect(metricsService.getMetricStats('b')?.mean).toBeCloseTo(20, 5);
    });
});

// ── checkAnomalies ────────────────────────────────────────────────────────────

describe('metricsService – checkAnomalies', () => {
    it('returns empty array when no observations recorded', () => {
        expect(metricsService.checkAnomalies()).toEqual([]);
    });

    it('returns empty array when fewer than 10 observations', () => {
        for (let i = 0; i < 9; i++) metricsService.recordMetricObservation('few', i);
        expect(metricsService.checkAnomalies()).toEqual([]);
    });

    it('returns empty array for stable metric (no outlier)', () => {
        for (let i = 0; i < 20; i++) metricsService.recordMetricObservation('stable', 100 + i * 0.01);
        expect(metricsService.checkAnomalies()).toHaveLength(0);
    });

    it('detects an obvious outlier after sufficient observations', () => {
        // 15 normal observations around 100
        for (let i = 0; i < 15; i++) metricsService.recordMetricObservation('cpu', 100);
        // inject a huge spike
        metricsService.recordMetricObservation('cpu', 5000);
        const alerts = metricsService.checkAnomalies();
        expect(alerts.length).toBeGreaterThan(0);
        const alert = alerts.find(a => a.metric === 'cpu')!;
        expect(alert).toBeDefined();
        expect(alert.zScore).toBeGreaterThan(3);
    });

    it('alert contains required fields', () => {
        for (let i = 0; i < 15; i++) metricsService.recordMetricObservation('rps', 50);
        metricsService.recordMetricObservation('rps', 9999);
        const [alert] = metricsService.checkAnomalies();
        expect(alert).toMatchObject({
            metric: 'rps',
            currentValue: 9999,
        });
        expect(typeof alert.mean).toBe('number');
        expect(typeof alert.stddev).toBe('number');
        expect(typeof alert.zScore).toBe('number');
        expect(typeof alert.timestamp).toBe('string');
    });

    it('does not flag a metric where all values are identical (zero stddev)', () => {
        for (let i = 0; i < 15; i++) metricsService.recordMetricObservation('flat', 42);
        expect(metricsService.checkAnomalies()).toHaveLength(0);
    });

    it('negative outlier (very low value) is also flagged', () => {
        for (let i = 0; i < 15; i++) metricsService.recordMetricObservation('p99', 200);
        metricsService.recordMetricObservation('p99', -5000);
        const alerts = metricsService.checkAnomalies();
        const alert = alerts.find(a => a.metric === 'p99');
        expect(alert).toBeDefined();
        expect(alert!.zScore).toBeLessThan(-3);
    });
});

// ── SLO compliance ────────────────────────────────────────────────────────────

describe('metricsService – SLO compliance', () => {
    it('returns 1.0 (perfect) when no observations recorded', () => {
        expect(metricsService.getSloCompliance('availability')).toBe(1);
    });

    it('returns 1.0 when all observations are met', () => {
        for (let i = 0; i < 10; i++) metricsService.recordSloObservation('avail', true);
        expect(metricsService.getSloCompliance('avail')).toBe(1);
    });

    it('returns 0 when all observations are not met', () => {
        for (let i = 0; i < 10; i++) metricsService.recordSloObservation('avail', false);
        expect(metricsService.getSloCompliance('avail')).toBe(0);
    });

    it('computes fractional compliance correctly', () => {
        // 8 met, 2 not met → 0.8
        for (let i = 0; i < 8; i++) metricsService.recordSloObservation('latency', true);
        for (let i = 0; i < 2; i++) metricsService.recordSloObservation('latency', false);
        expect(metricsService.getSloCompliance('latency')).toBeCloseTo(0.8, 5);
    });

    it('respects the time window – excludes old observations', async () => {
        // record "old" failing observations
        for (let i = 0; i < 5; i++) metricsService.recordSloObservation('error_rate', false);
        // wait briefly then record recent successes
        await new Promise(r => setTimeout(r, 20));
        for (let i = 0; i < 5; i++) metricsService.recordSloObservation('error_rate', true);
        // only look at the last 10 ms (only the recent ones should count)
        const compliance = metricsService.getSloCompliance('error_rate', 10);
        expect(compliance).toBe(1);
    });

    it('returns 1.0 when all observations are outside the window', async () => {
        metricsService.recordSloObservation('throughput', false);
        await new Promise(r => setTimeout(r, 20));
        expect(metricsService.getSloCompliance('throughput', 5)).toBe(1);
    });

    it('tracks multiple SLOs independently', () => {
        metricsService.recordSloObservation('slo_a', true);
        metricsService.recordSloObservation('slo_a', true);
        metricsService.recordSloObservation('slo_b', false);
        metricsService.recordSloObservation('slo_b', false);
        expect(metricsService.getSloCompliance('slo_a')).toBe(1);
        expect(metricsService.getSloCompliance('slo_b')).toBe(0);
    });
});
