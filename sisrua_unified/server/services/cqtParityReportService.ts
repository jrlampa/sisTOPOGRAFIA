import { CQT_BASELINE_TARGETS } from '../constants/cqtBaselineTargets.js';

export type CqtScenario = 'atual' | 'proj1' | 'proj2';

export interface CqtSnapshotComparable {
    dmdi?: { dmdi?: number };
    geral?: { p31CqtNoPonto?: number; p32CqtNoPonto?: number };
    db?: {
        k6TrAtual?: number;
        k7DemAtual?: number;
        k8QtTr?: number;
        k10QtMttr?: number;
    };
}

export interface CqtCellDiff {
    cell: string;
    expected: number;
    actual: number;
    absDiff: number;
    withinTolerance: boolean;
}

export interface CqtScenarioParityReport {
    scenario: CqtScenario;
    referenceCells: number;
    referenceStatus: 'complete' | 'partial' | 'missing';
    pending: string[];
    compared: number;
    passed: number;
    failed: number;
    skipped: string[];
    diffs: CqtCellDiff[];
}

export interface CqtParityReportSuite {
    reports: CqtScenarioParityReport[];
    totals: {
        scenarios: number;
        complete: number;
        partial: number;
        missing: number;
        compared: number;
        passed: number;
        failed: number;
    };
}

export type CqtExpectedByScenario = Partial<Record<CqtScenario, Partial<Record<string, number | null>>>>;

export const isCqtParitySuiteComplete = (suite: CqtParityReportSuite): boolean => {
    if (suite.totals.failed > 0) {
        return false;
    }

    if (suite.totals.partial > 0 || suite.totals.missing > 0) {
        return false;
    }

    return true;
};

const CQT_SCENARIOS: CqtScenario[] = ['atual', 'proj1', 'proj2'];

const DEFAULT_EXPECTED_BY_SCENARIO: Record<CqtScenario, Partial<Record<string, number | null>>> = {
    atual: {
        'RAMAL!AA30': CQT_BASELINE_TARGETS.ramal.aa30Dmdi,
        'GERAL!P31': CQT_BASELINE_TARGETS.geralAtual.p31CqtNoPonto,
        'GERAL!P32': CQT_BASELINE_TARGETS.geralAtual.p32CqtNoPonto,
        'DB!K6': CQT_BASELINE_TARGETS.db.k6TrAtual,
        'DB!K7': CQT_BASELINE_TARGETS.db.k7DemAtual,
        'DB!K8': CQT_BASELINE_TARGETS.db.k8QtTr,
        'DB!K10': CQT_BASELINE_TARGETS.db.k10QtMttr
    },
    proj1: {
        'GERAL PROJ!P31': CQT_BASELINE_TARGETS.geralProj1.p31CqtNoPonto,
        'GERAL PROJ!P32': CQT_BASELINE_TARGETS.geralProj1.p32CqtNoPonto
    },
    proj2: {
        // Workbook state: branches empty, QT_MTTR3=#VALUE! -> IFERROR->0 -> QT%=0 -> 127V nominal (no drop)
        'GERAL PROJ2!P31': CQT_BASELINE_TARGETS.geralProj2.p31CqtNoPonto,
        'GERAL PROJ2!P32': CQT_BASELINE_TARGETS.geralProj2.p32CqtNoPonto
    }
};

const mergeExpectedByScenario = (
    overrides?: CqtExpectedByScenario
): Record<CqtScenario, Partial<Record<string, number | null>>> => {
    if (!overrides) {
        return DEFAULT_EXPECTED_BY_SCENARIO;
    }

    return {
        atual: {
            ...DEFAULT_EXPECTED_BY_SCENARIO.atual,
            ...(overrides.atual ?? {})
        },
        proj1: {
            ...DEFAULT_EXPECTED_BY_SCENARIO.proj1,
            ...(overrides.proj1 ?? {})
        },
        proj2: {
            ...DEFAULT_EXPECTED_BY_SCENARIO.proj2,
            ...(overrides.proj2 ?? {})
        }
    };
};

export const getDefaultCqtExpectedByScenario = (): Record<CqtScenario, Partial<Record<string, number | null>>> => ({
    atual: { ...DEFAULT_EXPECTED_BY_SCENARIO.atual },
    proj1: { ...DEFAULT_EXPECTED_BY_SCENARIO.proj1 },
    proj2: { ...DEFAULT_EXPECTED_BY_SCENARIO.proj2 }
});

const ACTUAL_GETTERS: Record<string, (snapshot: CqtSnapshotComparable) => number | undefined> = {
    'RAMAL!AA30': (snapshot) => snapshot.dmdi?.dmdi,
    'GERAL!P31': (snapshot) => snapshot.geral?.p31CqtNoPonto,
    'GERAL!P32': (snapshot) => snapshot.geral?.p32CqtNoPonto,
    'GERAL PROJ!P31': (snapshot) => snapshot.geral?.p31CqtNoPonto,
    'GERAL PROJ!P32': (snapshot) => snapshot.geral?.p32CqtNoPonto,
    'GERAL PROJ2!P31': (snapshot) => snapshot.geral?.p31CqtNoPonto,
    'GERAL PROJ2!P32': (snapshot) => snapshot.geral?.p32CqtNoPonto,
    'DB!K6': (snapshot) => snapshot.db?.k6TrAtual,
    'DB!K7': (snapshot) => snapshot.db?.k7DemAtual,
    'DB!K8': (snapshot) => snapshot.db?.k8QtTr,
    'DB!K10': (snapshot) => snapshot.db?.k10QtMttr
};

