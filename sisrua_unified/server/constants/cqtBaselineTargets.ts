// Canonical workbook is in Light_estudo/ (see Light_estudo/README.md).
// Legacy root-level copy is the fallback for backward compatibility.
export const CQT_BASELINE_TARGETS = {
    workbook: 'Light_estudo/CQTsimplificado_BECO DO MATA 7 - PARIDADE_FINAL.xlsx',
    workbookLegacyFallback: 'CQTsimplificado_BECO DO MATA 7 - PARIDADE_FINAL.xlsx',
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

/**
 * Baseline targets for the REV0 workbook:
 *   CQTsimplificado_REV0 - Copia - Copia.xlsx
 *
 * This workbook applies the same DB parameters (transformer 225 kVA, Z%=3.5%,
 * DEM_ATUAL=101.956 kVA) as the BECO DO MATA 7 reference workbook, so the
 * derived DB indicators (K6/K7/K8/K10) and global QT_MTTR are identical.
 * The file is placed in Light_estudo/ following the same convention and is
 * discovered automatically by the audit script when present.
 */
export const CQT_REV0_BASELINE_TARGETS = {
    workbook: 'Light_estudo/CQTsimplificado_REV0 - Copia - Copia.xlsx',
    workbookLegacyFallback: 'CQTsimplificado_REV0 - Copia - Copia.xlsx',
    tolerance: 1e-9,
    db: {
        // DB!K6: TR_ATUAL — same transformer in both workbooks (225 kVA)
        k6TrAtual: 225,
        // DB!K7: DEM_ATUAL — same feeder demand (101.956 kVA)
        k7DemAtual: 101.95599999999999,
        // DB!K8: QT_TR = (DEM_ATUAL / TR_ATUAL) * Z% = (101.956/225)*0.035
        k8QtTr: 0.015859822222222222,
        // DB!K10: QT_MTTR = QT_MT + QT_TR = 0.0183 + 0.015859822...
        k10QtMttr: 0.03415982222222222,
        // QT_MT = QT_MTTR - QT_TR (base MT line drop, same as BECO DO MATA 7)
        qtMt: 0.0183,
        // Transformer impedance factor (Z%)
        zPercent: 0.035
    }
} as const;
