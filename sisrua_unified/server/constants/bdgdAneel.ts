/**
 * BDGD ANEEL – Definições de Camadas e Atributos (Item 53 – T1)
 *
 * Referência normativa: PRODIST Módulo 2 + Especificações BDGD ANEEL (REN 956/2021).
 *
 * Camadas relevantes para redes BT:
 *   SEGBT  – Segmentos de Rede de Baixa Tensão
 *   PONNOT – Pontos Notáveis (postes)
 *   EQTRAT – Equipamentos Transformadores
 *   RAMBT  – Ramais de Baixa Tensão
 */

// ─── Códigos ANEEL válidos ────────────────────────────────────────────────────

/** TIP_CONDUT – tipo de condutor (Tabela ANEEL). */
export const ANEEL_TIP_CONDUT = {
  1: "Multiplex",
  2: "Protegido",
  3: "Nu",
  4: "Piloformed",
  5: "Subterrâneo",
  6: "Outros",
} as const;

export type AneelTipCondut = keyof typeof ANEEL_TIP_CONDUT;

/** MAT_CONDU – material do condutor. */
export const ANEEL_MAT_CONDU = {
  1: "Alumínio",
  2: "Cobre",
} as const;

export type AneelMatCondu = keyof typeof ANEEL_MAT_CONDU;

/** FAS_CON – fases da conexão. */
export const ANEEL_FAS_CON = new Set([
  "A",
  "B",
  "C",
  "AB",
  "BC",
  "AC",
  "ABC",
  "AN",
  "BN",
  "CN",
  "ABN",
  "BCN",
  "ACN",
  "ABCN",
]);

/** MAT_ESTR – material da estrutura (poste). */
export const ANEEL_MAT_ESTR = {
  1: "Concreto",
  2: "Madeira",
  3: "Metálico",
  4: "Fibra de Vidro",
} as const;

export type AneelMatEstr = keyof typeof ANEEL_MAT_ESTR;

/** TIP_TRAF – tipo de transformador. */
export const ANEEL_TIP_TRAF = {
  1: "Monofásico",
  2: "Trifásico",
} as const;

export type AneelTipTraf = keyof typeof ANEEL_TIP_TRAF;

/** SITU – situação do equipamento. */
export const ANEEL_SITU = {
  1: "Operacional",
  2: "Em Construção",
  3: "Em Projeto",
  4: "Fora de Serviço",
} as const;

export type AneelSitu = keyof typeof ANEEL_SITU;

// ─── Definição de campos por camada ──────────────────────────────────────────

export interface BdgdFieldDef {
  /** Nome do campo BDGD (ex: "FAS_CON"). */
  name: string;
  /** Tipo de dado esperado. */
  type: "string" | "number" | "date" | "coordinate";
  /** Campo obrigatório? */
  required: boolean;
  /** Comprimento máximo (para campos string). */
  maxLength?: number;
  /** Conjunto de valores válidos (para campos codificados). */
  allowedCodes?: Set<number> | Set<string>;
  /** Valor mínimo (para campos numéricos). */
  min?: number;
  /** Valor máximo (para campos numéricos). */
  max?: number;
}

/** Definição completa de uma camada BDGD. */
export interface BdgdLayerDef {
  /** Código da camada ANEEL (ex: "SEGBT"). */
  code: string;
  /** Descrição em português. */
  description: string;
  /** Campos da camada. */
  fields: BdgdFieldDef[];
}

// ─── Helpers de códigos ANEEL ─────────────────────────────────────────────────

const TIP_CONDUT_CODES = new Set(Object.keys(ANEEL_TIP_CONDUT).map(Number));
const MAT_CONDU_CODES = new Set(Object.keys(ANEEL_MAT_CONDU).map(Number));
const MAT_ESTR_CODES = new Set(Object.keys(ANEEL_MAT_ESTR).map(Number));
const TIP_TRAF_CODES = new Set(Object.keys(ANEEL_TIP_TRAF).map(Number));
const SITU_CODES = new Set(Object.keys(ANEEL_SITU).map(Number));

// ─── Catálogo de camadas BDGD ─────────────────────────────────────────────────

