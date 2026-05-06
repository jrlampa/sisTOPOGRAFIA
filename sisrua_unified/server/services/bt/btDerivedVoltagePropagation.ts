import { getCabosByScenario } from "../../constants/cqtLookupTables.js";
import { calculateCorrectedResistance, calculateIb } from "../cqtEngine.js";
import type {
  BtProjectType,
  BtPoleNode,
  BtTopology,
  BtEdge,
  BtPoleAccumulatedDemand,
  BtSectioningImpact,
} from "./btDerivedTypes.js";
import {
  CLANDESTINO_RAMAL_TYPE,
  BT_PHASE_VOLTAGE_V,
  BT_LINE_REFERENCE_VOLTAGE_V,
  BT_PHASE_FACTOR,
  QT_MT_FRACTION,
  Z_TRAFO_PERCENT,
  DEFAULT_TRAFO_KVA,
  DEFAULT_AMBIENT_TEMP_C,
  BT_TRI_PHASE_ETA,
  CURRENT_TO_DEMAND_CONVERSION,
  LOW_TEMP_LIMIT_CONDUCTORS,
  toFixed2,
} from "./btDerivedConstants.js";
import {
  calculateTransformerOwnershipData,
  getClandestinoDemandKvaByAreaAndClients,
} from "./btDerivedCalculations.js";
import { haversineDistanceMeters } from "../../../shared/geodesic.js";

const getTransformerDemandKva = (transformer: {
  demandKva?: number;
  demandKw?: number;
  readings?: Array<{
    currentMaxA?: number;
    temperatureFactor?: number;
  }>;
}): number => {
  const readings = transformer.readings ?? [];
  const hasUsableReadings = readings.some((reading) =>
    Number.isFinite(reading.currentMaxA),
  );

  if (hasUsableReadings) {
    const correctedDemands = readings.map((reading) => {
      const currentMaxA = reading.currentMaxA ?? 0;
      const temperatureFactor = reading.temperatureFactor ?? 1;
      const maxDemandKva = currentMaxA * CURRENT_TO_DEMAND_CONVERSION;
      return maxDemandKva * temperatureFactor;
    });

    return toFixed2(Math.max(...correctedDemands, 0));
  }

  const rawDemand = transformer.demandKva ?? transformer.demandKw ?? 0;
  return Number.isFinite(rawDemand) ? rawDemand : 0;
};

const getEdgeConductorName = (edge: BtEdge): string | null => {
  if (!edge.conductors || edge.conductors.length === 0) {
    return null;
  }

  const selected = edge.conductors[edge.conductors.length - 1]?.conductorName;
  if (!selected || typeof selected !== "string") {
    return null;
  }

  return selected.trim();
};

const calculateVoltageDropPercent = (
  accumulatedDemandKva: number,
  correctedResistanceOhmPerKm: number,
  reactanceOhmPerKm: number,
  lengthMeters: number,
): number => {
  if (
    !Number.isFinite(accumulatedDemandKva) ||
    !Number.isFinite(correctedResistanceOhmPerKm) ||
    !Number.isFinite(lengthMeters) ||
    accumulatedDemandKva <= 0 ||
    correctedResistanceOhmPerKm <= 0 ||
    lengthMeters <= 0
  ) {
    return 0;
  }

  // Workbook parity (Light LADO 1 coluna L):
  // dV% = F * P_kVA * sqrt(R^2 + X^2) * L_m / (V_linha^2 / 100)
  // Verified against workbook: F=1(TRI), V_linha=220 → divisor=484
  const x =
    Number.isFinite(reactanceOhmPerKm) && reactanceOhmPerKm > 0
      ? reactanceOhmPerKm
      : 0;
  const impedance = Math.sqrt(
    Math.max(0, correctedResistanceOhmPerKm ** 2) + Math.max(0, x ** 2),
  );
  const divisor = Math.max(1, BT_LINE_REFERENCE_VOLTAGE_V ** 2 / 100);
  const drop =
    (BT_PHASE_FACTOR * accumulatedDemandKva * impedance * lengthMeters) /
    divisor;

  return Number.isFinite(drop) ? Math.max(0, drop) : 0;
};

