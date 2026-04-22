/**
 * Serviço T2-87 — Hybrid Cloud Support (Local Workers / Cloud Control)
 */

export type TipoWorker = "local" | "cloud";
export type StatusWorker = "ativo" | "inativo" | "degradado";
export type PrioridadeJob = "baixa" | "media" | "alta" | "critica";
export type StatusJob = "enfileirado" | "roteado" | "executando" | "concluido" | "falha";
export type EstrategiaRoteamento = "prefer_local" | "prefer_cloud" | "hibrido";

export interface WorkerNode {
  id: string;
  tenantId: string;
  nome: string;
  tipoWorker: TipoWorker;
  capacidadeMaxJobs: number;
  jobsAtivos: number;
  latenciaMs: number;
  status: StatusWorker;
  criadoEm: string;
}

export interface HybridJob {
  id: string;
  tenantId: string;
  tipoJob: string;
  prioridade: PrioridadeJob;
  estrategiaRoteamento: EstrategiaRoteamento;
  payload: Record<string, unknown>;
  status: StatusJob;
  workerSelecionadoId?: string;
  decisaoRoteamento?: string;
  criadoEm: string;
  atualizadoEm: string;
}

let _workerCounter = 0;
let _jobCounter = 0;
const _workers = new Map<string, WorkerNode>();
const _jobs = new Map<string, HybridJob>();

function workerDisponivel(worker: WorkerNode): boolean {
  return worker.status === "ativo" && worker.jobsAtivos < worker.capacidadeMaxJobs;
}

export class HybridCloudService {
  static _reset(): void {
    _workerCounter = 0;
    _jobCounter = 0;
    _workers.clear();
    _jobs.clear();
  }

  static cadastrarWorker(data: {
    tenantId: string;
    nome: string;
    tipoWorker: TipoWorker;
    capacidadeMaxJobs: number;
    latenciaMs: number;
  }): WorkerNode {
    const worker: WorkerNode = {
      id: `hw-${++_workerCounter}`,
      tenantId: data.tenantId,
      nome: data.nome,
      tipoWorker: data.tipoWorker,
      capacidadeMaxJobs: data.capacidadeMaxJobs,
      jobsAtivos: 0,
      latenciaMs: data.latenciaMs,
      status: "ativo",
      criadoEm: new Date().toISOString(),
    };
    _workers.set(worker.id, worker);
    return worker;
  }

  static listarWorkers(tenantId?: string): WorkerNode[] {
    const all = Array.from(_workers.values());
    return tenantId ? all.filter((w) => w.tenantId === tenantId) : all;
  }

  static obterWorker(id: string): WorkerNode | undefined {
    return _workers.get(id);
  }

  static registrarJob(data: {
    tenantId: string;
    tipoJob: string;
    prioridade: PrioridadeJob;
    estrategiaRoteamento: EstrategiaRoteamento;
    payload: Record<string, unknown>;
  }): HybridJob {
    const now = new Date().toISOString();
    const job: HybridJob = {
      id: `hj-${++_jobCounter}`,
      tenantId: data.tenantId,
      tipoJob: data.tipoJob,
      prioridade: data.prioridade,
      estrategiaRoteamento: data.estrategiaRoteamento,
      payload: data.payload,
      status: "enfileirado",
      criadoEm: now,
      atualizadoEm: now,
    };
    _jobs.set(job.id, job);
    return job;
  }

  static listarJobs(tenantId?: string): HybridJob[] {
    const all = Array.from(_jobs.values());
    return tenantId ? all.filter((j) => j.tenantId === tenantId) : all;
  }

  static obterJob(id: string): HybridJob | undefined {
    return _jobs.get(id);
  }

  static rotearJob(jobId: string): HybridJob {
    const job = _jobs.get(jobId);
    if (!job) throw new Error("Job não encontrado");
    if (job.status !== "enfileirado") throw new Error("Job já processado para roteamento");

    const workersTenant = Array.from(_workers.values()).filter((w) => w.tenantId === job.tenantId);
    const locals = workersTenant.filter((w) => w.tipoWorker === "local" && workerDisponivel(w));
    const clouds = workersTenant.filter((w) => w.tipoWorker === "cloud" && workerDisponivel(w));

    let escolhido: WorkerNode | undefined;
    if (job.estrategiaRoteamento === "prefer_local") {
      escolhido = locals[0] ?? clouds[0];
    } else if (job.estrategiaRoteamento === "prefer_cloud") {
      escolhido = clouds[0] ?? locals[0];
    } else {
      // hibrido: prioriza menor latência entre disponíveis
      escolhido = [...locals, ...clouds].sort((a, b) => a.latenciaMs - b.latenciaMs)[0];
    }

    if (!escolhido) throw new Error("Nenhum worker disponível para roteamento");

    escolhido.jobsAtivos += 1;
    job.workerSelecionadoId = escolhido.id;
    job.status = "roteado";
    job.decisaoRoteamento = `Job roteado para ${escolhido.tipoWorker}:${escolhido.nome} (latência ${escolhido.latenciaMs} ms)`;
    job.atualizadoEm = new Date().toISOString();
    return job;
  }

  static atualizarStatusJob(jobId: string, status: StatusJob): HybridJob {
    const job = _jobs.get(jobId);
    if (!job) throw new Error("Job não encontrado");

    const oldStatus = job.status;
    job.status = status;
    job.atualizadoEm = new Date().toISOString();

    if (job.workerSelecionadoId && (status === "concluido" || status === "falha") && oldStatus !== status) {
      const worker = _workers.get(job.workerSelecionadoId);
      if (worker) worker.jobsAtivos = Math.max(0, worker.jobsAtivos - 1);
    }
    return job;
  }

  static listarEstrategias(): EstrategiaRoteamento[] {
    return ["prefer_local", "prefer_cloud", "hibrido"];
  }
}
