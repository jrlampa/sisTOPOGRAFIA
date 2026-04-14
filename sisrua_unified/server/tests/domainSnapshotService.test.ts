/**
 * Domain Snapshot Service – unit tests (Item 10 – T1)
 */

import {
  takeSnapshot,
  getSnapshot,
  listSnapshots,
  diffSnapshots,
  pruneSnapshots,
  _resetStoreForTesting,
} from '../services/domainSnapshotService';

beforeEach(() => {
  _resetStoreForTesting();
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('domainSnapshotService', () => {
  // ── 1. takeSnapshot basics ───────────────────────────────────────────────

  it('creates a snapshot with required fields', async () => {
    const snap = await takeSnapshot('bt_topology', { nodes: 3 });
    expect(snap.id).toMatch(/^[0-9a-f-]{36}$/); // UUID v4 pattern
    expect(snap.key).toBe('bt_topology');
    expect(snap.version).toBe(1);
    expect(snap.data).toEqual({ nodes: 3 });
    expect(typeof snap.sha256).toBe('string');
    expect(snap.sha256).toHaveLength(64); // SHA-256 hex
    expect(snap.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('auto-increments version per key', async () => {
    const s1 = await takeSnapshot('k', { v: 1 });
    const s2 = await takeSnapshot('k', { v: 2 });
    const s3 = await takeSnapshot('k', { v: 3 });
    expect(s1.version).toBe(1);
    expect(s2.version).toBe(2);
    expect(s3.version).toBe(3);
  });

  it('keeps versions independent across keys', async () => {
    await takeSnapshot('keyA', {});
    await takeSnapshot('keyA', {});
    const s = await takeSnapshot('keyB', {});
    expect(s.version).toBe(1);
  });

  it('stores optional metadata', async () => {
    const snap = await takeSnapshot('k', {}, { author: 'eng1', reason: 'test' });
    expect(snap.metadata).toEqual({ author: 'eng1', reason: 'test' });
  });

  it('stores undefined metadata when not provided', async () => {
    const snap = await takeSnapshot('k', {});
    expect(snap.metadata).toBeUndefined();
  });

  it('computes a stable sha256 for identical data', async () => {
    const s1 = await takeSnapshot('k', { x: 1, y: 2 });
    const s2 = await takeSnapshot('k', { x: 1, y: 2 });
    expect(s1.sha256).toBe(s2.sha256);
  });

  it('computes different sha256 for different data', async () => {
    const s1 = await takeSnapshot('k', { x: 1 });
    const s2 = await takeSnapshot('k', { x: 2 });
    expect(s1.sha256).not.toBe(s2.sha256);
  });

  // ── 2. getSnapshot ───────────────────────────────────────────────────────

  it('retrieves a snapshot by id', async () => {
    const snap = await takeSnapshot('k', { hello: 'world' });
    const found = await getSnapshot(snap.id);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(snap.id);
    expect(found!.data).toEqual({ hello: 'world' });
  });

  it('returns null for unknown id', async () => {
    const result = await getSnapshot('00000000-0000-0000-0000-000000000000');
    expect(result).toBeNull();
  });

  // ── 3. listSnapshots ─────────────────────────────────────────────────────

  it('lists snapshots newest first', async () => {
    await takeSnapshot('topo', { v: 1 });
    await takeSnapshot('topo', { v: 2 });
    await takeSnapshot('topo', { v: 3 });
    const list = await listSnapshots('topo');
    expect(list).toHaveLength(3);
    expect(list[0].version).toBe(3);
    expect(list[2].version).toBe(1);
  });

  it('respects the limit parameter', async () => {
    for (let i = 0; i < 5; i++) await takeSnapshot('k', { i });
    const limited = await listSnapshots('k', 2);
    expect(limited).toHaveLength(2);
    expect(limited[0].version).toBe(5);
    expect(limited[1].version).toBe(4);
  });

  it('returns empty array for unknown key', async () => {
    const list = await listSnapshots('nonexistent');
    expect(list).toEqual([]);
  });

  // ── 4. diffSnapshots ─────────────────────────────────────────────────────

  it('reports no changes when data is identical', async () => {
    const s1 = await takeSnapshot('k', { a: 1, b: 2 });
    const s2 = await takeSnapshot('k', { a: 1, b: 2 });
    const diff = await diffSnapshots(s1.id, s2.id);
    expect(diff.added).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
    expect(diff.changed).toHaveLength(0);
  });

  it('reports added paths', async () => {
    const s1 = await takeSnapshot('k', { a: 1 });
    const s2 = await takeSnapshot('k', { a: 1, b: 2 });
    const diff = await diffSnapshots(s1.id, s2.id);
    expect(diff.added).toContain('b');
    expect(diff.removed).toHaveLength(0);
    expect(diff.changed).toHaveLength(0);
  });

  it('reports removed paths', async () => {
    const s1 = await takeSnapshot('k', { a: 1, b: 2 });
    const s2 = await takeSnapshot('k', { a: 1 });
    const diff = await diffSnapshots(s1.id, s2.id);
    expect(diff.removed).toContain('b');
    expect(diff.added).toHaveLength(0);
  });

  it('reports changed paths', async () => {
    const s1 = await takeSnapshot('k', { a: 1, b: 'old' });
    const s2 = await takeSnapshot('k', { a: 1, b: 'new' });
    const diff = await diffSnapshots(s1.id, s2.id);
    expect(diff.changed).toContain('b');
    expect(diff.added).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
  });

  it('diffs nested objects via dot-notation paths', async () => {
    const s1 = await takeSnapshot('k', { net: { nodes: 3, edges: 2 } });
    const s2 = await takeSnapshot('k', { net: { nodes: 5, edges: 2 } });
    const diff = await diffSnapshots(s1.id, s2.id);
    expect(diff.changed).toContain('net.nodes');
    expect(diff.changed).not.toContain('net.edges');
  });

  it('throws when first id is not found', async () => {
    const s2 = await takeSnapshot('k', {});
    await expect(diffSnapshots('missing-id', s2.id)).rejects.toThrow(/not found/i);
  });

  it('throws when second id is not found', async () => {
    const s1 = await takeSnapshot('k', {});
    await expect(diffSnapshots(s1.id, 'missing-id')).rejects.toThrow(/not found/i);
  });

  // ── 5. pruneSnapshots ────────────────────────────────────────────────────

  it('prunes old snapshots and returns deleted count', async () => {
    for (let i = 0; i < 5; i++) await takeSnapshot('k', { i });
    const deleted = await pruneSnapshots('k', 2);
    expect(deleted).toBe(3);
    const remaining = await listSnapshots('k');
    expect(remaining).toHaveLength(2);
  });

  it('keeps the newest snapshots after pruning', async () => {
    for (let i = 1; i <= 4; i++) await takeSnapshot('k', { v: i });
    await pruneSnapshots('k', 2);
    const remaining = await listSnapshots('k');
    const versions = remaining.map(s => (s.data as { v: number }).v);
    expect(versions).toContain(4);
    expect(versions).toContain(3);
    expect(versions).not.toContain(1);
    expect(versions).not.toContain(2);
  });

  it('returns 0 when fewer snapshots exist than keepLast', async () => {
    await takeSnapshot('k', {});
    const deleted = await pruneSnapshots('k', 10);
    expect(deleted).toBe(0);
  });

  it('pruned snapshots are no longer retrievable by id', async () => {
    const old = await takeSnapshot('k', { old: true });
    await takeSnapshot('k', { new: true });
    await pruneSnapshots('k', 1);
    const found = await getSnapshot(old.id);
    expect(found).toBeNull();
  });

  it('does not prune snapshots from other keys', async () => {
    await takeSnapshot('a', { v: 1 });
    await takeSnapshot('a', { v: 2 });
    await takeSnapshot('b', { v: 1 });
    await pruneSnapshots('a', 1);
    const bList = await listSnapshots('b');
    expect(bList).toHaveLength(1);
  });
});
