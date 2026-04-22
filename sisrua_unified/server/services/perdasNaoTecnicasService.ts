/**
 * perdasNaoTecnicasService.ts — Monitoramento de Perdas Não Técnicas via Twin (T2-79).
 *
 * Roadmap Item 79 [T2]: Monitoramento e análise de perdas comerciais (não técnicas)
 * em redes de distribuição de energia elétrica com referência ao gêmeo digital.
 *
 * Referências:
 *   - ANEEL PRODIST Módulo 7 (2023): metodologia de apuração de perdas
 *   - ABNT NBR 14519:2000: medição de energia elétrica
 *   - ANEEL Resolução Normativa 1000/2021: indicadores de perdas
 *   - Meta regulatória de perdas não técnicas ANEEL 2024: 7,0% (referência nacional)
 */

import { createHash } from "crypto";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type CategoriaPerda =
  | "fraude_medicao"            // Adulteração / by-pass de medidor
  | "ligacao_clandestina"       // Gato / ligação irregular
  | "erro_medicao"              // Falha de equipamento de medição
  | "inadimplencia_corte"       // Consumo pós-corte (autoligação)
  | "nao_identificada";         // Resíduo não categorizado

export type StatusMonitoramento = "ativo" | "encerrado" | "suspenso";

export type NivelAlerta = "normal" | "atencao" | "critico";

/** Meta regulatória ANEEL (%) para classificação de nível de alerta. */
const META_PNT_PERCENTUAL = 7.0;   // %
const ALERTA_ATENCAO     = 5.0;    // % acima da meta → atenção
const ALERTA_CRITICO     = 10.0;   // % acima da meta → crítico

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface PontoMedicao {
  id: string;
  codigo: string;                 // código do medidor / UC
  descricao?: string;
  energiaInjetadaKwh: number;
  energiaFaturadaKwh: number;
  energiaPerdidasTecnicasKwh?: number; // estimativa de perdas físicas
  periodoInicio: string;          // ISO date string
  periodoFim: string;
  observacoes?: string;
}

export interface ResultadoAnalise {
  perdasTotaisKwh: number;
  perdasTecnicasKwh: number;
  perdasNaoTecnicasKwh: number;
  indicePerdasNaoTecnicasPct: number;
  indicePerdasTotaisPct: number;
  nivelAlerta: NivelAlerta;
  metaRegulatoriaAneel: number;
  desvioMetaPct: number;
  distribuicaoPorCategoria: Partial<Record<CategoriaPerda, number>>;
  hashIntegridade: string;
  calculadoEm: Date;
}

export interface MonitoramentoPNT {
  id: string;
  nome: string;
  tenantId: string;
  projetoId?: string;
  subestacaoId?: string;
  pontosMedicao: PontoMedicao[];
  ocorrenciasCategorizadas: { categoria: CategoriaPerda; kwh: number }[];
  resultado?: ResultadoAnalise;
  status: StatusMonitoramento;
  criadoEm: Date;
  atualizadoEm: Date;
}

// ─── Estado interno ───────────────────────────────────────────────────────────

let monitoramentos: Map<string, MonitoramentoPNT> = new Map();
let contadorMonitoramento = 0;
let contadorPonto = 0;

// ─── Serviço ──────────────────────────────────────────────────────────────────

export class PerdasNaoTecnicasService {
  static _reset(): void {
    monitoramentos = new Map();
    contadorMonitoramento = 0;
    contadorPonto = 0;
  }

  static criarMonitoramento(params: {
    nome: string;
    tenantId: string;
    projetoId?: string;
    subestacaoId?: string;
  }): MonitoramentoPNT {
    const id = `pnt-${++contadorMonitoramento}`;
    const agora = new Date();
    const mon: MonitoramentoPNT = {
      id,
      nome: params.nome,
      tenantId: params.tenantId,
      projetoId: params.projetoId,
      subestacaoId: params.subestacaoId,
      pontosMedicao: [],
      ocorrenciasCategorizadas: [],
      status: "ativo",
      criadoEm: agora,
      atualizadoEm: agora,
    };
    monitoramentos.set(id, mon);
    return mon;
  }

  static listarMonitoramentos(tenantId: string): MonitoramentoPNT[] {
    return Array.from(monitoramentos.values()).filter((m) => m.tenantId === tenantId);
  }

