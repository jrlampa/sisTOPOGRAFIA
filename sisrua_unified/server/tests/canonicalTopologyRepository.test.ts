/**
 * canonicalTopologyRepository.test.ts
 * Testa o repositório de topologia canônica Poste-Driven.
 *
 * Cobre:
 *   - readPoles: DB indisponível, leitura com e sem filtro de source, erro SQL
 *   - readEdges: DB indisponível, leitura com e sem filtro de source, erro SQL
 *   - countCanonical: DB indisponível, contagem correta
 *   - readTopology: leitura canônica quando há dados, fallback legado quando vazio,
 *                   forceLegacy ignora canônico, sem dados retorna topologia vazia
 */
import { jest } from "@jest/globals";

const unsafeMock = jest.fn();

jest.mock("../repositories/dbClient", () => ({
  getDbClient: jest.fn(() => ({ unsafe: unsafeMock })),
}));

jest.mock("../utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { PostgresCanonicalTopologyRepository } from "../repositories/canonicalTopologyRepository";
import { getDbClient } from "../repositories/dbClient";

const getDbClientMock = getDbClient as jest.Mock;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePoleRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "P-001",
    lat: -23.5505,
    lng: -46.6333,
    title: "Poste 001",
    has_bt: true,
    has_mt: false,
    bt_structures: null,
    mt_structures: null,
    ramais: null,
    pole_spec: null,
    condition_status: "bom_estado",
    equipment_notes: null,
    general_notes: null,
    circuit_break_point: false,
    verified: true,
    node_change_flag: "existing",
    ...overrides,
  };
}

function makeEdgeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "E-001",
    from_pole_id: "P-001",
    to_pole_id: "P-002",
    length_meters: 42.5,
    cqt_length_meters: null,
    bt_conductors: null,
    mt_conductors: null,
    bt_replacement_conductors: null,
    remove_on_execution: false,
    verified: true,
    edge_change_flag: "existing",
    ...overrides,
  };
}

// ─── Testes ───────────────────────────────────────────────────────────────────

