import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CQT_PARITY_WORKBOOK_FIXTURE } from '../server/tests/fixtures/cqtParityWorkbookFixture.js';
import {
    buildCqtParityReportSuite,
    renderCqtParityReportMarkdown
} from '../server/services/cqtParityReportService.js';

const outputPath = resolve(process.cwd(), 'docs', 'CQT_PARITY_REPORT.md');

const suite = buildCqtParityReportSuite(CQT_PARITY_WORKBOOK_FIXTURE);
const markdown = renderCqtParityReportMarkdown(suite);

writeFileSync(outputPath, markdown, { encoding: 'utf-8' });

console.log(`CQT parity report generated at: ${outputPath}`);
