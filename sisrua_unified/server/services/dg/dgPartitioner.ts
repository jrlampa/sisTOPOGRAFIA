/**
 * Design Generativo — Particionamento de Rede
 *
 * Passo 3: Avaliação de Limites (capacidade trafo / CQT)
 * Passo 4: Heurística de Corte 50/50 + Filtro Anti-Isolamento
 * Passo 5: Baricentro Elétrico (Fermat-Weber) + Regra Excentricidade 200m
 */

import { randomUUID } from "crypto";
import type {
  DgPoleInput,
  DgParams,
  DgScenarioEdge,
  DgElectricalResult,
  DgPartition,
  DgPartitionedResult,
} from "./dgTypes.js";
import {
  latLonToUtm,
  utmToLatLon,
  fermatWeberCenter,
} from "./dgCandidates.js";
import { buildMst, MstEdge } from "./dgMst.js";
import { assignTelescopicConductors } from "./dgTelescopic.js";
import { applyEccentricityDrag } from "./dgEccentricity.js";
import { findBestCutEdge, splitPolesAtCut } from "./dgCuts.js";
import { calculateBtRadial } from "../btRadialCalculationService.js";
import type { BtRadialTopologyInput } from "../bt/btTypes.js";
import { logger } from "../../utils/logger.js";

const MIN_POLES_PER_PARTITION = 3;

// ─── Avaliação elétrica de uma partição ─────────────────────────────────────

function evaluatePartitionElectrical(
  trafoId: string,
  trafoKva: number,
  poles: DgPoleInput[],
  mst: MstEdge[],
  demandByPole: Map<string, number>,
  cqtLimit: number,
): DgElectricalResult | null {
  try {
    const conductorMap = assignTelescopicConductors(trafoId, mst, demandByPole);

    const input: BtRadialTopologyInput = {
      transformer: {
        id: trafoId,
        rootNodeId: trafoId,
        kva: trafoKva,
        zPercent: 4.5,
        qtMt: 0,
      },
      nodes: [
        { id: trafoId, load: { localDemandKva: 0 } },
        ...poles.map((p) => ({
          id: p.id,
          load: { localDemandKva: p.demandKva },
        })),
      ],
      edges: mst.map((e) => ({
        fromNodeId: e.fromId,
        toNodeId: e.toId,
        conductorId:
          conductorMap.get(`${e.fromId}→${e.toId}`) ??
          conductorMap.get(`${e.toId}→${e.fromId}`) ??
          "95 Al - Arm",
        lengthMeters: e.lengthMeters,
      })),
      phase: "TRI",
      temperatureC: 75,
      nominalVoltageV: 127,
    };

    const output = calculateBtRadial(input);
    const totalDemandKva = poles.reduce((s, p) => s + p.demandKva, 0);

    return {
      cqtMaxFraction: output.worstCase.cqtGlobal,
      worstTerminalNodeId: output.worstCase.worstTerminalNodeId,
      trafoUtilizationFraction: totalDemandKva / trafoKva,
      totalCableLengthMeters: mst.reduce((s, e) => s + e.lengthMeters, 0),
      feasible:
        output.worstCase.cqtGlobal <= cqtLimit &&
        totalDemandKva / trafoKva <= 0.95,
      cqtTerminalFraction: 0, // Fallback for interface
      cqtRamalFraction: 0, // Fallback for interface
    };
  } catch (err) {
    logger.debug("DG Partitioner: falha na avaliação elétrica", {
      error: (err as Error).message,
      trafoId,
      trafoKva,
      poles: poles.length,
    });
    return null;
  }
}

// ─── Construção de uma DgPartition ──────────────────────────────────────────

