import { renderHook, act } from '@testing-library/react';
import { useAppOrchestrator } from '@/hooks/useAppOrchestrator';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as syncUtil from '@/utils/synchronizeGlobalTopologyState';

// Mock sync utility
vi.mock('@/utils/synchronizeGlobalTopologyState', () => ({
  synchronizeGlobalTopologyState: vi.fn((s) => ({ ...s, synchronized: true }))
}));

// Mock analytics
vi.mock('@/utils/analytics', () => ({
  trackRework: vi.fn(),
}));

describe('useAppOrchestrator hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes correctly with synchronized initial state', () => {
    const { result } = renderHook(() => useAppOrchestrator());
    
    expect(syncUtil.synchronizeGlobalTopologyState).toHaveBeenCalled();
    expect((result.current.appState as any).synchronized).toBe(true);
    expect(result.current.canUndo).toBe(false);
  });

  it('updates state and pushes to history', () => {
    const { result } = renderHook(() => useAppOrchestrator());
    
    const newState = { ...result.current.appState, value: 42 } as any;
    
    act(() => {
      result.current.setAppState(newState, true, 'Test Update');
    });

    expect(result.current.appState).toEqual(expect.objectContaining({ value: 42 }));
    expect(result.current.canUndo).toBe(true);
    expect(result.current.appPast).toHaveLength(1);
    expect(result.current.appPast[0].label).toBe('Test Update');
  });

  it('updates state without history (commit=false)', () => {
    const { result } = renderHook(() => useAppOrchestrator());
    
    const newState = { ...result.current.appState, value: 42 } as any;
    
    act(() => {
      result.current.setAppState(newState, false);
    });

    expect(result.current.appState).toEqual(expect.objectContaining({ value: 42 }));
    expect(result.current.canUndo).toBe(false);
    expect(result.current.appPast).toHaveLength(0);
  });

  it('handles functional updates', () => {
    const { result } = renderHook(() => useAppOrchestrator());
    
    act(() => {
      result.current.setAppState((prev: any) => ({ ...prev, count: (prev.count || 0) + 1 }));
    });

    expect((result.current.appState as any).count).toBe(1);
  });

  it('executes undo and redo', () => {
    const { result } = renderHook(() => useAppOrchestrator());
    
    act(() => {
      result.current.setAppState({ ...result.current.appState, step: 1 } as any);
    });
    expect((result.current.appState as any).step).toBe(1);

    act(() => {
      result.current.undo();
    });
    expect((result.current.appState as any).step).toBeUndefined();
    expect(result.current.canRedo).toBe(true);

    act(() => {
      result.current.redo();
    });
    expect((result.current.appState as any).step).toBe(1);
  });

  it('deduplicates state changes in history', () => {
    const { result } = renderHook(() => useAppOrchestrator());
    
    const state = { ...result.current.appState };
    
    act(() => {
      result.current.setAppState(state); // Identical state
    });

    expect(result.current.appPast).toHaveLength(0);
  });

  it('saves manual snapshot', () => {
    const { result } = renderHook(() => useAppOrchestrator());
    
    act(() => {
      result.current.saveSnapshot('Manual Backup');
    });

    expect(result.current.appPast).toHaveLength(1);
    expect(result.current.appPast[0].label).toBe('Manual Backup');
  });
});
