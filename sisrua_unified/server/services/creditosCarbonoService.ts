/**
 * creditosCarbonoService.ts — Calculadora de Créditos de Carbono (T2-47).
 *
 * Roadmap Item 47 [T2]: Quantificação da economia de CO2 gerada pela
 * otimização de redes de distribuição elétrica e ações de compensação.
 *
 * Referências:
 *   - VCS (Verified Carbon Standard) — Verra, metodologias AM0046 e AMS-II.L
 *   - CETESB 2023: emissão veículos diesel 2,68 kgCO2eq/km
 *   - FE SIN Brasil 2023 (ONS): 0,0728 tCO2eq/MWh
 *   - Mercado voluntário de carbono Brasil (2023): R$80/tCO2eq referencial
 *   - IMA florestal: ~20 anos para sequestro estimado por plantio
 */

import { createHash } from "crypto";

// ─── Tipos de ação e fatores de emissão ──────────────────────────────────────

export type TipoAcaoReducao =
  | "trocar_luminaria_convencional_led"
  | "reducao_perdas_rede"
  | "substituicao_veiculo_diesel"
  | "plantio_compensatorio_arvores"
  | "reflorestamento_ha";

export type StatusCalculo = "rascunho" | "calculado" | "certificado";

/** Fator de redução de emissão (tCO2eq) por unidade de cada tipo de ação. */
export const FATORES_REDUCAO: Record<TipoAcaoReducao, {
  fatorTonCo2eqPorUnidade: number;
  unidade: string;
  descricaoFator: string;
  metodologiaRef: string;
}> = {
  trocar_luminaria_convencional_led: {
    fatorTonCo2eqPorUnidade: 0.2,
    unidade: "luminária",
    descricaoFator: "0,20 tCO2eq/luminária (economia de ~800kWh/ano, 25 anos, FE SIN 2023)",
    metodologiaRef: "AMS-II.L (VCS) + FE SIN ONS 2023",
  },
  reducao_perdas_rede: {
    fatorTonCo2eqPorUnidade: 0.0728,
    unidade: "MWh",
    descricaoFator: "0,0728 tCO2eq/MWh (FE SIN Brasil 2023 — ONS)",
    metodologiaRef: "FE SIN ONS 2023",
  },
  substituicao_veiculo_diesel: {
    fatorTonCo2eqPorUnidade: 0.00268,
    unidade: "km",
    descricaoFator: "0,00268 tCO2eq/km (CETESB 2023 — veículo diesel leve)",
    metodologiaRef: "CETESB Fatores de Emissão 2023",
  },
  plantio_compensatorio_arvores: {
    fatorTonCo2eqPorUnidade: 0.02,
    unidade: "árvore",
    descricaoFator: "0,02 tCO2eq/árvore (fixação estimada em 20 anos, IMA florestal)",
    metodologiaRef: "IMA Florestal Médio (espécies nativas brasileiras)",
  },
  reflorestamento_ha: {
    fatorTonCo2eqPorUnidade: 8.5,
    unidade: "ha",
    descricaoFator: "8,50 tCO2eq/ha (fixação em 20 anos, REDD+/VCS)",
    metodologiaRef: "REDD+ Verra VCS — florestas tropicais brasileiras",
  },
};

/** Preço referencial do mercado voluntário de carbono Brasil 2023 (R$/tCO2eq). */
export const PRECO_REFERENCIA_BRL_POR_TON = 80;

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface AcaoReducao {
  id: string;
  tipo: TipoAcaoReducao;
  descricao?: string;
  quantidade: number;
  reducaoTonCo2eq: number;
}

export interface ResultadoCredito {
  totalReducaoTonCo2eq: number;
  valorEstimadoBrl: number;
  precoReferencialBrl: number;
  distribuicaoPorAcao: Record<string, number>;
  hashIntegridade: string;
  calculadoEm: Date;
}

export interface CalculoCredito {
  id: string;
  nome: string;
  tenantId: string;
  projetoId?: string;
  acoes: AcaoReducao[];
  resultado?: ResultadoCredito;
  certificadoUrl?: string;
  status: StatusCalculo;
  criadoEm: Date;
  atualizadoEm: Date;
}

// ─── Estado interno ───────────────────────────────────────────────────────────

let calculos: Map<string, CalculoCredito> = new Map();
let contadorCalculo = 0;
let contadorAcao = 0;

