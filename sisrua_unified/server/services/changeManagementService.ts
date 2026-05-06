/**
 * changeManagementService.ts — Gestão de Mudança e Janelas de Manutenção (118 [T1])
 *
 * Implementa controle formal de mudanças (ITIL change management):
 * - Janelas de manutenção programadas com blocklist de deploy
 * - Requisições de mudança com aprovação formal
 * - Detecção de impacto operacional durante deploy
 */

import { randomUUID } from 'crypto';

// ─── Tipos ─────────────────────────────────────────────────────────────────

export type ChangeType = 'planned' | 'emergency' | 'standard';
export type ChangeStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'completed';
export type WindowStatus = 'planned' | 'active' | 'completed' | 'cancelled';

export interface MaintenanceWindow {
  id: string;
  name: string;
  description: string;
  affectedSystems: string[];
  startAt: string;   // ISO 8601
  endAt: string;     // ISO 8601
  status: WindowStatus;
  createdBy: string;
  createdAt: string;
}

export interface ChangeRequest {
  id: string;
  title: string;
  description: string;
  type: ChangeType;
  requestedBy: string;
  approvedBy?: string;
  rejectedBy?: string;
  status: ChangeStatus;
  maintenanceWindowId?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  justification: string;
  rollbackPlan: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Estado em memória ─────────────────────────────────────────────────────

const _windows = new Map<string, MaintenanceWindow>();
const _changes = new Map<string, ChangeRequest>();

// ─── Janelas de Manutenção ─────────────────────────────────────────────────

/**
 * Cria uma nova janela de manutenção programada.
 * startAt deve ser anterior a endAt.
 */
export function createMaintenanceWindow(params: {
  name: string;
  description: string;
  affectedSystems: string[];
  startAt: string;
  endAt: string;
  createdBy: string;
}): MaintenanceWindow {
  const { name, description, affectedSystems, startAt, endAt, createdBy } = params;

  if (!name || name.trim().length === 0) throw new Error('name é obrigatório');
  if (!startAt || !endAt) throw new Error('startAt e endAt são obrigatórios');
  if (new Date(startAt) >= new Date(endAt)) {
    throw new Error('startAt deve ser anterior a endAt');
  }

  const window: MaintenanceWindow = {
    id: randomUUID(),
    name: name.trim(),
    description: description.trim(),
    affectedSystems,
    startAt,
    endAt,
    status: 'planned',
    createdBy,
    createdAt: new Date().toISOString(),
  };

  _windows.set(window.id, window);
  return window;
}

/** Retorna todas as janelas de manutenção. */
export function listMaintenanceWindows(): MaintenanceWindow[] {
  return [..._windows.values()].sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
  );
}

/** Retorna a janela de manutenção pelo id. */
export function getMaintenanceWindow(id: string): MaintenanceWindow | null {
  return _windows.get(id) ?? null;
}

/**
 * Verifica se o instante fornecido (padrão: agora) está dentro de alguma
 * janela de manutenção ativa ou planejada que bloqueia deploys.
 */
export function isInMaintenanceWindow(atTime?: string): {
  blocked: boolean;
  window?: MaintenanceWindow;
} {
  const now = atTime ? new Date(atTime) : new Date();
  const active = [..._windows.values()].find((w) => {
    if (w.status === 'cancelled' || w.status === 'completed') return false;
    return now >= new Date(w.startAt) && now <= new Date(w.endAt);
  });

  return active ? { blocked: true, window: active } : { blocked: false };
}

/**
 * Cancela uma janela de manutenção pelo id.
 * Retorna false se não encontrada ou já concluída.
 */
export function cancelMaintenanceWindow(id: string): boolean {
  const w = _windows.get(id);
  if (!w || w.status === 'completed') return false;
  _windows.set(id, { ...w, status: 'cancelled' });
  return true;
}

// ─── Requisições de Mudança ────────────────────────────────────────────────

/**
 * Cria uma nova requisição de mudança.
 */
