/**
 * bdiRoiService.ts — Análise de BDI e ROI Preditivo (T2-43).
 *
 * Roadmap Item 43 [T2]: Análise de BDI e ROI Preditivo — Dashboards gerenciais
 * com cálculo de BDI e análise de retorno sobre investimento.
 *
 * BDI (Benefícios e Despesas Indiretas):
 *   Encargo aplicado sobre o custo direto das obras para cobrir despesas
 *   indiretas, tributos e lucro do contratado. Fórmula padrão TCU:
 *     BDI% = [(1+AC+S+R+G) × (1+DF) × (1+L) / (1-T)] - 1
 *   onde: AC=Administração Central, S=Seguro+Risco, R=Risco+Garantia,
 *         G=Gestão Geral, DF=Despesas Financeiras, L=Lucro, T=Tributos.
 *
 * ROI preditivo: VPL (Valor Presente Líquido), TIR (Taxa Interna de Retorno),
 *   payback simples e descontado, para projetos de capital em infraestrutura
 *   elétrica e obras civis.
 */

import { createHash } from "crypto";

// ─── Tipos ────────────────────────────────────────────────────────────────────

/** Tipo de obra — influencia BDI de referência. */
export type TipoObra =
  | "distribuicao_eletrica"
  | "transmissao_eletrica"
  | "subestacao"
  | "iluminacao_publica"
  | "obras_civis_complexas"
  | "obras_civis_simples"
  | "telecomunicacoes";

/** Componentes do BDI (todos em fração decimal, ex: 0.05 = 5%). */
export interface ComponentesBdi {
  administracaoCentral: number; // AC (típico: 0.04–0.06)
  seguroRisco: number;          // S+R (típico: 0.02–0.04)
  despesasFinanceiras: number;  // DF (típico: 0.01–0.02)
  lucro: number;                // L (típico: 0.07–0.12)
  // Tributos (ISS + PIS + COFINS + IRPJ/CSLL)
  iss: number;     // ISS (típico: 0.02–0.05)
  pis: number;     // PIS (0.0065)
  cofins: number;  // COFINS (0.03)
  irpjCsll: number; // IRPJ+CSLL (0.0348 padrão lucro presumido)
}

/** Resultado do cálculo BDI. */
export interface ResultadoBdi {
  id: string;
  tipoObra: TipoObra;
  tenantId: string;
  projetoId?: string;
  componentes: ComponentesBdi;
  percentualBdi: number;        // Resultado em percentual (ex: 25.4)
  custoDirectoBase: number;     // R$
  custoComBdi: number;          // R$
  tributosTotais: number;       // R$
  hashIntegridade: string;
  criadoEm: Date;
}

/** Referência de BDI típico por tipo de obra (baseado em jurisprudência TCU). */
export interface ReferencialBdi {
  tipoObra: TipoObra;
  bdiMinimo: number;
  bdiMaximo: number;
  bdiRecomendado: number;
  fundamentacao: string;
}

/** Fluxo de caixa anual para análise ROI. */
export interface FluxoCaixaAnual {
  ano: number;
  fluxo: number; // positivo = receita/saving; negativo = desembolso
}

/** Parâmetros para cálculo ROI. */
export interface ParamsRoi {
  descricao: string;
  tenantId: string;
  projetoId?: string;
  investimentoInicial: number;   // R$ (valor absoluto)
  fluxosCaixa: FluxoCaixaAnual[];
  taxaDesconto: number;          // TMA em decimal (ex: 0.12 = 12% a.a.)
  horizonte?: number;            // anos (padrão = maior ano do fluxo)
}

/** Resultado da análise ROI. */
export interface ResultadoRoi {
  id: string;
  descricao: string;
  tenantId: string;
  projetoId?: string;
  investimentoInicial: number;
  taxaDesconto: number;
  vpl: number;                  // Valor Presente Líquido
  tir: number | null;           // Taxa Interna de Retorno (null se não convergir)
  paybackSimples: number | null; // anos para payback simples (null se não atingir)
  paybackDescontado: number | null; // anos para payback descontado
  viavel: boolean;              // vpl > 0
  indiceSobrevivencia: number;  // razão benefício/custo
  fluxosCaixa: FluxoCaixaAnual[];
  criadoEm: Date;
}

// ─── Referenciais BDI (TCU / ANEEL) ──────────────────────────────────────────

