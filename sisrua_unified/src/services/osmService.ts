import { OverpassResponse, OsmElement } from '../types';
import Logger from '../utils/logger';
import { API_BASE_URL } from '../config/api';

const IS_DEV = import.meta.env.DEV;

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

export const fetchOsmData = async (lat: number, lng: number, radius: number): Promise<OsmFetchResult> => {
  try {
    Logger.debug(`Fetching OSM data for lat: ${lat}, lng: ${lng}, radius: ${radius}m`);
    const response = await fetch(`${API_BASE_URL}/osm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ lat, lng, radius })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `OSM proxy error: HTTP ${response.status}`);
    }

    const data: OverpassResponseWithStats = await response.json();
    Logger.info(`Fetched ${data.elements.length} OSM elements`);
    return { elements: data.elements, stats: data._stats ?? null };
  } catch (error) {
    Logger.error("Failed to fetch OSM data", error);

    if (!IS_DEV) {
      throw new Error(`OSM data unavailable: Cannot reach Overpass API for coordinates (${lat.toFixed(6)}, ${lng.toFixed(6)}). Ensure network connectivity and that API rate limits are not exceeded.`);
    }

    Logger.info("Falling back to mock OSM data for testing");
    try {
      const mockResponse = await fetch(`${API_BASE_URL}/osm/mock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng, radius })
      });
      if (mockResponse.ok) {
        const mockData: OverpassResponseWithStats = await mockResponse.json();
        Logger.info(`Using mock data with ${mockData.elements.length} elements`);
        return { elements: mockData.elements, stats: mockData._stats ?? null };
      }
    } catch (mockError) {
      Logger.error("Mock fallback also failed", mockError);
    }

    throw new Error(`OSM data unavailable: Cannot reach Overpass API for coordinates (${lat.toFixed(6)}, ${lng.toFixed(6)}). Ensure network connectivity and that API rate limits are not exceeded.`);
  }
};
