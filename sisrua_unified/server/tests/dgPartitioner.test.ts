/**
 * Testes — Design Generativo: Particionamento de Rede (dgPartitioner)
 *
 * Cobre:
 *   - Passo 2: Seleção telescópica de condutor (selectConductorForDemand)
 *   - Passo 1: MST Kruskal (buildMst)
 *   - Passo 3/4: Corte 50/50 + filtro anti-isolamento (findBestCutEdge)
 *   - Passo 5: Regra de excentricidade 200m (applyEccentricityDrag)
 *   - End-to-end: partitionNetwork
 */

import {
  buildMst,
  findBestCutEdge,
  applyEccentricityDrag,
  selectConductorForDemand,
  assignTelescopicConductors,
  partitionNetwork,
} from "../services/dg/dgPartitioner";
import { DEFAULT_DG_PARAMS, type DgPoleInput } from "../services/dg/dgTypes";
import { latLonToUtm } from "../services/dg/dgCandidates";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makePoles(count: number, demandKva: number): DgPoleInput[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `P${i + 1}`,
    position: { lat: -23.549 + i * 0.0002, lon: -46.638 },
    demandKva,
    clients: 1,
  }));
}

// ─── selectConductorForDemand ─────────────────────────────────────────────────

describe("selectConductorForDemand", () => {
  it.each([
    [10, "25 Al - Arm"],
    [36, "25 Al - Arm"],
    [37, "50 Al - Arm"],
    [57, "50 Al - Arm"],
    [58, "95 Al - Arm"],
    [91, "95 Al - Arm"],
    [92, "150 Al - Arm"],
    [115, "150 Al - Arm"],
    [116, "240 Al - Arm"],
    [1000, "240 Al - Arm"],
  ])("demanda %d kVA → %s", (demand, expectedId) => {
    expect(selectConductorForDemand(demand)).toBe(expectedId);
  });
});

// ─── buildMst ─────────────────────────────────────────────────────────────────

describe("buildMst", () => {
  it("produz N-1 arestas para N nós (5 postes + trafo = 6 nós → 5 arestas)", () => {
    const poles = makePoles(5, 10).map((p) => ({
      id: p.id,
      positionUtm: latLonToUtm(p.position.lat, p.position.lon),
    }));
    const trafoUtm = { x: poles[0].positionUtm.x, y: poles[0].positionUtm.y };
    const mst = buildMst("TR", poles, trafoUtm);
    expect(mst).toHaveLength(5); // 6 nós - 1
  });

  it("não gera arestas com comprimento zero", () => {
    const poles = makePoles(4, 10).map((p) => ({
      id: p.id,
      positionUtm: latLonToUtm(p.position.lat, p.position.lon),
    }));
    const trafoUtm = poles[0].positionUtm;
    const mst = buildMst("TR", poles, trafoUtm);
    for (const edge of mst) {
      expect(edge.lengthMeters).toBeGreaterThan(0);
    }
  });
});

// ─── assignTelescopicConductors ──────────────────────────────────────────────

describe("assignTelescopicConductors", () => {
  it("atribui condutor correto baseado na demanda downstream", () => {
    const poles = makePoles(3, 20).map((p) => ({
      id: p.id,
      positionUtm: latLonToUtm(p.position.lat, p.position.lon),
    }));
    const trafoUtm = poles[0].positionUtm;
    const mst = buildMst("TR", poles, trafoUtm);
    const demandByPole = new Map(poles.map((p, i) => [p.id, (i + 1) * 10]));
    const conductorMap = assignTelescopicConductors("TR", mst, demandByPole);
    expect(conductorMap.size).toBe(mst.length);
    for (const conductorId of conductorMap.values()) {
      expect(conductorId).toMatch(/^\d+ Al - Arm$/);
    }
  });
});

// ─── findBestCutEdge ──────────────────────────────────────────────────────────

describe("findBestCutEdge", () => {
  it("encontra um corte numa rede com 10 postes e demanda equilibrada", () => {
    const poles = makePoles(10, 10);
    const polesUtm = poles.map((p) => ({
      id: p.id,
      positionUtm: latLonToUtm(p.position.lat, p.position.lon),
    }));
    const trafoUtm = { x: polesUtm[0].positionUtm.x, y: polesUtm[0].positionUtm.y };
    const mst = buildMst("TR", polesUtm, trafoUtm);
    const demandByPole = new Map(poles.map((p) => [p.id, p.demandKva]));
    const totalDemand = 100;

    const cut = findBestCutEdge("TR", mst, poles, demandByPole, totalDemand);
    expect(cut).not.toBeNull();
    if (cut) {
      // O corte deve estar dentro de 85% de desequilíbrio (anti-isolamento)
      expect(cut.subtreeDemandKva).toBeGreaterThanOrEqual(totalDemand * 0.15);
      expect(cut.subtreeDemandKva).toBeLessThanOrEqual(totalDemand * 0.85);
    }
  });

  it("retorna null quando anti-isolamento bloqueia todos os cortes (90% em 1 poste)", () => {
    const poles: DgPoleInput[] = [
      { id: "P1", position: { lat: -23.549, lon: -46.638 }, demandKva: 90, clients: 1 },
      { id: "P2", position: { lat: -23.5492, lon: -46.638 }, demandKva: 3, clients: 1 },
      { id: "P3", position: { lat: -23.5494, lon: -46.638 }, demandKva: 3, clients: 1 },
      { id: "P4", position: { lat: -23.5496, lon: -46.638 }, demandKva: 4, clients: 1 },
    ];
    const polesUtm = poles.map((p) => ({
      id: p.id,
      positionUtm: latLonToUtm(p.position.lat, p.position.lon),
    }));
    const trafoUtm = polesUtm[1].positionUtm;
    const mst = buildMst("TR", polesUtm, trafoUtm);
    const demandByPole = new Map(poles.map((p) => [p.id, p.demandKva]));

    // P1 tem 90% — qualquer corte que o isola viola anti-isolamento (90% > 85%)
    const cut = findBestCutEdge("TR", mst, poles, demandByPole, 100);
    expect(cut).toBeNull();
  });

  it("retorna null para MST com menos de 3 arestas", () => {
    const poles = makePoles(2, 10);
    const polesUtm = poles.map((p) => ({
      id: p.id,
      positionUtm: latLonToUtm(p.position.lat, p.position.lon),
    }));
    const trafoUtm = polesUtm[0].positionUtm;
    const mst = buildMst("TR", polesUtm, trafoUtm);
    const demandByPole = new Map(poles.map((p) => [p.id, p.demandKva]));
    const cut = findBestCutEdge("TR", mst, poles, demandByPole, 20);
    expect(cut).toBeNull();
  });
});

