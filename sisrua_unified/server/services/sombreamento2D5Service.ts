/**
 * Serviço T2-61 — Análise de Sombreamento 2.5D
 * Simulação de impacto solar para otimização de ativos infraestruturais.
 */

import { createHash } from "crypto";
import { BtTopology } from "./bt/btDerivedTypes.js";

export interface OsmElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
}

export type NivelImpactoSolar = "minimo" | "baixo" | "moderado" | "alto" | "critico";
export type TipoAtivo = "poste" | "transformador" | "painel_solar" | "medicao" | "subestacao" | "edificacao" | "outro";
export type StatusAnalise = "pendente" | "calculado" | "aprovado";

export interface PerfilHorario {
  hora: number;
  emSombra: boolean;
  anguloSolarGraus: number;
  azimuteSolarGraus: number;
  irradianciaRelativa?: number;
}

export interface ResultadoSombreamento {
  ativoId?: string;
  horasSombraTotal?: number;
  horasExposta: number;
  eficienciaPercent: number;
  nivelRiscoTermico: NivelImpactoSolar;
  nivelImpacto?: NivelImpactoSolar; // Legacy compatibility
  perfisHorarios: PerfilHorario[];
  obstrucaoMaisProximaM?: number;
  hashCalculo?: string;
  calculadoEm: string;
}

export interface AnaliseSombreamento {
  id: string;
  tenantId: string;
  projetoId: string;
  nomeAtivo: string;
  tipoAtivo: TipoAtivo;
  coordenadas: { lat: number; lon: number };
  alturaAtivo: number;
  alturaObstrucao: number;
  distanciaObstrucaoM: number;
  orientacaoGraus: number;
  dataAnalise: string;
  status: StatusAnalise;
  resultado?: ResultadoSombreamento;
  criadoEm: string;
}

let _analiseCounter = 0;
const _analises = new Map<string, AnaliseSombreamento>();

class SolarEngine {
  static getPosition(lat: number, lng: number, date: Date) {
    const PI = Math.PI;
    const rad = PI / 180;
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date.getTime() - start.getTime();
    const day = Math.floor(diff / (1000 * 60 * 60 * 24));
    const h = date.getHours() + date.getMinutes() / 60;
    const d = 23.45 * Math.sin(rad * (360 / 365 * (day - 81)));
    const hAngle = (h - 12) * 15;
    const latR = lat * rad;
    const dR = d * rad;
    const hR = hAngle * rad;
    const sinAlpha = Math.sin(latR) * Math.sin(dR) + Math.cos(latR) * Math.cos(dR) * Math.cos(hR);
    const alpha = Math.asin(Math.max(-1, Math.min(1, sinAlpha)));
    const cosPhi = (Math.sin(dR) - Math.sin(alpha) * Math.sin(latR)) / (Math.cos(alpha) * Math.cos(latR));
    let phi = Math.acos(Math.max(-1, Math.min(1, cosPhi))) / rad;
    if (h > 12) phi = 360 - phi;
    return { altitude: alpha / rad, azimuth: phi };
  }
}

export class Sombreamento2D5Service {
  static _reset(): void {
    _analiseCounter = 0;
    _analises.clear();
  }

  static criarAnalise(data: any): AnaliseSombreamento {
    const id = `sa-${++_analiseCounter}`;
    const analise: AnaliseSombreamento = {
      id,
      ...data,
      status: "pendente",
      criadoEm: new Date().toISOString(),
    };
    _analises.set(id, analise);
    return analise;
  }

  static listarAnalises(tenantId?: string): AnaliseSombreamento[] {
    const all = Array.from(_analises.values());
    return tenantId ? all.filter((a) => a.tenantId === tenantId) : all;
  }

  static obterAnalise(id: string): AnaliseSombreamento | undefined {
    return _analises.get(id);
  }

  static calcularSombreamento(analiseId: string): AnaliseSombreamento {
    const analise = _analises.get(analiseId);
    if (!analise) throw new Error("Análise não encontrada");
    
    const dataRef = new Date(analise.dataAnalise);
    const perfisHorarios: PerfilHorario[] = [];
    let horasExposta = 0;

    for (let hora = 0; hora < 24; hora++) {
      const dataHora = new Date(dataRef);
      dataHora.setHours(hora, 0, 0, 0);
      const pos = SolarEngine.getPosition(analise.coordenadas.lat, analise.coordenadas.lon, dataHora);
      
      const anguloObstrucao = (Math.atan(analise.alturaObstrucao / Math.max(analise.distanciaObstrucaoM, 1)) * 180) / Math.PI;
      const emSombra = pos.altitude <= 0 || pos.altitude < anguloObstrucao;

      perfisHorarios.push({
        hora,
        emSombra,
        anguloSolarGraus: Math.round(pos.altitude * 10) / 10,
        azimuteSolarGraus: Math.round(pos.azimuth * 10) / 10,
        irradianciaRelativa: emSombra ? 0 : Math.round(Math.sin(pos.altitude * Math.PI / 180) * 100) / 100
      });
      if (pos.altitude > 0 && !emSombra) horasExposta++;
    }

    const totalDaylight = perfisHorarios.filter(p => p.anguloSolarGraus > 0).length;
    const eficiencia = totalDaylight > 0 ? Math.round((horasExposta / totalDaylight) * 100) : 100;

    analise.resultado = {
      horasExposta,
      eficienciaPercent: eficiencia,
      nivelRiscoTermico: this.classificarRisco(eficiencia, analise.tipoAtivo),
      nivelImpacto: this.classificarRisco(eficiencia, analise.tipoAtivo),
      perfisHorarios,
      hashCalculo: createHash("sha256")
        .update(`${analiseId}|${eficiencia}|${analise.dataAnalise}`)
        .digest("hex"),
      calculadoEm: new Date().toISOString()
    };
    analise.status = "calculado";
    return analise;
  }

