import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { ToastProvider, useToast } from '@/hooks/useToast';
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('ToastContext (via useToast hook)', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ToastProvider>{children}</ToastProvider>
  );

  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('adds a toast correctly', () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    
    act(() => {
      result.current.addToast({ message: 'Test toast', type: 'success' });
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].message).toBe('Test toast');
  });

  it('removes a toast manually', () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    
    let id: string = '';
    act(() => {
      id = result.current.addToast({ message: 'Remove me', type: 'info' });
    });

    act(() => {
      result.current.removeToast(id);
    });

    expect(result.current.toasts).toHaveLength(0);
  });

  it('auto-closes toast after timeout', () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    
    act(() => {
      result.current.addToast({ message: 'Self-destruct', type: 'warning', autoClose: 1000 });
    });

    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(1100);
    });

    expect(result.current.toasts).toHaveLength(0);
  });

  it('throws error when used outside provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useToast())).toThrow(/useToast must be used within/);
  });
});
