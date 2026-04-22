/**
 * T2-94 — Gestão de Custos LCC por Família de Equipamentos
 * Análise de Custo do Ciclo de Vida por família de ativos de rede elétrica BT/MT.
 *
 * Referências normativas:
 * - ANEEL REN 905/2020 — Base de Remuneração de Ativos
 * - ABNT NBR 15688:2017 — Análise de Custo do Ciclo de Vida de Ativos
 * - MCPSE ANEEL — Metodologia de Cálculo do PMSO e Remuneração de Capital
 * - IEC 60300-3-3:2017 — Life Cycle Costing
 * - ABNT NBR 16660:2017 — Gestão de Ativos
 */

import { createHash } from "crypto";

// ---------------------------------------------------------------------------
// Tipos e interfaces
// ---------------------------------------------------------------------------

/** Famílias de equipamentos de rede elétrica */
export type FamiliaEquipamento =
  | "poste_concreto"
  | "poste_madeira"
  | "poste_ferro"
  | "transformador_monofasico"
  | "transformador_trifasico"
  | "cabo_multiplexado"
  | "cabo_nu"
  | "chave_fusivel"
  | "religador"
  | "medidor";

/** Status da análise LCC */
export type StatusAnalise = "rascunho" | "calculado" | "publicado";

/** Equipamento individual dentro de uma análise */
export interface EquipamentoLCC {
  id: string;
  familia: FamiliaEquipamento;
  descricao: string;
  quantidade: number;
  /** Custo unitário de aquisição (R$) */
  custoAquisicaoUnitario: number;
  /** Custo unitário de instalação (R$) */
  custoInstalacaoUnitario: number;
  /** Custo anual de manutenção por unidade (R$) */
  custoManutencaoAnual: number;
  /** Custo de substituição ao fim da vida útil (R$) */
  custoSubstituicao: number;
  /** Custo de descarte/destinação final (R$) */
  custoDescarte: number;
  /** Vida útil em anos (conforme ANEEL) */
  vidaUtilAnos: number;
  criadoEm: string;
}

/** Resultado do cálculo LCC */
export interface ResultadoLCC {
  custoTotal: number;
  custoAquisicaoTotal: number;
  custoInstalacaoTotal: number;
  custoManutencaoTotal: number;
  custoSubstituicaoTotal: number;
  custoDescarteTotal: number;
  /** VPL dos custos ao longo do horizonte de análise */
  vplTotal: number;
  horizonte: number;
  taxaDesconto: number;
  hashIntegridade: string;
  calculadoEm: string;
}

/** Análise LCC principal */
export interface AnaliseLCC {
  id: string;
  tenantId: string;
  titulo: string;
  descricao: string;
  horizonte: number;
  /** Taxa de desconto anual (ex: 0.0728 para 7,28% WACC ANEEL) */
  taxaDesconto: number;
  equipamentos: EquipamentoLCC[];
  resultado: ResultadoLCC | null;
  status: StatusAnalise;
  responsavel: string;
  criadoEm: string;
  atualizadoEm: string;
}

// ---------------------------------------------------------------------------
// Constantes regulatórias
// ---------------------------------------------------------------------------

/** Taxa WACC regulatório ANEEL (7ª Revisão Periódica) */
const WACC_REGULATORIO = 0.0728;

/** Vida útil padrão por família (anos) — ANEEL REN 905/2020 */
const VIDA_UTIL_PADRAO: Record<FamiliaEquipamento, number> = {
  poste_concreto: 40,
  poste_madeira: 30,
  poste_ferro: 50,
  transformador_monofasico: 35,
  transformador_trifasico: 35,
  cabo_multiplexado: 30,
  cabo_nu: 35,
  chave_fusivel: 25,
  religador: 30,
  medidor: 15,
};

// ---------------------------------------------------------------------------
// Serviço
// ---------------------------------------------------------------------------

export class LccFamiliaService {
  private static analises = new Map<string, AnaliseLCC>();
  private static counter = 0;
  private static equCounter = 0;

  static _reset(): void {
    LccFamiliaService.analises = new Map();
    LccFamiliaService.counter = 0;
    LccFamiliaService.equCounter = 0;
  }

  // -------------------------------------------------------------------------
  // Criação
  // -------------------------------------------------------------------------

  static criarAnalise(
    tenantId: string,
    titulo: string,
    descricao: string,
    responsavel: string,
    horizonte?: number,
    taxaDesconto?: number
  ): AnaliseLCC {
    LccFamiliaService.counter += 1;
    const id = `lf-${LccFamiliaService.counter}`;
    const agora = new Date().toISOString();

    const analise: AnaliseLCC = {
      id,
      tenantId,
      titulo,
      descricao,
      horizonte: horizonte ?? 30,
      taxaDesconto: taxaDesconto ?? WACC_REGULATORIO,
      equipamentos: [],
      resultado: null,
      status: "rascunho",
      responsavel,
      criadoEm: agora,
      atualizadoEm: agora,
    };

    LccFamiliaService.analises.set(id, analise);
    return analise;
  }

  // -------------------------------------------------------------------------
  // Consulta
  // -------------------------------------------------------------------------

  static listarAnalises(tenantId?: string): AnaliseLCC[] {
    const lista = Array.from(LccFamiliaService.analises.values());
    if (tenantId) return lista.filter((a) => a.tenantId === tenantId);
    return lista;
  }

  static obterAnalise(id: string): AnaliseLCC | null {
    return LccFamiliaService.analises.get(id) ?? null;
  }

