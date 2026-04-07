import { CQT_BASELINE_TARGETS } from '../constants/cqtBaselineTargets';
import {
    buildCqtParityReport,
    buildCqtParityReportSuite,
    renderCqtParityReportMarkdown
} from '../services/cqtParityReportService';
import { CQT_PARITY_WORKBOOK_FIXTURE } from './fixtures/cqtParityWorkbookFixture';

describe('cqtParityReportService.buildCqtParityReport', () => {
    it('reports all baseline cells as pass for scenario atual', () => {
        const report = buildCqtParityReport('atual', CQT_PARITY_WORKBOOK_FIXTURE.atual);

        expect(report.scenario).toBe('atual');
        expect(report.referenceCells).toBe(7);
        expect(report.referenceStatus).toBe('complete');
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
        const report = buildCqtParityReport('proj2', CQT_PARITY_WORKBOOK_FIXTURE.proj2);

        expect(report.referenceCells).toBe(0);
        expect(report.referenceStatus).toBe('missing');
        expect(report.compared).toBe(0);
        expect(report.failed).toBe(0);
        expect(report.passed).toBe(0);
        expect(report.skipped).toHaveLength(0);
    });

    it('builds consolidated suite report across atual/proj1/proj2', () => {
        const suite = buildCqtParityReportSuite(CQT_PARITY_WORKBOOK_FIXTURE);

        expect(suite.reports).toHaveLength(3);
        expect(suite.totals.scenarios).toBe(3);
        expect(suite.totals.complete).toBe(2);
        expect(suite.totals.partial).toBe(0);
        expect(suite.totals.missing).toBe(1);
        expect(suite.totals.compared).toBe(9);
        expect(suite.totals.failed).toBe(0);
        expect(suite.totals.passed).toBe(9);
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
    });
});
