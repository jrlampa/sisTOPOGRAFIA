import { logger } from "../utils/logger.js";
import type { BtTopology, BtDerivedResponse, BtTransformerDerived } from "./bt/btDerivedTypes.js";
import type { BtProjectType } from "./bt/btDerivedTypes.js";
import {
  CURRENT_TO_DEMAND_CONVERSION,
  toFixed2,
} from "./bt/btDerivedConstants.js";
import {
  getPoleClientsByProjectType,
  getClandestinoDemandKvaByAreaAndClients,
  calculateRamalDmdiKva,
  calculateAccumulatedDemandByPole,
  calculateEstimatedDemandByTransformer,
  calculateSummary,
  calculateClandestinoDisplay,
} from "./bt/btDerivedCalculations.js";
import {
  enrichWithVoltagePropagation,
  calculateSectioningImpact,
} from "./bt/btDerivedVoltagePropagation.js";

export type {
  BtProjectType,
  BtPoleRamalEntry,
  BtPoleNode,
  BtTransformerReading,
  BtTransformer,
  BtEdge,
  BtTopology,
} from "./bt/btDerivedTypes.js";
export type {
  BtPoleAccumulatedDemand,
  BtTransformerEstimatedDemand,
  BtSectioningImpact,
  BtClandestinoDisplay,
  BtTransformerDerived,
  BtDerivedResponse,
} from "./bt/btDerivedTypes.js";

const calculateTransformersDerived = (
  topology: BtTopology,
): BtTransformerDerived[] => {
  return topology.transformers.map((transformer) => {
    const readings = transformer.readings;
    const monthlyBillBrl = readings.reduce(
      (acc, r) => acc + (r.billedBrl ?? 0),
      0,
    );
    if (readings.length === 0) {
      return { transformerId: transformer.id, demandKw: 0, monthlyBillBrl };
    }
    const correctedDemands = readings.map((r) => {
      const currentMaxA = r.currentMaxA ?? 0;
      const temperatureFactor = r.temperatureFactor ?? 1;
      return currentMaxA * CURRENT_TO_DEMAND_CONVERSION * temperatureFactor;
    });
    const demandKw = toFixed2(Math.max(...correctedDemands, 0));
    return { transformerId: transformer.id, demandKw, monthlyBillBrl };
  });
};

export const computeBtDerivedState = (
  topology: BtTopology,
  projectType: BtProjectType,
  clandestinoAreaM2: number,
): BtDerivedResponse => {
  logger.info("[BtDerivedService] Starting computation", {
    projectType,
    clandestinoAreaM2,
    poleCount: topology.poles.length,
    transformerCount: topology.transformers.length,
    edgeCount: topology.edges.length,
  });

  const summary = calculateSummary(topology);

  const totalClients = topology.poles.reduce((sum, pole) => {
    return sum + getPoleClientsByProjectType(projectType, topology, pole.id);
  }, 0);

  const pointDemandKva = calculateRamalDmdiKva(
    projectType,
    summary.transformerDemandKw,
    totalClients,
    getClandestinoDemandKvaByAreaAndClients(clandestinoAreaM2, totalClients),
  );

  const accumulatedByPoleBase = calculateAccumulatedDemandByPole(
    topology,
    projectType,
    clandestinoAreaM2,
  );
  const accumulatedByPole = enrichWithVoltagePropagation(
    topology,
    projectType,
    accumulatedByPoleBase,
  );
  const estimatedByTransformer = calculateEstimatedDemandByTransformer(
    topology,
    projectType,
    clandestinoAreaM2,
  );
  const sectioningImpact = calculateSectioningImpact(
    topology,
    projectType,
    clandestinoAreaM2,
  );
  const clandestinoDisplay = calculateClandestinoDisplay(
    topology,
    clandestinoAreaM2,
  );
  const transformersDerived = calculateTransformersDerived(topology);

  logger.info("[BtDerivedService] Computation complete", {
    pointDemandKva,
    accumulatedByPoleCount: accumulatedByPole.length,
  });

  return {
    summary,
    pointDemandKva,
    criticalPoleId: accumulatedByPole[0]?.poleId ?? null,
    accumulatedByPole,
    estimatedByTransformer,
    sectioningImpact,
    clandestinoDisplay,
    transformersDerived,
  };
};
