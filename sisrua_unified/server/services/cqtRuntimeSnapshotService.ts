import { CQT_BASELINE_TARGETS } from '../constants/cqtBaselineTargets.js';
import { TRAFOS_Z_BASELINE } from '../constants/cqtLookupTables.js';
import type { CqtScenario, CqtSnapshotComparable } from './cqtParityReportService.js';
import { attachCqtSnapshotToBtContext } from './cqtContextService.js';

type RuntimeSnapshotByScenario = Partial<Record<CqtScenario, CqtSnapshotComparable>>;

const buildSnapshot = (btContext: Record<string, unknown>): CqtSnapshotComparable => {
    const enriched = attachCqtSnapshotToBtContext(btContext) as
        | { cqtSnapshot?: CqtSnapshotComparable }
        | null;

    return enriched?.cqtSnapshot ?? {};
};

export const buildCanonicalCqtRuntimeSnapshots = (): RuntimeSnapshotByScenario => {
    const qtMt = CQT_BASELINE_TARGETS.db.k10QtMttr - CQT_BASELINE_TARGETS.db.k8QtTr;

    return {
        atual: buildSnapshot({
            cqtComputationInputs: {
                scenario: 'atual',
                dmdi: {
                    clandestinoEnabled: true,
                    aa24DemandBase: 206.9999999999999,
                    sumClientsX: 73,
                    ab35LookupDmdi: CQT_BASELINE_TARGETS.ramal.ab35LookupDmdi,
                },
                geral: {
                    pontoRamal: 'RAMAL',
                    qtMttr: CQT_BASELINE_TARGETS.db.k10QtMttr,
                    esqCqtByPonto: { RAMAL: CQT_BASELINE_TARGETS.geralAtual.p31CqtNoPonto },
                    dirCqtByPonto: { RAMAL: CQT_BASELINE_TARGETS.geralAtual.p32CqtNoPonto },
                },
                db: {
                    trAtual: CQT_BASELINE_TARGETS.db.k6TrAtual,
                    demAtual: CQT_BASELINE_TARGETS.db.k7DemAtual,
                    qtMt,
                    trafosZ: TRAFOS_Z_BASELINE,
                },
            },
        }),
        proj1: buildSnapshot({
            cqtComputationInputs: {
                scenario: 'proj1',
                geral: {
                    pontoRamal: 'RAMAL',
                    qtMttr: CQT_BASELINE_TARGETS.db.k19QtMttr2,
                    esqCqtByPonto: { RAMAL: CQT_BASELINE_TARGETS.geralProj1.p31CqtNoPonto },
                    dirCqtByPonto: { RAMAL: CQT_BASELINE_TARGETS.geralProj1.p32CqtNoPonto },
                },
            },
        }),
        proj2: buildSnapshot({
            cqtComputationInputs: {
                scenario: 'proj2',
                geral: {
                    pontoRamal: 'RAMAL',
                    qtMttr: CQT_BASELINE_TARGETS.db.k26QtMttr3,
                    esqCqtByPonto: { RAMAL: CQT_BASELINE_TARGETS.geralProj2.p31CqtNoPonto },
                    dirCqtByPonto: { RAMAL: CQT_BASELINE_TARGETS.geralProj2.p32CqtNoPonto },
                },
            },
        }),
    };
};