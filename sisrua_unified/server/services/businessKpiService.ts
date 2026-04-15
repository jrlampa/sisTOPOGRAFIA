/**
 * businessKpiService.ts — Observabilidade de Negócio (KPIs Operacionais).
 *
 * Roadmap Item 125 [T1]: Observabilidade de Negócio (KPIs Operacionais).
 * Métricas operacionais de negócio:
 *   - Taxa de sucesso por projeto/região
 *   - Índice de retrabalho (re-execuções de jobs)
 *   - Gargalos por região geográfica
 *   - Throughput e volume ao longo do tempo
 *
 * Complementa o `metricsService` (infraestrutura / Prometheus) e o
 * `sloService` (SLO técnico); este serviço foca em KPIs de **negócio**
 * com semântica de domínio: projetos, regiões, tipos de exportação etc.
 *
 * Dados são mantidos em memória e projetados para integração futura com
 * persistência em banco (job_kpi_events) sem alterar a interface pública.
 */

// ─── Tipos de evento KPI ──────────────────────────────────────────────────────

/** Resultado possível de um job de exportação ou análise. */
export type ResultadoJob = "sucesso" | "falha" | "retrabalho";

/** Tipos de operação rastreados. */
export type TipoOperacao =
  | "exportacao_dxf"
  | "analise_rede"
  | "calculo_bt"
  | "calculo_cqt"
  | "snapshot_dominio"
  | "relatorio";

/** Evento de KPI registrado quando um job é concluído. */
export interface EventoKpi {
  id: string;
  tenantId: string;
  /** Identificador do projeto (opcional para agregações globais por tenant). */
  projetoId?: string;
  /** Região geográfica ou concessionária de referência. */
  regiao?: string;
  tipo: TipoOperacao;
  resultado: ResultadoJob;
  /** Duração da operação em milissegundos. */
  duracaoMs: number;
  ocorridoEm: Date;
  /** Dados extras para análise posterior. */
  metadados?: Record<string, unknown>;
}

/** Resumo de KPI para um agrupamento (projeto, região, tipo). */
export interface ResumoKpi {
  total: number;
  sucessos: number;
  falhas: number;
  retrabalhos: number;
  /** Taxa de sucesso entre 0 e 1. */
  taxaSucesso: number;
  /** Índice de retrabalho: retrabalhos / total. */
  indiceRetrabalho: number;
  duracaoMediaMs: number;
  duracaoMaxMs: number;
}

/** Relatório de gargalo regional. */
export interface GargaloRegional {
  regiao: string;
  totalJobs: number;
  taxaFalha: number;
  duracaoMediaMs: number;
  /** true quando a taxa de falha é acima do limiar ou duração média excede o limiar. */
  ehGargalo: boolean;
}

/** Relatório completo de KPIs para um tenant. */
export interface RelatorioKpiTenant {
  tenantId: string;
  periodoInicio: Date;
  periodoFim: Date;
  global: ResumoKpi;
  porProjeto: Record<string, ResumoKpi>;
  porRegiao: Record<string, ResumoKpi>;
  porTipo: Partial<Record<TipoOperacao, ResumoKpi>>;
  gargalosRegionais: GargaloRegional[];
}

// ─── Limiares padrão ──────────────────────────────────────────────────────────

/** Taxa de falha acima deste valor classifica a região como gargalo (10%). */
const LIMIAR_TAXA_FALHA_GARGALO = 0.1;

/** Duração média acima deste valor classifica a região como gargalo (5 min). */
const LIMIAR_DURACAO_GARGALO_MS = 5 * 60 * 1000;

// ─── Store ────────────────────────────────────────────────────────────────────

const eventosStore = new Map<string, EventoKpi[]>();

let _contadorEvento = 0;

function gerarId(): string {
  _contadorEvento += 1;
  return `kpi-${Date.now()}-${_contadorEvento}`;
}

// ─── Funções principais ───────────────────────────────────────────────────────

/**
 * Registra um evento de KPI ao término de um job.
 * Lança erro se `duracaoMs` for negativo ou infinito.
 */
export function registrarEventoKpi(
  tenantId: string,
  tipo: TipoOperacao,
  resultado: ResultadoJob,
  duracaoMs: number,
  opcoes?: {
    projetoId?: string;
    regiao?: string;
    metadados?: Record<string, unknown>;
  },
): EventoKpi {
  if (!tenantId || !tenantId.trim()) {
    throw new Error("tenantId não pode ser vazio");
  }
  if (!Number.isFinite(duracaoMs) || duracaoMs < 0) {
    throw new RangeError(
      `duracaoMs deve ser um número não-negativo finito (recebido: ${duracaoMs})`,
    );
  }

  const evento: EventoKpi = {
    id: gerarId(),
    tenantId: tenantId.trim().toLowerCase(),
    projetoId: opcoes?.projetoId?.trim(),
    regiao: opcoes?.regiao?.trim().toLowerCase(),
    tipo,
    resultado,
    duracaoMs,
    ocorridoEm: new Date(),
    metadados: opcoes?.metadados,
  };

  const chave = evento.tenantId;
  const lista = eventosStore.get(chave) ?? [];
  lista.push(evento);
  eventosStore.set(chave, lista);

  return { ...evento };
}

/**
 * Retorna eventos de um tenant com filtros opcionais.
 */
