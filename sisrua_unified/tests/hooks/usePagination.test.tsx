import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePagination, PaginationControls } from "../../src/hooks/usePagination";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

// ---------------------------------------------------------------------------
// usePagination
// ---------------------------------------------------------------------------

describe("usePagination", () => {
  const items = Array.from({ length: 25 }, (_, i) => `item-${i + 1}`);

  it("starts on page 1", () => {
    const { result } = renderHook(() => usePagination(items, 10));
    expect(result.current.currentPage).toBe(1);
  });

  it("returns the correct items for the first page", () => {
    const { result } = renderHook(() => usePagination(items, 10));
    expect(result.current.items).toHaveLength(10);
    expect(result.current.items[0]).toBe("item-1");
    expect(result.current.items[9]).toBe("item-10");
  });

  it("calculates totalPages correctly", () => {
    const { result } = renderHook(() => usePagination(items, 10));
    expect(result.current.totalPages).toBe(3);
  });

  it("reports totalItems", () => {
    const { result } = renderHook(() => usePagination(items, 10));
    expect(result.current.totalItems).toBe(25);
  });

  it("reports itemsPerPage", () => {
    const { result } = renderHook(() => usePagination(items, 10));
    expect(result.current.itemsPerPage).toBe(10);
  });

  it("reports startIndex and endIndex for page 1", () => {
    const { result } = renderHook(() => usePagination(items, 10));
    expect(result.current.startIndex).toBe(0);
    expect(result.current.endIndex).toBe(10);
  });

  it("canGoNext is true when not on last page", () => {
    const { result } = renderHook(() => usePagination(items, 10));
    expect(result.current.canGoNext).toBe(true);
  });

  it("canGoPrevious is false on first page", () => {
    const { result } = renderHook(() => usePagination(items, 10));
    expect(result.current.canGoPrevious).toBe(false);
  });

  it("nextPage navigates to the next page", () => {
    const { result } = renderHook(() => usePagination(items, 10));
    act(() => {
      result.current.nextPage();
    });
    expect(result.current.currentPage).toBe(2);
    expect(result.current.items[0]).toBe("item-11");
  });

  it("previousPage navigates back to the previous page", () => {
    const { result } = renderHook(() => usePagination(items, 10));
    act(() => {
      result.current.nextPage();
    });
    act(() => {
      result.current.previousPage();
    });
    expect(result.current.currentPage).toBe(1);
  });

  it("goToPage navigates to the specified page", () => {
    const { result } = renderHook(() => usePagination(items, 10));
    act(() => {
      result.current.goToPage(3);
    });
    expect(result.current.currentPage).toBe(3);
    // Last page has 5 items (25 - 20)
    expect(result.current.items).toHaveLength(5);
    expect(result.current.items[0]).toBe("item-21");
  });

  it("goToPage clamps to totalPages when page exceeds it", () => {
    const { result } = renderHook(() => usePagination(items, 10));
    act(() => {
      result.current.goToPage(100);
    });
    expect(result.current.currentPage).toBe(3);
  });

  it("goToPage clamps to 1 when page is below 1", () => {
    const { result } = renderHook(() => usePagination(items, 10));
    act(() => {
      result.current.goToPage(-5);
    });
    expect(result.current.currentPage).toBe(1);
  });

  it("nextPage does nothing when already on last page", () => {
    const { result } = renderHook(() => usePagination(items, 10));
    act(() => {
      result.current.goToPage(3);
    });
    act(() => {
      result.current.nextPage();
    });
    expect(result.current.currentPage).toBe(3);
  });

  it("previousPage does nothing when already on first page", () => {
    const { result } = renderHook(() => usePagination(items, 10));
    act(() => {
      result.current.previousPage();
    });
    expect(result.current.currentPage).toBe(1);
  });

  it("canGoNext is false on last page", () => {
    const { result } = renderHook(() => usePagination(items, 10));
    act(() => {
      result.current.goToPage(3);
    });
    expect(result.current.canGoNext).toBe(false);
  });

  it("canGoPrevious is true when not on first page", () => {
    const { result } = renderHook(() => usePagination(items, 10));
    act(() => {
      result.current.nextPage();
    });
    expect(result.current.canGoPrevious).toBe(true);
  });

  it("handles an empty item list gracefully", () => {
    const { result } = renderHook(() => usePagination([], 10));
    expect(result.current.totalPages).toBe(1);
    expect(result.current.items).toHaveLength(0);
    expect(result.current.canGoNext).toBe(false);
    expect(result.current.canGoPrevious).toBe(false);
  });

  it("defaults to 10 itemsPerPage when not specified", () => {
    const manyItems = Array.from({ length: 15 }, (_, i) => i);
    const { result } = renderHook(() => usePagination(manyItems));
    expect(result.current.itemsPerPage).toBe(10);
    expect(result.current.totalPages).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// PaginationControls
// ---------------------------------------------------------------------------

describe("PaginationControls", () => {
  it("renders nothing when totalPages is 1", () => {
    const { container } = render(
      React.createElement(PaginationControls, {
        currentPage: 1,
        totalPages: 1,
        totalItems: 5,
        onPreviousPage: () => {},
        onNextPage: () => {},
        onGoToPage: () => {},
      })
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders navigation buttons when totalPages > 1", () => {
    render(
      React.createElement(PaginationControls, {
        currentPage: 1,
        totalPages: 3,
        totalItems: 25,
        onPreviousPage: () => {},
        onNextPage: () => {},
        onGoToPage: () => {},
      })
    );
    expect(screen.getByLabelText("Página anterior")).toBeInTheDocument();
    expect(screen.getByLabelText("Próxima página")).toBeInTheDocument();
  });

  it("disables the previous button on the first page", () => {
    render(
      React.createElement(PaginationControls, {
        currentPage: 1,
        totalPages: 3,
        totalItems: 25,
        onPreviousPage: () => {},
        onNextPage: () => {},
        onGoToPage: () => {},
      })
    );
    const prevBtn = screen.getByLabelText("Página anterior");
    expect(prevBtn).toBeDisabled();
  });

  it("disables the next button on the last page", () => {
    render(
      React.createElement(PaginationControls, {
        currentPage: 3,
        totalPages: 3,
        totalItems: 25,
        onPreviousPage: () => {},
        onNextPage: () => {},
        onGoToPage: () => {},
      })
    );
    const nextBtn = screen.getByLabelText("Próxima página");
    expect(nextBtn).toBeDisabled();
  });

  it("calls onPreviousPage when previous button is clicked", () => {
    const onPrev = vi.fn();
    render(
      React.createElement(PaginationControls, {
        currentPage: 2,
        totalPages: 3,
        totalItems: 25,
        onPreviousPage: onPrev,
        onNextPage: () => {},
        onGoToPage: () => {},
      })
    );
    fireEvent.click(screen.getByLabelText("Página anterior"));
    expect(onPrev).toHaveBeenCalledTimes(1);
  });

  it("calls onNextPage when next button is clicked", () => {
    const onNext = vi.fn();
    render(
      React.createElement(PaginationControls, {
        currentPage: 1,
        totalPages: 3,
        totalItems: 25,
        onPreviousPage: () => {},
        onNextPage: onNext,
        onGoToPage: () => {},
      })
    );
    fireEvent.click(screen.getByLabelText("Próxima página"));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("displays the current page and total pages", () => {
    render(
      React.createElement(PaginationControls, {
        currentPage: 2,
        totalPages: 5,
        totalItems: 50,
        onPreviousPage: () => {},
        onNextPage: () => {},
        onGoToPage: () => {},
      })
    );
    expect(screen.getByText(/Página 2\/5/)).toBeInTheDocument();
  });

  it("displays the total item count", () => {
    render(
      React.createElement(PaginationControls, {
        currentPage: 1,
        totalPages: 3,
        totalItems: 25,
        onPreviousPage: () => {},
        onNextPage: () => {},
        onGoToPage: () => {},
      })
    );
    expect(screen.getByText(/25 itens/)).toBeInTheDocument();
  });
});
