/**
 * Testes – Design Generativo: Pipeline Completo
 *
 * Cobre:
 *   - Geração de candidatos Fermat-Weber (convergência)
 *   - Avaliação de restrições duras
 *   - Scoring objetivo
 *   - Otimizador (exaustivo e heurístico)
 *   - Serviço de orquestração end-to-end
 */

import {
  latLonToUtm,
  utmToLatLon,
  euclideanDistanceM,
  fermatWeberCenter,
  generateCandidates,
  hashDgInput,
} from "../services/dg/dgCandidates";
import {
  evaluateHardConstraints,
  estimateCqt,
} from "../services/dg/dgConstraints";
import { calculateObjectiveScore } from "../services/dg/dgObjective";
import { runDgOptimizer } from "../services/dg/dgOptimizer";
import { runDgOptimization } from "../services/dgOptimizationService";
import {
  DEFAULT_DG_PARAMS,
  type DgPoleInput,
  type DgTransformerInput,
  type DgCandidate,
  type DgOptimizationInput,
} from "../services/dg/dgTypes";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/**
 * 4 postes agrupados em ~20-35m entre si (BT urbana, São Paulo, zona 23S).
 * Diferenças de 0.0001°lat ≈ 11.1 m, 0.0001°lon ≈ 10.2 m.
 * Garante que todos os vãos do MST (candidato ↔ postes) fiquem dentro de maxSpanMeters=40m.
 */
const POLES_4: DgPoleInput[] = [
  {
    id: "P1",
    position: { lat: -23.5489, lon: -46.6388 },
    demandKva: 15,
    clients: 3,
  },
  {
    id: "P2",
    position: { lat: -23.549, lon: -46.6386 },
    demandKva: 20,
    clients: 4,
  },
  {
    id: "P3",
    position: { lat: -23.5492, lon: -46.6387 },
    demandKva: 12,
    clients: 2,
  },
  {
    id: "P4",
    position: { lat: -23.5491, lon: -46.6389 },
    demandKva: 18,
    clients: 3,
  },
];

const TRAFO_75KVA: DgTransformerInput = {
  id: "TR75",
  position: { lat: -23.5491, lon: -46.6388 },
  kva: 75,
  currentDemandKva: 0,
};

const PARAMS_DEFAULT = { ...DEFAULT_DG_PARAMS };

// ─── Conversão UTM ─────────────────────────────────────────────────────────────

describe("latLonToUtm / utmToLatLon – roundtrip", () => {
  it("converte São Paulo (zona 23S) com erro < 30 m", () => {
    const { lat, lon } = POLES_4[0].position;
    const utm = latLonToUtm(lat, lon);
    const back = utmToLatLon(utm.x, utm.y);
    // Tolerância ~30m para aproximação UTM zona 23S (~0.0003°)
    expect(Math.abs(back.lat - lat)).toBeLessThan(0.0003);
    expect(Math.abs(back.lon - lon)).toBeLessThan(0.0003);
  });
});

// ─── Distância euclidiana ─────────────────────────────────────────────────────

describe("euclideanDistanceM", () => {
  it("retorna 0 para o mesmo ponto", () => {
    expect(euclideanDistanceM({ x: 100, y: 200 }, { x: 100, y: 200 })).toBe(0);
  });

  it("retorna 5 para triângulo 3-4-5 em metros", () => {
    expect(euclideanDistanceM({ x: 0, y: 0 }, { x: 3, y: 4 })).toBeCloseTo(
      5,
      5,
    );
  });
});

// ─── Fermat-Weber convergência ────────────────────────────────────────────────

