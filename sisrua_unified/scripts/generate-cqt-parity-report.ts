import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
    buildCqtParityReportSuite,
    CqtExpectedCellOverride,
    CqtExpectedByScenario,
    isCqtParitySuiteComplete,
    renderCqtParityReportMarkdown
} from '../server/services/cqtParityReportService.js';
import { buildCanonicalCqtRuntimeSnapshots } from '../server/services/cqtRuntimeSnapshotService.js';

const outputPath = resolve(process.cwd(), 'docs', 'CQT_PARITY_REPORT.md');
const overridesPath = resolve(process.cwd(), 'docs', 'CQT_PARITY_EXPECTED_OVERRIDES.json');
const auditOutputPath = resolve(process.cwd(), 'docs', 'CQT_WORKBOOK_AUDIT.json');
const cliArgs = process.argv.slice(2);
const isCheckMode = cliArgs.includes('--check');
const requireWorkbookAudit = cliArgs.includes('--require-workbook-audit');

interface WorkbookAuditReport {
    parityCells?: Partial<Record<'atual' | 'proj1' | 'proj2', Record<string, CqtExpectedCellOverride>>>;
}

// ── Canonical workbook resolution (mirrors audit_cqt_workbook.py) ─────────────
// Priority: 1) --workbook CLI arg  2) CQT_WORKBOOK_PATH env  3) Light_estudo/*.xlsx
//           4) root-level legacy xlsx
function resolveCanonicalWorkbook(): string | undefined {
    const lightEstudoDir = resolve(process.cwd(), 'Light_estudo');
    if (existsSync(lightEstudoDir)) {
        const xlsx = readdirSync(lightEstudoDir)
            .filter((f) => f.endsWith('.xlsx'))
            .sort();
        if (xlsx.length > 0) return join(lightEstudoDir, xlsx[0]);
    }
    const legacy = resolve(process.cwd(), 'CQTsimplificado_BECO DO MATA 7 - PARIDADE_FINAL.xlsx');
    if (existsSync(legacy)) return legacy;
    return undefined;
}

let workbookPathArg: string | undefined;
const workbookArgIndex = cliArgs.indexOf('--workbook');
if (workbookArgIndex >= 0) {
    workbookPathArg = cliArgs[workbookArgIndex + 1];
    if (!workbookPathArg || workbookPathArg.startsWith('--')) {
        console.error('Missing value for --workbook argument.');
        process.exit(2);
    }
}
// If not supplied via CLI, try env var then auto-discovery
if (!workbookPathArg) {
    workbookPathArg = process.env['CQT_WORKBOOK_PATH']?.trim() || resolveCanonicalWorkbook();
}

function runWorkbookAudit(options: { workbookPath?: string; check: boolean }): boolean {
    const auditArgs = ['scripts/audit_cqt_workbook.py', '--output', auditOutputPath];
    if (options.check) {
        auditArgs.push('--check');
    }
    if (options.workbookPath) {
        auditArgs.push('--workbook', options.workbookPath);
    }

    console.log('Running workbook audit before parity report...');
    const auditRun = spawnSync('python', auditArgs, {
        stdio: 'inherit',
        cwd: process.cwd()
    });

    return auditRun.status === 0;
}

if (workbookPathArg) {
    const auditOk = runWorkbookAudit({
        workbookPath: workbookPathArg,
        check: requireWorkbookAudit,
    });

    if (!auditOk && requireWorkbookAudit) {
        console.error('CQT workbook audit gate failed.');
        process.exit(1);
    }

    if (!auditOk) {
        console.warn('Workbook audit failed; falling back to static parity expectations.');
    }
} else if (requireWorkbookAudit) {
    console.error('CQT workbook audit gate failed: no workbook found in canonical paths.');
    process.exit(1);
}

function loadExpectedOverridesFromAudit(path: string): CqtExpectedByScenario | undefined {
    if (!existsSync(path)) {
        return undefined;
    }

    try {
        const raw = readFileSync(path, 'utf-8');
        const report = JSON.parse(raw) as WorkbookAuditReport;
        if (!report.parityCells) {
            return undefined;
        }

        const hasAnyScenario = Object.values(report.parityCells).some(
            (scenarioCells) => scenarioCells && Object.keys(scenarioCells).length > 0,
        );
        if (!hasAnyScenario) {
            return undefined;
        }

        return report.parityCells;
    } catch (error) {
        console.warn(`Unable to parse workbook audit report at ${path}:`, error);
        return undefined;
    }
}

let expectedOverrides: CqtExpectedByScenario | undefined;
if (existsSync(overridesPath)) {
    const raw = readFileSync(overridesPath, 'utf-8');
    expectedOverrides = JSON.parse(raw) as CqtExpectedByScenario;
}

// If workbook audit has parity cells, prefer them over static overrides.
const workbookDerivedOverrides = loadExpectedOverridesFromAudit(auditOutputPath);
if (workbookDerivedOverrides) {
    expectedOverrides = workbookDerivedOverrides;
    console.log(`CQT parity expectations loaded from workbook audit: ${auditOutputPath}`);
}

const suite = buildCqtParityReportSuite(
    buildCanonicalCqtRuntimeSnapshots(),
    undefined,
    expectedOverrides,
);
const markdown = renderCqtParityReportMarkdown(suite);

writeFileSync(outputPath, markdown, { encoding: 'utf-8' });

console.log(`CQT parity report generated at: ${outputPath}`);
if (expectedOverrides && !workbookDerivedOverrides) {
    console.log(`CQT parity overrides loaded from: ${overridesPath}`);
}

if (isCheckMode && !isCqtParitySuiteComplete(suite)) {
    console.error('CQT parity check failed: suite is not complete (failed/partial/missing detected).');
    process.exit(1);
}
