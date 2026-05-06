import React from "react";
import { GlobalState } from "../types";
import { useUndoRedo } from "./useUndoRedo";
import { INITIAL_APP_STATE } from "../app/initialState";
import { synchronizeGlobalTopologyState } from "../utils/synchronizeGlobalTopologyState";

export function useAppOrchestrator() {
  const {
    state: appState,
    past: appPast,
    future: appFuture,
    setState: setAppStateBase,
    undo,
    redo,
    canUndo,
    canRedo,
    saveSnapshot,
  } = useUndoRedo<GlobalState>(
    synchronizeGlobalTopologyState(INITIAL_APP_STATE),
  );

  const setAppState = React.useCallback(
    (
      nextState: GlobalState | ((prev: GlobalState) => GlobalState),
      addToHistory = true,
      actionLabel = "Ação",
    ) => {
      setAppStateBase(
        (prev) => {
          const resolvedNext =
            typeof nextState === "function" ? nextState(prev) : nextState;
          return synchronizeGlobalTopologyState(resolvedNext);
        },
        addToHistory,
        actionLabel,
      );
    },
    [setAppStateBase],
  );

  return {
    appState,
    appPast,
    appFuture,
    setAppState,
    undo,
    redo,
    canUndo,
    canRedo,
    saveSnapshot,
  };
}
