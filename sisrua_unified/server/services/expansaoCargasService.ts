/**
 * expansaoCargasService.ts — Simulador de Expansão de Cargas What-if (T2-80).
 *
 * Roadmap Item 80 [T2]: Simular o impacto de novas cargas na rede de distribuição
 * de baixa tensão existente (análise what-if geoespacial/elétrica).
 *
 * Referências:
 *   - ABNT NBR 5410:2004 — Instalações Elétricas de Baixa Tensão
 *   - ANEEL PRODIST Módulo 8 (2023): dimensionamento de transformadores de distribuição
 *   - Norma CEMIG ND 2.2 / Light SN-RE-04: critérios de carregamento de transformadores BT
 *   - IEC 60364-5-52: seleção de condutores — fator de demanda / coincidência
 *   - Limite de carregamento do transformador: 80% da potência nominal (operação segura)
 */

// ─── Constantes ───────────────────────────────────────────────────────────────

/** Limite operacional de carregamento do trafo (norma CEMIG / Light). */
const LIMITE_CARREGAMENTO_PCT = 80.0;

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type TipoCarga =
  | "residencial_padrao"          // até 3 kVA
  | "residencial_alto_padrao"     // 3–15 kVA
  | "comercial_pequeno"           // 5–20 kVA
  | "comercial_medio"             // 20–75 kVA
  | "industrial_pequeno"          // 30–100 kVA
  | "carregador_ve"               // veículo elétrico
  | "outro";

/** Fator de demanda típico por tipo de carga (NBR 5410 / PRODIST Mod. 8). */
const FATOR_DEMANDA: Record<TipoCarga, number> = {
  residencial_padrao:      0.65,
  residencial_alto_padrao: 0.55,
  comercial_pequeno:       0.70,
  comercial_medio:         0.75,
  industrial_pequeno:      0.80,
  carregador_ve:           0.90,
  outro:                   0.75,
};

export type StatusSimulacao = "rascunho" | "simulado" | "aprovado";

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface CargaExistente {
  descricao: string;
  potenciaKva: number;
  fatorDemanda?: number; // sobrescreve o padrão por tipo
}

export interface NovaCarga {
  descricao: string;
  tipoCarga: TipoCarga;
  potenciaKva: number;
  quantidade: number;
  fatorCoincidencia?: number; // 0–1; default 1.0
}

export interface ResultadoSimulacao {
  transformadorKva: number;
  demandaExistenteKw: number;
  demandaNovaKw: number;
  demandaTotalKw: number;
  carregamentoAtualPct: number;
  carregamentoPrevistoPct: number;
  margemDisponivelKw: number;
  limiteCarregamentoPct: number;
  viavel: boolean;
  recomendacao: string;
  simuladoEm: Date;
}

export interface SimulacaoExpansao {
  id: string;
  nome: string;
  tenantId: string;
  projetoId?: string;
  transformadorKva: number;
  cargasExistentes: CargaExistente[];
  novasCargas: NovaCarga[];
  resultado?: ResultadoSimulacao;
  status: StatusSimulacao;
  observacoes?: string;
  criadoEm: Date;
  atualizadoEm: Date;
}

// ─── Estado interno ───────────────────────────────────────────────────────────

let simulacoes: Map<string, SimulacaoExpansao> = new Map();
let contador = 0;

// ─── Serviço ──────────────────────────────────────────────────────────────────

export class ExpansaoCargasService {
  static _reset(): void {
    simulacoes = new Map();
    contador = 0;
  }

  static criarSimulacao(params: {
    nome: string;
    tenantId: string;
    projetoId?: string;
    transformadorKva: number;
    observacoes?: string;
  }): SimulacaoExpansao | { erro: string } {
    if (params.transformadorKva <= 0) return { erro: "Potência do transformador deve ser maior que zero" };
    const id = `sim-${++contador}`;
    const agora = new Date();
    const sim: SimulacaoExpansao = {
      id,
      nome: params.nome,
      tenantId: params.tenantId,
      projetoId: params.projetoId,
      transformadorKva: params.transformadorKva,
      cargasExistentes: [],
      novasCargas: [],
      status: "rascunho",
      observacoes: params.observacoes,
      criadoEm: agora,
      atualizadoEm: agora,
    };
    simulacoes.set(id, sim);
    return sim;
  }

