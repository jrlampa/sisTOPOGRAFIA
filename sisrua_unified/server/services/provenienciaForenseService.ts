/**
 * Serviço T2-102 — Certificação de Proveniência Forense (ICP-Brasil + RFC 3161)
 */

import { createHash, randomUUID } from "crypto";

export type StatusDossie = "rascunho" | "selado" | "verificado" | "revogado";

export interface ArtefatoForense {
  id: string;
  nomeArquivo: string;
  mimeType: string;
  tamanhoBytes: number;
  hashSha256: string;
}

export interface SeloTemporalRFC3161 {
  id: string;
  provedor: "rfc3161_homologado" | "rfc3161_interno";
  tokenHash: string;
  emitidoEm: string;
  validadeAte: string;
}

export interface DossieForense {
  id: string;
  tenantId: string;
  projetoId: string;
  titulo: string;
  status: StatusDossie;
  artefatos: ArtefatoForense[];
  cadeiaHash?: string;
  assinaturaIcpBrasil?: string;
  seloTemporal?: SeloTemporalRFC3161;
  criadoEm: string;
  atualizadoEm: string;
}

let _dossieCounter = 0;
let _artefatoCounter = 0;
let _seloCounter = 0;
const _dossies = new Map<string, DossieForense>();

export class ProvenienciaForenseService {
  static _reset(): void {
    _dossieCounter = 0;
    _artefatoCounter = 0;
    _seloCounter = 0;
    _dossies.clear();
  }

  static criarDossie(data: {
    tenantId: string;
    projetoId: string;
    titulo: string;
  }): DossieForense {
    const now = new Date().toISOString();
    const dossie: DossieForense = {
      id: `pf-${++_dossieCounter}`,
      tenantId: data.tenantId,
      projetoId: data.projetoId,
      titulo: data.titulo,
      status: "rascunho",
      artefatos: [],
      criadoEm: now,
      atualizadoEm: now,
    };
    _dossies.set(dossie.id, dossie);
    return dossie;
  }

  static listarDossies(tenantId?: string): DossieForense[] {
    const all = Array.from(_dossies.values());
    return tenantId ? all.filter((d) => d.tenantId === tenantId) : all;
  }

  static obterDossie(id: string): DossieForense | undefined {
    return _dossies.get(id);
  }

  static adicionarArtefato(
    dossieId: string,
    data: {
      nomeArquivo: string;
      mimeType: string;
      tamanhoBytes: number;
      conteudo: string;
    },
  ): ArtefatoForense {
    const dossie = _dossies.get(dossieId);
    if (!dossie) throw new Error("Dossiê não encontrado");
    if (dossie.status === "revogado")
      throw new Error("Dossiê revogado não aceita artefatos");
    const artefato: ArtefatoForense = {
      id: `af-${++_artefatoCounter}`,
      nomeArquivo: data.nomeArquivo,
      mimeType: data.mimeType,
      tamanhoBytes: data.tamanhoBytes,
      hashSha256: createHash("sha256").update(data.conteudo).digest("hex"),
    };
    dossie.artefatos.push(artefato);
    dossie.atualizadoEm = new Date().toISOString();
    return artefato;
  }

  static emitirSeloTemporal(
    dossieId: string,
    provedor: "rfc3161_homologado" | "rfc3161_interno",
  ): DossieForense {
    const dossie = _dossies.get(dossieId);
    if (!dossie) throw new Error("Dossiê não encontrado");
    if (dossie.artefatos.length === 0)
      throw new Error("Dossiê deve ter ao menos 1 artefato");

    const cadeiaHash = createHash("sha256")
      .update(dossie.artefatos.map((a) => a.hashSha256).join("|"))
      .digest("hex");
    const emitidoEm = new Date().toISOString();
    const validadeAte = new Date(
      Date.now() + 365 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const selo: SeloTemporalRFC3161 = {
      id: `stp-${++_seloCounter}`,
      provedor,
      tokenHash: createHash("sha256")
        .update(`${cadeiaHash}|${randomUUID()}|${emitidoEm}`)
        .digest("hex"),
      emitidoEm,
      validadeAte,
    };
    dossie.cadeiaHash = cadeiaHash;
    dossie.seloTemporal = selo;
    dossie.status = "selado";
    dossie.atualizadoEm = emitidoEm;
    return dossie;
  }

  static assinarIcpBrasil(
    dossieId: string,
    certificadoSerial: string,
  ): DossieForense {
    const dossie = _dossies.get(dossieId);
    if (!dossie) throw new Error("Dossiê não encontrado");
    if (dossie.status !== "selado")
      throw new Error("Dossiê deve estar selado para assinatura ICP-Brasil");
    dossie.assinaturaIcpBrasil = createHash("sha256")
      .update(`${certificadoSerial}|${dossie.cadeiaHash}|${Date.now()}`)
      .digest("hex");
    dossie.atualizadoEm = new Date().toISOString();
    return dossie;
  }

  static verificarIntegridade(dossieId: string): {
    integro: boolean;
    motivo: string;
  } {
    const dossie = _dossies.get(dossieId);
    if (!dossie) throw new Error("Dossiê não encontrado");
    if (!dossie.cadeiaHash)
      return { integro: false, motivo: "Dossiê sem cadeia hash" };
    const recalculado = createHash("sha256")
      .update(dossie.artefatos.map((a) => a.hashSha256).join("|"))
      .digest("hex");
    return {
      integro: recalculado === dossie.cadeiaHash,
      motivo:
        recalculado === dossie.cadeiaHash
          ? "Integridade confirmada"
          : "Divergência de hash",
    };
  }

  static revogarDossie(dossieId: string): DossieForense {
    const dossie = _dossies.get(dossieId);
    if (!dossie) throw new Error("Dossiê não encontrado");
    dossie.status = "revogado";
    dossie.atualizadoEm = new Date().toISOString();
    return dossie;
  }

  static listarProvedoresRFC3161(): Array<
    "rfc3161_homologado" | "rfc3161_interno"
  > {
    return ["rfc3161_homologado", "rfc3161_interno"];
  }
}
