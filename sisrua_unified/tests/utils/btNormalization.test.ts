import { describe, it, expect } from "vitest";
import {
  getEdgeChangeFlag,
  getPoleChangeFlag,
  getTransformerChangeFlag,
  normalizeBtEdge,
  normalizeBtEdges,
  normalizeBtPole,
  normalizeBtPoles,
  normalizeBtTransformer,
  normalizeBtTransformers,
  distanceMeters,
  nextSequentialId,
  DEFAULT_EDGE_CONDUCTOR,
} from "../../src/utils/btNormalization";
import type { BtEdge, BtPoleNode, BtTransformer } from "../../src/types";

// ---------------------------------------------------------------------------
// getEdgeChangeFlag
// ---------------------------------------------------------------------------

describe("getEdgeChangeFlag", () => {
  it("returns the explicit edgeChangeFlag when set", () => {
    const edge = { edgeChangeFlag: "new" } as BtEdge;
    expect(getEdgeChangeFlag(edge)).toBe("new");
  });

  it("returns 'remove' when removeOnExecution is true and no flag", () => {
    const edge = {
      removeOnExecution: true,
      conductors: [],
    } as unknown as BtEdge;
    expect(getEdgeChangeFlag(edge)).toBe("remove");
  });

  it("returns 'existing' when no flag and removeOnExecution is false", () => {
    const edge = {
      removeOnExecution: false,
      conductors: [],
    } as unknown as BtEdge;
    expect(getEdgeChangeFlag(edge)).toBe("existing");
  });

  it("returns 'existing' when no flag and removeOnExecution is undefined", () => {
    const edge = { conductors: [] } as unknown as BtEdge;
    expect(getEdgeChangeFlag(edge)).toBe("existing");
  });

  it("returns 'replace' when edgeChangeFlag is 'replace'", () => {
    const edge = { edgeChangeFlag: "replace" } as BtEdge;
    expect(getEdgeChangeFlag(edge)).toBe("replace");
  });
});

// ---------------------------------------------------------------------------
// getPoleChangeFlag
// ---------------------------------------------------------------------------

describe("getPoleChangeFlag", () => {
  it("returns the explicit nodeChangeFlag when set", () => {
    const pole = { nodeChangeFlag: "new" } as BtPoleNode;
    expect(getPoleChangeFlag(pole)).toBe("new");
  });

  it("returns 'existing' when nodeChangeFlag is undefined", () => {
    const pole = {} as BtPoleNode;
    expect(getPoleChangeFlag(pole)).toBe("existing");
  });
});

// ---------------------------------------------------------------------------
// getTransformerChangeFlag
// ---------------------------------------------------------------------------

describe("getTransformerChangeFlag", () => {
  it("returns the explicit transformerChangeFlag when set", () => {
    const transformer = { transformerChangeFlag: "new" } as BtTransformer;
    expect(getTransformerChangeFlag(transformer)).toBe("new");
  });

  it("returns 'existing' when transformerChangeFlag is undefined", () => {
    const transformer = {} as BtTransformer;
    expect(getTransformerChangeFlag(transformer)).toBe("existing");
  });
});

// ---------------------------------------------------------------------------
// normalizeBtEdge
// ---------------------------------------------------------------------------

const makeEdge = (overrides: Partial<BtEdge> = {}): BtEdge =>
  ({
    id: "E1",
    fromPoleId: "P1",
    toPoleId: "P2",
    conductors: [],
    ...overrides,
  }) as unknown as BtEdge;

