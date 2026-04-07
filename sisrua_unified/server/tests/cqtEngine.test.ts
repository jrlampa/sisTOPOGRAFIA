import { CQT_BASELINE_TARGETS } from '../constants/cqtBaselineTargets';
import { TRAFOS_Z_BASELINE } from '../constants/cqtLookupTables';
import {
    calculateDbIndicators,
    calculateDmdi,
    calculateDmdiWithMetadata,
    calculateGeralCqtNoPonto
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