const REFERENCIAIS_BDI: ReferencialBdi[] = [
  {
    tipoObra: "distribuicao_eletrica",
    bdiMinimo: 20.0,
    bdiMaximo: 28.0,
    bdiRecomendado: 24.0,
    fundamentacao: "Acórdão TCU 2622/2013 + Resolução ANEEL 414/2010",
  },
  {
    tipoObra: "transmissao_eletrica",
    bdiMinimo: 22.0,
    bdiMaximo: 30.0,
    bdiRecomendado: 26.0,
    fundamentacao: "Acórdão TCU 2622/2013",
  },
  {
    tipoObra: "subestacao",
    bdiMinimo: 20.0,
    bdiMaximo: 26.0,
    bdiRecomendado: 23.0,
    fundamentacao: "Acórdão TCU 2622/2013",
  },
  {
    tipoObra: "iluminacao_publica",
    bdiMinimo: 18.0,
    bdiMaximo: 24.0,
    bdiRecomendado: 21.0,
    fundamentacao: "Acórdão TCU 2622/2013",
  },
  {
    tipoObra: "obras_civis_complexas",
    bdiMinimo: 22.0,
    bdiMaximo: 32.0,
    bdiRecomendado: 27.0,
    fundamentacao: "Acórdão TCU 2622/2013 — Obras de alta complexidade",
  },
  {
    tipoObra: "obras_civis_simples",
    bdiMinimo: 18.0,
    bdiMaximo: 26.0,
    bdiRecomendado: 22.0,
    fundamentacao: "Acórdão TCU 2622/2013 — Obras de baixa complexidade",
  },
  {
    tipoObra: "telecomunicacoes",
    bdiMinimo: 20.0,
    bdiMaximo: 30.0,
    bdiRecomendado: 25.0,
    fundamentacao: "Acórdão TCU 2622/2013",
  },
];

// ─── Estado interno ───────────────────────────────────────────────────────────

let analisesBdi: Map<string, ResultadoBdi> = new Map();
let analisesRoi: Map<string, ResultadoRoi> = new Map();
let contadorBdi = 0;
let contadorRoi = 0;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Fórmula TCU para BDI:
 *   BDI = {[(1+AC+S+DF) × (1+L)] / (1-T)} - 1
 * onde T = ISS + PIS + COFINS + IRPJ/CSLL
 */
function calcularPercentualBdi(c: ComponentesBdi): number {
  const numerador = (1 + c.administracaoCentral + c.seguroRisco + c.despesasFinanceiras) * (1 + c.lucro);
  const tributos = c.iss + c.pis + c.cofins + c.irpjCsll;
  if (tributos >= 1) throw new Error("Tributos >= 100% inválido");
  const denominador = 1 - tributos;
  return parseFloat(((numerador / denominador - 1) * 100).toFixed(4));
}

/** Calcula VPL a partir dos fluxos de caixa e da taxa de desconto. */
function calcularVpl(investimento: number, fluxos: FluxoCaixaAnual[], taxa: number): number {
  const vp = fluxos.reduce((acc, f) => acc + f.fluxo / Math.pow(1 + taxa, f.ano), 0);
  return parseFloat((vp - investimento).toFixed(2));
}

/** Estima TIR por bisseção (30 iterações, precisão 0.0001). */
function calcularTir(investimento: number, fluxos: FluxoCaixaAnual[]): number | null {
  let lo = -0.99;
  let hi = 10.0;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const vpl = calcularVpl(investimento, fluxos, mid);
    if (Math.abs(vpl) < 0.01) return parseFloat((mid * 100).toFixed(4));
    if (vpl > 0) lo = mid;
    else hi = mid;
  }
  const tir = (lo + hi) / 2;
  return Math.abs(tir) < 9.9 ? parseFloat((tir * 100).toFixed(4)) : null;
}

/** Payback simples: somatório acumulado dos fluxos (sem desconto). */
function calcularPaybackSimples(investimento: number, fluxos: FluxoCaixaAnual[]): number | null {
  let acumulado = -investimento;
  const sorted = [...fluxos].sort((a, b) => a.ano - b.ano);
  for (const f of sorted) {
    acumulado += f.fluxo;
    if (acumulado >= 0) return f.ano;
  }
  return null;
}

