/**
 * T2-101 — Dossiê de Remuneração Regulatória (MCPSE/ANEEL)
 * Cálculo da Base de Remuneração de Ativos e Remuneração Regulatória para
 * distribuidoras de energia elétrica.
 *
 * Referências normativas:
 * - ANEEL REN 905/2020 — Metodologia para Base de Remuneração
 * - ANEEL Nota Técnica 49/2020 — Ciclo Tarifário e WACC
 * - MCPSE ANEEL — Metodologia de Cálculo do PMSO e outros componentes
 * - ANEEL PRODIST Módulo 1 (2023) — Procedimentos de Distribuição
 * - ABNT NBR 16660:2017 — Gestão de Ativos — Aspectos financeiros
 */

import { createHash } from "crypto";

// ---------------------------------------------------------------------------
// Tipos e interfaces
// ---------------------------------------------------------------------------

/** Tipos de ativos regulatórios reconhecidos pela ANEEL */
export type TipoAtivo =
  | "rede_bt"
  | "rede_mt"
  | "rede_at"
  | "transformador_distribuicao"
  | "religador"
  | "banco_capacitor"
  | "sistema_medicao"
  | "subestacao_mt_bt"
  | "poste_estrutura";

/** Status do dossiê */
export type StatusDossie =
  | "rascunho"
  | "calculado"
  | "publicado"
  | "homologado";

/** Ativo da base de remuneração */
export interface AtivoRegulatorio {
  id: string;
  tipoAtivo: TipoAtivo;
  descricao: string;
  quantidade: number;
  /** Valor Novo de Reposição unitário (VNR) em R$ */
  vnrUnitario: number;
  /** Idade do ativo em anos */
  idadeAnos: number;
  /** Vida útil regulatória em anos (ANEEL REN 905) */
  vidaUtilRegulatoriaAnos: number;
  /** Ano de instalação */
  anoInstalacao: number;
  criadoEm: string;
}

/** Resultado do cálculo de remuneração regulatória */
export interface ResultadoRemuneracao {
  /** Base de Remuneração Bruta (BRB = VNR total × quantidade) */
  baseRemuneracaoBruta: number;
  /** Depreciação acumulada = BRB × (idadeAnos / vidaUtil) */
  depreciacaoAcumulada: number;
  /** Base de Remuneração Líquida (BRL = BRB - Depreciação) */
  baseRemuneracaoLiquida: number;
  /** Remuneração anual = BRL × WACC */
  remuneracaoAnual: number;
  waccAplicado: number;
  totalAtivos: number;
  hashIntegridade: string;
  calculadoEm: string;
}

/** Dossiê de remuneração regulatória */
export interface DossieRemuneracao {
  id: string;
  tenantId: string;
  titulo: string;
  concessionaria: string;
  cicloTarifario: string;
  anoReferencia: number;
  waccRegulatorio: number;
  ativos: AtivoRegulatorio[];
  resultado: ResultadoRemuneracao | null;
  status: StatusDossie;
  responsavel: string;
  criadoEm: string;
  atualizadoEm: string;
}

// ---------------------------------------------------------------------------
// Constantes regulatórias
// ---------------------------------------------------------------------------

/** WACC regulatório ANEEL — 7ª Revisão Periódica Tarifária */
const WACC_ANEEL = 0.0728;

/** Vida útil regulatória por tipo de ativo (ANEEL REN 905/2020, Anexo I) */
const VIDA_UTIL_REGULATORIA: Record<TipoAtivo, number> = {
  rede_bt: 30,
  rede_mt: 35,
  rede_at: 40,
  transformador_distribuicao: 35,
  religador: 30,
  banco_capacitor: 20,
  sistema_medicao: 15,
  subestacao_mt_bt: 35,
  poste_estrutura: 40,
};

// ---------------------------------------------------------------------------
// Serviço
// ---------------------------------------------------------------------------

export class RemuneracaoRegulatoriaService {
  private static dossies = new Map<string, DossieRemuneracao>();
  private static counter = 0;
  private static ativoCounter = 0;

  static _reset(): void {
    RemuneracaoRegulatoriaService.dossies = new Map();
    RemuneracaoRegulatoriaService.counter = 0;
    RemuneracaoRegulatoriaService.ativoCounter = 0;
  }

  // -------------------------------------------------------------------------
  // Criação
  // -------------------------------------------------------------------------

  static criarDossie(
    tenantId: string,
    titulo: string,
    concessionaria: string,
    cicloTarifario: string,
    anoReferencia: number,
    responsavel: string,
    waccRegulatorio?: number
  ): DossieRemuneracao {
    RemuneracaoRegulatoriaService.counter += 1;
    const agora = new Date().toISOString();

    const dossie: DossieRemuneracao = {
      id: `rr-${RemuneracaoRegulatoriaService.counter}`,
      tenantId,
      titulo,
      concessionaria,
      cicloTarifario,
      anoReferencia,
      waccRegulatorio: waccRegulatorio ?? WACC_ANEEL,
      ativos: [],
      resultado: null,
      status: "rascunho",
      responsavel,
      criadoEm: agora,
      atualizadoEm: agora,
    };

    RemuneracaoRegulatoriaService.dossies.set(dossie.id, dossie);
    return dossie;
  }

  // -------------------------------------------------------------------------
  // Consulta
  // -------------------------------------------------------------------------

