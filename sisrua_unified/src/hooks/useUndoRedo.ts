import { useState, useCallback } from 'react';
import { assertImmutable } from '../utils/immutability';
import { trackRework } from '../utils/analytics';

export interface HistoryEntry<T> {
  state: T;
  label: string;
}

export interface HistoryState<T> {
  past: HistoryEntry<T>[];
  present: T;
  future: HistoryEntry<T>[];
}

/**
 * High-performance deep equality check optimized for large state objects.
 * Prioritizes reference checks and avoids deep traversal of massive arrays.
 */
function fastDeepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    // Optimization: For large arrays (topology), we rely on reference equality
    if (a.length > 50) return a === b; 
    for (let i = 0; i < a.length; i++) {
      if (!fastDeepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (!fastDeepEqual(a[key], b[key])) return false;
  }
  return true;
}

export function useUndoRedo<T>(initialPresent: T) {
  const [state, setState] = useState<HistoryState<T>>({
    past: [],
    present: initialPresent,
    future: []
  });

  const canUndo = state.past.length > 0;
  const canRedo = state.future.length > 0;

  const undo = useCallback(() => {
    setState(currentState => {
      const { past, present, future } = currentState;
      if (past.length === 0) return currentState;

      const previous = past[past.length - 1];
      const newPast = past.slice(0, past.length - 1);

      // UX-20: Track Rework
      trackRework('undo', previous.label);

      return {
        past: newPast,
        present: previous.state,
        future: [{ state: present, label: previous.label }, ...future]
      };
    });
  }, []);

  const redo = useCallback(() => {
    setState(currentState => {
      const { past, present, future } = currentState;
      if (future.length === 0) return currentState;

      const next = future[0];
      const newFuture = future.slice(1);

      // UX-20: Track Rework
      trackRework('redo', next.label);

      return {
        past: [...past, { state: present, label: next.label }],
        present: next.state,
        future: newFuture
      };
    });
  }, []);

  const set = useCallback((
    newPresent: T | ((prev: T) => T), 
    commit: boolean = true, 
    actionLabel: string = 'Ação'
  ) => {
    setState(currentState => {
      const resolvedNewPresent = typeof newPresent === 'function' 
        ? (newPresent as (prev: T) => T)(currentState.present)
        : newPresent;

      // Verify immutability of new state (development mode only)
      assertImmutable(resolvedNewPresent, 'appState in useUndoRedo.set()');

      if (commit) {
        // High-performance deduplication
        if (fastDeepEqual(currentState.present, resolvedNewPresent)) {
            return currentState;
        }
        return {
          past: [...currentState.past, { state: currentState.present, label: actionLabel }],
          present: resolvedNewPresent,
          future: []
        };
      } else {
        return {
          ...currentState,
          present: resolvedNewPresent
        };
      }
    });
  }, []);

  const saveSnapshot = useCallback((actionLabel: string = 'Ação') => {
     setState(currentState => {
         return {
             ...currentState,
             past: [...currentState.past, { state: currentState.present, label: actionLabel }],
             future: []
         };
     });
  }, []);

  return {
    state: state.present,
    past: state.past,
    future: state.future,
    setState: set,
    undo,
    redo,
    canUndo,
    canRedo,
    saveSnapshot
  };
}