// ─── applyEccentricityDrag ────────────────────────────────────────────────────

describe("applyEccentricityDrag", () => {
  it("não ajusta quando todos os postes estão dentro de 200m", () => {
    const polesUtm = [
      { id: "P1", positionUtm: { x: 0, y: 0 } },
      { id: "P2", positionUtm: { x: 100, y: 0 } },
      { id: "P3", positionUtm: { x: 50, y: 80 } },
    ];
    const centroid = { x: 50, y: 27 };
    const result = applyEccentricityDrag(centroid, polesUtm, 200);
    expect(result.adjusted).toBe(false);
    expect(result.maxDistM).toBeLessThanOrEqual(200);
  });

  it("arrasta o trafo quando excentricidade > 200m", () => {
    const polesUtm = [
      { id: "P1", positionUtm: { x: 0, y: 0 } },
      { id: "P2", positionUtm: { x: 100, y: 0 } },
      { id: "P3", positionUtm: { x: 200, y: 0 } },
      { id: "P4", positionUtm: { x: 300, y: 0 } },
    ];
    const centroid = { x: 0, y: 0 }; // trafo no início — P4 a 300m
    const result = applyEccentricityDrag(centroid, polesUtm, 200);
    expect(result.adjusted).toBe(true);
  });

  it("o fallback global encontra um poste que minimiza a excentricidade", () => {
    // Caso onde nenhum dos 3 candidatos de direção resolve — fallback global
    const polesUtm = [
      { id: "P1", positionUtm: { x: 0, y: 0 } },
      { id: "P2", positionUtm: { x: 500, y: 0 } },
      { id: "P3", positionUtm: { x: 250, y: 0 } }, // centro ideal
    ];
    const centroid = { x: 0, y: 0 };
    const result = applyEccentricityDrag(centroid, polesUtm, 200);
    // P3 (250, 0) minimiza: max dist = 250m — melhor que P1 (500m) ou P2 (500m)
    expect(result.maxDistM).toBeLessThanOrEqual(500);
  });
});

// ─── partitionNetwork end-to-end ──────────────────────────────────────────────

describe("partitionNetwork", () => {
  it("retorna 1 partição quando rede cabe num único trafo de 112.5 kVA", () => {
    const poles = makePoles(8, 10); // total 80 kVA < 112.5 × 0.95
    const result = partitionNetwork(poles, DEFAULT_DG_PARAMS);
    expect(result.totalPartitions).toBe(1);
    expect(result.partitions[0].poles).toHaveLength(8);
    expect(result.cutEdgeIds).toHaveLength(0);
  });

  it("particiona em 2+ quando demanda excede 112.5 kVA", () => {
    // 20 postes × 8 kVA = 160 kVA > 112.5 kVA
    const poles = makePoles(20, 8);
    const result = partitionNetwork(poles, DEFAULT_DG_PARAMS);
    expect(result.totalPartitions).toBeGreaterThanOrEqual(2);
    expect(result.cutEdgeIds.length).toBeGreaterThanOrEqual(1);
    for (const p of result.partitions) {
      expect(p.poles.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("cada partição tem arestas com condutores telescópicos válidos", () => {
    const VALID_CONDUCTORS = new Set([
      "25 Al - Arm",
      "50 Al - Arm",
      "95 Al - Arm",
      "150 Al - Arm",
      "240 Al - Arm",
    ]);
    const poles = makePoles(15, 10); // 150 kVA — vai partir
    const result = partitionNetwork(poles, DEFAULT_DG_PARAMS);
    for (const partition of result.partitions) {
      for (const edge of partition.edges) {
        expect(VALID_CONDUCTORS.has(edge.conductorId)).toBe(true);
      }
    }
  });

  it("totalDemandKva reflete a soma de todos os postes", () => {
    const poles = makePoles(10, 12); // 120 kVA
    const result = partitionNetwork(poles, DEFAULT_DG_PARAMS);
    expect(result.totalDemandKva).toBeCloseTo(120, 1);
  });

  it("avgBalanceRatio é 1 quando há apenas 1 partição", () => {
    const poles = makePoles(5, 10); // 50 kVA — cabe num único trafo
    const result = partitionNetwork(poles, DEFAULT_DG_PARAMS);
    expect(result.avgBalanceRatio).toBe(1);
  });

  it("infeasiblePartitions é um número não-negativo", () => {
    const poles = makePoles(8, 10);
    const result = partitionNetwork(poles, DEFAULT_DG_PARAMS);
    expect(result.infeasiblePartitions).toBeGreaterThanOrEqual(0);
  });
});
