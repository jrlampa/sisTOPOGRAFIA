/**
 * useAutoSave — lightweight session persistence for GlobalState.
 *
 * Debounces writes to localStorage so rapid state changes (e.g. dragging a
 * pole on the map) don't thrash the storage layer. On mount, the app can check
 * for a previous draft and offer the user a "Restore session?" prompt.
 *
 * Key: 'sisrua_session_draft'
 * Format versioned with DRAFT_VERSION so stale / incompatible drafts are
 * silently discarded instead of breaking the app.
 */
import { useEffect, useRef, useCallback, useState } from "react";
import { GlobalState } from "../types";
import { ProjectService } from "../services/projectService";
import { SpatialJurisdictionService } from "../services/spatialJurisdictionService";

const STORAGE_KEY = "sisrua_session_draft";
const DEBOUNCE_MS = 1_500;
const DRAFT_VERSION = 1;

export interface SessionDraft {
  state: GlobalState;
  savedAt: string;
  version: number;
}

export type AutoSaveStatus = "idle" | "saving" | "error";

/**
 * Call this hook in a component that holds GlobalState. It will debounce-write
 * the current state to localStorage whenever `state` changes.
 */
export function useAutoSave(
  state: GlobalState,
  projectIdOrEnabled?: string | boolean,
  enabled = true,
) {
  const projectId =
    typeof projectIdOrEnabled === "string" ? projectIdOrEnabled : undefined;
  const isEnabled =
    typeof projectIdOrEnabled === "boolean" ? projectIdOrEnabled : enabled;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState<AutoSaveStatus>("idle");
  const [lastSaved, setLastSaved] = useState<string | undefined>(undefined);

  const persist = useCallback(async (s: GlobalState) => {
    const timestamp = new Date().toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });

    // Aplicar Filtro de Jurisdição antes de salvar na nuvem
    const filteredTopology = SpatialJurisdictionService.filterTopology(s.btTopology, {
      polygon: s.polygon,
      radius: s.radius,
      center: s.center
    });

    const stateToSave = {
      ...s,
      btTopology: filteredTopology,
      osmData: null,
      terrainData: null,
      btExportHistory: [], 
      autoSaveStatus: "idle",
    };

    const draft: SessionDraft = {
      state: stateToSave as GlobalState,
      savedAt: new Date().toISOString(),
      version: DRAFT_VERSION,
    };

    try {
      // 1. Local (Buffer)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));

      // 2. Cloud (Se houver projetoId)
      if (projectId) {
        await ProjectService.saveProjectState(projectId, stateToSave as GlobalState);
      }

      setLastSaved(timestamp);
      setStatus("idle");
    } catch (_error) {
      console.error("[AutoSave] Falha na persistência", _error);
      setStatus("error");
    }
  }, [projectId]);

  useEffect(() => {
    if (!isEnabled) return;

    setStatus("saving");
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => persist(state), DEBOUNCE_MS);

    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, [state, isEnabled, persist]);

  return { status, lastSaved };
}

/**
 * Read a previously saved draft from localStorage.
 * Returns null if nothing is stored or the stored data is incompatible.
 */
export function loadSessionDraft(): SessionDraft | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      (parsed as SessionDraft).version !== DRAFT_VERSION ||
      typeof (parsed as SessionDraft).state !== "object"
    ) {
      return null;
    }

    return parsed as SessionDraft;
  } catch {
    return null;
  }
}

/** Remove the saved draft from localStorage. */
export function clearSessionDraft(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
