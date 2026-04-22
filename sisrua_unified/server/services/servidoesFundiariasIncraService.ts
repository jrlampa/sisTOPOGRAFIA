/**
 * T2-107 — Gestão de Servidões Fundiárias com Georreferenciamento SIRGAS 2000 (INCRA/SIGEF)
 *
 * Referências normativas:
 *  - INCRA IN nº 77/2013 — Georreferenciamento de Imóveis Rurais
 *  - INCRA IN nº 65/2010 — Norma Técnica para Georreferenciamento
 *  - Lei nº 10.267/2001 — Cadastro de Imóveis Rurais (SNCR/SIGEF)
 *  - ABNT NBR 14.166:2020 — Rede de Referência Cadastral Municipal
 *  - Decreto nº 9.311/2018 — Georreferenciamento de imóveis rurais
 */

import { createHash, randomUUID } from "crypto";

export type TipoServidao =
  | "passagem"
  | "eletrica"
  | "ductos"
  | "acesso_producao"
  | "hidrica"
  | "servidao_ambiental"
  | "faixa_dominio"
  | "reserva_legal";

export type ClassePrecisaoGNSS = "A" | "B" | "C";

export type StatusServidao =
  | "em_tramitacao"
  | "certificada"
  | "averbada"
  | "cancelada"
  | "suspensa";

/** Precisão posicional máxima por classe (metros) — INCRA IN 77/2013 */
export const PRECISAO_MAXIMA_M: Record<ClassePrecisaoGNSS, number> = {
  A: 0.5,
  B: 1.0,
  C: 3.0,
};

export interface Vertice {
  id: string;
  codigo: string;       // ex: M-01, V-01
  latitude: number;     // decimal graus, datum SIRGAS 2000
  longitude: number;
  altitudeM?: number;
  descricaoLocalizacao: string;
  precisaoM: number;    // erro posicional (m)
  metodoLevantamento: "GNSS_PPP" | "GNSS_RTK" | "GPS_Convencional" | "Total_Station";
}

export interface Confrontante {
  id: string;
  nome: string;
  cpfCnpjHash: string;  // SHA-256 do CPF/CNPJ (LGPD)
  lado: "norte" | "sul" | "leste" | "oeste" | "nordeste" | "noroeste" | "sudeste" | "sudoeste";
  matriculaImovel?: string;
}

export interface ProcessoServidao {
  id: string;
  tenantId: string;
  titulo: string;
  tipoServidao: TipoServidao;
  matriculaImovelServiente: string;
  municipio: string;
  uf: string;
  status: StatusServidao;
  classePrecisaoExigida: ClassePrecisaoGNSS;
  vertices: Vertice[];
  confrontantes: Confrontante[];
  responsavelTecnico: string;
  creaResponsavel?: string;
  areaCalculadaHa?: number;
  perimetroCalculadoM?: number;
  hashIntegridade?: string;
  criadoEm: string;
  calculadoEm?: string;
  certificadoEm?: string;
}

export interface ResultadoCalculo {
  processId: string;
  areaHa: number;
  perimetroM: number;
  verticesValidos: boolean;
  classePrecisaoAtingida: ClassePrecisaoGNSS;
  precisaoMaximaMedida: number;
  hashIntegridade: string;
  calculadoEm: string;
}

// ─── Estado em memória ───────────────────────────────────────────────────────
const processos = new Map<string, ProcessoServidao>();
let contProcesso = 0;
let contVertice = 0;
let contConfrontante = 0;

// ─── Utilitários geoespaciais ────────────────────────────────────────────────

/** Distância Haversine entre dois pontos (lat/lon em graus decimais) em metros */
function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Área do polígono pela fórmula de Gauss (Shoelace) em m² */
function areaGaussM2(vertices: Vertice[]): number {
  if (vertices.length < 3) return 0;
  const R = 6_371_000;
  let area = 0;
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const λi = (vertices[i].longitude * Math.PI) / 180;
    const λj = (vertices[j].longitude * Math.PI) / 180;
    const φi = (vertices[i].latitude * Math.PI) / 180;
    const φj = (vertices[j].latitude * Math.PI) / 180;
    area += (λj - λi) * (2 + Math.sin(φi) + Math.sin(φj));
  }
  return Math.abs((area * R * R) / 2);
}

