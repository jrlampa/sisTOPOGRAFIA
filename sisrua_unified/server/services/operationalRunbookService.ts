// ─── Tipos ─────────────────────────────────────────────────────────────────

export type RunbookCategoria =
  | "falha_fila"
  | "python_oom"
  | "db_conexao"
  | "api_externa"
  | "seguranca"
  | "implantacao";

export type RunbookStatus = "ativo" | "depreciado" | "rascunho";
export type ExecucaoStatus = "em_andamento" | "concluida" | "falhou";

export interface RunbookPasso {
  numero: number;
  titulo: string;
  descricao: string;
  responsavel: "L1" | "L2" | "L3" | "engenharia";
  obrigatorio: boolean;
}

export interface Runbook {
  id: string;
  titulo: string;
  categoria: RunbookCategoria;
  descricao: string;
  rtoMinutos: number;
  status: RunbookStatus;
  passos: RunbookPasso[];
  versao: string;
  criadoEm: string;
  atualizadoEm: string;
}

export interface ExecucaoRunbook {
  id: string;
  runbookId: string;
  incidenteId: string;
  executor: string;
  status: ExecucaoStatus;
  passoAtual: number;
  resultadoPorPasso: Record<number, string>;
  iniciadoEm: string;
  concluidoEm?: string;
}

// ─── Catálogo inicial ──────────────────────────────────────────────────────

const RUNBOOKS_INICIAIS: Omit<Runbook, "criadoEm" | "atualizadoEm">[] = [
  {
    id: "rb-001",
    titulo: "Falha na Fila de Jobs de Exportação",
    categoria: "falha_fila",
    descricao: "Procedimento para diagnóstico e recuperação de falhas na fila de exportação DXF/BT.",
    rtoMinutos: 15,
    status: "ativo",
    versao: "1.0",
    passos: [
      { numero: 1, titulo: "Verificar status da fila", descricao: "Acessar GET /api/jobs e verificar jobs com status 'falhou'.", responsavel: "L1", obrigatorio: true },
      { numero: 2, titulo: "Checar logs do worker Python", descricao: "Revisar logs em /logs para stack traces do Python Engine.", responsavel: "L2", obrigatorio: true },
      { numero: 3, titulo: "Replay controlado", descricao: "Executar POST /api/dxf/jobs/:taskId/replay para reprocessar job.", responsavel: "L2", obrigatorio: true },
      { numero: 4, titulo: "Escalonar para engenharia", descricao: "Se falha persistir após 3 replays, abrir ticket L3 com evidências.", responsavel: "L3", obrigatorio: false },
    ],
  },
  {
    id: "rb-002",
    titulo: "Worker Python OOM (Out of Memory)",
    categoria: "python_oom",
    descricao: "Procedimento para tratar worker Python encerrado por falta de memória.",
    rtoMinutos: 10,
    status: "ativo",
    versao: "1.0",
    passos: [
      { numero: 1, titulo: "Confirmar erro OOM", descricao: "Verificar logs: mensagem 'MemoryError' ou exit code 137.", responsavel: "L1", obrigatorio: true },
      { numero: 2, titulo: "Reiniciar container Python", descricao: "docker-compose restart python-worker ou kubectl rollout restart.", responsavel: "L2", obrigatorio: true },
      { numero: 3, titulo: "Ajustar limite de memória", descricao: "Aumentar PYTHON_WORKER_MEMORY_MB em docker-compose.yml se recorrente.", responsavel: "engenharia", obrigatorio: false },
      { numero: 4, titulo: "Monitorar após restart", descricao: "Aguardar 5 min e verificar health endpoint /health.", responsavel: "L1", obrigatorio: true },
    ],
  },
  {
    id: "rb-003",
    titulo: "Falha de Conexão com Banco de Dados",
    categoria: "db_conexao",
    descricao: "Procedimento para restaurar conectividade com Supabase/PostgreSQL.",
    rtoMinutos: 20,
    status: "ativo",
    versao: "1.0",
    passos: [
      { numero: 1, titulo: "Verificar health do banco", descricao: "Executar python check_migrations.py e verificar conectividade.", responsavel: "L1", obrigatorio: true },
      { numero: 2, titulo: "Checar variáveis de ambiente", descricao: "Confirmar DATABASE_URL e SUPABASE_URL no ambiente de execução.", responsavel: "L2", obrigatorio: true },
      { numero: 3, titulo: "Verificar pool de conexões", descricao: "Checar métricas de pool em /api/observability/stats.", responsavel: "L2", obrigatorio: true },
      { numero: 4, titulo: "Fallback para read-only", descricao: "Se banco indisponível, ativar modo read-only via feature flag.", responsavel: "L3", obrigatorio: false },
      { numero: 5, titulo: "Notificar on-call", descricao: "Se RTO exceder 20 min, acionar responsável de plantão conforme runbook SRE.", responsavel: "L3", obrigatorio: true },
    ],
  },
  {
    id: "rb-004",
    titulo: "Falha em API Externa (OSM/IBGE/INDE)",
    categoria: "api_externa",
    descricao: "Procedimento para degradação elegante quando APIs externas ficam indisponíveis.",
    rtoMinutos: 5,
    status: "ativo",
    versao: "1.0",
    passos: [
      { numero: 1, titulo: "Identificar API afetada", descricao: "Checar /api/sre/alertas para nome do circuit breaker aberto.", responsavel: "L1", obrigatorio: true },
      { numero: 2, titulo: "Confirmar circuit breaker ativo", descricao: "GET /api/ops/circuit-breakers para estado OPEN.", responsavel: "L1", obrigatorio: true },
      { numero: 3, titulo: "Ativar modo degradado", descricao: "Funcionalidades dependentes usam cache local ou exibem aviso ao usuário.", responsavel: "L2", obrigatorio: true },
      { numero: 4, titulo: "Monitorar recuperação", descricao: "Circuit breaker muda para HALF_OPEN automaticamente após janela de espera.", responsavel: "L1", obrigatorio: true },
    ],
  },
  {
    id: "rb-005",
    titulo: "Incidente de Segurança Detectado",
    categoria: "seguranca",
    descricao: "Procedimento para resposta a incidentes de segurança (LGPD Art. 48, prazo 72h ANPD).",
    rtoMinutos: 30,
    status: "ativo",
    versao: "1.0",
    passos: [
      { numero: 1, titulo: "Isolar ambiente afetado", descricao: "Suspender tenant/serviço comprometido imediatamente.", responsavel: "L3", obrigatorio: true },
      { numero: 2, titulo: "Acionar playbook LGPD", descricao: "POST /api/lgpd/incidentes para registrar e iniciar workflow ANPD.", responsavel: "engenharia", obrigatorio: true },
      { numero: 3, titulo: "Coletar evidências forenses", descricao: "Exportar logs forenses via GET /api/audit-cold/export e /api/tenant-audit/export.", responsavel: "engenharia", obrigatorio: true },
      { numero: 4, titulo: "Notificar jurídico e DPO", descricao: "Acionar responsável legal e DPO dentro de 4h do incidente.", responsavel: "L3", obrigatorio: true },
      { numero: 5, titulo: "Notificar ANPD se necessário", descricao: "Se dados pessoais afetados, notificar ANPD no prazo de 72h.", responsavel: "engenharia", obrigatorio: true },
    ],
  },
];

