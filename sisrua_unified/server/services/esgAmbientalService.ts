/**
 * esgAmbientalService.ts — ESG Relatório de Impacto Ambiental (T2-45).
 *
 * Roadmap Item 45 [T2]: ESG Ambiental — Relatório de impacto ambiental para
 * projetos de distribuição elétrica, com indicadores de sustentabilidade
 * alinhados ao GRI (Global Reporting Initiative) e ABNT NBR ISO 14001.
 */

import { createHash } from "crypto";
import { BtTopology } from "./bt/btDerivedTypes.js";
import { getEngineeringStandard } from "../standards/index.js";

// ─── Tipos ────────────────────────────────────────────────────────────────────

/** Escopo GEE (GHG Protocol). */
export type EscopoGee = "escopo1" | "escopo2" | "escopo3";

/** Tipo de material ou atividade para cálculo de emissão. */
export type TipoEmissaoMaterial =
  | "cabo_aluminio_nu"         // kg/km
  | "cabo_multiplexado"        // kg/km
  | "cabo_protegido"           // kg/km
  | "poste_concreto"           // kg CO2eq/un
  | "poste_madeira_eucalipto"  // kg CO2eq/un (negativo = sequestro)
  | "transformador_oleo"       // kg CO2eq/un (SF6 ou óleo mineral)
  | "veiculo_trabalho_diesel"  // kg CO2eq/km
  | "energia_eletrica_grid";   // kg CO2eq/kWh (fator SIN)

/** Entrada de emissão para um projeto. */
export interface EntradaEmissao {
  tipo: TipoEmissaoMaterial;
  escopo: EscopoGee;
  quantidade: number;  // unidade depende do tipo (km, un, kWh, etc.)
  descricao?: string;
}

/** Indicadores de sustentabilidade da rede. */
export interface IndicadoresSustentabilidade {
  percentualRedeProtegida: number;    // % de cabos protegidos/compactos
  percentualPerdasTecnicas: number;   // % de perdas na rede
  indiceConflitosArborizacao: number; // interferências por km de rede
  percentualLuminariasLed: number;    // % de IP em LED
  capacidadePanelSolar?: number;      // kWp instalados (se houver)
}

/** Requisito ISO 14001 para checklist. */
export interface RequisitoIso14001 {
  id: string;
  clausula: string;
  descricao: string;
  status: "conforme" | "nao_conforme" | "nao_aplicavel" | "pendente";
  evidencia?: string;
}

/** Interferência geospacial detectada (T2-45). */
export interface InterferenciaAmbiental {
  tipoArea: "APP" | "UC" | "TI" | "Quilombola";
  nomeArea: string;
  distanciaM: number;
  interseccao: boolean;
  poleId?: string;
}

/** Relatório ESG completo. */
export interface RelatorioEsgAmbiental {
  id: string;
  nome: string;
  tenantId: string;
  projetoId?: string;
  descricao?: string;
  periodoReferencia: string;  // "YYYY" ou "YYYY-MM"
  emissoes: EntradaEmissao[];
  indicadores?: IndicadoresSustentabilidade;
  checklistIso14001: RequisitoIso14001[];
  interferencias?: InterferenciaAmbiental[];
  resultado?: ResultadoEsg;
  status: "rascunho" | "calculado" | "publicado";
  criadoEm: Date;
  atualizadoEm: Date;
}

/** Resultado calculado do relatório ESG. */
export interface ResultadoEsg {
  emissoesTotaisTonCo2eq: number;
  emissoesPorEscopo: Record<EscopoGee, number>;
  intensidadeEmissao?: number;  // tCO2eq/km de rede (se fornecido)
  conformidadeIso14001Pct: number;
  scoreEsg: number;             // 0-100
  classificacaoEsg: "A" | "B" | "C" | "D";
  destaquesPositivos: string[];
  oportunidadesMelhoria: string[];
  hashIntegridade: string;
  calculadoEm: Date;
}

// ─── Fatores de emissão (IPCC AR6 / CETESB 2023) ─────────────────────────────

const FATORES_EMISSAO: Record<TipoEmissaoMaterial, number> = {
  cabo_aluminio_nu: 8.50,
  cabo_multiplexado: 12.30,
  cabo_protegido: 15.80,
  poste_concreto: 280.0,
  poste_madeira_eucalipto: -120.0,
  transformador_oleo: 950.0,
  veiculo_trabalho_diesel: 0.271,
  energia_eletrica_grid: 0.0728,
};

// ─── Checklist ISO 14001 base ─────────────────────────────────────────────────

