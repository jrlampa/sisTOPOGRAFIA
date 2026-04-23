import { API_BASE_URL } from "../config/api";
import { buildApiHeaders } from "./apiClient";
import type { BtTopology, BtProjectType } from "../types";

export interface BtPoleAccumulatedDemand {
  poleId: string;
  localClients: number;
  accumulatedClients: number;
  localTrechoDemandKva: number;
  accumulatedDemandKva: number;
  voltageV?: number;
  dvAccumPercent?: number;
  cqtStatus?: "OK" | "ATENÇÃO" | "CRÍTICO";
  worstRamalVoltageV?: number;
  worstRamalDvPercent?: number;
  worstRamalStatus?: "OK" | "ATENÇÃO" | "CRÍTICO";
}

export interface BtTransformerEstimatedDemand {
  transformerId: string;
  assignedClients: number;
  estimatedDemandKva: number;
  /** @deprecated Use estimatedDemandKva. */
  estimatedDemandKw?: number;
}

export interface BtSectioningImpact {
  unservedPoleIds: string[];
  unservedClients: number;
  estimatedDemandKva: number;
  /** @deprecated Use estimatedDemandKva. */
  estimatedDemandKw?: number;
  loadCenter: { lat: number; lng: number } | null;
  suggestedPoleId: string | null;
}

export interface BtClandestinoDisplay {
  demandKva: number | null;
  /** @deprecated Use demandKva. */
  demandKw?: number;
  areaMin: number;
  areaMax: number;
  baseDemandKva?: number | null;
  diversificationFactor: number | null;
  finalDemandKva: number;
}

export interface BtTransformerDerived {
  transformerId: string;
  demandKva: number;
  /** @deprecated Use demandKva. */
  demandKw?: number;
  monthlyBillBrl: number;
}

export interface BtDerivedSummary {
  poles: number;
  transformers: number;
  edges: number;
  totalLengthMeters: number;
  transformerDemandKva: number;
  /** @deprecated Use transformerDemandKva. */
  transformerDemandKw?: number;
}

export interface BtDerivedResponse {
  summary: BtDerivedSummary;
  pointDemandKva: number;
  criticalPoleId: string | null;
  accumulatedByPole: BtPoleAccumulatedDemand[];
  estimatedByTransformer: BtTransformerEstimatedDemand[];
  sectioningImpact: BtSectioningImpact;
  clandestinoDisplay: BtClandestinoDisplay;
  transformersDerived: BtTransformerDerived[];
}

interface FetchBtDerivedStateInput {
  topology: BtTopology;
  projectType: BtProjectType;
  clandestinoAreaM2: number;
}

export async function fetchBtDerivedState(
  input: FetchBtDerivedStateInput,
): Promise<BtDerivedResponse> {
  const response = await fetch(`${API_BASE_URL}/bt/derived`, {
    method: "POST",
    headers: buildApiHeaders(),
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    let message = "Failed to compute BT derived state";

    try {
      const payload = (await response.json()) as {
        error?: string;
        details?: string;
        message?: string;
      };
      message = payload.details || payload.error || payload.message || message;
    } catch {
      // Keep default error message when response body is not JSON.
    }

    throw new Error(message);
  }

  return (await response.json()) as BtDerivedResponse;
}
