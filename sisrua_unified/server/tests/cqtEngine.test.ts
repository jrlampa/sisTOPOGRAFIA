import { CQT_BASELINE_TARGETS } from '../constants/cqtBaselineTargets';
import { CABOS_BASELINE, DISJUNTORES_BASELINE, TRAFOS_Z_BASELINE } from '../constants/cqtLookupTables';
import {
    calculateDbIndicators,
    calculateCorrectedResistance,
    calculateDmdi,
    calculateDmdiWithMetadata,
    calculateGeralCqtNoPonto,
    calculateIb,
    calculateQtPonto,
    evaluateProtection,
    lookupCaboElectricalData,
    lookupDisjuntorIn
} from '../services/cqtEngine';

describe('cqtEngine.calculateDmdi', () => {
    it('uses AB35 lookup path when clandestino is enabled', () => {
        const dmdi = calculateDmdi({
            clandestinoEnabled: true,
            aa24DemandBase: 206.9999999999999,
            sumClientsX: 73,
            ab35LookupDmdi: CQT_BASELINE_TARGETS.ramal.ab35LookupDmdi
        });

        expect(dmdi).toBeCloseTo(CQT_BASELINE_TARGETS.ramal.aa30Dmdi, 12);
    });

    it('uses AA24/SUM(X) when clandestino is disabled', () => {
        const dmdi = calculateDmdi({
            clandestinoEnabled: false,
            aa24DemandBase: 207,
            sumClientsX: 90,
            ab35LookupDmdi: 99
        });

        expect(dmdi).toBeCloseTo(2.3, 12);
    });

    it('returns 0 when division path is invalid', () => {
        const dmdi = calculateDmdi({
            clandestinoEnabled: false,
            aa24DemandBase: 207,
            sumClientsX: 0,
            ab35LookupDmdi: 99
        });

        expect(dmdi).toBe(0);
    });

    it('returns metadata with selected source', () => {
        const lookupResult = calculateDmdiWithMetadata({
            clandestinoEnabled: true,
            aa24DemandBase: 100,
            sumClientsX: 50,
            ab35LookupDmdi: 2.84
        });

        const divisionResult = calculateDmdiWithMetadata({
            clandestinoEnabled: false,
            aa24DemandBase: 100,
            sumClientsX: 25,
            ab35LookupDmdi: 2.84
        });

        expect(lookupResult).toEqual({ dmdi: 2.84, source: 'lookup-ab35' });
        expect(divisionResult).toEqual({ dmdi: 4, source: 'aa24-div-sumx' });
    });
});

describe('cqtEngine.calculateGeralCqtNoPonto', () => {
    const esqByPonto = {
        RAMAL: CQT_BASELINE_TARGETS.geralAtual.p31CqtNoPonto
    };

    const dirByPonto = {
        RAMAL: CQT_BASELINE_TARGETS.geralAtual.p32CqtNoPonto
    };

    it('returns ESQ value by exact point lookup', () => {
        const value = calculateGeralCqtNoPonto({
            lado: 'ESQUERDO',
            ponto: 'RAMAL',
            qtMttr: 0,
            esqCqtByPonto: esqByPonto,
            dirCqtByPonto: dirByPonto
        });

        expect(value).toBeCloseTo(CQT_BASELINE_TARGETS.geralAtual.p31CqtNoPonto, 12);
    });

    it('returns DIR value by exact point lookup', () => {
        const value = calculateGeralCqtNoPonto({
            lado: 'DIREITO',
            ponto: 'RAMAL',
            qtMttr: 0,
            esqCqtByPonto: esqByPonto,
            dirCqtByPonto: dirByPonto
        });

        expect(value).toBeCloseTo(CQT_BASELINE_TARGETS.geralAtual.p32CqtNoPonto, 12);
    });

    it('returns TRAFO formula value', () => {
        const qtMttr = CQT_BASELINE_TARGETS.db.k10QtMttr;
        const value = calculateGeralCqtNoPonto({
            lado: 'TRAFO',
            ponto: 'ANY',
            qtMttr,
            esqCqtByPonto: esqByPonto,
            dirCqtByPonto: dirByPonto
        });

        expect(value).toBeCloseTo(127 - (127 * qtMttr), 12);
    });

    it('returns 0 when side lookup fails', () => {
        const value = calculateGeralCqtNoPonto({
            lado: 'ESQUERDO',
            ponto: 'NOT_FOUND',
            qtMttr: 0,
            esqCqtByPonto: esqByPonto,
            dirCqtByPonto: dirByPonto
        });

        expect(value).toBe(0);
    });
});

