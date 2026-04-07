import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CQT_PARITY_WORKBOOK_FIXTURE } from '../server/tests/fixtures/cqtParityWorkbookFixture.js';
import {
    buildCqtParityReportSuite,
    CqtExpectedByScenario,
    isCqtParitySuiteComplete,
    renderCqtParityReportMarkdown
} from '../server/services/cqtParityReportService.js';

const outputPath = resolve(process.cwd(), 'docs', 'CQT_PARITY_REPORT.md');
const overridesPath = resolve(process.cwd(), 'docs', 'CQT_PARITY_EXPECTED_OVERRIDES.json');
const isCheckMode = process.argv.includes('--check');

let expectedOverrides: CqtExpectedByScenario | undefined;
if (existsSync(overridesPath)) {
    const raw = readFileSync(overridesPath, 'utf-8');
    expectedOverrides = JSON.parse(raw) as CqtExpectedByScenario;
}

const suite = buildCqtParityReportSuite(CQT_PARITY_WORKBOOK_FIXTURE, undefined, expectedOverrides);
const markdown = renderCqtParityReportMarkdown(suite);

writeFileSync(outputPath, markdown, { encoding: 'utf-8' });

console.log(`CQT parity report generated at: ${outputPath}`);
if (expectedOverrides) {
    console.log(`CQT parity overrides loaded from: ${overridesPath}`);
}

if (isCheckMode && !isCqtParitySuiteComplete(suite)) {
    console.error('CQT parity check failed: suite is not complete (failed/partial/missing detected).');
    process.exit(1);
}
