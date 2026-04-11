/**
 * Tests for btParityService (E7-H1, E7-H2)
 */

import {
    runBtParitySuite,
    runBtParityByPriority,
    listBtParityScenarios,
    type BtParitySuiteReport,
} from '../services/btParityService';

describe('btParityService – scenario listing', () => {
    it('lists at least one P0 scenario', () => {
        const scenarios = listBtParityScenarios();
        const p0 = scenarios.filter((s) => s.priority === 'P0');
        expect(p0.length).toBeGreaterThan(0);
    });

    it('every scenario has id, description and priority', () => {
        const scenarios = listBtParityScenarios();
        for (const s of scenarios) {
            expect(typeof s.id).toBe('string');
            expect(s.id.length).toBeGreaterThan(0);
            expect(typeof s.description).toBe('string');
            expect(['P0', 'P1', 'P2']).toContain(s.priority);
        }
    });
});

describe('btParityService – suite report structure (E7-H1)', () => {
    let report: BtParitySuiteReport;

    beforeAll(() => {
        report = runBtParitySuite();
    });

    it('report has generatedAt ISO timestamp', () => {
        expect(report.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('report has tolerance field', () => {
        expect(typeof report.tolerance).toBe('number');
        expect(report.tolerance).toBeGreaterThan(0);
    });

    it('report.scenarios length equals listed scenarios', () => {
        const listed = listBtParityScenarios();
        expect(report.scenarios).toHaveLength(listed.length);
    });

    it('totals.total equals scenarios length', () => {
        expect(report.totals.total).toBe(report.scenarios.length);
    });

    it('totals pass + warn + fail equals total', () => {
        const { pass, warn, fail, total } = report.totals;
        expect(pass + warn + fail).toBe(total);
    });

    it('every scenario result has required fields', () => {
        for (const sr of report.scenarios) {
            expect(typeof sr.scenarioId).toBe('string');
            expect(typeof sr.description).toBe('string');
            expect(['P0', 'P1', 'P2']).toContain(sr.priority);
            expect(['pass', 'warn', 'fail']).toContain(sr.status);
            expect(Array.isArray(sr.metrics)).toBe(true);
        }
    });

    it('every metric has required fields', () => {
        for (const sr of report.scenarios) {
            for (const m of sr.metrics) {
                expect(typeof m.name).toBe('string');
                expect(typeof m.expected).toBe('number');
                expect(typeof m.actual).toBe('number');
                expect(typeof m.absDiff).toBe('number');
                expect(['pass', 'warn', 'fail']).toContain(m.status);
            }
        }
    });

    it('p0Gate is true when all P0 scenarios pass', () => {
        const p0Fail = report.scenarios.filter((s) => s.priority === 'P0' && s.status === 'fail').length;
        expect(report.p0Gate).toBe(p0Fail === 0);
    });
});

describe('btParityService – P0 gate (E7-H2)', () => {
    it('all P0 scenarios pass (CI gate requirement)', () => {
        const report = runBtParitySuite();
        const p0Failures = report.scenarios.filter((s) => s.priority === 'P0' && s.status === 'fail');
        if (p0Failures.length > 0) {
            const msgs = p0Failures.map((s) => `${s.scenarioId}: ${s.error ?? s.metrics.map((m) => `${m.name}=${m.status}`).join(', ')}`);
            throw new Error(`P0 gate failed: ${msgs.join('; ')}`);
        }
        expect(p0Failures).toHaveLength(0);
    });

    it('p0Gate property is true', () => {
        const report = runBtParitySuite();
        expect(report.p0Gate).toBe(true);
    });
});

describe('btParityService – runByPriority', () => {
    it('runBtParityByPriority("P0") returns only P0 scenarios', () => {
        const results = runBtParityByPriority('P0');
        for (const r of results) {
            expect(r.priority).toBe('P0');
        }
    });

    it('runBtParityByPriority("P1") returns only P1 scenarios', () => {
        const results = runBtParityByPriority('P1');
        for (const r of results) {
            expect(r.priority).toBe('P1');
        }
    });

    it('runBtParityByPriority("P2") returns only P2 scenarios', () => {
        const results = runBtParityByPriority('P2');
        for (const r of results) {
            expect(r.priority).toBe('P2');
        }
    });
});

describe('btParityService – workbook parity (ESQ_ATUAL P0)', () => {
    it('ESQ_ATUAL scenario passes within tolerance', () => {
        const report = runBtParitySuite();
        const esq = report.scenarios.find((s) => s.scenarioId === 'ESQ_ATUAL');
        expect(esq).toBeDefined();
        expect(esq!.status).not.toBe('fail');
    });

    it('LINEAR_SIMPLE scenario passes', () => {
        const report = runBtParitySuite();
        const linear = report.scenarios.find((s) => s.scenarioId === 'LINEAR_SIMPLE');
        expect(linear).toBeDefined();
        expect(linear!.status).not.toBe('fail');
    });

    it('IDEMPOTENCY scenario passes', () => {
        const report = runBtParitySuite();
        const idempotency = report.scenarios.find((s) => s.scenarioId === 'IDEMPOTENCY');
        expect(idempotency).toBeDefined();
        expect(idempotency!.status).not.toBe('fail');
    });
});

describe('btParityService – REV0 workbook parity (CQTsimplificado_REV0 - Copia - Copia.xlsx)', () => {
    let report: BtParitySuiteReport;

    beforeAll(() => {
        report = runBtParitySuite();
    });

    it('REV0_DB_INDICATORS scenario is present', () => {
        const scenario = report.scenarios.find((s) => s.scenarioId === 'REV0_DB_INDICATORS');
        expect(scenario).toBeDefined();
    });

    it('REV0_DB_INDICATORS scenario passes P0 gate (qtTrafo and totalDemandKva)', () => {
        const scenario = report.scenarios.find((s) => s.scenarioId === 'REV0_DB_INDICATORS');
        expect(scenario).toBeDefined();
        expect(scenario!.priority).toBe('P0');
        expect(scenario!.status).not.toBe('fail');
        const qtTrafoMetric = scenario!.metrics.find((m) => m.name === 'qtTrafo');
        expect(qtTrafoMetric).toBeDefined();
        expect(qtTrafoMetric!.status).toBe('pass');
        const demandMetric = scenario!.metrics.find((m) => m.name === 'totalDemandKva');
        expect(demandMetric).toBeDefined();
        expect(demandMetric!.status).toBe('pass');
    });

    it('REV0_DB_INDICATORS qtTrafo matches workbook DB!K10 formula', () => {
        const scenario = report.scenarios.find((s) => s.scenarioId === 'REV0_DB_INDICATORS');
        const qtTrafoMetric = scenario!.metrics.find((m) => m.name === 'qtTrafo');
        // DB!K10 = QT_MT + (DEM_ATUAL / TR_ATUAL) * Z% = 0.0183 + (101.956/225)*0.035
        expect(qtTrafoMetric!.expected).toBeCloseTo(0.03415982222222222, 10);
        expect(qtTrafoMetric!.actual).toBeCloseTo(0.03415982222222222, 10);
    });

    it('REV0_LINEAR scenario passes P0 gate', () => {
        const scenario = report.scenarios.find((s) => s.scenarioId === 'REV0_LINEAR');
        expect(scenario).toBeDefined();
        expect(scenario!.priority).toBe('P0');
        expect(scenario!.status).not.toBe('fail');
    });

    it('REV0_LINEAR demand accumulation correct (50 + 50 = 100 kVA)', () => {
        const scenario = report.scenarios.find((s) => s.scenarioId === 'REV0_LINEAR');
        const demandMetric = scenario!.metrics.find((m) => m.name === 'totalDemandKva');
        expect(demandMetric).toBeDefined();
        expect(demandMetric!.expected).toBe(100);
        expect(demandMetric!.actual).toBeCloseTo(100, 9);
        expect(demandMetric!.status).toBe('pass');
    });

    it('REV0_IDEMPOTENCY scenario passes P0 gate', () => {
        const scenario = report.scenarios.find((s) => s.scenarioId === 'REV0_IDEMPOTENCY');
        expect(scenario).toBeDefined();
        expect(scenario!.priority).toBe('P0');
        expect(scenario!.status).not.toBe('fail');
    });

    it('REV0_IDEMPOTENCY produces identical CQT global on two consecutive runs', () => {
        const scenario = report.scenarios.find((s) => s.scenarioId === 'REV0_IDEMPOTENCY');
        expect(scenario).toBeDefined();
        const idempotencyMetric = scenario!.metrics.find((m) => m.name === 'idempotency_cqtGlobal');
        expect(idempotencyMetric).toBeDefined();
        expect(idempotencyMetric!.absDiff).toBe(0);
        expect(idempotencyMetric!.status).toBe('pass');
    });

    it('all REV0 P0 scenarios pass the P0 gate', () => {
        const rev0P0Failures = report.scenarios.filter(
            (s) => s.scenarioId.startsWith('REV0_') && s.priority === 'P0' && s.status === 'fail'
        );
        expect(rev0P0Failures).toHaveLength(0);
    });
});

