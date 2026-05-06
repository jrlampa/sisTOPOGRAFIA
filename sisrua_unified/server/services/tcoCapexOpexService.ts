/**
 * T2-105 — Simulador de Impacto Financeiro (TCO/Capex/Opex)
 * Análise de Custo Total de Propriedade com TIR, VPL e Payback para
 * investimentos em infraestrutura elétrica.
 *
 * Referências normativas:
 * - ABNT NBR 16660:2017 — Gestão de Ativos — Aspectos financeiros
 * - IEC 60300-3-3:2017 — Dependability management — Life cycle costing
 * - ANEEL Nota Técnica 49/2020 — Avaliação de Investimentos
 * - ABNT NBR 15575:2013 — Desempenho de edificações (referência de VPL/TIR)
 * - ISO 31000:2018 — Gestão de Riscos (análise de sensibilidade)
 */

import { createHash } from "crypto";

// ---------------------------------------------------------------------------
// Tipos e interfaces
// ---------------------------------------------------------------------------

/** Tipo de investimento */
export type TipoInvestimento =
  | "nova_rede"
  | "expansao_rede"
  | "modernizacao"
  | "digitalizacao"
  | "automacao"
  | "smart_grid"
  | "microgeracao"
  | "reducao_perdas"
  | "outro";

/** Status da simulação TCO */
export type StatusSimulacaoTCO = "rascunho" | "calculado" | "aprovado";

/** Item de CAPEX (investimento inicial) */
export interface ItemCapex {
  id: string;
  descricao: string;
  categoria: string;
  /** Ano do desembolso (0 = ano base) */
  anoDesembolso: number;
  valorReais: number;
  criadoEm: string;
}

/** Item de OPEX (custo operacional anual) */
export interface ItemOpex {
  id: string;
  descricao: string;
  categoria: string;
  /** Custo anual em R$ */
  custoAnual: number;
  /** Ano de início (1 = primeiro ano de operação) */
  anoInicio: number;
  /** Ano de fim (null = até fim do horizonte) */
  anoFim: number | null;
  /** Taxa de crescimento anual (ex: 0.03 = 3% a.a.) */
  taxaCrescimentoAnual: number;
  criadoEm: string;
}

/** Resultado do cálculo TCO */
export interface ResultadoTCO {
  /** Total CAPEX nominal */
  capexTotal: number;
  /** Total OPEX nominal ao longo do horizonte */
  opexTotal: number;
  /** TCO nominal = CAPEX + OPEX */
  tcoNominal: number;
  /** VPL do TCO (custos) */
  vplTCO: number;
  /** VPL dos benefícios esperados (se informado) */
  vplBeneficios: number;
  /** VPL líquido = benefícios - custos */
  vplLiquido: number;
  /** Payback simples (anos) — null se não atingido no horizonte */
  paybackSimples: number | null;
  /** Payback descontado (anos) — null se não atingido */
  paybackDescontado: number | null;
  /** TIR aproximada por bissecção numérica */
  tir: number | null;
  horizonte: number;
  taxaDesconto: number;
  viavel: boolean;
  hashIntegridade: string;
  calculadoEm: string;
}

/** Simulação TCO completa */
export interface SimulacaoTCO {
  id: string;
  tenantId: string;
  titulo: string;
  tipoInvestimento: TipoInvestimento;
  horizonte: number;
  taxaDesconto: number;
  /** Benefícios anuais esperados (R$) por ano (index 1..horizonte) */
  beneficiosAnuais: Record<number, number>;
  itensCapex: ItemCapex[];
  itensOpex: ItemOpex[];
  resultado: ResultadoTCO | null;
  status: StatusSimulacaoTCO;
  responsavel: string;
  criadoEm: string;
  atualizadoEm: string;
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

/** Taxa WACC regulatório ANEEL como padrão */
const TAXA_DESCONTO_PADRAO = 0.0728;

/** Horizonte máximo de análise em anos */
const HORIZONTE_MAXIMO = 30;

// ---------------------------------------------------------------------------
// Serviço
// ---------------------------------------------------------------------------

export class TcoCapexOpexService {
  private static simulacoes = new Map<string, SimulacaoTCO>();
  private static counter = 0;
  private static cxCounter = 0;
  private static oxCounter = 0;

  static _reset(): void {
    TcoCapexOpexService.simulacoes = new Map();
    TcoCapexOpexService.counter = 0;
    TcoCapexOpexService.cxCounter = 0;
    TcoCapexOpexService.oxCounter = 0;
  }

  // -------------------------------------------------------------------------
  // Criação
  // -------------------------------------------------------------------------

