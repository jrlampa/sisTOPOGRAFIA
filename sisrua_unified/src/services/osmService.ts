import { OverpassResponse, OsmElement } from "../types";
import Logger from "../utils/logger";
import { API_BASE_URL } from "../config/api";

const IS_DEV = import.meta.env.DEV;

// Generate a request ID for tracking errors across frontend/backend
const generateRequestId = () => {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

type OverpassResponseWithStats = OverpassResponse & {
  _stats?: OsmStats;
};

export interface OsmStats {
  totalBuildings: number;
  totalRoads: number;
  totalNature: number;
  avgHeight: number;
  maxHeight: number;
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
  const clientRequestId = generateRequestId();

  try {
    Logger.debug(
      `[${clientRequestId}] Fetching OSM data for lat: ${lat}, lng: ${lng}, radius: ${radius}m`,
    );
    const response = await fetch(`${API_BASE_URL}/osm`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ lat, lng, radius }),
    });

    if (!response.ok) {
      const backendRequestId =
        response.headers.get("x-request-id")?.trim() || clientRequestId;
      let errorText = "";
      try {
        const errorData = await response.json();
        errorText =
          errorData.error || errorData.message || JSON.stringify(errorData);
      } catch {
        errorText = await response.text();
      }

      const errorMsg = `Serviço OSM indisponível (HTTP ${response.status})`;
      Logger.error(`[${backendRequestId}] ${errorMsg}: ${errorText}`);
      throw new Error(`${errorMsg}. [${backendRequestId}]`);
    }

    const backendRequestId =
      response.headers.get("x-request-id")?.trim() || clientRequestId;
    const data: OverpassResponseWithStats = await response.json();
    Logger.info(
      `[${backendRequestId}] Fetched ${data.elements.length} OSM elements`,
    );
    return { elements: data.elements, stats: data._stats ?? null };
  } catch (error) {
    Logger.error(`[${clientRequestId}] Failed to fetch OSM data`, error);

    if (!IS_DEV) {
      const msg = `Dados OSM indisponíveis para (${lat.toFixed(6)}, ${lng.toFixed(6)}). Verifique conectividade. [${clientRequestId}]`;
      throw new Error(msg);
    }

    const msg = `Dados OSM indisponíveis para (${lat.toFixed(6)}, ${lng.toFixed(6)}). Verifique conectividade. [${clientRequestId}]`;
    throw new Error(msg);
  }
};
