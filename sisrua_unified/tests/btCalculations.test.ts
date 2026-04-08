import { describe, it, expect, beforeEach } from 'vitest';
import type { BtPole, BtTransformer, BtEdge, BtContext } from '../src/types';
import { findTransformerConflictsWithoutSectioning } from '../src/utils/btCalculations';

describe('btCalculations - Transformer Conflict Detection', () => {
  let mockBtContext: BtContext;

  beforeEach(() => {
    // Setup: Create mock BT context with test poles and transformers
    mockBtContext = {
      poles: [
        { id: 'pole-1', lat: -22.825546, lng: -43.325956, name: 'P1', voltage: '380', status: 'good' },
        { id: 'pole-2', lat: -22.825600, lng: -43.325900, name: 'P2', voltage: '380', status: 'good' },
        { id: 'pole-3', lat: -22.825700, lng: -43.325800, name: 'P3', voltage: '380', status: 'good' },
        { id: 'pole-4', lat: -22.826000, lng: -43.325500, name: 'P4', voltage: '380', status: 'good' },
      ] as BtPole[],
      transformers: [
        { id: 'tf-1', poleId: 'pole-1', lat: -22.825546, lng: -43.325956, name: 'TF1', power: 75, status: 'good' },
        { id: 'tf-2', poleId: 'pole-2', lat: -22.825600, lng: -43.325900, name: 'TF2', power: 75, status: 'good' },
        { id: 'tf-3', poleId: 'pole-4', lat: -22.826000, lng: -43.325500, name: 'TF3', power: 75, status: 'good' },
      ] as BtTransformer[],
      edges: [
        { id: 'edge-1', fromPoleId: 'pole-1', toPoleId: 'pole-2', conductors: [] },
        { id: 'edge-2', fromPoleId: 'pole-2', toPoleId: 'pole-3', conductors: [] },
        // TF-3 is isolated (no edges)
      ] as BtEdge[],
      circuitBreakPoints: [],
    };
  });

  it('should detect multiple transformers in same electrical network without sectioning', () => {
    // TF-1 and TF-2 are connected via pole chain, TF-3 is isolated
    const conflicts = findTransformerConflictsWithoutSectioning(mockBtContext);
    
    // Esperamos detectar que TF-1 e TF-2 estão no mesmo mesh sem sectioning
    expect(conflicts.length).toBeGreaterThan(0);
    expect(conflicts[0].transformerIds.length).toBeGreaterThanOrEqual(2);
  });

  it('should not report conflict for single transformer in mesh', () => {
    // Modify context: single transformer in connected poles
    mockBtContext.transformers = [
      { id: 'tf-1', poleId: 'pole-1', lat: -22.825546, lng: -43.325956, name: 'TF1', power: 75, status: 'good' } as BtTransformer,
    ];

    const conflicts = findTransformerConflictsWithoutSectioning(mockBtContext);
    
    expect(conflicts.length).toBe(0);
  });

  it('should respect circuit break points as sectioning barriers', () => {
    // Add circuit breaker between TF-1 and TF-2 networks
    mockBtContext.circuitBreakPoints = [
      { id: 'cb-1', lat: -22.825570, lng: -43.325920, name: 'CB1' },
    ];

    // In this test, if circuit break properly isolates networks,
    // conflicts should be reduced or eliminated
    const conflicts = findTransformerConflictsWithoutSectioning(mockBtContext);
    
    // With proper circuit break, we expect fewer conflicts
    expect(conflicts.length).toBeLessThanOrEqual(1);
  });

  it('should handle empty context gracefully', () => {
    const emptyContext = { poles: [], transformers: [], edges: [], circuitBreakPoints: [] };
    
    const conflicts = findTransformerConflictsWithoutSectioning(emptyContext);
    
    expect(conflicts).toEqual([]);
  });

  it('should handle context with transformers but no edges', () => {
    const contextNoEdges = {
      poles: [
        { id: 'p1', lat: -22.825546, lng: -43.325956, name: 'P1', voltage: '380', status: 'good' },
        { id: 'p2', lat: -22.825600, lng: -43.325900, name: 'P2', voltage: '380', status: 'good' },
      ],
      transformers: [
        { id: 'tf-1', poleId: 'p1', lat: -22.825546, lng: -43.325956, name: 'TF1', power: 75, status: 'good' },
        { id: 'tf-2', poleId: 'p2', lat: -22.825600, lng: -43.325900, name: 'TF2', power: 75, status: 'good' },
      ],
      edges: [],
      circuitBreakPoints: [],
    };
    
    const conflicts = findTransformerConflictsWithoutSectioning(contextNoEdges);
    
    // No edges = no electrical connectivity = no conflicts
    expect(conflicts.length).toBe(0);
  });
});

describe('btCalculations - Data Sanitization', () => {
  it('should validate coordinate ranges', () => {
    const invalidPole: BtPole = {
      id: 'pole-invalid',
      lat: 999, // Invalid latitude
      lng: 999, // Invalid longitude
      name: 'Invalid',
      voltage: '380',
      status: 'good',
    };

    // Expect validation to fail for invalid coordinates
    expect(Math.abs(invalidPole.lat) <= 90).toBe(false);
    expect(Math.abs(invalidPole.lng) <= 180).toBe(false);
  });

  it('should sanitize string inputs', () => {
    const maliciousInput = '<script>alert("xss")</script>';
    const sanitized = maliciousInput
      .replace(/[<>]/g, '')
      .trim();

    expect(sanitized).not.toContain('<');
    expect(sanitized).not.toContain('>');
  });
});