const estimateConductorTemperatureC = (
  conductorName: string,
  accumulatedDemandKva: number,
  ampacityA: number,
): number => {
  if (
    !Number.isFinite(accumulatedDemandKva) ||
    accumulatedDemandKva <= 0 ||
    !Number.isFinite(ampacityA) ||
    ampacityA <= 0
  ) {
    return DEFAULT_AMBIENT_TEMP_C;
  }

  const tempLimitC = LOW_TEMP_LIMIT_CONDUCTORS.has(conductorName) ? 70 : 90;
  const deltaTempAt30 = tempLimitC - DEFAULT_AMBIENT_TEMP_C;
  if (deltaTempAt30 <= 0) {
    return DEFAULT_AMBIENT_TEMP_C;
  }

  // Workbook parity (coluna J):
  // T = 30 + ACUMULADA / (((220*SQRT(3))/1000) * ETA * K_TERM_30)
  // Equivalent current form:
  // Ib = ACUMULADA*1000/(SQRT(3)*220*ETA)  and  K_TERM_30 = Iz/DELTA_TEMP_30
  // => T = 30 + Ib * (DELTA_TEMP_30 / Iz)
  const ibA = calculateIb({
    acumuladaKva: accumulatedDemandKva,
    fase: "TRI",
    eta: BT_TRI_PHASE_ETA,
    tensaoTrifasicaV: BT_LINE_REFERENCE_VOLTAGE_V,
  });

  if (!Number.isFinite(ibA) || ibA <= 0) {
    return DEFAULT_AMBIENT_TEMP_C;
  }

  const t = DEFAULT_AMBIENT_TEMP_C + ibA * (deltaTempAt30 / ampacityA);
  return Number.isFinite(t) && t > 0 ? t : DEFAULT_AMBIENT_TEMP_C;
};

const getPoleRamalQuantitiesByProjectType = (
  projectType: BtProjectType,
  pole: BtPoleNode | undefined,
): number[] => {
  if (!pole || !Array.isArray(pole.ramais) || pole.ramais.length === 0) {
    return [];
  }

  const isClandestinoProject = projectType === "clandestino";
  return pole.ramais
    .filter((ramal) => {
      const isClandestinoRamal =
        (ramal.ramalType ?? CLANDESTINO_RAMAL_TYPE) === CLANDESTINO_RAMAL_TYPE;
      return isClandestinoProject ? isClandestinoRamal : !isClandestinoRamal;
    })
    .map((ramal) => ramal.quantity)
    .filter((quantity) => Number.isFinite(quantity) && quantity > 0);
};

