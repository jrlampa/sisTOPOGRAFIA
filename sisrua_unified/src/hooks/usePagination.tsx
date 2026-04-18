/**
 * Hook para gerenciar paginação de listas
 * Item 23: Implementar paginação em histórico BT
 *
 * Uso:
 * const pagination = usePagination(btExportHistory, 10); // 10 itens por página
 *
 * pagination.items - itens da página atual
 * pagination.currentPage - página atual (1-indexed)
 * pagination.totalPages - total de páginas
 * pagination.goToPage(page) - ir para página específica
 * pagination.nextPage() - próxima página
 * pagination.previousPage() - página anterior
 * pagination.canGoNext - pode ir próxima?
 * pagination.canGoPrevious - pode ir anterior?
 */

import { useState, useMemo } from "react";

export interface PaginationState<T> {
  items: T[];
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  startIndex: number;
  endIndex: number;
  goToPage: (page: number) => void;
  nextPage: () => void;
  previousPage: () => void;
  canGoNext: boolean;
  canGoPrevious: boolean;
}

/**
 * Hook React para paginação
 */
// eslint-disable-next-line react-refresh/only-export-components -- PaginationState type is co-located with this hook
export function usePagination<T>(
  items: T[],
  itemsPerPage: number = 10,
): PaginationState<T> {
  const [currentPage, setCurrentPage] = useState(1);

  // Calcular valores de paginação
  const paginationData = useMemo(() => {
    const totalPages = Math.ceil(items.length / itemsPerPage);
    const validPage = Math.max(1, Math.min(currentPage, totalPages));
    const startIndex = (validPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageItems = items.slice(startIndex, endIndex);

    return {
      items: pageItems,
      currentPage: validPage,
      totalPages: totalPages || 1,
      totalItems: items.length,
      itemsPerPage,
      startIndex,
      endIndex,
    };
  }, [items, itemsPerPage, currentPage]);

  // Funções de navegação
  const goToPage = (page: number) => {
    const validPage = Math.max(1, Math.min(page, paginationData.totalPages));
    setCurrentPage(validPage);
  };

  const nextPage = () => {
    if (paginationData.currentPage < paginationData.totalPages) {
      setCurrentPage(paginationData.currentPage + 1);
    }
  };

  const previousPage = () => {
    if (paginationData.currentPage > 1) {
      setCurrentPage(paginationData.currentPage - 1);
    }
  };

  const canGoNext = paginationData.currentPage < paginationData.totalPages;
  const canGoPrevious = paginationData.currentPage > 1;

  return {
    ...paginationData,
    goToPage,
    nextPage,
    previousPage,
    canGoNext,
    canGoPrevious,
  };
}

/**
 * Componente de controles de paginação
 * Reutilizável em qualquer lugar
 */
interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  onPreviousPage: () => void;
  onNextPage: () => void;
  onGoToPage: (page: number) => void;
  className?: string;
}

export function PaginationControls({
  currentPage,
  totalPages,
  totalItems,
  onPreviousPage,
  onNextPage,
  onGoToPage: _onGoToPage,
  className = "",
}: PaginationControlsProps) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div
      className={`flex items-center justify-center gap-2 mt-3 px-2 py-1.5 ${className}`}
    >
      {/* Botão anterior */}
      <button
        onClick={onPreviousPage}
        disabled={currentPage === 1}
        className="px-2 py-1 text-[9px] uppercase font-bold border border-current rounded transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:enabled:bg-current/10"
        aria-label="Página anterior"
      >
        ← Anterior
      </button>

      {/* Indicador de página */}
      <span className="text-[10px] font-mono px-2 whitespace-nowrap">
        Página {currentPage}/{totalPages}
      </span>

      {/* Botão próximo */}
      <button
        onClick={onNextPage}
        disabled={currentPage === totalPages}
        className="px-2 py-1 text-[9px] uppercase font-bold border border-current rounded transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:enabled:bg-current/10"
        aria-label="Próxima página"
      >
        Próximo →
      </button>

      {/* Info de total */}
      <span className="text-[9px] text-current/60 ml-1">
        ({totalItems} itens)
      </span>
    </div>
  );
}
