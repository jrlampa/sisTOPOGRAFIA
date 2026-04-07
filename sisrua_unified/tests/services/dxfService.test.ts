import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateDXF, getDxfJobStatus } from '../../src/services/dxfService';

describe('dxfService response parsing', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns parsed JSON on successful DXF request', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ status: 'queued', jobId: 'job-1' }), {
        status: 202,
        headers: { 'content-type': 'application/json' }
      })
    );

    const result = await generateDXF(-23.55, -46.63, 500, 'circle', [], {}, 'utm');

    expect(result).toEqual({ status: 'queued', jobId: 'job-1' });
  });

  it('preserves cqtSummary from successful DXF response payload', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({
        status: 'success',
        url: 'http://localhost:3001/downloads/test.dxf',
        cqtSummary: {
          scenario: 'proj2',
          p31: 118.38,
          p32: 118.38,
          k10QtMttr: 4,
          parityStatus: 'complete',
          parityPassed: 8,
          parityFailed: 0
        }
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    );

    const result = await generateDXF(-23.55, -46.63, 500, 'circle', [], {}, 'utm');

    expect(result).toMatchObject({
      status: 'success',
      cqtSummary: {
        scenario: 'proj2',
        p31: 118.38,
        parityStatus: 'complete',
        parityPassed: 8,
        parityFailed: 0
      }
    });
  });

  it('throws descriptive error when backend returns empty error body', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('', {
        status: 500,
        headers: { 'content-type': 'application/json' }
      })
    );

    await expect(
      generateDXF(-23.55, -46.63, 500, 'circle', [], {}, 'utm')
    ).rejects.toThrow('empty response body');
  });

  it('throws descriptive error when job status endpoint returns non-JSON success body', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('ok', {
        status: 200,
        headers: { 'content-type': 'text/plain' }
      })
    );

    await expect(getDxfJobStatus('job-123')).rejects.toThrow('non-JSON response');
  });
});
