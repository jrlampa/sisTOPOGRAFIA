import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchCatalogSnapshots, fetchConstantsCatalogStatus, fetchConstantsRefreshEvents, fetchConstantsRefreshStats, refreshConstantsCatalog, restoreCatalogSnapshot } from '../../src/services/constantsCatalogService';

describe('constantsCatalogService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads constants catalog status', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          flags: { cqt: true, clandestino: false, config: true },
          cache: { cqt: 3, config: 4 },
          rateLimitPolicy: {
            general: { windowMs: 900000, limit: 100 },
            dxf: { windowMs: 3600000, limit: 10 }
          },
          dxfCleanupPolicy: {
            fileTtlMs: 600000,
            maxFileAgeMs: 7200000,
            cleanupCheckIntervalMs: 120000
          },
          lastRefreshEvent: null
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );

    const payload = await fetchConstantsCatalogStatus();
    expect(payload.flags.config).toBe(true);
    expect(payload.cache.cqt).toBe(3);
  });

  it('sends refresh token and actor on refresh operation', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ok: true,
          refreshedNamespaces: ['config'],
          cache: { config: 5 },
          rateLimitPolicy: {
            general: { windowMs: 120000, limit: 120 },
            dxf: { windowMs: 3600000, limit: 10 }
          },
          dxfCleanupPolicy: {
            fileTtlMs: 300000,
            maxFileAgeMs: 3600000,
            cleanupCheckIntervalMs: 45000
          }
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );

    const payload = await refreshConstantsCatalog('secret-token', 'ui-ops');

    expect(payload.ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith('/api/constants/refresh', {
      method: 'POST',
      headers: {
        'x-refresh-actor': 'ui-ops',
        'x-constants-refresh-token': 'secret-token'
      }
    });
  });

  it('loads refresh events with optional token', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          events: [
            {
              namespaces: ['config'],
              success: true,
              httpStatus: 200,
              actor: 'ops-user',
              durationMs: 75,
              createdAt: '2026-04-07T11:00:00.000Z'
            }
          ],
          limit: 5
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );

    const payload = await fetchConstantsRefreshEvents(5, 'token-123');

    expect(payload.events).toHaveLength(1);
    expect(fetchSpy).toHaveBeenCalledWith('/api/constants/refresh-events?limit=5', {
      headers: {
        'x-constants-refresh-token': 'token-123'
      }
    });
  });

  it('loads refresh statistics with token authorization', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          totalRefreshes: 8,
          successCount: 7,
          failureCount: 1,
          successRate: 87,
          avgDurationMs: 60,
          maxDurationMs: 180,
          minSuccessDurationMs: 25,
          lastSuccessAt: '2026-04-07T12:00:00.000Z',
          firstRefreshAt: '2026-04-02T09:00:00.000Z',
          namespaceFrequency: { config: 6, clandestino: 3 },
          topActors: [
            { actor: 'ci-bot', refreshCount: 5, successCount: 5, lastSeenAt: '2026-04-07T12:00:00.000Z' }
          ]
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );

    const payload = await fetchConstantsRefreshStats('token-abc');

    expect(payload.totalRefreshes).toBe(8);
    expect(payload.successRate).toBe(87);
    expect(payload.namespaceFrequency).toEqual({ config: 6, clandestino: 3 });
    expect(payload.topActors).toHaveLength(1);
    expect(fetchSpy).toHaveBeenCalledWith('/api/constants/refresh-stats', {
      headers: { 'x-constants-refresh-token': 'token-abc' }
    });
  });

    it('fetches catalog snapshots with token', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            snapshots: [
              { id: 5, namespace: 'config', actor: 'ci', label: null, entryCount: 3, createdAt: '2026-04-07T14:00:00.000Z' }
            ],
            limit: 8
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      );

      const payload = await fetchCatalogSnapshots(8, 'tok-123');

      expect(payload.snapshots).toHaveLength(1);
      expect(payload.snapshots[0].id).toBe(5);
      expect(payload.limit).toBe(8);
      expect(fetchSpy).toHaveBeenCalledWith('/api/constants/snapshots?limit=8', {
        headers: { 'x-constants-refresh-token': 'tok-123' }
      });
    });

    it('restores a catalog snapshot with token', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            restoredSnapshotId: 7,
            namespace: 'config',
            entryCount: 4,
            snapshotCreatedAt: '2026-04-07T13:00:00.000Z',
            cache: { config: 4 }
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      );

      const payload = await restoreCatalogSnapshot(7, 'tok-abc');

      expect(payload.ok).toBe(true);
      expect(payload.restoredSnapshotId).toBe(7);
      expect(fetchSpy).toHaveBeenCalledWith('/api/constants/snapshots/7/restore', {
        method: 'POST',
        headers: { 'x-constants-refresh-token': 'tok-abc' }
      });
    });
});
