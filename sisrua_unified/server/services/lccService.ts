/**
 * lccService.ts — Gestão de Custos de Ciclo de Vida (T2-44).
 *
 * Roadmap Item 44 [T2]: LCC (Life Cycle Cost) — Gestão de custos ao longo
 * do ciclo de vida de ativos de infraestrutura elétrica.
 *
 * Metodologia NBR ISO 15686-5 (adaptada para o setor elétrico brasileiro):
 *   Custo Total = Aquisição + Instalação + O&M (operação/manutenção) +
 *                 Retrofit/Upgrade + Descarte/Desmobilização
 *   Com VPL dos fluxos futuros descontados pela TMA do projeto.
 *
 * Funcionalidades:
 *   - Criação de análises LCC por ativo ou grupo de ativos
 *   - Categorias: aquisicao, instalacao, operacao, manutencao, retrofit, descarte
 *   - Cálculo de VPL do custo total
 *   - Comparação entre alternativas (ex: cabo convencional vs. protegido)
 *   - Relatório de distribuição por categoria
 */

import { createHash } from "crypto";

// ─── Tipos ────────────────────────────────────────────────────────────────────

/** Categoria de custo no ciclo de vida. */
export type CategoriaCustoLcc =
  | "aquisicao"
  | "instalacao"
  | "operacao"
  | "manutencao"
  | "retrofit"
  | "descarte";

/** Entrada de custo LCC por ano e categoria. */
export interface EntradaCustoLcc {
  ano: number;            // Ano do ciclo (0 = investimento inicial)
  categoria: CategoriaCustoLcc;
  valorNominal: number;   // R$ correntes
  descricao?: string;
}

/** Ativo (ou grupo de ativos) em análise. */
export interface AtivoLcc {
  id: string;
  descricao: string;
  tipo: string;          // ex: "transformador_75kva", "cabo_cam_35mm"
  quantidade: number;
  vidaUtilAnos: number;  // Vida útil esperada em anos
  custos: EntradaCustoLcc[];
}

/** Análise LCC completa. */
export interface AnaliseLcc {
  id: string;
  nome: string;
  tenantId: string;
  projetoId?: string;
  descricao?: string;
  taxaDesconto: number;   // TMA (decimal, ex: 0.08 = 8% a.a.)
  horizonte: number;      // Anos de análise
  ativos: AtivoLcc[];
  resultado?: ResultadoLcc;
  status: "rascunho" | "calculado" | "aprovado";
  criadoEm: Date;
  atualizadoEm: Date;
}

/** Resultado calculado da análise LCC. */
export interface ResultadoLcc {
  custoNominalTotal: number;
  vplTotal: number;
  distribuicaoPorCategoria: Record<CategoriaCustoLcc, { nominal: number; vpl: number }>;
  custoAnualEquivalente: number;  // CAE = VPL × [i(1+i)^n / ((1+i)^n - 1)]
  comparacoes?: ComparacaoLcc[];
  hashIntegridade: string;
  calculadoEm: Date;
}

/** Comparação entre duas alternativas. */
export interface ComparacaoLcc {
  analiseIdA: string;
  analiseIdB: string;
  nomeA: string;
  nomeB: string;
  vplA: number;
  vplB: number;
  diferencaVpl: number;      // vplA - vplB (negativo = A mais barato)
  alternativaMaisEconomica: "A" | "B" | "empate";
}

// ─── Estado interno ───────────────────────────────────────────────────────────

let analises: Map<string, AnaliseLcc> = new Map();
let contadorAnalise = 0;
let contadorAtivo = 0;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function vplFluxos(fluxos: { ano: number; valor: number }[], taxa: number): number {
  return fluxos.reduce((sum, f) => sum + f.valor / Math.pow(1 + taxa, f.ano), 0);
}

