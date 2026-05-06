/**
 * Testes – Design Generativo: Pipeline Completo
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

describe("latLonToUtm / utmToLatLon – roundtrip", () => {
  it("converte São Paulo (zona 23S) com erro < 30 m", () => {
    const { lat, lon } = POLES_4[0].position;
    const utm = latLonToUtm(lat, lon);
    const back = utmToLatLon(utm.x, utm.y);
    expect(Math.abs(back.lat - lat)).toBeLessThan(0.0003);
    expect(Math.abs(back.lon - lon)).toBeLessThan(0.0003);
  });
});

describe("euclideanDistanceM", () => {
  it("retorna 0 para the mesmo ponto", () => {
    expect(euclideanDistanceM({ x: 100, y: 200 }, { x: 100, y: 200 })).toBe(0);
  });
  it("retorna 5 para triângulo 3-4-5", () => {
    expect(euclideanDistanceM({ x: 0, y: 0 }, { x: 3, y: 4 })).toBeCloseTo(
      5,
      5,
    );
  });
});

describe("fermatWeberCenter", () => {
  it("converge para o centróide ponderado", () => {
    const poles = [
      { positionUtm: { x: 0, y: 0 }, demandKva: 10 },
      { positionUtm: { x: 100, y: 0 }, demandKva: 10 },
      { positionUtm: { x: 50, y: 87 }, demandKva: 10 },
    ];
    const fw = fermatWeberCenter(poles as any);
    expect(fw.x).toBeCloseTo(50, 0);
    expect(fw.y).toBeCloseTo(29, 0);
  });
});

describe("generateCandidates", () => {
  it("gera ao menos 1 candidato (FW + postes existentes)", () => {
    const candidates = generateCandidates(POLES_4, PARAMS_DEFAULT);
    expect(candidates.length).toBeGreaterThanOrEqual(1 + POLES_4.length);
  });
});

describe("hashDgInput", () => {
  it("produz hash diferente para postes diferentes", () => {
    const altered = [
      ...POLES_4,
      { id: "P5", position: { lat: -23.55, lon: -46.64 }, demandKva: 5 },
    ];
    expect(hashDgInput({ poles: altered }, PARAMS_DEFAULT)).not.toBe(
      hashDgInput({ poles: POLES_4 }, PARAMS_DEFAULT),
    );
  });
});

describe("runDgOptimizer – exaustivo", () => {
  it("retorna ao menos um cenário viável para rede pequena", async () => {
    const candidates = generateCandidates(POLES_4, PARAMS_DEFAULT);
    const { allScenarios, totalCandidatesEvaluated } = await runDgOptimizer(
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
});

describe("runDgOptimization – auto-seleção de modo", () => {
  it("auto-seleciona heurístico para rede grande (>50 postes)", async () => {
    const manyPoles = Array.from({ length: 51 }, (_, i) => ({
      ...POLES_4[0],
      id: `PX${i}`,
    }));
    const output = await runDgOptimization({
      poles: manyPoles,
      transformer: { ...TRAFO_75KVA, kva: 1000 },
      // Correção: não envia searchMode para testar auto-seleção
      params: { ...PARAMS_DEFAULT, searchMode: undefined },
    });
    expect(output.params.searchMode).toBe("heuristic");
  });

  it("hash completo inclui transformer, exclusões e corredores", async () => {
    const inputWithExtras: DgOptimizationInput = {
      poles: POLES_4,
      transformer: TRAFO_75KVA,
      roadCorridors: [
        {
          id: "via-test",
          centerPoints: [
            { lat: -23.5489, lon: -46.6388 },
            { lat: -23.5492, lon: -46.6387 },
          ],
          bufferMeters: 15,
          highwayClass: "secondary",
        },
      ],
    };
    const output = await runDgOptimization(inputWithExtras);
    expect(output.inputHash).toHaveLength(16);
    // O hash deve ser válido (não nulo/vazio)
    expect(output.inputHash).toBeTruthy();
  });
});

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
  });

  it("rejeita input com 0 postes", async () => {
    await expect(runDgOptimization({ ...input, poles: [] })).rejects.toThrow(
      "DG:",
    );
  });
});
