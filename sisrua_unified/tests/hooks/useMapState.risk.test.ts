import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { GlobalState } from '../../src/types';
import { useMapState } from '../../src/hooks/useMapState';

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
    layers: {
      buildings: true,
      roads: true,
      curbs: true,
      nature: true,
      terrain: true,
      contours: false,
      slopeAnalysis: false,
      furniture: true,
      labels: true,
      dimensions: false,
      grid: false,
    },
    projectMetadata: {
      projectName: 'TESTE',
      companyName: 'EMPRESA',
      engineerName: 'ENG',
      date: '2026-04-09',
      scale: 'N/A',
      revision: 'R00',
    },
  },
  btTopology: {
    poles: [{ id: 'P1', lat: -22.95, lng: -43.2, title: 'P1', verified: false, ramais: [] }],
    transformers: [],
    edges: [],
  },
};

describe('useMapState critical flows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadSessionDraft).mockReturnValue(null);
  });

  it('restores session draft and emits success toast', async () => {
    const setAppState = vi.fn();
    const clearData = vi.fn();
    const loadElevationProfile = vi.fn().mockResolvedValue(undefined);
    const clearProfile = vi.fn();

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

    expect(setAppState).toHaveBeenCalledWith(baseState, true);
    expect(clearSessionDraft).toHaveBeenCalledTimes(1);
    expect(result.current.toast?.message).toContain('Sessão anterior restaurada');
  });

  it('loads elevation profile only when measure path has two points', async () => {
    const setAppState = vi.fn();
    const clearData = vi.fn();
    const loadElevationProfile = vi.fn().mockResolvedValue(undefined);
    const clearProfile = vi.fn();

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
});
