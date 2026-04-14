/**
 * Item 10 – Domain Snapshots (Digital Twin)
 *
 * Cria e gerencia instantâneos versionados do estado de domínio de projetos.
 * Cada snapshot recebe um hash SHA-256 do estado para garantir integridade.
 * Armazenamento em memória com stub de persistência Postgres.
 */

import { createHash, randomUUID } from "crypto";
import { logger } from "../utils/logger.js";

// ── Tipos de domínio ──────────────────────────────────────────────────────────

export interface DomainSnapshot {
  id: string;
  projectId: string;
  timestamp: Date;
  stateHash: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  state: Record<string, any>;
  metadata: SnapshotMetadata;
  version: number;
}

export interface SnapshotMetadata {
  author?: string;
  description?: string;
  tags?: string[];
  source?: string;
  [key: string]: unknown;
}

export interface SnapshotDiff {
  snapshotIdA: string;
  snapshotIdB: string;
  addedKeys: string[];
  removedKeys: string[];
  changedKeys: string[];
  identical: boolean;
  timestampDeltaMs: number;
  versionDelta: number;
}

// ── Armazenamento em memória ───────────────────────────────────────────────────

// Mapa principal: snapshotId → DomainSnapshot
const snapshotStore = new Map<string, DomainSnapshot>();

// Índice secundário: projectId → lista de snapshotIds (ordem de criação)
const projectIndex = new Map<string, string[]>();

// ── Utilitários ───────────────────────────────────────────────────────────────

function computeStateHash(state: Record<string, unknown>): string {
  // Serialização determinística via ordenação de chaves
  const canonical = JSON.stringify(state, Object.keys(state).sort());
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

function getNextVersion(projectId: string): number {
  const ids = projectIndex.get(projectId) ?? [];
  return ids.length + 1;
}

// ── CRUD de snapshots ─────────────────────────────────────────────────────────

/**
 * Cria um snapshot versionado do estado de domínio.
 * O hash SHA-256 é calculado automaticamente a partir do estado.
 */
async function createSnapshot(
  projectId: string,
  state: Record<string, unknown>,
  metadata: SnapshotMetadata = {},
): Promise<DomainSnapshot> {
  const id = randomUUID();
  const version = getNextVersion(projectId);
  const stateHash = computeStateHash(state);

  const snapshot: DomainSnapshot = {
    id,
    projectId,
    timestamp: new Date(),
    stateHash,
    state,
    metadata,
    version,
  };

  // Persiste em memória
  snapshotStore.set(id, snapshot);

  const projectIds = projectIndex.get(projectId) ?? [];
  projectIds.push(id);
  projectIndex.set(projectId, projectIds);

  // Stub: aqui seria feita a persistência no Postgres
  // await persistSnapshotToPostgres(snapshot);

  logger.info("Snapshot de domínio criado", {
    snapshotId: id,
    projectId,
    version,
    stateHash,
  });

  return snapshot;
}

/**
 * Recupera um snapshot pelo seu ID.
 * Retorna null se não encontrado.
 */
async function getSnapshot(snapshotId: string): Promise<DomainSnapshot | null> {
  return snapshotStore.get(snapshotId) ?? null;
}

/**
 * Lista todos os snapshots de um projeto em ordem cronológica.
 */
async function listSnapshots(projectId: string): Promise<DomainSnapshot[]> {
  const ids = projectIndex.get(projectId) ?? [];
  const snapshots = ids
    .map((id) => snapshotStore.get(id))
    .filter((s): s is DomainSnapshot => s !== undefined);

  return snapshots.sort((a, b) => a.version - b.version);
}

/**
 * Compara dois snapshots e retorna um resumo das diferenças.
 * Realiza diff superficial (top-level keys) dos estados.
 */
async function compareSnapshots(
  idA: string,
  idB: string,
): Promise<SnapshotDiff> {
  const [snapA, snapB] = await Promise.all([getSnapshot(idA), getSnapshot(idB)]);

  if (!snapA) {
    throw new Error(`Snapshot não encontrado: "${idA}"`);
  }
  if (!snapB) {
    throw new Error(`Snapshot não encontrado: "${idB}"`);
  }

  const keysA = new Set(Object.keys(snapA.state));
  const keysB = new Set(Object.keys(snapB.state));

  const addedKeys = [...keysB].filter((k) => !keysA.has(k));
  const removedKeys = [...keysA].filter((k) => !keysB.has(k));

  const commonKeys = [...keysA].filter((k) => keysB.has(k));
  const changedKeys = commonKeys.filter(
    (k) =>
      JSON.stringify(snapA.state[k]) !== JSON.stringify(snapB.state[k]),
  );

  const diff: SnapshotDiff = {
    snapshotIdA: idA,
    snapshotIdB: idB,
    addedKeys,
    removedKeys,
    changedKeys,
    identical:
      addedKeys.length === 0 &&
      removedKeys.length === 0 &&
      changedKeys.length === 0,
    timestampDeltaMs:
      snapB.timestamp.getTime() - snapA.timestamp.getTime(),
    versionDelta: snapB.version - snapA.version,
  };

  logger.info("Comparação de snapshots realizada", {
    snapshotIdA: idA,
    snapshotIdB: idB,
    identical: diff.identical,
    changedCount: changedKeys.length,
  });

  return diff;
}

/**
 * Remove um snapshot pelo ID.
 * Retorna true se removido, false se não encontrado.
 */
async function deleteSnapshot(snapshotId: string): Promise<boolean> {
  const snapshot = snapshotStore.get(snapshotId);
  if (!snapshot) return false;

  snapshotStore.delete(snapshotId);

  const projectIds = projectIndex.get(snapshot.projectId) ?? [];
  const updated = projectIds.filter((id) => id !== snapshotId);
  projectIndex.set(snapshot.projectId, updated);

  logger.info("Snapshot de domínio removido", {
    snapshotId,
    projectId: snapshot.projectId,
  });

  return true;
}

/**
 * Retorna estatísticas do armazenamento em memória.
 */
function stats(): { totalSnapshots: number; totalProjects: number } {
  return {
    totalSnapshots: snapshotStore.size,
    totalProjects: projectIndex.size,
  };
}

// ── Exportação do serviço ─────────────────────────────────────────────────────

export const domainSnapshotService = {
  createSnapshot,
  getSnapshot,
  listSnapshots,
  compareSnapshots,
  deleteSnapshot,
  stats,
} as const;