function buildPartition(
  partitionId: string,
  poles: DgPoleInput[],
  params: DgParams,
): DgPartition | null {
  if (poles.length < MIN_POLES_PER_PARTITION) return null;

  const polesUtm = poles.map((p) => ({
    id: p.id,
    positionUtm: latLonToUtm(p.position.lat, p.position.lon),
  }));

  // Passo 5a: Baricentro elétrico (Fermat-Weber)
  const centroid = fermatWeberCenter(
    poles.map((p, i) => ({
      positionUtm: polesUtm[i].positionUtm,
      demandKva: p.demandKva,
    })),
  );

  // Passo 5b: Regra de excentricidade 200m
  const eccentricity = applyEccentricityDrag(centroid, polesUtm);
  const trafoUtm = eccentricity.position;
  const trafoLatLon = utmToLatLon(trafoUtm.x, trafoUtm.y);

  const trafoId = `trafo-part-${partitionId}`;
  const mst = buildMst(
    trafoId,
    polesUtm,
    trafoUtm,
    [],
    [],
  );

  const demandByPole = new Map(poles.map((p) => [p.id, p.demandKva]));
  const totalDemandKva = poles.reduce((s, p) => s + p.demandKva, 0);

  // Passo 3b: Seleciona menor kVA viável
  const baseFaixa = params.faixaKvaTrafoPermitida ?? [15, 30, 45, 75, 112.5];
  const trafoMaxKva =
    typeof (params as any).trafoMaxKva === "number"
      ? ((params as any).trafoMaxKva as number)
      : null;
  const faixa =
    trafoMaxKva && Number.isFinite(trafoMaxKva) && trafoMaxKva > 0
      ? baseFaixa.filter((kva) => kva <= trafoMaxKva)
      : baseFaixa;
  let bestResult: DgElectricalResult | null = null;
  let selectedKva = 0;

  for (const kva of faixa) {
    if (totalDemandKva / kva > (params.trafoMaxUtilization ?? 0.95)) continue;
    const result = evaluatePartitionElectrical(
      trafoId,
      kva,
      poles,
      mst,
      demandByPole,
      params.cqtLimitFraction ?? 0.08,
    );
    // Guarda o melhor resultado mesmo que infeasível (para CQT real no output)
    if (
      result &&
      (!bestResult || result.cqtMaxFraction < bestResult.cqtMaxFraction)
    ) {
      bestResult = result;
      if (selectedKva === 0) selectedKva = kva;
    }
    if (result?.feasible) {
      selectedKva = kva;
      break;
    }
  }

  // Constrói edges com condutores telescópicos
  const conductorMap = assignTelescopicConductors(trafoId, mst, demandByPole);
  const edges: DgScenarioEdge[] = mst.map((e) => ({
    fromPoleId: e.fromId,
    toPoleId: e.toId,
    lengthMeters: e.lengthMeters,
    conductorId:
      conductorMap.get(`${e.fromId}→${e.toId}`) ??
      conductorMap.get(`${e.toId}→${e.fromId}`) ??
      "95 Al - Arm",
  }));

  return {
    partitionId,
    poles,
    trafoPositionLatLon: trafoLatLon,
    trafoPositionUtm: trafoUtm,
    selectedKva,
    edges,
    electricalResult: bestResult ?? {
      cqtMaxFraction: 1,
      worstTerminalNodeId: "",
      trafoUtilizationFraction: totalDemandKva / Math.max(selectedKva, 1),
      totalCableLengthMeters: mst.reduce((s, e) => s + e.lengthMeters, 0),
      feasible: false,
      cqtTerminalFraction: 1,
      cqtRamalFraction: 0,
    },
    totalDemandKva,
    eccentricityAdjusted: eccentricity.adjusted,
    maxNodeDistanceM: eccentricity.maxDistM,
    centroid,
  };
}

// ─── Passo 3-4: Particionamento recursivo ───────────────────────────────────

const MAX_DEPTH = 6; // suporta até 64 sub-redes (redes com 50-500 postes)
const MAX_PARTITIONS = 20; // cap de segurança — não aplicado na recursão

