import { describe, it, expect } from "vitest";
import {
  isMtPoleConfigured,
  hasMeaningfulMtTopology,
  mergeMtTopologyWithBtPoles,
} from "../../src/utils/mtTopologyBridge";
import type { BtTopology, MtPoleNode, MtTopology } from "../../src/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMtPole(overrides: Partial<MtPoleNode> = {}): MtPoleNode {
  return {
    id: "p1",
    lat: 0,
    lng: 0,
    title: "Poste 1",
    verified: false,
    ...overrides,
  };
}

const emptyBtTopology = (): BtTopology => ({ poles: [], transformers: [], edges: [] });
const emptyMtTopology = (): MtTopology => ({ poles: [], edges: [] });

// ---------------------------------------------------------------------------
// isMtPoleConfigured
// ---------------------------------------------------------------------------

describe("isMtPoleConfigured", () => {
  it("returns false for a pole with no structures, not verified, and existing flag", () => {
    const pole = makeMtPole();
    expect(isMtPoleConfigured(pole)).toBe(false);
  });

  it("returns true for a verified pole", () => {
    const pole = makeMtPole({ verified: true });
    expect(isMtPoleConfigured(pole)).toBe(true);
  });

  it("returns true when nodeChangeFlag is 'new'", () => {
    const pole = makeMtPole({ nodeChangeFlag: "new" });
    expect(isMtPoleConfigured(pole)).toBe(true);
  });

  it("returns true when nodeChangeFlag is 'replace'", () => {
    const pole = makeMtPole({ nodeChangeFlag: "replace" });
    expect(isMtPoleConfigured(pole)).toBe(true);
  });

  it("returns true when pole has at least one structure value (n1)", () => {
    const pole = makeMtPole({ mtStructures: { n1: "Estaiado" } });
    expect(isMtPoleConfigured(pole)).toBe(true);
  });

  it("returns true when pole has structure value in n2", () => {
    const pole = makeMtPole({ mtStructures: { n2: "T2" } });
    expect(isMtPoleConfigured(pole)).toBe(true);
  });

  it("returns false when all structure values are empty strings", () => {
    const pole = makeMtPole({ mtStructures: { n1: "", n2: "  ", n3: "", n4: "" } });
    expect(isMtPoleConfigured(pole)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// hasMeaningfulMtTopology
// ---------------------------------------------------------------------------

describe("hasMeaningfulMtTopology", () => {
  it("returns false for an empty topology", () => {
    expect(hasMeaningfulMtTopology(emptyMtTopology())).toBe(false);
  });

  it("returns true when there are edges", () => {
    const topology: MtTopology = {
      poles: [],
      edges: [{ id: "e1", fromPoleId: "p1", toPoleId: "p2" }],
    };
    expect(hasMeaningfulMtTopology(topology)).toBe(true);
  });

  it("returns true when there is at least one configured pole", () => {
    const topology: MtTopology = {
      poles: [makeMtPole({ verified: true })],
      edges: [],
    };
    expect(hasMeaningfulMtTopology(topology)).toBe(true);
  });

  it("returns false when poles exist but none are configured", () => {
    const topology: MtTopology = {
      poles: [makeMtPole()], // not verified, no structures, existing flag
      edges: [],
    };
    expect(hasMeaningfulMtTopology(topology)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// mergeMtTopologyWithBtPoles
// ---------------------------------------------------------------------------

describe("mergeMtTopologyWithBtPoles", () => {
  it("returns the MT base topology unchanged when btTopology has no poles", () => {
    const mtBase: MtTopology = {
      poles: [makeMtPole({ id: "p1" })],
      edges: [],
    };
    const result = mergeMtTopologyWithBtPoles(emptyBtTopology(), mtBase);
    expect(result).toEqual(mtBase);
  });

  it("returns empty topology when both are empty", () => {
    const result = mergeMtTopologyWithBtPoles(emptyBtTopology(), emptyMtTopology());
    expect(result.poles).toHaveLength(0);
    expect(result.edges).toHaveLength(0);
  });

  it("maps BT poles into MT poles preserving id/lat/lng/title", () => {
    const btTopology: BtTopology = {
      poles: [{ id: "p1", lat: -22.9, lng: -43.1, title: "P-01" }],
      transformers: [],
      edges: [],
    };
    const result = mergeMtTopologyWithBtPoles(btTopology, emptyMtTopology());
    expect(result.poles).toHaveLength(1);
    expect(result.poles[0].id).toBe("p1");
    expect(result.poles[0].lat).toBe(-22.9);
    expect(result.poles[0].title).toBe("P-01");
  });

  it("merges existing MT data into BT poles by matching ID", () => {
    const btTopology: BtTopology = {
      poles: [{ id: "p1", lat: 0, lng: 0, title: "P-01" }],
      transformers: [],
      edges: [],
    };
    const mtBase: MtTopology = {
      poles: [makeMtPole({ id: "p1", verified: true, mtStructures: { n1: "E1" } })],
      edges: [],
    };
    const result = mergeMtTopologyWithBtPoles(btTopology, mtBase);
    expect(result.poles[0].verified).toBe(true);
    expect(result.poles[0].mtStructures?.n1).toBe("E1");
  });

  it("appends legacy MT-only poles that have no corresponding BT pole", () => {
    const btTopology: BtTopology = {
      poles: [{ id: "p1", lat: 0, lng: 0, title: "P-01" }],
      transformers: [],
      edges: [],
    };
    const mtBase: MtTopology = {
      poles: [
        makeMtPole({ id: "p1" }),
        makeMtPole({ id: "mt-only", title: "MT Only" }),
      ],
      edges: [],
    };
    const result = mergeMtTopologyWithBtPoles(btTopology, mtBase);
    expect(result.poles).toHaveLength(2);
    expect(result.poles.find((p) => p.id === "mt-only")).toBeDefined();
  });

  it("preserves the edges from the MT base topology", () => {
    const btTopology: BtTopology = {
      poles: [{ id: "p1", lat: 0, lng: 0, title: "P-01" }],
      transformers: [],
      edges: [],
    };
    const mtBase: MtTopology = {
      poles: [],
      edges: [{ id: "e1", fromPoleId: "p1", toPoleId: "p2" }],
    };
    const result = mergeMtTopologyWithBtPoles(btTopology, mtBase);
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].id).toBe("e1");
  });

  it("handles undefined btTopology gracefully", () => {
    const mtBase: MtTopology = { poles: [makeMtPole()], edges: [] };
    const result = mergeMtTopologyWithBtPoles(undefined, mtBase);
    expect(result).toEqual(mtBase);
  });

  it("handles undefined mtTopology by using an empty MT base", () => {
    const btTopology: BtTopology = {
      poles: [{ id: "p1", lat: 0, lng: 0, title: "P-01" }],
      transformers: [],
      edges: [],
    };
    const result = mergeMtTopologyWithBtPoles(btTopology, undefined);
    expect(result.poles).toHaveLength(1);
    expect(result.poles[0].id).toBe("p1");
  });
});
