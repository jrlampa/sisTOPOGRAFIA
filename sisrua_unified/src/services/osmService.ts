import { OverpassResponse, OsmElement } from "../types";
import Logger from "../utils/logger";
import { API_BASE_URL } from "../config/api";
import { buildApiHeaders } from "./apiClient";
import { trackPerformance } from "../utils/analytics";

type OverpassResponseWithStats = OverpassResponse & {
  _stats?: OsmStats;
};

export interface OsmStats {
  totalBuildings: number;
  totalRoads: number;
  totalNature: number;
  avgHeight: number;
  maxHeight: number;
  estimatedDemandKw?: number;
  density?: "Baixa" | "Média" | "Alta";
  densityValue?: number;
}

export interface OsmFetchResult {
  elements: OsmElement[];
  stats: OsmStats | null;
}

export const fetchOsmData = async (
  lat: number,
  lng: number,
  radius: number,
): Promise<OsmFetchResult> => {
  const traceId = Logger.startTrace("fetchOsmData");
  try {
    Logger.debug(
      `Fetching OSM data for lat: ${lat}, lng: ${lng}, radius: ${radius}m`,
    );
    const response = await fetch(`${API_BASE_URL}/osm`, {
      method: "POST",
      headers: buildApiHeaders(),
      body: JSON.stringify({ lat, lng, radius }),
    });

    const durationMs = Logger.endTrace(traceId);
    trackPerformance("fetch_osm_data", durationMs, { radius });

    if (!response.ok) {
      let errorMessage = `OSM proxy error: HTTP ${response.status}`;

      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const payload = (await response.json()) as {
          error?: string;
          message?: string;
          code?: string;
        };

        if (payload.code === "OVERPASS_UNAVAILABLE") {
          errorMessage =
            "Overpass indisponível no momento (limite/rede). Tente novamente em alguns minutos.";
        } else {
          errorMessage = payload.message || payload.error || errorMessage;
        }
      } else {
        const errorText = await response.text();
        if (errorText) {
          errorMessage = errorText;
        }
      }

      throw new Error(errorMessage);
    }

    const data: OverpassResponseWithStats = await response.json();
    Logger.info(`Fetched ${data.elements.length} OSM elements`);
    return { elements: data.elements, stats: data._stats ?? null };
  } catch (error) {
    Logger.endTrace(traceId);
    Logger.error("Failed to fetch OSM data", error);

    if (error instanceof Error && error.message) {
      throw error;
    }

    throw new Error("OSM indisponível no momento. Tente novamente em alguns minutos.");
  }
};