  static listarSimulacoes(tenantId: string): SimulacaoExpansao[] {
    return Array.from(simulacoes.values()).filter((s) => s.tenantId === tenantId);
  }

  static obterSimulacao(id: string): SimulacaoExpansao | null {
    return simulacoes.get(id) ?? null;
  }

  static adicionarCargaExistente(
    id: string,
    carga: CargaExistente
  ): SimulacaoExpansao | null {
    const sim = simulacoes.get(id);
    if (!sim) return null;
    sim.cargasExistentes.push(carga);
    sim.resultado = undefined;
    sim.atualizadoEm = new Date();
    return sim;
  }

  static adicionarNovaCarga(
    id: string,
    carga: NovaCarga
  ): SimulacaoExpansao | null {
    const sim = simulacoes.get(id);
    if (!sim) return null;
    sim.novasCargas.push(carga);
    sim.resultado = undefined;
    sim.atualizadoEm = new Date();
    return sim;
  }

  static simular(id: string): SimulacaoExpansao | { erro: string } {
    const sim = simulacoes.get(id);
    if (!sim) return { erro: "Simulação não encontrada" };

    // Demanda existente: soma ponderada pelo fator de demanda individual
    const demandaExistente = sim.cargasExistentes.reduce((acc, c) => {
      return acc + c.potenciaKva * (c.fatorDemanda ?? 0.75);
    }, 0);

    // Demanda nova: potência × fatorDemanda × quantidade × fatorCoincidência
    const demandaNova = sim.novasCargas.reduce((acc, c) => {
      const fd = FATOR_DEMANDA[c.tipoCarga] ?? 0.75;
      const fc = c.fatorCoincidencia ?? 1.0;
      return acc + c.potenciaKva * fd * c.quantidade * fc;
    }, 0);

    const demandaTotal = demandaExistente + demandaNova;
    const carregamentoAtual = sim.transformadorKva > 0
      ? (demandaExistente / sim.transformadorKva) * 100
      : 0;
    const carregamentoPrevisto = sim.transformadorKva > 0
      ? (demandaTotal / sim.transformadorKva) * 100
      : 0;
    const margemDisponivel = Math.max(
      0,
      sim.transformadorKva * (LIMITE_CARREGAMENTO_PCT / 100) - demandaTotal
    );
    const viavel = carregamentoPrevisto <= LIMITE_CARREGAMENTO_PCT;

    let recomendacao: string;
    if (viavel) {
      recomendacao = `Expansão viável. Carregamento previsto: ${carregamentoPrevisto.toFixed(1)}% (limite ${LIMITE_CARREGAMENTO_PCT}%). Margem disponível: ${margemDisponivel.toFixed(1)} kW.`;
    } else {
      const kvaSubstituto = Math.ceil(demandaTotal / (LIMITE_CARREGAMENTO_PCT / 100) / 10) * 10;
      recomendacao = `Expansão INVIÁVEL. Carregamento previsto ${carregamentoPrevisto.toFixed(1)}% excede o limite de ${LIMITE_CARREGAMENTO_PCT}%. Substituir transformador por ${kvaSubstituto} kVA ou superior.`;
    }

    sim.resultado = {
      transformadorKva: sim.transformadorKva,
      demandaExistenteKw: parseFloat(demandaExistente.toFixed(2)),
      demandaNovaKw: parseFloat(demandaNova.toFixed(2)),
      demandaTotalKw: parseFloat(demandaTotal.toFixed(2)),
      carregamentoAtualPct: parseFloat(carregamentoAtual.toFixed(2)),
      carregamentoPrevistoPct: parseFloat(carregamentoPrevisto.toFixed(2)),
      margemDisponivelKw: parseFloat(margemDisponivel.toFixed(2)),
      limiteCarregamentoPct: LIMITE_CARREGAMENTO_PCT,
      viavel,
      recomendacao,
      simuladoEm: new Date(),
    };
    sim.status = "simulado";
    sim.atualizadoEm = new Date();
    return sim;
  }

  static aprovarSimulacao(id: string): SimulacaoExpansao | { erro: string } {
    const sim = simulacoes.get(id);
    if (!sim) return { erro: "Simulação não encontrada" };
    if (sim.status !== "simulado") return { erro: "Execute a simulação antes de aprovar" };
    sim.status = "aprovado";
    sim.atualizadoEm = new Date();
    return sim;
  }
}
