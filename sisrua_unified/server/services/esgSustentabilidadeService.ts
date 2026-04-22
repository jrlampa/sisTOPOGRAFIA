/**
 * T2-109 — Relatório ESG & Sustentabilidade Local
 *
 * Referências normativas:
 *  - GRI Standards 2021 (Global Reporting Initiative)
 *  - ABNT NBR ISO 14001:2015 — Sistemas de Gestão Ambiental
 *  - ABNT NBR ISO 26000:2010 — Responsabilidade Social
 *  - ANEEL REN 1000/2021 — Regulamentos de Distribuição
 *  - ODS/SDG Agenda 2030 (ONU) — mapeamento por indicador
 *  - TCFD (Task Force on Climate-related Financial Disclosures)
 */

import { createHash } from "crypto";

export type DimensaoESG = "ambiental" | "social" | "governanca";

export type IndicadorAmbiental =
  | "emissoes_co2_tco2e"
  | "consumo_energia_kwh"
  | "residuos_gerados_t"
  | "area_supressao_vegetal_ha"
  | "agua_consumida_m3"
  | "biodiversidade_impactada_ha";

export type IndicadorSocial =
  | "empregos_gerados"
  | "empregos_locais_percentual"
  | "comunidades_beneficiadas"
  | "populacao_acesso_energia"
  | "horas_formacao_profissional";

export type IndicadorGovernanca =
  | "conformidade_regulatoria_percentual"
  | "transparencia_publica_score"
  | "licencas_obtidas"
  | "auditorias_realizadas"
  | "reclamacoes_resolvidas_percentual";

export type TipoIndicador =
  | IndicadorAmbiental
  | IndicadorSocial
  | IndicadorGovernanca;

export type NivelMaturidadeESG =
  | "inicial"
  | "desenvolvimento"
  | "consolidado"
  | "lider";

export type StatusRelatorio =
  | "rascunho"
  | "calculado"
  | "publicado";

/** Pesos por dimensão (GRI + ANEEL ponderação setorial) */
export const PESO_DIMENSAO: Record<DimensaoESG, number> = {
  ambiental: 0.40,
  social: 0.35,
  governanca: 0.25,
};

/** Mapeamento de indicador → dimensão */
export const DIMENSAO_INDICADOR: Record<TipoIndicador, DimensaoESG> = {
  emissoes_co2_tco2e: "ambiental",
  consumo_energia_kwh: "ambiental",
  residuos_gerados_t: "ambiental",
  area_supressao_vegetal_ha: "ambiental",
  agua_consumida_m3: "ambiental",
  biodiversidade_impactada_ha: "ambiental",
  empregos_gerados: "social",
  empregos_locais_percentual: "social",
  comunidades_beneficiadas: "social",
  populacao_acesso_energia: "social",
  horas_formacao_profissional: "social",
  conformidade_regulatoria_percentual: "governanca",
  transparencia_publica_score: "governanca",
  licencas_obtidas: "governanca",
  auditorias_realizadas: "governanca",
  reclamacoes_resolvidas_percentual: "governanca",
};

export interface RegistroIndicador {
  id: string;
  tipo: TipoIndicador;
  dimensao: DimensaoESG;
  valor: number;
  unidade: string;
  metaReferencia?: number;
  fonteColeta: string;
  periodoApuracao: string;       // ex: "2024-01" a "2024-12"
  observacao?: string;
}

export interface ResultadoESG {
  indiceAmbiental: number;         // 0-100
  indiceSocial: number;
  indiceGovernanca: number;
  indiceGlobal: number;            // ponderado
  nivelMaturidade: NivelMaturidadeESG;
  indicadoresRegistrados: number;
  ods: string[];                   // ODS/SDG aplicáveis
  hashIntegridade: string;
  calculadoEm: string;
}

export interface RelatorioESG {
  id: string;
  tenantId: string;
  titulo: string;
  exercicio: number;
  concessionaria: string;
  municipio: string;
  uf: string;
  responsavel: string;
  status: StatusRelatorio;
  indicadores: RegistroIndicador[];
  resultado?: ResultadoESG;
  criadoEm: string;
  publicadoEm?: string;
}

// ─── Estado em memória ───────────────────────────────────────────────────────
const relatorios = new Map<string, RelatorioESG>();
let contRelatorio = 0;
let contIndicador = 0;

