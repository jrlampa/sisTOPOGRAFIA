import React from "react";

export function useFocusTrap(
  elementRef: React.RefObject<HTMLElement>,
  options: { initialFocus?: HTMLElement } = {},
) {
  React.useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const FOCUSABLE_SELECTOR = `
      button,
      [href],
      input,
      select,
      textarea,
      [tabindex]:not([tabindex="-1"])
    `;

    const focusableElements = Array.from(
      element.querySelectorAll(FOCUSABLE_SELECTOR),
    ) as HTMLElement[];

    if (focusableElements.length === 0) return;

    const firstElement = options.initialFocus || focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;

      if (event.shiftKey) {
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    };

    element.addEventListener("keydown", handleKeyDown);
    firstElement.focus();

    return () => {
      element.removeEventListener("keydown", handleKeyDown);
    };
  }, [elementRef, options]);
}
