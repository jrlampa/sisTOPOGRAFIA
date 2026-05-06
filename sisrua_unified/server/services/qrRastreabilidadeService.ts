/**
 * Serviço T2-66 — Rastreabilidade QR Code Industrial
 * Link entre ativos eletrônicos do projeto e etiquetas físicas instaladas.
 */

import { createHash, randomUUID } from "crypto";

export type TipoAsset =
  | "poste"
  | "transformador"
  | "medicao"
  | "chave"
  | "religador"
  | "cabo"
  | "subestacao"
  | "outro";

export type StatusAtivo =
  | "gerado"
  | "impresso"
  | "instalado"
  | "substituido"
  | "desativado";

export type TipoEvento =
  | "criacao"
  | "impressao"
  | "instalacao"
  | "inspecao"
  | "manutencao"
  | "substituicao"
  | "desativacao";

export interface EventoRastreabilidade {
  id: string;
  ativoId: string;
  tipoEvento: TipoEvento;
  descricao: string;
  tecnicoResponsavel: string;
  localizacaoLat?: number;
  localizacaoLon?: number;
  dataEvento: string;
  hashIntegridade: string;
}

export interface AtivoRastreado {
  id: string;
  tenantId: string;
  codigoAsset: string;
  nomeAsset: string;
  tipoAsset: TipoAsset;
  localizacaoLat?: number;
  localizacaoLon?: number;
  enderecoInstalacao: string;
  municipio: string;
  uf: string;
  qrCode: string;
  qrUrl: string;
  status: StatusAtivo;
  dataInstalacao?: string;
  eventos: EventoRastreabilidade[];
  criadoEm: string;
}

const QR_BASE_URL = "https://sisrua.app/rastrear";

let _ativoCounter = 0;
let _eventoCounter = 0;
const _ativos = new Map<string, AtivoRastreado>();
const _qrIndex = new Map<string, string>(); // qrCode → ativoId

export class QrRastreabilidadeService {
  static _reset(): void {
    _ativoCounter = 0;
    _eventoCounter = 0;
    _ativos.clear();
    _qrIndex.clear();
  }

  static criarAtivo(data: {
    tenantId: string;
    codigoAsset: string;
    nomeAsset: string;
    tipoAsset: TipoAsset;
    enderecoInstalacao: string;
    municipio: string;
    uf: string;
    localizacaoLat?: number;
    localizacaoLon?: number;
  }): AtivoRastreado {
    const id = `at-${++_ativoCounter}`;
    const qrCode = randomUUID();
    const qrUrl = `${QR_BASE_URL}/${qrCode}`;
    const now = new Date().toISOString();
    const ativo: AtivoRastreado = {
      id,
      tenantId: data.tenantId,
      codigoAsset: data.codigoAsset,
      nomeAsset: data.nomeAsset,
      tipoAsset: data.tipoAsset,
      enderecoInstalacao: data.enderecoInstalacao,
      municipio: data.municipio,
      uf: data.uf.toUpperCase().slice(0, 2),
      localizacaoLat: data.localizacaoLat,
      localizacaoLon: data.localizacaoLon,
      qrCode,
      qrUrl,
      status: "gerado",
      eventos: [],
      criadoEm: now,
    };
    // Evento de criação automático
    const evtId = `ev-${++_eventoCounter}`;
    const evt: EventoRastreabilidade = {
      id: evtId,
      ativoId: id,
      tipoEvento: "criacao",
      descricao: `Ativo ${data.codigoAsset} criado no sistema`,
      tecnicoResponsavel: "sistema",
      dataEvento: now,
      hashIntegridade: createHash("sha256")
        .update(`${id}|criacao|${now}`)
        .digest("hex"),
    };
    ativo.eventos.push(evt);
    _ativos.set(id, ativo);
    _qrIndex.set(qrCode, id);
    return ativo;
  }

  static listarAtivos(tenantId?: string): AtivoRastreado[] {
    const all = Array.from(_ativos.values());
    return tenantId ? all.filter((a) => a.tenantId === tenantId) : all;
  }

  static obterAtivo(id: string): AtivoRastreado | undefined {
    return _ativos.get(id);
  }

  static obterAtivoPorQr(qrCode: string): AtivoRastreado | undefined {
    const ativoId = _qrIndex.get(qrCode);
    return ativoId ? _ativos.get(ativoId) : undefined;
  }

  static registrarEvento(
    ativoId: string,
    data: {
      tipoEvento: TipoEvento;
      descricao: string;
      tecnicoResponsavel: string;
      dataEvento: string;
      localizacaoLat?: number;
      localizacaoLon?: number;
    }
  ): EventoRastreabilidade {
    const ativo = _ativos.get(ativoId);
    if (!ativo) throw new Error("Ativo não encontrado");
    const evtId = `ev-${++_eventoCounter}`;
    const evento: EventoRastreabilidade = {
      id: evtId,
      ativoId,
      tipoEvento: data.tipoEvento,
      descricao: data.descricao,
      tecnicoResponsavel: data.tecnicoResponsavel,
      dataEvento: data.dataEvento,
      localizacaoLat: data.localizacaoLat,
      localizacaoLon: data.localizacaoLon,
      hashIntegridade: createHash("sha256")
        .update(`${ativoId}|${data.tipoEvento}|${data.dataEvento}|${data.tecnicoResponsavel}`)
        .digest("hex"),
    };
    ativo.eventos.push(evento);
    // Atualiza status do ativo conforme tipo de evento
    const statusPorEvento: Partial<Record<TipoEvento, StatusAtivo>> = {
      impressao: "impresso",
      instalacao: "instalado",
      substituicao: "substituido",
      desativacao: "desativado",
    };
    if (statusPorEvento[data.tipoEvento]) {
      ativo.status = statusPorEvento[data.tipoEvento]!;
    }
    return evento;
  }

  static instalarAtivo(
    ativoId: string,
    data: {
      dataInstalacao: string;
      tecnicoResponsavel: string;
      localizacaoLat?: number;
      localizacaoLon?: number;
    }
  ): AtivoRastreado {
    const ativo = _ativos.get(ativoId);
    if (!ativo) throw new Error("Ativo não encontrado");
    if (ativo.status === "instalado") throw new Error("Ativo já instalado");
    ativo.dataInstalacao = data.dataInstalacao;
    if (data.localizacaoLat !== undefined) ativo.localizacaoLat = data.localizacaoLat;
    if (data.localizacaoLon !== undefined) ativo.localizacaoLon = data.localizacaoLon;
    this.registrarEvento(ativoId, {
      tipoEvento: "instalacao",
      descricao: `Ativo instalado em ${data.dataInstalacao}`,
      tecnicoResponsavel: data.tecnicoResponsavel,
      dataEvento: data.dataInstalacao,
      localizacaoLat: data.localizacaoLat,
      localizacaoLon: data.localizacaoLon,
    });
    return ativo;
  }

  static listarTiposAsset(): TipoAsset[] {
    return ["poste", "transformador", "medicao", "chave", "religador", "cabo", "subestacao", "outro"];
  }
}