// ─── Estado em memória ─────────────────────────────────────────────────────

function makeRunbooks(): Map<string, Runbook> {
  const ts = new Date().toISOString();
  const m = new Map<string, Runbook>();
  for (const rb of RUNBOOKS_INICIAIS) {
    m.set(rb.id, { ...rb, criadoEm: ts, atualizadoEm: ts });
  }
  return m;
}

let runbooks = makeRunbooks();
let execucoes = new Map<string, ExecucaoRunbook>();
let contador = 1;

function now(): string {
  return new Date().toISOString();
}

// ─── Serviço ───────────────────────────────────────────────────────────────

export class OperationalRunbookService {
  static listarRunbooks(categoria?: RunbookCategoria): Runbook[] {
    const all = Array.from(runbooks.values()).filter((r) => r.status !== "depreciado");
    return categoria ? all.filter((r) => r.categoria === categoria) : all;
  }

  static getRunbook(id: string): Runbook | undefined {
    return runbooks.get(id);
  }

  static criarRunbook(params: Omit<Runbook, "id" | "criadoEm" | "atualizadoEm">): Runbook {
    const id = `rb-${String(contador++).padStart(3, "0")}`;
    const ts = now();
    const rb: Runbook = { ...params, id, criadoEm: ts, atualizadoEm: ts };
    runbooks.set(id, rb);
    return rb;
  }

  static atualizarRunbook(
    id: string,
    updates: Partial<Pick<Runbook, "titulo" | "descricao" | "passos" | "rtoMinutos" | "status">>,
  ): Runbook {
    const rb = runbooks.get(id);
    if (!rb) throw new Error(`Runbook não encontrado: ${id}`);
    Object.assign(rb, updates, { atualizadoEm: now() });
    return rb;
  }

  static iniciarExecucao(params: {
    runbookId: string;
    incidenteId: string;
    executor: string;
  }): ExecucaoRunbook {
    const rb = runbooks.get(params.runbookId);
    if (!rb) throw new Error(`Runbook não encontrado: ${params.runbookId}`);
    const id = `exec-${contador++}`;
    const exec: ExecucaoRunbook = {
      id,
      runbookId: params.runbookId,
      incidenteId: params.incidenteId,
      executor: params.executor,
      status: "em_andamento",
      passoAtual: rb.passos[0]?.numero ?? 1,
      resultadoPorPasso: {},
      iniciadoEm: now(),
    };
    execucoes.set(id, exec);
    return exec;
  }

  static avancarPasso(params: {
    execucaoId: string;
    resultado: string;
  }): ExecucaoRunbook {
    const exec = execucoes.get(params.execucaoId);
    if (!exec) throw new Error(`Execução não encontrada: ${params.execucaoId}`);
    if (exec.status !== "em_andamento") throw new Error("Execução já encerrada");
    const rb = runbooks.get(exec.runbookId)!;
    exec.resultadoPorPasso[exec.passoAtual] = params.resultado;
    const passos = rb.passos.sort((a, b) => a.numero - b.numero);
    const idx = passos.findIndex((p) => p.numero === exec.passoAtual);
    if (idx < passos.length - 1) {
      exec.passoAtual = passos[idx + 1].numero;
    } else {
      exec.status = "concluida";
      exec.concluidoEm = now();
    }
    return exec;
  }

  static encerrarExecucao(params: {
    execucaoId: string;
    status: "concluida" | "falhou";
  }): ExecucaoRunbook {
    const exec = execucoes.get(params.execucaoId);
    if (!exec) throw new Error(`Execução não encontrada: ${params.execucaoId}`);
    exec.status = params.status;
    exec.concluidoEm = now();
    return exec;
  }

  static getExecucao(id: string): ExecucaoRunbook | undefined {
    return execucoes.get(id);
  }

  static listarExecucoes(runbookId?: string): ExecucaoRunbook[] {
    const all = Array.from(execucoes.values());
    return runbookId ? all.filter((e) => e.runbookId === runbookId) : all;
  }

  static _reset(): void {
    runbooks = makeRunbooks();
    execucoes = new Map();
    contador = 1;
  }
}
