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

const CQT_SCENARIOS: CqtScenario[] = ['atual', 'proj1', 'proj2'];

const EXPECTED_BY_SCENARIO: Record<CqtScenario, Partial<Record<string, number>>> = {
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
    proj2: {}
};

const ACTUAL_GETTERS: Record<string, (snapshot: CqtSnapshotComparable) => number | undefined> = {
    'RAMAL!AA30': (snapshot) => snapshot.dmdi?.dmdi,
    'GERAL!P31': (snapshot) => snapshot.geral?.p31CqtNoPonto,
    'GERAL!P32': (snapshot) => snapshot.geral?.p32CqtNoPonto,
    'GERAL PROJ!P31': (snapshot) => snapshot.geral?.p31CqtNoPonto,
    'GERAL PROJ!P32': (snapshot) => snapshot.geral?.p32CqtNoPonto,
    'DB!K6': (snapshot) => snapshot.db?.k6TrAtual,
    'DB!K7': (snapshot) => snapshot.db?.k7DemAtual,
    'DB!K8': (snapshot) => snapshot.db?.k8QtTr,
    'DB!K10': (snapshot) => snapshot.db?.k10QtMttr
};

export const buildCqtParityReport = (
    scenario: CqtScenario,
    snapshot: CqtSnapshotComparable,
    tolerance = CQT_BASELINE_TARGETS.tolerance
): CqtScenarioParityReport => {
    const expectedCells = EXPECTED_BY_SCENARIO[scenario];
    const referenceCells = Object.keys(expectedCells).length;
    const diffs: CqtCellDiff[] = [];
    const skipped: string[] = [];

    for (const [cell, expected] of Object.entries(expectedCells)) {
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
            : skipped.length > 0
                ? 'partial'
                : 'complete';

    return {
        scenario,
        referenceCells,
        referenceStatus,
        compared: diffs.length,
        passed,
        failed,
        skipped,
        diffs
    };
};

export const buildCqtParityReportSuite = (
    snapshotsByScenario: Partial<Record<CqtScenario, CqtSnapshotComparable>>,
    tolerance = CQT_BASELINE_TARGETS.tolerance
): CqtParityReportSuite => {
    const reports = CQT_SCENARIOS.map((scenario) =>
        buildCqtParityReport(scenario, snapshotsByScenario[scenario] ?? {}, tolerance)
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