  static criarSimulacao(
    tenantId: string,
    titulo: string,
    tipoInvestimento: TipoInvestimento,
    responsavel: string,
    horizonte?: number,
    taxaDesconto?: number
  ): SimulacaoTCO {
    TcoCapexOpexService.counter += 1;
    const agora = new Date().toISOString();

    const sim: SimulacaoTCO = {
      id: `tco-${TcoCapexOpexService.counter}`,
      tenantId,
      titulo,
      tipoInvestimento,
      horizonte: Math.min(horizonte ?? 20, HORIZONTE_MAXIMO),
      taxaDesconto: taxaDesconto ?? TAXA_DESCONTO_PADRAO,
      beneficiosAnuais: {},
      itensCapex: [],
      itensOpex: [],
      resultado: null,
      status: "rascunho",
      responsavel,
      criadoEm: agora,
      atualizadoEm: agora,
    };

    TcoCapexOpexService.simulacoes.set(sim.id, sim);
    return sim;
  }

  // -------------------------------------------------------------------------
  // Consulta
  // -------------------------------------------------------------------------

  static listarSimulacoes(tenantId?: string): SimulacaoTCO[] {
    const lista = Array.from(TcoCapexOpexService.simulacoes.values());
    if (tenantId) return lista.filter((s) => s.tenantId === tenantId);
    return lista;
  }

  static obterSimulacao(id: string): SimulacaoTCO | null {
    return TcoCapexOpexService.simulacoes.get(id) ?? null;
  }

  // -------------------------------------------------------------------------
  // Itens CAPEX / OPEX
  // -------------------------------------------------------------------------

  static adicionarCapex(
    simId: string,
    descricao: string,
    categoria: string,
    anoDesembolso: number,
    valorReais: number
  ): ItemCapex {
    const sim = TcoCapexOpexService.simulacoes.get(simId);
    if (!sim) throw new Error(`Simulação ${simId} não encontrada`);
    if (sim.status === "aprovado") {
      throw new Error("Simulação aprovada não permite alterações");
    }

    TcoCapexOpexService.cxCounter += 1;
    const item: ItemCapex = {
      id: `cx-${TcoCapexOpexService.cxCounter}`,
      descricao,
      categoria,
      anoDesembolso,
      valorReais,
      criadoEm: new Date().toISOString(),
    };

    sim.itensCapex.push(item);
    sim.resultado = null;
    sim.status = "rascunho";
    sim.atualizadoEm = new Date().toISOString();
    return item;
  }

  static adicionarOpex(
    simId: string,
    descricao: string,
    categoria: string,
    custoAnual: number,
    anoInicio: number,
    anoFim: number | null,
    taxaCrescimentoAnual: number
  ): ItemOpex {
    const sim = TcoCapexOpexService.simulacoes.get(simId);
    if (!sim) throw new Error(`Simulação ${simId} não encontrada`);
    if (sim.status === "aprovado") {
      throw new Error("Simulação aprovada não permite alterações");
    }

    TcoCapexOpexService.oxCounter += 1;
    const item: ItemOpex = {
      id: `ox-${TcoCapexOpexService.oxCounter}`,
      descricao,
      categoria,
      custoAnual,
      anoInicio,
      anoFim,
      taxaCrescimentoAnual,
      criadoEm: new Date().toISOString(),
    };

    sim.itensOpex.push(item);
    sim.resultado = null;
    sim.status = "rascunho";
    sim.atualizadoEm = new Date().toISOString();
    return item;
  }

  static definirBeneficios(
    simId: string,
    beneficiosAnuais: Record<number, number>
  ): SimulacaoTCO {
    const sim = TcoCapexOpexService.simulacoes.get(simId);
    if (!sim) throw new Error(`Simulação ${simId} não encontrada`);
    if (sim.status === "aprovado") {
      throw new Error("Simulação aprovada não permite alterações");
    }

    sim.beneficiosAnuais = { ...beneficiosAnuais };
    sim.resultado = null;
    sim.status = "rascunho";
    sim.atualizadoEm = new Date().toISOString();
    return sim;
  }

  // -------------------------------------------------------------------------
  // Cálculo TCO / TIR / VPL / Payback
  // -------------------------------------------------------------------------