export const buildCqtParityReport = (
    scenario: CqtScenario,
    snapshot: CqtSnapshotComparable,
    tolerance = CQT_BASELINE_TARGETS.tolerance,
    expectedOverrides?: CqtExpectedByScenario
): CqtScenarioParityReport => {
    const expectedByScenario = mergeExpectedByScenario(expectedOverrides);
    const expectedCells = expectedByScenario[scenario];
    const referenceCells = Object.keys(expectedCells).length;
    const diffs: CqtCellDiff[] = [];
    const skipped: string[] = [];
    const pending: string[] = [];

    for (const [cell, expected] of Object.entries(expectedCells)) {
        if (expected === null) {
            pending.push(cell);
            continue;
        }

        const getter = ACTUAL_GETTERS[cell];
        if (!getter) {
            skipped.push(cell);
            continue;
        }

        const actual = getter(snapshot);
        if (typeof actual !== 'number' || !Number.isFinite(actual)) {
            skipped.push(cell);
            continue;
        }

        const absDiff = Math.abs(actual - expected);
        diffs.push({
            cell,
            expected,
            actual,
            absDiff,
            withinTolerance: absDiff <= tolerance
        });
    }

    const passed = diffs.filter((item) => item.withinTolerance).length;
    const failed = diffs.length - passed;
    const referenceStatus: 'complete' | 'partial' | 'missing' =
        referenceCells === 0
            ? 'missing'
            : (pending.length > 0 || skipped.length > 0)
                ? 'partial'
                : 'complete';

    return {
        scenario,
        referenceCells,
        referenceStatus,
        pending,
        compared: diffs.length,
        passed,
        failed,
        skipped,
        diffs
    };
};

export const buildCqtParityReportSuite = (
    snapshotsByScenario: Partial<Record<CqtScenario, CqtSnapshotComparable>>,
    tolerance = CQT_BASELINE_TARGETS.tolerance,
    expectedOverrides?: CqtExpectedByScenario
): CqtParityReportSuite => {
    const reports = CQT_SCENARIOS.map((scenario) =>
        buildCqtParityReport(scenario, snapshotsByScenario[scenario] ?? {}, tolerance, expectedOverrides)
    );

    const totals = reports.reduce(
        (acc, report) => {
            acc.scenarios += 1;
            acc.compared += report.compared;
            acc.passed += report.passed;
            acc.failed += report.failed;

            if (report.referenceStatus === 'complete') {
                acc.complete += 1;
            } else if (report.referenceStatus === 'partial') {
                acc.partial += 1;
            } else {
                acc.missing += 1;
            }

            return acc;
        },
        {
            scenarios: 0,
            complete: 0,
            partial: 0,
            missing: 0,
            compared: 0,
            passed: 0,
            failed: 0
        }
    );

    return {
        reports,
        totals
    };
};

export const renderCqtParityReportMarkdown = (suite: CqtParityReportSuite): string => {
    const lines: string[] = [
        '# CQT Parity Report',
        '',
        '## Summary',
        '',
        '| Metric | Value |',
        '| --- | ---: |',
        `| Scenarios | ${suite.totals.scenarios} |`,
        `| Complete | ${suite.totals.complete} |`,
        `| Partial | ${suite.totals.partial} |`,
        `| Missing | ${suite.totals.missing} |`,
        `| Compared Cells | ${suite.totals.compared} |`,
        `| Passed Cells | ${suite.totals.passed} |`,
        `| Failed Cells | ${suite.totals.failed} |`,
        ''
    ];

    for (const report of suite.reports) {
        lines.push(`## Scenario: ${report.scenario}`);
        lines.push('');
        lines.push(`- Reference status: ${report.referenceStatus}`);
        lines.push(`- Reference cells: ${report.referenceCells}`);
        lines.push(`- Compared: ${report.compared}`);
        lines.push(`- Passed: ${report.passed}`);
        lines.push(`- Failed: ${report.failed}`);
        lines.push('');

        if (report.pending.length > 0) {
            lines.push('Pending expected values:');
            for (const cell of report.pending) {
                lines.push(`- ${cell}`);
            }
            lines.push('');
        }

        if (report.skipped.length > 0) {
            lines.push('Skipped cells:');
            for (const cell of report.skipped) {
                lines.push(`- ${cell}`);
            }
            lines.push('');
        }

        if (report.diffs.length > 0) {
            lines.push('| Cell | Expected | Actual | Abs Diff | Within Tolerance |');
            lines.push('| --- | ---: | ---: | ---: | :---: |');
            for (const diff of report.diffs) {
                lines.push(
                    `| ${diff.cell} | ${diff.expected} | ${diff.actual} | ${diff.absDiff} | ${diff.withinTolerance ? 'YES' : 'NO'} |`
                );
            }
            lines.push('');
        }
    }

    return lines.join('\n').trimEnd() + '\n';
};
