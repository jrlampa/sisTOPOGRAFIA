/**
 * T2-69 — Dashboard de Produtividade Territorial
 *
 * Referências normativas:
 *  - ANEEL PRODIST Módulo 8 — Qualidade do Atendimento
 *  - ANEEL REN 1000/2021 — Prazos de Atendimento
 *  - ABNT NBR ISO 9001:2015 — Sistema de Gestão da Qualidade
 *  - PMI PMBOK — KPIs de Desempenho de Projetos
 */

import { createHash } from "crypto";

export type IndicadorCampo =
  | "km_rede_projetada"
  | "km_rede_executada"
  | "postes_projetados"
  | "postes_instalados"
  | "transformadores_instalados"
  | "ligacoes_novas"
  | "vistorias_realizadas"
  | "ocorrencias_registradas";

export type SetorGeografico =
  | "distrito"
  | "bairro"
  | "municipio"
  | "regional"
  | "estado";

export type PeriodoApuracao =
  | "diario"
  | "semanal"
  | "mensal"
  | "trimestral"
  | "anual";

export type StatusPainel = "rascunho" | "calculado" | "publicado";

export interface MetricaEquipe {
  id: string;
  equipeId: string;
  equipeName: string;
  setor: string;
  setorTipo: SetorGeografico;
  indicador: IndicadorCampo;
  valorPlanejado: number;
  valorExecutado: number;
  dataReferencia: string;   // ISO date
  observacao?: string;
}

export interface ResultadoProdutividade {
  painelId: string;
  totalMetricas: number;
  produtividadeGlobal: number;   // executado/planejado × 100 (%)
  taxaConformidade: number;       // métricas atingidas ≥ 95% / total × 100
  desvioMedioPercentual: number;  // média dos |executado - planejado| / planejado × 100
  rankingEquipes: {
    equipeId: string;
    equipeName: string;
    pontuacao: number;
  }[];
  indicadoresPorTipo: Record<IndicadorCampo, { planejado: number; executado: number }>;
  hashIntegridade: string;
  calculadoEm: string;
}

export interface PainelProdutividade {
  id: string;
  tenantId: string;
  titulo: string;
  periodo: PeriodoApuracao;
  dataInicio: string;
  dataFim: string;
  concessionaria: string;
  responsavel: string;
  status: StatusPainel;
  metricas: MetricaEquipe[];
  resultado?: ResultadoProdutividade;
  criadoEm: string;
  publicadoEm?: string;
}

// ─── Estado em memória ───────────────────────────────────────────────────────
const paineis = new Map<string, PainelProdutividade>();
let contPainel = 0;
let contMetrica = 0;

// ─── Service ─────────────────────────────────────────────────────────────────

export class ProdutividadeTerritorialService {
  static _reset(): void {
    paineis.clear();
    contPainel = 0;
    contMetrica = 0;
  }

  static criarPainel(params: {
    tenantId: string;
    titulo: string;
    periodo: PeriodoApuracao;
    dataInicio: string;
    dataFim: string;
    concessionaria: string;
    responsavel: string;
  }): PainelProdutividade {
    contPainel += 1;
    const painel: PainelProdutividade = {
      id: `pt-${contPainel}`,
      tenantId: params.tenantId,
      titulo: params.titulo,
      periodo: params.periodo,
      dataInicio: params.dataInicio,
      dataFim: params.dataFim,
      concessionaria: params.concessionaria,
      responsavel: params.responsavel,
      status: "rascunho",
      metricas: [],
      criadoEm: new Date().toISOString(),
    };
    paineis.set(painel.id, painel);
    return painel;
  }

  static listarPaineis(tenantId?: string): PainelProdutividade[] {
    const lista = Array.from(paineis.values());
    return tenantId ? lista.filter((p) => p.tenantId === tenantId) : lista;
  }

  static obterPainel(id: string): PainelProdutividade | undefined {
    return paineis.get(id);
  }

  static registrarMetrica(
    painelId: string,
    params: {
      equipeId: string;
      equipeName: string;
      setor: string;
      setorTipo: SetorGeografico;
      indicador: IndicadorCampo;
      valorPlanejado: number;
      valorExecutado: number;
      dataReferencia: string;
      observacao?: string;
    }
  ): MetricaEquipe {
    const painel = paineis.get(painelId);
    if (!painel) throw new Error(`Painel ${painelId} não encontrado`);
    if (painel.status === "publicado") {
      throw new Error("Painel publicado não pode receber novas métricas");
    }
    contMetrica += 1;
    const metrica: MetricaEquipe = {
      id: `mt-${contMetrica}`,
      equipeId: params.equipeId,
      equipeName: params.equipeName,
      setor: params.setor,
      setorTipo: params.setorTipo,
      indicador: params.indicador,
      valorPlanejado: params.valorPlanejado,
      valorExecutado: params.valorExecutado,
      dataReferencia: params.dataReferencia,
      observacao: params.observacao,
    };
    painel.metricas.push(metrica);
    return metrica;
  }