function makeChecklistIso14001(): RequisitoIso14001[] {
  return [
    { id: "iso-4.1", clausula: "4.1", descricao: "Compreensão da organização e seu contexto", status: "pendente" },
    { id: "iso-4.2", clausula: "4.2", descricao: "Partes interessadas e seus requisitos", status: "pendente" },
    { id: "iso-5.1", clausula: "5.1", descricao: "Liderança e comprometimento da alta direção", status: "pendente" },
    { id: "iso-6.1", clausula: "6.1", descricao: "Ações para tratar riscos e oportunidades ambientais", status: "pendente" },
    { id: "iso-6.2", clausula: "6.2", descricao: "Objetivos ambientais e planejamento", status: "pendente" },
    { id: "iso-7.1", clausula: "7.1", descricao: "Recursos necessários ao SGA", status: "pendente" },
    { id: "iso-8.1", clausula: "8.1", descricao: "Planejamento e controle operacional", status: "pendente" },
    { id: "iso-9.1", clausula: "9.1", descricao: "Monitoramento, medição e análise do desempenho", status: "pendente" },
    { id: "iso-9.3", clausula: "9.3", descricao: "Análise crítica pela direção", status: "pendente" },
    { id: "iso-10.2", clausula: "10.2", descricao: "Não conformidade e ação corretiva", status: "pendente" },
  ];
}

// ─── Estado interno ───────────────────────────────────────────────────────────

let relatorios: Map<string, RelatorioEsgAmbiental> = new Map();
let contador = 0;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function classificarEsg(score: number): "A" | "B" | "C" | "D" {
  if (score >= 80) return "A";
  if (score >= 60) return "B";
  if (score >= 40) return "C";
  return "D";
}

function calcularResultado(rel: RelatorioEsgAmbiental): ResultadoEsg {
  const porEscopo: Record<EscopoGee, number> = { escopo1: 0, escopo2: 0, escopo3: 0 };
  for (const e of rel.emissoes) {
    const fator = FATORES_EMISSAO[e.tipo] ?? 0;
    porEscopo[e.escopo] += fator * e.quantidade;
  }
  const totalKg = porEscopo.escopo1 + porEscopo.escopo2 + porEscopo.escopo3;
  const totalTon = parseFloat((totalKg / 1000).toFixed(4));
  for (const k of Object.keys(porEscopo) as EscopoGee[]) {
    porEscopo[k] = parseFloat((porEscopo[k] / 1000).toFixed(4));
  }

  const totalRequisitos = rel.checklistIso14001.filter((r) => r.status !== "nao_aplicavel").length;
  const conformes = rel.checklistIso14001.filter((r) => r.status === "conforme").length;
  const conformidadePct = totalRequisitos > 0
    ? parseFloat(((conformes / totalRequisitos) * 100).toFixed(1))
    : 0;

  let scoreEmissao = 50;
  let scoreRede = 50;

  const ind = rel.indicadores;
  if (ind) {
    const scoreProteg = Math.min(ind.percentualRedeProtegida, 100) * 0.3;
    const scoreLed = Math.min(ind.percentualLuminariasLed, 100) * 0.3;
    const scorePerdas = Math.max(0, 100 - ind.percentualPerdasTecnicas * 5) * 0.2;
    const scoreArborizacao = Math.max(0, 100 - ind.indiceConflitosArborizacao * 10) * 0.2;
    scoreRede = scoreProteg + scoreLed + scorePerdas + scoreArborizacao;

    if (totalTon < 1) scoreEmissao = 80;
    else if (totalTon < 5) scoreEmissao = 65;
    else if (totalTon < 20) scoreEmissao = 50;
    else scoreEmissao = 35;
  }

  const scoreEsg = parseFloat(
    (scoreEmissao * 0.4 + conformidadePct * 0.3 + scoreRede * 0.3).toFixed(1)
  );

  const positivos: string[] = [];
  const oportunidades: string[] = [];

  if (ind) {
    if (ind.percentualRedeProtegida >= 50) positivos.push("Mais de 50% da rede com cabos protegidos");
    if (ind.percentualPerdasTecnicas < 5) positivos.push("Perdas técnicas abaixo de 5%");
  }
  if (rel.interferencias && rel.interferencias.some(i => i.interseccao)) {
    oportunidades.push("Rede intercepta Áreas de Preservação Permanente: avaliar traçado alternativo.");
  }

  const hashIntegridade = createHash("sha256")
    .update(JSON.stringify({ relatorioId: rel.id, totalTon, scoreEsg }))
    .digest("hex");

  return {
    emissoesTotaisTonCo2eq: totalTon,
    emissoesPorEscopo: porEscopo,
    conformidadeIso14001Pct: conformidadePct,
    scoreEsg,
    classificacaoEsg: classificarEsg(scoreEsg),
    destaquesPositivos: positivos,
    oportunidadesMelhoria: oportunidades,
    hashIntegridade,
    calculadoEm: new Date(),
  };
}

