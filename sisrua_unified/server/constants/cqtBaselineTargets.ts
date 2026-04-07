export const CQT_BASELINE_TARGETS = {
    workbook: 'CQTsimplificado_BECO DO MATA 7 - PARIDADE_FINAL.xlsx',
    tolerance: 1e-9,
    ramal: {
        aa30Dmdi: 2.84,
        ab35LookupDmdi: 2.84
    },
    geralAtual: {
        p31CqtNoPonto: 118.69775108855391,
        p32CqtNoPonto: 117.04688712724072
    },
    geralProj1: {
        p31CqtNoPonto: 120.83736598928087,
        p32CqtNoPonto: 120.72752247511889
    },
    // proj2 scenario: branches not yet configured in workbook; QT_MTTR3=#VALUE! -> IFERROR->0 -> QT%=0 -> V=127V nominal
    geralProj2: {
        p31CqtNoPonto: 127,
        p32CqtNoPonto: 127
    },
    db: {
        k6TrAtual: 225,
        k7DemAtual: 101.95599999999999,
        k8QtTr: 0.015859822222222222,
        k10QtMttr: 0.03415982222222222
    }
} as const;
