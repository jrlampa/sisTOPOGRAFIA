import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSearch } from '../../src/hooks/useSearch';

global.fetch = vi.fn();

describe('useSearch', () => {
  let mockOnLocationFound: ReturnType<typeof vi.fn>;
  let mockOnError: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnLocationFound = vi.fn();
    mockOnError = vi.fn();
    vi.clearAllMocks();
  });

  it('should initialize with empty search query and not-searching state', () => {
    const { result } = renderHook(() =>
      useSearch({
        onLocationFound: mockOnLocationFound,
        onError: mockOnError
      })
    );

    expect(result.current.searchQuery).toBe('');
    expect(result.current.isSearching).toBe(false);
  });

  it('should update search query state', () => {
    const { result } = renderHook(() =>
      useSearch({
        onLocationFound: mockOnLocationFound,
        onError: mockOnError
      })
    );

    act(() => {
      result.current.setSearchQuery('São Paulo');
    });

    expect(result.current.searchQuery).toBe('São Paulo');
  });

  it('should execute search and call onLocationFound on success', async () => {
    const mockLocation = { lat: -23.5505, lng: -46.6333, label: 'São Paulo' };

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockLocation
    });

    const { result } = renderHook(() =>
      useSearch({ onLocationFound: mockOnLocationFound, onError: mockOnError })
    );

    await act(async () => {
      await result.current.executeSearch('São Paulo');
    });

    await waitFor(() => {
      expect(mockOnLocationFound).toHaveBeenCalledWith(mockLocation);
    });
  });

  it('should call onError when API returns not-ok', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ details: 'Location not found' })
    });

    const { result } = renderHook(() =>
      useSearch({ onLocationFound: mockOnLocationFound, onError: mockOnError })
    );

    await act(async () => {
      await result.current.executeSearch('Nowhere');
    });

    expect(mockOnError).toHaveBeenCalledWith('Location not found');
  });

  it('should not trigger fetch with empty query', async () => {
    const { result } = renderHook(() =>
      useSearch({ onLocationFound: mockOnLocationFound, onError: mockOnError })
    );

    await act(async () => {
      await result.current.executeSearch('');
    });

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should call onError when query fails validation (too short)', async () => {
    const { result } = renderHook(() =>
      useSearch({ onLocationFound: mockOnLocationFound, onError: mockOnError })
    );

    await act(async () => {
      await result.current.executeSearch('ab'); // Too short
    });

    // fetch should not have been called — validation stopped it
    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockOnError).toHaveBeenCalled();
  });

  it('should call preventDefault on form submit', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ lat: 0, lng: 0 })
    });

    const { result } = renderHook(() =>
      useSearch({ onLocationFound: mockOnLocationFound, onError: mockOnError })
    );

    const mockEvent = { preventDefault: vi.fn() } as any;

    await act(async () => {
      result.current.setSearchQuery('Query B');
    });

    await act(async () => {
      await result.current.handleSearch(mockEvent);
    });

    expect(mockEvent.preventDefault).toHaveBeenCalled();
  });
});
