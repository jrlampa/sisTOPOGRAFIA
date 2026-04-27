/**
 * useDgOptimization.test.ts — Vitest: hook de otimização DG (Design Generativo).
 * Testa conversão de topologia BT → payload DG, chamadas fetch e acceptance handlers.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDgOptimization } from "../../src/hooks/useDgOptimization";
import type { BtTopology } from "../../src/types";

// ─── Fixtures ──────────────────────────────────────────────────────────────────

const MOCK_TOPOLOGY: BtTopology = {
  poles: [
    { id: "p1", lat: -22.9, lng: -43.1, title: "P1", ramais: [] },
    { id: "p2", lat: -22.91, lng: -43.11, title: "P2", ramais: [] },
  ],
  transformers: [
    {
      id: "t1",
      lat: -22.905,
      lng: -43.105,
      title: "TRAFO1",
      projectPowerKva: 75,
      demandKva: 30,
      monthlyBillBrl: 0,
      readings: [],
    },
  ],
  edges: [
    {
      id: "e1",
      fromPoleId: "p1",
      toPoleId: "p2",
      lengthMeters: 30,
      conductors: [{ id: "c1", quantity: 1, conductorName: "cu16" }],
    },
  ],
};

const MOCK_SCENARIO = {
  scenarioId: "sc-1",
  trafoPositionLatLon: { lat: -22.906, lon: -43.106 },
  edges: [
    { fromPoleId: "p1", toPoleId: "p2", lengthMeters: 28, conductorId: "cu16" },
  ],
  electricalResult: {
    cqtMaxFraction: 0.05,
    worstTerminalNodeId: "p2",
    trafoUtilizationFraction: 0.4,
    totalCableLengthMeters: 28,
    feasible: true,
  },
  objectiveScore: 82.5,
  scoreComponents: {
    cableCostScore: 80,
    poleCostScore: 90,
    trafoCostScore: 85,
    cqtPenaltyScore: 75,
    overloadPenaltyScore: 88,
  },
  violations: [],
  feasible: true,
};

const MOCK_OUTPUT = {
  runId: "run-abc-123",
  computedAt: "2026-04-21T00:00:00.000Z",
  totalCandidatesEvaluated: 10,
  totalFeasible: 3,
  recommendation: {
    bestScenario: MOCK_SCENARIO,
    alternatives: [],
    discardedCount: 7,
    discardReasonSummary: { MAX_SPAN_EXCEEDED: 4, CQT_LIMIT_EXCEEDED: 3 },
  },
  params: { maxSpanMeters: 40 },
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function mockFetchSuccess(data: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(data),
    }),
  );
}

function mockFetchError(statusText = "Serviço indisponível") {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: () => Promise.resolve({ error: statusText }),
    }),
  );
}

// ─── Testes ────────────────────────────────────────────────────────────────────

describe("useDgOptimization", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("estado inicial: sem otimização em andamento e sem resultado", () => {
    const { result } = renderHook(() => useDgOptimization());
    expect(result.current.isOptimizing).toBe(false);
    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("não dispara fetch quando topologia não tem postes", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useDgOptimization());
    await act(async () => {
      await result.current.runDgOptimization({
        poles: [],
        transformers: [],
        edges: [],
      });
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("dispara fetch em modo full_project quando não há transformador", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(MOCK_OUTPUT),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useDgOptimization());
    await act(async () => {
      await result.current.runDgOptimization({
        ...MOCK_TOPOLOGY,
        transformers: [],
      });
    });
    expect(fetchMock).toHaveBeenCalled();
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.params.projectMode).toBe("full_project");
  });

  it("chama POST /api/dg/optimize com payload correto e modo otimização quando há trafo", async () => {
    mockFetchSuccess(MOCK_OUTPUT);
    const { result } = renderHook(() => useDgOptimization());
    await act(async () => {
      await result.current.runDgOptimization(MOCK_TOPOLOGY);
    });

    const [url, options] = (global.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0] as [string, RequestInit];
    expect(url).toBe("/api/dg/optimize");
    expect(options.method).toBe("POST");
    const body = JSON.parse(options.body as string);
    expect(body.poles).toHaveLength(2);
    expect(body.params.projectMode).toBe("optimization");
    expect(body.transformer.id).toBe("t1");
  });

  it("armazena resultado após execução bem-sucedida", async () => {
    mockFetchSuccess(MOCK_OUTPUT);
    const { result } = renderHook(() => useDgOptimization());
    await act(async () => {
      await result.current.runDgOptimization(MOCK_TOPOLOGY);
    });
    expect(result.current.isOptimizing).toBe(false);
    expect(result.current.result?.runId).toBe("run-abc-123");
    expect(result.current.result?.totalFeasible).toBe(3);
    expect(result.current.error).toBeNull();
  });

  it("armazena erro quando a API retorna status de falha", async () => {
    mockFetchError("Serviço indisponível");
    const { result } = renderHook(() => useDgOptimization());
    await act(async () => {
      await result.current.runDgOptimization(MOCK_TOPOLOGY);
    });
    expect(result.current.result).toBeNull();
    expect(result.current.error).toBe("Serviço indisponível");
  });

  it("clearDgResult limpa resultado e erro", async () => {
    mockFetchSuccess(MOCK_OUTPUT);
    const { result } = renderHook(() => useDgOptimization());
    await act(async () => {
      await result.current.runDgOptimization(MOCK_TOPOLOGY);
    });
    act(() => {
      result.current.clearDgResult();
    });
    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("applyDgAll move trafo e substitui condutores", () => {
    const { result } = renderHook(() => useDgOptimization());
    const nextTopology = result.current.applyDgAll(
      MOCK_TOPOLOGY,
      MOCK_SCENARIO,
    );
    expect(nextTopology.transformers[0].lat).toBe(
      MOCK_SCENARIO.trafoPositionLatLon.lat,
    );
    expect(nextTopology.transformers[0].lng).toBe(
      MOCK_SCENARIO.trafoPositionLatLon.lon,
    );
    // Deve ter 1 aresta correspondente ao cenário DG
    expect(nextTopology.edges).toHaveLength(1);
    expect(nextTopology.edges[0].fromPoleId).toBe("p1");
    expect(nextTopology.edges[0].toPoleId).toBe("p2");
    expect(nextTopology.edges[0].lengthMeters).toBe(28);
  });

  it("applyDgAll reutiliza aresta existente quando par de postes coincide", () => {
    const { result } = renderHook(() => useDgOptimization());
    const nextTopology = result.current.applyDgAll(
      MOCK_TOPOLOGY,
      MOCK_SCENARIO,
    );
    // A aresta "e1" (p1→p2) deve ser reutilizada (mesmo par), não uma nova
    expect(nextTopology.edges[0].id).toBe("e1");
    expect(nextTopology.edges[0].lengthMeters).toBe(28); // length atualizado
  });

  it("applyDgTrafoOnly move apenas o trafo, sem alterar condutores", () => {
    const { result } = renderHook(() => useDgOptimization());
    const nextTopology = result.current.applyDgTrafoOnly(
      MOCK_TOPOLOGY,
      MOCK_SCENARIO,
    );
    expect(nextTopology.transformers[0].lat).toBe(
      MOCK_SCENARIO.trafoPositionLatLon.lat,
    );
    expect(nextTopology.transformers[0].lng).toBe(
      MOCK_SCENARIO.trafoPositionLatLon.lon,
    );
    // Condutores/arestas não devem ter mudado
    expect(nextTopology.edges).toStrictEqual(MOCK_TOPOLOGY.edges);
  });

  it("applyDgAll não modifica transformadores adicionais além do primeiro", () => {
    const topologyWithTwo = {
      ...MOCK_TOPOLOGY,
      transformers: [
        ...MOCK_TOPOLOGY.transformers,
        { ...MOCK_TOPOLOGY.transformers[0], id: "t2", title: "TRAFO2" },
      ],
    };
    const { result } = renderHook(() => useDgOptimization());
    const next = result.current.applyDgAll(topologyWithTwo, MOCK_SCENARIO);
    expect(next.transformers).toHaveLength(2);
    expect(next.transformers[1].id).toBe("t2"); // segundo trafo inalterado
  });
});
