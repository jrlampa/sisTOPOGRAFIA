/**
 * Utility debounce function for React hooks.
 * Delays callback execution until specified timeout without new invocations.
 */
export function debounce<T extends (...args: any[]) => any>(
  callback: T,
  timeout: number
): (...args: Parameters<T>) => void {
  let timerId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timerId) clearTimeout(timerId);
    timerId = setTimeout(() => {
      callback(...args);
      timerId = null;
    }, timeout);
  };
}

/**
 * Hook version of debounce for React components.
 * Memoizes the debounced function to maintain reference stability.
 */
import { useMemo } from 'react';

export function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  timeout: number
): (...args: Parameters<T>) => void {
  return useMemo(() => debounce(callback, timeout), [callback, timeout]);
}
