import { useEffect, useMemo, useRef, useState } from "react";
import type {
  AppSettings,
  GeoLocation,
  GlobalState,
  SelectionMode,
} from "../types";
import type { ToastType } from "../components/Toast";
import { clearSessionDraft, loadSessionDraft } from "./useAutoSave";
import { DEFAULT_LOCATION } from "../constants";

interface UseMapStateParams {
  appState: GlobalState;
  setAppState: (
    nextState: GlobalState | ((prev: GlobalState) => GlobalState),
    commit?: boolean,
  ) => void;
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
  const [toast, setToast] = useState<{
    message: string;
    type: ToastType;
  } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [sessionDraft, setSessionDraft] = useState<GlobalState | null>(null);
  const latestAppStateRef = useRef(appState);

  const { polygon, measurePath, selectionMode } = appState;

  useEffect(() => {
    latestAppStateRef.current = appState;
  }, [appState]);

  useEffect(() => {
    const draft = loadSessionDraft();
    if (draft && (draft.state.btTopology?.poles.length ?? 0) > 0) {
      setSessionDraft(draft.state);
    }
  }, []);

  const showToast = (message: string, type: ToastType) => {
    setToast({ message, type });
  };

  const closeToast = () => {
    setToast(null);
  };

  const openSettings = () => {
    setShowSettings(true);
  };

  const closeSettings = () => {
    setShowSettings(false);
  };

  const handleRestoreSession = () => {
    if (!sessionDraft) {
      return;
    }

    setAppState(sessionDraft, false);
    setSessionDraft(null);
    clearSessionDraft();
    showToast("Sessão anterior restaurada.", "success");
  };

  const handleDismissSession = () => {
    setSessionDraft(null);
    clearSessionDraft();
  };

  const updateSettings = (newSettings: AppSettings) => {
    setAppState((prev) => ({ ...prev, settings: newSettings }), true);
  };

  const handleMapClick = (newCenter: GeoLocation) => {
    setAppState((prev) => ({ ...prev, center: newCenter }), true);
    clearData();
  };

  const handleSelectionModeChange = (mode: SelectionMode) => {
    setAppState(
      (prev) => ({
        ...prev,
        selectionMode: mode,
        polygon: [],
        measurePath: [],
      }),
      true,
    );
  };

  const handleMeasurePathChange = async (path: [number, number][]) => {
    const geoPath = path.map((point) => ({ lat: point[0], lng: point[1] }));
    setAppState((prev) => ({ ...prev, measurePath: geoPath }), false);

    if (geoPath.length === 2) {
      await loadElevationProfile(geoPath[0], geoPath[1]);
      return;
    }

    clearProfile();
  };

  const handleRadiusChange = (nextRadius: number) => {
    setAppState((prev) => ({ ...prev, radius: nextRadius }), false);
  };

  const handleClearPolygon = () => {
    setAppState((prev) => ({ ...prev, polygon: [] }), true);
  };

  const handlePolygonChange = (points: [number, number][]) => {
    const geoPoints = points.map((point) => ({ lat: point[0], lng: point[1] }));
    setAppState((prev) => ({ ...prev, polygon: geoPoints }), true);
  };

  // Set center to current geolocation on mount (only when center is the default placeholder)
  useEffect(() => {
    const isDefaultCenter =
      appState.center.lat === DEFAULT_LOCATION.lat &&
      appState.center.lng === DEFAULT_LOCATION.lng;

    if (isDefaultCenter && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setAppState(
            (prev) => ({
              ...prev,
              center: {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                label: "Current Location",
              },
            }),
            false,
          );
        },
        (_err) => {
          // Geolocation permission denied — keep default
        },
      );
    }
    // Only run on mount; appState.center must be captured but not trigger re-runs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isPolygonValid = selectionMode === "polygon" && polygon.length >= 3;

  const polygonPoints = useMemo(
    () => polygon.map((point) => [point.lat, point.lng] as [number, number]),
    [polygon],
  );

  const measurePathPoints = useMemo(
    () =>
      measurePath.map((point) => [point.lat, point.lng] as [number, number]),
    [measurePath],
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
