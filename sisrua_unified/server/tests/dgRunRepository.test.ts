import { jest } from "@jest/globals";
import type { DgOptimizationOutput } from "../services/dg/dgTypes";

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

import { getDbClient } from "../repositories/dbClient";
import { logger } from "../utils/logger";
import { PostgresDgRunRepository } from "../repositories/dgRunRepository";

const getDbClientMock = getDbClient as jest.Mock;
const loggerWarnMock = logger.warn as jest.Mock;

function makeRun(runId: string): DgOptimizationOutput {
  const baseScenario = {
    trafoPositionUtm: { x: 333000, y: 7394000 },
    trafoPositionLatLon: { lat: -23.55, lon: -46.63 },
    edges: [
      {
        fromPoleId: "P1",
        toPoleId: "P2",
        lengthMeters: 22,
        conductorId: "95 AL MM",
      },
    ],
    electricalResult: {
      cqtMaxFraction: 0.03,
      worstTerminalNodeId: "P2",
      trafoUtilizationFraction: 0.7,
      totalCableLengthMeters: 22,
      feasible: true,
    },
    scoreComponents: {
      cableCostScore: 88,
      poleCostScore: 90,
      trafoCostScore: 85,
      cqtPenaltyScore: 100,
      overloadPenaltyScore: 100,
    },
  };

  const bestScenario = {
    scenarioId: `${runId}-S1`,
    candidateId: `${runId}-C1`,
    ...baseScenario,
    objectiveScore: 92,
    violations: [],
    feasible: true,
  };

  const alternativeScenario = {
    scenarioId: `${runId}-S2`,
    candidateId: `${runId}-C2`,
    ...baseScenario,
    objectiveScore: 87,
    violations: [
      {
        code: "MAX_SPAN_EXCEEDED" as const,
        detail: "Trecho P2-P3 acima do limite",
        entityId: "P2-P3",
      },
    ],
    feasible: false,
  };

  return {
    runId,
    inputHash: `hash-${runId}`,
    computedAt: "2026-04-22T13:00:00.000Z",
    totalCandidatesEvaluated: 2,
    totalFeasible: 1,
    recommendation: {
      bestScenario,
      alternatives: [alternativeScenario],
      discardedCount: 1,
      discardReasonSummary: {
        MAX_SPAN_EXCEEDED: 1,
        INSIDE_EXCLUSION_ZONE: 0,
        OUTSIDE_ROAD_CORRIDOR: 0,
        CQT_LIMIT_EXCEEDED: 0,
        TRAFO_OVERLOAD: 0,
        NON_RADIAL_TOPOLOGY: 0,
      },
    },
    allScenarios: [bestScenario, alternativeScenario],
    params: {
      maxSpanMeters: 40,
      minSpanMeters: 8,
      cqtLimitFraction: 0.08,
      trafoMaxUtilization: 0.95,
      searchMode: "exhaustive",
      maxCandidatesHeuristic: 200,
      objectiveWeights: {
        cableCost: 0.3,
        poleCost: 0.1,
        trafoCost: 0.15,
        cqtPenalty: 0.3,
        overloadPenalty: 0.15,
      },
      allowNewPoles: false,
    },
  };
}

describe("PostgresDgRunRepository", () => {
  let repo: PostgresDgRunRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    getDbClientMock.mockReturnValue({ unsafe: unsafeMock });
    unsafeMock.mockReset();
    repo = new PostgresDgRunRepository();
  });

  it("save: persiste run consolidada e artefatos normalizados", async () => {
    unsafeMock.mockResolvedValue([]);
    const run = makeRun("run-normalized-ok");

    await repo.save(run);

    const sqlCalls = unsafeMock.mock.calls.map((c) => c[0] as string);

    expect(sqlCalls.some((q) => q.includes("INSERT INTO dg_runs"))).toBe(true);
    expect(sqlCalls.some((q) => q === "BEGIN")).toBe(true);
    expect(sqlCalls.some((q) => q === "COMMIT")).toBe(true);
    expect(sqlCalls.filter((q) => q.includes("DELETE FROM dg_")).length).toBe(
      4,
    );
    // Agora é feito em BATCH (1 call em vez de 2)
    expect(
      sqlCalls.filter((q) => q.includes("INSERT INTO dg_candidates")).length,
    ).toBe(1);
    expect(
      sqlCalls.filter((q) => q.includes("INSERT INTO dg_scenarios")).length,
    ).toBe(2);
    expect(
      sqlCalls.filter((q) => q.includes("INSERT INTO dg_constraints")).length,
    ).toBe(1);
    expect(
      sqlCalls.filter((q) => q.includes("INSERT INTO dg_recommendations"))
        .length,
    ).toBe(2);
  });

  it("save: mantém fluxo quando persistência normalizada falha", async () => {
    unsafeMock.mockImplementation(async (query: string) => {
      if (query.includes("INSERT INTO dg_candidates")) {
        throw new Error("normalized write failed");
      }
      return [];
    });

    await expect(
      repo.save(makeRun("run-normalized-fail")),
    ).resolves.toBeUndefined();

    expect(unsafeMock).toHaveBeenCalled();
    expect(loggerWarnMock).toHaveBeenCalledWith(
      "[DgRunRepository] normalized save failed; run persisted in dg_runs",
      expect.objectContaining({ runId: "run-normalized-fail" }),
    );
  });

  it("save/findById: funciona com fallback em memória sem DB", async () => {
    getDbClientMock.mockReturnValueOnce(null);
    const run = makeRun("run-memory-only");

    await expect(repo.save(run)).resolves.toBeUndefined();
    await expect(repo.findById("run-memory-only")).resolves.toEqual(run);
  });

  it("findRecommendation/findScenarios: retorna dados da run salva", async () => {
    getDbClientMock.mockReturnValueOnce(null);
    const run = makeRun("run-read-helpers");

    await repo.save(run);

    const recommendation = await repo.findRecommendation("run-read-helpers");
    const scenarios = await repo.findScenarios("run-read-helpers");

    expect(recommendation?.bestScenario.scenarioId).toBe("run-read-helpers-S1");
    expect(scenarios).toHaveLength(2);
  });
});
