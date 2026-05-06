/**
 * Serviço T2-60 — Verificação NBR 9050 Automática
 * Análise de conformidade de acessibilidade urbana ao longo da rede projetada.
 * Referência normativa: ABNT NBR 9050:2020
 */

import { createHash } from "crypto";

export type CriterioNbr9050 =
  | "largura_calcada_minima"
  | "rampa_acesso_deficiente"
  | "piso_tatil_direcional"
  | "piso_tatil_atencao"
  | "travessia_pedestre"
  | "sinalizacao_visual"
  | "sinalizacao_sonora"
  | "mobiliario_zona_livre"
  | "inclinacao_transversal"
  | "inclinacao_longitudinal";

export type ResultadoItem = "conforme" | "nao_conforme" | "nao_aplicavel";
export type StatusAnalise = "pendente" | "analisado" | "aprovado" | "reprovado";

export interface ItemVerificacaoNbr {
  id: string;
  criterio: CriterioNbr9050;
  descricao: string;
  valorMedido?: number;
  limiteNorma: string;
  resultado: ResultadoItem;
  observacao?: string;
}

export interface AnaliseNbr9050 {
  id: string;
  tenantId: string;
  projetoId: string;
  logradouro: string;
  municipio: string;
  uf: string;
  analistaTecnico: string;
  dataAnalise: string;
  status: StatusAnalise;
  itens: ItemVerificacaoNbr[];
  scoreConformidade: number;
  parecerTecnico?: string;
  hashAnalise?: string;
  criadoEm: string;
}

const CRITERIOS_META: Record<CriterioNbr9050, { descricao: string; limiteNorma: string }> = {
  largura_calcada_minima: { descricao: "Largura mínima da faixa livre", limiteNorma: "≥ 1,20 m (mínimo absoluto NBR 9050 §6.12.1)" },
  rampa_acesso_deficiente: { descricao: "Rampa de acesso para PCD no cruzamento", limiteNorma: "Inclinação ≤ 8,33% — largura ≥ 1,20 m" },
  piso_tatil_direcional: { descricao: "Piso tátil direcional contínuo", limiteNorma: "Largura 25 cm ± 5 mm (NBR 9050 §8.2)" },
  piso_tatil_atencao: { descricao: "Piso tátil de atenção em rebaixamento", limiteNorma: "0,60 m × 0,60 m antes do cruzamento" },
  travessia_pedestre: { descricao: "Faixa de travessia elevada ou semafórica", limiteNorma: "Cota rebaixada ≤ 2 cm (NBR 9050 §6.12.6)" },
  sinalizacao_visual: { descricao: "Sinalização visual de obstáculos", limiteNorma: "Faixa de altura 0,60 m–2,10 m desobstruída" },
  sinalizacao_sonora: { descricao: "Semáforo com indicação sonora", limiteNorma: "Obrigatório em vias coletoras e arteriais (ABNT NBR 15987)" },
  mobiliario_zona_livre: { descricao: "Mobiliário urbano fora da faixa livre", limiteNorma: "Faixa livre isenta — §6.12.2 NBR 9050" },
  inclinacao_transversal: { descricao: "Inclinação transversal da calçada", limiteNorma: "≤ 3% (NBR 9050 §6.12.4)" },
  inclinacao_longitudinal: { descricao: "Inclinação longitudinal da calçada", limiteNorma: "Acompanha greide da via; se > 8,33% deve ter descanso a cada 50 m" },
};

let _analiseCounter = 0;
let _itemCounter = 0;
const _analises = new Map<string, AnaliseNbr9050>();

export class Nbr9050Service {
  static _reset(): void {
    _analiseCounter = 0;
    _itemCounter = 0;
    _analises.clear();
  }

  static criarAnalise(data: {
    tenantId: string;
    projetoId: string;
    logradouro: string;
    municipio: string;
    uf: string;
    analistaTecnico: string;
    dataAnalise: string;
  }): AnaliseNbr9050 {
    const id = `nb-${++_analiseCounter}`;
    const analise: AnaliseNbr9050 = {
      id,
      tenantId: data.tenantId,
      projetoId: data.projetoId,
      logradouro: data.logradouro,
      municipio: data.municipio,
      uf: data.uf.toUpperCase().slice(0, 2),
      analistaTecnico: data.analistaTecnico,
      dataAnalise: data.dataAnalise,
      status: "pendente",
      itens: [],
      scoreConformidade: 0,
      criadoEm: new Date().toISOString(),
    };
    _analises.set(id, analise);
    return analise;
  }

  static listarAnalises(tenantId?: string): AnaliseNbr9050[] {
    const all = Array.from(_analises.values());
    return tenantId ? all.filter((a) => a.tenantId === tenantId) : all;
  }

  static obterAnalise(id: string): AnaliseNbr9050 | undefined {
    return _analises.get(id);
  }

  static registrarItem(
    analiseId: string,
    data: {
      criterio: CriterioNbr9050;
      resultado: ResultadoItem;
      valorMedido?: number;
      observacao?: string;
    }
  ): ItemVerificacaoNbr {
    const analise = _analises.get(analiseId);
    if (!analise) throw new Error("Análise NBR 9050 não encontrada");
    if (analise.status !== "pendente") throw new Error("Análise já processada");
    const meta = CRITERIOS_META[data.criterio];
    const item: ItemVerificacaoNbr = {
      id: `nbr-${++_itemCounter}`,
      criterio: data.criterio,
      descricao: meta.descricao,
      valorMedido: data.valorMedido,
      limiteNorma: meta.limiteNorma,
      resultado: data.resultado,
      observacao: data.observacao,
    };
    analise.itens.push(item);
    return item;
  }

  static processarAnalise(analiseId: string, parecerTecnico?: string): AnaliseNbr9050 {
    const analise = _analises.get(analiseId);
    if (!analise) throw new Error("Análise NBR 9050 não encontrada");
    if (analise.itens.length === 0) throw new Error("Análise deve ter ao menos 1 item registrado");
    const aplicaveis = analise.itens.filter((i) => i.resultado !== "nao_aplicavel");
    const conformes = aplicaveis.filter((i) => i.resultado === "conforme").length;
    analise.scoreConformidade =
      aplicaveis.length > 0 ? Math.round((conformes / aplicaveis.length) * 100) : 0;
    analise.parecerTecnico = parecerTecnico;
    analise.status = analise.scoreConformidade >= 80 ? "aprovado" : "reprovado";
    analise.hashAnalise = createHash("sha256")
      .update(`${analiseId}|${analise.scoreConformidade}|${analise.dataAnalise}`)
      .digest("hex");
    return analise;
  }

  static listarCriterios(): Array<{ criterio: CriterioNbr9050; descricao: string; limiteNorma: string }> {
    return Object.entries(CRITERIOS_META).map(([k, v]) => ({
      criterio: k as CriterioNbr9050,
      ...v,
    }));
  }
}
