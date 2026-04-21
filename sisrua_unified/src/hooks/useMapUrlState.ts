/**
 * useMapUrlState.ts — Sincroniza o estado do mapa (centro, raio, modo)
 * com os query params da URL para compartilhamento e deep-linking.
 *
 * Params usados:
 *   lat    — latitude do centro (float)
 *   lng    — longitude do centro (float)
 *   r      — raio em metros (inteiro, 10–50000)
 *   mode   — modo de seleção: "circle" | "polygon" | "measure"
 *
 * Exemplo: /app?lat=-23.5505&lng=-46.6333&r=1000&mode=circle
 */
import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import type { GeoLocation, GlobalState, SelectionMode } from "../types";

interface UseMapUrlStateParams {
  appState: GlobalState;
  setAppState: (nextState: GlobalState, commit?: boolean) => void;
}

const VALID_MODES: SelectionMode[] = ["circle", "polygon", "measure"];

function parseOptionalFloat(value: string | null): number | null {
  if (!value) return null;
  const n = parseFloat(value);
  return isFinite(n) ? n : null;
}

function parseOptionalInt(
  value: string | null,
  min: number,
  max: number,
): number | null {
  if (!value) return null;
  const n = parseInt(value, 10);
  return isFinite(n) && n >= min && n <= max ? n : null;
}

/**
 * Lê os query params da URL e aplica ao appState uma única vez na montagem.
 * Também mantém os params sincronizados ao estado (replace, sem criar entrada no histórico).
 */
export function useMapUrlState({
  appState,
  setAppState,
}: UseMapUrlStateParams): void {
  const [searchParams, setSearchParams] = useSearchParams();
  const appliedFromUrlRef = useRef(false);

  // ─── Leitura inicial da URL → estado ──────────────────────────────────────
  useEffect(() => {
    if (appliedFromUrlRef.current) return;
    appliedFromUrlRef.current = true;

    const lat = parseOptionalFloat(searchParams.get("lat"));
    const lng = parseOptionalFloat(searchParams.get("lng"));
    const radius = parseOptionalInt(searchParams.get("r"), 10, 50000);
    const rawMode = searchParams.get("mode");
    const selectionMode: SelectionMode | null =
      rawMode && (VALID_MODES as string[]).includes(rawMode)
        ? (rawMode as SelectionMode)
        : null;

    const hasUrlParams =
      lat !== null || lng !== null || radius !== null || selectionMode !== null;
    if (!hasUrlParams) return;

    const nextCenter: GeoLocation =
      lat !== null && lng !== null
        ? { lat, lng, label: appState.center.label }
        : appState.center;

    setAppState(
      {
        ...appState,
        center: nextCenter,
        radius: radius ?? appState.radius,
        selectionMode: selectionMode ?? appState.selectionMode,
      },
      false, // sem commit no histórico de undo
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intencionalmente vazio: só executa na montagem

  // ─── Estado → URL (replace, sem criar histórico no browser) ─────────────
  useEffect(() => {
    const { center, radius, selectionMode } = appState;
    const next = new URLSearchParams();

    next.set("lat", center.lat.toFixed(6));
    next.set("lng", center.lng.toFixed(6));
    next.set("r", String(radius));
    next.set("mode", selectionMode);

    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    appState.center.lat,
    appState.center.lng,
    appState.radius,
    appState.selectionMode,
  ]);
}