/** Classifica a precisão atingida com base no pior vértice */
function classificarPrecisao(vertices: Vertice[]): ClassePrecisaoGNSS {
  const max = Math.max(...vertices.map((v) => v.precisaoM));
  if (max <= PRECISAO_MAXIMA_M.A) return "A";
  if (max <= PRECISAO_MAXIMA_M.B) return "B";
  return "C";
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class ServidoesFundiariasIncraService {
  static _reset(): void {
    processos.clear();
    contProcesso = 0;
    contVertice = 0;
    contConfrontante = 0;
  }

  static criarProcesso(params: {
    tenantId: string;
    titulo: string;
    tipoServidao: TipoServidao;
    matriculaImovelServiente: string;
    municipio: string;
    uf: string;
    classePrecisaoExigida?: ClassePrecisaoGNSS;
    responsavelTecnico: string;
    creaResponsavel?: string;
  }): ProcessoServidao {
    const uf = params.uf.toUpperCase();
    contProcesso += 1;
    const processo: ProcessoServidao = {
      id: `sf-${contProcesso}`,
      tenantId: params.tenantId,
      titulo: params.titulo,
      tipoServidao: params.tipoServidao,
      matriculaImovelServiente: params.matriculaImovelServiente,
      municipio: params.municipio,
      uf,
      status: "em_tramitacao",
      classePrecisaoExigida: params.classePrecisaoExigida ?? "A",
      vertices: [],
      confrontantes: [],
      responsavelTecnico: params.responsavelTecnico,
      creaResponsavel: params.creaResponsavel,
      criadoEm: new Date().toISOString(),
    };
    processos.set(processo.id, processo);
    return processo;
  }

  static listarProcessos(tenantId?: string): ProcessoServidao[] {
    const lista = Array.from(processos.values());
    return tenantId ? lista.filter((p) => p.tenantId === tenantId) : lista;
  }

  static obterProcesso(id: string): ProcessoServidao | undefined {
    return processos.get(id);
  }

  static adicionarVertice(
    processoId: string,
    params: Omit<Vertice, "id">
  ): Vertice {
    const processo = processos.get(processoId);
    if (!processo) throw new Error(`Processo ${processoId} não encontrado`);
    if (processo.status === "certificada" || processo.status === "averbada") {
      throw new Error("Processo certificado/averbado não pode ser alterado");
    }
    contVertice += 1;
    const vertice: Vertice = { id: `vt-${contVertice}`, ...params };
    processo.vertices.push(vertice);
    return vertice;
  }

  static adicionarConfrontante(
    processoId: string,
    params: {
      nome: string;
      cpfCnpj: string;
      lado: Confrontante["lado"];
      matriculaImovel?: string;
    }
  ): Confrontante {
    const processo = processos.get(processoId);
    if (!processo) throw new Error(`Processo ${processoId} não encontrado`);
    if (processo.status === "certificada" || processo.status === "averbada") {
      throw new Error("Processo certificado/averbado não pode ser alterado");
    }
    contConfrontante += 1;
    const cpfCnpjHash = createHash("sha256")
      .update(params.cpfCnpj.replace(/\D/g, ""))
      .digest("hex");
    const confrontante: Confrontante = {
      id: `cf-${contConfrontante}`,
      nome: params.nome,
      cpfCnpjHash,
      lado: params.lado,
      matriculaImovel: params.matriculaImovel,
    };
    processo.confrontantes.push(confrontante);
    return confrontante;
  }

  static calcularAreaPerimetro(processoId: string): ResultadoCalculo {
    const processo = processos.get(processoId);
    if (!processo) throw new Error(`Processo ${processoId} não encontrado`);
    if (processo.vertices.length < 3) {
      throw new Error("São necessários pelo menos 3 vértices para o cálculo");
    }

    const areaM2 = areaGaussM2(processo.vertices);
    const areaHa = areaM2 / 10_000;

    let perimetroM = 0;
    const n = processo.vertices.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      perimetroM += haversineM(
        processo.vertices[i].latitude,
        processo.vertices[i].longitude,
        processo.vertices[j].latitude,
        processo.vertices[j].longitude
      );
    }

    const precisaoMaxima = Math.max(...processo.vertices.map((v) => v.precisaoM));
    const classeAtingida = classificarPrecisao(processo.vertices);
    const verticesValidos =
      precisaoMaxima <= PRECISAO_MAXIMA_M[processo.classePrecisaoExigida];

    const payload = JSON.stringify({
      processoId,
      vertices: processo.vertices.map((v) => ({
        lat: v.latitude,
        lon: v.longitude,
        precisao: v.precisaoM,
      })),
      areaHa,
      perimetroM,
    });
    const hashIntegridade = createHash("sha256").update(payload).digest("hex");
    const calculadoEm = new Date().toISOString();

    processo.areaCalculadaHa = areaHa;
    processo.perimetroCalculadoM = perimetroM;
    processo.hashIntegridade = hashIntegridade;
    processo.calculadoEm = calculadoEm;

    return {
      processId: processoId,
      areaHa,
      perimetroM,
      verticesValidos,
      classePrecisaoAtingida: classeAtingida,
      precisaoMaximaMedida: precisaoMaxima,
      hashIntegridade,
      calculadoEm,
    };
  }

  static certificarProcesso(processoId: string): ProcessoServidao {
    const processo = processos.get(processoId);
    if (!processo) throw new Error(`Processo ${processoId} não encontrado`);
    if (!processo.hashIntegridade) {
      throw new Error("Execute o cálculo de área/perímetro antes de certificar");
    }
    if (processo.confrontantes.length === 0) {
      throw new Error("Processo deve ter pelo menos um confrontante");
    }
    processo.status = "certificada";
    processo.certificadoEm = new Date().toISOString();
    return processo;
  }

  static listarTiposServidao(): TipoServidao[] {
    return [
      "passagem",
      "eletrica",
      "ductos",
      "acesso_producao",
      "hidrica",
      "servidao_ambiental",
      "faixa_dominio",
      "reserva_legal",
    ];
  }
}
