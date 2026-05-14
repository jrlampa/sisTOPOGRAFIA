import { renderHook, act } from '@testing-library/react';
import { useAppMainHandlers } from '@/hooks/useAppMainHandlers';
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('useAppMainHandlers hook', () => {
  const mockSetAppState = vi.fn();
  const mockSetSelectedPoleIds = vi.fn();
  const mockSetSelectedPoleId = vi.fn();
  const mockSetIsCommandPaletteOpen = vi.fn();
  
  const mockParams = {
    setAppState: mockSetAppState,
    btTopology: { poles: [{ id: 'p1', lat: 10, lng: 10 }] },
    setSelectedPoleIds: mockSetSelectedPoleIds,
    setSelectedPoleId: mockSetSelectedPoleId,
    setIsCommandPaletteOpen: mockSetIsCommandPaletteOpen,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates editor mode correctly', () => {
    const { result } = renderHook(() => useAppMainHandlers(mockParams));
    
    act(() => {
      result.current.setBtEditorMode('add-pole');
    });

    expect(mockSetAppState).toHaveBeenCalledWith(expect.any(Function), true, expect.stringContaining('add-pole'));
  });

  it('handles box selection correctly', () => {
    const { result } = renderHook(() => useAppMainHandlers(mockParams));
    
    const mockBounds = {
        contains: vi.fn(() => true)
    } as any;

    act(() => {
      result.current.handleBoxSelect(mockBounds);
    });

    expect(mockSetSelectedPoleIds).toHaveBeenCalledWith(['p1']);
    expect(mockSetSelectedPoleId).toHaveBeenCalledWith('p1');
  });

  it('toggles command palette on Ctrl+K', () => {
    renderHook(() => useAppMainHandlers(mockParams));
    
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
    
    expect(mockSetIsCommandPaletteOpen).toHaveBeenCalled();
  });
});