export const enrichWithVoltagePropagation = (
  topology: BtTopology,
  projectType: BtProjectType,
  accumulatedByPole: BtPoleAccumulatedDemand[],
): BtPoleAccumulatedDemand[] => {
  if (accumulatedByPole.length === 0 || topology.edges.length === 0) {
    return accumulatedByPole;
  }

  const activeEdges = topology.edges.filter((edge) => {
    const edgeFlag =
      edge.edgeChangeFlag ?? (edge.removeOnExecution ? "remove" : "existing");
    return edgeFlag !== "remove";
  });

  if (activeEdges.length === 0) {
    return accumulatedByPole;
  }

  const hasAnyConductor = activeEdges.some(
    (edge) => !!getEdgeConductorName(edge),
  );
  if (!hasAnyConductor) {
    return accumulatedByPole;
  }

  // Build impedance lookup with conductor thermal coefficients.
  // Workbook parity:
  // R_CORR = (R / DIVISOR_R) * (1 + alpha * (T - 20))
  // dV% uses sqrt(R_CORR² + X²)
  const impedanceByConductor = new Map<
    string,
    {
      resistance: number;
      reactance: number;
      alpha: number;
      divisorR: number;
      ampacity: number;
    }
  >();
  for (const cabo of getCabosByScenario("atual")) {
    if (typeof cabo.name === "string" && Number.isFinite(cabo.resistance)) {
      impedanceByConductor.set(cabo.name.trim().toUpperCase(), {
        resistance: cabo.resistance,
        reactance: Number.isFinite(cabo.reactance) ? cabo.reactance : 0,
        alpha: Number.isFinite(cabo.alpha) ? cabo.alpha : 0,
        divisorR: Number.isFinite(cabo.divisorR) ? cabo.divisorR : 1,
        ampacity: Number.isFinite(cabo.ampacity) ? cabo.ampacity : 0,
      });
    }
  }

  const adjacency = new Map<
    string,
    Array<{ neighborId: string; edge: BtEdge }>
  >();
  for (const pole of topology.poles) {
    adjacency.set(pole.id, []);
  }
  for (const edge of activeEdges) {
    if (!adjacency.has(edge.fromPoleId)) {
      adjacency.set(edge.fromPoleId, []);
    }
    if (!adjacency.has(edge.toPoleId)) {
      adjacency.set(edge.toPoleId, []);
    }
    adjacency.get(edge.fromPoleId)?.push({ neighborId: edge.toPoleId, edge });
    adjacency.get(edge.toPoleId)?.push({ neighborId: edge.fromPoleId, edge });
  }

  const rootPoleIds = topology.transformers
    .map((transformer) => transformer.poleId)
    .filter(
      (poleId): poleId is string =>
        typeof poleId === "string" && adjacency.has(poleId),
    );

  if (rootPoleIds.length === 0) {
    return accumulatedByPole;
  }

  // Map root pole → transformer for initial QT_MTTR loss lookup
  const transformerByRootPole = new Map<
    string,
    { demandKva?: number; demandKw?: number; projectPowerKva?: number }
  >();
  for (const transformer of topology.transformers) {
    if (typeof transformer.poleId === "string") {
      transformerByRootPole.set(transformer.poleId, transformer);
    }
  }

  const visited = new Set<string>();
  const queue: string[] = [];
  const parentByPole = new Map<
    string,
    { parentPoleId: string; edge: BtEdge }
  >();

  for (const rootPoleId of rootPoleIds) {
    if (!visited.has(rootPoleId)) {
      visited.add(rootPoleId);
      queue.push(rootPoleId);
    }
  }

  while (queue.length > 0) {
    const currentPoleId = queue.shift();
    if (!currentPoleId) {
      continue;
    }

    const neighbors = adjacency.get(currentPoleId) ?? [];
    for (const { neighborId, edge } of neighbors) {
      if (visited.has(neighborId)) {
        continue;
      }
      visited.add(neighborId);
      parentByPole.set(neighborId, { parentPoleId: currentPoleId, edge });
      queue.push(neighborId);
    }
  }

  const demandByPoleId = new Map(
    accumulatedByPole.map((item) => [item.poleId, item]),
  );
  const poleById = new Map(topology.poles.map((pole) => [pole.id, pole]));
  const rootSet = new Set(rootPoleIds);

  const worstImpedanceByConductor = Array.from(
    impedanceByConductor.entries(),
  ).reduce<{
    conductorName: string;
    resistance: number;
    reactance: number;
    alpha: number;
    divisorR: number;
    ampacity: number;
    impedance: number;
  } | null>((current, [conductorName, imp]) => {
    if (!Number.isFinite(imp.resistance) || imp.resistance <= 0) {
      return current;
    }

    const x =
      Number.isFinite(imp.reactance) && imp.reactance > 0 ? imp.reactance : 0;
    const impedance = Math.sqrt(imp.resistance ** 2 + x ** 2);

    if (!current || impedance > current.impedance) {
      return {
        conductorName,
        resistance: imp.resistance,
        reactance: x,
        alpha: imp.alpha,
        divisorR: imp.divisorR,
        ampacity: imp.ampacity,
        impedance,
      };
    }

    return current;
  }, null);

  return accumulatedByPole.map((item) => {
    if (!parentByPole.has(item.poleId) && !rootSet.has(item.poleId)) {
      return item;
    }

    let dvAccumPercent = 0;

    // For root (transformer) poles add initial MT+transformer impedance loss.
    // Workbook parity: QT_MTTR% = (QT_MT + QT_TR) * 100
    //   QT_MT  = 0.0183 (fixed MV line losses, workbook DB K4)
    //   QT_TR  = (P_demand_kVA / TR_rated_kVA) * 0.035 (workbook TRAFOS_Z, same for all sizes)
    // Walk back to root to find which transformer owns this branch.
    let branchRootPoleId: string | undefined;
    {
      let cursor = item.poleId;
      let g = 0;
      while (parentByPole.has(cursor) && g <= activeEdges.length + 1) {
        cursor = parentByPole.get(cursor)!.parentPoleId;
        g++;
      }
      if (rootSet.has(cursor)) {
        branchRootPoleId = cursor;
      }
    }

    if (branchRootPoleId !== undefined) {
      const trafo = transformerByRootPole.get(branchRootPoleId);
      // Workbook parity (DB!K10/K19/K26): QT_TR uses trafo demand as numerator.
      // Prefer explicit transformer demand; fall back to accumulated root demand.
      const totalDemandKva =
        trafo && getTransformerDemandKva(trafo) > 0
          ? getTransformerDemandKva(trafo)
          : (demandByPoleId.get(branchRootPoleId)?.accumulatedDemandKva ?? 0);
      const trafoRatedKva =
        trafo &&
        Number.isFinite(trafo.projectPowerKva) &&
        (trafo.projectPowerKva ?? 0) > 0
          ? (trafo.projectPowerKva as number)
          : DEFAULT_TRAFO_KVA;
      const qtTr =
        trafoRatedKva > 0
          ? (totalDemandKva / trafoRatedKva) * Z_TRAFO_PERCENT
          : 0;
      dvAccumPercent += (QT_MT_FRACTION + qtTr) * 100;
    }

    let cursorPoleId = item.poleId;
    let guard = 0;

    while (parentByPole.has(cursorPoleId) && guard <= activeEdges.length + 1) {
      const relation = parentByPole.get(cursorPoleId);
      if (!relation) {
        break;
      }

      const conductorName = getEdgeConductorName(relation.edge);
      const imp = conductorName
        ? impedanceByConductor.get(conductorName.toUpperCase())
        : undefined;

      if (imp && Number.isFinite(imp.resistance)) {
        const segmentDemandKva =
          demandByPoleId.get(cursorPoleId)?.accumulatedDemandKva ??
          item.accumulatedDemandKva;

        const conductorTemperatureC = estimateConductorTemperatureC(
          conductorName?.toUpperCase() ?? "",
          segmentDemandKva,
          imp.ampacity,
        );
        const correctedResistance = calculateCorrectedResistance({
          resistance: imp.resistance,
          alpha: imp.alpha,
          divisorR: imp.divisorR,
          temperatureC: conductorTemperatureC,
        });

        dvAccumPercent += calculateVoltageDropPercent(
          segmentDemandKva,
          correctedResistance,
          imp.reactance,
          relation.edge.cqtLengthMeters ?? relation.edge.lengthMeters ?? 0,
        );
      }

      cursorPoleId = relation.parentPoleId;
      guard += 1;
    }

    const voltageV = Math.max(
      0,
      BT_PHASE_VOLTAGE_V * (1 - dvAccumPercent / 100),
    );
    const cqtStatus: "OK" | "ATENÇÃO" | "CRÍTICO" =
      dvAccumPercent > 8 ? "CRÍTICO" : dvAccumPercent > 5 ? "ATENÇÃO" : "OK";

    let worstRamalVoltageV: number | undefined;
    let worstRamalDvPercent: number | undefined;
    let worstRamalStatus: "OK" | "ATENÇÃO" | "CRÍTICO" | undefined;

    const pole = poleById.get(item.poleId);
    const ramalQuantities = getPoleRamalQuantitiesByProjectType(
      projectType,
      pole,
    );
    const maxRamalQuantity =
      ramalQuantities.length > 0 ? Math.max(...ramalQuantities) : 0;

    if (
      item.localClients > 0 &&
      item.localTrechoDemandKva > 0 &&
      maxRamalQuantity > 0 &&
      worstImpedanceByConductor
    ) {
      const worstRamalDemandKva =
        (item.localTrechoDemandKva * maxRamalQuantity) / item.localClients;

      const ramalTemperatureC = estimateConductorTemperatureC(
        worstImpedanceByConductor.conductorName,
        worstRamalDemandKva,
        worstImpedanceByConductor.ampacity,
      );
      const ramalCorrectedResistance = calculateCorrectedResistance({
        resistance: worstImpedanceByConductor.resistance,
        alpha: worstImpedanceByConductor.alpha,
        divisorR: worstImpedanceByConductor.divisorR,
        temperatureC: ramalTemperatureC,
      });

      const ramalExtraDvPercent = calculateVoltageDropPercent(
        worstRamalDemandKva,
        ramalCorrectedResistance,
        worstImpedanceByConductor.reactance,
        30,
      );
      const ramalTotalDvPercent = dvAccumPercent + ramalExtraDvPercent;
      const ramalVoltageV = Math.max(
        0,
        BT_PHASE_VOLTAGE_V * (1 - ramalTotalDvPercent / 100),
      );

      worstRamalVoltageV = toFixed2(ramalVoltageV);
      worstRamalDvPercent = toFixed2(ramalTotalDvPercent);
      worstRamalStatus =
        ramalTotalDvPercent > 8
          ? "CRÍTICO"
          : ramalTotalDvPercent > 5
            ? "ATENÇÃO"
            : "OK";
    }

    return {
      ...item,
      voltageV: toFixed2(voltageV),
      dvAccumPercent: toFixed2(dvAccumPercent),
      cqtStatus,
      worstRamalVoltageV,
      worstRamalDvPercent,
      worstRamalStatus,
    };
  });
};

