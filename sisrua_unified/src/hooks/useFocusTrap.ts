import { useEffect, useRef } from "react";

/**
 * Hook para prender o foco dentro de um elemento (Focus Trap).
 * Essencial para acessibilidade em modais.
 */
export function useFocusTrap(isOpen: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const container = containerRef.current;
    if (!container) return;

    // Seleciona todos os elementos focáveis
    const focusableElements = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab") return;

      if (e.shiftKey) {
        // Shift + Tab: se estiver no primeiro, vai para o último
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        // Tab: se estiver no último, vai para o primeiro
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    }

    // Foca o primeiro elemento ao abrir
    // Pequeno delay para garantir que o modal terminou de animar/renderizar
    const timer = setTimeout(() => {
      firstElement?.focus();
    }, 100);

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return containerRef;
}
