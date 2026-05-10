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

  it('handles invalid JSON in response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('{ invalid }', {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    );

    await expect(getDxfJobStatus('job-1')).rejects.toThrow('invalid JSON');
  });

  it('extracts error from various JSON fields (details, error, message)', async () => {
    // details
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ details: 'Erro detalhado' }), {
        status: 400,
        headers: { 'content-type': 'application/json' }
      })
    );
    await expect(getDxfJobStatus('j1')).rejects.toThrow('Erro detalhado');

    // error
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Erro de campo' }), {
        status: 400,
        headers: { 'content-type': 'application/json' }
      })
    );
    await expect(getDxfJobStatus('j1')).rejects.toThrow('Erro de campo');

    // message
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Msg de erro' }), {
        status: 400,
        headers: { 'content-type': 'application/json' }
      })
    );
    await expect(getDxfJobStatus('j1')).rejects.toThrow('Msg de erro');
  });

  it('handles non-JSON error response with text body', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Erro em texto', {
        status: 400,
        headers: { 'content-type': 'text/plain' }
      })
    );
    await expect(getDxfJobStatus('j1')).rejects.toThrow('HTTP 400: Erro em texto');
  });

  it('normalizes various polygon point formats', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ status: 'success', url: '...' }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    );

    const polygon = [
      [10, 20], // array format
      { lat: 30, lng: 40 }, // object format (lat/lng)
      { lat: 50, lon: 60 }, // object format (lat/lon)
      null, // invalid
      "invalid", // invalid
      { invalid: true } // invalid
    ];

    await generateDXF(0, 0, 100, 'polygon', polygon, {});
    
    const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0];
    const body = JSON.parse(fetchCall[1]!.body as string);
    
    expect(body.polygon).toEqual([
      [10, 20],
      [40, 30],
      [60, 50]
    ]);
  });

  it('rethrows error and ends trace on fetch failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));
    await expect(getDxfJobStatus('j1')).rejects.toThrow('Network error');
  });

  it('throws error when status is 200 but body is empty', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('', {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    );
    await expect(getDxfJobStatus('j1')).rejects.toThrow('empty response body');
  });
});
