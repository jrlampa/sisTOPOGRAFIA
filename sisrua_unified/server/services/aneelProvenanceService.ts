/**
 * aneelProvenanceService.ts — Dossiê de Proveniência para Fiscalização ANEEL (98 [T1])
 *
 * Gera dossiê técnico com cadeia de custódia para fiscalização ANEEL:
 * - Coleta de artefatos por projeto (DXF, relatórios, snapshots CQT)
 * - Hash de integridade SHA-256 por artefato
 * - Carimbo de tempo e responsável técnico (ART simulado)
 * - Exportação do pacote em formato auditável
 * - Verificação de conformidade BDGD / PRODIST
 */

import crypto from "crypto";

export type StatusDossie = "rascunho" | "em_revisao" | "aprovado" | "submetido_aneel" | "arquivado";
export type TipoArtefato = "dxf_projeto" | "relatorio_cqt" | "snapshot_topologia" | "validacao_bdgd" | "memorial_descritivo" | "art";

export interface ArtefatoDossie {
  id: string;
  tipo: TipoArtefato;
  nomeArquivo: string;
  hashSha256: string;
  tamanhoBytes: number;
  geradoEm: string;
  responsavelTecnico: string;
  versaoSistema: string;
  descricao?: string;
}

export interface DossieAneel {
  id: string;
  titulo: string;
  projetoId: string;
  tenantId: string;
  responsavelTecnico: string;
  creaResponsavel?: string;
  status: StatusDossie;
  criadoEm: string;
  aprovadoEm?: string;
  submissaoAneel?: string;
  artefatos: ArtefatoDossie[];
  hashPacote?: string;          // SHA-256 do pacote completo
  conformidadeBdgd?: boolean;
  conformidadeProdist?: boolean;
  observacoes?: string;
}

const dossies = new Map<string, DossieAneel>();
let dSeq = 1;
let aSeq = 1;

function sha256(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

export class AneelProvenanceService {
  static criarDossie(dados: {
    titulo: string;
    projetoId: string;
    tenantId: string;
    responsavelTecnico: string;
    creaResponsavel?: string;
    observacoes?: string;
  }): DossieAneel {
    const id = `aneel-dos-${dSeq++}`;
    const dossie: DossieAneel = {
      ...dados,
      id,
      status: "rascunho",
      criadoEm: new Date().toISOString(),
      artefatos: [],
    };
    dossies.set(id, dossie);
    return dossie;
  }

  static adicionarArtefato(
    dossieId: string,
    dados: {
      tipo: TipoArtefato;
      nomeArquivo: string;
      conteudo: string;          // usado para calcular hash
      responsavelTecnico: string;
      versaoSistema: string;
      descricao?: string;
    }
  ): ArtefatoDossie {
    const dossie = dossies.get(dossieId);
    if (!dossie) throw new Error(`Dossiê '${dossieId}' não encontrado`);
    if (dossie.status === "submetido_aneel" || dossie.status === "arquivado") {
      throw new Error(`Dossiê '${dossieId}' não pode ser modificado (status: ${dossie.status})`);
    }

    const artefato: ArtefatoDossie = {
      id: `art-${aSeq++}`,
      tipo: dados.tipo,
      nomeArquivo: dados.nomeArquivo,
      hashSha256: sha256(dados.conteudo),
      tamanhoBytes: Buffer.byteLength(dados.conteudo, "utf8"),
      geradoEm: new Date().toISOString(),
      responsavelTecnico: dados.responsavelTecnico,
      versaoSistema: dados.versaoSistema,
      descricao: dados.descricao,
    };
    dossie.artefatos.push(artefato);
    return artefato;
  }

  static aprovarDossie(
    dossieId: string,
    params: { conformidadeBdgd: boolean; conformidadeProdist: boolean }
  ): DossieAneel {
    const dossie = dossies.get(dossieId);
    if (!dossie) throw new Error(`Dossiê '${dossieId}' não encontrado`);
    if (dossie.artefatos.length === 0) {
      throw new Error("Dossiê sem artefatos — adicione pelo menos um artefato antes de aprovar");
    }

    // Calcula hash do pacote completo (todos os hashes dos artefatos)
    const hashesConcat = dossie.artefatos.map((a) => a.hashSha256).join("|");
    dossie.hashPacote = sha256(hashesConcat);
    dossie.status = "aprovado";
    dossie.aprovadoEm = new Date().toISOString();
    dossie.conformidadeBdgd = params.conformidadeBdgd;
    dossie.conformidadeProdist = params.conformidadeProdist;

    return { ...dossie };
  }

  static submeterAneel(dossieId: string): DossieAneel {
    const dossie = dossies.get(dossieId);
    if (!dossie) throw new Error(`Dossiê '${dossieId}' não encontrado`);
    if (dossie.status !== "aprovado") {
      throw new Error(`Dossiê deve estar aprovado antes de submeter (atual: ${dossie.status})`);
    }
    dossie.status = "submetido_aneel";
    dossie.submissaoAneel = new Date().toISOString();
    return { ...dossie };
  }

  static verificarIntegridade(dossieId: string): {
    dossieId: string;
    integro: boolean;
    detalhes: Array<{ artefatoId: string; nomeArquivo: string; hashArmazenado: string }>;
  } {
    const dossie = dossies.get(dossieId);
    if (!dossie) throw new Error(`Dossiê '${dossieId}' não encontrado`);

    // Verifica consistência do hashPacote com os hashes atuais dos artefatos
    const hashesConcat = dossie.artefatos.map((a) => a.hashSha256).join("|");
    const hashAtual = sha256(hashesConcat);
    const integro = dossie.hashPacote === hashAtual;

    return {
      dossieId,
      integro,
      detalhes: dossie.artefatos.map((a) => ({
        artefatoId: a.id,
        nomeArquivo: a.nomeArquivo,
        hashArmazenado: a.hashSha256,
      })),
    };
  }

  static listarDossies(tenantId?: string): DossieAneel[] {
    const todos = [...dossies.values()];
    if (tenantId) return todos.filter((d) => d.tenantId === tenantId);
    return todos;
  }

  static getDossie(id: string): DossieAneel {
    const d = dossies.get(id);
    if (!d) throw new Error(`Dossiê '${id}' não encontrado`);
    return d;
  }

  static _reset(): void {
    dossies.clear();
    dSeq = 1;
    aSeq = 1;
  }
}
