/**
 * Serviço T2-83 — Módulo de Tele-Engenharia com Desenho AR
 */

export type PapelParticipante = "operador" | "revisor" | "fiscal";
export type StatusParticipante = "conectado" | "desconectado";
export type StatusSessao = "pendente" | "ativa" | "pausada" | "encerrada";
export type EstadoSincronia = "online" | "offline" | "degradado";
export type TipoAnotacao = "marcador" | "linha" | "poligono" | "texto" | "risco";

export interface ParticipanteTele {
  id: string;
  usuarioId: string;
  nomeUsuario: string;
  papel: PapelParticipante;
  status: StatusParticipante;
  ultimoPingEm: string;
}

export interface AnotacaoAr {
  id: string;
  participanteId: string;
  tipoAnotacao: TipoAnotacao;
  geometria: Record<string, unknown>;
  observacao?: string;
  criadoEm: string;
}

export interface SessaoTeleEngenharia {
  id: string;
  tenantId: string;
  projetoId: string;
  nomeProjeto: string;
  engenheiroResponsavel: string;
  status: StatusSessao;
  estadoSincronia: EstadoSincronia;
  participantes: ParticipanteTele[];
  anotacoes: AnotacaoAr[];
  criadoEm: string;
  atualizadoEm: string;
}

let _sessaoCounter = 0;
let _participanteCounter = 0;
let _anotacaoCounter = 0;
const _sessoes = new Map<string, SessaoTeleEngenharia>();

export class TeleEngenhariaArService {
  static _reset(): void {
    _sessaoCounter = 0;
    _participanteCounter = 0;
    _anotacaoCounter = 0;
    _sessoes.clear();
  }

  static criarSessao(data: {
    tenantId: string;
    projetoId: string;
    nomeProjeto: string;
    engenheiroResponsavel: string;
  }): SessaoTeleEngenharia {
    const now = new Date().toISOString();
    const sessao: SessaoTeleEngenharia = {
      id: `te-${++_sessaoCounter}`,
      tenantId: data.tenantId,
      projetoId: data.projetoId,
      nomeProjeto: data.nomeProjeto,
      engenheiroResponsavel: data.engenheiroResponsavel,
      status: "pendente",
      estadoSincronia: "online",
      participantes: [],
      anotacoes: [],
      criadoEm: now,
      atualizadoEm: now,
    };
    _sessoes.set(sessao.id, sessao);
    return sessao;
  }

  static listarSessoes(tenantId?: string): SessaoTeleEngenharia[] {
    const all = Array.from(_sessoes.values());
    return tenantId ? all.filter((s) => s.tenantId === tenantId) : all;
  }

  static obterSessao(id: string): SessaoTeleEngenharia | undefined {
    return _sessoes.get(id);
  }

  static iniciarSessao(id: string): SessaoTeleEngenharia {
    const sessao = _sessoes.get(id);
    if (!sessao) throw new Error("Sessão não encontrada");
    if (sessao.status === "encerrada") throw new Error("Sessão já encerrada");
    sessao.status = "ativa";
    sessao.atualizadoEm = new Date().toISOString();
    return sessao;
  }

  static entrarSessao(
    sessaoId: string,
    data: { usuarioId: string; nomeUsuario: string; papel: PapelParticipante }
  ): ParticipanteTele {
    const sessao = _sessoes.get(sessaoId);
    if (!sessao) throw new Error("Sessão não encontrada");
    if (sessao.status === "encerrada") throw new Error("Sessão encerrada");
    const participante: ParticipanteTele = {
      id: `tp-${++_participanteCounter}`,
      usuarioId: data.usuarioId,
      nomeUsuario: data.nomeUsuario,
      papel: data.papel,
      status: "conectado",
      ultimoPingEm: new Date().toISOString(),
    };
    sessao.participantes.push(participante);
    sessao.atualizadoEm = new Date().toISOString();
    return participante;
  }

  static registrarAnotacao(
    sessaoId: string,
    data: {
      participanteId: string;
      tipoAnotacao: TipoAnotacao;
      geometria: Record<string, unknown>;
      observacao?: string;
    }
  ): AnotacaoAr {
    const sessao = _sessoes.get(sessaoId);
    if (!sessao) throw new Error("Sessão não encontrada");
    if (sessao.status !== "ativa") throw new Error("Sessão deve estar ativa para registrar anotação");
    const participante = sessao.participantes.find((p) => p.id === data.participanteId);
    if (!participante) throw new Error("Participante não encontrado");
    if (participante.status !== "conectado") throw new Error("Participante desconectado");

    const anotacao: AnotacaoAr = {
      id: `ta-${++_anotacaoCounter}`,
      participanteId: data.participanteId,
      tipoAnotacao: data.tipoAnotacao,
      geometria: data.geometria,
      observacao: data.observacao,
      criadoEm: new Date().toISOString(),
    };
    sessao.anotacoes.push(anotacao);
    sessao.atualizadoEm = new Date().toISOString();
    return anotacao;
  }

  static atualizarSincronia(sessaoId: string, estadoSincronia: EstadoSincronia): SessaoTeleEngenharia {
    const sessao = _sessoes.get(sessaoId);
    if (!sessao) throw new Error("Sessão não encontrada");
    sessao.estadoSincronia = estadoSincronia;
    sessao.atualizadoEm = new Date().toISOString();
    return sessao;
  }

  static encerrarSessao(sessaoId: string): SessaoTeleEngenharia {
    const sessao = _sessoes.get(sessaoId);
    if (!sessao) throw new Error("Sessão não encontrada");
    sessao.status = "encerrada";
    sessao.participantes = sessao.participantes.map((p) => ({
      ...p,
      status: "desconectado",
      ultimoPingEm: new Date().toISOString(),
    }));
    sessao.atualizadoEm = new Date().toISOString();
    return sessao;
  }

  static listarTiposAnotacao(): TipoAnotacao[] {
    return ["marcador", "linha", "poligono", "texto", "risco"];
  }
}
