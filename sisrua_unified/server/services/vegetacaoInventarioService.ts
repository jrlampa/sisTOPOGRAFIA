/**
 * vegetacaoInventarioService.ts — Inventário de Vegetação Simulado (T2-46).
 *
 * Roadmap Item 46 [T2]: Estimativa de supressão vegetal para projetos de
 * infraestrutura elétrica, baseada em tipologia fitogeográfica brasileira.
 *
 * Metodologias de referência:
 *   - CONAMA 369/2006 (APP em área urbana)
 *   - Lei 11.428/2006 (Mata Atlântica — fatores de compensação)
 *   - IBGE / MapBiomas: tipologias de uso e cobertura do solo
 *   - IPCC (2006): fator de conversão biomassa → carbono = 0,47 tC/tbiomassa
 *   - Densidade média da madeira: 0,5 t/m³ (valor médio tropical)
 */

import { createHash } from "crypto";

// ─── Tipologias e Enums ───────────────────────────────────────────────────────

export type TipologiaVegetacao =
  | "floresta_amazonica"
  | "floresta_atlantica"
  | "cerrado"
  | "mata_ciliar"
  | "vegetacao_secundaria"
  | "campo_cerrado";

export type StatusConservacao =
  | "primaria"
  | "secundaria_avancada"
  | "secundaria_inicial"
  | "degradada";

export type StatusInventario =
  | "rascunho"
  | "calculado"
  | "aprovado";

// ─── Parâmetros fitogeográficos ───────────────────────────────────────────────

/** Volume comercial médio (m³/ha) por tipologia. */
const VOLUME_M3_POR_HA: Record<TipologiaVegetacao, number> = {
  floresta_amazonica:   250,
  floresta_atlantica:   200,
  cerrado:               80,
  mata_ciliar:          150,
  vegetacao_secundaria:  60,
  campo_cerrado:         20,
};

/**
 * Fator multiplicador de compensação por status de conservação.
 * Referência: Lei 11.428/2006 + resoluções CONAMA.
 */
const FATOR_COMPENSACAO: Record<StatusConservacao, number> = {
  primaria:             3.0,
  secundaria_avancada:  2.0,
  secundaria_inicial:   1.5,
  degradada:            1.0,
};

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface UnidadeVegetacao {
  id: string;
  tipologia: TipologiaVegetacao;
  statusConservacao: StatusConservacao;
  areaHectares: number;
  municipio?: string;
  uf?: string;
  descricao?: string;
}

export interface ResultadoSupressao {
  totalAreaHa: number;
  totalVolumeM3: number;
  biomassaToneladas: number;
  carbonoSequestradoToC: number;
  compensacaoExigidaHa: number;
  detalhamentoPorTipologia: Record<string, {
    areaHa: number;
    volumeM3: number;
    compensacaoHa: number;
  }>;
  hashIntegridade: string;
  calculadoEm: Date;
}

export interface InventarioVegetacao {
  id: string;
  nome: string;
  tenantId: string;
  projetoId?: string;
  descricao?: string;
  unidades: UnidadeVegetacao[];
  resultado?: ResultadoSupressao;
  status: StatusInventario;
  criadoEm: Date;
  atualizadoEm: Date;
}

// ─── Estado interno ───────────────────────────────────────────────────────────

let inventarios: Map<string, InventarioVegetacao> = new Map();
let contadorInventario = 0;
let contadorUnidade = 0;

// ─── Serviço ──────────────────────────────────────────────────────────────────

export class VegetacaoInventarioService {
  static _reset(): void {
    inventarios = new Map();
    contadorInventario = 0;
    contadorUnidade = 0;
  }

  static criarInventario(params: {
    nome: string;
    tenantId: string;
    projetoId?: string;
    descricao?: string;
  }): InventarioVegetacao {
    const id = `inv-${++contadorInventario}`;
    const agora = new Date();
    const inventario: InventarioVegetacao = {
      id,
      nome: params.nome,
      tenantId: params.tenantId,
      projetoId: params.projetoId,
      descricao: params.descricao,
      unidades: [],
      status: "rascunho",
      criadoEm: agora,
      atualizadoEm: agora,
    };
    inventarios.set(id, inventario);
    return inventario;
  }

  static listarInventarios(tenantId: string): InventarioVegetacao[] {
    return Array.from(inventarios.values()).filter((i) => i.tenantId === tenantId);
  }

  static obterInventario(id: string): InventarioVegetacao | null {
    return inventarios.get(id) ?? null;
  }

