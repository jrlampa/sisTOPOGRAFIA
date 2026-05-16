import { describe, it, expect } from "vitest";
import { buildMtDxfContext } from "../../src/utils/mtDxfContext";
import type { MtTopology } from "../../src/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emptyTopology(): MtTopology {
  return { poles: [], edges: [] };
}

function makeTopology(overrides: Partial<MtTopology> = {}): MtTopology {
  return { ...emptyTopology(), ...overrides };
}

// ---------------------------------------------------------------------------
// buildMtDxfContext
// ---------------------------------------------------------------------------

describe("buildMtDxfContext", () => {
  it("returns topology: null for an empty MT topology", () => {
    const result = buildMtDxfContext(emptyTopology());
    expect(result.topology).toBeNull();
  });

  it("returns topology with poles when poles are present", () => {
    const topology = makeTopology({
      poles: [{ id: "p1", lat: -22.9, lng: -43.1, title: "P-01", verified: true }],
    });
    const result = buildMtDxfContext(topology);
    expect(result.topology).not.toBeNull();
    expect(result.topology!.poles).toHaveLength(1);
  });

  it("preserves pole fields: id, lat, lng, title, verified", () => {
    const topology = makeTopology({
      poles: [{ id: "p1", lat: -22.9, lng: -43.1, title: "P-01", verified: true }],
    });
    const pole = buildMtDxfContext(topology).topology!.poles[0];
    expect(pole.id).toBe("p1");
    expect(pole.lat).toBe(-22.9);
    expect(pole.lng).toBe(-43.1);
    expect(pole.title).toBe("P-01");
    expect(pole.verified).toBe(true);
  });

  it("defaults verified to false when undefined", () => {
    const topology = makeTopology({
      poles: [{ id: "p1", lat: 0, lng: 0, title: "P-01" }],
    });
    const pole = buildMtDxfContext(topology).topology!.poles[0];
    expect(pole.verified).toBe(false);
  });

  it("includes mtStructures when at least one structure value is non-empty", () => {
    const topology = makeTopology({
      poles: [
        {
          id: "p1",
          lat: 0,
          lng: 0,
          title: "P-01",
          mtStructures: { n1: "E1", n2: "  ", n3: "", n4: "T4" },
        },
      ],
    });
    const pole = buildMtDxfContext(topology).topology!.poles[0];
    expect(pole.mtStructures).toBeDefined();
    expect(pole.mtStructures!.n1).toBe("E1");
    expect(pole.mtStructures!.n4).toBe("T4");
    // Whitespace-only entries should be undefined
    expect(pole.mtStructures!.n2).toBeUndefined();
    expect(pole.mtStructures!.n3).toBeUndefined();
  });

  it("omits mtStructures entirely when all structure values are empty/whitespace", () => {
    const topology = makeTopology({
      poles: [
        {
          id: "p1",
          lat: 0,
          lng: 0,
          title: "P-01",
          mtStructures: { n1: "", n2: "  " },
        },
      ],
    });
    const pole = buildMtDxfContext(topology).topology!.poles[0];
    expect(pole.mtStructures).toBeUndefined();
  });

  it("maps edges preserving all fields", () => {
    const topology = makeTopology({
      poles: [{ id: "p1", lat: 0, lng: 0, title: "P-01" }],
      edges: [
        {
          id: "e1",
          fromPoleId: "p1",
          toPoleId: "p2",
          lengthMeters: 42,
          edgeChangeFlag: "new",
        },
      ],
    });
    const edge = buildMtDxfContext(topology).topology!.edges[0];
    expect(edge.id).toBe("e1");
    expect(edge.fromPoleId).toBe("p1");
    expect(edge.toPoleId).toBe("p2");
    expect(edge.lengthMeters).toBe(42);
    expect(edge.edgeChangeFlag).toBe("new");
  });

  it("returns topology with edges even when there are no poles", () => {
    const topology = makeTopology({
      edges: [{ id: "e1", fromPoleId: "p1", toPoleId: "p2" }],
    });
    const result = buildMtDxfContext(topology);
    expect(result.topology).not.toBeNull();
    expect(result.topology!.edges).toHaveLength(1);
  });

  it("handles missing edges array gracefully (undefined)", () => {
    const topology = { poles: [{ id: "p1", lat: 0, lng: 0, title: "P-01" }] } as MtTopology;
    const result = buildMtDxfContext(topology);
    expect(result.topology!.edges).toHaveLength(0);
  });
});
