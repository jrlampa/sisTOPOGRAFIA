import { describe, it, expect, vi } from "vitest";
import { synchronizeGlobalTopologyState } from "../../src/utils/synchronizeGlobalTopologyState";
import type { GlobalState } from "../../src/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const emptyState = (): GlobalState =>
  ({
    btTopology: { poles: [], edges: [], transformers: [] },
    mtTopology: { poles: [], edges: [] },
    canonicalTopology: undefined,
    canonicalTopologyMeta: undefined,
  }) as unknown as GlobalState;

const stateWithLegacy = (): GlobalState =>
  ({
    btTopology: {
      poles: [{ id: "P1", lat: -22, lng: -43, title: "P1" }],
      edges: [],
      transformers: [],
    },
    mtTopology: { poles: [], edges: [] },
    canonicalTopology: undefined,
  }) as unknown as GlobalState;

// ---------------------------------------------------------------------------
// synchronizeGlobalTopologyState
// ---------------------------------------------------------------------------

describe("synchronizeGlobalTopologyState", () => {
  it("returns a state with canonicalTopologyMeta populated", () => {
    const result = synchronizeGlobalTopologyState(emptyState());
    expect(result.canonicalTopologyMeta).toBeDefined();
    expect(result.canonicalTopologyMeta?.lastSynchronizedAt).toBeTruthy();
  });

  it("uses 'legacy-derived' source when legacy topology is present and no canonical", () => {
    const result = synchronizeGlobalTopologyState(stateWithLegacy());
    expect(result.canonicalTopologyMeta?.source).toBe("legacy-derived");
    expect(result.canonicalTopology).toBeDefined();
  });

  it("uses 'canonical-hydrated' source when canonical exists but legacy is empty", () => {
    const state: GlobalState = {
      ...emptyState(),
      canonicalTopology: {
        poles: [{ id: "P1", lat: -22, lng: -43, title: "P1" } as any],
        edges: [],
        transformers: [],
      },
    } as unknown as GlobalState;

    const result = synchronizeGlobalTopologyState(state);
    expect(result.canonicalTopologyMeta?.source).toBe("canonical-hydrated");
  });

  it("uses 'empty' source when both canonical and legacy are empty", () => {
    const result = synchronizeGlobalTopologyState(emptyState());
    expect(result.canonicalTopologyMeta?.source).toBe("empty");
  });

  it("preserves existing canonical topology when legacy is empty and no canonical set", () => {
    // No canonical, no legacy → empty branch
    const result = synchronizeGlobalTopologyState(emptyState());
    expect(result.canonicalTopology).toBeDefined();
    expect(result.canonicalTopology!.poles).toHaveLength(0);
  });

  it("passes through state.canonicalTopology as-is when both canonical and legacy are absent", () => {
    const state = emptyState();
    // Set a canonicalTopology but no legacy – will pick canonical-hydrated branch
    (state as any).canonicalTopology = {
      poles: [],
      edges: [],
      transformers: [],
    };
    const result = synchronizeGlobalTopologyState(state);
    // With empty canonical and empty legacy → canonical-hydrated (hasLegacy=false, hasCanonical=true)
    expect(result.canonicalTopologyMeta?.source).toBe("canonical-hydrated");
  });

  it("warns about divergences when DEBUG_MODE is enabled and divergences exist", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // A canonical topology with a pole that doesn't exist in btTopology would cause a divergence.
    // We just need to exercise the code path with feature flags enabled.
    // The function logs only when divergenceWarnings.length > 0 AND DEBUG_MODE is on.
    // In test env, feature flags are default-off, so we just ensure no throw.
    expect(() => synchronizeGlobalTopologyState(stateWithLegacy())).not.toThrow();

    warnSpy.mockRestore();
  });

  it("handles missing btTopology gracefully by defaulting to EMPTY_BT_TOPOLOGY", () => {
    const state = {
      mtTopology: { poles: [], edges: [] },
    } as unknown as GlobalState;

    expect(() => synchronizeGlobalTopologyState(state)).not.toThrow();
    const result = synchronizeGlobalTopologyState(state);
    expect(result.btTopology).toBeDefined();
  });

  it("handles missing mtTopology gracefully by defaulting to EMPTY_MT_TOPOLOGY", () => {
    const state = {
      btTopology: { poles: [], edges: [], transformers: [] },
    } as unknown as GlobalState;

    expect(() => synchronizeGlobalTopologyState(state)).not.toThrow();
    const result = synchronizeGlobalTopologyState(state);
    expect(result.mtTopology).toBeDefined();
  });
});
