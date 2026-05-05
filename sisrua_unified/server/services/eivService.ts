/**
 * T2-95 — Estudo de Impacto de Vizinhança (EIV) Automatizado
 * Avaliação de impactos de empreendimentos de infraestrutura elétrica em áreas urbanas.
 *
 * Referências normativas:
 * - Lei Federal 10.257/2001 — Estatuto da Cidade (art. 36-38)
 * - CONAMA Resolução 237/1997 — Licenciamento Ambiental
 * - ABNT NBR 16280:2015 — Reforma em edificações
 * - NBR ISO 14001:2015 — Sistemas de Gestão Ambiental
 * - ANEEL PRODIST Módulo 1 (2023) — Introdução
 */

import { createHash } from "crypto";

// ---------------------------------------------------------------------------
// Tipos e interfaces
// ---------------------------------------------------------------------------

/** Dimensões de impacto avaliadas no EIV */
export type DimensaoImpacto =
  | "trafego"
  | "ruido"
  | "paisagem_urbana"
  | "qualidade_ar"
  | "infraestrutura"
  | "patrimonio_historico"
  | "uso_solo"
  | "geracao_emprego"
  | "valoracao_imobiliaria";

/** Nível de impacto */
export type NivelImpacto =
  | "desprezivel"
  | "baixo"
  | "moderado"
  | "alto"
  | "critico";

/** Tipo de zona urbana */
export type ZonaUrbana =
  | "zona_residencial"
  | "zona_comercial"
  | "zona_industrial"
  | "zona_mista"
  | "zona_especial_interesse_social"
  | "zona_protecao_ambiental"
  | "area_central";

/** Status do estudo EIV */
export type StatusEstudo = "rascunho" | "calculado" | "publicado";

/** Registro de impacto individual */
export interface RegistroImpacto {
  id: string;
  dimensao: DimensaoImpacto;
  nivel: NivelImpacto;
  descricao: string;
  /** Peso da dimensão (0-1) para cálculo do IEV */
  peso: number;
  medidasMitigadoras: string[];
  criadoEm: string;
}

/** Resultado do cálculo EIV */
export interface ResultadoEIV {
  /** Índice de Efeito de Vizinhança (0-100) */
  iev: number;
  /** Nível geral resultante */
  nivelGeral: NivelImpacto;
  exigeMedidasMitigadoras: boolean;
  exigeAudienciaPublica: boolean;
  dimensoesAvaliadas: number;
  impactosAltos: string[];
  hashIntegridade: string;
  calculadoEm: string;
}

/** Estudo EIV completo */
export interface EstudoEIV {
  id: string;
  tenantId: string;
  titulo: string;
  empreendimento: string;
  municipio: string;
  uf: string;
  zonaUrbana: ZonaUrbana;
  areaImpactoM2: number;
  populacaoAfetada: number;
  impactos: RegistroImpacto[];
  resultado: ResultadoEIV | null;
  status: StatusEstudo;
  responsavel: string;
  criadoEm: string;
  atualizadoEm: string;
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

/** Pontuação numérica por nível de impacto */
const PONTUACAO_NIVEL: Record<NivelImpacto, number> = {
  desprezivel: 0,
  baixo: 25,
  moderado: 50,
  alto: 75,
  critico: 100,
};

/** Pesos padrão por dimensão */
const PESOS_PADRAO: Record<DimensaoImpacto, number> = {
  trafego: 0.15,
  ruido: 0.12,
  paisagem_urbana: 0.10,
  qualidade_ar: 0.12,
  infraestrutura: 0.15,
  patrimonio_historico: 0.10,
  uso_solo: 0.12,
  geracao_emprego: 0.07,
  valoracao_imobiliaria: 0.07,
};

// ---------------------------------------------------------------------------
// Serviço
// ---------------------------------------------------------------------------

export class EivService {
  private static estudos = new Map<string, EstudoEIV>();
  private static counter = 0;
  private static impCounter = 0;

  static _reset(): void {
    EivService.estudos = new Map();
    EivService.counter = 0;
    EivService.impCounter = 0;
  }

  // -------------------------------------------------------------------------
  // Criação
  // -------------------------------------------------------------------------

  static criarEstudo(
    tenantId: string,
    titulo: string,
    empreendimento: string,
    municipio: string,
    uf: string,
    zonaUrbana: ZonaUrbana,
    areaImpactoM2: number,
    populacaoAfetada: number,
    responsavel: string
  ): EstudoEIV {
    EivService.counter += 1;
    const agora = new Date().toISOString();

    const estudo: EstudoEIV = {
      id: `eiv-${EivService.counter}`,
      tenantId,
      titulo,
      empreendimento,
      municipio,
      uf: uf.toUpperCase(),
      zonaUrbana,
      areaImpactoM2,
      populacaoAfetada,
      impactos: [],
      resultado: null,
      status: "rascunho",
      responsavel,
      criadoEm: agora,
      atualizadoEm: agora,
    };

    EivService.estudos.set(estudo.id, estudo);
    return estudo;
  }