export function listarEventosKpi(
  tenantId: string,
  filtros?: {
    de?: Date;
    ate?: Date;
    tipo?: TipoOperacao;
    resultado?: ResultadoJob;
    regiao?: string;
    projetoId?: string;
  },
): EventoKpi[] {
  const tid = tenantId.trim().toLowerCase();
  let lista = (eventosStore.get(tid) ?? []).map((e) => ({ ...e }));

  if (filtros?.de) lista = lista.filter((e) => e.ocorridoEm >= filtros.de!);
  if (filtros?.ate) lista = lista.filter((e) => e.ocorridoEm <= filtros.ate!);
  if (filtros?.tipo) lista = lista.filter((e) => e.tipo === filtros.tipo);
  if (filtros?.resultado) lista = lista.filter((e) => e.resultado === filtros.resultado);
  if (filtros?.regiao) {
    const r = filtros.regiao.trim().toLowerCase();
    lista = lista.filter((e) => e.regiao === r);
  }
  if (filtros?.projetoId) {
    const p = filtros.projetoId.trim();
    lista = lista.filter((e) => e.projetoId === p);
  }

  return lista.sort((a, b) => a.ocorridoEm.getTime() - b.ocorridoEm.getTime());
}

// ─── Cálculo de resumo ────────────────────────────────────────────────────────

function calcularResumo(eventos: EventoKpi[]): ResumoKpi {
  const total = eventos.length;
  if (total === 0) {
    return {
      total: 0,
      sucessos: 0,
      falhas: 0,
      retrabalhos: 0,
      taxaSucesso: 1,
      indiceRetrabalho: 0,
      duracaoMediaMs: 0,
      duracaoMaxMs: 0,
    };
  }

  const sucessos = eventos.filter((e) => e.resultado === "sucesso").length;
  const falhas = eventos.filter((e) => e.resultado === "falha").length;
  const retrabalhos = eventos.filter((e) => e.resultado === "retrabalho").length;
  const duracaoTotal = eventos.reduce((s, e) => s + e.duracaoMs, 0);
  const duracaoMax = Math.max(...eventos.map((e) => e.duracaoMs));

  return {
    total,
    sucessos,
    falhas,
    retrabalhos,
    taxaSucesso: total > 0 ? sucessos / total : 1,
    indiceRetrabalho: total > 0 ? retrabalhos / total : 0,
    duracaoMediaMs: total > 0 ? Math.round(duracaoTotal / total) : 0,
    duracaoMaxMs: duracaoMax,
  };
}

// ─── Relatório completo de KPIs ───────────────────────────────────────────────

/**
 * Gera o relatório completo de KPIs operacionais para um tenant num período.
 */
export function relatorioKpiTenant(
  tenantId: string,
  de?: Date,
  ate?: Date,
): RelatorioKpiTenant {
  const tid = tenantId.trim().toLowerCase();
  const agora = ate ?? new Date();
  const inicio = de ?? new Date(agora.getTime() - 30 * 24 * 60 * 60 * 1000);

  const todos = listarEventosKpi(tid, { de: inicio, ate: agora });

  // ── Global ────────────────────────────────────────────────────────────────
  const global = calcularResumo(todos);

  // ── Por projeto ───────────────────────────────────────────────────────────
  const projetoMap = new Map<string, EventoKpi[]>();
  for (const e of todos) {
    const proj = e.projetoId ?? "__sem_projeto__";
    const arr = projetoMap.get(proj) ?? [];
    arr.push(e);
    projetoMap.set(proj, arr);
  }
  const porProjeto: Record<string, ResumoKpi> = {};
  for (const [proj, evts] of projetoMap.entries()) {
    porProjeto[proj] = calcularResumo(evts);
  }

  // ── Por região ────────────────────────────────────────────────────────────
  const regiaoMap = new Map<string, EventoKpi[]>();
  for (const e of todos) {
    const reg = e.regiao ?? "__sem_regiao__";
    const arr = regiaoMap.get(reg) ?? [];
    arr.push(e);
    regiaoMap.set(reg, arr);
  }
  const porRegiao: Record<string, ResumoKpi> = {};
  const gargalosRegionais: GargaloRegional[] = [];
  for (const [reg, evts] of regiaoMap.entries()) {
    const resumo = calcularResumo(evts);
    porRegiao[reg] = resumo;

    if (reg !== "__sem_regiao__") {
      const taxaFalha = evts.length > 0
        ? evts.filter((e) => e.resultado === "falha").length / evts.length
        : 0;
      const ehGargalo =
        taxaFalha > LIMIAR_TAXA_FALHA_GARGALO ||
        resumo.duracaoMediaMs > LIMIAR_DURACAO_GARGALO_MS;

      gargalosRegionais.push({
        regiao: reg,
        totalJobs: evts.length,
        taxaFalha,
        duracaoMediaMs: resumo.duracaoMediaMs,
        ehGargalo,
      });
    }
  }
  gargalosRegionais.sort((a, b) => b.taxaFalha - a.taxaFalha);

  // ── Por tipo ──────────────────────────────────────────────────────────────
  const tipoMap = new Map<TipoOperacao, EventoKpi[]>();
  for (const e of todos) {
    const arr = tipoMap.get(e.tipo) ?? [];
    arr.push(e);
    tipoMap.set(e.tipo, arr);
  }
  const porTipo: Partial<Record<TipoOperacao, ResumoKpi>> = {};
  for (const [tipo, evts] of tipoMap.entries()) {
    porTipo[tipo] = calcularResumo(evts);
  }

  return {
    tenantId: tid,
    periodoInicio: inicio,
    periodoFim: agora,
    global,
    porProjeto,
    porRegiao,
    porTipo,
    gargalosRegionais,
  };
}

// ─── Utilitário para testes ───────────────────────────────────────────────────

/** Remove todos os eventos. Destinado exclusivamente a testes. */
export function clearAllKpiEvents(): void {
  eventosStore.clear();
  _contadorEvento = 0;
}
