import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
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

  it('should initialize with empty search query', () => {
    const { result } = renderHook(() =>
      useSearch({
        onLocationFound: mockOnLocationFound,
        onError: mockOnError
      })
    );

    expect(result.current.searchQuery).toBe('');
    expect(result.current.isSearching).toBe(false);
  });

  it('should update search query', () => {
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

  it('should search successfully', async () => {
    const mockLocation = {
      lat: -23.5505,
      lng: -46.6333,
      label: 'São Paulo'
    };

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockLocation
    });

    const { result } = renderHook(() =>
      useSearch({
        onLocationFound: mockOnLocationFound,
        onError: mockOnError
      })
    );

    act(() => {
      result.current.setSearchQuery('São Paulo');
    });

    await act(async () => {
      await result.current.executeSearch('São Paulo');
    });

    await waitFor(() => {
      expect(mockOnLocationFound).toHaveBeenCalledWith(mockLocation);
    });
  });

  it('should handle search error', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false
    });

    const { result } = renderHook(() =>
      useSearch({
        onLocationFound: mockOnLocationFound,
        onError: mockOnError
      })
    );

    await act(async () => {
      await result.current.executeSearch('Invalid Location');
    });

    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith('Location not found');
    });
  });

  it('should not search with empty query', async () => {
    const { result } = renderHook(() =>
      useSearch({
        onLocationFound: mockOnLocationFound,
        onError: mockOnError
      })
    );

    await act(async () => {
      await result.current.executeSearch('');
    });

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('deve resolver diretamente coordenadas lat/lng sem chamar fetch (linhas 43-46)', async () => {
    // Standard test coordinates: -22.15018, -42.92185
    const { result } = renderHook(() =>
      useSearch({ onLocationFound: mockOnLocationFound, onError: mockOnError })
    );

    await act(async () => {
      await result.current.executeSearch('-22.15018, -42.92185');
    });

    // parseLatLng succeeds → onLocationFound called, fetch NOT called
    expect(mockOnLocationFound).toHaveBeenCalledWith(
      expect.objectContaining({ lat: -22.15018, lng: -42.92185 })
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('deve resolver diretamente coordenadas UTM sem chamar fetch (linhas 48-52)', async () => {
    // Standard UTM test: 23K 714316 7549084 → -22.15018, -42.92185
    const { result } = renderHook(() =>
      useSearch({ onLocationFound: mockOnLocationFound, onError: mockOnError })
    );

    await act(async () => {
      await result.current.executeSearch('23K 714316 7549084');
    });

    // parseUtmQuery succeeds → onLocationFound called, fetch NOT called
    expect(mockOnLocationFound).toHaveBeenCalledWith(
      expect.objectContaining({ lat: expect.any(Number), lng: expect.any(Number) })
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('deve chamar onError quando location retornada é null/falsy (linhas 71-72)', async () => {
    // Mock returns null → throw new Error('No location data received')
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => null
    });

    const { result } = renderHook(() =>
      useSearch({ onLocationFound: mockOnLocationFound, onError: mockOnError })
    );

    await act(async () => {
      await result.current.executeSearch('Endereço Inexistente');
    });

    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith('No location data received');
    });
    expect(mockOnLocationFound).not.toHaveBeenCalled();
  });

  it('deve submeter busca via handleSearch (form submit, linhas 82-84)', async () => {
    const mockLocation = { lat: -22.15018, lng: -42.92185, label: 'Test' };

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockLocation
    });

    const { result } = renderHook(() =>
      useSearch({ onLocationFound: mockOnLocationFound, onError: mockOnError })
    );

    // Set the search query first
    act(() => {
      result.current.setSearchQuery('Nova Friburgo RJ');
    });

    // Submit form via handleSearch
    const mockEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent;
    await act(async () => {
      await result.current.handleSearch(mockEvent);
    });

    expect(mockEvent.preventDefault).toHaveBeenCalled();
    await waitFor(() => {
      expect(mockOnLocationFound).toHaveBeenCalledWith(mockLocation);
    });
  });

  it('deve usar mensagem fallback quando erro não é instância de Error (branch linha 74)', async () => {
    // Throw a non-Error value → branch false: message = 'Search failed'
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce('falha inesperada');

    const { result } = renderHook(() =>
      useSearch({ onLocationFound: mockOnLocationFound, onError: mockOnError })
    );

    await act(async () => {
      await result.current.executeSearch('Consulta qualquer');
    });

    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith('Search failed');
    });
  });
});