// ─── Serviço ──────────────────────────────────────────────────────────────────

export class CreditosCarbonoService {
  static _reset(): void {
    calculos = new Map();
    contadorCalculo = 0;
    contadorAcao = 0;
  }

  static criarCalculo(params: {
    nome: string;
    tenantId: string;
    projetoId?: string;
  }): CalculoCredito {
    const id = `cc-${++contadorCalculo}`;
    const agora = new Date();
    const calculo: CalculoCredito = {
      id,
      nome: params.nome,
      tenantId: params.tenantId,
      projetoId: params.projetoId,
      acoes: [],
      status: "rascunho",
      criadoEm: agora,
      atualizadoEm: agora,
    };
    calculos.set(id, calculo);
    return calculo;
  }

  static listarCalculos(tenantId: string): CalculoCredito[] {
    return Array.from(calculos.values()).filter((c) => c.tenantId === tenantId);
  }

  static obterCalculo(id: string): CalculoCredito | null {
    return calculos.get(id) ?? null;
  }

  static adicionarAcao(
    calculoId: string,
    params: {
      tipo: TipoAcaoReducao;
      quantidade: number;
      descricao?: string;
    }
  ): CalculoCredito | null {
    const calc = calculos.get(calculoId);
    if (!calc) return null;
    const fator = FATORES_REDUCAO[params.tipo];
    const acao: AcaoReducao = {
      id: `acao-${++contadorAcao}`,
      tipo: params.tipo,
      descricao: params.descricao ?? fator.descricaoFator,
      quantidade: params.quantidade,
      reducaoTonCo2eq: parseFloat((params.quantidade * fator.fatorTonCo2eqPorUnidade).toFixed(4)),
    };
    calc.acoes.push(acao);
    calc.status = "rascunho";
    calc.resultado = undefined;
    calc.atualizadoEm = new Date();
    return calc;
  }

  static calcular(id: string): CalculoCredito | { erro: string } {
    const calc = calculos.get(id);
    if (!calc) return { erro: "Cálculo não encontrado" };
    if (calc.acoes.length === 0) return { erro: "Nenhuma ação de redução cadastrada" };

    const distribuicao: Record<string, number> = {};
    let totalReducao = 0;

    for (const acao of calc.acoes) {
      totalReducao += acao.reducaoTonCo2eq;
      distribuicao[acao.tipo] = (distribuicao[acao.tipo] ?? 0) + acao.reducaoTonCo2eq;
    }

    for (const k of Object.keys(distribuicao)) {
      distribuicao[k] = parseFloat(distribuicao[k].toFixed(4));
    }

    const valorEstimado = parseFloat((totalReducao * PRECO_REFERENCIA_BRL_POR_TON).toFixed(2));

    const hashIntegridade = createHash("sha256")
      .update(JSON.stringify({ calculoId: id, totalReducao, distribuicao }))
      .digest("hex");

    calc.resultado = {
      totalReducaoTonCo2eq: parseFloat(totalReducao.toFixed(4)),
      valorEstimadoBrl: valorEstimado,
      precoReferencialBrl: PRECO_REFERENCIA_BRL_POR_TON,
      distribuicaoPorAcao: distribuicao,
      hashIntegridade,
      calculadoEm: new Date(),
    };
    calc.status = "calculado";
    calc.atualizadoEm = new Date();
    return calc;
  }

  static emitirCertificado(id: string): CalculoCredito | null {
    const calc = calculos.get(id);
    if (!calc || calc.status !== "calculado") return null;
    calc.status = "certificado";
    calc.certificadoUrl = `https://registros.sisrua.com.br/creditos-carbono/${id}`;
    calc.atualizadoEm = new Date();
    return calc;
  }

  static listarTiposAcao(): {
    tipo: TipoAcaoReducao;
    unidade: string;
    fatorTonCo2eqPorUnidade: number;
    metodologiaRef: string;
  }[] {
    return (Object.entries(FATORES_REDUCAO) as [TipoAcaoReducao, typeof FATORES_REDUCAO[TipoAcaoReducao]][]).map(
      ([tipo, f]) => ({
        tipo,
        unidade: f.unidade,
        fatorTonCo2eqPorUnidade: f.fatorTonCo2eqPorUnidade,
        metodologiaRef: f.metodologiaRef,
      })
    );
  }
}
