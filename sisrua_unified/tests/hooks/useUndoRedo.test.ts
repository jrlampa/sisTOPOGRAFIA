import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUndoRedo } from '../../src/hooks/useUndoRedo';

describe('useUndoRedo', () => {
    it('should initialize with initial state', () => {
        const { result } = renderHook(() => useUndoRedo({ count: 0 }));
        expect(result.current.state).toEqual({ count: 0 });
        expect(result.current.canUndo).toBe(false);
        expect(result.current.canRedo).toBe(false);
    });

    it('should update state and allow undo', () => {
        const { result } = renderHook(() => useUndoRedo({ count: 0 }));
        
        act(() => {
            result.current.setState({ count: 1 });
        });
        
        expect(result.current.state).toEqual({ count: 1 });
        expect(result.current.canUndo).toBe(true);
        
        act(() => {
            result.current.undo();
        });
        
        expect(result.current.state).toEqual({ count: 0 });
        expect(result.current.canUndo).toBe(false);
        expect(result.current.canRedo).toBe(true);
    });

    it('should allow redo after undo', () => {
        const { result } = renderHook(() => useUndoRedo({ count: 0 }));
        
        act(() => {
            result.current.setState({ count: 1 });
            result.current.undo();
            result.current.redo();
        });
        
        expect(result.current.state).toEqual({ count: 1 });
    });

    it('should prevent duplicate history entries', () => {
        const { result } = renderHook(() => useUndoRedo({ count: 0 }));
        
        act(() => {
            result.current.setState({ count: 0 }); // same value
        });
        
        expect(result.current.canUndo).toBe(false);
    });

    it('should handle non-committing sets (transient state)', () => {
        const { result } = renderHook(() => useUndoRedo({ count: 0 }));
        
        act(() => {
            result.current.setState({ count: 1 }, false); // commit = false
        });
        
        expect(result.current.state).toEqual({ count: 1 });
        expect(result.current.canUndo).toBe(false); // Should not have a past entry
    });

    it('should support explicit snapshots', () => {
        const { result } = renderHook(() => useUndoRedo({ count: 0 }));
        
        act(() => {
            result.current.saveSnapshot();
            result.current.setState({ count: 1 }, false);
        });
        
        expect(result.current.canUndo).toBe(true);
        
        act(() => {
            result.current.undo();
        });
        
        expect(result.current.state).toEqual({ count: 0 });
    });
});

// ---------------------------------------------------------------------------
// fastDeepEqual – large-array branch and key-count branch
// (exercised via setState duplicate-detection logic)
// ---------------------------------------------------------------------------

describe('useUndoRedo – fastDeepEqual branches', () => {
    it('does not add history entry when state has a large array (>50 items) with same reference', () => {
        const largeArray = Array.from({ length: 60 }, (_, i) => i);
        const { result } = renderHook(() => useUndoRedo({ items: largeArray }));

        act(() => {
            // Setting same-reference large array → fastDeepEqual should return true
            result.current.setState({ items: largeArray });
        });

        // Reference equality short-circuits the large-array check → treated as same → no new history
        expect(result.current.canUndo).toBe(false);
    });

    it('adds history entry when state has a large array (>50 items) with different reference', () => {
        const largeArray1 = Array.from({ length: 60 }, (_, i) => i);
        const largeArray2 = Array.from({ length: 60 }, (_, i) => i); // different reference, same values
        const { result } = renderHook(() => useUndoRedo({ items: largeArray1 }));

        act(() => {
            // Different reference for large array → fastDeepEqual returns false → new history entry
            result.current.setState({ items: largeArray2 });
        });

        expect(result.current.canUndo).toBe(true);
    });

    it('detects different key-count objects as not equal', () => {
        const { result } = renderHook(() => useUndoRedo<Record<string, number>>({ a: 1 }));

        act(() => {
            result.current.setState({ a: 1, b: 2 }); // extra key
        });

        expect(result.current.canUndo).toBe(true);
    });

    it('handles redo when future stack is empty', () => {
        const { result } = renderHook(() => useUndoRedo({ count: 0 }));

        act(() => {
            result.current.redo(); // no-op
        });

        expect(result.current.state).toEqual({ count: 0 });
        expect(result.current.canRedo).toBe(false);
    });

    it('handles undo when past stack is empty', () => {
        const { result } = renderHook(() => useUndoRedo({ count: 0 }));

        act(() => {
            result.current.undo(); // no-op
        });

        expect(result.current.state).toEqual({ count: 0 });
        expect(result.current.canUndo).toBe(false);
    });
});
