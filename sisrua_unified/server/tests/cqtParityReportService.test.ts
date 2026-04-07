import { CQT_BASELINE_TARGETS } from '../constants/cqtBaselineTargets';
import { buildCqtParityReport } from '../services/cqtParityReportService';

describe('cqtParityReportService.buildCqtParityReport', () => {
    it('reports all baseline cells as pass for scenario atual', () => {
        const report = buildCqtParityReport('atual', {
            dmdi: { dmdi: CQT_BASELINE_TARGETS.ramal.aa30Dmdi },
            geral: {
                p31CqtNoPonto: CQT_BASELINE_TARGETS.geralAtual.p31CqtNoPonto,
                p32CqtNoPonto: CQT_BASELINE_TARGETS.geralAtual.p32CqtNoPonto
            },
            db: {
                k6TrAtual: CQT_BASELINE_TARGETS.db.k6TrAtual,
                k7DemAtual: CQT_BASELINE_TARGETS.db.k7DemAtual,
                k8QtTr: CQT_BASELINE_TARGETS.db.k8QtTr,
                k10QtMttr: CQT_BASELINE_TARGETS.db.k10QtMttr
            }
        });

        expect(report.scenario).toBe('atual');
        expect(report.referenceCells).toBe(7);
        expect(report.referenceStatus).toBe('complete');
        expect(report.compared).toBe(7);
        expect(report.failed).toBe(0);
        expect(report.passed).toBe(7);
        expect(report.skipped).toHaveLength(0);
    });

    it('reports proj1 expected cells for GERAL PROJ targets', () => {
        const report = buildCqtParityReport('proj1', {
            geral: {
                p31CqtNoPonto: CQT_BASELINE_TARGETS.geralProj1.p31CqtNoPonto,
                p32CqtNoPonto: CQT_BASELINE_TARGETS.geralProj1.p32CqtNoPonto
            }
        });

        expect(report.scenario).toBe('proj1');
        expect(report.referenceCells).toBe(2);
        expect(report.referenceStatus).toBe('complete');
        expect(report.compared).toBe(2);
        expect(report.failed).toBe(0);
        expect(report.passed).toBe(2);
        expect(report.diffs.map((item) => item.cell)).toEqual(['GERAL PROJ!P31', 'GERAL PROJ!P32']);
    });

    it('marks missing values as skipped', () => {
        const report = buildCqtParityReport('atual', {
            dmdi: { dmdi: CQT_BASELINE_TARGETS.ramal.aa30Dmdi }
        });

        expect(report.referenceStatus).toBe('partial');
        expect(report.compared).toBe(1);
        expect(report.skipped).toHaveLength(6);
        expect(report.failed).toBe(0);
    });

    it('marks proj2 as missing reference while no baseline cells are mapped', () => {
        const report = buildCqtParityReport('proj2', {
            geral: {
                p31CqtNoPonto: 120,
                p32CqtNoPonto: 119
            }
        });

        expect(report.referenceCells).toBe(0);
        expect(report.referenceStatus).toBe('missing');
        expect(report.compared).toBe(0);
        expect(report.failed).toBe(0);
        expect(report.passed).toBe(0);
        expect(report.skipped).toHaveLength(0);
    });
});
