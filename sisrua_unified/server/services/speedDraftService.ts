/**
 * speedDraftService.ts — Templates de Speed Draft por Concessionária (T2-81).
 *
 * Roadmap Item 81 [T2]: Biblioteca de templates de padrões técnicos pré-configurados
 * por concessionária de distribuição para aceleração de projetos de redes BT/MT.
 *
 * Referências:
 *   - CEMIG ND 2.2 (2020): norma de distribuição MT/BT — padrão de projeto
 *   - COPEL NTC 813001 (2021): norma técnica de construção de redes de distribuição
 *   - LIGHT SN-RE-04 (2022): padrão de materiais e projetos de redes BT
 *   - ENEL SP NOR-GD-069 (2019): norma de projetos de distribuição
 *   - CELPE NTE-011 (2018): especificação técnica de materiais e equipamentos
 *   - NEOENERGIA / COELBA: padrão de projeto MT/BT nordeste
 */

import { randomUUID } from "crypto";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type TipoRede = "bt" | "mt" | "bt_mt";
export type TipoPoste = "concreto" | "madeira" | "ferro" | "fibra_vidro";
export type TipoCondutor = "aluminio_multiplexado" | "aluminio_nu" | "cobre_nu" | "cobre_isolado";
export type RegiaoGeografica = "sudeste" | "sul" | "nordeste" | "norte" | "centro_oeste";

/** Concessionárias suportadas (não exaustivo — base para catálogo inicial). */
export type CodConcessionaria =
  | "CEMIG"
  | "COPEL"
  | "LIGHT"
  | "ENEL_SP"
  | "ENEL_RJ"
  | "ENEL_CE"
  | "CELPE"
  | "COELBA"
  | "NEOENERGIA_PE"
  | "ENERGISA"
  | "EQUATORIAL"
  | "GENERICA";

export type StatusTemplate = "ativo" | "obsoleto" | "em_revisao";

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface PadraoMaterial {
  componente: string;
  especificacao: string;
  unidade: string;
  codigoAneel?: string;
}

export interface TemplateSpeedDraft {
  id: string;
  nome: string;
  tenantId: string;
  concessionaria: CodConcessionaria;
  tipoRede: TipoRede;
  regiaoGeografica: RegiaoGeografica;
  tensaoNominalKv: number;
  tipoPoste: TipoPoste;
  alturaPostePadrao: number;           // metros
  vaoMaximoM: number;                  // metros — limite por trecho
  tipoCondutor: TipoCondutor;
  secaoMinimaCondutorMm2: number;
  secaoMaximaCondutorMm2: number;
  capacidadeTransformadorKva?: number; // kVA — se previsto no template
  fatorDemanda: number;                // 0–1
  fatorCoincidencia: number;           // 0–1
  materiaisPadrao: PadraoMaterial[];
  versaoNorma: string;
  anoVigencia: number;
  status: StatusTemplate;
  observacoes?: string;
  criadoEm: Date;
  atualizadoEm: Date;
}

// ─── Templates de referência embutidos ───────────────────────────────────────

function buildTemplatesReferencia(): TemplateSpeedDraft[] {
  const agora = new Date();
  return [
    {
      id: "tpl-cemig-bt",
      nome: "CEMIG — Rede BT Padrão Urbano",
      tenantId: "_sistema",
      concessionaria: "CEMIG",
      tipoRede: "bt",
      regiaoGeografica: "sudeste",
      tensaoNominalKv: 0.22,
      tipoPoste: "concreto",
      alturaPostePadrao: 10,
      vaoMaximoM: 40,
      tipoCondutor: "aluminio_multiplexado",
      secaoMinimaCondutorMm2: 16,
      secaoMaximaCondutorMm2: 95,
      capacidadeTransformadorKva: 75,
      fatorDemanda: 0.65,
      fatorCoincidencia: 0.60,
      materiaisPadrao: [
        { componente: "Cabo multiplexado", especificacao: "CAA 3×35+16 mm²", unidade: "m" },
        { componente: "Poste concreto circular", especificacao: "10 m / 600 daN", unidade: "un" },
        { componente: "Transformador monoférico", especificacao: "5/7,5/10 kVA 13,8kV/220V", unidade: "un" },
      ],
      versaoNorma: "ND 2.2 Rev.4 (2020)",
      anoVigencia: 2020,
      status: "ativo",
      criadoEm: agora,
      atualizadoEm: agora,
    },
    {
      id: "tpl-copel-bt",
      nome: "COPEL — Rede BT Padrão Urbano",
      tenantId: "_sistema",
      concessionaria: "COPEL",
      tipoRede: "bt",
      regiaoGeografica: "sul",
      tensaoNominalKv: 0.22,
      tipoPoste: "concreto",
      alturaPostePadrao: 11,
      vaoMaximoM: 40,
      tipoCondutor: "aluminio_multiplexado",
      secaoMinimaCondutorMm2: 16,
      secaoMaximaCondutorMm2: 70,
      capacidadeTransformadorKva: 45,
      fatorDemanda: 0.65,
      fatorCoincidencia: 0.55,
      materiaisPadrao: [
        { componente: "Cabo multiplexado", especificacao: "CAA 3×25+16 mm²", unidade: "m" },
        { componente: "Poste concreto duplo T", especificacao: "11 m / 600 daN", unidade: "un" },
      ],
      versaoNorma: "NTC 813001 Rev.2 (2021)",
      anoVigencia: 2021,
      status: "ativo",
      criadoEm: agora,
      atualizadoEm: agora,
    },
    {
      id: "tpl-light-bt",
      nome: "LIGHT — Rede BT Padrão Rio de Janeiro",
      tenantId: "_sistema",
      concessionaria: "LIGHT",
      tipoRede: "bt",
      regiaoGeografica: "sudeste",
      tensaoNominalKv: 0.22,
      tipoPoste: "concreto",
      alturaPostePadrao: 9,
      vaoMaximoM: 35,
      tipoCondutor: "aluminio_multiplexado",
      secaoMinimaCondutorMm2: 16,
      secaoMaximaCondutorMm2: 50,
      capacidadeTransformadorKva: 45,
      fatorDemanda: 0.65,
      fatorCoincidencia: 0.60,
      materiaisPadrao: [
        { componente: "Cabo multiplexado", especificacao: "CAA 3×25+16 mm²", unidade: "m" },
        { componente: "Poste concreto circular", especificacao: "9 m / 400 daN", unidade: "un" },
      ],
      versaoNorma: "SN-RE-04 Rev.3 (2022)",
      anoVigencia: 2022,
      status: "ativo",
      criadoEm: agora,
      atualizadoEm: agora,
    },
  ];
}

