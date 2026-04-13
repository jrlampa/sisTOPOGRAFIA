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