  // -------------------------------------------------------------------------
  // Consulta
  // -------------------------------------------------------------------------

  static listarEstudos(tenantId?: string): EstudoEIV[] {
    const lista = Array.from(EivService.estudos.values());
    if (tenantId) return lista.filter((e) => e.tenantId === tenantId);
    return lista;
  }

  static obterEstudo(id: string): EstudoEIV | null {
    return EivService.estudos.get(id) ?? null;
  }

  // -------------------------------------------------------------------------
  // Impactos
  // -------------------------------------------------------------------------

  static adicionarImpacto(
    estudoId: string,
    dimensao: DimensaoImpacto,
    nivel: NivelImpacto,
    descricao: string,
    medidasMitigadoras: string[],
    peso?: number
  ): RegistroImpacto {
    const estudo = EivService.estudos.get(estudoId);
    if (!estudo) throw new Error(`Estudo ${estudoId} não encontrado`);
    if (estudo.status === "publicado") {
      throw new Error("Estudo publicado não permite alterações");
    }

    // Verificar duplicidade de dimensão
    const existente = estudo.impactos.find((i) => i.dimensao === dimensao);
    if (existente) {
      throw new Error(`Dimensão ${dimensao} já registrada neste estudo`);
    }

    EivService.impCounter += 1;
    const impacto: RegistroImpacto = {
      id: `imp-${EivService.impCounter}`,
      dimensao,
      nivel,
      descricao,
      peso: peso ?? PESOS_PADRAO[dimensao],
      medidasMitigadoras,
      criadoEm: new Date().toISOString(),
    };

    estudo.impactos.push(impacto);
    estudo.status = "rascunho";
    estudo.resultado = null;
    estudo.atualizadoEm = new Date().toISOString();

    return impacto;
  }

  // -------------------------------------------------------------------------
  // Cálculo IEV
  // -------------------------------------------------------------------------

  static calcularEIV(estudoId: string): ResultadoEIV {
    const estudo = EivService.estudos.get(estudoId);
    if (!estudo) throw new Error(`Estudo ${estudoId} não encontrado`);
    if (estudo.impactos.length === 0) {
      throw new Error("Estudo não possui impactos registrados");
    }

    const impactosAltos: string[] = [];
    let somaVPonderada = 0;
    let somaPesos = 0;

    for (const imp of estudo.impactos) {
      const pontuacao = PONTUACAO_NIVEL[imp.nivel];
      somaVPonderada += pontuacao * imp.peso;
      somaPesos += imp.peso;

      if (imp.nivel === "alto" || imp.nivel === "critico") {
        impactosAltos.push(imp.dimensao);
      }
    }

    const iev = somaPesos > 0 ? somaVPonderada / somaPesos : 0;

    let nivelGeral: NivelImpacto;
    if (iev >= 80) nivelGeral = "critico";
    else if (iev >= 60) nivelGeral = "alto";
    else if (iev >= 40) nivelGeral = "moderado";
    else if (iev >= 20) nivelGeral = "baixo";
    else nivelGeral = "desprezivel";

    const exigeMedidasMitigadoras = impactosAltos.length > 0;
    // Audiência pública exigida se IEV > 60 ou área > 10.000 m²
    const exigeAudienciaPublica =
      iev > 60 || estudo.areaImpactoM2 > 10000;

    const calculadoEm = new Date().toISOString();
    const payload = JSON.stringify({ estudoId, iev, nivelGeral, calculadoEm });
    const hashIntegridade = createHash("sha256").update(payload).digest("hex");

    const resultado: ResultadoEIV = {
      iev: Math.round(iev * 100) / 100,
      nivelGeral,
      exigeMedidasMitigadoras,
      exigeAudienciaPublica,
      dimensoesAvaliadas: estudo.impactos.length,
      impactosAltos,
      hashIntegridade,
      calculadoEm,
    };

    estudo.resultado = resultado;
    estudo.status = "calculado";
    estudo.atualizadoEm = calculadoEm;

    return resultado;
  }

  // -------------------------------------------------------------------------
  // Publicação
  // -------------------------------------------------------------------------

  static publicarEstudo(estudoId: string): EstudoEIV {
    const estudo = EivService.estudos.get(estudoId);
    if (!estudo) throw new Error(`Estudo ${estudoId} não encontrado`);
    if (estudo.status !== "calculado") {
      throw new Error("Estudo deve estar calculado antes de publicar");
    }

    estudo.status = "publicado";
    estudo.atualizadoEm = new Date().toISOString();
    return estudo;
  }

  // -------------------------------------------------------------------------
  // Auxiliares
  // -------------------------------------------------------------------------

  static listarDimensoes(): DimensaoImpacto[] {
    return Object.keys(PESOS_PADRAO) as DimensaoImpacto[];
  }
}