describe("normalizeBtEdge", () => {
  it("preserves existing edge unchanged (no mutation of conductors)", () => {
    const edge = makeEdge({
      edgeChangeFlag: "existing",
      conductors: [{ id: "C1", quantity: 1, conductorName: "70 Al - MX" }],
    });
    const result = normalizeBtEdge(edge);
    expect(result.edgeChangeFlag).toBe("existing");
    expect(result.conductors).toHaveLength(1);
    expect(result.removeOnExecution).toBe(false);
  });

  it("sets removeOnExecution:true and keeps flag for 'remove' edge", () => {
    const edge = makeEdge({ edgeChangeFlag: "remove", conductors: [] });
    const result = normalizeBtEdge(edge);
    expect(result.removeOnExecution).toBe(true);
    expect(result.edgeChangeFlag).toBe("remove");
    // 'remove' edge should not auto-create conductors
    expect(result.conductors).toHaveLength(0);
  });

  it("auto-creates a conductor for 'new' edge with empty conductors", () => {
    const edge = makeEdge({ edgeChangeFlag: "new", conductors: [] });
    const result = normalizeBtEdge(edge);
    expect(result.conductors).toHaveLength(1);
    expect(result.conductors[0].conductorName).toBe(DEFAULT_EDGE_CONDUCTOR);
    expect(result.conductors[0].quantity).toBe(1);
  });

  it("auto-creates a conductor for 'replace' edge with empty conductors", () => {
    const edge = makeEdge({ edgeChangeFlag: "replace", conductors: [] });
    const result = normalizeBtEdge(edge);
    expect(result.conductors).toHaveLength(1);
    expect(result.conductors[0].conductorName).toBe(DEFAULT_EDGE_CONDUCTOR);
  });

  it("auto-creates replacementFromConductors for 'replace' edge when empty", () => {
    const edge = makeEdge({
      edgeChangeFlag: "replace",
      conductors: [],
      replacementFromConductors: [],
    });
    const result = normalizeBtEdge(edge);
    expect(result.replacementFromConductors).toHaveLength(1);
    expect(result.replacementFromConductors![0].conductorName).toBe(
      DEFAULT_EDGE_CONDUCTOR,
    );
  });

  it("does NOT overwrite existing conductors for 'new' edge", () => {
    const edge = makeEdge({
      edgeChangeFlag: "new",
      conductors: [{ id: "C1", quantity: 2, conductorName: "185 MMX" }],
    });
    const result = normalizeBtEdge(edge);
    expect(result.conductors).toHaveLength(1);
    expect(result.conductors[0].conductorName).toBe("185 MMX");
  });

  it("handles replacementFromConductors when value is not an array", () => {
    const edge = makeEdge({
      edgeChangeFlag: "replace",
      conductors: [],
      replacementFromConductors: null as unknown as [],
    });
    const result = normalizeBtEdge(edge);
    // null → treated as empty → auto-creates one
    expect(result.replacementFromConductors).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// normalizeBtEdges
// ---------------------------------------------------------------------------

describe("normalizeBtEdges", () => {
  it("maps normalizeBtEdge over all edges", () => {
    const edges = [
      makeEdge({ id: "E1", edgeChangeFlag: "new", conductors: [] }),
      makeEdge({ id: "E2", edgeChangeFlag: "remove", conductors: [] }),
    ];
    const result = normalizeBtEdges(edges);
    expect(result).toHaveLength(2);
    expect(result[0].conductors).toHaveLength(1); // auto-created
    expect(result[1].removeOnExecution).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// normalizeBtPole / normalizeBtPoles
// ---------------------------------------------------------------------------

describe("normalizeBtPole", () => {
  it("defaults circuitBreakPoint to false when undefined", () => {
    const pole = { id: "P1", lat: 0, lng: 0, title: "P1" } as BtPoleNode;
    const result = normalizeBtPole(pole);
    expect(result.circuitBreakPoint).toBe(false);
    expect(result.nodeChangeFlag).toBe("existing");
  });

  it("preserves circuitBreakPoint:true", () => {
    const pole = {
      id: "P1",
      lat: 0,
      lng: 0,
      title: "P1",
      circuitBreakPoint: true,
    } as BtPoleNode;
    expect(normalizeBtPole(pole).circuitBreakPoint).toBe(true);
  });

  it("preserves explicit nodeChangeFlag", () => {
    const pole = {
      id: "P1",
      lat: 0,
      lng: 0,
      title: "P1",
      nodeChangeFlag: "new",
    } as BtPoleNode;
    expect(normalizeBtPole(pole).nodeChangeFlag).toBe("new");
  });
});

describe("normalizeBtPoles", () => {
  it("maps normalizeBtPole over all poles", () => {
    const poles = [
      { id: "P1", lat: 0, lng: 0, title: "P1" } as BtPoleNode,
      {
        id: "P2",
        lat: 0,
        lng: 0,
        title: "P2",
        circuitBreakPoint: true,
      } as BtPoleNode,
    ];
    const result = normalizeBtPoles(poles);
    expect(result[0].circuitBreakPoint).toBe(false);
    expect(result[1].circuitBreakPoint).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// normalizeBtTransformer / normalizeBtTransformers
// ---------------------------------------------------------------------------

describe("normalizeBtTransformer", () => {
  it("defaults transformerChangeFlag to 'existing' when undefined", () => {
    const transformer = {
      id: "T1",
      lat: 0,
      lng: 0,
      title: "T1",
    } as BtTransformer;
    const result = normalizeBtTransformer(transformer);
    expect(result.transformerChangeFlag).toBe("existing");
  });

  it("preserves explicit transformerChangeFlag", () => {
    const transformer = {
      id: "T1",
      lat: 0,
      lng: 0,
      title: "T1",
      transformerChangeFlag: "new",
    } as unknown as BtTransformer;
    expect(normalizeBtTransformer(transformer).transformerChangeFlag).toBe(
      "new",
    );
  });
});

describe("normalizeBtTransformers", () => {
  it("maps normalizeBtTransformer over all transformers", () => {
    const transformers = [
      { id: "T1", lat: 0, lng: 0, title: "T1" } as BtTransformer,
      {
        id: "T2",
        lat: 0,
        lng: 0,
        title: "T2",
        transformerChangeFlag: "remove",
      } as unknown as BtTransformer,
    ];
    const result = normalizeBtTransformers(transformers);
    expect(result[0].transformerChangeFlag).toBe("existing");
    expect(result[1].transformerChangeFlag).toBe("remove");
  });
});

// ---------------------------------------------------------------------------
// distanceMeters
// ---------------------------------------------------------------------------

describe("distanceMeters", () => {
  it("returns a finite positive distance between two distinct points", () => {
    const a = { lat: -22.9, lng: -43.2 };
    const b = { lat: -22.91, lng: -43.21 };
    const dist = distanceMeters(a, b);
    expect(dist).toBeGreaterThan(0);
    expect(Number.isFinite(dist)).toBe(true);
  });

  it("returns 0 for identical points", () => {
    const p = { lat: 0, lng: 0 };
    expect(distanceMeters(p, p)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// nextSequentialId
// ---------------------------------------------------------------------------

describe("nextSequentialId", () => {
  it("returns prefix + 1 when no IDs match the pattern", () => {
    expect(nextSequentialId([], "P")).toBe("P1");
    expect(nextSequentialId(["X1", "Y2"], "P")).toBe("P1");
  });

  it("returns prefix + (max + 1) from existing matching IDs", () => {
    expect(nextSequentialId(["P1", "P3", "P2"], "P")).toBe("P4");
  });

  it("ignores IDs that do not match the prefix pattern", () => {
    expect(nextSequentialId(["P1", "Q5", "R2"], "P")).toBe("P2");
  });

  it("handles prefix with special characters correctly", () => {
    const ids = ["T-1", "T-3"];
    // prefix "T-" and suffix is numeric
    expect(nextSequentialId(ids, "T-")).toBe("T-4");
  });

  it("handles large suffix numbers", () => {
    expect(nextSequentialId(["P100", "P999"], "P")).toBe("P1000");
  });
});