  static obterMonitoramento(id: string): MonitoramentoPNT | null {
    return monitoramentos.get(id) ?? null;
  }

  static adicionarPontoMedicao(
    monitoramentoId: string,
    params: {
      codigo: string;
      descricao?: string;
      energiaInjetadaKwh: number;
      energiaFaturadaKwh: number;
      energiaPerdidasTecnicasKwh?: number;
      periodoInicio: string;
      periodoFim: string;
      observacoes?: string;
    }
  ): MonitoramentoPNT | null {
    const mon = monitoramentos.get(monitoramentoId);
    if (!mon) return null;
    const ponto: PontoMedicao = {
      id: `pm-${++contadorPonto}`,
      ...params,
    };
    mon.pontosMedicao.push(ponto);
    mon.resultado = undefined;
    mon.atualizadoEm = new Date();
    return mon;
  }

  static registrarOcorrencia(
    monitoramentoId: string,
    categoria: CategoriaPerda,
    kwh: number
  ): MonitoramentoPNT | null {
    const mon = monitoramentos.get(monitoramentoId);
    if (!mon) return null;
    mon.ocorrenciasCategorizadas.push({ categoria, kwh });
    mon.resultado = undefined;
    mon.atualizadoEm = new Date();
    return mon;
  }

  static calcularPerdas(id: string): MonitoramentoPNT | { erro: string } {
    const mon = monitoramentos.get(id);
    if (!mon) return { erro: "Monitoramento não encontrado" };
    if (mon.pontosMedicao.length === 0) return { erro: "Nenhum ponto de medição cadastrado" };

    let totalInjetado = 0;
    let totalFaturado = 0;
    let totalPerdidasTecnicas = 0;

    for (const p of mon.pontosMedicao) {
      totalInjetado += p.energiaInjetadaKwh;
      totalFaturado += p.energiaFaturadaKwh;
      totalPerdidasTecnicas += p.energiaPerdidasTecnicasKwh ?? 0;
    }

    const perdasTotais = totalInjetado - totalFaturado;
    const perdasNaoTecnicas = Math.max(0, perdasTotais - totalPerdidasTecnicas);
    const indicePNT = totalInjetado > 0 ? (perdasNaoTecnicas / totalInjetado) * 100 : 0;
    const indicePT = totalInjetado > 0 ? (perdasTotais / totalInjetado) * 100 : 0;

    const distribuicao: Partial<Record<CategoriaPerda, number>> = {};
    for (const oc of mon.ocorrenciasCategorizadas) {
      distribuicao[oc.categoria] = (distribuicao[oc.categoria] ?? 0) + oc.kwh;
    }

    const desvio = indicePNT - META_PNT_PERCENTUAL;
    let nivelAlerta: NivelAlerta = "normal";
    if (desvio >= ALERTA_CRITICO) nivelAlerta = "critico";
    else if (desvio >= ALERTA_ATENCAO) nivelAlerta = "atencao";

    const hashIntegridade = createHash("sha256")
      .update(JSON.stringify({ id, totalInjetado, totalFaturado, indicePNT }))
      .digest("hex");

    mon.resultado = {
      perdasTotaisKwh: parseFloat(perdasTotais.toFixed(2)),
      perdasTecnicasKwh: parseFloat(totalPerdidasTecnicas.toFixed(2)),
      perdasNaoTecnicasKwh: parseFloat(perdasNaoTecnicas.toFixed(2)),
      indicePerdasNaoTecnicasPct: parseFloat(indicePNT.toFixed(2)),
      indicePerdasTotaisPct: parseFloat(indicePT.toFixed(2)),
      nivelAlerta,
      metaRegulatoriaAneel: META_PNT_PERCENTUAL,
      desvioMetaPct: parseFloat(desvio.toFixed(2)),
      distribuicaoPorCategoria: distribuicao,
      hashIntegridade,
      calculadoEm: new Date(),
    };
    mon.atualizadoEm = new Date();
    return mon;
  }

  static encerrarMonitoramento(id: string): MonitoramentoPNT | null {
    const mon = monitoramentos.get(id);
    if (!mon) return null;
    mon.status = "encerrado";
    mon.atualizadoEm = new Date();
    return mon;
  }
}
