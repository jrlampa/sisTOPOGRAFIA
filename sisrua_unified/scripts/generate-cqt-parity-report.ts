import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CQT_PARITY_WORKBOOK_FIXTURE } from '../server/tests/fixtures/cqtParityWorkbookFixture.js';
import {
    buildCqtParityReportSuite,
    isCqtParitySuiteComplete,
    renderCqtParityReportMarkdown
} from '../server/services/cqtParityReportService.js';

const outputPath = resolve(process.cwd(), 'docs', 'CQT_PARITY_REPORT.md');
const isCheckMode = process.argv.includes('--check');

const suite = buildCqtParityReportSuite(CQT_PARITY_WORKBOOK_FIXTURE);
const markdown = renderCqtParityReportMarkdown(suite);

writeFileSync(outputPath, markdown, { encoding: 'utf-8' });

console.log(`CQT parity report generated at: ${outputPath}`);

if (isCheckMode && !isCqtParitySuiteComplete(suite)) {
    console.error('CQT parity check failed: suite is not complete (failed/partial/missing detected).');
    process.exit(1);
}