// ─── Estado interno ───────────────────────────────────────────────────────────

let templates: Map<string, TemplateSpeedDraft> = new Map();
let contador = 3; // 3 templates de referência pré-carregados

function _inicializarTemplates(): void {
  templates = new Map();
  for (const t of buildTemplatesReferencia()) {
    templates.set(t.id, t);
  }
}

_inicializarTemplates();

// ─── Serviço ──────────────────────────────────────────────────────────────────

export class SpeedDraftService {
  static _reset(): void {
    contador = 3;
    _inicializarTemplates();
  }

  static listarTemplates(
    filtros?: {
      concessionaria?: CodConcessionaria;
      tipoRede?: TipoRede;
      tenantId?: string;
      status?: StatusTemplate;
    }
  ): TemplateSpeedDraft[] {
    let resultado = Array.from(templates.values());
    if (filtros?.concessionaria) {
      resultado = resultado.filter((t) => t.concessionaria === filtros.concessionaria);
    }
    if (filtros?.tipoRede) {
      resultado = resultado.filter((t) => t.tipoRede === filtros.tipoRede);
    }
    if (filtros?.tenantId) {
      resultado = resultado.filter(
        (t) => t.tenantId === filtros.tenantId || t.tenantId === "_sistema"
      );
    }
    if (filtros?.status) {
      resultado = resultado.filter((t) => t.status === filtros.status);
    }
    return resultado;
  }

  static obterTemplate(id: string): TemplateSpeedDraft | null {
    return templates.get(id) ?? null;
  }

  static criarTemplate(
    tenantId: string,
    dados: Omit<
      TemplateSpeedDraft,
      "id" | "tenantId" | "status" | "criadoEm" | "atualizadoEm"
    >
  ): TemplateSpeedDraft | { erro: string } {
    if (dados.vaoMaximoM > 40) {
      return { erro: "Vão máximo não pode exceder 40 m (PRODIST Módulo 8)" };
    }
    if (dados.fatorDemanda < 0 || dados.fatorDemanda > 1) {
      return { erro: "Fator de demanda deve estar entre 0 e 1" };
    }
    const id = `tpl-${++contador}`;
    const agora = new Date();
    const tpl: TemplateSpeedDraft = {
      id,
      tenantId,
      status: "ativo",
      criadoEm: agora,
      atualizadoEm: agora,
      ...dados,
    };
    templates.set(id, tpl);
    return tpl;
  }

  static atualizarStatus(
    id: string,
    status: StatusTemplate
  ): TemplateSpeedDraft | null {
    const tpl = templates.get(id);
    if (!tpl) return null;
    tpl.status = status;
    tpl.atualizadoEm = new Date();
    return tpl;
  }

  static listarConcessionarias(): CodConcessionaria[] {
    return [
      "CEMIG", "COPEL", "LIGHT", "ENEL_SP", "ENEL_RJ", "ENEL_CE",
      "CELPE", "COELBA", "NEOENERGIA_PE", "ENERGISA", "EQUATORIAL", "GENERICA",
    ];
  }
}
