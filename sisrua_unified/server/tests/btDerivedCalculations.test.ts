/**
 * btDerivedCalculations.test.ts — Testes unitários para lógica de cálculo BT (111-120 [T1])
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getPoleClientsByProjectType,
  getClandestinoDemandKvaByAreaAndClients,
  calculateTransformerOwnershipData,
  calculateAccumulatedDemandByPole,
  calculateEstimatedDemandByTransformer,
  calculateSummary,
  calculateClandestinoDisplay
} from "../services/bt/btDerivedCalculations.js";
import { constantsService } from "../services/constantsService.js";
import { CLANDESTINO_RAMAL_TYPE } from "../services/bt/btDerivedConstants.js";

vi.mock("../services/constantsService.js", () => ({
  constantsService: {
    getSync: vi.fn(),
  },
}));

describe("btDerivedCalculations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getPoleClientsByProjectType", () => {
    const topology = {
      poles: [{
        id: "P1",
        ramais: [
          { ramalType: CLANDESTINO_RAMAL_TYPE, quantity: 5 },
          { ramalType: "RESIDENCIAL", quantity: 2 },
        ]
      }],
    };

    it("conta ramais clandestinos", () => {
      const count = getPoleClientsByProjectType("clandestino", topology as any, "P1");
      expect(count).toBe(5);
    });

    it("conta ramais normais", () => {
      const count = getPoleClientsByProjectType("ramais", topology as any, "P1");
      expect(count).toBe(2);
    });
  });

  describe("getClandestinoDemandKvaByAreaAndClients", () => {
    it("retorna 0 se constantes estiverem ausentes", () => {
      vi.mocked(constantsService.getSync).mockReturnValue(null);
      expect(getClandestinoDemandKvaByAreaAndClients(100, 10)).toBe(0);
    });

    it("calcula demanda clandestina via tabelas de lookup", () => {
      vi.mocked(constantsService.getSync).mockImplementation((ns, key) => {
        if (key === "AREA_TO_KVA") return { "100": 15 };
        if (key === "CLIENT_TO_DIVERSIF_FACTOR") return { "10": 0.8 };
        return null;
      });
      expect(getClandestinoDemandKvaByAreaAndClients(100, 10)).toBe(12);
    });
  });

  describe("calculateSummary", () => {
    it("gera resumo estatístico da topologia com leituras de trafo", () => {
      const topology = {
        poles: [{}, {}],
        transformers: [{ 
          demandKva: 10,
          readings: [
            { currentMaxA: 100, temperatureFactor: 1.1 }
          ]
        }],
        edges: [{ lengthMeters: 100 }],
      };
      const summary = calculateSummary(topology as any);
      expect(summary.poles).toBe(2);
      expect(summary.transformerDemandKva).toBeGreaterThan(0);
    });

    it("usa demandKva se readings estiver vazio", () => {
      const topology = {
        poles: [],
        transformers: [{ demandKva: 75, readings: [] }],
        edges: [],
      };
      const summary = calculateSummary(topology as any);
      expect(summary.transformerDemandKva).toBe(75);
    });
  });

  describe("calculateTransformerOwnershipData", () => {
    it("atribui postes ao transformador mais próximo", () => {
      const topology = {
        poles: [
          { id: "P1" },
          { id: "P2" },
          { id: "P3", circuitBreakPoint: true },
          { id: "P4" },
        ],
        transformers: [
          { id: "T1", poleId: "P1" },
          { id: "T2", poleId: "P4" },
        ],
        edges: [
          { fromPoleId: "P1", toPoleId: "P2" },
          { fromPoleId: "P2", toPoleId: "P3" },
          { fromPoleId: "P3", toPoleId: "P4" },
        ],
      };

      const result = calculateTransformerOwnershipData(topology as any, "ramais");
      expect(result.ownerTransformerByPole.get("P2")).toBe("T1");
      expect(result.ownerTransformerByPole.get("P4")).toBe("T2");
    });
  });

  describe("calculateAccumulatedDemandByPole", () => {
    it("calcula demanda acumulada seguindo a topologia", () => {
      const topology = {
        poles: [
          { id: "P1", ramais: [{ quantity: 10, ramalType: "Normal" }] }, 
          { id: "P2", ramais: [{ quantity: 5, ramalType: "Normal" }] },
        ],
        transformers: [{ id: "T1", poleId: "P1", demandKva: 15, readings: [] }],
        edges: [{ fromPoleId: "P1", toPoleId: "P2" }],
      };

      const result = calculateAccumulatedDemandByPole(topology as any, "ramais", 0);
      const p1 = result.find(r => r.poleId === "P1");
      const p2 = result.find(r => r.poleId === "P2");

      expect(p2?.accumulatedClients).toBe(5);
      expect(p1?.accumulatedClients).toBe(15);
    });
  });

  describe("calculateEstimatedDemandByTransformer", () => {
    it("calcula demanda estimada baseada em clientes atribuídos", () => {
      const topology = {
        poles: [
          { id: "P1", ramais: [{ quantity: 10, ramalType: "Normal" }] },
          { id: "P2", ramais: [{ quantity: 20, ramalType: "Normal" }] },
        ],
        transformers: [
          { id: "T1", poleId: "P1", readings: [], demandKva: 10 },
        ],
        edges: [{ fromPoleId: "P1", toPoleId: "P2" }],
      };
      const result = calculateEstimatedDemandByTransformer(topology as any, "ramais", 0);
      expect(result[0].assignedClients).toBe(30);
    });
  });

  describe("calculateClandestinoDisplay", () => {
    it("gera dados de exibição para modo clandestino", () => {
      vi.mocked(constantsService.getSync).mockImplementation((ns, key) => {
        if (key === "AREA_TO_KVA") return { "100": 20, "200": 30 };
        if (key === "CLIENT_TO_DIVERSIF_FACTOR") return { "10": 0.5 };
        return null;
      });

      const topology = {
        poles: [{ ramais: [{ quantity: 10 }] }],
        transformers: [],
        edges: []
      };

      const result = calculateClandestinoDisplay(topology as any, 100);
      expect(result.baseDemandKva).toBe(20);
      expect(result.diversificationFactor).toBe(0.5);
      expect(result.finalDemandKva).toBe(10);
    });

    it("lida com falta de dados de constante na exibição", () => {
      vi.mocked(constantsService.getSync).mockReturnValue(null);
      const topology = { poles: [], transformers: [], edges: [] };
      const result = calculateClandestinoDisplay(topology as any, 100);
      expect(result.areaMin).toBe(0);
      expect(result.areaMax).toBe(0);
      expect(result.finalDemandKva).toBe(0);
    });
  });
});
