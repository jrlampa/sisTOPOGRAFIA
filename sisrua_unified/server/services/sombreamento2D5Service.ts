/**
 * Serviço T2-61 — Análise de Sombreamento 2.5D
 * Simulação de impacto solar para otimização de ativos infraestruturais.
 */

import { createHash } from "crypto";

export type NivelImpactoSolar = "minimo" | "baixo" | "moderado" | "alto" | "critico";
export type TipoAtivo =
  | "poste"
  | "transformador"
  | "painel_solar"
  | "medicao"
  | "subestacao"
  | "edificacao"
  | "outro";
export type StatusAnalise = "pendente" | "calculado" | "aprovado";

export interface PerfilHorario {
  hora: number;
  emSombra: boolean;
  anguloSolarGraus: number;
  irradianciaRelativa: number;
}

export interface ResultadoSombreamento {
  horasSombraTotal: number;
  horasExposta: number;
  eficienciaPercent: number;
  nivelImpacto: NivelImpactoSolar;
  perfisHorarios: PerfilHorario[];
  hashCalculo: string;
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

/**
 * Calcula ângulo solar simplificado para uma hora do dia.
 * Modelo simplificado: ângulo máximo ao meio-dia, 0 ao nascer/pôr do sol.
 */
function calcularAnguloSolar(hora: number, lat: number, diaDoAno: number): number {
  const declinacao = 23.45 * Math.sin(((360 / 365) * (diaDoAno - 81) * Math.PI) / 180);
  const anguloHorario = (hora - 12) * 15;
  const latRad = (lat * Math.PI) / 180;
  const decRad = (declinacao * Math.PI) / 180;
  const hRad = (anguloHorario * Math.PI) / 180;
  const altitudeSolar = Math.asin(
    Math.sin(latRad) * Math.sin(decRad) +
      Math.cos(latRad) * Math.cos(decRad) * Math.cos(hRad)
  );
  return (altitudeSolar * 180) / Math.PI;
}

function calcularIrradiancia(anguloSolar: number): number {
  if (anguloSolar <= 0) return 0;
  return Math.min(1.0, Math.sin((anguloSolar * Math.PI) / 180));
}

function emSombra(anguloSolar: number, alturaObstrucao: number, distanciaM: number): boolean {
  if (anguloSolar <= 0) return true;
  const anguloObstrucao = (Math.atan(alturaObstrucao / Math.max(distanciaM, 0.01)) * 180) / Math.PI;
  return anguloSolar < anguloObstrucao;
}

function classificarImpacto(eficiencia: number): NivelImpactoSolar {
  if (eficiencia >= 90) return "minimo";
  if (eficiencia >= 70) return "baixo";
  if (eficiencia >= 50) return "moderado";
  if (eficiencia >= 30) return "alto";
  return "critico";
}

export class Sombreamento2D5Service {
  static _reset(): void {
    _analiseCounter = 0;
    _analises.clear();
  }

  static criarAnalise(data: {
    tenantId: string;
    projetoId: string;
    nomeAtivo: string;
    tipoAtivo: TipoAtivo;
    coordenadas: { lat: number; lon: number };
    alturaAtivo: number;
    alturaObstrucao: number;
    distanciaObstrucaoM: number;
    orientacaoGraus?: number;
    dataAnalise: string;
  }): AnaliseSombreamento {
    const id = `sa-${++_analiseCounter}`;
    const analise: AnaliseSombreamento = {
      id,
      tenantId: data.tenantId,
      projetoId: data.projetoId,
      nomeAtivo: data.nomeAtivo,
      tipoAtivo: data.tipoAtivo,
      coordenadas: data.coordenadas,
      alturaAtivo: data.alturaAtivo,
      alturaObstrucao: data.alturaObstrucao,
      distanciaObstrucaoM: data.distanciaObstrucaoM,
      orientacaoGraus: data.orientacaoGraus ?? 0,
      dataAnalise: data.dataAnalise,
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
    if (!analise) throw new Error("Análise de sombreamento não encontrada");
    if (analise.status === "aprovado") throw new Error("Análise já aprovada");

    // Determina dia do ano a partir da data de análise
    const dataRef = new Date(analise.dataAnalise);
    const inicioAno = new Date(dataRef.getFullYear(), 0, 0);
    const diaDoAno = Math.floor((dataRef.getTime() - inicioAno.getTime()) / 86400000);

    const perfisHorarios: PerfilHorario[] = [];
    let horasSombra = 0;
    let horasExposta = 0;

    for (let hora = 0; hora < 24; hora++) {
      const angulo = calcularAnguloSolar(hora, analise.coordenadas.lat, diaDoAno);
      const irradiancia = calcularIrradiancia(angulo);
      const sombra = emSombra(angulo, analise.alturaObstrucao, analise.distanciaObstrucaoM);
      perfisHorarios.push({
        hora,
        emSombra: sombra,
        anguloSolarGraus: Math.round(angulo * 10) / 10,
        irradianciaRelativa: Math.round(irradiancia * 100) / 100,
      });
      if (angulo > 0) {
        if (sombra) horasSombra++;
        else horasExposta++;
      }
    }

    const totalDaylight = horasSombra + horasExposta;
    const eficiencia =
      totalDaylight > 0 ? Math.round((horasExposta / totalDaylight) * 100) : 100;
    const agora = new Date().toISOString();

    analise.resultado = {
      horasSombraTotal: horasSombra,
      horasExposta,
      eficienciaPercent: eficiencia,
      nivelImpacto: classificarImpacto(eficiencia),
      perfisHorarios,
      hashCalculo: createHash("sha256")
        .update(`${analiseId}|${eficiencia}|${analise.dataAnalise}`)
        .digest("hex"),
      calculadoEm: agora,
    };
    analise.status = "calculado";
    return analise;
  }

  static aprovarAnalise(analiseId: string): AnaliseSombreamento {
    const analise = _analises.get(analiseId);
    if (!analise) throw new Error("Análise não encontrada");
    if (analise.status !== "calculado") throw new Error("Análise deve estar calculada para ser aprovada");
    analise.status = "aprovado";
    return analise;
  }

  static listarTiposAtivo(): TipoAtivo[] {
    return ["poste", "transformador", "painel_solar", "medicao", "subestacao", "edificacao", "outro"];
  }
}
