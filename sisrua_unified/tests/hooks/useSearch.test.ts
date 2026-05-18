import { renderHook, act } from '@testing-library/react';
import { useSearch } from '@/hooks/useSearch';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('useSearch hook', () => {
  const mockOnLocationFound = vi.fn();
  const mockOnError = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    // Mock global fetch
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('triggers auto-search after debounce', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ lat: 10, lng: 20 })
    } as any);

    const { result } = renderHook(() => useSearch({
      onLocationFound: mockOnLocationFound,
      onError: mockOnError
    }));

    act(() => {
      result.current.setSearchQuery('-23.5505, -46.6333'); // Coordinates trigger auto-search
    });

    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(fetch).toHaveBeenCalled();
    // Use act to wait for the microtasks (fetch resolving)
    await act(async () => {}); 
    expect(mockOnLocationFound).toHaveBeenCalledWith({ lat: 10, lng: 20 });
  });

  it('handles search error from API', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Not Found' })
    } as any);

    const { result } = renderHook(() => useSearch({
      onLocationFound: mockOnLocationFound,
      onError: mockOnError
    }));

    await act(async () => {
      await result.current.executeSearch('Invalid Place');
    });

    expect(mockOnError).toHaveBeenCalledWith('Not Found');
  });

  it('prevents search for short queries', () => {
    renderHook(() => useSearch({
      onLocationFound: mockOnLocationFound,
      onError: mockOnError
    }));

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(fetch).not.toHaveBeenCalled();
  });
});
