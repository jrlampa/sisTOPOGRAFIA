/**
 * costCenterService.ts — Gestão de Centros de Custo por Tenant.
 *
 * Roadmap Item 36 [T2]: Gestão de Centros de Custo.
 * Alocação de custos de processamento e projetos por área de negócio.
 *
 * Modelo:
 *   - Cada tenant pode ter vários centros de custo (CC).
 *   - Registros de custo são imputados a um CC específico.
 *   - Os relatórios exibem consumo acumulado por CC, por tipo e por período.
 *
 * Tipos de custo suportados:
 *   - processamento — uso de CPU/workers (unidade: unidades de job)
 *   - armazenamento  — MB de arquivos gerados/armazenados
 *   - exportacao_dxf — exportações DXF geradas
 *   - analise_rede   — análises de topologia/rede executadas
 *   - api_externa    — chamadas a APIs externas (OSM, IBGE, INDE etc.)
 */

/** Identificador de tenant. */
export type TenantId = string;

/** Identificador do centro de custo (slug único por tenant). */
export type CostCenterId = string;

/** Tipos de custo suportados. */
export type TipoCusto =
  | "processamento"
  | "armazenamento"
  | "exportacao_dxf"
  | "analise_rede"
  | "api_externa";

/** Registro individual de custo. */
export interface RegistroCusto {
  id: string;
  tenantId: TenantId;
  centroCustoId: CostCenterId;
  tipo: TipoCusto;
  valor: number;
  descricao: string;
  criadoEm: Date;
  metadados?: Record<string, unknown>;
}

/** Definição de um centro de custo. */
export interface CentroCusto {
  id: CostCenterId;
  tenantId: TenantId;
  nome: string;
  descricao?: string;
  ativo: boolean;
  criadoEm: Date;
  atualizadoEm: Date;
}

/** Relatório de custo por tipo para um CC. */
export interface RelatorioCentroCusto {
  centroCustoId: CostCenterId;
  nome: string;
  ativo: boolean;
  totalPorTipo: Partial<Record<TipoCusto, number>>;
  totalGeral: number;
  registros: number;
}

/** Relatório consolidado de custos de um tenant. */
export interface RelatorioTenantCusto {
  tenantId: TenantId;
  centros: RelatorioCentroCusto[];
  totalGeral: number;
}

// ─── Stores internas ──────────────────────────────────────────────────────────

const ccStore = new Map<string, CentroCusto>();
const registrosStore = new Map<string, RegistroCusto[]>();