export function createChangeRequest(params: {
  title: string;
  description: string;
  type: ChangeType;
  requestedBy: string;
  justification: string;
  rollbackPlan: string;
  maintenanceWindowId?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
}): ChangeRequest {
  const {
    title, description, type, requestedBy, justification, rollbackPlan,
    maintenanceWindowId, scheduledStart, scheduledEnd,
  } = params;

  if (!title || title.trim().length === 0) throw new Error('title é obrigatório');
  if (!requestedBy || requestedBy.trim().length === 0) throw new Error('requestedBy é obrigatório');
  if (!justification || justification.trim().length === 0) throw new Error('justification é obrigatório');
  if (!rollbackPlan || rollbackPlan.trim().length === 0) throw new Error('rollbackPlan é obrigatório');

  if (maintenanceWindowId && !_windows.has(maintenanceWindowId)) {
    throw new Error('maintenanceWindowId inválido');
  }

  const now = new Date().toISOString();
  const change: ChangeRequest = {
    id: randomUUID(),
    title: title.trim(),
    description: description.trim(),
    type,
    requestedBy: requestedBy.trim(),
    status: 'pending',
    justification: justification.trim(),
    rollbackPlan: rollbackPlan.trim(),
    maintenanceWindowId,
    scheduledStart,
    scheduledEnd,
    createdAt: now,
    updatedAt: now,
  };

  _changes.set(change.id, change);
  return change;
}

/** Retorna a requisição de mudança pelo id. */
export function getChangeRequest(id: string): ChangeRequest | null {
  return _changes.get(id) ?? null;
}

/** Lista requisições de mudança, opcionalmente filtradas por status. */
export function listChangeRequests(statusFilter?: ChangeStatus): ChangeRequest[] {
  const all = [..._changes.values()];
  const filtered = statusFilter ? all.filter((c) => c.status === statusFilter) : all;
  return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Aprova uma requisição de mudança.
 * Somente requisições com status 'pending' podem ser aprovadas.
 */
export function approveChangeRequest(id: string, approvedBy: string): ChangeRequest {
  const change = _changes.get(id);
  if (!change) throw new Error('Requisição de mudança não encontrada');
  if (change.status !== 'pending') {
    throw new Error(`Não é possível aprovar uma requisição com status '${change.status}'`);
  }
  if (!approvedBy || approvedBy.trim().length === 0) throw new Error('approvedBy é obrigatório');

  const updated: ChangeRequest = {
    ...change,
    status: 'approved',
    approvedBy: approvedBy.trim(),
    updatedAt: new Date().toISOString(),
  };
  _changes.set(id, updated);
  return updated;
}

/**
 * Rejeita uma requisição de mudança.
 * Somente requisições com status 'pending' podem ser rejeitadas.
 */
export function rejectChangeRequest(id: string, rejectedBy: string): ChangeRequest {
  const change = _changes.get(id);
  if (!change) throw new Error('Requisição de mudança não encontrada');
  if (change.status !== 'pending') {
    throw new Error(`Não é possível rejeitar uma requisição com status '${change.status}'`);
  }
  if (!rejectedBy || rejectedBy.trim().length === 0) throw new Error('rejectedBy é obrigatório');

  const updated: ChangeRequest = {
    ...change,
    status: 'rejected',
    rejectedBy: rejectedBy.trim(),
    updatedAt: new Date().toISOString(),
  };
  _changes.set(id, updated);
  return updated;
}

/**
 * Marca uma requisição aprovada como concluída.
 */
export function completeChangeRequest(id: string): ChangeRequest {
  const change = _changes.get(id);
  if (!change) throw new Error('Requisição de mudança não encontrada');
  if (change.status !== 'approved') {
    throw new Error(`Apenas requisições aprovadas podem ser concluídas`);
  }

  const updated: ChangeRequest = {
    ...change,
    status: 'completed',
    updatedAt: new Date().toISOString(),
  };
  _changes.set(id, updated);
  return updated;
}

// ─── Utilitários de Teste ──────────────────────────────────────────────────

/** Limpa todo o estado em memória (para testes). */
export function clearChangeManagementState(): void {
  _windows.clear();
  _changes.clear();
}
