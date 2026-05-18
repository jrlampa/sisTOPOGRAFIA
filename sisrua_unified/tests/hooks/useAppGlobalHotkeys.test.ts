import { renderHook } from '@testing-library/react';
import { useAppGlobalHotkeys } from '@/hooks/useAppGlobalHotkeys';
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('useAppGlobalHotkeys hook', () => {
  const setIsFocusModeManual = vi.fn();
  const setIsXRayMode = vi.fn();
  const onThemeChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const fireKey = (type: 'keydown' | 'keyup', key: string, options = {}) => {
    window.dispatchEvent(new KeyboardEvent(type, { key, ...options }));
  };

  it('toggles focus mode on Ctrl+F', () => {
    renderHook(() => useAppGlobalHotkeys(
      setIsFocusModeManual,
      setIsXRayMode,
      'light',
      onThemeChange
    ));

    fireKey('keydown', 'f', { ctrlKey: true });
    expect(setIsFocusModeManual).toHaveBeenCalled();
  });

  it('changes theme on Alt+S', () => {
    renderHook(() => useAppGlobalHotkeys(
      setIsFocusModeManual,
      setIsXRayMode,
      'light',
      onThemeChange
    ));

    fireKey('keydown', 's', { altKey: true });
    expect(onThemeChange).toHaveBeenCalledWith('sunlight');
  });

  it('sets x-ray mode on key down/up for X and Shift', () => {
    renderHook(() => useAppGlobalHotkeys(
      setIsFocusModeManual,
      setIsXRayMode,
      'light',
      onThemeChange
    ));

    // Shift
    fireKey('keydown', 'Shift');
    expect(setIsXRayMode).toHaveBeenCalledWith(true);
    fireKey('keyup', 'Shift');
    expect(setIsXRayMode).toHaveBeenCalledWith(false);

    // X
    fireKey('keydown', 'x');
    expect(setIsXRayMode).toHaveBeenCalledWith(true);
    fireKey('keyup', 'x');
    expect(setIsXRayMode).toHaveBeenCalledWith(false);
  });
});
