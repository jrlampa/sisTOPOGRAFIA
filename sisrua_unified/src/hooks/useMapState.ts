import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AppSettings, GeoLocation, GlobalState, SelectionMode } from '../types';
import type { ToastType } from '../components/Toast';
import { clearSessionDraft, loadSessionDraft } from './useAutoSave';
import { DEFAULT_LOCATION } from '../constants';

interface UseMapStateParams {
  appState: GlobalState;
  setAppState: (nextState: GlobalState, commit?: boolean) => void;
  clearData: () => void;
  loadElevationProfile: (start: GeoLocation, end: GeoLocation) => Promise<void>;
  clearProfile: () => void;
}

export function useMapState({
  appState,
  setAppState,
  clearData,
  loadElevationProfile,
  clearProfile,
}: UseMapStateParams) {
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [sessionDraft, setSessionDraft] = useState<GlobalState | null>(null);
  const appStateRef = useRef(appState);

  const { polygon, measurePath, selectionMode } = appState;

  useEffect(() => {
    appStateRef.current = appState;
  }, [appState]);

  const applyAppState = useCallback(
    (buildNextState: (current: GlobalState) => GlobalState, commit = true) => {
      const nextState = buildNextState(appStateRef.current);
      appStateRef.current = nextState;
      setAppState(nextState, commit);
    },
    [setAppState]
  );

  useEffect(() => {
    const draft = loadSessionDraft();
    if (draft && (draft.state.btTopology?.poles.length ?? 0) > 0) {
      setSessionDraft(draft.state);
    }
  }, []);

  const showToast = useCallback((message: string, type: ToastType) => {
    setToast({ message, type });
  }, []);

  const closeToast = useCallback(() => {
    setToast(null);
  }, []);

  const openSettings = useCallback(() => {
    setShowSettings(true);
  }, []);

  const closeSettings = useCallback(() => {
    setShowSettings(false);
  }, []);

  const handleRestoreSession = useCallback(() => {
    if (!sessionDraft) {
      return;
    }

    setAppState(sessionDraft, false);
    appStateRef.current = sessionDraft;
    setSessionDraft(null);
    clearSessionDraft();
    showToast('Sessão anterior restaurada.', 'success');
  }, [sessionDraft, setAppState, showToast]);

  const handleDismissSession = useCallback(() => {
    setSessionDraft(null);
    clearSessionDraft();
  }, []);

  const updateSettings = useCallback(
    (newSettings: AppSettings) => {
      applyAppState((current) => ({ ...current, settings: newSettings }), true);
    },
    [applyAppState]
  );

  const handleMapClick = useCallback(
    (newCenter: GeoLocation) => {
      applyAppState((current) => ({ ...current, center: newCenter }), true);
      clearData();
    },
    [applyAppState, clearData]
  );

  const handleSelectionModeChange = useCallback(
    (mode: SelectionMode) => {
      applyAppState((current) => ({ ...current, selectionMode: mode, polygon: [], measurePath: [] }), true);
    },
    [applyAppState]
  );

  const handleMeasurePathChange = useCallback(async (path: [number, number][]) => {
    const geoPath = path.map((point) => ({ lat: point[0], lng: point[1] }));
    applyAppState((current) => ({ ...current, measurePath: geoPath }), false);

    if (geoPath.length === 2) {
      await loadElevationProfile(geoPath[0], geoPath[1]);
      return;
    }

    clearProfile();
  }, [applyAppState, clearProfile, loadElevationProfile]);

  const handleRadiusChange = useCallback(
    (nextRadius: number) => {
      applyAppState((current) => ({ ...current, radius: nextRadius }), false);
    },
    [applyAppState]
  );

  const handleClearPolygon = useCallback(() => {
    applyAppState((current) => ({ ...current, polygon: [] }), true);
  }, [applyAppState]);

  const handlePolygonChange = useCallback((points: [number, number][]) => {
    const geoPoints = points.map((point) => ({ lat: point[0], lng: point[1] }));
    applyAppState((current) => ({ ...current, polygon: geoPoints }), true);
  }, [applyAppState]);

  // Set center to current geolocation on mount (only when center is the default placeholder)
  useEffect(() => {
    const currentState = appStateRef.current;
    const isDefaultCenter =
      currentState.center.lat === DEFAULT_LOCATION.lat &&
      currentState.center.lng === DEFAULT_LOCATION.lng;

    if (!isDefaultCenter || !navigator.geolocation) {
      return;
    }

    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (cancelled) {
          return;
        }

        applyAppState(
          (state) => ({
            ...state,
            center: {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              label: 'Local Atual',
            },
          }),
          false
        );
      },
      () => {
        // Geolocation permission denied — keep default
      }
    );

    return () => {
      cancelled = true;
    };
  }, [applyAppState]);

  const isPolygonValid = selectionMode === 'polygon' && polygon.length >= 3;

  const polygonPoints = useMemo(
    () => polygon.map((point) => [point.lat, point.lng] as [number, number]),
    [polygon]
  );

  const measurePathPoints = useMemo(
    () => measurePath.map((point) => [point.lat, point.lng] as [number, number]),
    [measurePath]
  );

  return {
    toast,
    closeToast,
    showToast,
    showSettings,
    openSettings,
    closeSettings,
    sessionDraft,
    handleRestoreSession,
    handleDismissSession,
    updateSettings,
    handleMapClick,
    handleSelectionModeChange,
    handleMeasurePathChange,
    handleRadiusChange,
    handleClearPolygon,
    handlePolygonChange,
    isPolygonValid,
    polygonPoints,
    measurePathPoints,
  };
}