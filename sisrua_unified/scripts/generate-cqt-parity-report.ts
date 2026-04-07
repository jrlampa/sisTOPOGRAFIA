import { spawnSync } from 'node:child_process';
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
const auditOutputPath = resolve(process.cwd(), 'docs', 'CQT_WORKBOOK_AUDIT.json');
const cliArgs = process.argv.slice(2);
const isCheckMode = cliArgs.includes('--check');
const requireWorkbookAudit = cliArgs.includes('--require-workbook-audit');

let workbookPathArg: string | undefined;
const workbookArgIndex = cliArgs.indexOf('--workbook');
if (workbookArgIndex >= 0) {
    workbookPathArg = cliArgs[workbookArgIndex + 1];
    if (!workbookPathArg || workbookPathArg.startsWith('--')) {
        console.error('Missing value for --workbook argument.');
        process.exit(2);
    }
}

if (requireWorkbookAudit) {
    const auditArgs = ['scripts/audit_cqt_workbook.py', '--check', '--output', auditOutputPath];
    if (workbookPathArg) {
        auditArgs.push('--workbook', workbookPathArg);
    }

    console.log('Running workbook audit gate before parity report...');
    const auditRun = spawnSync('python', auditArgs, {
        stdio: 'inherit',
        cwd: process.cwd()
    });

    if (auditRun.status !== 0) {
        console.error('CQT workbook audit gate failed.');
        process.exit(auditRun.status ?? 1);
    }
}

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
