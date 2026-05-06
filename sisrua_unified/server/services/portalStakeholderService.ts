/**
 * Serviço T2-110 — Portal Stakeholder (Visualizador Gov.br)
 */

import { createHash, randomUUID } from "crypto";

export type PerfilAcesso =
  | "prefeitura"
  | "concessionaria"
  | "fiscalizacao"
  | "orgao_ambiental"
  | "ministerio_publico";

export type StatusAcesso =
  | "convite_enviado"
  | "ativo"
  | "suspenso"
  | "revogado";
export type StatusSolicitacao = "pendente" | "aprovado" | "negado" | "atendido";

export interface AcessoStakeholder {
  id: string;
  tenantId: string;
  orgao: string;
  nomeResponsavel: string;
  email: string;
  perfil: PerfilAcesso;
  escopos: string[];
  status: StatusAcesso;
  tokenAcessoHash: string;
  criadoEm: string;
  atualizadoEm: string;
}

export interface SolicitacaoStakeholder {
  id: string;
  acessoId: string;
  tipoConsulta: "mapa" | "projeto" | "dossie" | "relatorio";
  justificativa: string;
  status: StatusSolicitacao;
  resposta?: string;
  criadoEm: string;
  atualizadoEm: string;
}

let _acessoCounter = 0;
let _solicitacaoCounter = 0;
const _acessos = new Map<string, AcessoStakeholder>();
const _solicitacoes = new Map<string, SolicitacaoStakeholder>();

export class PortalStakeholderService {
  static _reset(): void {
    _acessoCounter = 0;
    _solicitacaoCounter = 0;
    _acessos.clear();
    _solicitacoes.clear();
  }

  static criarAcesso(data: {
    tenantId: string;
    orgao: string;
    nomeResponsavel: string;
    email: string;
    perfil: PerfilAcesso;
    escopos: string[];
  }): AcessoStakeholder {
    const now = new Date().toISOString();
    const tokenRaw = randomUUID();
    const acesso: AcessoStakeholder = {
      id: `st-${++_acessoCounter}`,
      tenantId: data.tenantId,
      orgao: data.orgao,
      nomeResponsavel: data.nomeResponsavel,
      email: data.email,
      perfil: data.perfil,
      escopos: data.escopos,
      status: "convite_enviado",
      tokenAcessoHash: createHash("sha256")
        .update(`${data.email}|${tokenRaw}|${now}`)
        .digest("hex"),
      criadoEm: now,
      atualizadoEm: now,
    };
    _acessos.set(acesso.id, acesso);
    return acesso;
  }

  static listarAcessos(tenantId?: string): AcessoStakeholder[] {
    const all = Array.from(_acessos.values());
    return tenantId ? all.filter((a) => a.tenantId === tenantId) : all;
  }

  static obterAcesso(id: string): AcessoStakeholder | undefined {
    return _acessos.get(id);
  }

  static ativarAcesso(id: string): AcessoStakeholder {
    const acesso = _acessos.get(id);
    if (!acesso) throw new Error("Acesso não encontrado");
    if (acesso.status === "revogado")
      throw new Error("Acesso revogado não pode ser ativado");
    acesso.status = "ativo";
    acesso.atualizadoEm = new Date().toISOString();
    return acesso;
  }

  static suspenderAcesso(id: string): AcessoStakeholder {
    const acesso = _acessos.get(id);
    if (!acesso) throw new Error("Acesso não encontrado");
    if (acesso.status === "revogado")
      throw new Error("Acesso revogado não pode ser suspenso");
    acesso.status = "suspenso";
    acesso.atualizadoEm = new Date().toISOString();
    return acesso;
  }

  static revogarAcesso(id: string): AcessoStakeholder {
    const acesso = _acessos.get(id);
    if (!acesso) throw new Error("Acesso não encontrado");
    acesso.status = "revogado";
    acesso.atualizadoEm = new Date().toISOString();
    return acesso;
  }

  static criarSolicitacao(
    acessoId: string,
    data: {
      tipoConsulta: "mapa" | "projeto" | "dossie" | "relatorio";
      justificativa: string;
    },
  ): SolicitacaoStakeholder {
    const acesso = _acessos.get(acessoId);
    if (!acesso) throw new Error("Acesso não encontrado");
    if (acesso.status !== "ativo")
      throw new Error("Acesso deve estar ativo para solicitar consulta");
    const now = new Date().toISOString();
    const solicitacao: SolicitacaoStakeholder = {
      id: `ss-${++_solicitacaoCounter}`,
      acessoId,
      tipoConsulta: data.tipoConsulta,
      justificativa: data.justificativa,
      status: "pendente",
      criadoEm: now,
      atualizadoEm: now,
    };
    _solicitacoes.set(solicitacao.id, solicitacao);
    return solicitacao;
  }

  static responderSolicitacao(
    solicitacaoId: string,
    data: { status: "aprovado" | "negado" | "atendido"; resposta?: string },
  ): SolicitacaoStakeholder {
    const solicitacao = _solicitacoes.get(solicitacaoId);
    if (!solicitacao) throw new Error("Solicitação não encontrada");
    solicitacao.status = data.status;
    solicitacao.resposta = data.resposta;
    solicitacao.atualizadoEm = new Date().toISOString();
    return solicitacao;
  }

  static listarPerfis(): PerfilAcesso[] {
    return [
      "prefeitura",
      "concessionaria",
      "fiscalizacao",
      "orgao_ambiental",
      "ministerio_publico",
    ];
  }
}