function partitionRecursive(
  poles: DgPoleInput[],
  params: DgParams,
  depth: number,
  cutEdgeIds: string[],
  totalDemandForRatioCalc: number,
): DgPartition[] {
  if (poles.length < MIN_POLES_PER_PARTITION || depth > MAX_DEPTH) {
    const partition = buildPartition(
      `${depth}-${randomUUID().slice(0, 8)}`,
      poles,
      params,
    );
    return partition ? [partition] : [];
  }

  const totalDemandKva = poles.reduce((s, p) => s + p.demandKva, 0);
  const baseFaixa = params.faixaKvaTrafoPermitida ?? [15, 30, 45, 75, 112.5];
  const trafoMaxKva =
    typeof (params as any).trafoMaxKva === "number"
      ? ((params as any).trafoMaxKva as number)
      : null;
  const faixa =
    trafoMaxKva && Number.isFinite(trafoMaxKva) && trafoMaxKva > 0
      ? baseFaixa.filter((kva) => kva <= trafoMaxKva)
      : baseFaixa;
  const maxKva = Math.max(...faixa);
  const maxUtilization = params.trafoMaxUtilization ?? 0.95;

  if (totalDemandKva <= maxKva * maxUtilization) {
    const partition = buildPartition(
      `${depth}-${randomUUID().slice(0, 8)}`,
      poles,
      params,
    );
    if (
      !partition ||
      partition.electricalResult.feasible ||
      depth >= MAX_DEPTH
    ) {
      return partition ? [partition] : [];
    }
    logger.debug(
      "DG Partitioner: CQT acima do limite — continuando particionamento",
      {
        depth,
        poles: poles.length,
        totalDemandKva,
        cqt: partition.electricalResult.cqtMaxFraction,
      },
    );
  }

  const polesUtm = poles.map((p) => ({
    id: p.id,
    positionUtm: latLonToUtm(p.position.lat, p.position.lon),
  }));

  const centroid = fermatWeberCenter(
    poles.map((p, i) => ({
      positionUtm: polesUtm[i].positionUtm,
      demandKva: p.demandKva,
    })),
  );
  const tempTrafoId = `temp-trafo-${depth}`;
  const mst = buildMst(
    tempTrafoId,
    polesUtm,
    centroid,
    [],
    [],
  );
  const demandByPole = new Map(poles.map((p) => [p.id, p.demandKva]));

  const bestCut = findBestCutEdge(
    tempTrafoId,
    mst,
    poles,
    demandByPole,
    totalDemandKva,
  );
  if (!bestCut) {
    logger.warn(
      "DG Partitioner: nenhum corte válido encontrado — aceitando partição única",
      {
        poles: poles.length,
        totalDemandKva,
        depth,
      },
    );
    const partition = buildPartition(
      `${depth}-${randomUUID().slice(0, 8)}`,
      poles,
      params,
    );
    return partition ? [partition] : [];
  }

  cutEdgeIds.push(`${bestCut.edge.fromId}→${bestCut.edge.toId}`);

  const { downstream, upstream } = splitPolesAtCut(
    poles,
    bestCut.edge,
    mst,
    bestCut.childId,
  );

  const upstreamPartitions = partitionRecursive(
    upstream,
    params,
    depth + 1,
    cutEdgeIds,
    totalDemandForRatioCalc,
  );
  const downstreamPartitions = partitionRecursive(
    downstream,
    params,
    depth + 1,
    cutEdgeIds,
    totalDemandForRatioCalc,
  );

  return [...upstreamPartitions, ...downstreamPartitions];
}

// ─── API pública ─────────────────────────────────────────────────────────────

export function partitionNetwork(
  poles: DgPoleInput[],
  params: DgParams,
): DgPartitionedResult {
  const totalDemandKva = poles.reduce((s, p) => s + p.demandKva, 0);
  const cutEdgeIds: string[] = [];

  const allPartitions = partitionRecursive(
    poles,
    params,
    0,
    cutEdgeIds,
    totalDemandKva,
  );
  const partitions = allPartitions.slice(0, MAX_PARTITIONS);
  if (allPartitions.length > MAX_PARTITIONS) {
    logger.warn(
      "DG Partitioner: número de partições excede MAX_PARTITIONS, resultado truncado",
      {
        total: allPartitions.length,
        cap: MAX_PARTITIONS,
      },
    );
  }

  let avgBalanceRatio = 1;
  if (cutEdgeIds.length > 0 && partitions.length >= 2) {
    const demands = partitions.map((p) => p.totalDemandKva);
    const total = demands.reduce((s, d) => s + d, 0);
    const idealPerPartition = total / partitions.length;
    const avgImbalance =
      demands.reduce((s, d) => s + Math.abs(d - idealPerPartition), 0) /
      partitions.length;
    avgBalanceRatio = Math.max(0, 1 - avgImbalance / idealPerPartition);
  }

  return {
    partitions,
    totalPartitions: partitions.length,
    cutEdgeIds,
    avgBalanceRatio,
    infeasiblePartitions: partitions.filter((p) => !p.electricalResult.feasible)
      .length,
    totalDemandKva,
  };
}