/** SEGBT – Segmento de Rede BT. */
const SEGBT_DEF: BdgdLayerDef = {
  code: "SEGBT",
  description: "Segmento de Rede de Baixa Tensão",
  fields: [
    { name: "COD_ID", type: "string", required: true, maxLength: 25 },
    { name: "DES_CONC", type: "string", required: true, maxLength: 10 },
    {
      name: "FAS_CON",
      type: "string",
      required: true,
      allowedCodes: ANEEL_FAS_CON,
    },
    { name: "COMP", type: "number", required: true, min: 0.1, max: 5000 },
    {
      name: "TIP_CONDUT",
      type: "number",
      required: true,
      allowedCodes: TIP_CONDUT_CODES,
    },
    {
      name: "MAT_CONDU",
      type: "number",
      required: true,
      allowedCodes: MAT_CONDU_CODES,
    },
    { name: "CAP_AMPER", type: "number", required: false, min: 0 },
    { name: "SITU", type: "number", required: false, allowedCodes: SITU_CODES },
    { name: "geometry", type: "coordinate", required: true },
  ],
};

/** PONNOT – Ponto Notável (poste). */
const PONNOT_DEF: BdgdLayerDef = {
  code: "PONNOT",
  description: "Ponto Notável – Postes",
  fields: [
    { name: "COD_ID", type: "string", required: true, maxLength: 25 },
    { name: "DES_CONC", type: "string", required: true, maxLength: 10 },
    {
      name: "MAT_ESTR",
      type: "number",
      required: true,
      allowedCodes: MAT_ESTR_CODES,
    },
    { name: "ALT_ESTR", type: "number", required: false, min: 1, max: 30 },
    { name: "SITU", type: "number", required: false, allowedCodes: SITU_CODES },
    { name: "geometry", type: "coordinate", required: true },
  ],
};

/** EQTRAT – Equipamento Transformador BT. */
const EQTRAT_DEF: BdgdLayerDef = {
  code: "EQTRAT",
  description: "Equipamento Transformador de BT",
  fields: [
    { name: "COD_ID", type: "string", required: true, maxLength: 25 },
    { name: "DES_CONC", type: "string", required: true, maxLength: 10 },
    { name: "POT_NOM", type: "number", required: true, min: 1, max: 10000 },
    { name: "TEN_PRI", type: "number", required: true, min: 0.1 },
    { name: "TEN_SEC", type: "number", required: true, min: 100 },
    {
      name: "TIP_TRAF",
      type: "number",
      required: true,
      allowedCodes: TIP_TRAF_CODES,
    },
    { name: "SITU", type: "number", required: false, allowedCodes: SITU_CODES },
    { name: "geometry", type: "coordinate", required: true },
  ],
};

/** RAMBT – Ramal de Baixa Tensão. */
const RAMBT_DEF: BdgdLayerDef = {
  code: "RAMBT",
  description: "Ramal de Baixa Tensão",
  fields: [
    { name: "COD_ID", type: "string", required: true, maxLength: 25 },
    { name: "DES_CONC", type: "string", required: true, maxLength: 10 },
    {
      name: "FAS_CON",
      type: "string",
      required: true,
      allowedCodes: ANEEL_FAS_CON,
    },
    { name: "COMP", type: "number", required: true, min: 0.1, max: 500 },
    {
      name: "TIP_CONDUT",
      type: "number",
      required: true,
      allowedCodes: TIP_CONDUT_CODES,
    },
    { name: "SITU", type: "number", required: false, allowedCodes: SITU_CODES },
    { name: "geometry", type: "coordinate", required: true },
  ],
};

/** Mapa completo de camadas BDGD suportadas. */
export const BDGD_LAYER_DEFS: ReadonlyMap<string, BdgdLayerDef> = new Map([
  ["SEGBT", SEGBT_DEF],
  ["PONNOT", PONNOT_DEF],
  ["EQTRAT", EQTRAT_DEF],
  ["RAMBT", RAMBT_DEF],
]);

/** Lista todas as camadas disponíveis. */
export function listBdgdLayers(): BdgdLayerDef[] {
  return Array.from(BDGD_LAYER_DEFS.values());
}
