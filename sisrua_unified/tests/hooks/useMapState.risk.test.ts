import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { GlobalState, GeoLocation } from '../../src/types';
import { useMapState } from '../../src/hooks/useMapState';
import { DEFAULT_LOCATION } from '../../src/constants';

vi.mock('../../src/hooks/useAutoSave', () => ({
  loadSessionDraft: vi.fn(),
  clearSessionDraft: vi.fn(),
}));

import { loadSessionDraft, clearSessionDraft } from '../../src/hooks/useAutoSave';

const baseState: GlobalState = {
  center: { lat: -22.95, lng: -43.2, label: 'Teste' },
  radius: 500,
  selectionMode: 'circle',
  polygon: [],
  measurePath: [],
  settings: {
    enableAI: true,
    simplificationLevel: 'low',
    orthogonalize: true,
    contourRenderMode: 'all',
    projection: 'local',
    theme: 'dark',
    mapProvider: 'vector',
    contourInterval: 5,
    locale: 'pt-BR',
    layers: {
      buildings: true, roads: true, curbs: true, nature: true, terrain: true,
      contours: false, slopeAnalysis: false, furniture: true, labels: true,
      dimensions: false, grid: false,
    },
    projectMetadata: {
      projectName: 'TESTE', companyName: 'EMPRESA', engineerName: 'ENG',
      date: '2026-04-09', scale: 'N/A', revision: 'R00',
    },
  },
  btTopology: {
    poles: [{ id: 'P1', lat: -22.95, lng: -43.2, title: 'P1', verified: false, ramais: [] }],
    transformers: [],
    edges: [],
  },
};