  static aprovarAnalise(analiseId: string): AnaliseSombreamento {
    const analise = _analises.get(analiseId);
    if (!analise) throw new Error("Análise não encontrada");
    if (analise.status !== "calculado") throw new Error("Análise deve estar calculada");
    analise.status = "aprovado";
    return analise;
  }

  static analisarSombreamentoAutomatico(topology: BtTopology, osmData: OsmElement[]): ResultadoSombreamento[] {
    // BtTransformer não possui lat/lng — buscamos a posição pelo poleId associado
    const poleMap = new Map(topology.poles.map(p => [p.id, p]));

    const assets = [
      ...topology.poles.map(p => ({ id: p.id, lat: p.lat, lng: p.lng, type: "poste" as TipoAtivo, h: 10 })),
      ...topology.transformers
        .filter(t => (typeof (t as any).lat === "number" && typeof (t as any).lng === "number") || (t.poleId && poleMap.has(t.poleId)))
        .map(t => {
          const pole = t.poleId ? poleMap.get(t.poleId) : undefined;
          return {
            id: t.id,
            lat: typeof (t as any).lat === "number" ? (t as any).lat : pole!.lat,
            lng: typeof (t as any).lng === "number" ? (t as any).lng : pole!.lng,
            type: "transformador" as TipoAtivo,
            h: 8,
          };
        })
    ];

    const buildings = (osmData || []).filter(el => el && el.tags && !!el.tags.building);
    const dataReferencia = new Date();

    return assets.map(asset => {
      const perfisHorarios: PerfilHorario[] = [];
      let horasExposta = 0;
      let minObstrucaoDist = 999;

      for (let hora = 8; hora <= 17; hora++) {
        const dataHora = new Date(dataReferencia);
        dataHora.setHours(hora, 0, 0, 0);
        const pos = SolarEngine.getPosition(asset.lat, asset.lng, dataHora);
        
        let emSombra = false;
        if (pos.altitude <= 0) {
          emSombra = true;
        } else {
          for (const b of buildings) {
            const bLat = b.lat || (b as any).center?.lat;
            const bLon = b.lon || (b as any).center?.lon;
            if (!bLat || !bLon) continue;
            
            const dist = this.haversineMeters(asset.lat, asset.lng, bLat, bLon);
            if (dist < 50) {
              minObstrucaoDist = Math.min(minObstrucaoDist, dist);
              const heightTag = b.tags?.height || b.tags?.["building:levels"];
              const bHeight = (parseFloat(heightTag || "1") * 3.5) || 4;
              const deltaH = bHeight - asset.h;
              if (deltaH > 0) {
                const anguloObstrucao = (Math.atan(deltaH / Math.max(dist, 1)) * 180) / Math.PI;
                if (pos.altitude < anguloObstrucao) {
                  emSombra = true;
                  break;
                }
              }
            }
          }
        }

        perfisHorarios.push({
          hora,
          emSombra,
          anguloSolarGraus: Math.round(pos.altitude * 10) / 10,
          azimuteSolarGraus: Math.round(pos.azimuth * 10) / 10
        });
        if (!emSombra) horasExposta++;
      }

      const eficiencia = Math.round((horasExposta / 10) * 100);
      return {
        ativoId: asset.id,
        horasExposta,
        eficienciaPercent: eficiencia,
        nivelRiscoTermico: this.classificarRisco(eficiencia, asset.type),
        perfisHorarios,
        obstrucaoMaisProximaM: minObstrucaoDist === 999 ? undefined : Math.round(minObstrucaoDist * 10) / 10,
        calculadoEm: new Date().toISOString()
      };
    });
  }

  private static haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const rad = Math.PI / 180;
    const R = 6371000;
    const dLat = (lat2 - lat1) * rad;
    const dLng = (lng2 - lng1) * rad;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * rad) * Math.cos(lat2 * rad) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private static classificarRisco(eficiencia: number, tipo: TipoAtivo): NivelImpactoSolar {
    if (tipo === "transformador") {
      if (eficiencia >= 80) return "alto";
      if (eficiencia >= 50) return "moderado";
      return "baixo";
    }
    if (eficiencia >= 80) return "minimo";
    if (eficiencia >= 60) return "baixo";
    if (eficiencia >= 40) return "moderado";
    return "critico";
  }
}
