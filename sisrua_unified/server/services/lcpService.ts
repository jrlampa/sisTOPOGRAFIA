/**
 * Serviço T2-59 — Motor Least-Cost Path (LCP)
 * Sugestão algorítmica de traçado de menor custo geográfico e técnico.
 */

import { createHash } from "crypto";

export type TipoTerritorio =
  | "urbano"
  | "rural"
  | "cruzamento_viario"
  | "area_preservacao"
  | "interferencia_subterranea"
  | "travessia_hidrografica";

export type StatusLcp = "rascunho" | "calculado" | "aprovado";
export type NivelDificuldade = "baixo" | "medio" | "alto" | "critico";

export interface Coordenada {
  lat: number;
  lon: number;
}

export interface SegmentoLcp {
  id: string;
  tipoTerritorio: TipoTerritorio;
  comprimentoM: number;
  custoUnitarioPorM: number;
  custoTotal: number;
  observacao?: string;
}

export interface ConfiguracaoLcp {
  custoUrbanoPorM: number;
  custoRuralPorM: number;
  custoCruzamentoPorUnidade: number;
  custoPreservacaoPorM: number;
  custoInterferenciaPorM: number;
  custoTravessiaPorUnidade: number;
}

const CONFIGURACAO_PADRAO: ConfiguracaoLcp = {
  custoUrbanoPorM: 180,
  custoRuralPorM: 90,
  custoCruzamentoPorUnidade: 5000,
  custoPreservacaoPorM: 350,
  custoInterferenciaPorM: 280,
  custoTravessiaPorUnidade: 12000,
};

export interface ResultadoLcp {
  distanciaLinearM: number;
  distanciaOtimizadaM: number;
  custoEstimadoBRL: number;
  nivelDificuldade: NivelDificuldade;
  segmentos: SegmentoLcp[];
  hashCalculo: string;
  calculadoEm: string;
}

export interface ProjetoLcp {
  id: string;
  tenantId: string;
  projetoId: string;
  nomeProjeto: string;
  pontoOrigem: Coordenada;
  pontoDestino: Coordenada;
  configuracao: ConfiguracaoLcp;
  segmentosEntrada: Array<{ tipoTerritorio: TipoTerritorio; comprimentoM: number }>;
  status: StatusLcp;
  resultado?: ResultadoLcp;
  aprovadoPor?: string;
  criadoEm: string;
}

let _lcpCounter = 0;
let _segmentoCounter = 0;
const _projetos = new Map<string, ProjetoLcp>();

function calcularDistanciaLinear(a: Coordenada, b: Coordenada): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function classificarDificuldade(custo: number, distancia: number): NivelDificuldade {
  const custoPorM = custo / Math.max(distancia, 1);
  if (custoPorM < 100) return "baixo";
  if (custoPorM < 200) return "medio";
  if (custoPorM < 350) return "alto";
  return "critico";
}

export class LcpService {
  static _reset(): void {
    _lcpCounter = 0;
    _segmentoCounter = 0;
    _projetos.clear();
  }

  static criarProjeto(data: {
    tenantId: string;
    projetoId: string;
    nomeProjeto: string;
    pontoOrigem: Coordenada;
    pontoDestino: Coordenada;
    segmentosEntrada: Array<{ tipoTerritorio: TipoTerritorio; comprimentoM: number }>;
    configuracao?: Partial<ConfiguracaoLcp>;
  }): ProjetoLcp {
    const id = `lcp-${++_lcpCounter}`;
    const projeto: ProjetoLcp = {
      id,
      tenantId: data.tenantId,
      projetoId: data.projetoId,
      nomeProjeto: data.nomeProjeto,
      pontoOrigem: data.pontoOrigem,
      pontoDestino: data.pontoDestino,
      configuracao: { ...CONFIGURACAO_PADRAO, ...(data.configuracao ?? {}) },
      segmentosEntrada: data.segmentosEntrada,
      status: "rascunho",
      criadoEm: new Date().toISOString(),
    };
    _projetos.set(id, projeto);
    return projeto;
  }

  static listarProjetos(tenantId?: string): ProjetoLcp[] {
    const all = Array.from(_projetos.values());
    return tenantId ? all.filter((p) => p.tenantId === tenantId) : all;
  }

  static obterProjeto(id: string): ProjetoLcp | undefined {
    return _projetos.get(id);
  }

  static calcularTracado(lcpId: string): ProjetoLcp {
    const projeto = _projetos.get(lcpId);
    if (!projeto) throw new Error("Projeto LCP não encontrado");
    if (projeto.status === "aprovado") throw new Error("Projeto já aprovado — use novo projeto para recalcular");

    const conf = projeto.configuracao;
    const distanciaLinear = calcularDistanciaLinear(projeto.pontoOrigem, projeto.pontoDestino);

    const segmentos: SegmentoLcp[] = projeto.segmentosEntrada.map((s) => {
      const custoMap: Record<TipoTerritorio, number> = {
        urbano: conf.custoUrbanoPorM,
        rural: conf.custoRuralPorM,
        cruzamento_viario: conf.custoCruzamentoPorUnidade / Math.max(s.comprimentoM, 1),
        area_preservacao: conf.custoPreservacaoPorM,
        interferencia_subterranea: conf.custoInterferenciaPorM,
        travessia_hidrografica: conf.custoTravessiaPorUnidade / Math.max(s.comprimentoM, 1),
      };
      const custoUnitario = custoMap[s.tipoTerritorio];
      return {
        id: `seg-${++_segmentoCounter}`,
        tipoTerritorio: s.tipoTerritorio,
        comprimentoM: s.comprimentoM,
        custoUnitarioPorM: custoUnitario,
        custoTotal: custoUnitario * s.comprimentoM,
      };
    });

    const distanciaOtimizada = segmentos.reduce((acc, s) => acc + s.comprimentoM, 0);
    const custoEstimado = segmentos.reduce((acc, s) => acc + s.custoTotal, 0);
    const nivelDificuldade = classificarDificuldade(custoEstimado, distanciaOtimizada);
    const agora = new Date().toISOString();

    const resultado: ResultadoLcp = {
      distanciaLinearM: Math.round(distanciaLinear),
      distanciaOtimizadaM: distanciaOtimizada,
      custoEstimadoBRL: Math.round(custoEstimado * 100) / 100,
      nivelDificuldade,
      segmentos,
      hashCalculo: createHash("sha256")
        .update(`${lcpId}|${distanciaOtimizada}|${custoEstimado}|${agora}`)
        .digest("hex"),
      calculadoEm: agora,
    };

    projeto.resultado = resultado;
    projeto.status = "calculado";
    return projeto;
  }

  static aprovarTracado(lcpId: string, aprovadoPor: string): ProjetoLcp {
    const projeto = _projetos.get(lcpId);
    if (!projeto) throw new Error("Projeto LCP não encontrado");
    if (projeto.status !== "calculado") throw new Error("Projeto deve estar calculado para ser aprovado");
    projeto.status = "aprovado";
    projeto.aprovadoPor = aprovadoPor;
    return projeto;
  }

  static obterConfiguracaoPadrao(): ConfiguracaoLcp {
    return { ...CONFIGURACAO_PADRAO };
  }
}
