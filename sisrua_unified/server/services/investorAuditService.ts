/**
 * investorAuditService.ts — Investor Audit Reporting (T2-70).
 *
 * Roadmap Item 70 [T2]: Relatórios de "Saúde Técnica" para processos de
 * Due Diligence de investidores em projetos de infraestrutura elétrica.
 *
 * Estrutura do relatório baseada em:
 *   - IEC 62443 (segurança operacional industrial)
 *   - ISO/IEC 27001 (segurança da informação)
 *   - NBR ISO 55001 (gestão de ativos)
 *   - Resolução ANEEL 1000/2021 (qualidade de serviço distribuidoras)
 */

import { createHash } from "crypto";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type DimensaoAuditoria =
  | "confiabilidade_sistema"
  | "conformidade_regulatoria"
  | "qualidade_dados"
  | "saude_financeira";

export type NivelRisco = "baixo" | "medio" | "alto" | "critico";

export type StatusRelatorio = "rascunho" | "calculado" | "publicado";

export type ClassificacaoAuditoria = "Excelente" | "Bom" | "Regular" | "Ruim";

/** Pesos por dimensão para o score geral (somam 1,0). */
const PESOS_DIMENSAO: Record<DimensaoAuditoria, number> = {
  confiabilidade_sistema:    0.30,
  conformidade_regulatoria:  0.30,
  qualidade_dados:           0.20,
  saude_financeira:          0.20,
};

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface MetricaAuditoria {
  id: string;
  dimensao: DimensaoAuditoria;
  nome: string;
  valor: number;        // 0–100
  peso?: number;        // peso interno dentro da dimensão (default 1)
  observacao?: string;
}

export interface RiscoIdentificado {
  id: string;
  nivel: NivelRisco;
  categoria: string;
  descricao: string;
  mitigacao?: string;
}

export interface ScoreAuditoria {
  scoreGeral: number;
  scoresPorDimensao: Record<DimensaoAuditoria, number>;
  classificacao: ClassificacaoAuditoria;
  totalRiscos: Record<NivelRisco, number>;
  hashIntegridade: string;
  calculadoEm: Date;
}

export interface RelatorioInvestor {
  id: string;
  nome: string;
  tenantId: string;
  projetoId?: string;
  periodoReferencia: string;   // ex: "Q1/2026", "2025"
  metricas: MetricaAuditoria[];
  riscos: RiscoIdentificado[];
  resultado?: ScoreAuditoria;
  status: StatusRelatorio;
  criadoEm: Date;
  atualizadoEm: Date;
}

// ─── Estado interno ───────────────────────────────────────────────────────────

let relatorios: Map<string, RelatorioInvestor> = new Map();
let contadorRelatorio = 0;
let contadorMetrica = 0;
let contadorRisco = 0;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function classificar(score: number): ClassificacaoAuditoria {
  if (score >= 85) return "Excelente";
  if (score >= 70) return "Bom";
  if (score >= 50) return "Regular";
  return "Ruim";
}

function calcularScoreDimensao(
  metricas: MetricaAuditoria[],
  dimensao: DimensaoAuditoria
): number {
  const dims = metricas.filter((m) => m.dimensao === dimensao);
  if (dims.length === 0) return 0;
  const pesosTotal = dims.reduce((s, m) => s + (m.peso ?? 1), 0);
  const valorPonderado = dims.reduce((s, m) => s + m.valor * (m.peso ?? 1), 0);
  return pesosTotal > 0 ? valorPonderado / pesosTotal : 0;
}

// ─── Serviço ──────────────────────────────────────────────────────────────────

export class InvestorAuditService {
  static _reset(): void {
    relatorios = new Map();
    contadorRelatorio = 0;
    contadorMetrica = 0;
    contadorRisco = 0;
  }

  static criarRelatorio(params: {
    nome: string;
    tenantId: string;
    periodoReferencia: string;
    projetoId?: string;
  }): RelatorioInvestor {
    const id = `audit-${++contadorRelatorio}`;
    const agora = new Date();
    const relatorio: RelatorioInvestor = {
      id,
      nome: params.nome,
      tenantId: params.tenantId,
      projetoId: params.projetoId,
      periodoReferencia: params.periodoReferencia,
      metricas: [],
      riscos: [],
      status: "rascunho",
      criadoEm: agora,
      atualizadoEm: agora,
    };
    relatorios.set(id, relatorio);
    return relatorio;
  }