let _contadorId = 0;
function gerarId(): string {
  _contadorId += 1;
  return `r-${Date.now()}-${_contadorId}`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizarTenantId(id: TenantId): TenantId {
  const n = id.trim().toLowerCase();
  if (n.length === 0) throw new Error("tenantId não pode ser vazio");
  return n;
}

function normalizarCcId(id: CostCenterId): CostCenterId {
  const n = id.trim().toLowerCase();
  if (n.length === 0) throw new Error("centroCustoId não pode ser vazio");
  if (/[^a-z0-9\-_]/.test(n)) {
    throw new Error(
      "centroCustoId deve conter apenas letras minúsculas, números, hífens ou underscores",
    );
  }
  return n;
}

function chaveCC(tenantId: TenantId, ccId: CostCenterId): string {
  return `${tenantId}::${ccId}`;
}

function chaveRegistros(tenantId: TenantId, ccId: CostCenterId): string {
  return `${tenantId}::${ccId}`;
}

// ─── Gestão de Centros de Custo ───────────────────────────────────────────────

/**
 * Cria um novo centro de custo para um tenant.
 * Lança erro se o ID já estiver em uso.
 */
export function criarCentroCusto(
  tenantId: TenantId,
  ccId: CostCenterId,
  nome: string,
  descricao?: string,
): CentroCusto {
  const tid = normalizarTenantId(tenantId);
  const cid = normalizarCcId(ccId);

  if (!nome || nome.trim().length === 0) {
    throw new Error("Nome do centro de custo não pode ser vazio");
  }

  const chave = chaveCC(tid, cid);
  if (ccStore.has(chave)) {
    throw new Error(
      `Centro de custo '${cid}' já existe para o tenant '${tid}'`,
    );
  }

  const agora = new Date();
  const cc: CentroCusto = {
    id: cid,
    tenantId: tid,
    nome: nome.trim(),
    descricao: descricao?.trim(),
    ativo: true,
    criadoEm: agora,
    atualizadoEm: agora,
  };
  ccStore.set(chave, cc);
  return { ...cc };
}

/**
 * Atualiza os metadados de um centro de custo existente.
 * Retorna o CC atualizado ou `null` se não encontrado.
 */
export function atualizarCentroCusto(
  tenantId: TenantId,
  ccId: CostCenterId,
  patch: Partial<Pick<CentroCusto, "nome" | "descricao" | "ativo">>,
): CentroCusto | null {
  const tid = normalizarTenantId(tenantId);
  const cid = normalizarCcId(ccId);
  const chave = chaveCC(tid, cid);
  const cc = ccStore.get(chave);
  if (!cc) return null;

  if (patch.nome !== undefined) {
    if (patch.nome.trim().length === 0) {
      throw new Error("Nome do centro de custo não pode ser vazio");
    }
    cc.nome = patch.nome.trim();
  }
  if (patch.descricao !== undefined) cc.descricao = patch.descricao.trim();
  if (patch.ativo !== undefined) cc.ativo = patch.ativo;
  cc.atualizadoEm = new Date();

  ccStore.set(chave, cc);
  return { ...cc };
}

/**
 * Retorna um centro de custo ou `null` se não encontrado.
 */
export function getCentroCusto(
  tenantId: TenantId,
  ccId: CostCenterId,
): CentroCusto | null {
  const tid = normalizarTenantId(tenantId);
  const cid = normalizarCcId(ccId);
  const cc = ccStore.get(chaveCC(tid, cid));
  return cc ? { ...cc } : null;
}

/**
 * Lista todos os centros de custo de um tenant.
 */
export function listarCentrosCusto(
  tenantId: TenantId,
  apenasAtivos = false,
): CentroCusto[] {
  const tid = normalizarTenantId(tenantId);
  const resultado: CentroCusto[] = [];
  for (const [chave, cc] of ccStore.entries()) {
    if (chave.startsWith(`${tid}::`)) {
      if (!apenasAtivos || cc.ativo) {
        resultado.push({ ...cc });
      }
    }
  }
  return resultado.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Remove (desativa logicamente) um centro de custo.
 * Retorna `true` se existia; `false` caso contrário.
 */
export function desativarCentroCusto(
  tenantId: TenantId,
  ccId: CostCenterId,
): boolean {
  const tid = normalizarTenantId(tenantId);
  const cid = normalizarCcId(ccId);
  const chave = chaveCC(tid, cid);
  const cc = ccStore.get(chave);
  if (!cc) return false;
  cc.ativo = false;
  cc.atualizadoEm = new Date();
  ccStore.set(chave, cc);
  return true;
}

// ─── Registro e Consulta de Custos ────────────────────────────────────────────

/**
 * Registra um custo em um centro de custo.
 * Lança erro se o CC não existir ou estiver inativo.
 */
export function registrarCusto(
  tenantId: TenantId,
  ccId: CostCenterId,
  tipo: TipoCusto,
  valor: number,
  descricao: string,
  metadados?: Record<string, unknown>,
): RegistroCusto {
  const tid = normalizarTenantId(tenantId);
  const cid = normalizarCcId(ccId);

  if (!Number.isFinite(valor) || valor < 0) {
    throw new RangeError(
      `Valor de custo deve ser um número não-negativo finito (recebido: ${valor})`,
    );
  }
  if (!descricao || descricao.trim().length === 0) {
    throw new Error("Descrição do registro de custo não pode ser vazia");
  }

  const cc = ccStore.get(chaveCC(tid, cid));
  if (!cc) {
    throw new Error(
      `Centro de custo '${cid}' não encontrado para o tenant '${tid}'`,
    );
  }
  if (!cc.ativo) {
    throw new Error(
      `Centro de custo '${cid}' está inativo e não aceita novos registros`,
    );
  }

  const registro: RegistroCusto = {
    id: gerarId(),
    tenantId: tid,
    centroCustoId: cid,
    tipo,
    valor,
    descricao: descricao.trim(),
    criadoEm: new Date(),
    metadados,
  };

  const chave = chaveRegistros(tid, cid);
  const lista = registrosStore.get(chave) ?? [];
  lista.push(registro);
  registrosStore.set(chave, lista);

  return { ...registro };
}

/**
 * Lista os registros de custo de um CC, com filtros opcionais por tipo e período.
 */
export function listarRegistros(
  tenantId: TenantId,
  ccId: CostCenterId,
  opcoes?: {
    tipo?: TipoCusto;
    de?: Date;
    ate?: Date;
  },
): RegistroCusto[] {
  const tid = normalizarTenantId(tenantId);
  const cid = normalizarCcId(ccId);
  const chave = chaveRegistros(tid, cid);
  let lista = (registrosStore.get(chave) ?? []).map((r) => ({ ...r }));

  if (opcoes?.tipo) {
    lista = lista.filter((r) => r.tipo === opcoes.tipo);
  }
  if (opcoes?.de) {
    lista = lista.filter((r) => r.criadoEm >= opcoes.de!);
  }
  if (opcoes?.ate) {
    lista = lista.filter((r) => r.criadoEm <= opcoes.ate!);
  }

  return lista.sort((a, b) => a.criadoEm.getTime() - b.criadoEm.getTime());
}

/**
 * Gera relatório consolidado de custos por CC para um tenant.
 */
export function relatorioTenantCusto(tenantId: TenantId): RelatorioTenantCusto {
  const tid = normalizarTenantId(tenantId);
  const ccs = listarCentrosCusto(tid);
  let totalGeral = 0;

  const centros: RelatorioCentroCusto[] = ccs.map((cc) => {
    const registros = listarRegistros(tid, cc.id);
    const totalPorTipo: Partial<Record<TipoCusto, number>> = {};
    let totalCC = 0;

    for (const r of registros) {
      totalPorTipo[r.tipo] = (totalPorTipo[r.tipo] ?? 0) + r.valor;
      totalCC += r.valor;
    }
    totalGeral += totalCC;

    return {
      centroCustoId: cc.id,
      nome: cc.nome,
      ativo: cc.ativo,
      totalPorTipo,
      totalGeral: totalCC,
      registros: registros.length,
    };
  });

  return { tenantId: tid, centros, totalGeral };
}

// ─── Utilitários de teste ─────────────────────────────────────────────────────

/** Remove todos os dados. Destinado exclusivamente a testes. */
export function clearAllCostCenters(): void {
  ccStore.clear();
  registrosStore.clear();
  _contadorId = 0;
}
