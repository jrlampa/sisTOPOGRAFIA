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
    errorByCell?: Record<string, string | undefined>;
}

export type CqtCellState = 'value' | 'error';

export interface CqtCellDiff {
    cell: string;
    expectedState: CqtCellState;
    actualState: CqtCellState;
    expectedValue?: number;
    actualValue?: number;
    expectedError?: string;
    actualError?: string;
    absDiff?: number;
    withinTolerance: boolean;
    lineage: string[];
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

export interface CqtCellExpectation {
    value?: number | null;
    error?: string | null;
}

export type CqtExpectedCellOverride = number | null | CqtCellExpectation;

export type CqtExpectedByScenario =
    Partial<Record<CqtScenario, Partial<Record<string, CqtExpectedCellOverride>>>>;

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

const defaultValueExpectation = (value: number): CqtCellExpectation => ({ value });

const CELL_LINEAGE_MAP: Record<string, string[]> = {
    'RAMAL!AA30': [
        'RAMAL!AA24',
        'RAMAL!X18:X77',
        'GERAL!I2',
        'DB/lookup reference inputs'
    ],
    'GERAL!P31': [
        'GERAL!O31',
        'GERAL!C (PONTO)',
        'ESQ ATUAL table',
        'DB!K10 (QT_MTTR)'
    ],
    'GERAL!P32': [
        'GERAL!O32',
        'GERAL!C (PONTO)',
        'DIR ATUAL table',
        'DB!K10 (QT_MTTR)'
    ],
    'GERAL PROJ!P31': [
        'GERAL PROJ!O31',
        'GERAL PROJ!C (PONTO)',
        'ESQ PROJ1 table',
        'DB!K19 (QT_MTTR2)'
    ],
    'GERAL PROJ!P32': [
        'GERAL PROJ!O32',
        'GERAL PROJ!C (PONTO)',
        'DIR PROJ1 table',
        'DB!K19 (QT_MTTR2)'
    ],
    'GERAL PROJ2!P31': [
        'GERAL PROJ2!O31',
        'GERAL PROJ2!C (PONTO)',
        'ESQ PROJ2 table',
        'DB!K26 (QT_MTTR3)'
    ],
    'GERAL PROJ2!P32': [
        'GERAL PROJ2!O32',
        'GERAL PROJ2!C (PONTO)',
        'DIR PROJ2 table',
        'DB!K26 (QT_MTTR3)'
    ],
    'DB!K6': ['DB!K6 direct input (TR_ATUAL)'],
    'DB!K7': ['DB!K7 direct input (DEM_ATUAL)'],
    'DB!K8': ['DB!K7', 'DB!K6', 'TRAFOS_Z lookup'],
    'DB!K10': ['DB!K8', 'QT_MT base']
};

const DEFAULT_EXPECTED_BY_SCENARIO: Record<CqtScenario, Partial<Record<string, CqtCellExpectation>>> = {
    atual: {
        'RAMAL!AA30': defaultValueExpectation(CQT_BASELINE_TARGETS.ramal.aa30Dmdi),
        'GERAL!P31': defaultValueExpectation(CQT_BASELINE_TARGETS.geralAtual.p31CqtNoPonto),
        'GERAL!P32': defaultValueExpectation(CQT_BASELINE_TARGETS.geralAtual.p32CqtNoPonto),
        'DB!K6': defaultValueExpectation(CQT_BASELINE_TARGETS.db.k6TrAtual),
        'DB!K7': defaultValueExpectation(CQT_BASELINE_TARGETS.db.k7DemAtual),
        'DB!K8': defaultValueExpectation(CQT_BASELINE_TARGETS.db.k8QtTr),
        'DB!K10': defaultValueExpectation(CQT_BASELINE_TARGETS.db.k10QtMttr)
    },
    proj1: {
        'GERAL PROJ!P31': defaultValueExpectation(CQT_BASELINE_TARGETS.geralProj1.p31CqtNoPonto),
        'GERAL PROJ!P32': defaultValueExpectation(CQT_BASELINE_TARGETS.geralProj1.p32CqtNoPonto)
    },
    proj2: {
        'GERAL PROJ2!P31': defaultValueExpectation(CQT_BASELINE_TARGETS.geralProj2.p31CqtNoPonto),
        'GERAL PROJ2!P32': defaultValueExpectation(CQT_BASELINE_TARGETS.geralProj2.p32CqtNoPonto)
    }
};

const normalizeExpectedCell = (entry: CqtExpectedCellOverride): CqtCellExpectation => {
    if (typeof entry === 'number') {
        return { value: entry };
    }

    if (entry === null) {
        return { value: null };
    }

    return {
        value: entry.value,
        error: entry.error
    };
};

const mergeExpectedByScenario = (
    overrides?: CqtExpectedByScenario
): Record<CqtScenario, Partial<Record<string, CqtCellExpectation>>> => {
    if (!overrides) {
        return DEFAULT_EXPECTED_BY_SCENARIO;
    }

    const normalizeScenario = (
        base: Partial<Record<string, CqtCellExpectation>>,
        incoming?: Partial<Record<string, CqtExpectedCellOverride>>
    ): Partial<Record<string, CqtCellExpectation>> => {
        const normalizedIncoming: Partial<Record<string, CqtCellExpectation>> = {};
        if (incoming) {
            for (const [cell, value] of Object.entries(incoming)) {
                normalizedIncoming[cell] = normalizeExpectedCell(value);
            }
        }

        return {
            ...base,
            ...normalizedIncoming
        };
    };

    return {
        atual: normalizeScenario(DEFAULT_EXPECTED_BY_SCENARIO.atual, overrides.atual),
        proj1: normalizeScenario(DEFAULT_EXPECTED_BY_SCENARIO.proj1, overrides.proj1),
        proj2: normalizeScenario(DEFAULT_EXPECTED_BY_SCENARIO.proj2, overrides.proj2)
    };
};

export const getDefaultCqtExpectedByScenario = (): Record<CqtScenario, Partial<Record<string, CqtCellExpectation>>> => ({
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
        const expectedValue = expected.value;
        const expectedError = expected.error;
        if (expectedValue === null || expectedError === null) {
            pending.push(cell);
            continue;
        }

        const getter = ACTUAL_GETTERS[cell];
        if (!getter) {
            skipped.push(cell);
            continue;
        }

        const lineage = CELL_LINEAGE_MAP[cell] ?? ['lineage-not-mapped'];

        if (typeof expectedError === 'string' && expectedError.length > 0) {
            const actualError = snapshot.errorByCell?.[cell];
            if (!actualError) {
                skipped.push(cell);
                continue;
            }

            diffs.push({
                cell,
                expectedState: 'error',
                actualState: 'error',
                expectedError,
                actualError,
                withinTolerance: actualError === expectedError,
                lineage
            });
            continue;
        }

        const actual = getter(snapshot);
        if (typeof actual !== 'number' || !Number.isFinite(actual)) {
            skipped.push(cell);
            continue;
        }

        if (typeof expectedValue !== 'number' || !Number.isFinite(expectedValue)) {
            skipped.push(cell);
            continue;
        }

        const absDiff = Math.abs(actual - expectedValue);
        diffs.push({
            cell,
            expectedState: 'value',
            actualState: 'value',
            expectedValue,
            actualValue: actual,
            absDiff,
            withinTolerance: absDiff <= tolerance,
            lineage
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
            lines.push('| Cell | State | Expected | Actual | Abs Diff | Within Tolerance |');
            lines.push('| --- | :---: | --- | --- | ---: | :---: |');
            for (const diff of report.diffs) {
                const expected = diff.expectedState === 'error'
                    ? `ERR:${diff.expectedError ?? 'unknown'}`
                    : `${diff.expectedValue}`;
                const actual = diff.actualState === 'error'
                    ? `ERR:${diff.actualError ?? 'unknown'}`
                    : `${diff.actualValue}`;
                const absDiff = typeof diff.absDiff === 'number' ? `${diff.absDiff}` : '-';
                lines.push(
                    `| ${diff.cell} | ${diff.expectedState} | ${expected} | ${actual} | ${absDiff} | ${diff.withinTolerance ? 'YES' : 'NO'} |`
                );
            }
            lines.push('');

            lines.push('Critical lineage:');
            for (const diff of report.diffs) {
                lines.push(`- ${diff.cell}: ${diff.lineage.join(' -> ')}`);
            }
            lines.push('');
        }
    }

    return lines.join('\n').trimEnd() + '\n';
};
