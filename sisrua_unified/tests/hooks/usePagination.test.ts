import { renderHook, act } from '@testing-library/react';
import { usePagination } from '@/hooks/usePagination';
import { describe, it, expect } from 'vitest';

describe('usePagination hook', () => {
  const mockItems = Array.from({ length: 25 }, (_, i) => ({ id: i, name: `Item ${i}` }));

  it('initializes correctly with page 1', () => {
    const { result } = renderHook(() => usePagination(mockItems, 10));
    
    expect(result.current.currentPage).toBe(1);
    expect(result.current.items).toHaveLength(10);
    expect(result.current.totalPages).toBe(3);
    expect(result.current.canGoNext).toBe(true);
    expect(result.current.canGoPrevious).toBe(false);
  });

  it('navigates to next and previous pages', () => {
    const { result } = renderHook(() => usePagination(mockItems, 10));
    
    act(() => {
      result.current.nextPage();
    });
    expect(result.current.currentPage).toBe(2);
    expect(result.current.startIndex).toBe(10);
    
    act(() => {
      result.current.previousPage();
    });
    expect(result.current.currentPage).toBe(1);
  });

  it('goes to specific page', () => {
    const { result } = renderHook(() => usePagination(mockItems, 10));
    
    act(() => {
      result.current.goToPage(3);
    });
    expect(result.current.currentPage).toBe(3);
    expect(result.current.items).toHaveLength(5);
  });

  it('clamps page to valid range', () => {
    const { result } = renderHook(() => usePagination(mockItems, 10));
    
    act(() => {
      result.current.goToPage(100);
    });
    expect(result.current.currentPage).toBe(3);

    act(() => {
      result.current.goToPage(-10);
    });
    expect(result.current.currentPage).toBe(1);
  });

  it('handles empty list', () => {
    const { result } = renderHook(() => usePagination([], 10));
    expect(result.current.totalPages).toBe(1);
    expect(result.current.items).toHaveLength(0);
  });
});