describe('useMapState critical flows', () => {
  const setAppState = vi.fn().mockImplementation((fn) => {
    if (typeof fn === 'function') {
      fn(baseState);
    }
  });
  const clearData = vi.fn();
  const loadElevationProfile = vi.fn().mockResolvedValue(undefined);
  const clearProfile = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadSessionDraft).mockReturnValue(null);
  });

  it('restores session draft and emits success toast', async () => {
    const draft = { state: baseState, savedAt: '2026-04-09T00:00:00.000Z', version: 1 };
    vi.mocked(loadSessionDraft).mockReturnValue(draft);

    const { result } = renderHook(() =>
      useMapState({ appState: baseState, setAppState, clearData, loadElevationProfile, clearProfile })
    );

    await waitFor(() => {
      expect(result.current.sessionDraft).toEqual(baseState);
    });

    act(() => {
      result.current.handleRestoreSession();
    });

    expect(setAppState).toHaveBeenCalled();
    expect(clearSessionDraft).toHaveBeenCalledTimes(1);
    expect(result.current.toast?.message).toContain('Sessão anterior restaurada');
  });

  it('does nothing if handleRestoreSession is called without draft', () => {
    const { result } = renderHook(() =>
      useMapState({ appState: baseState, setAppState, clearData, loadElevationProfile, clearProfile })
    );

    act(() => {
      result.current.handleRestoreSession();
    });

    expect(setAppState).not.toHaveBeenCalled();
  });

  it('handles session dismissal', () => {
    const draft = { state: baseState, savedAt: '2026-04-09T00:00:00.000Z', version: 1 };
    vi.mocked(loadSessionDraft).mockReturnValue(draft);

    const { result } = renderHook(() =>
      useMapState({ appState: baseState, setAppState, clearData, loadElevationProfile, clearProfile })
    );

    act(() => {
      result.current.handleDismissSession();
    });

    expect(result.current.sessionDraft).toBeNull();
    expect(clearSessionDraft).toHaveBeenCalled();
  });

  it('loads elevation profile only when measure path has two points', async () => {
    const { result } = renderHook(() =>
      useMapState({ appState: baseState, setAppState, clearData, loadElevationProfile, clearProfile })
    );

    await act(async () => {
      await result.current.handleMeasurePathChange([
        [-22.95, -43.2],
        [-22.96, -43.21],
      ]);
    });

    expect(loadElevationProfile).toHaveBeenCalledWith(
      { lat: -22.95, lng: -43.2 },
      { lat: -22.96, lng: -43.21 }
    );
    expect(clearProfile).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.handleMeasurePathChange([[-22.95, -43.2]]);
    });

    expect(clearProfile).toHaveBeenCalledTimes(1);
  });

  it('manages toasts and limits to max 3', () => {
    const { result } = renderHook(() =>
      useMapState({ appState: baseState, setAppState, clearData, loadElevationProfile, clearProfile })
    );

    act(() => {
      result.current.showToast('T1', 'info');
      result.current.showToast('T2', 'info');
      result.current.showToast('T3', 'info');
      result.current.showToast('T4', 'info');
    });

    expect(result.current.toasts.length).toBe(3);
    expect(result.current.toasts[0].message).toBe('T2');
    expect(result.current.toasts[2].message).toBe('T4');

    const toastId = result.current.toasts[0].id;
    act(() => {
      result.current.closeToast(toastId);
    });
    expect(result.current.toasts.length).toBe(2);
    expect(result.current.toasts[0].message).toBe('T3');

    act(() => {
      result.current.closeToast(); // Close all
    });
    expect(result.current.toasts.length).toBe(0);
  });

  it('toggles settings visibility and updates settings', () => {
    const { result } = renderHook(() =>
      useMapState({ appState: baseState, setAppState, clearData, loadElevationProfile, clearProfile })
    );

    expect(result.current.showSettings).toBe(false);
    act(() => result.current.openSettings());
    expect(result.current.showSettings).toBe(true);
    act(() => result.current.closeSettings());
    expect(result.current.showSettings).toBe(false);

    const nextSettings = { ...baseState.settings, theme: 'light' as any };
    act(() => result.current.updateSettings(nextSettings));
    expect(setAppState).toHaveBeenCalled();
  });

  it('handles map click and radius change', () => {
    const { result } = renderHook(() =>
      useMapState({ appState: baseState, setAppState, clearData, loadElevationProfile, clearProfile })
    );

    const newPos: GeoLocation = { lat: 1, lng: 2, label: 'New' };
    act(() => result.current.handleMapClick(newPos));
    expect(setAppState).toHaveBeenCalled();
    expect(clearData).toHaveBeenCalled();

    act(() => result.current.handleRadiusChange(1000));
    expect(setAppState).toHaveBeenCalled();
  });

  it('handles selection mode and polygon changes', () => {
    const { result } = renderHook(() =>
      useMapState({ appState: baseState, setAppState, clearData, loadElevationProfile, clearProfile })
    );

    act(() => result.current.handleSelectionModeChange('polygon'));
    expect(setAppState).toHaveBeenCalled();

    act(() => result.current.handlePolygonChange([[-22, -43], [-22.1, -43.1], [-22.2, -43.2]]));
    expect(setAppState).toHaveBeenCalled();

    act(() => result.current.handleClearPolygon());
    expect(setAppState).toHaveBeenCalled();
  });

  it('validates polygon', () => {
    const stateWithPolygon = { ...baseState, selectionMode: 'polygon' as any, polygon: [{ lat: 1, lng: 1 }, { lat: 2, lng: 2 }, { lat: 3, lng: 3 }] };
    const { result } = renderHook(() =>
      useMapState({ appState: stateWithPolygon, setAppState, clearData, loadElevationProfile, clearProfile })
    );
    expect(result.current.isPolygonValid).toBe(true);

    const stateWithShortPolygon = { ...baseState, selectionMode: 'polygon' as any, polygon: [{ lat: 1, lng: 1 }] };
    const { result: res2 } = renderHook(() =>
      useMapState({ appState: stateWithShortPolygon, setAppState, clearData, loadElevationProfile, clearProfile })
    );
    expect(res2.current.isPolygonValid).toBe(false);
  });

  it('attempts to set geolocation if center is default', () => {
    const mockGeolocation = {
      getCurrentPosition: vi.fn().mockImplementation((success) =>
        success({
          coords: { latitude: -23, longitude: -46 },
        })
      ),
    };
    (global.navigator as any).geolocation = mockGeolocation;

    const defaultState = { ...baseState, center: DEFAULT_LOCATION };
    renderHook(() =>
      useMapState({ appState: defaultState, setAppState, clearData, loadElevationProfile, clearProfile })
    );

    expect(mockGeolocation.getCurrentPosition).toHaveBeenCalled();
    expect(setAppState).toHaveBeenCalled();
  });

  it('handles geolocation rejection gracefully', () => {
    const mockGeolocation = {
      getCurrentPosition: vi.fn().mockImplementation((success, error) =>
        error(new Error('Denied'))
      ),
    };
    (global.navigator as any).geolocation = mockGeolocation;

    const defaultState = { ...baseState, center: DEFAULT_LOCATION };
    renderHook(() =>
      useMapState({ appState: defaultState, setAppState, clearData, loadElevationProfile, clearProfile })
    );

    expect(mockGeolocation.getCurrentPosition).toHaveBeenCalled();
    // setAppState should NOT have been called with new location (only via callbacks if we forced it)
  });

  it('respects locale in session restore toast', () => {
    const draft = { state: baseState, savedAt: '2026-04-09T00:00:00.000Z', version: 1 };
    vi.mocked(loadSessionDraft).mockReturnValue(draft);

    // Test en-US
    const enState = { ...baseState, settings: { ...baseState.settings, locale: 'en-US' as any } };
    const { result: resEn } = renderHook(() =>
      useMapState({ appState: enState, setAppState, clearData, loadElevationProfile, clearProfile })
    );
    act(() => resEn.current.handleRestoreSession());
    expect(resEn.current.toast?.message).toBe('Previous session restored.');

    // Test es-ES
    const esState = { ...baseState, settings: { ...baseState.settings, locale: 'es-ES' as any } };
    const { result: resEs } = renderHook(() =>
      useMapState({ appState: esState, setAppState, clearData, loadElevationProfile, clearProfile })
    );
    act(() => resEs.current.handleRestoreSession());
    expect(resEs.current.toast?.message).toBe('Sesión anterior restaurada.');
  });
});
