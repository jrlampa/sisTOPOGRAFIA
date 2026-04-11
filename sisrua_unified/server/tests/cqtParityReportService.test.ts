import { CQT_BASELINE_TARGETS } from '../constants/cqtBaselineTargets';
import {
    buildCqtParityReport,
    buildCqtParityReportSuite,
    CqtExpectedByScenario,
    isCqtParitySuiteComplete,
    renderCqtParityReportMarkdown
} from '../services/cqtParityReportService';
import { CQT_PARITY_WORKBOOK_FIXTURE } from './fixtures/cqtParityWorkbookFixture';

describe('cqtParityReportService.buildCqtParityReport', () => {
    it('reports all baseline cells as pass for scenario atual', () => {
        const report = buildCqtParityReport('atual', CQT_PARITY_WORKBOOK_FIXTURE.atual);

        expect(report.scenario).toBe('atual');
        expect(report.referenceCells).toBe(7);
        expect(report.referenceStatus).toBe('complete');
        expect(report.pending).toHaveLength(0);
        expect(report.compared).toBe(7);
        expect(report.failed).toBe(0);
        expect(report.passed).toBe(7);
        expect(report.skipped).toHaveLength(0);
    });

    it('reports proj1 expected cells for GERAL PROJ targets', () => {
        const report = buildCqtParityReport('proj1', CQT_PARITY_WORKBOOK_FIXTURE.proj1);

        expect(report.scenario).toBe('proj1');
        expect(report.referenceCells).toBe(2);
        expect(report.referenceStatus).toBe('complete');
        expect(report.pending).toHaveLength(0);
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
        expect(report.pending).toHaveLength(0);
        expect(report.compared).toBe(1);
        expect(report.skipped).toHaveLength(6);
        expect(report.failed).toBe(0);
    });

    it('reports proj2 expected cells with analytically computed values (QT_MTTR3 basis)', () => {
        const report = buildCqtParityReport('proj2', CQT_PARITY_WORKBOOK_FIXTURE.proj2);

        expect(report.referenceCells).toBe(2);
        expect(report.referenceStatus).toBe('complete');
        expect(report.pending).toHaveLength(0);
        expect(report.compared).toBe(2);
        expect(report.failed).toBe(0);
        expect(report.passed).toBe(2);
        expect(report.skipped).toHaveLength(0);
        expect(report.diffs.map((item) => item.cell)).toEqual(['GERAL PROJ2!P31', 'GERAL PROJ2!P32']);
    });

    it('builds consolidated suite report across atual/proj1/proj2', () => {
        const suite = buildCqtParityReportSuite(CQT_PARITY_WORKBOOK_FIXTURE);

        expect(suite.reports).toHaveLength(3);
        expect(suite.totals.scenarios).toBe(3);
        expect(suite.totals.complete).toBe(3);
        expect(suite.totals.partial).toBe(0);
        expect(suite.totals.missing).toBe(0);
        expect(suite.totals.compared).toBe(11);
        expect(suite.totals.failed).toBe(0);
        expect(suite.totals.passed).toBe(11);
        expect(isCqtParitySuiteComplete(suite)).toBe(true);
    });

    it('renders suite report as markdown', () => {
        const suite = buildCqtParityReportSuite(CQT_PARITY_WORKBOOK_FIXTURE);
        const markdown = renderCqtParityReportMarkdown(suite);

        expect(markdown).toContain('# CQT Parity Report');
        expect(markdown).toContain('## Summary');
        expect(markdown).toContain('## Scenario: atual');
        expect(markdown).toContain('## Scenario: proj1');
        expect(markdown).toContain('## Scenario: proj2');
        expect(markdown).toContain('| Failed Cells | 0 |');
        expect(markdown).toContain('GERAL PROJ2!P31');
    });

    it('marks suite complete when proj2 expected overrides are provided', () => {
        const expectedOverrides: CqtExpectedByScenario = {
            proj2: {
                'GERAL PROJ2!P31': 120.111,
                'GERAL PROJ2!P32': 119.999
            }
        };

        const suite = buildCqtParityReportSuite({
            atual: CQT_PARITY_WORKBOOK_FIXTURE.atual,
            proj1: CQT_PARITY_WORKBOOK_FIXTURE.proj1,
            proj2: {
                geral: {
                    p31CqtNoPonto: 120.111,
                    p32CqtNoPonto: 119.999
                }
            }
        }, undefined, expectedOverrides);

        expect(suite.totals.complete).toBe(3);
        expect(suite.totals.partial).toBe(0);
        expect(suite.totals.missing).toBe(0);
        expect(suite.totals.failed).toBe(0);
        expect(suite.totals.passed).toBe(11);

        expect(isCqtParitySuiteComplete(suite)).toBe(true);
    });

    it('supports error-state parity comparison when expected override declares an error class', () => {
        const report = buildCqtParityReport('atual', {
            dmdi: { dmdi: CQT_BASELINE_TARGETS.ramal.aa30Dmdi },
            errorByCell: {
                'DB!K8': '#VALUE!'
            }
        }, undefined, {
            atual: {
                'DB!K8': { error: '#VALUE!' }
            }
        });

        expect(report.referenceStatus).toBe('partial');
        expect(report.compared).toBe(2);
        const errorDiff = report.diffs.find((item) => item.cell === 'DB!K8');
        expect(errorDiff).toBeDefined();
        expect(errorDiff?.expectedState).toBe('error');
        expect(errorDiff?.actualState).toBe('error');
        expect(errorDiff?.withinTolerance).toBe(true);
    });

    it('includes lineage details for critical cells in markdown output', () => {
        const suite = buildCqtParityReportSuite(CQT_PARITY_WORKBOOK_FIXTURE);
        const markdown = renderCqtParityReportMarkdown(suite);

        expect(markdown).toContain('Critical lineage:');
        expect(markdown).toContain('GERAL!P31');
        expect(markdown).toContain('DB!K10');
    });
});
