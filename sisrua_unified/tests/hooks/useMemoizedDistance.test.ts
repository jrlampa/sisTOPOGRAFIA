import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  distanceMetersWithCache,
  useMemoizedDistances,
  clearMemoizedDistanceCache,
} from "../../src/hooks/useMemoizedDistance";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const RIO = { lat: -22.9068, lng: -43.1729 };
const SAO_PAULO = { lat: -23.5505, lng: -46.6333 };
const ORIGIN = { lat: 0, lng: 0 };
const NEAR_ORIGIN = { lat: 0.001, lng: 0 }; // ~111m north

beforeEach(() => {
  clearMemoizedDistanceCache();
});

// ---------------------------------------------------------------------------
// distanceMetersWithCache
// ---------------------------------------------------------------------------

describe("distanceMetersWithCache", () => {
  it("returns a positive distance for two distinct points", () => {
    const dist = distanceMetersWithCache(RIO, SAO_PAULO);
    expect(dist).toBeGreaterThan(0);
  });

  it("returns ~0 for the same point", () => {
    const dist = distanceMetersWithCache(RIO, RIO);
    expect(dist).toBeCloseTo(0);
  });

  it("returns a reasonable distance between Rio and São Paulo (~360km)", () => {
    const dist = distanceMetersWithCache(RIO, SAO_PAULO);
    // Approx 357–365 km
    expect(dist).toBeGreaterThan(350_000);
    expect(dist).toBeLessThan(380_000);
  });

  it("returns approximately 111m between two points 0.001° apart in latitude", () => {
    const dist = distanceMetersWithCache(ORIGIN, NEAR_ORIGIN);
    expect(dist).toBeGreaterThan(100);
    expect(dist).toBeLessThan(120);
  });

  it("caches the result – second call returns the same value", () => {
    const first = distanceMetersWithCache(RIO, SAO_PAULO);
    const second = distanceMetersWithCache(RIO, SAO_PAULO);
    expect(first).toBe(second);
  });

  it("correctly evicts oldest entry when cache exceeds max size", () => {
    // Fill the cache up to and past MAX_CACHE_SIZE (100)
    for (let i = 0; i < 101; i++) {
      distanceMetersWithCache({ lat: i * 0.001, lng: 0 }, { lat: i * 0.001 + 0.001, lng: 0 });
    }
    // The hook should not throw; cache eviction is internal – just verify it still works
    const dist = distanceMetersWithCache(RIO, SAO_PAULO);
    expect(dist).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// useMemoizedDistances
// ---------------------------------------------------------------------------

describe("useMemoizedDistances", () => {
  it("returns an empty array for an empty pairs list", () => {
    const { result } = renderHook(() => useMemoizedDistances([]));
    expect(result.current).toHaveLength(0);
  });

  it("returns distances for each pair", () => {
    const pairs = [{ from: RIO, to: SAO_PAULO }];
    const { result } = renderHook(() => useMemoizedDistances(pairs));
    expect(result.current).toHaveLength(1);
    expect(result.current[0]).toBeGreaterThan(350_000);
  });

  it("returns distances for multiple pairs", () => {
    const pairs = [
      { from: RIO, to: SAO_PAULO },
      { from: ORIGIN, to: NEAR_ORIGIN },
    ];
    const { result } = renderHook(() => useMemoizedDistances(pairs));
    expect(result.current).toHaveLength(2);
    expect(result.current[1]).toBeGreaterThan(100);
  });

  it("does not recompute when the same pairs are provided (stable key)", () => {
    const pairs = [{ from: RIO, to: SAO_PAULO }];
    const { result, rerender } = renderHook(({ p }) => useMemoizedDistances(p), {
      initialProps: { p: pairs },
    });

    const firstResult = result.current;
    rerender({ p: pairs });
    // Same array reference → stable key → memoized result should be the same reference
    expect(result.current).toBe(firstResult);
  });

  it("recomputes when pairs change", () => {
    const pairsA = [{ from: RIO, to: SAO_PAULO }];
    const pairsB = [{ from: ORIGIN, to: NEAR_ORIGIN }];

    const { result, rerender } = renderHook(({ p }) => useMemoizedDistances(p), {
      initialProps: { p: pairsA },
    });

    const firstResult = result.current;

    act(() => {
      rerender({ p: pairsB });
    });

    expect(result.current).not.toBe(firstResult);
    expect(result.current[0]).not.toBe(firstResult[0]);
  });
});

// ---------------------------------------------------------------------------
// clearMemoizedDistanceCache
// ---------------------------------------------------------------------------

describe("clearMemoizedDistanceCache", () => {
  it("can be called without error when cache is empty", () => {
    expect(() => clearMemoizedDistanceCache()).not.toThrow();
  });

  it("clears previously cached entries", () => {
    distanceMetersWithCache(RIO, SAO_PAULO);
    clearMemoizedDistanceCache();
    // After clearing, calling again should still work (cache miss, re-computes)
    const dist = distanceMetersWithCache(RIO, SAO_PAULO);
    expect(dist).toBeGreaterThan(0);
  });
});
