/**
 * BDGD Validator Service (Item 53 – T1)
 *
 * Validação nativa de conformidade com o Banco de Dados Geográfico da
 * Distribuidora (BDGD) conforme PRODIST Módulo 2 e REN ANEEL 956/2021.
 *
 * Camadas suportadas: SEGBT, PONNOT, EQTRAT, RAMBT.
 *
 * Regras verificadas:
 *   R1 – Campos obrigatórios presentes e não nulos
 *   R2 – Comprimento máximo de campos string respeitado
 *   R3 – Códigos ANEEL válidos (FAS_CON, TIP_CONDUT, MAT_CONDU, etc.)
 *   R4 – Intervalos numéricos (COMP > 0, POT_NOM > 0, etc.)
 *   R5 – COD_ID único dentro da camada
 *   R6 – Presença de geometria (campo "geometry")
 */

import {
  BDGD_LAYER_DEFS,
  type BdgdFieldDef,
  type BdgdLayerDef,
} from "../constants/bdgdAneel.js";

// ─── Tipos de entrada ─────────────────────────────────────────────────────────

/** Registro individual de uma camada BDGD (chave → valor). */
export type BdgdRecord = Record<string, unknown>;

/** Conjunto de registros por camada para validação em lote. */
export interface BdgdValidationInput {
  /** Camada ANEEL (ex: "SEGBT") → lista de registros. */
  layers: Partial<Record<string, BdgdRecord[]>>;
}

// ─── Tipos de saída ───────────────────────────────────────────────────────────

export type BdgdRuleCode = "R1" | "R2" | "R3" | "R4" | "R5" | "R6";
export type BdgdIssueSeverity = "error" | "warning";

export interface BdgdIssue {
  rule: BdgdRuleCode;
  severity: BdgdIssueSeverity;
  field: string;
  recordIndex: number;
  /** COD_ID do registro, se disponível. */
  codId?: string;
  message: string;
}

export interface BdgdLayerReport {
  layer: string;
  description: string;
  totalRecords: number;
  validRecords: number;
  issues: BdgdIssue[];
  conformant: boolean;
}

export interface BdgdValidationReport {
  /** ISO timestamp de geração do relatório. */
  generatedAt: string;
  /** Versão da especificação ANEEL utilizada. */
  aneelSpec: string;
  layers: BdgdLayerReport[];
  totals: {
    layersChecked: number;
    layersConformant: number;
    totalRecords: number;
    totalIssues: number;
    errors: number;
    warnings: number;
  };
  conformant: boolean;
}

// ─── Helpers internos ─────────────────────────────────────────────────────────

function isPresent(value: unknown): boolean {
  return value !== undefined && value !== null && value !== "";
}

function getCodId(record: BdgdRecord): string | undefined {
  const v = record["COD_ID"];
  return typeof v === "string" ? v : undefined;
}

/** Valida um único registro contra os campos definidos da camada. */
function validateRecord(
  record: BdgdRecord,
  fields: BdgdFieldDef[],
  index: number,
): BdgdIssue[] {
  const issues: BdgdIssue[] = [];
  const codId = getCodId(record);

  for (const field of fields) {
    const value = record[field.name];
    const base = { field: field.name, recordIndex: index, codId };

    // R1 – obrigatório
    if (field.required && !isPresent(value)) {
      issues.push({
        ...base,
        rule: "R1",
        severity: "error",
        message: `Campo obrigatório "${field.name}" ausente ou nulo (registro ${index}).`,
      });
      continue; // sem dados, demais regras não aplicam
    }

    if (!isPresent(value)) continue;

    // R6 – geometria
    if (field.type === "coordinate") {
      const geo = value as Record<string, unknown> | null | undefined;
      const hasCoords =
        geo !== null &&
        typeof geo === "object" &&
        ("coordinates" in geo ||
          ("lat" in geo && "lon" in geo) ||
          ("latitude" in geo && "longitude" in geo));
      if (!hasCoords) {
        issues.push({
          ...base,
          rule: "R6",
          severity: "error",
          message: `Geometria inválida ou ausente no campo "${field.name}" (registro ${index}).`,
        });
      }
      continue;
    }

    // R2 – comprimento máximo string
    if (field.type === "string" && field.maxLength !== undefined) {
      if (typeof value !== "string" || value.length > field.maxLength) {
        issues.push({
          ...base,
          rule: "R2",
          severity: "error",
          message: `"${field.name}" excede ${field.maxLength} caracteres (registro ${index}).`,
        });
      }
    }

    // R3 – código ANEEL válido (string)
    if (field.type === "string" && field.allowedCodes instanceof Set) {
      if (
        typeof value !== "string" ||
        !(field.allowedCodes as Set<string>).has(value)
      ) {
        issues.push({
          ...base,
          rule: "R3",
          severity: "error",
          message:
            `Valor "${value}" inválido para "${field.name}". ` +
            `Códigos aceitos: ${[...(field.allowedCodes as Set<string>)].join(", ")} (registro ${index}).`,
        });
      }
    }

    // R3 – código ANEEL válido (numérico)
    if (field.type === "number" && field.allowedCodes instanceof Set) {
      const num = Number(value);
      if (
        !Number.isFinite(num) ||
        !(field.allowedCodes as Set<number>).has(num)
      ) {
        issues.push({
          ...base,
          rule: "R3",
          severity: "error",
          message:
            `Valor "${value}" inválido para "${field.name}". ` +
            `Códigos aceitos: ${[...(field.allowedCodes as Set<number>)].join(", ")} (registro ${index}).`,
        });
      }
    }

    // R4 – intervalo numérico
    if (field.type === "number" && field.allowedCodes === undefined) {
      const num = Number(value);
      if (!Number.isFinite(num)) {
        issues.push({
          ...base,
          rule: "R4",
          severity: "error",
          message: `"${field.name}" não é um número válido (registro ${index}).`,
        });
      } else {
        if (field.min !== undefined && num < field.min) {
          issues.push({
            ...base,
            rule: "R4",
            severity: "error",
            message: `"${field.name}" = ${num} está abaixo do mínimo ${field.min} (registro ${index}).`,
          });
        }
        if (field.max !== undefined && num > field.max) {
          issues.push({
            ...base,
            rule: "R4",
            severity: "warning",
            message: `"${field.name}" = ${num} acima do máximo esperado ${field.max} (registro ${index}).`,
          });
        }
      }
    }
  }

  return issues;
}

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Valida registros de uma única camada BDGD.
 *
 * @param layerCode  Código ANEEL da camada (ex: "SEGBT").
 * @param records    Lista de registros a validar.
 * @returns Relatório de conformidade da camada.
 */