describe("fermatWeberCenter", () => {
  it("converge para o centróide ponderado em rede simétrica", () => {
    // Postes equidistantes com demanda igual → centro geométrico
    const poles = [
      { positionUtm: { x: 0, y: 0 }, demandKva: 10 },
      { positionUtm: { x: 100, y: 0 }, demandKva: 10 },
      { positionUtm: { x: 50, y: 87 }, demandKva: 10 },
    ];
    const fw = fermatWeberCenter(poles as any);
    expect(fw.x).toBeCloseTo(50, 0);
    expect(fw.y).toBeCloseTo(29, 0); // Fermat-Weber ≠ centróide, mas próximo para demanda igual
  });

  it("retorna o único poste quando há apenas um", () => {
    const poles = [{ positionUtm: { x: 300, y: 400 }, demandKva: 5 }];
    const fw = fermatWeberCenter(poles as any);
    expect(fw.x).toBeCloseTo(300, 1);
    expect(fw.y).toBeCloseTo(400, 1);
  });
});

// ─── Geração de candidatos ────────────────────────────────────────────────────

describe("generateCandidates", () => {
  it("gera ao menos 2 candidatos (FW + centróide + postes existentes)", () => {
    const candidates = generateCandidates(POLES_4, PARAMS_DEFAULT);
    expect(candidates.length).toBeGreaterThanOrEqual(2 + POLES_4.length);
  });

  it("todos os candidatos têm posição UTM definida", () => {
    const candidates = generateCandidates(POLES_4, PARAMS_DEFAULT);
    for (const c of candidates) {
      expect(c.positionUtm.x).toBeTruthy();
      expect(c.positionUtm.y).toBeTruthy();
    }
  });

  it("modo B (allowNewPoles) adiciona candidatos de grid", () => {
    const modeB = { ...PARAMS_DEFAULT, allowNewPoles: true };
    const modeA = { ...PARAMS_DEFAULT, allowNewPoles: false };
    const countB = generateCandidates(POLES_4, modeB).length;
    const countA = generateCandidates(POLES_4, modeA).length;
    expect(countB).toBeGreaterThan(countA);
  });
});

// ─── Hash de entrada ──────────────────────────────────────────────────────────

describe("hashDgInput", () => {
  it("produz hash determinístico (mesmo input → mesmo hash)", () => {
    const h1 = hashDgInput(POLES_4, PARAMS_DEFAULT);
    const h2 = hashDgInput(POLES_4, PARAMS_DEFAULT);
    expect(h1).toBe(h2);
  });

  it("produz hash diferente para postes diferentes", () => {
    const altered = [
      ...POLES_4,
      { id: "P5", position: { lat: -23.55, lon: -46.64 }, demandKva: 5 },
    ];
    expect(hashDgInput(altered, PARAMS_DEFAULT)).not.toBe(
      hashDgInput(POLES_4, PARAMS_DEFAULT),
    );
  });
});

// ─── Estimativa CQT ───────────────────────────────────────────────────────────

describe("estimateCqt", () => {
  it("CQT aumenta com distância", () => {
    const origin = { x: 0, y: 0 };
    const poleClose = { positionUtm: { x: 50, y: 0 }, demandKva: 30 };
    const poleFar = { positionUtm: { x: 200, y: 0 }, demandKva: 30 };
    const cqtCurto = estimateCqt(origin, [poleClose]);
    const cqtLongo = estimateCqt(origin, [poleFar]);
    expect(cqtLongo).toBeGreaterThan(cqtCurto);
  });

  it("CQT zero quando poste coincide com trafo", () => {
    const origin = { x: 0, y: 0 };
    expect(
      estimateCqt(origin, [{ positionUtm: { x: 0, y: 0 }, demandKva: 30 }]),
    ).toBe(0);
  });
});

// ─── Restrições duras ──────────────────────────────────────────────────────────