// ─── Serviço ──────────────────────────────────────────────────────────────────

export class EsgAmbientalService {
  static _reset(): void {
    relatorios = new Map();
    contador = 0;
  }

  static criarRelatorio(params: {
    nome: string;
    tenantId: string;
    periodoReferencia: string;
    descricao?: string;
    projetoId?: string;
  }): RelatorioEsgAmbiental {
    const id = `esg-${++contador}`;
    const agora = new Date();
    const rel: RelatorioEsgAmbiental = {
      id,
      nome: params.nome,
      tenantId: params.tenantId,
      periodoReferencia: params.periodoReferencia,
      descricao: params.descricao,
      projetoId: params.projetoId,
      emissoes: [],
      checklistIso14001: makeChecklistIso14001(),
      status: "rascunho",
      criadoEm: agora,
      atualizadoEm: agora,
    };
    relatorios.set(id, rel);
    return rel;
  }

  /**
   * Detecção Automática de Interferências Ambientais (T2-45).
   * Simula a interseção com base em coordenadas reais vs áreas protegidas do INDE.
   */
  static detectarInterferencias(topology: BtTopology): InterferenciaAmbiental[] {
    const standard = getEngineeringStandard();
    const bufferRadius = standard.constants.ENVIRONMENTAL_BUFFER_RADIUS_M;

    // Simulação de banco de dados geospacial (INDE/IBAMA)
    // Em produção: requisição WFS/REST ao IBGE/MMA
    return topology.poles.map(pole => {
      // Heurística de simulação para fins de demonstração Tier 2
      // Se lat/lng termina em dígito par, simula proximidade de APP
      const isNearApp = (Math.floor(pole.lat * 1000) % 2 === 0);
      
      return {
        tipoArea: "APP" as InterferenciaAmbiental["tipoArea"],
        nomeArea: "APP Rio de Janeiro - Zona Costeira",
        distanciaM: isNearApp ? 2.5 : 45.0,
        interseccao: isNearApp && (2.5 < bufferRadius),
        poleId: pole.id
      } satisfies InterferenciaAmbiental;
    }).filter(i => i.interseccao);
  }

  static listarRelatorios(tenantId: string): RelatorioEsgAmbiental[] {
    return Array.from(relatorios.values()).filter((r) => r.tenantId === tenantId);
  }

  static obterRelatorio(id: string): RelatorioEsgAmbiental | null {
    return relatorios.get(id) ?? null;
  }

  static adicionarEmissoes(id: string, novasEmissoes: EntradaEmissao[]): RelatorioEsgAmbiental | null {
    const rel = relatorios.get(id);
    if (!rel) return null;
    rel.emissoes.push(...novasEmissoes);
    rel.atualizadoEm = new Date();
    return rel;
  }

  static atualizarIndicadores(id: string, indicadores: IndicadoresSustentabilidade): RelatorioEsgAmbiental | null {
    const rel = relatorios.get(id);
    if (!rel) return null;
    rel.indicadores = indicadores;
    rel.atualizadoEm = new Date();
    return rel;
  }

  static atualizarChecklist(
    id: string,
    itens: { id: string; status: any; evidencia?: string }[]
  ): RelatorioEsgAmbiental | null {
    const rel = relatorios.get(id);
    if (!rel) return null;
    for (const item of itens) {
      const idx = rel.checklistIso14001.findIndex((r) => r.id === item.id);
      if (idx !== -1) {
        rel.checklistIso14001[idx].status = item.status;
        rel.checklistIso14001[idx].evidencia = item.evidencia;
      }
    }
    rel.atualizadoEm = new Date();
    return rel;
  }

  static calcularRelatorio(id: string, topology?: BtTopology): RelatorioEsgAmbiental | null {
    const rel = relatorios.get(id);
    if (!rel) return null;
    if (topology) {
      rel.interferencias = this.detectarInterferencias(topology);
    }
    rel.resultado = calcularResultado(rel);
    rel.status = "calculado";
    rel.atualizadoEm = new Date();
    return rel;
  }

  static publicarRelatorio(id: string): RelatorioEsgAmbiental | null {
    const rel = relatorios.get(id);
    if (!rel || rel.status !== "calculado") return null;
    rel.status = "publicado";
    rel.atualizadoEm = new Date();
    return rel;
  }

  static listarFatoresEmissao(): { tipo: TipoEmissaoMaterial; fatorKgCo2eqPorUnidade: number }[] {
    return (Object.entries(FATORES_EMISSAO) as [TipoEmissaoMaterial, number][]).map(
      ([tipo, fator]) => ({ tipo, fatorKgCo2eqPorUnidade: fator })
    );
  }
}
