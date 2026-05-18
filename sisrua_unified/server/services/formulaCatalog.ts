import { FormulaDefinition, computeDefinitionHash } from "./formulaVersioningService.js";

export const INITIAL_CATALOG: FormulaDefinition[] = [
  {
    id: "QT_SEGMENTO_BT",
    category: "bt_radial",
    activeVersion: "2.0.0",
    versions: [
      {
        id: "QT_SEGMENTO_BT-1.0.0",
        formulaId: "QT_SEGMENTO_BT",
        version: "1.0.0",
        status: "deprecated",
        name: "Queda de Tensão por Segmento BT",
        description:
          "Versão original — sem distinção de fator de fase para MONO vs BIF/TRI.",
        expression:
          "QT = (P_kVA × Z_Ω_km × L_m) / V_phase_V²",
        constants: {
          V_phase_V: 127,
          Z_unit: "Ω/km",
          L_unit: "m",
        },
        standardReference: "ABNT NBR 5410 §6.5",
        effectiveDate: "2025-01-01",
        deprecatedDate: "2026-05-01",
        definitionHash: computeDefinitionHash(
          "QT = (P_kVA × Z_Ω_km × L_m) / V_phase_V²",
          { V_phase_V: 127, Z_unit: "Ω/km", L_unit: "m" },
        ),
        changeReason: "Introduzido fator de fase MONO/BIF/TRI na v2.0.0.",
      },
      {
        id: "QT_SEGMENTO_BT-2.0.0",
        formulaId: "QT_SEGMENTO_BT",
        version: "2.0.0",
        status: "active",
        name: "Queda de Tensão por Segmento BT (com fator de fase)",
        description:
          "Fórmula conforme ANEEL PRODIST Módulo 8. Fator φ=2 para MONO (circuito ida+volta), φ=1 para BIF/TRI.",
        expression:
          "QT_trecho = φ × P_kVA × Z_Ω_km × L_m / V_phase_V²\n" +
          "onde φ = 2 (MONO) | 1 (BIF, TRI)",
        constants: {
          V_phase_V: 127,
          phi_MONO: 2,
          phi_BIF: 1,
          phi_TRI: 1,
          Z_unit: "Ω/km",
          L_unit: "m",
        },
        standardReference: "ANEEL PRODIST Módulo 8, §4.2 + ABNT NBR 5410 §6.5",
        effectiveDate: "2026-05-01",
        definitionHash: computeDefinitionHash(
          "QT_trecho = φ × P_kVA × Z_Ω_km × L_m / V_phase_V²",
          { V_phase_V: 127, phi_MONO: 2, phi_BIF: 1, phi_TRI: 1 },
        ),
        changeReason:
          "Auditoria técnica BT (2026-05-05): incluído fator φ para rede monofásica.",
      },
    ],
  },
  {
    id: "RESISTENCIA_CORRIGIDA",
    category: "conductor",
    activeVersion: "1.0.0",
    versions: [
      {
        id: "RESISTENCIA_CORRIGIDA-1.0.0",
        formulaId: "RESISTENCIA_CORRIGIDA",
        version: "1.0.0",
        status: "active",
        name: "Resistência Elétrica Corrigida por Temperatura",
        description:
          "Correção da resistência nominal do condutor para a temperatura de operação, " +
          "conforme tabela ABNT NBR 7285 e coeficiente de temperatura do alumínio/cobre.",
        expression:
          "R_corr = (R_nom / divisorR) × [1 + α × (T_op − 20)]",
        constants: {
          alpha_Al: 0.00403,
          alpha_Cu: 0.00393,
          T_ref_C: 20,
          T_default_C: 75,
          divisorR_Al_XLPE: 1.2821,
          divisorR_Cu_XLPE: 1.2751,
          divisorR_Al_PVC: 1.2015,
        },
        standardReference:
          "ABNT NBR 7285 + IEC 60228, coeficiente α conforme PRODIST §8.3",
        effectiveDate: "2025-01-01",
        definitionHash: computeDefinitionHash(
          "R_corr = (R_nom / divisorR) × [1 + α × (T_op − 20)]",
          {
            alpha_Al: 0.00403,
            alpha_Cu: 0.00393,
            T_ref_C: 20,
            T_default_C: 75,
          },
        ),
      },
    ],
  },
  {
    id: "LIMITE_CQT_ANEEL",
    category: "cqt",
    activeVersion: "2.0.0",
    versions: [
      {
        id: "LIMITE_CQT_ANEEL-1.0.0",
        formulaId: "LIMITE_CQT_ANEEL",
        version: "1.0.0",
        status: "deprecated",
        name: "Limite de Queda de Tensão ANEEL (valor incorreto)",
        description:
          "Versão com threshold de 50% — erro de implementação detectado em auditoria.",
        expression: "CQT_HIGH se qtTotal > 0.50",
        constants: { limite_percentual: 50 },
        standardReference: "—",
        effectiveDate: "2025-01-01",
        deprecatedDate: "2026-05-05",
        definitionHash: computeDefinitionHash("CQT_HIGH se qtTotal > 0.50", {
          limite_percentual: 50,
        }),
        changeReason:
          "Auditoria técnica (2026-05-05): limite incorreto. ANEEL PRODIST Módulo 8 define 8%.",
      },
      {
        id: "LIMITE_CQT_ANEEL-2.0.0",
        formulaId: "LIMITE_CQT_ANEEL",
        version: "2.0.0",
        status: "active",
        name: "Limite de Queda de Tensão ANEEL (PRODIST Módulo 8)",
        description:
          "Limite regulatório ANEEL de 8% (urgente) para queda de tensão acumulada em BT.",
        expression: "CQT_HIGH se qtTotal > ANEEL_CQT_LIMIT (0.08 = 8%)",
        constants: {
          ANEEL_CQT_LIMIT: 0.08,
          limite_percentual: 8,
        },
        standardReference:
          "ANEEL PRODIST Módulo 8, §6.1 — Limite Urgente de QT em BT",
        effectiveDate: "2026-05-05",
        definitionHash: computeDefinitionHash(
          "CQT_HIGH se qtTotal > ANEEL_CQT_LIMIT (0.08 = 8%)",
          { ANEEL_CQT_LIMIT: 0.08, limite_percentual: 8 },
        ),
        changeReason:
          "Corrigido para 8% conforme ANEEL PRODIST Módulo 8 — auditoria técnica BT (2026-05-05).",
      },
    ],
  },
  {
    id: "TENSAO_PISO_OPERACIONAL",
    category: "bt_radial",
    activeVersion: "2.0.0",
    versions: [
      {
        id: "TENSAO_PISO_OPERACIONAL-1.0.0",
        formulaId: "TENSAO_PISO_OPERACIONAL",
        version: "1.0.0",
        status: "deprecated",
        name: "Tensão Mínima BT (teórica)",
        description:
          "Tensão de piso calculada como 127 × (1 − 0.08) = 116,84 V. Valor teórico sem arredondamento operacional.",
        expression: "V_min = V_phase × (1 − CQT_limit) = 127 × 0,92 = 116,84 V",
        constants: {
          V_phase_V: 127,
          CQT_limit: 0.08,
          V_min_V: 116.84,
        },
        standardReference: "ANEEL PRODIST Módulo 8",
        effectiveDate: "2025-01-01",
        deprecatedDate: "2026-05-05",
        definitionHash: computeDefinitionHash(
          "V_min = V_phase × (1 − CQT_limit) = 127 × 0,92 = 116,84 V",
          { V_phase_V: 127, CQT_limit: 0.08, V_min_V: 116.84 },
        ),
        changeReason: "Ajustado para prática operacional Light S.A.: 117 V.",
      },
      {
        id: "TENSAO_PISO_OPERACIONAL-2.0.0",
        formulaId: "TENSAO_PISO_OPERACIONAL",
        version: "2.0.0",
        status: "active",
        name: "Tensão Mínima BT (prática operacional Light S.A.)",
        description:
          "Tensão de piso de 117 V conforme prática operacional da Light S.A. " +
          "Arredondamento conservador acima do teórico 116,84 V.",
        expression: "V_min = 117 V (piso operacional)",
        constants: {
          V_min_V: 117,
          V_phase_V: 127,
          margem_V: 0.16,
        },
        standardReference:
          "Light S.A. — Norma Operacional BT + ANEEL PRODIST Módulo 8 (base)",
        effectiveDate: "2026-05-05",
        definitionHash: computeDefinitionHash(
          "V_min = 117 V (piso operacional)",
          { V_min_V: 117, V_phase_V: 127, margem_V: 0.16 },
        ),
        changeReason:
          "Alinhado à prática Light S.A.: 117 V ao invés de 116,84 V calculado.",
      },
    ],
  },
  {
    id: "K8_QT_MT_TRAFO",
    category: "transformer",
    activeVersion: "1.0.0",
    versions: [
      {
        id: "K8_QT_MT_TRAFO-1.0.0",
        formulaId: "K8_QT_MT_TRAFO",
        version: "1.0.0",
        status: "active",
        name: "QT no Trafo — Contribuição MT (K8)",
        description:
          "Queda de tensão na parcela MT + trafo, indicador K8 do workbook CQT Light.",
        expression:
          "K8 = (DEM_kVA / TR_kVA) × zFactor\n" +
          "onde zFactor = impedância relativa do trafo (padrão 3,5%)",
        constants: {
          zFactor_default: 0.035,
          QT_MT_fraction: 0.0183,
        },
        standardReference:
          "Workbook CQT Light S.A. — Planilha K8, coluna H1",
        effectiveDate: "2025-01-01",
        definitionHash: computeDefinitionHash(
          "K8 = (DEM_kVA / TR_kVA) × zFactor",
          { zFactor_default: 0.035, QT_MT_fraction: 0.0183 },
        ),
      },
    ],
  },
];
