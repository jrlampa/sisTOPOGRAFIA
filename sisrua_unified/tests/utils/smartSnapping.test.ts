import { describe, it, expect, vi, afterEach } from "vitest";
import { applyOrthoSnap } from "../../src/utils/smartSnapping";
import type { SnapNeighbor } from "../../src/utils/smartSnapping";

// applyRoadSnap requires Leaflet's CRS.EPSG3857.latLngToPoint which is not
// available in jsdom. We test it via mocking if needed; for now we focus on
// applyOrthoSnap which has no DOM/Leaflet dependency.

afterEach(() => {
  vi.restoreAllMocks();
});

// The threshold constant used internally is ORTHO_THRESHOLD_DEG = 0.00008
const THRESHOLD = 0.00008;

// ---------------------------------------------------------------------------
// applyOrthoSnap
// ---------------------------------------------------------------------------

describe("applyOrthoSnap", () => {
  it("returns original coordinates when there are no neighbors", () => {
    const result = applyOrthoSnap(-22.9, -43.1, []);
    expect(result.lat).toBe(-22.9);
    expect(result.lng).toBe(-43.1);
    expect(result.type).toBeUndefined();
    expect(result.snapId).toBeUndefined();
  });

  it("snaps horizontally when dlat is within threshold and dlat < dlng", () => {
    const neighbor: SnapNeighbor = { id: "n1", lat: -22.9, lng: -43.2 };
    // dlat = 0 (same lat), dlng = 0.1 – dlat < threshold and dlat < dlng
    const result = applyOrthoSnap(-22.9 + THRESHOLD / 2, -43.1, [neighbor]);
    expect(result.lat).toBe(neighbor.lat);
    expect(result.type).toBe("ortho");
    expect(result.snapId).toBe("n1");
  });

  it("snaps vertically when dlng is within threshold and dlng < dlat", () => {
    const neighbor: SnapNeighbor = { id: "n2", lat: -22.9, lng: -43.1 };
    // dlng = tiny amount (< threshold), dlat = large amount
    const result = applyOrthoSnap(-22.95, -43.1 + THRESHOLD / 2, [neighbor]);
    expect(result.lng).toBe(neighbor.lng);
    expect(result.type).toBe("ortho");
    expect(result.snapId).toBe("n2");
  });

  it("does not snap when both dlat and dlng exceed threshold", () => {
    const neighbor: SnapNeighbor = { id: "n3", lat: -22.91, lng: -43.11 };
    const result = applyOrthoSnap(-22.9, -43.1, [neighbor]);
    expect(result.lat).toBe(-22.9);
    expect(result.lng).toBe(-43.1);
    expect(result.type).toBeUndefined();
  });

  it("does not snap horizontally when dlat >= dlng", () => {
    // dlat slightly below threshold but NOT less than dlng – should not snap horiz
    const neighbor: SnapNeighbor = { id: "n4", lat: -22.9, lng: -43.1 };
    // same lng so dlng = 0, which means dlat is NOT less than dlng; try horiz snap
    // dlng = 0 < dlat = small → only vertical snap could trigger (but dlng < threshold)
    const result = applyOrthoSnap(-22.9 + THRESHOLD / 2, -43.1, [neighbor]);
    // dlng = 0 which is < THRESHOLD and dlng(0) < dlat → vertical snap triggered
    expect(result.lng).toBe(neighbor.lng);
    expect(result.type).toBe("ortho");
  });

  it("uses the first snapping neighbor (early break)", () => {
    const n1: SnapNeighbor = { id: "n1", lat: -22.9, lng: -43.2 };
    const n2: SnapNeighbor = { id: "n2", lat: -22.9, lng: -43.3 };
    const result = applyOrthoSnap(-22.9 + THRESHOLD / 2, -43.1, [n1, n2]);
    expect(result.snapId).toBe("n1");
  });

  it("falls through to second neighbor when first does not snap", () => {
    const noSnap: SnapNeighbor = { id: "n1", lat: -23.0, lng: -44.0 }; // too far
    const snapping: SnapNeighbor = { id: "n2", lat: -22.9, lng: -43.2 };
    const result = applyOrthoSnap(-22.9 + THRESHOLD / 2, -43.1, [noSnap, snapping]);
    expect(result.snapId).toBe("n2");
  });

  it("returns the snapped lat unchanged and keeps original lng on horizontal snap", () => {
    const neighbor: SnapNeighbor = { id: "n1", lat: -22.9000, lng: -43.2 };
    const result = applyOrthoSnap(-22.9 + THRESHOLD / 2, -43.1, [neighbor]);
    // Horizontal snap → lat snapped, lng preserved
    expect(result.lat).toBe(-22.9000);
    expect(result.lng).toBe(-43.1);
  });

  it("returns the snapped lng unchanged and keeps original lat on vertical snap", () => {
    const neighbor: SnapNeighbor = { id: "n1", lat: -22.9, lng: -43.1000 };
    const result = applyOrthoSnap(-22.95, -43.1 + THRESHOLD / 2, [neighbor]);
    // Vertical snap → lng snapped, lat preserved
    expect(result.lat).toBe(-22.95);
    expect(result.lng).toBe(-43.1000);
  });
});
