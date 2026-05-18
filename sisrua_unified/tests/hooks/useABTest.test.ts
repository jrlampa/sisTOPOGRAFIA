import { renderHook, act } from '@testing-library/react';
import { useABTest } from '@/hooks/useABTest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import posthog from 'posthog-js';

// Mock posthog
vi.mock('posthog-js', () => ({
  default: {
    __loaded: false,
    getFeatureFlag: vi.fn(),
    onFeatureFlags: vi.fn(),
  }
}));

describe('useABTest hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (posthog as any).__loaded = false;
  });

  it('returns default value when posthog is not loaded', () => {
    const { result } = renderHook(() => useABTest('my-flag', true));
    expect(result.current).toBe(true);
  });

  it('returns flag value when posthog is already loaded', () => {
    (posthog as any).__loaded = true;
    vi.mocked(posthog.getFeatureFlag).mockReturnValue(true);
    
    const { result } = renderHook(() => useABTest('my-flag', false));
    expect(result.current).toBe(true);
  });

  it('updates when posthog flags are loaded', () => {
    // Start NOT loaded
    (posthog as any).__loaded = false;
    
    let callback: any;
    vi.mocked(posthog.onFeatureFlags).mockImplementation((cb) => {
      callback = cb;
    });

    const { result, rerender } = renderHook(() => useABTest('my-flag', false));
    expect(result.current).toBe(false);

    // Simulate load and trigger re-render of the hook to run useEffect again
    (posthog as any).__loaded = true;
    rerender();

    act(() => {
      vi.mocked(posthog.getFeatureFlag).mockReturnValue('test');
      if (callback) callback();
    });

    expect(result.current).toBe(true);
  });
});
