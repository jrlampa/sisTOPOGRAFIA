/**
 * Serviço T2-84 — Acervo Técnico GED (Padrão CONARQ)
 */

import { createHash } from "crypto";

export type TipoDocumento =
  | "memorial_descritivo"
  | "art"
  | "planta_baixa"
  | "croqui"
  | "laudo"
  | "relatorio_fotografico"
  | "outro";

export type StatusDocumento = "rascunho" | "em_revisao" | "aprovado" | "arquivado";
export type ClassificacaoSigilo = "publico" | "restrito" | "confidencial";

export interface RevisaoDocumento {
  id: string;
  versao: number;
  revisadoPor: string;
  observacao: string;
  dataRevisao: string;
}

export interface DocumentoGed {
  id: string;
  tenantId: string;
  projetoId: string;
  titulo: string;
  tipoDocumento: TipoDocumento;
  status: StatusDocumento;
  classificacaoSigilo: ClassificacaoSigilo;
  retencaoAnos: number;
  conteudoHash: string;
  criadoPor: string;
  criadoEm: string;
  atualizadoEm: string;
  revisoes: RevisaoDocumento[];
}

let _documentoCounter = 0;
let _revisaoCounter = 0;
const _documentos = new Map<string, DocumentoGed>();

export class AcervoGedService {
  static _reset(): void {
    _documentoCounter = 0;
    _revisaoCounter = 0;
    _documentos.clear();
  }

  static criarDocumento(data: {
    tenantId: string;
    projetoId: string;
    titulo: string;
    tipoDocumento: TipoDocumento;
    classificacaoSigilo: ClassificacaoSigilo;
    retencaoAnos: number;
    conteudo: string;
    criadoPor: string;
  }): DocumentoGed {
    const now = new Date().toISOString();
    const id = `gd-${++_documentoCounter}`;
    const documento: DocumentoGed = {
      id,
      tenantId: data.tenantId,
      projetoId: data.projetoId,
      titulo: data.titulo,
      tipoDocumento: data.tipoDocumento,
      status: "rascunho",
      classificacaoSigilo: data.classificacaoSigilo,
      retencaoAnos: data.retencaoAnos,
      conteudoHash: createHash("sha256").update(`${id}|${data.titulo}|${data.conteudo}`).digest("hex"),
      criadoPor: data.criadoPor,
      criadoEm: now,
      atualizadoEm: now,
      revisoes: [],
    };
    _documentos.set(id, documento);
    return documento;
  }

  static listarDocumentos(tenantId?: string): DocumentoGed[] {
    const all = Array.from(_documentos.values());
    return tenantId ? all.filter((d) => d.tenantId === tenantId) : all;
  }

  static obterDocumento(id: string): DocumentoGed | undefined {
    return _documentos.get(id);
  }

  static enviarParaRevisao(id: string): DocumentoGed {
    const documento = _documentos.get(id);
    if (!documento) throw new Error("Documento não encontrado");
    if (documento.status === "arquivado") throw new Error("Documento arquivado não pode entrar em revisão");
    documento.status = "em_revisao";
    documento.atualizadoEm = new Date().toISOString();
    return documento;
  }

  static registrarRevisao(id: string, data: { revisadoPor: string; observacao: string }): RevisaoDocumento {
    const documento = _documentos.get(id);
    if (!documento) throw new Error("Documento não encontrado");
    if (documento.status !== "em_revisao") throw new Error("Documento deve estar em revisão");
    const revisao: RevisaoDocumento = {
      id: `rv-${++_revisaoCounter}`,
      versao: documento.revisoes.length + 1,
      revisadoPor: data.revisadoPor,
      observacao: data.observacao,
      dataRevisao: new Date().toISOString(),
    };
    documento.revisoes.push(revisao);
    documento.atualizadoEm = new Date().toISOString();
    return revisao;
  }

  static aprovarDocumento(id: string): DocumentoGed {
    const documento = _documentos.get(id);
    if (!documento) throw new Error("Documento não encontrado");
    if (documento.status !== "em_revisao") throw new Error("Documento deve estar em revisão para aprovação");
    documento.status = "aprovado";
    documento.atualizadoEm = new Date().toISOString();
    return documento;
  }

  static arquivarDocumento(id: string): DocumentoGed {
    const documento = _documentos.get(id);
    if (!documento) throw new Error("Documento não encontrado");
    documento.status = "arquivado";
    documento.atualizadoEm = new Date().toISOString();
    return documento;
  }

  static listarTiposDocumento(): TipoDocumento[] {
    return [
      "memorial_descritivo",
      "art",
      "planta_baixa",
      "croqui",
      "laudo",
      "relatorio_fotografico",
      "outro",
    ];
  }
}
