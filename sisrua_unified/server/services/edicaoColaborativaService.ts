/**
 * Serviço T2-56 — Edição Colaborativa em Tempo Real
 * Suporte para edição simultânea geoespacial multicanal.
 */

export type PapelParticipante = "editor" | "revisor" | "observador";
type StatusParticipante = "ativo" | "inativo" | "expulso";
type StatusSessao = "aberta" | "bloqueada" | "encerrada";
export type TipoOperacao =
  | "adicionar_ponto"
  | "mover_ponto"
  | "remover_ponto"
  | "adicionar_trecho"
  | "remover_trecho"
  | "editar_atributo"
  | "comentar";

export interface ParticipanteSessao {
  id: string;
  usuarioId: string;
  nomeUsuario: string;
  papel: PapelParticipante;
  status: StatusParticipante;
  entradaEm: string;
  saidaEm?: string;
}

export interface OperacaoEdicao {
  id: string;
  participanteId: string;
  tipoOperacao: TipoOperacao;
  payload: Record<string, unknown>;
  versaoBase: number;
  versaoResultante: number;
  conflito: boolean;
  registradoEm: string;
}

export interface SessaoColaborativa {
  id: string;
  tenantId: string;
  projetoId: string;
  nomeProjeto: string;
  responsavel: string;
  status: StatusSessao;
  participantes: ParticipanteSessao[];
  operacoes: OperacaoEdicao[];
  versaoAtual: number;
  criadoEm: string;
  atualizadoEm: string;
}

let _sessaoCounter = 0;
let _participanteCounter = 0;
let _operacaoCounter = 0;
const _sessoes = new Map<string, SessaoColaborativa>();

export class EdicaoColaborativaService {
  static _reset(): void {
    _sessaoCounter = 0;
    _participanteCounter = 0;
    _operacaoCounter = 0;
    _sessoes.clear();
  }

  static criarSessao(data: {
    tenantId: string;
    projetoId: string;
    nomeProjeto: string;
    responsavel: string;
  }): SessaoColaborativa {
    const id = `sc-${++_sessaoCounter}`;
    const now = new Date().toISOString();
    const sessao: SessaoColaborativa = {
      id,
      tenantId: data.tenantId,
      projetoId: data.projetoId,
      nomeProjeto: data.nomeProjeto,
      responsavel: data.responsavel,
      status: "aberta",
      participantes: [],
      operacoes: [],
      versaoAtual: 0,
      criadoEm: now,
      atualizadoEm: now,
    };
    _sessoes.set(id, sessao);
    return sessao;
  }

  static listarSessoes(tenantId?: string): SessaoColaborativa[] {
    const all = Array.from(_sessoes.values());
    return tenantId ? all.filter((s) => s.tenantId === tenantId) : all;
  }

  static obterSessao(id: string): SessaoColaborativa | undefined {
    return _sessoes.get(id);
  }

  static entrarNaSessao(
    sessaoId: string,
    data: {
      usuarioId: string;
      nomeUsuario: string;
      papel: PapelParticipante;
    }
  ): ParticipanteSessao {
    const sessao = _sessoes.get(sessaoId);
    if (!sessao) throw new Error("Sessão não encontrada");
    if (sessao.status !== "aberta") throw new Error("Sessão não está aberta para novos participantes");
    const participante: ParticipanteSessao = {
      id: `pp-${++_participanteCounter}`,
      usuarioId: data.usuarioId,
      nomeUsuario: data.nomeUsuario,
      papel: data.papel,
      status: "ativo",
      entradaEm: new Date().toISOString(),
    };
    sessao.participantes.push(participante);
    sessao.atualizadoEm = new Date().toISOString();
    return participante;
  }

  static registrarOperacao(
    sessaoId: string,
    data: {
      participanteId: string;
      tipoOperacao: TipoOperacao;
      payload: Record<string, unknown>;
      versaoBase: number;
    }
  ): OperacaoEdicao {
    const sessao = _sessoes.get(sessaoId);
    if (!sessao) throw new Error("Sessão não encontrada");
    if (sessao.status !== "aberta") throw new Error("Sessão não está aberta para edições");
    const participante = sessao.participantes.find((p) => p.id === data.participanteId);
    if (!participante) throw new Error("Participante não encontrado nesta sessão");
    if (participante.papel === "observador") throw new Error("Observadores não podem registrar operações");
    const conflito = data.versaoBase < sessao.versaoAtual;
    sessao.versaoAtual += 1;
    const operacao: OperacaoEdicao = {
      id: `op-${++_operacaoCounter}`,
      participanteId: data.participanteId,
      tipoOperacao: data.tipoOperacao,
      payload: data.payload,
      versaoBase: data.versaoBase,
      versaoResultante: sessao.versaoAtual,
      conflito,
      registradoEm: new Date().toISOString(),
    };
    sessao.operacoes.push(operacao);
    sessao.atualizadoEm = new Date().toISOString();
    return operacao;
  }

  static bloquearSessao(sessaoId: string): SessaoColaborativa {
    const sessao = _sessoes.get(sessaoId);
    if (!sessao) throw new Error("Sessão não encontrada");
    if (sessao.status === "encerrada") throw new Error("Sessão já encerrada");
    sessao.status = "bloqueada";
    sessao.atualizadoEm = new Date().toISOString();
    return sessao;
  }

  static encerrarSessao(sessaoId: string): SessaoColaborativa {
    const sessao = _sessoes.get(sessaoId);
    if (!sessao) throw new Error("Sessão não encontrada");
    if (sessao.status === "encerrada") throw new Error("Sessão já encerrada");
    sessao.status = "encerrada";
    const now = new Date().toISOString();
    sessao.participantes.forEach((p) => {
      if (p.status === "ativo") {
        p.status = "inativo";
        p.saidaEm = now;
      }
    });
    sessao.atualizadoEm = now;
    return sessao;
  }

  static listarPapeis(): PapelParticipante[] {
    return ["editor", "revisor", "observador"];
  }
}