  static calcularProdutividade(painelId: string): ResultadoProdutividade {
    const painel = paineis.get(painelId);
    if (!painel) throw new Error(`Painel ${painelId} não encontrado`);
    if (painel.metricas.length === 0) {
      throw new Error("Registre pelo menos uma métrica antes de calcular");
    }

    const totalPlanejado = painel.metricas.reduce(
      (acc, m) => acc + m.valorPlanejado,
      0
    );
    const totalExecutado = painel.metricas.reduce(
      (acc, m) => acc + m.valorExecutado,
      0
    );

    const produtividadeGlobal =
      totalPlanejado > 0 ? (totalExecutado / totalPlanejado) * 100 : 0;

    const atingidas = painel.metricas.filter(
      (m) =>
        m.valorPlanejado > 0 &&
        m.valorExecutado / m.valorPlanejado >= 0.95
    ).length;
    const taxaConformidade = (atingidas / painel.metricas.length) * 100;

    const desvios = painel.metricas.map((m) =>
      m.valorPlanejado > 0
        ? Math.abs(m.valorExecutado - m.valorPlanejado) / m.valorPlanejado * 100
        : 0
    );
    const desvioMedioPercentual =
      desvios.reduce((a, b) => a + b, 0) / desvios.length;

    // Ranking de equipes (maior produtividade média por equipe)
    const porEquipe = new Map<
      string,
      { name: string; planejados: number[]; executados: number[] }
    >();
    for (const m of painel.metricas) {
      if (!porEquipe.has(m.equipeId)) {
        porEquipe.set(m.equipeId, {
          name: m.equipeName,
          planejados: [],
          executados: [],
        });
      }
      const eq = porEquipe.get(m.equipeId)!;
      eq.planejados.push(m.valorPlanejado);
      eq.executados.push(m.valorExecutado);
    }
    const rankingEquipes = Array.from(porEquipe.entries())
      .map(([equipeId, data]) => {
        const totalP = data.planejados.reduce((a, b) => a + b, 0);
        const totalE = data.executados.reduce((a, b) => a + b, 0);
        return {
          equipeId,
          equipeName: data.name,
          pontuacao: totalP > 0 ? Math.round((totalE / totalP) * 100 * 100) / 100 : 0,
        };
      })
      .sort((a, b) => b.pontuacao - a.pontuacao);

    // Indicadores agregados por tipo
    const indicadoresPorTipo = {} as Record<
      IndicadorCampo,
      { planejado: number; executado: number }
    >;
    for (const m of painel.metricas) {
      if (!indicadoresPorTipo[m.indicador]) {
        indicadoresPorTipo[m.indicador] = { planejado: 0, executado: 0 };
      }
      indicadoresPorTipo[m.indicador].planejado += m.valorPlanejado;
      indicadoresPorTipo[m.indicador].executado += m.valorExecutado;
    }

    const payload = JSON.stringify({
      painelId,
      totalPlanejado,
      totalExecutado,
      metricas: painel.metricas.map((m) => ({
        equipeId: m.equipeId,
        indicador: m.indicador,
        p: m.valorPlanejado,
        e: m.valorExecutado,
      })),
    });
    const hashIntegridade = createHash("sha256").update(payload).digest("hex");
    const calculadoEm = new Date().toISOString();

    const resultado: ResultadoProdutividade = {
      painelId,
      totalMetricas: painel.metricas.length,
      produtividadeGlobal: Math.round(produtividadeGlobal * 100) / 100,
      taxaConformidade: Math.round(taxaConformidade * 100) / 100,
      desvioMedioPercentual: Math.round(desvioMedioPercentual * 100) / 100,
      rankingEquipes,
      indicadoresPorTipo,
      hashIntegridade,
      calculadoEm,
    };

    painel.resultado = resultado;
    painel.status = "calculado";
    return resultado;
  }

  static publicarPainel(painelId: string): PainelProdutividade {
    const painel = paineis.get(painelId);
    if (!painel) throw new Error(`Painel ${painelId} não encontrado`);
    if (painel.status !== "calculado") {
      throw new Error("Execute o cálculo de produtividade antes de publicar");
    }
    painel.status = "publicado";
    painel.publicadoEm = new Date().toISOString();
    return painel;
  }

  static listarIndicadores(): IndicadorCampo[] {
    return [
      "km_rede_projetada",
      "km_rede_executada",
      "postes_projetados",
      "postes_instalados",
      "transformadores_instalados",
      "ligacoes_novas",
      "vistorias_realizadas",
      "ocorrencias_registradas",
    ];
  }
}
