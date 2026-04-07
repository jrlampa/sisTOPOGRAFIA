import { CQT_BASELINE_TARGETS } from '../../constants/cqtBaselineTargets';
import { CqtScenario, CqtSnapshotComparable } from '../../services/cqtParityReportService';

export const CQT_PARITY_WORKBOOK_FIXTURE: Record<CqtScenario, CqtSnapshotComparable> = {
    atual: {
        dmdi: { dmdi: CQT_BASELINE_TARGETS.ramal.aa30Dmdi },
        geral: {
            p31CqtNoPonto: CQT_BASELINE_TARGETS.geralAtual.p31CqtNoPonto,
            p32CqtNoPonto: CQT_BASELINE_TARGETS.geralAtual.p32CqtNoPonto
        },
        db: {
            k6TrAtual: CQT_BASELINE_TARGETS.db.k6TrAtual,
            k7DemAtual: CQT_BASELINE_TARGETS.db.k7DemAtual,
            k8QtTr: CQT_BASELINE_TARGETS.db.k8QtTr,
            k10QtMttr: CQT_BASELINE_TARGETS.db.k10QtMttr
        }
    },
    proj1: {
        geral: {
            p31CqtNoPonto: CQT_BASELINE_TARGETS.geralProj1.p31CqtNoPonto,
            p32CqtNoPonto: CQT_BASELINE_TARGETS.geralProj1.p32CqtNoPonto
        }
    },
    proj2: {
        geral: {
            p31CqtNoPonto: CQT_BASELINE_TARGETS.geralProj2.p31CqtNoPonto,
            p32CqtNoPonto: CQT_BASELINE_TARGETS.geralProj2.p32CqtNoPonto
        }
    }
};