// ─── Utilitários ─────────────────────────────────────────────────────────────

function calcularNivelMaturidade(indiceGlobal: number): NivelMaturidadeESG {
  if (indiceGlobal <= 40) return "inicial";
  if (indiceGlobal <= 60) return "desenvolvimento";
  if (indiceGlobal <= 80) return "consolidado";
  return "lider";
}

/** Normaliza valor bruto para 0-100 baseado em meta de referência */
function normalizarIndicador(valor: number, meta?: number): number {
  if (!meta || meta === 0) return Math.min(100, Math.max(0, valor));
  // Para indicadores em que quanto menor melhor (emissões, resíduos):
  // retornamos 100 se zerado; para indicadores positivos usamos razão normal
  return Math.min(100, (valor / meta) * 100);
}

const ODS_MAPEAMENTO: Record<TipoIndicador, string[]> = {
  emissoes_co2_tco2e: ["ODS 13 - Ação Climática"],
  consumo_energia_kwh: ["ODS 7 - Energia Limpa"],
  residuos_gerados_t: ["ODS 12 - Consumo Responsável"],
  area_supressao_vegetal_ha: ["ODS 15 - Vida Terrestre"],
  agua_consumida_m3: ["ODS 6 - Água Limpa"],
  biodiversidade_impactada_ha: ["ODS 15 - Vida Terrestre"],
  empregos_gerados: ["ODS 8 - Trabalho Digno"],
  empregos_locais_percentual: ["ODS 8 - Trabalho Digno", "ODS 11 - Cidades Sustentáveis"],
  comunidades_beneficiadas: ["ODS 11 - Cidades Sustentáveis"],
  populacao_acesso_energia: ["ODS 7 - Energia Limpa", "ODS 1 - Erradicação da Pobreza"],
  horas_formacao_profissional: ["ODS 4 - Educação de Qualidade"],
  conformidade_regulatoria_percentual: ["ODS 16 - Paz, Justiça e Instituições"],
  transparencia_publica_score: ["ODS 16 - Paz, Justiça e Instituições"],
  licencas_obtidas: ["ODS 16 - Paz, Justiça e Instituições"],
  auditorias_realizadas: ["ODS 16 - Paz, Justiça e Instituições"],
  reclamacoes_resolvidas_percentual: ["ODS 16 - Paz, Justiça e Instituições"],
};

// ─── Service ─────────────────────────────────────────────────────────────────

export class EsgSustentabilidadeService {
  static _reset(): void {
    relatorios.clear();
    contRelatorio = 0;
    contIndicador = 0;
  }

  static criarRelatorio(params: {
    tenantId: string;
    titulo: string;
    exercicio: number;
    concessionaria: string;
    municipio: string;
    uf: string;
    responsavel: string;
  }): RelatorioESG {
    const uf = params.uf.toUpperCase();
    contRelatorio += 1;
    const relatorio: RelatorioESG = {
      id: `esg-${contRelatorio}`,
      tenantId: params.tenantId,
      titulo: params.titulo,
      exercicio: params.exercicio,
      concessionaria: params.concessionaria,
      municipio: params.municipio,
      uf,
      responsavel: params.responsavel,
      status: "rascunho",
      indicadores: [],
      criadoEm: new Date().toISOString(),
    };
    relatorios.set(relatorio.id, relatorio);
    return relatorio;
  }

  static listarRelatorios(tenantId?: string): RelatorioESG[] {
    const lista = Array.from(relatorios.values());
    return tenantId ? lista.filter((r) => r.tenantId === tenantId) : lista;
  }

  static obterRelatorio(id: string): RelatorioESG | undefined {
    return relatorios.get(id);
  }

