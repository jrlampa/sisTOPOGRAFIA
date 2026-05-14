import { renderHook } from '@testing-library/react';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('useKeyboardShortcuts hook', () => {
  const mockHandlers = {
    onCancel: vi.fn(),
    onSetEditorMode: vi.fn(),
    onSetSelectionMode: vi.fn(),
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    onToggleHelp: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const fireKey = (key: string, options = {}) => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, ...options }));
  };

  it('triggers onCancel on Escape', () => {
    renderHook(() => useKeyboardShortcuts(mockHandlers));
    fireKey('Escape');
    expect(mockHandlers.onCancel).toHaveBeenCalled();
  });

  it('triggers onSetEditorMode on mode keys', () => {
    renderHook(() => useKeyboardShortcuts(mockHandlers));
    
    fireKey('p');
    expect(mockHandlers.onSetEditorMode).toHaveBeenCalledWith('add-pole');
    
    fireKey('t');
    expect(mockHandlers.onSetEditorMode).toHaveBeenCalledWith('add-transformer');
    
    fireKey('e');
    expect(mockHandlers.onSetEditorMode).toHaveBeenCalledWith('add-edge');
    
    fireKey('v');
    expect(mockHandlers.onSetEditorMode).toHaveBeenCalledWith('move-pole');
    
    fireKey('n');
    expect(mockHandlers.onSetEditorMode).toHaveBeenCalledWith('none');
  });

  it('triggers onSetSelectionMode on selection keys', () => {
    renderHook(() => useKeyboardShortcuts(mockHandlers));
    
    fireKey('m');
    expect(mockHandlers.onSetSelectionMode).toHaveBeenCalledWith('measure');
    
    fireKey('c');
    expect(mockHandlers.onSetSelectionMode).toHaveBeenCalledWith('circle');
    
    fireKey('l');
    expect(mockHandlers.onSetSelectionMode).toHaveBeenCalledWith('polygon');
  });

  it('triggers undo/redo on Ctrl+Z and Ctrl+Shift+Z', () => {
    renderHook(() => useKeyboardShortcuts(mockHandlers));
    
    fireKey('z', { ctrlKey: true });
    expect(mockHandlers.onUndo).toHaveBeenCalled();
    
    fireKey('z', { ctrlKey: true, shiftKey: true });
    expect(mockHandlers.onRedo).toHaveBeenCalled();

    fireKey('y', { ctrlKey: true });
    expect(mockHandlers.onRedo).toHaveBeenCalledTimes(2);
  });

  it('triggers onToggleHelp on help keys', () => {
    renderHook(() => useKeyboardShortcuts(mockHandlers));
    
    fireKey('?');
    expect(mockHandlers.onToggleHelp).toHaveBeenCalled();
  });

  it('ignores keys when typing in input fields', () => {
    renderHook(() => useKeyboardShortcuts(mockHandlers));
    
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', bubbles: true }));
    
    expect(mockHandlers.onSetEditorMode).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });

  it('respects enabled prop', () => {
    renderHook(() => useKeyboardShortcuts({ ...mockHandlers, enabled: false }));
    fireKey('Escape');
    expect(mockHandlers.onCancel).not.toHaveBeenCalled();
  });
});
