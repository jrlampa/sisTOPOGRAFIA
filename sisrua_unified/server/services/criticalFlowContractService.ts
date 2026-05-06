export type EtapaFluxoCritico = "projeto" | "ponto" | "persistido" | "snapshot";

export interface EventoFluxoCritico {
  tenantId: string;
  projetoId: string;
  pontoId?: string;
  etapa: EtapaFluxoCritico;
  ocorridoEm: Date;
  metadados?: Record<string, unknown>;
}

export interface RegistroFluxoResultado {
  status: 200 | 404 | 422;
  code: "OK" | "PROJECT_NOT_FOUND" | "POINT_NOT_FOUND" | "INVALID_TRANSITION";
  message: string;
  estadoAtual?: {
    projetoId: string;
    pontos: Array<{
      pontoId: string;
      persistido: boolean;
      snapshotCriado: boolean;
    }>;
  };
}

interface PontoState {
  persistido: boolean;
  snapshotCriado: boolean;
}

interface ProjetoState {
  projetoId: string;
  pontos: Map<string, PontoState>;
  eventos: EventoFluxoCritico[];
}

const store = new Map<string, Map<string, ProjetoState>>();

function tenantKey(tenantId: string): string {
  return tenantId.trim().toLowerCase();
}

function projectKey(projetoId: string): string {
  return projetoId.trim();
}

function pointKey(pontoId: string): string {
  return pontoId.trim();
}

function getTenantProjects(tenantId: string): Map<string, ProjetoState> {
  const tid = tenantKey(tenantId);
  const tenantProjects = store.get(tid) ?? new Map<string, ProjetoState>();
  if (!store.has(tid)) {
    store.set(tid, tenantProjects);
  }
  return tenantProjects;
}

function buildEstadoAtual(projeto: ProjetoState) {
  return {
    projetoId: projeto.projetoId,
    pontos: Array.from(projeto.pontos.entries()).map(([pontoId, p]) => ({
      pontoId,
      persistido: p.persistido,
      snapshotCriado: p.snapshotCriado,
    })),
  };
}

export function registrarEventoFluxoCritico(
  evento: EventoFluxoCritico,
): RegistroFluxoResultado {
  const tenantProjects = getTenantProjects(evento.tenantId);
  const projetoId = projectKey(evento.projetoId);

  if (evento.etapa === "projeto") {
    if (tenantProjects.has(projetoId)) {
      return {
        status: 422,
        code: "INVALID_TRANSITION",
        message: "Projeto já existe para este tenant.",
      };
    }

    const novoProjeto: ProjetoState = {
      projetoId,
      pontos: new Map<string, PontoState>(),
      eventos: [evento],
    };
    tenantProjects.set(projetoId, novoProjeto);

    return {
      status: 200,
      code: "OK",
      message: "Projeto registrado com sucesso.",
      estadoAtual: buildEstadoAtual(novoProjeto),
    };
  }

  const projeto = tenantProjects.get(projetoId);
  if (!projeto) {
    return {
      status: 404,
      code: "PROJECT_NOT_FOUND",
      message: "Projeto não encontrado para o tenant informado.",
    };
  }

  const pontoId = evento.pontoId?.trim();
  if (!pontoId) {
    return {
      status: 422,
      code: "INVALID_TRANSITION",
      message:
        "pontoId é obrigatório para as etapas ponto, persistido e snapshot.",
      estadoAtual: buildEstadoAtual(projeto),
    };
  }

  if (evento.etapa === "ponto") {
    if (projeto.pontos.has(pontoId)) {
      return {
        status: 422,
        code: "INVALID_TRANSITION",
        message: "Ponto já cadastrado para este projeto.",
        estadoAtual: buildEstadoAtual(projeto),
      };
    }

    projeto.pontos.set(pointKey(pontoId), {
      persistido: false,
      snapshotCriado: false,
    });
    projeto.eventos.push(evento);

    return {
      status: 200,
      code: "OK",
      message: "Ponto registrado com sucesso.",
      estadoAtual: buildEstadoAtual(projeto),
    };
  }

  const ponto = projeto.pontos.get(pointKey(pontoId));
  if (!ponto) {
    return {
      status: 404,
      code: "POINT_NOT_FOUND",
      message: "Ponto não encontrado para o projeto informado.",
      estadoAtual: buildEstadoAtual(projeto),
    };
  }

  if (evento.etapa === "persistido") {
    if (ponto.persistido) {
      return {
        status: 422,
        code: "INVALID_TRANSITION",
        message: "Ponto já foi persistido anteriormente.",
        estadoAtual: buildEstadoAtual(projeto),
      };
    }

    ponto.persistido = true;
    projeto.eventos.push(evento);

    return {
      status: 200,
      code: "OK",
      message: "Ponto persistido com sucesso.",
      estadoAtual: buildEstadoAtual(projeto),
    };
  }

  if (!ponto.persistido) {
    return {
      status: 422,
      code: "INVALID_TRANSITION",
      message: "Snapshot exige ponto previamente persistido.",
      estadoAtual: buildEstadoAtual(projeto),
    };
  }

  if (ponto.snapshotCriado) {
    return {
      status: 422,
      code: "INVALID_TRANSITION",
      message: "Snapshot já registrado para este ponto.",
      estadoAtual: buildEstadoAtual(projeto),
    };
  }

  ponto.snapshotCriado = true;
  projeto.eventos.push(evento);

  return {
    status: 200,
    code: "OK",
    message: "Snapshot registrado com sucesso.",
    estadoAtual: buildEstadoAtual(projeto),
  };
}

export function clearCriticalFlowState(): void {
  store.clear();
}
