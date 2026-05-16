import { describe, it, expect } from "vitest";
import {
  getPoleClandestinoClients,
  getPoleNormalClients,
  getPolesPendingNormalClassification,
  migrateClandestinoToDefaultNormalType,
} from "../../src/utils/btPoleProjectTypeUtils";
import { CLANDESTINO_RAMAL_TYPE } from "../../src/utils/btNormalization";
import type { BtPoleNode, BtTopology } from "../../src/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePole(
  id: string,
  ramais: BtPoleNode["ramais"] = [],
): BtPoleNode {
  return { id, lat: 0, lng: 0, title: `Poste ${id}`, ramais };
}

const NORMAL_TYPE = "Normal";

// ---------------------------------------------------------------------------
// getPoleClandestinoClients
// ---------------------------------------------------------------------------

describe("getPoleClandestinoClients", () => {
  it("returns 0 for a pole with no ramais", () => {
    const pole = makePole("p1", []);
    expect(getPoleClandestinoClients(pole)).toBe(0);
  });

  it("returns 0 for a pole with undefined ramais", () => {
    const pole = makePole("p1");
    expect(getPoleClandestinoClients(pole)).toBe(0);
  });

  it("counts clandestino ramal quantities", () => {
    const pole = makePole("p1", [
      { ramalType: CLANDESTINO_RAMAL_TYPE, quantity: 3 },
      { ramalType: NORMAL_TYPE, quantity: 2 },
    ]);
    expect(getPoleClandestinoClients(pole)).toBe(3);
  });

  it("treats a ramal with undefined ramalType as clandestino", () => {
    const pole = makePole("p1", [
      { quantity: 4 } as BtPoleNode["ramais"] extends Array<infer R> ? R : never,
    ]);
    expect(getPoleClandestinoClients(pole)).toBe(4);
  });

  it("sums multiple clandestino ramais", () => {
    const pole = makePole("p1", [
      { ramalType: CLANDESTINO_RAMAL_TYPE, quantity: 2 },
      { ramalType: CLANDESTINO_RAMAL_TYPE, quantity: 3 },
    ]);
    expect(getPoleClandestinoClients(pole)).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// getPoleNormalClients
// ---------------------------------------------------------------------------

describe("getPoleNormalClients", () => {
  it("returns 0 for a pole with no ramais", () => {
    const pole = makePole("p1", []);
    expect(getPoleNormalClients(pole)).toBe(0);
  });

  it("counts only non-clandestino ramal quantities", () => {
    const pole = makePole("p1", [
      { ramalType: CLANDESTINO_RAMAL_TYPE, quantity: 3 },
      { ramalType: NORMAL_TYPE, quantity: 5 },
    ]);
    expect(getPoleNormalClients(pole)).toBe(5);
  });

  it("excludes ramais with undefined ramalType (treated as clandestino)", () => {
    const pole = makePole("p1", [
      { quantity: 4 } as BtPoleNode["ramais"] extends Array<infer R> ? R : never,
      { ramalType: NORMAL_TYPE, quantity: 2 },
    ]);
    expect(getPoleNormalClients(pole)).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// getPolesPendingNormalClassification
// ---------------------------------------------------------------------------

describe("getPolesPendingNormalClassification", () => {
  it("returns an empty array for a topology with no clandestino clients", () => {
    const topology: BtTopology = {
      poles: [
        makePole("p1", [{ ramalType: NORMAL_TYPE, quantity: 2 }]),
      ],
      transformers: [],
      edges: [],
    };
    expect(getPolesPendingNormalClassification(topology)).toHaveLength(0);
  });

  it("includes poles that have at least one clandestino client", () => {
    const topology: BtTopology = {
      poles: [
        makePole("p1", [{ ramalType: CLANDESTINO_RAMAL_TYPE, quantity: 1 }]),
        makePole("p2", [{ ramalType: NORMAL_TYPE, quantity: 2 }]),
      ],
      transformers: [],
      edges: [],
    };
    const pending = getPolesPendingNormalClassification(topology);
    expect(pending).toHaveLength(1);
    expect(pending[0].poleId).toBe("p1");
    expect(pending[0].clandestinoClients).toBe(1);
  });

  it("returns entries with the pole title", () => {
    const pole = makePole("p1", [{ ramalType: CLANDESTINO_RAMAL_TYPE, quantity: 2 }]);
    const topology: BtTopology = { poles: [pole], transformers: [], edges: [] };
    const pending = getPolesPendingNormalClassification(topology);
    expect(pending[0].poleTitle).toBe(pole.title);
  });
});

// ---------------------------------------------------------------------------
// migrateClandestinoToDefaultNormalType
// ---------------------------------------------------------------------------

describe("migrateClandestinoToDefaultNormalType", () => {
  it("converts clandestino ramais to the provided normal type", () => {
    const topology: BtTopology = {
      poles: [
        makePole("p1", [
          { ramalType: CLANDESTINO_RAMAL_TYPE, quantity: 3 },
          { ramalType: NORMAL_TYPE, quantity: 1 },
        ]),
      ],
      transformers: [],
      edges: [],
    };

    const result = migrateClandestinoToDefaultNormalType(topology, "Monofásico");

    const pole = result.poles[0];
    expect(pole.ramais![0].ramalType).toBe("Monofásico");
    expect(pole.ramais![1].ramalType).toBe(NORMAL_TYPE);
  });

  it("converts ramais with undefined ramalType (treated as clandestino)", () => {
    const pole = makePole("p1", [
      { quantity: 2 } as BtPoleNode["ramais"] extends Array<infer R> ? R : never,
    ]);
    const topology: BtTopology = { poles: [pole], transformers: [], edges: [] };

    const result = migrateClandestinoToDefaultNormalType(topology, "Bifásico");
    expect(result.poles[0].ramais![0].ramalType).toBe("Bifásico");
  });

  it("does not mutate the original topology", () => {
    const ramal = { ramalType: CLANDESTINO_RAMAL_TYPE, quantity: 1 };
    const topology: BtTopology = {
      poles: [makePole("p1", [ramal])],
      transformers: [],
      edges: [],
    };

    migrateClandestinoToDefaultNormalType(topology, "Normal");
    expect(ramal.ramalType).toBe(CLANDESTINO_RAMAL_TYPE);
  });

  it("handles a topology with no poles", () => {
    const topology: BtTopology = { poles: [], transformers: [], edges: [] };
    const result = migrateClandestinoToDefaultNormalType(topology, "Normal");
    expect(result.poles).toHaveLength(0);
  });
});