describe("PostgresCanonicalTopologyRepository", () => {
  let repo: PostgresCanonicalTopologyRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    getDbClientMock.mockReturnValue({ unsafe: unsafeMock });
    repo = new PostgresCanonicalTopologyRepository();
  });

  // ── readPoles ────────────────────────────────────────────────────────────

  describe("readPoles", () => {
    it("retorna array vazio quando DB indisponível", async () => {
      getDbClientMock.mockReturnValueOnce(null);
      const result = await repo.readPoles();
      expect(result).toEqual([]);
      expect(unsafeMock).not.toHaveBeenCalled();
    });

    it("mapeia linha DB para CanonicalPoleNode corretamente", async () => {
      unsafeMock.mockResolvedValueOnce([makePoleRow()]);
      const result = await repo.readPoles();
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: "P-001",
        lat: -23.5505,
        lng: -46.6333,
        title: "Poste 001",
        hasBt: true,
        hasMt: false,
        conditionStatus: "bom_estado",
        verified: true,
        nodeChangeFlag: "existing",
      });
    });

    it("passa filtro source na query quando especificado", async () => {
      unsafeMock.mockResolvedValueOnce([]);
      await repo.readPoles("legacy_bt");
      expect(unsafeMock).toHaveBeenCalledTimes(1);
      expect(unsafeMock.mock.calls[0][1]).toEqual(["legacy_bt"]);
    });

    it("retorna array vazio em caso de erro SQL", async () => {
      unsafeMock.mockRejectedValueOnce(new Error("SQL error"));
      const result = await repo.readPoles();
      expect(result).toEqual([]);
    });

    it("deserializa bt_structures de string JSON", async () => {
      const structures = { qty: 2, type: "DT" };
      unsafeMock.mockResolvedValueOnce([
        makePoleRow({ bt_structures: JSON.stringify(structures) }),
      ]);
      const result = await repo.readPoles();
      expect(result[0].btStructures).toEqual(structures);
    });

    it("aceita bt_structures como objeto (já parseado pelo driver)", async () => {
      const structures = { qty: 1, type: "SE" };
      unsafeMock.mockResolvedValueOnce([
        makePoleRow({ bt_structures: structures }),
      ]);
      const result = await repo.readPoles();
      expect(result[0].btStructures).toEqual(structures);
    });
  });

  // ── readEdges ────────────────────────────────────────────────────────────

  describe("readEdges", () => {
    it("retorna array vazio quando DB indisponível", async () => {
      getDbClientMock.mockReturnValueOnce(null);
      const result = await repo.readEdges();
      expect(result).toEqual([]);
    });

    it("mapeia linha DB para CanonicalNetworkEdge corretamente", async () => {
      unsafeMock.mockResolvedValueOnce([makeEdgeRow()]);
      const result = await repo.readEdges();
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: "E-001",
        fromPoleId: "P-001",
        toPoleId: "P-002",
        lengthMeters: 42.5,
        verified: true,
        edgeChangeFlag: "existing",
      });
    });

    it("passa filtro source na query quando especificado", async () => {
      unsafeMock.mockResolvedValueOnce([]);
      await repo.readEdges("legacy_mt");
      expect(unsafeMock.mock.calls[0][1]).toEqual(["legacy_mt"]);
    });

    it("retorna undefined para cqtLengthMeters quando null", async () => {
      unsafeMock.mockResolvedValueOnce([
        makeEdgeRow({ cqt_length_meters: null }),
      ]);
      const result = await repo.readEdges();
      expect(result[0].cqtLengthMeters).toBeUndefined();
    });

    it("retorna array vazio em caso de erro SQL", async () => {
      unsafeMock.mockRejectedValueOnce(new Error("SQL error"));
      const result = await repo.readEdges();
      expect(result).toEqual([]);
    });
  });

  // ── countCanonical ───────────────────────────────────────────────────────

  describe("countCanonical", () => {
    it("retorna zeros quando DB indisponível", async () => {
      getDbClientMock.mockReturnValueOnce(null);
      const result = await repo.countCanonical();
      expect(result).toEqual({ poles: 0, edges: 0 });
    });

    it("retorna contagens corretas quando DB disponível", async () => {
      unsafeMock
        .mockResolvedValueOnce([{ cnt: "15" }])
        .mockResolvedValueOnce([{ cnt: "30" }]);
      const result = await repo.countCanonical();
      expect(result).toEqual({ poles: 15, edges: 30 });
    });

    it("retorna zeros em caso de erro SQL", async () => {
      unsafeMock.mockRejectedValue(new Error("SQL error"));
      const result = await repo.countCanonical();
      expect(result).toEqual({ poles: 0, edges: 0 });
    });
  });

  // ── readTopology ─────────────────────────────────────────────────────────

  describe("readTopology", () => {
    it("usa leitura canônica quando canonical_poles não está vazio", async () => {
      // countCanonical: poles=5, edges=3
      unsafeMock
        .mockResolvedValueOnce([{ cnt: "5" }]) // count poles
        .mockResolvedValueOnce([{ cnt: "3" }]) // count edges
        .mockResolvedValueOnce([makePoleRow()]) // readPoles
        .mockResolvedValueOnce([makeEdgeRow()]); // readEdges

      const result = await repo.readTopology();
      expect(result.source).toBe("canonical");
      expect(result.poleCount).toBe(1);
      expect(result.edgeCount).toBe(1);
    });

    it("ativa fallback legado quando canônico está vazio e taskId fornecido", async () => {
      // countCanonical: poles=0 → cai no fallback
      unsafeMock
        .mockResolvedValueOnce([{ cnt: "0" }]) // count poles
        .mockResolvedValueOnce([{ cnt: "0" }]) // count edges
        .mockResolvedValueOnce([
          // query legado
          {
            bt_topology: JSON.stringify({
              poles: [{ id: "P-L01", lat: -23.5, lng: -46.6, title: "Legado" }],
              edges: [],
              transformers: [],
            }),
            mt_topology: null,
          },
        ]);

      const result = await repo.readTopology("task-legado-123");
      expect(result.source).toBe("legacy");
      expect(result.poleCount).toBe(1);
      expect(result.topology.poles[0]).toMatchObject({
        id: "P-L01",
        hasBt: true,
      });
    });

    it("forceLegacy ignora canônico mesmo com dados disponíveis", async () => {
      // countCanonical seria chamado, mas forceLegacy=true pula direto para legado
      unsafeMock
        .mockResolvedValueOnce([{ cnt: "10" }]) // count poles
        .mockResolvedValueOnce([{ cnt: "5" }]) // count edges
        .mockResolvedValueOnce([
          // query legado
          {
            bt_topology: JSON.stringify({
              poles: [
                { id: "P-F01", lat: -23.0, lng: -46.0, title: "Forçado" },
              ],
              edges: [],
              transformers: [],
            }),
            mt_topology: null,
          },
        ]);

      const result = await repo.readTopology("task-123", true);
      expect(result.source).toBe("legacy");
      expect(result.topology.poles[0].id).toBe("P-F01");
    });

    it("retorna topologia vazia quando canônico vazio e sem taskId", async () => {
      unsafeMock
        .mockResolvedValueOnce([{ cnt: "0" }])
        .mockResolvedValueOnce([{ cnt: "0" }]);

      const result = await repo.readTopology();
      expect(result.source).toBe("canonical");
      expect(result.poleCount).toBe(0);
      expect(result.edgeCount).toBe(0);
      expect(result.topology).toEqual({ poles: [], edges: [] });
    });

    it("mescla postes BT e MT do legado pelo mesmo id", async () => {
      unsafeMock
        .mockResolvedValueOnce([{ cnt: "0" }])
        .mockResolvedValueOnce([{ cnt: "0" }])
        .mockResolvedValueOnce([
          {
            bt_topology: JSON.stringify({
              poles: [{ id: "P-C01", lat: -23.5, lng: -46.6, title: "Comum" }],
              edges: [],
              transformers: [],
            }),
            mt_topology: JSON.stringify({
              poles: [{ id: "P-C01", lat: -23.5, lng: -46.6, title: "Comum" }],
              edges: [],
            }),
          },
        ]);

      const result = await repo.readTopology("task-abc");
      // Mesmo id → mesclado em um único poste com hasBt=true e hasMt=true
      const poles = result.topology.poles.filter((p) => p.id === "P-C01");
      expect(poles).toHaveLength(1);
      expect(poles[0].hasBt).toBe(true);
      expect(poles[0].hasMt).toBe(true);
    });
  });
});
