import { BtProjectType } from "../types";
import { haversineDistanceMeters } from "../../shared/geodesic";

// Re-exports from sub-modules
export * from "./btTransformerCalculations";
export * from "./btClandestinoCalculations";
export * from "./btTopologyFlow";
export * from "./btTransformerConflicts";

// Import specific functions for local composition
import { calculateClandestinoDemandKvaByAreaAndClients } from "./btClandestinoCalculations";

// Local composition utilities (bridging modules)
interface CalculatePointDemandKvaInput {
  projectType: BtProjectType;
  transformerDemandKva: number;
  clandestinoAreaM2: number;
  clandestinoClients: number;
}

interface CalculateRamalDmdiInput {
  projectType: BtProjectType;
  aa24DemandBase: number;
  sumClientsX: number;
  ab35LookupDmdi: number;
}

export const calculateRamalDmdiKva = ({
  projectType,
  aa24DemandBase,
  sumClientsX,
  ab35LookupDmdi,
}: CalculateRamalDmdiInput): number => {
  if (projectType === "clandestino") {
    return Number(ab35LookupDmdi.toFixed(2));
  }

  if (
    !Number.isFinite(aa24DemandBase) ||
    !Number.isFinite(sumClientsX) ||
    sumClientsX <= 0
  ) {
    return 0;
  }

  return Number((aa24DemandBase / sumClientsX).toFixed(2));
};

export const calculatePointDemandKva = ({
  projectType,
  transformerDemandKva,
  clandestinoAreaM2,
  clandestinoClients,
}: CalculatePointDemandKvaInput): number => {
  const ab35LookupDmdi = calculateClandestinoDemandKvaByAreaAndClients(
    clandestinoAreaM2,
    clandestinoClients,
  );

  return calculateRamalDmdiKva({
    projectType,
    aa24DemandBase: transformerDemandKva,
    sumClientsX: clandestinoClients,
    ab35LookupDmdi,
  });
};

/** @deprecated Use haversineDistanceMeters directly. */
export const distanceMetersBetween = (
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number => {
  return haversineDistanceMeters(a, b);
};