function calcularResultado(analise: AnaliseLcc): ResultadoLcc {
  const taxa = analise.taxaDesconto;
  const n = analise.horizonte;

  const distNominal: Record<CategoriaCustoLcc, number> = {
    aquisicao: 0, instalacao: 0, operacao: 0,
    manutencao: 0, retrofit: 0, descarte: 0,
  };
  const distVpl: Record<CategoriaCustoLcc, number> = { ...distNominal };

  let totalNominal = 0;
  let totalVpl = 0;

  for (const ativo of analise.ativos) {
    for (const custo of ativo.custos) {
      if (custo.ano > n) continue;
      const custoTotal = custo.valorNominal * ativo.quantidade;
      const vplCusto = custoTotal / Math.pow(1 + taxa, custo.ano);
      distNominal[custo.categoria] += custoTotal;
      distVpl[custo.categoria] += vplCusto;
      totalNominal += custoTotal;
      totalVpl += vplCusto;
    }
  }

  // CAE: custo anual equivalente
  const fatorCae = taxa > 0
    ? (taxa * Math.pow(1 + taxa, n)) / (Math.pow(1 + taxa, n) - 1)
    : 1 / n;
  const custoAnualEquivalente = parseFloat((totalVpl * fatorCae).toFixed(2));

  const distribuicaoPorCategoria = {} as Record<CategoriaCustoLcc, { nominal: number; vpl: number }>;
  for (const cat of Object.keys(distNominal) as CategoriaCustoLcc[]) {
    distribuicaoPorCategoria[cat] = {
      nominal: parseFloat(distNominal[cat].toFixed(2)),
      vpl: parseFloat(distVpl[cat].toFixed(2)),
    };
  }

  const hashIntegridade = createHash("sha256")
    .update(JSON.stringify({ analiseId: analise.id, totalVpl, distribuicaoPorCategoria }))
    .digest("hex");

  return {
    custoNominalTotal: parseFloat(totalNominal.toFixed(2)),
    vplTotal: parseFloat(totalVpl.toFixed(2)),
    distribuicaoPorCategoria,
    custoAnualEquivalente,
    hashIntegridade,
    calculadoEm: new Date(),
  };
}

// ─── Serviço ──────────────────────────────────────────────────────────────────

export class LccService {
  static _reset(): void {
    analises = new Map();
    contadorAnalise = 0;
    contadorAtivo = 0;
  }

  static criarAnalise(params: {
    nome: string;
    tenantId: string;
    taxaDesconto: number;
    horizonte: number;
    descricao?: string;
    projetoId?: string;
  }): AnaliseLcc {
    const id = `lcc-${++contadorAnalise}`;
    const agora = new Date();
    const analise: AnaliseLcc = {
      id,
      nome: params.nome,
      tenantId: params.tenantId,
      projetoId: params.projetoId,
      descricao: params.descricao,
      taxaDesconto: params.taxaDesconto,
      horizonte: params.horizonte,
      ativos: [],
      status: "rascunho",
      criadoEm: agora,
      atualizadoEm: agora,
    };
    analises.set(id, analise);
    return analise;
  }

  static listarAnalises(tenantId: string): AnaliseLcc[] {
    return Array.from(analises.values()).filter((a) => a.tenantId === tenantId);
  }

  static obterAnalise(id: string): AnaliseLcc | null {
    return analises.get(id) ?? null;
  }

  static adicionarAtivo(
    analiseId: string,
    params: {
      descricao: string;
      tipo: string;
      quantidade: number;
      vidaUtilAnos: number;
      custos: EntradaCustoLcc[];
    }
  ): AnaliseLcc | null {
    const analise = analises.get(analiseId);
    if (!analise) return null;

    const ativo: AtivoLcc = {
      id: `atv-${++contadorAtivo}`,
      descricao: params.descricao,
      tipo: params.tipo,
      quantidade: params.quantidade,
      vidaUtilAnos: params.vidaUtilAnos,
      custos: params.custos,
    };
    analise.ativos.push(ativo);
    analise.atualizadoEm = new Date();
    analise.status = "rascunho";
    analise.resultado = undefined;
    return analise;
  }

  static calcularLcc(analiseId: string): AnaliseLcc | null {
    const analise = analises.get(analiseId);
    if (!analise || analise.ativos.length === 0) return null;
    analise.resultado = calcularResultado(analise);
    analise.status = "calculado";
    analise.atualizadoEm = new Date();
    return analise;
  }

  static compararAnalises(idA: string, idB: string): ComparacaoLcc | null {
    const a = analises.get(idA);
    const b = analises.get(idB);
    if (!a || !b || !a.resultado || !b.resultado) return null;

    const diff = parseFloat((a.resultado.vplTotal - b.resultado.vplTotal).toFixed(2));
    const melhor: "A" | "B" | "empate" =
      diff < 0 ? "A" : diff > 0 ? "B" : "empate";

    return {
      analiseIdA: idA,
      analiseIdB: idB,
      nomeA: a.nome,
      nomeB: b.nome,
      vplA: a.resultado.vplTotal,
      vplB: b.resultado.vplTotal,
      diferencaVpl: diff,
      alternativaMaisEconomica: melhor,
    };
  }

  static aprovarAnalise(id: string): AnaliseLcc | null {
    const analise = analises.get(id);
    if (!analise || analise.status !== "calculado") return null;
    analise.status = "aprovado";
    analise.atualizadoEm = new Date();
    return analise;
  }
}