  // -------------------------------------------------------------------------
  // Equipamentos
  // -------------------------------------------------------------------------

  static adicionarEquipamento(
    analiseId: string,
    familia: FamiliaEquipamento,
    descricao: string,
    quantidade: number,
    custoAquisicaoUnitario: number,
    custoInstalacaoUnitario: number,
    custoManutencaoAnual: number,
    custoSubstituicao: number,
    custoDescarte: number,
    vidaUtilAnos?: number
  ): EquipamentoLCC {
    const analise = LccFamiliaService.analises.get(analiseId);
    if (!analise) throw new Error(`Análise ${analiseId} não encontrada`);
    if (analise.status === "publicado") {
      throw new Error("Análise publicada não permite alterações");
    }

    LccFamiliaService.equCounter += 1;
    const eq: EquipamentoLCC = {
      id: `eq-${LccFamiliaService.equCounter}`,
      familia,
      descricao,
      quantidade,
      custoAquisicaoUnitario,
      custoInstalacaoUnitario,
      custoManutencaoAnual,
      custoSubstituicao,
      custoDescarte,
      vidaUtilAnos: vidaUtilAnos ?? VIDA_UTIL_PADRAO[familia],
      criadoEm: new Date().toISOString(),
    };

    analise.equipamentos.push(eq);
    analise.status = "rascunho";
    analise.resultado = null;
    analise.atualizadoEm = new Date().toISOString();

    return eq;
  }

  // -------------------------------------------------------------------------
  // Cálculo LCC (VPL)
  // -------------------------------------------------------------------------

  static calcularLCC(analiseId: string): ResultadoLCC {
    const analise = LccFamiliaService.analises.get(analiseId);
    if (!analise) throw new Error(`Análise ${analiseId} não encontrada`);
    if (analise.equipamentos.length === 0) {
      throw new Error("Análise não possui equipamentos cadastrados");
    }

    const { horizonte, taxaDesconto, equipamentos } = analise;

    let custoAquisicaoTotal = 0;
    let custoInstalacaoTotal = 0;
    let custoManutencaoVPL = 0;
    let custoSubstituicaoVPL = 0;
    let custoDescarteVPL = 0;

    for (const eq of equipamentos) {
      const qtd = eq.quantidade;
      // Custos no ano 0 (imediatos)
      custoAquisicaoTotal += eq.custoAquisicaoUnitario * qtd;
      custoInstalacaoTotal += eq.custoInstalacaoUnitario * qtd;

      // VPL dos custos anuais de manutenção
      for (let ano = 1; ano <= horizonte; ano++) {
        const fvp = 1 / Math.pow(1 + taxaDesconto, ano);
        custoManutencaoVPL += eq.custoManutencaoAnual * qtd * fvp;
      }

      // Substituições ao longo do horizonte (a cada vidaUtilAnos)
      let anoSubs = eq.vidaUtilAnos;
      while (anoSubs <= horizonte) {
        const fvp = 1 / Math.pow(1 + taxaDesconto, anoSubs);
        custoSubstituicaoVPL += eq.custoSubstituicao * qtd * fvp;
        anoSubs += eq.vidaUtilAnos;
      }

      // Descarte ao fim do horizonte
      const fvpDescarte = 1 / Math.pow(1 + taxaDesconto, horizonte);
      custoDescarteVPL += eq.custoDescarte * qtd * fvpDescarte;
    }

    const vplTotal =
      custoAquisicaoTotal +
      custoInstalacaoTotal +
      custoManutencaoVPL +
      custoSubstituicaoVPL +
      custoDescarteVPL;

    const calculadoEm = new Date().toISOString();
    const payload = JSON.stringify({
      analiseId,
      vplTotal,
      horizonte,
      taxaDesconto,
      calculadoEm,
    });
    const hashIntegridade = createHash("sha256").update(payload).digest("hex");

    const resultado: ResultadoLCC = {
      custoTotal:
        custoAquisicaoTotal +
        custoInstalacaoTotal +
        (equipamentos.reduce(
          (s, e) =>
            s +
            e.custoManutencaoAnual * e.quantidade * horizonte +
            e.custoSubstituicao * e.quantidade +
            e.custoDescarte * e.quantidade,
          0
        )),
      custoAquisicaoTotal,
      custoInstalacaoTotal,
      custoManutencaoTotal: custoManutencaoVPL,
      custoSubstituicaoTotal: custoSubstituicaoVPL,
      custoDescarteTotal: custoDescarteVPL,
      vplTotal,
      horizonte,
      taxaDesconto,
      hashIntegridade,
      calculadoEm,
    };

    analise.resultado = resultado;
    analise.status = "calculado";
    analise.atualizadoEm = calculadoEm;

    return resultado;
  }

  // -------------------------------------------------------------------------
  // Publicação
  // -------------------------------------------------------------------------

  static publicarAnalise(analiseId: string): AnaliseLCC {
    const analise = LccFamiliaService.analises.get(analiseId);
    if (!analise) throw new Error(`Análise ${analiseId} não encontrada`);
    if (analise.status !== "calculado") {
      throw new Error("Análise deve estar calculada antes de publicar");
    }

    analise.status = "publicado";
    analise.atualizadoEm = new Date().toISOString();
    return analise;
  }

  // -------------------------------------------------------------------------
  // Auxiliares
  // -------------------------------------------------------------------------

  static listarFamilias(): Record<FamiliaEquipamento, number> {
    return { ...VIDA_UTIL_PADRAO };
  }
}
