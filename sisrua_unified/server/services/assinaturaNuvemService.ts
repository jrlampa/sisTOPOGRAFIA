/**
 * Serviço T2-104 — Assinatura Digital em Nuvem (BirdID/SafeID)
 */

import { createHash, randomUUID } from "crypto";

export type ProvedorAssinatura = "birdid" | "safeid";
export type StatusLote =
  | "preparado"
  | "enviado"
  | "assinado"
  | "parcial"
  | "falha"
  | "cancelado";
export type StatusDocumentoAssinatura = "pendente" | "assinado" | "falha";

export interface DocumentoAssinavel {
  id: string;
  nomeArquivo: string;
  hashSha256: string;
  status: StatusDocumentoAssinatura;
  assinaturaId?: string;
}

export interface LoteAssinatura {
  id: string;
  tenantId: string;
  projetoId: string;
  provedor: ProvedorAssinatura;
  status: StatusLote;
  solicitadoPor: string;
  webhookUrl?: string;
  documentos: DocumentoAssinavel[];
  criadoEm: string;
  atualizadoEm: string;
}

let _loteCounter = 0;
let _docCounter = 0;
const _lotes = new Map<string, LoteAssinatura>();

export class AssinaturaNuvemService {
  static _reset(): void {
    _loteCounter = 0;
    _docCounter = 0;
    _lotes.clear();
  }

  static criarLote(data: {
    tenantId: string;
    projetoId: string;
    provedor: ProvedorAssinatura;
    solicitadoPor: string;
    webhookUrl?: string;
  }): LoteAssinatura {
    const now = new Date().toISOString();
    const lote: LoteAssinatura = {
      id: `asn-${++_loteCounter}`,
      tenantId: data.tenantId,
      projetoId: data.projetoId,
      provedor: data.provedor,
      status: "preparado",
      solicitadoPor: data.solicitadoPor,
      webhookUrl: data.webhookUrl,
      documentos: [],
      criadoEm: now,
      atualizadoEm: now,
    };
    _lotes.set(lote.id, lote);
    return lote;
  }

  static listarLotes(tenantId?: string): LoteAssinatura[] {
    const all = Array.from(_lotes.values());
    return tenantId ? all.filter((l) => l.tenantId === tenantId) : all;
  }

  static obterLote(id: string): LoteAssinatura | undefined {
    return _lotes.get(id);
  }

  static adicionarDocumento(
    loteId: string,
    data: { nomeArquivo: string; conteudo: string },
  ): DocumentoAssinavel {
    const lote = _lotes.get(loteId);
    if (!lote) throw new Error("Lote não encontrado");
    if (lote.status !== "preparado")
      throw new Error("Lote deve estar em estado preparado");
    const documento: DocumentoAssinavel = {
      id: `ad-${++_docCounter}`,
      nomeArquivo: data.nomeArquivo,
      hashSha256: createHash("sha256").update(data.conteudo).digest("hex"),
      status: "pendente",
    };
    lote.documentos.push(documento);
    lote.atualizadoEm = new Date().toISOString();
    return documento;
  }

  static enviarLote(loteId: string): LoteAssinatura {
    const lote = _lotes.get(loteId);
    if (!lote) throw new Error("Lote não encontrado");
    if (lote.documentos.length === 0)
      throw new Error("Lote deve conter ao menos 1 documento");
    if (lote.status === "cancelado") throw new Error("Lote cancelado");
    lote.status = "enviado";
    lote.atualizadoEm = new Date().toISOString();
    return lote;
  }

  static registrarAssinatura(
    loteId: string,
    documentoId: string,
    status: "assinado" | "falha",
  ): LoteAssinatura {
    const lote = _lotes.get(loteId);
    if (!lote) throw new Error("Lote não encontrado");
    if (lote.status !== "enviado" && lote.status !== "parcial")
      throw new Error("Lote deve estar enviado para registrar assinaturas");
    const doc = lote.documentos.find((d) => d.id === documentoId);
    if (!doc) throw new Error("Documento não encontrado no lote");
    doc.status = status;
    if (status === "assinado") {
      doc.assinaturaId = createHash("sha256")
        .update(`${documentoId}|${randomUUID()}|${Date.now()}`)
        .digest("hex");
    }
    const assinados = lote.documentos.filter(
      (d) => d.status === "assinado",
    ).length;
    const falhas = lote.documentos.filter((d) => d.status === "falha").length;
    if (assinados === lote.documentos.length) lote.status = "assinado";
    else if (falhas === lote.documentos.length) lote.status = "falha";
    else lote.status = "parcial";
    lote.atualizadoEm = new Date().toISOString();
    return lote;
  }

  static cancelarLote(loteId: string): LoteAssinatura {
    const lote = _lotes.get(loteId);
    if (!lote) throw new Error("Lote não encontrado");
    if (lote.status === "assinado")
      throw new Error("Lote assinado não pode ser cancelado");
    lote.status = "cancelado";
    lote.atualizadoEm = new Date().toISOString();
    return lote;
  }

  static listarProvedores(): ProvedorAssinatura[] {
    return ["birdid", "safeid"];
  }
}
