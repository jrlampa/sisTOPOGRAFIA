/**
 * vegetacaoInventarioService.ts — Inventário de Vegetação Simulado (T2-46).
 *
 * Roadmap Item 46 [T2]: Estimativa de supressão vegetal para projetos de
 * infraestrutura elétrica, baseada em tipologia fitogeográfica brasileira.
 */

import { BtTopology } from "./bt/btDerivedTypes.js";

// --- Tipos Locais para evitar dependências circulares ---

export interface OsmElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
}

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

export type StatusInventario = "rascunho" | "calculado" | "aprovado";

const VOLUME_M3_POR_HA: Record<TipologiaVegetacao, number> = {
  floresta_amazonica: 250,
  floresta_atlantica: 200,
  cerrado: 80,
  mata_ciliar: 150,
  vegetacao_secundaria: 60,
  campo_cerrado: 20,
};

const FATOR_COMPENSACAO: Record<StatusConservacao, number> = {
  primaria: 3.0,
  secundaria_avancada: 2.0,
  secundaria_inicial: 1.5,
  degradada: 1.0,
};

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
  detalhamentoPorTipologia: Record<string, any>;
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

export interface ResultadoSimulacaoVegetacao {
  totalConflitos: number;
  areaEstimadaHa: number;
  volumeEstimadoM3: number;
  riscoOperacional: "baixo" | "medio" | "alto";
  detalhes: Array<{
    tipo: "arvore_isolada" | "macico_vegetal";
    poleId?: string;
    distanciaM: number;
    areaM2: number;
  }>;
}

let inventarios: Map<string, InventarioVegetacao> = new Map();
let contadorInventario = 0;
let contadorUnidade = 0;

export class VegetacaoInventarioService {
  static _reset(): void {
    inventarios = new Map();
    contadorInventario = 0;
    contadorUnidade = 0;
  }

  /**
   * Executa Inventário de Vegetação Simulado (T2-46).
   * Identifica árvores e maciços vegetais do OSM próximos à rede projetada.
   */
  static estimarInventarioSimulado(topology: BtTopology, osmData: OsmElement[]): ResultadoSimulacaoVegetacao {
    const trees = (osmData || []).filter(el => el.tags?.natural === "tree");
    const forests = (osmData || []).filter(el => el.tags?.landuse === "forest" || el.tags?.natural === "wood");
    
    const detalhes: Array<{ tipo: "arvore_isolada" | "macico_vegetal"; poleId?: string; distanciaM: number; areaM2: number; }> = [];
    let totalAreaM2 = 0;

    for (const pole of topology.poles) {
      // 1. Árvores isoladas
      for (const tree of trees) {
        if (!tree.lat || !tree.lon) continue;
        const dist = this.haversineMeters(pole.lat, pole.lng, tree.lat, tree.lon);
        if (dist < 5) {
          detalhes.push({
            tipo: "arvore_isolada",
            poleId: pole.id,
            distanciaM: Math.round(dist * 10) / 10,
            areaM2: 12
          });
          totalAreaM2 += 12;
        }
      }
      // 2. Maciços
      for (const forest of forests) {
        const forestPoints = forest.geometry || [];
        const isNear = forestPoints.some(p => this.haversineMeters(pole.lat, pole.lng, p.lat, p.lon) < 20);
        if (isNear) {
          detalhes.push({
            tipo: "macico_vegetal",
            poleId: pole.id,
            distanciaM: 0,
            areaM2: 50
          });
          totalAreaM2 += 50;
          break;
        }
      }
    }

    const areaHa = totalAreaM2 / 10000;
    const volumeM3 = areaHa * VOLUME_M3_POR_HA.vegetacao_secundaria;

    return {
      totalConflitos: detalhes.length,
      areaEstimadaHa: parseFloat(areaHa.toFixed(5)),
      volumeEstimadoM3: parseFloat(volumeM3.toFixed(2)),
      riscoOperacional: detalhes.length > 5 ? "alto" : detalhes.length > 2 ? "medio" : "baixo",
      detalhes
    };
  }

  private static haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000;
    const rad = Math.PI / 180;
    const dLat = (lat2 - lat1) * rad;
    const dLng = (lng2 - lng1) * rad;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * rad) * Math.cos(lat2 * rad) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  static criarInventario(params: any): InventarioVegetacao {
    const id = `inv-${++contadorInventario}`;
    const agora = new Date();
    const inv: InventarioVegetacao = {
      id,
      ...params,
      unidades: [],
      status: "rascunho",
      criadoEm: agora,
      atualizadoEm: agora,
    };
    inventarios.set(id, inv);
    return inv;
  }

  static listarInventarios(tenantId: string): InventarioVegetacao[] {
    return Array.from(inventarios.values()).filter((i) => i.tenantId === tenantId);
  }

  static obterInventario(id: string): InventarioVegetacao | null {
    return inventarios.get(id) ?? null;
  }

  static adicionarUnidade(inventarioId: string, params: any): InventarioVegetacao | null {
    const inv = inventarios.get(inventarioId);
    if (!inv) return null;
    inv.unidades.push({ id: `uveg-${++contadorUnidade}`, ...params });
    inv.atualizadoEm = new Date();
    return inv;
  }

  static calcularSupressao(id: string): any {
    const inv = inventarios.get(id);
    if (!inv || inv.unidades.length === 0) return { erro: "Inválido" };
    let totalAreaHa = 0;
    let totalVolumeM3 = 0;
    for (const u of inv.unidades) {
      totalAreaHa += u.areaHectares;
      totalVolumeM3 += u.areaHectares * VOLUME_M3_POR_HA[u.tipologia];
    }
    inv.resultado = {
      totalAreaHa,
      totalVolumeM3,
      biomassaToneladas: totalVolumeM3 * 0.5,
      carbonoSequestradoToC: totalVolumeM3 * 0.5 * 0.47,
      compensacaoExigidaHa: totalAreaHa * 1.5,
      detalhamentoPorTipologia: {},
      hashIntegridade: "hash",
      calculadoEm: new Date(),
    };
    inv.status = "calculado";
    return inv;
  }

  static aprovarInventario(id: string): InventarioVegetacao | null {
    const inv = inventarios.get(id);
    if (!inv || inv.status !== "calculado") return null;
    inv.status = "aprovado";
    return inv;
  }

  static listarTipologias(): any[] {
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