export function validateBdgdLayer(
  layerCode: string,
  records: BdgdRecord[],
): BdgdLayerReport {
  const def: BdgdLayerDef | undefined = BDGD_LAYER_DEFS.get(layerCode);

  if (!def) {
    return {
      layer: layerCode,
      description: "Camada desconhecida",
      totalRecords: records.length,
      validRecords: 0,
      issues: [
        {
          rule: "R1",
          severity: "error",
          field: "layer",
          recordIndex: -1,
          message: `Camada "${layerCode}" não reconhecida pela especificação BDGD suportada.`,
        },
      ],
      conformant: false,
    };
  }

  const allIssues: BdgdIssue[] = [];

  // R5 – unicidade de COD_ID
  const seenIds = new Map<string, number>();
  records.forEach((rec, idx) => {
    const id = getCodId(rec);
    if (id !== undefined) {
      if (seenIds.has(id)) {
        allIssues.push({
          rule: "R5",
          severity: "error",
          field: "COD_ID",
          recordIndex: idx,
          codId: id,
          message: `COD_ID "${id}" duplicado (também no índice ${seenIds.get(id)}).`,
        });
      } else {
        seenIds.set(id, idx);
      }
    }
  });

  // Por-registro
  for (let i = 0; i < records.length; i++) {
    const issues = validateRecord(records[i], def.fields, i);
    allIssues.push(...issues);
  }

  const errorCount = allIssues.filter((i) => i.severity === "error").length;
  const validRecords = records.filter(
    (_, idx) =>
      !allIssues.some(
        (issue) => issue.recordIndex === idx && issue.severity === "error",
      ),
  ).length;

  return {
    layer: layerCode,
    description: def.description,
    totalRecords: records.length,
    validRecords,
    issues: allIssues,
    conformant: errorCount === 0,
  };
}

/**
 * Valida múltiplas camadas BDGD em conjunto.
 *
 * @param input  Mapa camada → registros.
 * @returns Relatório de conformidade agregado.
 */
export function buildBdgdValidationReport(
  input: BdgdValidationInput,
): BdgdValidationReport {
  const layerReports: BdgdLayerReport[] = [];

  for (const [code, records] of Object.entries(input.layers)) {
    if (records && records.length > 0) {
      layerReports.push(validateBdgdLayer(code, records));
    }
  }

  const totalRecords = layerReports.reduce((s, r) => s + r.totalRecords, 0);
  const totalIssues = layerReports.reduce((s, r) => s + r.issues.length, 0);
  const errors = layerReports.reduce(
    (s, r) => s + r.issues.filter((i) => i.severity === "error").length,
    0,
  );
  const warnings = totalIssues - errors;
  const layersConformant = layerReports.filter((r) => r.conformant).length;

  return {
    generatedAt: new Date().toISOString(),
    aneelSpec: "PRODIST Módulo 2 / REN 956/2021",
    layers: layerReports,
    totals: {
      layersChecked: layerReports.length,
      layersConformant,
      totalRecords,
      totalIssues,
      errors,
      warnings,
    },
    conformant: errors === 0 && layerReports.length > 0,
  };
}

/** Retorna true se o relatório não possui erros em nenhuma camada. */
export function isBdgdConformant(report: BdgdValidationReport): boolean {
  return report.conformant;
}
