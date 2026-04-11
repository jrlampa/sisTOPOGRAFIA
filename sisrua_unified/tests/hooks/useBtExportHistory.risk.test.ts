import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { BtExportHistoryEntry, GlobalState } from '../../src/types';
import { useBtExportHistory } from '../../src/hooks/useBtExportHistory';

vi.mock('../../src/services/btExportHistoryService', () => ({
  listBtExportHistory: vi.fn(),
  ingestBtExportHistory: vi.fn(),
  clearBtExportHistoryRemote: vi.fn(),
}));

import {
  listBtExportHistory,
  ingestBtExportHistory,
  clearBtExportHistoryRemote,
} from '../../src/services/btExportHistoryService';

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
  btExportSummary: null,
  btExportHistory: [],
};

const sampleEntry: BtExportHistoryEntry = {
  btContextUrl: '/downloads/contexto-1.json',
  criticalPoleId: 'P1',
  criticalAccumulatedClients: 5,
  criticalAccumulatedDemandKva: 12.3,
  cqt: { scenario: 'atual', value: 0.12 },
  verifiedPoles: 1,
  totalPoles: 2,
  verifiedEdges: 1,
  totalEdges: 1,
  verifiedTransformers: 1,
  totalTransformers: 1,
  exportedAt: '2026-04-09T00:00:00.000Z',
  projectType: 'ramais',
};

describe('useBtExportHistory critical flows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listBtExportHistory).mockResolvedValue({ total: 1, entries: [sampleEntry] });
    vi.mocked(clearBtExportHistoryRemote).mockResolvedValue({ deletedCount: 1 });
    vi.mocked(ingestBtExportHistory).mockResolvedValue({ entry: sampleEntry });
  });

  it('hydrates history on mount and updates app state', async () => {
    const setAppState = vi.fn();
    const showToast = vi.fn();

    renderHook(() =>
      useBtExportHistory({
        appState: baseState,
        setAppState,
        showToast,
        projectType: 'ramais',
      })
    );

    await waitFor(() => {
      expect(listBtExportHistory).toHaveBeenCalled();
    });

    expect(setAppState).toHaveBeenCalled();
  });

  it('ingests BT context history and emits summary toast', async () => {
    const setAppState = vi.fn();
    const showToast = vi.fn();

    const { result } = renderHook(() =>
      useBtExportHistory({
        appState: baseState,
        setAppState,
        showToast,
        projectType: 'ramais',
      })
    );

    await act(async () => {
      await result.current.ingestBtContextHistory('/downloads/contexto-1.json', { test: true });
    });

    expect(ingestBtExportHistory).toHaveBeenCalledWith({
      btContextUrl: '/downloads/contexto-1.json',
      btContext: { test: true },
      projectType: 'ramais',
    });
    expect(setAppState).toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('Resumo BT:'), 'info');
  });
});
