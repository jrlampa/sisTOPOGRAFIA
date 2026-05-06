import { vi } from "vitest";
import { 
  enrichWithVoltagePropagation,
  calculateSectioningImpact
} from "../services/bt/btDerivedVoltagePropagation.js";
import { BtTopology, BtPoleAccumulatedDemand } from "../services/bt/btDerivedTypes.js";

// Mock constant lookup
vi.mock("../constants/cqtLookupTables.js", () => ({
  getCabosByScenario: vi.fn().mockReturnValue([
    { name: "MULTIPLEXADO_70", resistance: 0.443, reactance: 0.09, alpha: 0.004, divisorR: 1, ampacity: 216 },
    { name: "MULTIPLEXADO_35", resistance: 0.868, reactance: 0.1, alpha: 0.004, divisorR: 1, ampacity: 135 }
  ])
}));

describe("btDerivedVoltagePropagation", () => {
  const baseTopology: BtTopology = {
    poles: [
      { id: "P1", lat: -22.9, lng: -43.2 },
      { id: "P2", lat: -22.901, lng: -43.201 }
    ],
    transformers: [
      { id: "TR1", poleId: "P1", readings: [], projectPowerKva: 75 }
    ],
    edges: [
      { 
        fromPoleId: "P1", 
        toPoleId: "P2", 
        lengthMeters: 50, 
        conductors: [{ conductorName: "MULTIPLEXADO_70" }] 
      }
    ]
  };

  const baseAccumulated: BtPoleAccumulatedDemand[] = [
    { poleId: "P1", localClients: 2, accumulatedClients: 4, localTrechoDemandKva: 2.0, accumulatedDemandKva: 4.0 },
    { poleId: "P2", localClients: 2, accumulatedClients: 2, localTrechoDemandKva: 2.0, accumulatedDemandKva: 2.0 }
  ];

  describe("enrichWithVoltagePropagation", () => {
    it("should return identical array if topology is empty", () => {
      const emptyTopo: BtTopology = { poles: [], transformers: [], edges: [] };
      const result = enrichWithVoltagePropagation(emptyTopo, "geral", []);
      expect(result).toEqual([]);
    });

    it("should return identical array if no transformer (root) is found", () => {
      const noTrafoTopo = { ...baseTopology, transformers: [] };
      const result = enrichWithVoltagePropagation(noTrafoTopo, "geral", baseAccumulated);
      expect(result[0].dvAccumPercent).toBeUndefined();
    });

    it("should handle disjoint poles", () => {
      const disjointTopo: BtTopology = {
        ...baseTopology,
        poles: [...baseTopology.poles, { id: "P_ORFAN", lat: 0, lng: 0 }],
        edges: baseTopology.edges
      };
      const accumulated = [
        ...baseAccumulated,
        { poleId: "P_ORFAN", localClients: 1, accumulatedClients: 1, localTrechoDemandKva: 1, accumulatedDemandKva: 1 }
      ];
      const result = enrichWithVoltagePropagation(disjointTopo, "geral", accumulated);
      expect(result.find(p => p.poleId === "P_ORFAN")?.dvAccumPercent).toBeUndefined();
    });

    it("should correctly propagate voltage", () => {
      const result = enrichWithVoltagePropagation(baseTopology, "geral", baseAccumulated);
      const p1 = result.find(p => p.poleId === "P1");
      const p2 = result.find(p => p.poleId === "P2");
      expect(p1?.dvAccumPercent).toBeGreaterThan(0);
      expect(p2?.dvAccumPercent).toBeGreaterThan(p1!.dvAccumPercent!);
    });

    it("should prevent infinite loops in cyclic topologies", () => {
      const cyclicTopo: BtTopology = {
        ...baseTopology,
        edges: [
          ...baseTopology.edges,
          { fromPoleId: "P2", toPoleId: "P1", lengthMeters: 50, conductors: [{ conductorName: "MULTIPLEXADO_70" }] }
        ]
      };
      const result = enrichWithVoltagePropagation(cyclicTopo, "geral", baseAccumulated);
      expect(result).toHaveLength(2);
    });

    it("should handle edge cases with missing conductor properties", () => {
      const brokenTopo: BtTopology = {
        ...baseTopology,
        edges: [{ fromPoleId: "P1", toPoleId: "P2", lengthMeters: 50, conductors: [] }]
      };
      const result = enrichWithVoltagePropagation(brokenTopo, "geral", baseAccumulated);
      const p2 = result.find(p => p.poleId === "P2");
      expect(p2?.dvAccumPercent).toBe(result.find(p => p.poleId === "P1")?.dvAccumPercent);
    });

    it("should process transformer readings correctly", () => {
      const topoWithReadings: BtTopology = {
        ...baseTopology,
        transformers: [{
          id: "TR1", poleId: "P1", readings: [{ currentMaxA: 100, temperatureFactor: 1.1 }], projectPowerKva: 75
        }]
      };
      const result = enrichWithVoltagePropagation(topoWithReadings, "geral", baseAccumulated);
      expect(result).toBeDefined();
    });

    it("should handle clandestino project type and ramal calculations", () => {
      const topoWithRamais: BtTopology = {
        ...baseTopology,
        poles: [
          { id: "P1", lat: -22.9, lng: -43.2, ramais: [{ quantity: 5, ramalType: "Clandestino" }] },
          { id: "P2", lat: -22.901, lng: -43.201, ramais: [{ quantity: 2, ramalType: "Clandestino" }] }
        ]
      };
      const accumulated: BtPoleAccumulatedDemand[] = [
        { poleId: "P1", localClients: 5, accumulatedClients: 7, localTrechoDemandKva: 5, accumulatedDemandKva: 10 },
        { poleId: "P2", localClients: 2, accumulatedClients: 2, localTrechoDemandKva: 2, accumulatedDemandKva: 2 }
      ];
      const result = enrichWithVoltagePropagation(topoWithRamais, "clandestino", accumulated);
      const p1 = result.find(p => p.poleId === "P1");
      expect(p1?.worstRamalVoltageV).toBeDefined();
    });

    it("should handle edge cases with invalid electrical parameters", () => {
      const topoWithInvalidEdge = {
        ...baseTopology,
        edges: [{ ...baseTopology.edges[0], lengthMeters: -1 }]
      };
      const result = enrichWithVoltagePropagation(topoWithInvalidEdge, "geral", baseAccumulated);
      const p1 = result.find(p => p.poleId === "P1");
      const p2 = result.find(p => p.poleId === "P2");
      expect(p2?.dvAccumPercent).toBe(p1?.dvAccumPercent);
    });

    it("should return base accumulated if no active edges are found", () => {
      const topoWithRemovedEdges: BtTopology = {
        ...baseTopology,
        edges: [{ ...baseTopology.edges[0], edgeChangeFlag: "remove" }]
      };
      const result = enrichWithVoltagePropagation(topoWithRemovedEdges, "geral", baseAccumulated);
      expect(result).toEqual(baseAccumulated);
    });
  });

  describe("calculateSectioningImpact", () => {
    it("should return empty impact if topology has no poles", () => {
      const impact = calculateSectioningImpact({ poles: [], transformers: [], edges: [] }, "geral", 100);
      expect(impact.unservedPoleIds).toEqual([]);
    });

    it("should calculate impact for unserved poles", () => {
      const sectioningTopo: BtTopology = {
        ...baseTopology,
        transformers: [],
        edges: [] 
      };
      const impact = calculateSectioningImpact(sectioningTopo, "geral", 100);
      expect(impact.unservedPoleIds).toContain("P1");
      expect(impact.unservedPoleIds).toContain("P2");
    });

    it("should suggest a pole based on load center", () => {
      const poles: BtTopology["poles"] = [{ id: "PA", lat: 10, lng: 10 }, { id: "PB", lat: 11, lng: 11 }];
      const topo: BtTopology = { poles, transformers: [], edges: [] };
      const impact = calculateSectioningImpact(topo, "geral", 0);
      expect(impact.suggestedPoleId).toBeDefined();
    });
  });
});