const distanceMetersBetween = (
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number => {
  return haversineDistanceMeters(a, b);
};

export const calculateSectioningImpact = (
  topology: BtTopology,
  projectType: BtProjectType,
  clandestinoAreaM2: number,
): BtSectioningImpact => {
  if (topology.poles.length === 0) {
    return {
      unservedPoleIds: [],
      unservedClients: 0,
      estimatedDemandKva: 0,
      estimatedDemandKw: 0,
      loadCenter: null,
      suggestedPoleId: null,
    };
  }

  const { localClientByPole, ownerTransformerByPole } =
    calculateTransformerOwnershipData(topology, projectType);
  const unservedPoles = topology.poles.filter(
    (pole) => !ownerTransformerByPole.has(pole.id),
  );
  const unservedPoleIds = unservedPoles.map((pole) => pole.id);
  const unservedClients = unservedPoles.reduce(
    (sum, pole) => sum + (localClientByPole.get(pole.id) ?? 0),
    0,
  );

  const totalClients = Array.from(localClientByPole.values()).reduce(
    (sum, v) => sum + v,
    0,
  );
  const measuredDemandKva = topology.transformers.reduce(
    (sum, t) =>
      t.readings.length === 0 ? sum : sum + getTransformerDemandKva(t),
    0,
  );
  const demandPerClientKva =
    totalClients > 0 ? measuredDemandKva / totalClients : 0;

  const estimatedDemandKva =
    projectType === "clandestino"
      ? getClandestinoDemandKvaByAreaAndClients(
          clandestinoAreaM2,
          unservedClients,
        )
      : toFixed2(unservedClients * demandPerClientKva);

  if (unservedPoles.length === 0) {
    return {
      unservedPoleIds,
      unservedClients,
      estimatedDemandKva,
      estimatedDemandKw: estimatedDemandKva,
      loadCenter: null,
      suggestedPoleId: null,
    };
  }

  const weighted = unservedPoles.map((pole) => ({
    pole,
    weight: Math.max(localClientByPole.get(pole.id) ?? 0, 1),
  }));
  const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);
  const loadCenter = {
    lat:
      weighted.reduce((sum, item) => sum + item.pole.lat * item.weight, 0) /
      (totalWeight || 1),
    lng:
      weighted.reduce((sum, item) => sum + item.pole.lng * item.weight, 0) /
      (totalWeight || 1),
  };

  let suggestedPoleId: string | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const pole of unservedPoles) {
    const d = distanceMetersBetween(loadCenter, {
      lat: pole.lat,
      lng: pole.lng,
    });
    if (d < nearestDistance) {
      nearestDistance = d;
      suggestedPoleId = pole.id;
    }
  }

  return {
    unservedPoleIds,
    unservedClients,
    estimatedDemandKva,
    estimatedDemandKw: estimatedDemandKva,
    loadCenter,
    suggestedPoleId,
  };
};
