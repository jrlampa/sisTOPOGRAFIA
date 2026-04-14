/**
 * Topological Validator – unit tests (Item 8 – T1)
 */

import {
  validateBtTopology,
  TopologyInput,
  TopologyValidationResult,
} from '../services/topologicalValidator';

// ─── Fixtures ────────────────────────────────────────────────────────────────

/** Minimal valid linear topology: TX → A → B → C */
const validLinear = (): TopologyInput => ({
  transformers: [{ id: 'TX1', rootNodeId: 'A' }],
  poles: [
    { id: 'A' },
    { id: 'B' },
    { id: 'C' },
  ],
  edges: [
    { id: 'e1', fromId: 'A', toId: 'B' },
    { id: 'e2', fromId: 'B', toId: 'C' },
  ],
});

/** Star topology: TX → A, A → B, A → C, A → D */
const validStar = (): TopologyInput => ({
  transformers: [{ id: 'TX1', rootNodeId: 'A' }],
  poles: [{ id: 'A' }, { id: 'B' }, { id: 'C' }, { id: 'D' }],
  edges: [
    { id: 'e1', fromId: 'A', toId: 'B' },
    { id: 'e2', fromId: 'A', toId: 'C' },
    { id: 'e3', fromId: 'A', toId: 'D' },
  ],
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('validateBtTopology', () => {
  // ── 1. Happy paths ──────────────────────────────────────────────────────

  it('returns valid=true for a well-formed linear topology', () => {
    const result = validateBtTopology(validLinear());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns correct stats for linear topology', () => {
    const result = validateBtTopology(validLinear());
    expect(result.stats.nodeCount).toBe(3);
    expect(result.stats.edgeCount).toBe(2);
    expect(result.stats.transformerCount).toBe(1);
    expect(result.stats.isolatedNodes).toBe(0);
  });

  it('returns valid=true for a valid star topology', () => {
    const result = validateBtTopology(validStar());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  // ── 2. Invalid edge references ──────────────────────────────────────────

  it('detects INVALID_EDGE_FROM when fromId does not exist', () => {
    const topo = validLinear();
    topo.edges[0].fromId = 'GHOST';
    const result = validateBtTopology(topo);
    expect(result.valid).toBe(false);
    const err = result.errors.find(e => e.code === 'INVALID_EDGE_FROM');
    expect(err).toBeDefined();
    expect(err!.nodeId).toBe('GHOST');
  });

  it('detects INVALID_EDGE_TO when toId does not exist', () => {
    const topo = validLinear();
    topo.edges[1].toId = 'NOBODY';
    const result = validateBtTopology(topo);
    expect(result.valid).toBe(false);
    const err = result.errors.find(e => e.code === 'INVALID_EDGE_TO');
    expect(err).toBeDefined();
    expect(err!.nodeId).toBe('NOBODY');
  });

  // ── 3. Self-loops ───────────────────────────────────────────────────────

  it('detects SELF_LOOP', () => {
    const topo = validLinear();
    topo.edges[0] = { id: 'loop', fromId: 'A', toId: 'A' };
    const result = validateBtTopology(topo);
    expect(result.valid).toBe(false);
    const err = result.errors.find(e => e.code === 'SELF_LOOP');
    expect(err).toBeDefined();
    expect(err!.edgeId).toBe('loop');
  });

  // ── 4. Parallel edges ───────────────────────────────────────────────────

  it('detects PARALLEL_EDGE (same direction)', () => {
    const topo = validLinear();
    topo.edges.push({ id: 'dup', fromId: 'A', toId: 'B' });
    const result = validateBtTopology(topo);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'PARALLEL_EDGE')).toBe(true);
  });

  it('detects PARALLEL_EDGE (reversed direction)', () => {
    const topo = validLinear();
    topo.edges.push({ id: 'rev', fromId: 'B', toId: 'A' });
    const result = validateBtTopology(topo);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'PARALLEL_EDGE')).toBe(true);
  });

  // ── 5. Duplicate node IDs ───────────────────────────────────────────────

  it('detects DUPLICATE_NODE_ID', () => {
    const topo = validLinear();
    topo.poles.push({ id: 'B' }); // duplicate
    const result = validateBtTopology(topo);
    expect(result.valid).toBe(false);
    const err = result.errors.find(e => e.code === 'DUPLICATE_NODE_ID');
    expect(err).toBeDefined();
    expect(err!.nodeId).toBe('B');
  });

  // ── 6. Orphan / isolated nodes (warnings) ──────────────────────────────

  it('warns ORPHAN_NODE for a node not in any edge', () => {
    const topo = validLinear();
    topo.poles.push({ id: 'LONELY' });
    // LONELY is disconnected from the tree → both ORPHAN_NODE and DISCONNECTED_GRAPH
    const result = validateBtTopology(topo);
    expect(result.warnings.some(w => w.code === 'ORPHAN_NODE' && w.nodeId === 'LONELY')).toBe(true);
    expect(result.stats.isolatedNodes).toBeGreaterThanOrEqual(1);
  });

  // ── 7. Graph connectivity ───────────────────────────────────────────────

  it('detects DISCONNECTED_GRAPH when a subtree is not reachable from root', () => {
    const topo: TopologyInput = {
      transformers: [{ id: 'TX', rootNodeId: 'A' }],
      poles: [{ id: 'A' }, { id: 'B' }, { id: 'C' }, { id: 'D' }],
      edges: [
        { id: 'e1', fromId: 'A', toId: 'B' },
        // C–D is an island not connected to A or B
        { id: 'e2', fromId: 'C', toId: 'D' },
      ],
    };
    const result = validateBtTopology(topo);
    expect(result.valid).toBe(false);
    const codes = result.errors.map(e => e.code);
    expect(codes).toContain('DISCONNECTED_GRAPH');
  });

  it('does NOT raise DISCONNECTED_GRAPH for a fully connected star', () => {
    const result = validateBtTopology(validStar());
    expect(result.errors.some(e => e.code === 'DISCONNECTED_GRAPH')).toBe(false);
  });

  // ── 8. Transformer warnings ─────────────────────────────────────────────

  it('warns NO_TRANSFORMER when transformers array is empty', () => {
    const topo = validLinear();
    topo.transformers = [];
    const result = validateBtTopology(topo);
    expect(result.warnings.some(w => w.code === 'NO_TRANSFORMER')).toBe(true);
  });

  it('warns MULTIPLE_ROOTS when more than one transformer is present', () => {
    const topo = validLinear();
    topo.transformers.push({ id: 'TX2', rootNodeId: 'C' });
    const result = validateBtTopology(topo);
    expect(result.warnings.some(w => w.code === 'MULTIPLE_ROOTS')).toBe(true);
  });

  // ── 9. Edge without explicit id ─────────────────────────────────────────

  it('handles edges without an explicit id (fallback label)', () => {
    const topo: TopologyInput = {
      transformers: [{ id: 'TX', rootNodeId: 'A' }],
      poles: [{ id: 'A' }, { id: 'B' }],
      edges: [
        { fromId: 'A', toId: 'B' }, // no id field
      ],
    };
    const result = validateBtTopology(topo);
    expect(result.valid).toBe(true);
  });

  // ── 10. Empty topology ──────────────────────────────────────────────────

  it('handles completely empty topology without crashing', () => {
    const result = validateBtTopology({ poles: [], edges: [], transformers: [] });
    expect(result.stats.nodeCount).toBe(0);
    expect(result.stats.edgeCount).toBe(0);
    // Should warn about no transformer
    expect(result.warnings.some(w => w.code === 'NO_TRANSFORMER')).toBe(true);
  });

  // ── 11. Multiple errors reported at once ───────────────────────────────

  it('collects multiple independent errors in one pass', () => {
    const topo: TopologyInput = {
      transformers: [{ id: 'TX', rootNodeId: 'A' }],
      poles: [{ id: 'A' }, { id: 'A' }], // duplicate
      edges: [
        { id: 'e1', fromId: 'A', toId: 'A' }, // self-loop
        { id: 'e2', fromId: 'NOPE', toId: 'A' }, // invalid from
      ],
    };
    const result = validateBtTopology(topo);
    expect(result.valid).toBe(false);
    const codes = result.errors.map(e => e.code);
    expect(codes).toContain('DUPLICATE_NODE_ID');
    expect(codes).toContain('SELF_LOOP');
    expect(codes).toContain('INVALID_EDGE_FROM');
  });

  // ── 12. Transformer root node used as edge endpoint ─────────────────────

  it('accepts edges that reference transformer rootNodeId as a valid node', () => {
    const topo: TopologyInput = {
      transformers: [{ id: 'TX', rootNodeId: 'ROOT' }],
      poles: [{ id: 'B' }, { id: 'C' }],
      edges: [
        { id: 'e1', fromId: 'ROOT', toId: 'B' },
        { id: 'e2', fromId: 'B', toId: 'C' },
      ],
    };
    // ROOT is not in poles, but transformer declares it — should be valid
    const result = validateBtTopology(topo);
    expect(result.errors.filter(e => e.code === 'INVALID_EDGE_FROM' || e.code === 'INVALID_EDGE_TO')).toHaveLength(0);
  });

  // ── 13. Single-node topology (no edges) ────────────────────────────────

  it('warns about orphan node in single-node topology', () => {
    const topo: TopologyInput = {
      transformers: [{ id: 'TX', rootNodeId: 'SOLO' }],
      poles: [{ id: 'SOLO' }],
      edges: [],
    };
    const result = validateBtTopology(topo);
    // SOLO is not in ANY edge → ORPHAN_NODE warning
    expect(result.warnings.some(w => w.code === 'ORPHAN_NODE' && w.nodeId === 'SOLO')).toBe(true);
  });

  // ── 14. Stats accuracy on complex topology ──────────────────────────────

  it('reports accurate stats on a medium-sized topology', () => {
    const poles = Array.from({ length: 10 }, (_, i) => ({ id: `P${i}` }));
    const edges = Array.from({ length: 9 }, (_, i) => ({
      id: `e${i}`,
      fromId: `P${i}`,
      toId: `P${i + 1}`,
    }));
    const topo: TopologyInput = {
      transformers: [{ id: 'TX', rootNodeId: 'P0' }],
      poles,
      edges,
    };
    const result = validateBtTopology(topo);
    expect(result.stats.nodeCount).toBe(10);
    expect(result.stats.edgeCount).toBe(9);
    expect(result.stats.transformerCount).toBe(1);
    expect(result.stats.isolatedNodes).toBe(0);
    expect(result.valid).toBe(true);
  });

  // ── 15. valid=false when any error exists ───────────────────────────────

  it('sets valid=false if at least one error is present', () => {
    const topo = validLinear();
    topo.edges.push({ id: 'extra', fromId: 'A', toId: 'B' }); // parallel
    const result: TopologyValidationResult = validateBtTopology(topo);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
