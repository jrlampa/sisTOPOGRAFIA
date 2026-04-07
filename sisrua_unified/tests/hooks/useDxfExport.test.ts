import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDxfExport } from '../../src/hooks/useDxfExport';
import { generateDXF } from '../../src/services/dxfService';

vi.mock('../../src/services/dxfService', () => ({
  generateDXF: vi.fn(),
  getDxfJobStatus: vi.fn()
}));

describe('useDxfExport', () => {
  const onSuccess = vi.fn();
  const onError = vi.fn();
  const onBtContextLoaded = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads btContext and forwards cqtSummary when DXF is returned immediately', async () => {
    vi.mocked(generateDXF).mockResolvedValueOnce({
      status: 'success',
      url: 'http://localhost:3001/downloads/test.dxf',
      btContextUrl: 'http://localhost:3001/api/bt-context/test',
      cqtSummary: {
        scenario: 'proj2',
        p31: 118.385,
        p32: 118.385,
        parityStatus: 'complete',
        parityPassed: 8,
        parityFailed: 0
      }
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          btContext: {
            criticalPole: { poleId: 'P-1' },
            cqtSnapshot: { scenario: 'proj2' }
          }
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );

    const { result } = renderHook(() => useDxfExport({ onSuccess, onError, onBtContextLoaded }));

    await act(async () => {
      await result.current.downloadDxf(
        { lat: -23.55, lng: -46.63, label: 'Centro' },
        300,
        'circle',
        [],
        {},
        'utm',
        'spline'
      );
    });

    expect(onError).not.toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalledWith('DXF Downloaded');
    expect(onBtContextLoaded).toHaveBeenCalledWith({
      btContextUrl: 'http://localhost:3001/api/bt-context/test',
      btContext: {
        criticalPole: { poleId: 'P-1' },
        cqtSnapshot: { scenario: 'proj2' }
      },
      cqtSummary: expect.objectContaining({
        scenario: 'proj2',
        parityStatus: 'complete',
        parityPassed: 8,
        parityFailed: 0
      })
    });
  });
});