  static listarRelatorios(tenantId: string): RelatorioInvestor[] {
    return Array.from(relatorios.values()).filter((r) => r.tenantId === tenantId);
  }

  static obterRelatorio(id: string): RelatorioInvestor | null {
    return relatorios.get(id) ?? null;
  }

  static adicionarMetrica(
    relatorioId: string,
    params: {
      dimensao: DimensaoAuditoria;
      nome: string;
      valor: number;
      peso?: number;
      observacao?: string;
    }
  ): RelatorioInvestor | { erro: string } {
    const rel = relatorios.get(relatorioId);
    if (!rel) return { erro: "Relatório não encontrado" };
    if (params.valor < 0 || params.valor > 100) {
      return { erro: "Valor da métrica deve estar entre 0 e 100" };
    }
    const metrica: MetricaAuditoria = {
      id: `met-${++contadorMetrica}`,
      dimensao: params.dimensao,
      nome: params.nome,
      valor: params.valor,
      peso: params.peso,
      observacao: params.observacao,
    };
    rel.metricas.push(metrica);
    rel.status = "rascunho";
    rel.resultado = undefined;
    rel.atualizadoEm = new Date();
    return rel;
  }

  static adicionarRisco(
    relatorioId: string,
    params: {
      nivel: NivelRisco;
      categoria: string;
      descricao: string;
      mitigacao?: string;
    }
  ): RelatorioInvestor | null {
    const rel = relatorios.get(relatorioId);
    if (!rel) return null;
    const risco: RiscoIdentificado = {
      id: `risco-${++contadorRisco}`,
      ...params,
    };
    rel.riscos.push(risco);
    rel.atualizadoEm = new Date();
    return rel;
  }

  static calcularScore(id: string): RelatorioInvestor | { erro: string } {
    const rel = relatorios.get(id);
    if (!rel) return { erro: "Relatório não encontrado" };
    if (rel.metricas.length === 0) return { erro: "Nenhuma métrica cadastrada" };

    const dimensoes = Object.keys(PESOS_DIMENSAO) as DimensaoAuditoria[];
    const scoresPorDimensao = {} as Record<DimensaoAuditoria, number>;
    let scoreGeral = 0;
    let pesosUsados = 0;

    for (const dim of dimensoes) {
      const score = calcularScoreDimensao(rel.metricas, dim);
      scoresPorDimensao[dim] = parseFloat(score.toFixed(2));
      scoreGeral += score * PESOS_DIMENSAO[dim];
      if (rel.metricas.some((m) => m.dimensao === dim)) {
        pesosUsados += PESOS_DIMENSAO[dim];
      }
    }

    // Se nem todas as dimensões têm métricas, normalizar pelo peso usado
    const scoreNormalizado = pesosUsados > 0 ? scoreGeral / pesosUsados : 0;

    const totalRiscos: Record<NivelRisco, number> = {
      baixo: 0,
      medio: 0,
      alto: 0,
      critico: 0,
    };
    for (const r of rel.riscos) {
      totalRiscos[r.nivel]++;
    }

    const scoreArredondado = parseFloat(scoreNormalizado.toFixed(2));

    const hashIntegridade = createHash("sha256")
      .update(JSON.stringify({ relatorioId: id, scoreGeral: scoreArredondado, scoresPorDimensao }))
      .digest("hex");

    rel.resultado = {
      scoreGeral: scoreArredondado,
      scoresPorDimensao,
      classificacao: classificar(scoreArredondado),
      totalRiscos,
      hashIntegridade,
      calculadoEm: new Date(),
    };
    rel.status = "calculado";
    rel.atualizadoEm = new Date();
    return rel;
  }

  static publicarRelatorio(id: string): RelatorioInvestor | null {
    const rel = relatorios.get(id);
    if (!rel || rel.status !== "calculado") return null;
    rel.status = "publicado";
    rel.atualizadoEm = new Date();
    return rel;
  }

  static listarDimensoes(): {
    codigo: DimensaoAuditoria;
    nome: string;
    peso: number;
  }[] {
    const nomes: Record<DimensaoAuditoria, string> = {
      confiabilidade_sistema: "Confiabilidade do Sistema",
      conformidade_regulatoria: "Conformidade Regulatória",
      qualidade_dados: "Qualidade dos Dados",
      saude_financeira: "Saúde Financeira",
    };
    return (Object.keys(PESOS_DIMENSAO) as DimensaoAuditoria[]).map((d) => ({
      codigo: d,
      nome: nomes[d],
      peso: PESOS_DIMENSAO[d],
    }));
  }
}
