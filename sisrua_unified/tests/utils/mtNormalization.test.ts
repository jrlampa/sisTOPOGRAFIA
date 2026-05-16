import { describe, it, expect } from "vitest";
import {
  getMtEdgeChangeFlag,
  getMtPoleChangeFlag,
  normalizeMtEdge,
  normalizeMtEdges,
  normalizeMtPole,
  normalizeMtPoles,
  EMPTY_MT_TOPOLOGY,
} from "../../src/utils/mtNormalization";
import type { MtEdge, MtPoleNode } from "../../src/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEdge(overrides: Partial<MtEdge> = {}): MtEdge {
  return {
    id: "e1",
    fromPoleId: "p1",
    toPoleId: "p2",
    ...overrides,
  };
}

function makePole(overrides: Partial<MtPoleNode> = {}): MtPoleNode {
  return {
    id: "p1",
    lat: 0,
    lng: 0,
    title: "Poste 1",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// EMPTY_MT_TOPOLOGY
// ---------------------------------------------------------------------------

describe("EMPTY_MT_TOPOLOGY", () => {
  it("has empty poles and edges arrays", () => {
    expect(EMPTY_MT_TOPOLOGY.poles).toHaveLength(0);
    expect(EMPTY_MT_TOPOLOGY.edges).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// getMtEdgeChangeFlag
// ---------------------------------------------------------------------------

describe("getMtEdgeChangeFlag", () => {
  it("returns the explicit edgeChangeFlag when set", () => {
    expect(getMtEdgeChangeFlag(makeEdge({ edgeChangeFlag: "new" }))).toBe("new");
    expect(getMtEdgeChangeFlag(makeEdge({ edgeChangeFlag: "remove" }))).toBe("remove");
    expect(getMtEdgeChangeFlag(makeEdge({ edgeChangeFlag: "replace" }))).toBe("replace");
  });

  it("returns 'existing' when edgeChangeFlag is undefined", () => {
    expect(getMtEdgeChangeFlag(makeEdge())).toBe("existing");
  });
});

// ---------------------------------------------------------------------------
// getMtPoleChangeFlag
// ---------------------------------------------------------------------------

describe("getMtPoleChangeFlag", () => {
  it("returns the explicit nodeChangeFlag when set", () => {
    expect(getMtPoleChangeFlag(makePole({ nodeChangeFlag: "new" }))).toBe("new");
    expect(getMtPoleChangeFlag(makePole({ nodeChangeFlag: "remove" }))).toBe("remove");
  });

  it("returns 'existing' when nodeChangeFlag is undefined", () => {
    expect(getMtPoleChangeFlag(makePole())).toBe("existing");
  });
});

// ---------------------------------------------------------------------------
// normalizeMtEdge
// ---------------------------------------------------------------------------

describe("normalizeMtEdge", () => {
  it("preserves all original edge fields", () => {
    const edge = makeEdge({ lengthMeters: 50 });
    const normalized = normalizeMtEdge(edge);
    expect(normalized.id).toBe("e1");
    expect(normalized.fromPoleId).toBe("p1");
    expect(normalized.toPoleId).toBe("p2");
    expect(normalized.lengthMeters).toBe(50);
  });

  it("fills in 'existing' edgeChangeFlag when undefined", () => {
    const normalized = normalizeMtEdge(makeEdge());
    expect(normalized.edgeChangeFlag).toBe("existing");
  });

  it("preserves the explicit edgeChangeFlag", () => {
    const normalized = normalizeMtEdge(makeEdge({ edgeChangeFlag: "new" }));
    expect(normalized.edgeChangeFlag).toBe("new");
  });
});

// ---------------------------------------------------------------------------
// normalizeMtEdges
// ---------------------------------------------------------------------------

describe("normalizeMtEdges", () => {
  it("normalizes all edges in the array", () => {
    const edges = [
      makeEdge({ id: "e1" }),
      makeEdge({ id: "e2", edgeChangeFlag: "remove" }),
    ];
    const result = normalizeMtEdges(edges);
    expect(result).toHaveLength(2);
    expect(result[0].edgeChangeFlag).toBe("existing");
    expect(result[1].edgeChangeFlag).toBe("remove");
  });

  it("returns an empty array for empty input", () => {
    expect(normalizeMtEdges([])).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// normalizeMtPole
// ---------------------------------------------------------------------------

describe("normalizeMtPole", () => {
  it("preserves all original pole fields", () => {
    const pole = makePole({ verified: true });
    const normalized = normalizeMtPole(pole);
    expect(normalized.id).toBe("p1");
    expect(normalized.verified).toBe(true);
  });

  it("fills in 'existing' nodeChangeFlag when undefined", () => {
    const normalized = normalizeMtPole(makePole());
    expect(normalized.nodeChangeFlag).toBe("existing");
  });

  it("preserves the explicit nodeChangeFlag", () => {
    const normalized = normalizeMtPole(makePole({ nodeChangeFlag: "new" }));
    expect(normalized.nodeChangeFlag).toBe("new");
  });
});

// ---------------------------------------------------------------------------
// normalizeMtPoles
// ---------------------------------------------------------------------------

describe("normalizeMtPoles", () => {
  it("normalizes all poles in the array", () => {
    const poles = [
      makePole({ id: "p1" }),
      makePole({ id: "p2", nodeChangeFlag: "replace" }),
    ];
    const result = normalizeMtPoles(poles);
    expect(result).toHaveLength(2);
    expect(result[0].nodeChangeFlag).toBe("existing");
    expect(result[1].nodeChangeFlag).toBe("replace");
  });

  it("returns an empty array for empty input", () => {
    expect(normalizeMtPoles([])).toHaveLength(0);
  });
});