  static calcularTCO(simId: string): ResultadoTCO {
    const sim = TcoCapexOpexService.simulacoes.get(simId);
    if (!sim) throw new Error(`Simulação ${simId} não encontrada`);
    if (sim.itensCapex.length === 0 && sim.itensOpex.length === 0) {
      throw new Error("Simulação não possui itens CAPEX ou OPEX");
    }

    const { horizonte, taxaDesconto } = sim;

    // Fluxo de caixa de custos por ano (0..horizonte)
    const fluxoCustos: number[] = new Array(horizonte + 1).fill(0);

    // CAPEX
    let capexTotal = 0;
    for (const cx of sim.itensCapex) {
      const ano = Math.min(cx.anoDesembolso, horizonte);
      fluxoCustos[ano] += cx.valorReais;
      capexTotal += cx.valorReais;
    }

    // OPEX
    let opexTotal = 0;
    for (const ox of sim.itensOpex) {
      const fim = ox.anoFim ?? horizonte;
      for (let ano = ox.anoInicio; ano <= Math.min(fim, horizonte); ano++) {
        const anos = ano - ox.anoInicio;
        const custo =
          ox.custoAnual * Math.pow(1 + ox.taxaCrescimentoAnual, anos);
        fluxoCustos[ano] += custo;
        opexTotal += custo;
      }
    }

    // Fluxo de benefícios
    const fluxoBeneficios: number[] = new Array(horizonte + 1).fill(0);
    for (const [anoStr, valor] of Object.entries(sim.beneficiosAnuais)) {
      const ano = parseInt(anoStr, 10);
      if (ano >= 0 && ano <= horizonte) {
        fluxoBeneficios[ano] = valor;
      }
    }

    // VPL dos custos
    let vplTCO = 0;
    for (let ano = 0; ano <= horizonte; ano++) {
      vplTCO += fluxoCustos[ano] / Math.pow(1 + taxaDesconto, ano);
    }

    // VPL dos benefícios
    let vplBeneficios = 0;
    for (let ano = 0; ano <= horizonte; ano++) {
      vplBeneficios +=
        fluxoBeneficios[ano] / Math.pow(1 + taxaDesconto, ano);
    }

    const vplLiquido = vplBeneficios - vplTCO;
    const tcoNominal = capexTotal + opexTotal;

    // Payback simples
    let acumSimples = 0;
    let paybackSimples: number | null = null;
    for (let ano = 1; ano <= horizonte; ano++) {
      acumSimples += fluxoBeneficios[ano] - fluxoCustos[ano];
      if (acumSimples >= capexTotal && paybackSimples === null) {
        paybackSimples = ano;
      }
    }

    // Payback descontado
    let acumDesc = -fluxoCustos[0];
    let paybackDescontado: number | null = null;
    for (let ano = 1; ano <= horizonte; ano++) {
      const fvp = 1 / Math.pow(1 + taxaDesconto, ano);
      acumDesc += (fluxoBeneficios[ano] - fluxoCustos[ano]) * fvp;
      if (acumDesc >= 0 && paybackDescontado === null) {
        paybackDescontado = ano;
      }
    }

    // TIR por bissecção numérica
    const fluxoLiquido = fluxoCustos.map(
      (c, i) => fluxoBeneficios[i] - c
    );
    const tir = TcoCapexOpexService._calcularTIR(fluxoLiquido);

    const viavel = vplLiquido >= 0;

    const calculadoEm = new Date().toISOString();
    const payload = JSON.stringify({
      simId,
      vplLiquido,
      tir,
      calculadoEm,
    });
    const hashIntegridade = createHash("sha256").update(payload).digest("hex");

    const resultado: ResultadoTCO = {
      capexTotal,
      opexTotal,
      tcoNominal,
      vplTCO,
      vplBeneficios,
      vplLiquido,
      paybackSimples,
      paybackDescontado,
      tir,
      horizonte,
      taxaDesconto,
      viavel,
      hashIntegridade,
      calculadoEm,
    };

    sim.resultado = resultado;
    sim.status = "calculado";
    sim.atualizadoEm = calculadoEm;

    return resultado;
  }

  /** Bissecção numérica para TIR (taxa no qual VPL = 0) */
  private static _calcularTIR(
    fluxos: number[],
    iteracoes = 100,
    tolerancia = 1e-6
  ): number | null {
    const vpn = (taxa: number) =>
      fluxos.reduce(
        (s, fc, i) => s + fc / Math.pow(1 + taxa, i),
        0
      );

    let low = -0.9999;
    let high = 10.0;

    if (vpn(low) * vpn(high) > 0) return null;

    for (let i = 0; i < iteracoes; i++) {
      const mid = (low + high) / 2;
      const v = vpn(mid);
      if (Math.abs(v) < tolerancia) return Math.round(mid * 10000) / 10000;
      if (vpn(low) * v < 0) high = mid;
      else low = mid;
    }

    return Math.round(((low + high) / 2) * 10000) / 10000;
  }

  // -------------------------------------------------------------------------
  // Aprovação
  // -------------------------------------------------------------------------

  static aprovarSimulacao(simId: string): SimulacaoTCO {
    const sim = TcoCapexOpexService.simulacoes.get(simId);
    if (!sim) throw new Error(`Simulação ${simId} não encontrada`);
    if (sim.status !== "calculado") {
      throw new Error("Simulação deve estar calculada antes de aprovar");
    }

    sim.status = "aprovado";
    sim.atualizadoEm = new Date().toISOString();
    return sim;
  }

  // -------------------------------------------------------------------------
  // Auxiliares
  // -------------------------------------------------------------------------

  static listarTiposInvestimento(): TipoInvestimento[] {
    return [
      "nova_rede",
      "expansao_rede",
      "modernizacao",
      "digitalizacao",
      "automacao",
      "smart_grid",
      "microgeracao",
      "reducao_perdas",
      "outro",
    ];
  }
}
