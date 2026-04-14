/**
 * Domain Snapshot Service (Item 10 – T1)
 *
 * Maintains versioned, immutable snapshots of domain state
 * (topology, engineering decisions, CQT parameters, etc.).
 *
 * Storage: in-memory Map — architecture is swappable to a DB later
 * by replacing the `store` Map and the five exported async functions.
 */

import { createHash } from 'crypto';
import { randomUUID } from 'crypto';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface DomainSnapshot {
  /** UUID v4 */
  id: string;
  /** ISO-8601 timestamp */
  timestamp: string;
  /** Auto-increment per key, starting at 1 */
  version: number;
  /** Domain key, e.g. "bt_topology", "cqt_parameters" */
  key: string;
  /** The snapshot data (arbitrary) */
  data: unknown;
  /** SHA-256 hex digest of JSON.stringify(data) */
  sha256: string;
  /** Optional caller-supplied metadata */
  metadata?: Record<string, unknown>;
}

export interface SnapshotDiff {
  added: string[];
  removed: string[];
  changed: string[];
}

// ─── Internal store ───────────────────────────────────────────────────────────

/** id → snapshot */
const byId = new Map<string, DomainSnapshot>();

/** key → snapshots ordered oldest→newest */
const byKey = new Map<string, DomainSnapshot[]>();

/** key → latest version number */
const versions = new Map<string, number>();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sha256hex(data: unknown): string {
  return createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

/**
 * Flatten an object into dot-notation paths.
 * Arrays are treated as values (not further decomposed).
 */
function flattenPaths(
  obj: unknown,
  prefix = '',
  result: Map<string, string> = new Map(),
): Map<string, string> {
  if (obj !== null && typeof obj === 'object' && !Array.isArray(obj)) {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      flattenPaths(v, prefix ? `${prefix}.${k}` : k, result);
    }
  } else {
    result.set(prefix, JSON.stringify(obj));
  }
  return result;
}

// ─── API ──────────────────────────────────────────────────────────────────────

/**
 * Create and persist a new snapshot for the given domain key.
 * Version auto-increments per key (1-based).
 */
export async function takeSnapshot(
  key: string,
  data: unknown,
  metadata?: Record<string, unknown>,
): Promise<DomainSnapshot> {
  const version = (versions.get(key) ?? 0) + 1;
  versions.set(key, version);

  const snapshot: DomainSnapshot = {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    version,
    key,
    data,
    sha256: sha256hex(data),
    metadata,
  };

  byId.set(snapshot.id, snapshot);

  if (!byKey.has(key)) byKey.set(key, []);
  byKey.get(key)!.push(snapshot);

  return snapshot;
}

/**
 * Retrieve a snapshot by its unique ID.
 * Returns `null` when not found.
 */
export async function getSnapshot(id: string): Promise<DomainSnapshot | null> {
  return byId.get(id) ?? null;
}

/**
 * List snapshots for a domain key, newest first.
 * @param limit Maximum number to return (default: all).
 */
export async function listSnapshots(
  key: string,
  limit?: number,
): Promise<DomainSnapshot[]> {
  const list = byKey.get(key) ?? [];
  const reversed = [...list].reverse();
  return limit !== undefined ? reversed.slice(0, limit) : reversed;
}

/**
 * Structural diff between two snapshots.
 *
 * Compares the flat dot-notation paths of both data objects and returns:
 *   - `added`:   paths present in snapshot2 but not in snapshot1
 *   - `removed`: paths present in snapshot1 but not in snapshot2
 *   - `changed`: paths present in both but with different values
 */
export async function diffSnapshots(
  id1: string,
  id2: string,
): Promise<SnapshotDiff> {
  const s1 = byId.get(id1);
  const s2 = byId.get(id2);

  if (!s1) throw new Error(`Snapshot not found: ${id1}`);
  if (!s2) throw new Error(`Snapshot not found: ${id2}`);

  const map1 = flattenPaths(s1.data);
  const map2 = flattenPaths(s2.data);

  const added: string[] = [];
  const removed: string[] = [];
  const changed: string[] = [];

  for (const [path, val2] of map2) {
    if (!map1.has(path)) {
      added.push(path);
    } else if (map1.get(path) !== val2) {
      changed.push(path);
    }
  }

  for (const path of map1.keys()) {
    if (!map2.has(path)) removed.push(path);
  }

  return { added: added.sort(), removed: removed.sort(), changed: changed.sort() };
}

/**
 * Remove old snapshots for a domain key, keeping only the `keepLast` newest.
 * Returns the number of snapshots deleted.
 */
export async function pruneSnapshots(
  key: string,
  keepLast: number,
): Promise<number> {
  const list = byKey.get(key) ?? [];
  if (list.length <= keepLast) return 0;

  const toDelete = list.splice(0, list.length - keepLast);
  for (const snap of toDelete) byId.delete(snap.id);
  return toDelete.length;
}

/**
 * Reset all in-memory state.
 * Intended for test isolation only — do not call in production code.
 */
export function _resetStoreForTesting(): void {
  byId.clear();
  byKey.clear();
  versions.clear();
}
