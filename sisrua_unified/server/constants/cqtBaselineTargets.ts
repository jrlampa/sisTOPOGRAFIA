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
    // proj2 scenario: GERAL PROJ2 formula uses 127*QT_MTTR3 (DB!K26).
    // K26 = QT_MT + (DEM_ATUAL/TR_PROJ2)*Z% = 0.0183 + (101.956/75)*0.035 = 0.065879...
    // ESQ/DIR PROJ2 RAMAL rows: M=15, TRECHO=0 -> cable_drop + 127*QT_MTTR3; P31=P32
    geralProj2: {
        p31CqtNoPonto: 118.38572483277098,
        p32CqtNoPonto: 118.38572483277098
    },
    db: {
        k6TrAtual: 225,
        k7DemAtual: 101.95599999999999,
        k8QtTr: 0.015859822222222222,
        k10QtMttr: 0.03415982222222222,
        // Proj-specific QT_MTTR values: PROJ1 uses DB!K19, PROJ2 uses DB!K26
        k19QtMttr2: 0.04068929777777778,
        k26QtMttr3: 0.06587946666666666
    }
} as const;