  static registrarIndicador(
    relatorioId: string,
    params: {
      tipo: TipoIndicador;
      valor: number;
      unidade: string;
      metaReferencia?: number;
      fonteColeta: string;
      periodoApuracao: string;
      observacao?: string;
    }
  ): RegistroIndicador {
    const relatorio = relatorios.get(relatorioId);
    if (!relatorio) throw new Error(`Relatório ${relatorioId} não encontrado`);
    if (relatorio.status === "publicado") {
      throw new Error("Relatório publicado não pode ser alterado");
    }
    // Permite múltiplos registros do mesmo indicador (ex: múltiplos períodos)
    contIndicador += 1;
    const registro: RegistroIndicador = {
      id: `ind-${contIndicador}`,
      tipo: params.tipo,
      dimensao: DIMENSAO_INDICADOR[params.tipo],
      valor: params.valor,
      unidade: params.unidade,
      metaReferencia: params.metaReferencia,
      fonteColeta: params.fonteColeta,
      periodoApuracao: params.periodoApuracao,
      observacao: params.observacao,
    };
    relatorio.indicadores.push(registro);
    return registro;
  }

  static calcularIndiceESG(relatorioId: string): ResultadoESG {
    const relatorio = relatorios.get(relatorioId);
    if (!relatorio) throw new Error(`Relatório ${relatorioId} não encontrado`);
    if (relatorio.indicadores.length === 0) {
      throw new Error("Registre ao menos um indicador antes de calcular");
    }

    // Agrupa por dimensão e calcula média normalizada
    const porDimensao: Record<DimensaoESG, number[]> = {
      ambiental: [],
      social: [],
      governanca: [],
    };

    const odsSet = new Set<string>();

    for (const ind of relatorio.indicadores) {
      const score = normalizarIndicador(ind.valor, ind.metaReferencia);
      porDimensao[ind.dimensao].push(score);
      (ODS_MAPEAMENTO[ind.tipo] ?? []).forEach((ods) => odsSet.add(ods));
    }

    const media = (arr: number[]) =>
      arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;

    const indiceAmbiental = media(porDimensao.ambiental);
    const indiceSocial = media(porDimensao.social);
    const indiceGovernanca = media(porDimensao.governanca);

    const indiceGlobal =
      indiceAmbiental * PESO_DIMENSAO.ambiental +
      indiceSocial * PESO_DIMENSAO.social +
      indiceGovernanca * PESO_DIMENSAO.governanca;

    const payload = JSON.stringify({
      relatorioId,
      exercicio: relatorio.exercicio,
      indicadores: relatorio.indicadores.map((i) => ({
        tipo: i.tipo,
        valor: i.valor,
      })),
    });
    const hashIntegridade = createHash("sha256").update(payload).digest("hex");
    const calculadoEm = new Date().toISOString();

    const resultado: ResultadoESG = {
      indiceAmbiental: Math.round(indiceAmbiental * 100) / 100,
      indiceSocial: Math.round(indiceSocial * 100) / 100,
      indiceGovernanca: Math.round(indiceGovernanca * 100) / 100,
      indiceGlobal: Math.round(indiceGlobal * 100) / 100,
      nivelMaturidade: calcularNivelMaturidade(indiceGlobal),
      indicadoresRegistrados: relatorio.indicadores.length,
      ods: Array.from(odsSet).sort(),
      hashIntegridade,
      calculadoEm,
    };

    relatorio.resultado = resultado;
    relatorio.status = "calculado";
    return resultado;
  }

  static publicarRelatorio(relatorioId: string): RelatorioESG {
    const relatorio = relatorios.get(relatorioId);
    if (!relatorio) throw new Error(`Relatório ${relatorioId} não encontrado`);
    if (relatorio.status !== "calculado") {
      throw new Error("Execute o cálculo do índice ESG antes de publicar");
    }
    relatorio.status = "publicado";
    relatorio.publicadoEm = new Date().toISOString();
    return relatorio;
  }

  static listarIndicadores(): {
    ambiental: IndicadorAmbiental[];
    social: IndicadorSocial[];
    governanca: IndicadorGovernanca[];
  } {
    return {
      ambiental: [
        "emissoes_co2_tco2e",
        "consumo_energia_kwh",
        "residuos_gerados_t",
        "area_supressao_vegetal_ha",
        "agua_consumida_m3",
        "biodiversidade_impactada_ha",
      ],
      social: [
        "empregos_gerados",
        "empregos_locais_percentual",
        "comunidades_beneficiadas",
        "populacao_acesso_energia",
        "horas_formacao_profissional",
      ],
      governanca: [
        "conformidade_regulatoria_percentual",
        "transparencia_publica_score",
        "licencas_obtidas",
        "auditorias_realizadas",
        "reclamacoes_resolvidas_percentual",
      ],
    };
  }
}
