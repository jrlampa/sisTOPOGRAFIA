/**
 * canonicalTopologyRepository.test.ts
 * Testa o repositório de topologia canônica Poste-Driven com multi-tenancy.
 */
import { vi } from "vitest";

const unsafeMock = vi.fn();

vi.mock("../repositories/dbClient", () => ({
  getDbClient: vi.fn(() => ({ unsafe: unsafeMock })),
}));

vi.mock("../utils/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { PostgresCanonicalTopologyRepository } from "../repositories/canonicalTopologyRepository";
import { getDbClient } from "../repositories/dbClient";

const getDbClientMock = getDbClient as vi.Mock;
const TEST_TENANT = "tenant-repo-test";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePoleRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "P-001",
    tenant_id: TEST_TENANT,
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
    tenant_id: TEST_TENANT,
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
    vi.clearAllMocks();
    getDbClientMock.mockReturnValue({ unsafe: unsafeMock });
    repo = new PostgresCanonicalTopologyRepository();
  });

  // ── readPoles ────────────────────────────────────────────────────────────

  describe("readPoles", () => {
    it("retorna array vazio quando DB indisponível", async () => {
      getDbClientMock.mockReturnValueOnce(null);
      const result = await repo.readPoles(TEST_TENANT);
      expect(result).toEqual([]);
      expect(unsafeMock).not.toHaveBeenCalled();
    });

    it("mapeia linha DB para CanonicalPoleNode corretamente", async () => {
      unsafeMock.mockResolvedValueOnce([makePoleRow()]);
      const result = await repo.readPoles(TEST_TENANT);
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

    it("passa filtro tenant_id e source na query quando especificado", async () => {
      unsafeMock.mockResolvedValueOnce([]);
      await repo.readPoles(TEST_TENANT, "legacy_bt");
      expect(unsafeMock).toHaveBeenCalledTimes(1);
      expect(unsafeMock.mock.calls[0][1]).toEqual([TEST_TENANT, "legacy_bt"]);
    });

    it("retorna array vazio em caso de erro SQL", async () => {
      unsafeMock.mockRejectedValueOnce(new Error("SQL error"));
      const result = await repo.readPoles(TEST_TENANT);
      expect(result).toEqual([]);
    });

    it("deserializa bt_structures de string JSON", async () => {
      const structures = { qty: 2, type: "DT" };
      unsafeMock.mockResolvedValueOnce([
        makePoleRow({ bt_structures: JSON.stringify(structures) }),
      ]);
      const result = await repo.readPoles(TEST_TENANT);
      expect(result[0].btStructures).toEqual(structures);
    });

    it("aceita bt_structures como objeto (já parseado pelo driver)", async () => {
      const structures = { qty: 1, type: "SE" };
      unsafeMock.mockResolvedValueOnce([
        makePoleRow({ bt_structures: structures }),
      ]);
      const result = await repo.readPoles(TEST_TENANT);
      expect(result[0].btStructures).toEqual(structures);
    });

    it("extrai lat/lng via geom_json (GeoJSON do PostGIS) com sucesso", async () => {
      const geom = { type: "Point", coordinates: [-46.123, -23.456] };
      unsafeMock.mockResolvedValueOnce([
        makePoleRow({ 
          geom_json: JSON.stringify(geom),
          lat: 0, // Garante que não está pegando das colunas lat/lng
          lng: 0 
        }),
      ]);
      const result = await repo.readPoles(TEST_TENANT);
      expect(result[0].lat).toBe(-23.456);
      expect(result[0].lng).toBe(-46.123);
    });
  });

  // ── readEdges ────────────────────────────────────────────────────────────

  describe("readEdges", () => {
    it("retorna array vazio quando DB indisponível", async () => {
      getDbClientMock.mockReturnValueOnce(null);
      const result = await repo.readEdges(TEST_TENANT);
      expect(result).toEqual([]);
    });

    it("mapeia linha DB para CanonicalNetworkEdge corretamente", async () => {
      unsafeMock.mockResolvedValueOnce([makeEdgeRow()]);
      const result = await repo.readEdges(TEST_TENANT);
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

    it("passa filtro tenant_id e source na query quando especificado", async () => {
      unsafeMock.mockResolvedValueOnce([]);
      await repo.readEdges(TEST_TENANT, "legacy_mt");
      expect(unsafeMock).toHaveBeenCalledTimes(1);
      expect(unsafeMock.mock.calls[0][1]).toEqual([TEST_TENANT, "legacy_mt"]);
    });

    it("retorna array vazio em caso de erro SQL", async () => {
      unsafeMock.mockRejectedValueOnce(new Error("SQL error"));
      const result = await repo.readEdges(TEST_TENANT);
      expect(result).toEqual([]);
    });
  });

  // ── countCanonical ───────────────────────────────────────────────────────

  describe("countCanonical", () => {
    it("retorna zeros quando DB indisponível", async () => {
      getDbClientMock.mockReturnValueOnce(null);
      const result = await repo.countCanonical(TEST_TENANT);
      expect(result).toEqual({ poles: 0, edges: 0 });
    });

    it("retorna contagens corretas para o tenant", async () => {
      unsafeMock
        .mockResolvedValueOnce([{ cnt: "15" }])
        .mockResolvedValueOnce([{ cnt: "30" }]);
      const result = await repo.countCanonical(TEST_TENANT);
      expect(result).toEqual({ poles: 15, edges: 30 });
      expect(unsafeMock.mock.calls[0][1]).toEqual([TEST_TENANT]);
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

      const result = await repo.readTopology(TEST_TENANT);
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

      const result = await repo.readTopology(TEST_TENANT, "task-legado-123");
      expect(result.source).toBe("legacy");
      expect(result.poleCount).toBe(1);
      expect(result.topology.poles[0]).toMatchObject({
        id: "P-L01",
        hasBt: true,
      });
    });

    it("forceLegacy ignora canônico mesmo com dados disponíveis", async () => {
      // countCanonical: poles=10, edges=5
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

      const result = await repo.readTopology(TEST_TENANT, "task-123", true);
      expect(result.source).toBe("legacy");
      expect(result.topology.poles[0].id).toBe("P-F01");
    });

    it("retorna topologia vazia quando canônico vazio e sem taskId", async () => {
      unsafeMock
        .mockResolvedValueOnce([{ cnt: "0" }])
        .mockResolvedValueOnce([{ cnt: "0" }]);

      const result = await repo.readTopology(TEST_TENANT);
      expect(result.source).toBe("canonical");
      expect(result.poleCount).toBe(0);
      expect(result.edgeCount).toBe(0);
      expect(result.topology).toEqual({ poles: [], edges: [], transformers: [] });
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

      const result = await repo.readTopology(TEST_TENANT, "task-abc");
      // Mesmo id → mesclado em um único poste com hasBt=true e hasMt=true
      const poles = result.topology.poles.filter((p) => p.id === "P-C01");
      expect(poles).toHaveLength(1);
      expect(poles[0].hasBt).toBe(true);
      expect(poles[0].hasMt).toBe(true);
    });
  });
});