  static adicionarUnidade(
    inventarioId: string,
    params: {
      tipologia: TipologiaVegetacao;
      statusConservacao: StatusConservacao;
      areaHectares: number;
      municipio?: string;
      uf?: string;
      descricao?: string;
    }
  ): InventarioVegetacao | null {
    const inv = inventarios.get(inventarioId);
    if (!inv) return null;
    const unidade: UnidadeVegetacao = {
      id: `uveg-${++contadorUnidade}`,
      tipologia: params.tipologia,
      statusConservacao: params.statusConservacao,
      areaHectares: params.areaHectares,
      municipio: params.municipio,
      uf: params.uf,
      descricao: params.descricao,
    };
    inv.unidades.push(unidade);
    inv.status = "rascunho";
    inv.resultado = undefined;
    inv.atualizadoEm = new Date();
    return inv;
  }

  static calcularSupressao(id: string): InventarioVegetacao | { erro: string } {
    const inv = inventarios.get(id);
    if (!inv) return { erro: "Inventário não encontrado" };
    if (inv.unidades.length === 0) return { erro: "Nenhuma unidade de vegetação cadastrada" };

    let totalAreaHa = 0;
    let totalVolumeM3 = 0;
    let totalCompensacaoHa = 0;

    const detalhamento: Record<string, { areaHa: number; volumeM3: number; compensacaoHa: number }> = {};

    for (const u of inv.unidades) {
      const volume = u.areaHectares * VOLUME_M3_POR_HA[u.tipologia];
      const fator = FATOR_COMPENSACAO[u.statusConservacao];
      const compensacao = u.areaHectares * fator;

      totalAreaHa += u.areaHectares;
      totalVolumeM3 += volume;
      totalCompensacaoHa += compensacao;

      const key = u.tipologia;
      if (!detalhamento[key]) {
        detalhamento[key] = { areaHa: 0, volumeM3: 0, compensacaoHa: 0 };
      }
      detalhamento[key].areaHa += u.areaHectares;
      detalhamento[key].volumeM3 += volume;
      detalhamento[key].compensacaoHa += compensacao;
    }

    // Biomassa (ton): volume × densidade 0,5 t/m³
    const biomassaTon = totalVolumeM3 * 0.5;
    // Carbono (tC): biomassa × fator IPCC 0,47
    const carbonoToC = biomassaTon * 0.47;

    for (const key of Object.keys(detalhamento)) {
      detalhamento[key].areaHa = parseFloat(detalhamento[key].areaHa.toFixed(4));
      detalhamento[key].volumeM3 = parseFloat(detalhamento[key].volumeM3.toFixed(2));
      detalhamento[key].compensacaoHa = parseFloat(detalhamento[key].compensacaoHa.toFixed(4));
    }

    const hashIntegridade = createHash("sha256")
      .update(JSON.stringify({ inventarioId: id, totalAreaHa, totalVolumeM3, totalCompensacaoHa }))
      .digest("hex");

    inv.resultado = {
      totalAreaHa: parseFloat(totalAreaHa.toFixed(4)),
      totalVolumeM3: parseFloat(totalVolumeM3.toFixed(2)),
      biomassaToneladas: parseFloat(biomassaTon.toFixed(2)),
      carbonoSequestradoToC: parseFloat(carbonoToC.toFixed(2)),
      compensacaoExigidaHa: parseFloat(totalCompensacaoHa.toFixed(4)),
      detalhamentoPorTipologia: detalhamento,
      hashIntegridade,
      calculadoEm: new Date(),
    };
    inv.status = "calculado";
    inv.atualizadoEm = new Date();
    return inv;
  }

  static aprovarInventario(id: string): InventarioVegetacao | null {
    const inv = inventarios.get(id);
    if (!inv || inv.status !== "calculado") return null;
    inv.status = "aprovado";
    inv.atualizadoEm = new Date();
    return inv;
  }

  static listarTipologias(): {
    codigo: TipologiaVegetacao;
    nome: string;
    volumeM3PorHa: number;
  }[] {
    const nomes: Record<TipologiaVegetacao, string> = {
      floresta_amazonica: "Floresta Amazônica",
      floresta_atlantica: "Mata Atlântica",
      cerrado: "Cerrado",
      mata_ciliar: "Mata Ciliar / Galeria",
      vegetacao_secundaria: "Vegetação Secundária",
      campo_cerrado: "Campo Cerrado",
    };
    return (Object.keys(VOLUME_M3_POR_HA) as TipologiaVegetacao[]).map((t) => ({
      codigo: t,
      nome: nomes[t],
      volumeM3PorHa: VOLUME_M3_POR_HA[t],
    }));
  }
}