/** Payback descontado. */
function calcularPaybackDescontado(
  investimento: number,
  fluxos: FluxoCaixaAnual[],
  taxa: number
): number | null {
  let acumulado = -investimento;
  const sorted = [...fluxos].sort((a, b) => a.ano - b.ano);
  for (const f of sorted) {
    acumulado += f.fluxo / Math.pow(1 + taxa, f.ano);
    if (acumulado >= 0) return f.ano;
  }
  return null;
}

// ─── Serviço ──────────────────────────────────────────────────────────────────

export class BdiRoiService {
  static _reset(): void {
    analisesBdi = new Map();
    analisesRoi = new Map();
    contadorBdi = 0;
    contadorRoi = 0;
  }

  // ── BDI ───────────────────────────────────────────────────────────────────

  static calcularBdi(params: {
    tipoObra: TipoObra;
    tenantId: string;
    componentes: ComponentesBdi;
    custoDirectoBase: number;
    projetoId?: string;
  }): ResultadoBdi {
    const percentualBdi = calcularPercentualBdi(params.componentes);
    const custoComBdi = parseFloat((params.custoDirectoBase * (1 + percentualBdi / 100)).toFixed(2));
    const tributosTotais = parseFloat(
      (custoComBdi * (params.componentes.iss + params.componentes.pis +
        params.componentes.cofins + params.componentes.irpjCsll)).toFixed(2)
    );

    const id = `bdi-${++contadorBdi}`;
    const hashIntegridade = createHash("sha256")
      .update(JSON.stringify({ id, params, percentualBdi }))
      .digest("hex");

    const resultado: ResultadoBdi = {
      id,
      tipoObra: params.tipoObra,
      tenantId: params.tenantId,
      projetoId: params.projetoId,
      componentes: params.componentes,
      percentualBdi,
      custoDirectoBase: params.custoDirectoBase,
      custoComBdi,
      tributosTotais,
      hashIntegridade,
      criadoEm: new Date(),
    };
    analisesBdi.set(id, resultado);
    return resultado;
  }

  static listarAnalisesBdi(tenantId: string): ResultadoBdi[] {
    return Array.from(analisesBdi.values()).filter((a) => a.tenantId === tenantId);
  }

  static obterAnaliseBdi(id: string): ResultadoBdi | null {
    return analisesBdi.get(id) ?? null;
  }

  static listarReferenciais(tipoObra?: TipoObra): ReferencialBdi[] {
    if (tipoObra) return REFERENCIAIS_BDI.filter((r) => r.tipoObra === tipoObra);
    return [...REFERENCIAIS_BDI];
  }

  // ── ROI ───────────────────────────────────────────────────────────────────

  static calcularRoi(params: ParamsRoi): ResultadoRoi {
    const vpl = calcularVpl(params.investimentoInicial, params.fluxosCaixa, params.taxaDesconto);
    const tir = calcularTir(params.investimentoInicial, params.fluxosCaixa);
    const paybackSimples = calcularPaybackSimples(params.investimentoInicial, params.fluxosCaixa);
    const paybackDescontado = calcularPaybackDescontado(
      params.investimentoInicial,
      params.fluxosCaixa,
      params.taxaDesconto
    );
    const somaFluxosPositivos = params.fluxosCaixa
      .filter((f) => f.fluxo > 0)
      .reduce((s, f) => s + f.fluxo / Math.pow(1 + params.taxaDesconto, f.ano), 0);
    const indiceSobrevivencia = params.investimentoInicial > 0
      ? parseFloat((somaFluxosPositivos / params.investimentoInicial).toFixed(4))
      : 0;

    const id = `roi-${++contadorRoi}`;
    const resultado: ResultadoRoi = {
      id,
      descricao: params.descricao,
      tenantId: params.tenantId,
      projetoId: params.projetoId,
      investimentoInicial: params.investimentoInicial,
      taxaDesconto: params.taxaDesconto,
      vpl,
      tir,
      paybackSimples,
      paybackDescontado,
      viavel: vpl > 0,
      indiceSobrevivencia,
      fluxosCaixa: params.fluxosCaixa,
      criadoEm: new Date(),
    };
    analisesRoi.set(id, resultado);
    return resultado;
  }

  static listarAnalisesRoi(tenantId: string): ResultadoRoi[] {
    return Array.from(analisesRoi.values()).filter((a) => a.tenantId === tenantId);
  }

  static obterAnaliseRoi(id: string): ResultadoRoi | null {
    return analisesRoi.get(id) ?? null;
  }
}
