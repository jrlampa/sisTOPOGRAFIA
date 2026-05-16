import { describe, it, expect } from "vitest";
import { findTransformerConflictsWithoutSectioning } from "../../src/utils/btTransformerConflicts";
import type { BtTopology } from "../../src/types";

const makePole = (id: string) => ({ id, lat: 0, lng: 0, title: id });
const makeTransformer = (id: string, poleId: string) => ({
  id,
  poleId,
  lat: 0,
  lng: 0,
  title: id,
});
const makeEdge = (id: string, from: string, to: string, remove = false) => ({
  id,
  fromPoleId: from,
  toPoleId: to,
  conductors: [],
  edgeChangeFlag: remove ? ("remove" as const) : ("existing" as const),
});

// ---------------------------------------------------------------------------
// findTransformerConflictsWithoutSectioning
// ---------------------------------------------------------------------------

describe("findTransformerConflictsWithoutSectioning", () => {
  it("returns [] when there is fewer than 2 transformers", () => {
    const topology: BtTopology = {
      poles: [makePole("P1")],
      transformers: [makeTransformer("T1", "P1")],
      edges: [],
    };
    expect(findTransformerConflictsWithoutSectioning(topology)).toEqual([]);
  });

  it("returns [] when there are no poles", () => {
    const topology: BtTopology = {
      poles: [],
      transformers: [makeTransformer("T1", "P1"), makeTransformer("T2", "P2")],
      edges: [],
    };
    expect(findTransformerConflictsWithoutSectioning(topology)).toEqual([]);
  });

  it("detects a conflict when two transformers share the same connected component", () => {
    // P1 --E1-- P2, T1 on P1, T2 on P2
    const topology: BtTopology = {
      poles: [makePole("P1"), makePole("P2")],
      transformers: [makeTransformer("T1", "P1"), makeTransformer("T2", "P2")],
      edges: [makeEdge("E1", "P1", "P2")],
    };
    const conflicts = findTransformerConflictsWithoutSectioning(topology);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].transformerIds).toContain("T1");
    expect(conflicts[0].transformerIds).toContain("T2");
  });

  it("returns [] when each transformer is in its own isolated island", () => {
    // P1 isolated with T1; P2 isolated with T2 → no edge between them
    const topology: BtTopology = {
      poles: [makePole("P1"), makePole("P2")],
      transformers: [makeTransformer("T1", "P1"), makeTransformer("T2", "P2")],
      edges: [], // no connection
    };
    expect(findTransformerConflictsWithoutSectioning(topology)).toEqual([]);
  });

  it("ignores edges marked for removal when building connectivity", () => {
    // P1 --E1(remove)-- P2 → they are disconnected
    const topology: BtTopology = {
      poles: [makePole("P1"), makePole("P2")],
      transformers: [makeTransformer("T1", "P1"), makeTransformer("T2", "P2")],
      edges: [makeEdge("E1", "P1", "P2", true)],
    };
    expect(findTransformerConflictsWithoutSectioning(topology)).toEqual([]);
  });

  it("segments at circuit-break poles (does not cross them)", () => {
    // P1 --E1-- P2(circuitBreak) --E2-- P3
    // T1 on P1, T2 on P3 – should NOT conflict because P2 breaks the circuit
    const topology: BtTopology = {
      poles: [
        makePole("P1"),
        { ...makePole("P2"), circuitBreakPoint: true },
        makePole("P3"),
      ],
      transformers: [makeTransformer("T1", "P1"), makeTransformer("T2", "P3")],
      edges: [
        makeEdge("E1", "P1", "P2"),
        makeEdge("E2", "P2", "P3"),
      ],
    };
    expect(findTransformerConflictsWithoutSectioning(topology)).toEqual([]);
  });

  it("skips transformer that references a pole not in the topology", () => {
    // T_orphan references "PX" which doesn't exist in poles
    const topology: BtTopology = {
      poles: [makePole("P1"), makePole("P2")],
      transformers: [
        makeTransformer("T1", "P1"),
        makeTransformer("T2", "P2"),
        { ...makeTransformer("T_orphan", "PX") },
      ],
      edges: [makeEdge("E1", "P1", "P2")],
    };
    const conflicts = findTransformerConflictsWithoutSectioning(topology);
    // T1 and T2 are in the same component → conflict
    expect(conflicts).toHaveLength(1);
    // T_orphan should not appear in conflict because PX doesn't exist
    const conflictIds = conflicts[0].transformerIds;
    expect(conflictIds).not.toContain("T_orphan");
  });

  it("skips edges that reference poles not in the topology", () => {
    // E2 references PX that doesn't exist – should be silently skipped
    const topology: BtTopology = {
      poles: [makePole("P1"), makePole("P2")],
      transformers: [makeTransformer("T1", "P1"), makeTransformer("T2", "P2")],
      edges: [
        makeEdge("E1", "P1", "PX"), // PX doesn't exist → skipped
        // P1 and P2 remain unconnected
      ],
    };
    expect(findTransformerConflictsWithoutSectioning(topology)).toEqual([]);
  });

  it("handles duplicate transformer on the same pole (deduplicates conflict ids)", () => {
    // Two transformer objects pointing to same pole in a connected component
    const topology: BtTopology = {
      poles: [makePole("P1"), makePole("P2")],
      transformers: [
        makeTransformer("T1", "P1"),
        makeTransformer("T2", "P1"), // both on P1
        makeTransformer("T3", "P2"),
      ],
      edges: [makeEdge("E1", "P1", "P2")],
    };
    const conflicts = findTransformerConflictsWithoutSectioning(topology);
    expect(conflicts).toHaveLength(1);
    // uniqueTransformerIds should have T1, T2, T3
    expect(conflicts[0].transformerIds).toHaveLength(3);
  });

  it("transformer with undefined poleId is skipped", () => {
    const topology: BtTopology = {
      poles: [makePole("P1"), makePole("P2")],
      transformers: [
        makeTransformer("T1", "P1"),
        { id: "T_no_pole", lat: 0, lng: 0, title: "TNoP" } as any, // no poleId
        makeTransformer("T2", "P2"),
      ],
      edges: [makeEdge("E1", "P1", "P2")],
    };
    const conflicts = findTransformerConflictsWithoutSectioning(topology);
    // T1 and T2 are in same component → conflict
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].transformerIds).not.toContain("T_no_pole");
  });
});