describe("evaluateHardConstraints", () => {
  const makeCand = (x: number, y: number): DgCandidate => ({
    candidateId: "test",
    position: utmToLatLon(x, y),
    positionUtm: { x, y },
    weightedDistanceSum: 0,
    source: "fermat_weber",
  });

  it("candidate viável passa todas as restrições (sem polígonos/corredores)", () => {
    const poles = POLES_4;
    const cands = generateCandidates(poles, PARAMS_DEFAULT);
    const fw = cands[0]; // Fermat-Weber center
    const result = evaluateHardConstraints(
      fw,
      poles,
      TRAFO_75KVA,
      [],
      [],
      PARAMS_DEFAULT,
    );
    // Com 65 kVA demanda total em trafo 75 kVA, deve ser viável
    expect(result.feasible).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("rejeita quando demanda excede capacidade do trafo", () => {
    const overloadedTrafo: DgTransformerInput = { ...TRAFO_75KVA, kva: 10 };
    const cands = generateCandidates(POLES_4, PARAMS_DEFAULT);
    const result = evaluateHardConstraints(
      cands[0],
      POLES_4,
      overloadedTrafo,
      [],
      [],
      PARAMS_DEFAULT,
    );
    expect(result.feasible).toBe(false);
    const codes = result.violations.map((v) => v.code);
    expect(codes).toContain("TRAFO_OVERLOAD");
  });

  it("rejeita candidato dentro de polígono de exclusão", () => {
    const cands = generateCandidates(POLES_4, PARAMS_DEFAULT);
    const fw = cands[0];
    // Polígono com pontos lat/lon (DgExclusionPolygon.points = DgLatLon[])
    const bigPoly = {
      id: "excl1",
      reason: "building" as const,
      points: [
        { lat: fw.position.lat - 0.01, lon: fw.position.lon - 0.01 },
        { lat: fw.position.lat + 0.01, lon: fw.position.lon - 0.01 },
        { lat: fw.position.lat + 0.01, lon: fw.position.lon + 0.01 },
        { lat: fw.position.lat - 0.01, lon: fw.position.lon + 0.01 },
      ],
    };
    const result = evaluateHardConstraints(
      fw,
      POLES_4,
      TRAFO_75KVA,
      [bigPoly],
      [],
      PARAMS_DEFAULT,
    );
    expect(result.feasible).toBe(false);
    expect(result.violations.map((v) => v.code)).toContain(
      "INSIDE_EXCLUSION_ZONE",
    );
  });
});

// ─── Scoring objetivo ──────────────────────────────────────────────────────────

describe("calculateObjectiveScore", () => {
  const edges = [
    {
      fromPoleId: "P1",
      toPoleId: "P2",
      lengthMeters: 100,
      conductorId: "95 AL MM",
    },
    {
      fromPoleId: "P2",
      toPoleId: "P3",
      lengthMeters: 80,
      conductorId: "95 AL MM",
    },
  ];
  const elec = {
    cqtMaxFraction: 0.03,
    worstTerminalNodeId: "P3",
    trafoUtilizationFraction: 0.6,
    totalCableLengthMeters: 180,
    feasible: true,
  };

  it("retorna score entre 0 e 100", () => {
    const { objectiveScore } = calculateObjectiveScore({
      edges,
      electricalResult: elec,
      candidateSource: "fermat_weber",
    });
    expect(objectiveScore).toBeGreaterThan(0);
    expect(objectiveScore).toBeLessThanOrEqual(100);
  });

  it("score piora com CQT acima do limite ANEEL (8%)", () => {
    const badElec = { ...elec, cqtMaxFraction: 0.09 };
    const { objectiveScore: bad } = calculateObjectiveScore({
      edges,
      electricalResult: badElec,
      candidateSource: "fermat_weber",
    });
    const { objectiveScore: good } = calculateObjectiveScore({
      edges,
      electricalResult: elec,
      candidateSource: "fermat_weber",
    });
    expect(bad).toBeLessThan(good);
  });
});

// ─── Otimizador ────────────────────────────────────────────────────────────────

describe("runDgOptimizer – exaustivo", () => {
  it("retorna ao menos um cenário viável para rede pequena", () => {
    const candidates = generateCandidates(POLES_4, PARAMS_DEFAULT);
    const { allScenarios, totalCandidatesEvaluated } = runDgOptimizer(
      candidates,
      POLES_4,
      TRAFO_75KVA,
      [],
      [],
      PARAMS_DEFAULT,
    );
    expect(totalCandidatesEvaluated).toBeGreaterThan(0);
    const feasible = allScenarios.filter((s) => s.feasible);
    expect(feasible.length).toBeGreaterThan(0);
  });

  it("todos os cenários viáveis têm objectiveScore > 0", () => {
    const candidates = generateCandidates(POLES_4, PARAMS_DEFAULT);
    const { allScenarios } = runDgOptimizer(
      candidates,
      POLES_4,
      TRAFO_75KVA,
      [],
      [],
      PARAMS_DEFAULT,
    );
    for (const s of allScenarios.filter((s) => s.feasible)) {
      expect(s.objectiveScore).toBeGreaterThan(0);
    }
  });

  it("modo heurístico avalia no máximo 50 candidatos", () => {
    const manyPoles: DgPoleInput[] = Array.from({ length: 60 }, (_, i) => ({
      id: `P${i}`,
      position: { lat: -23.549 + i * 0.0001, lon: -46.638 },
      demandKva: 5,
      clients: 1,
    }));
    const trafo: DgTransformerInput = {
      id: "TR500",
      position: { lat: -23.549, lon: -46.638 },
      kva: 500,
    };
    const params = { ...PARAMS_DEFAULT, searchMode: "heuristic" as const };
    const candidates = generateCandidates(manyPoles, params);
    const { totalCandidatesEvaluated } = runDgOptimizer(
      candidates,
      manyPoles,
      trafo,
      [],
      [],
      params,
    );
    expect(totalCandidatesEvaluated).toBeLessThanOrEqual(50);
  });
});

// ─── Serviço de orquestração (end-to-end) ────────────────────────────────────

describe("runDgOptimization – pipeline completo", () => {
  const input: DgOptimizationInput = {
    poles: POLES_4,
    transformer: TRAFO_75KVA,
    params: PARAMS_DEFAULT,
  };

  it("retorna runId, inputHash e computedAt", async () => {
    const output = await runDgOptimization(input);
    expect(output.runId).toBeTruthy();
    expect(output.inputHash).toHaveLength(16);
    expect(output.computedAt).toMatch(/^\d{4}-/);
  });

  it("propaga tenantId quando fornecido", async () => {
    const output = await runDgOptimization({
      ...input,
      tenantId: "tenant-dg-1",
    });
    expect(output.tenantId).toBe("tenant-dg-1");
  });

  it("retorna recomendação com bestScenario viável", async () => {
    const output = await runDgOptimization(input);
    expect(output.recommendation).not.toBeNull();
    expect(output.recommendation!.bestScenario.feasible).toBe(true);
    expect(output.recommendation!.bestScenario.objectiveScore).toBeGreaterThan(
      0,
    );
  });

  it("inputHash é determinístico", async () => {
    const out1 = await runDgOptimization(input);
    const out2 = await runDgOptimization(input);
    expect(out1.inputHash).toBe(out2.inputHash);
  });

  it("rejeita input com 0 postes", async () => {
    await expect(runDgOptimization({ ...input, poles: [] })).rejects.toThrow(
      "DG:",
    );
  });

  it("rejeita trafo com kva = 0", async () => {
    await expect(
      runDgOptimization({ ...input, transformer: { ...TRAFO_75KVA, kva: 0 } }),
    ).rejects.toThrow("DG:");
  });

  it("alternatives tem no máximo 3 itens", async () => {
    const output = await runDgOptimization(input);
    expect(output.recommendation!.alternatives.length).toBeLessThanOrEqual(3);
  });

  it("totalFeasible é consistente com allScenarios", async () => {
    const output = await runDgOptimization(input);
    const counted = output.allScenarios.filter((s) => s.feasible).length;
    expect(output.totalFeasible).toBe(counted);
  });
});
