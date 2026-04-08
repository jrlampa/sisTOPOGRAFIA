import { OverpassResponse, OsmElement } from '../types';
import Logger from '../utils/logger';
import { API_BASE_URL } from '../config/api';

export const fetchOsmData = async (lat: number, lng: number, radius: number): Promise<OsmElement[]> => {
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

    const data: OverpassResponse = await response.json();
    Logger.info(`Fetched ${data.elements.length} OSM elements`);
    return data.elements;
  } catch (error) {
    Logger.error("Failed to fetch OSM data", error);
   Logger.info("Falling back to mock OSM data for testing");
   try {
     const mockResponse = await fetch(`${API_BASE_URL}/osm/mock`, {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ lat, lng, radius })
     });
     if (mockResponse.ok) {
       const mockData: OverpassResponse = await mockResponse.json();
       Logger.info(`Using mock data with ${mockData.elements.length} elements`);
       return mockData.elements;
     }
   } catch (mockError) {
     Logger.error("Mock fallback also failed", mockError);
   }
    throw error;
  }
};