describe('cqtEngine.calculateDbIndicators', () => {
    it('reproduces baseline values for K6/K7/K8/K10', () => {
        const qtMtBaseline = CQT_BASELINE_TARGETS.db.k10QtMttr - CQT_BASELINE_TARGETS.db.k8QtTr;
        const result = calculateDbIndicators({
            trAtual: CQT_BASELINE_TARGETS.db.k6TrAtual,
            demAtual: CQT_BASELINE_TARGETS.db.k7DemAtual,
            qtMt: qtMtBaseline,
            trafosZ: TRAFOS_Z_BASELINE
        });

        expect(result.k6TrAtual).toBeCloseTo(CQT_BASELINE_TARGETS.db.k6TrAtual, 12);
        expect(result.k7DemAtual).toBeCloseTo(CQT_BASELINE_TARGETS.db.k7DemAtual, 12);
        expect(result.k8QtTr).toBeCloseTo(CQT_BASELINE_TARGETS.db.k8QtTr, 12);
        expect(result.k10QtMttr).toBeCloseTo(CQT_BASELINE_TARGETS.db.k10QtMttr, 12);
    });

    it('returns K8=0 when TRAFOS_Z lookup fails', () => {
        const result = calculateDbIndicators({
            trAtual: 999,
            demAtual: 100,
            qtMt: 0.1,
            trafosZ: TRAFOS_Z_BASELINE
        });

        expect(result.k8QtTr).toBe(0);
        expect(result.k10QtMttr).toBeCloseTo(0.1, 12);
    });
});

describe('cqtEngine protection layer', () => {
    it('calculates Ib for MONO and TRI phases', () => {
        const monoIb = calculateIb({
            fase: 'MONO',
            acumuladaKva: 10,
            eta: 1,
            tensaoTrifasicaV: 127
        });

        const triIb = calculateIb({
            fase: 'TRI',
            acumuladaKva: 10,
            eta: 3,
            tensaoTrifasicaV: 127
        });

        expect(monoIb).toBeCloseTo(45.4545454545, 8);
        expect(triIb).toBeCloseTo((10 * 1000) / (Math.sqrt(3) * 127 * 3), 10);
    });

    it('returns fallback 0 when ETA is invalid', () => {
        const ib = calculateIb({
            fase: 'MONO',
            acumuladaKva: 10,
            eta: 0,
            tensaoTrifasicaV: 127
        });

        expect(ib).toBe(0);
    });

    it('looks up disjuntor with approximate VLOOKUP semantics', () => {
        const inBreaker = lookupDisjuntorIn(27, DISJUNTORES_BASELINE);
        expect(inBreaker).toBe(25);
    });

    it('looks up cable electrical data by conductor name', () => {
        const data = lookupCaboElectricalData('70 Al - MX', CABOS_BASELINE);
        expect(data.iz).toBe(202);
        expect(data.resistance).toBeCloseTo(0.5697, 8);
        expect(data.reactance).toBeCloseTo(0.126, 8);
    });

    it('returns zeroed cable data when conductor is missing', () => {
        const data = lookupCaboElectricalData('NOT-FOUND', CABOS_BASELINE);
        expect(data).toEqual({ iz: 0, resistance: 0, reactance: 0, alpha: 0, divisorR: 0 });
    });

    it('evaluates protection status with Ib/In/Iz rule', () => {
        const ok = evaluateProtection(20, 25, 63);
        const fail = evaluateProtection(40, 32, 32);

        expect(ok.status).toBe('OK');
        expect(fail.status).toBe('VERIFICAR');
    });

    it('calculates corrected resistance from workbook formula', () => {
        const rcorr = calculateCorrectedResistance({
            resistance: 0.5697,
            alpha: 0.00403,
            divisorR: 1.2821,
            temperatureC: 30
        });

        expect(rcorr).toBeCloseTo((0.5697 / 1.2821) * (1 + 0.00403 * 10), 10);
    });

    it('calculates QT-PONTO approximation for branch telemetry', () => {
        const qt = calculateQtPonto({
            fase: 'TRI',
            acumuladaKva: 12,
            correctedResistance: 0.46,
            reactance: 0.12,
            tensaoTrifasicaV: 127,
            lengthMeters: 35
        });

        expect(qt).toBeGreaterThan(0);
    });
});