  static listarDossies(tenantId?: string): DossieRemuneracao[] {
    const lista = Array.from(
      RemuneracaoRegulatoriaService.dossies.values()
    );
    if (tenantId) return lista.filter((d) => d.tenantId === tenantId);
    return lista;
  }

  static obterDossie(id: string): DossieRemuneracao | null {
    return RemuneracaoRegulatoriaService.dossies.get(id) ?? null;
  }

  // -------------------------------------------------------------------------
  // Ativos
  // -------------------------------------------------------------------------

  static adicionarAtivo(
    dossieId: string,
    tipoAtivo: TipoAtivo,
    descricao: string,
    quantidade: number,
    vnrUnitario: number,
    idadeAnos: number,
    anoInstalacao: number,
    vidaUtilRegulatoriaAnos?: number
  ): AtivoRegulatorio {
    const dossie = RemuneracaoRegulatoriaService.dossies.get(dossieId);
    if (!dossie) throw new Error(`Dossiê ${dossieId} não encontrado`);
    if (dossie.status === "publicado" || dossie.status === "homologado") {
      throw new Error("Dossiê publicado/homologado não permite alterações");
    }

    RemuneracaoRegulatoriaService.ativoCounter += 1;
    const ativo: AtivoRegulatorio = {
      id: `at-${RemuneracaoRegulatoriaService.ativoCounter}`,
      tipoAtivo,
      descricao,
      quantidade,
      vnrUnitario,
      idadeAnos,
      vidaUtilRegulatoriaAnos:
        vidaUtilRegulatoriaAnos ?? VIDA_UTIL_REGULATORIA[tipoAtivo],
      anoInstalacao,
      criadoEm: new Date().toISOString(),
    };

    dossie.ativos.push(ativo);
    dossie.status = "rascunho";
    dossie.resultado = null;
    dossie.atualizadoEm = new Date().toISOString();

    return ativo;
  }

  // -------------------------------------------------------------------------
  // Cálculo de Remuneração
  // -------------------------------------------------------------------------

  static calcularRemuneracao(dossieId: string): ResultadoRemuneracao {
    const dossie = RemuneracaoRegulatoriaService.dossies.get(dossieId);
    if (!dossie) throw new Error(`Dossiê ${dossieId} não encontrado`);
    if (dossie.ativos.length === 0) {
      throw new Error("Dossiê não possui ativos cadastrados");
    }

    let baseRemuneracaoBruta = 0;
    let depreciacaoAcumulada = 0;

    for (const ativo of dossie.ativos) {
      const vnrTotal = ativo.vnrUnitario * ativo.quantidade;
      baseRemuneracaoBruta += vnrTotal;

      // Depreciação linear: taxa = idadeAnos / vidaUtilRegulatoriaAnos (máx 1)
      const taxaDepreciacao = Math.min(
        ativo.idadeAnos / ativo.vidaUtilRegulatoriaAnos,
        1
      );
      depreciacaoAcumulada += vnrTotal * taxaDepreciacao;
    }

    const baseRemuneracaoLiquida =
      baseRemuneracaoBruta - depreciacaoAcumulada;
    const remuneracaoAnual = baseRemuneracaoLiquida * dossie.waccRegulatorio;

    const calculadoEm = new Date().toISOString();
    const payload = JSON.stringify({
      dossieId,
      baseRemuneracaoLiquida,
      remuneracaoAnual,
      calculadoEm,
    });
    const hashIntegridade = createHash("sha256").update(payload).digest("hex");

    const resultado: ResultadoRemuneracao = {
      baseRemuneracaoBruta,
      depreciacaoAcumulada,
      baseRemuneracaoLiquida,
      remuneracaoAnual,
      waccAplicado: dossie.waccRegulatorio,
      totalAtivos: dossie.ativos.length,
      hashIntegridade,
      calculadoEm,
    };

    dossie.resultado = resultado;
    dossie.status = "calculado";
    dossie.atualizadoEm = calculadoEm;

    return resultado;
  }

  // -------------------------------------------------------------------------
  // Publicação / Homologação
  // -------------------------------------------------------------------------

  static publicarDossie(dossieId: string): DossieRemuneracao {
    const dossie = RemuneracaoRegulatoriaService.dossies.get(dossieId);
    if (!dossie) throw new Error(`Dossiê ${dossieId} não encontrado`);
    if (dossie.status !== "calculado") {
      throw new Error("Dossiê deve estar calculado antes de publicar");
    }

    dossie.status = "publicado";
    dossie.atualizadoEm = new Date().toISOString();
    return dossie;
  }

  static homologarDossie(dossieId: string): DossieRemuneracao {
    const dossie = RemuneracaoRegulatoriaService.dossies.get(dossieId);
    if (!dossie) throw new Error(`Dossiê ${dossieId} não encontrado`);
    if (dossie.status !== "publicado") {
      throw new Error("Dossiê deve estar publicado antes de homologar");
    }

    dossie.status = "homologado";
    dossie.atualizadoEm = new Date().toISOString();
    return dossie;
  }

  // -------------------------------------------------------------------------
  // Auxiliares
  // -------------------------------------------------------------------------

  static listarTiposAtivo(): Record<TipoAtivo, number> {
    return { ...VIDA_UTIL_REGULATORIA };
  }
}
