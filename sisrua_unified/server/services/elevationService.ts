import { GeoLocation } from '../../src/types.js';
import { logger } from '../utils/logger.js';
import { TopodataService } from './topodataService.js';
import { fetchWithCircuitBreaker } from '../utils/externalApi.js';

export class ElevationService {
    /**
     * Calculates the Haversine distance between two points in meters
     */
    static calculateDistance(start: GeoLocation, end: GeoLocation): number {
        const R = 6371e3; // Earth's radius in meters
        const phi1 = start.lat * Math.PI / 180;
        const phi2 = end.lat * Math.PI / 180;
        const deltaPhi = (end.lat - start.lat) * Math.PI / 180;
        const deltaLambda = (end.lng - start.lng) * Math.PI / 180;

        const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    }

    /**
     * Fetches elevation profile points between two coordinates
     * Uses TOPODATA for Brazilian territory (30m resolution)
     * Falls back to open-elevation.com for international locations
     */
    static async getElevationProfile(start: GeoLocation, end: GeoLocation, steps: number = 25) {
        // Check if both points are in Brazil - use TOPODATA
        const useTopodata = TopodataService.isWithinBrazil(start.lat, start.lng) && 
                           TopodataService.isWithinBrazil(end.lat, end.lng);
        
        if (useTopodata) {
            logger.info('Using TOPODATA (30m) for Brazilian elevation');
            return this.getTopodataProfile(start, end, steps);
        }
        
        // Fallback to open-elevation for international
        return this.getOpenElevationProfile(start, end, steps);
    }

    /**
     * Get elevation profile using TOPODATA (30m resolution, Brazil only)
     */
    private static async getTopodataProfile(start: GeoLocation, end: GeoLocation, steps: number) {
        try {
            const points = await TopodataService.getElevationProfile(
                start.lat, start.lng, end.lat, end.lng, steps
            );
            
            const totalDist = this.calculateDistance(start, end);
            
            return points.map((p, i) => ({
                dist: parseFloat(((totalDist * i) / steps).toFixed(1)),
                elev: p.elevation
            }));
        } catch (error: any) {
            logger.warn('TOPODATA failed, falling back to open-elevation', { error: error.message });
            return this.getOpenElevationProfile(start, end, steps);
        }
    }

    /**
     * Get elevation profile using open-elevation (global, ~90m resolution)
     */
    private static async getOpenElevationProfile(start: GeoLocation, end: GeoLocation, steps: number) {
        const locations = [];
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            locations.push({
                latitude: start.lat + (end.lat - start.lat) * t,
                longitude: start.lng + (end.lng - start.lng) * t
            });
        }

        try {
            const response = await fetchWithCircuitBreaker(
                'OPEN_ELEVATION',
                'https://api.open-elevation.com/api/v1/lookup',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ locations }),
                    signal: AbortSignal.timeout(10000),
                },
                { maxRetries: 2, initialDelay: 500, maxDelay: 2500 }
            );

            const data = await response.json();
            const totalDist = this.calculateDistance(start, end);

            return data.results.map((r: any, i: number) => ({
                dist: parseFloat(((totalDist * i) / steps).toFixed(1)),
                elev: r.elevation
            }));

        } catch (error: any) {
            logger.error('Elevation service error', {
                error: error.message,
                start,
                end,
                steps
            });
            
            // Return fallback data (flat terrain) instead of failing
            // This ensures the app continues to work even if elevation service is down
            logger.warn('Using fallback elevation data (flat terrain)');
            const totalDist = this.calculateDistance(start, end);
            return Array.from({ length: steps + 1 }, (_, i) => ({
                dist: parseFloat(((totalDist * i) / steps).toFixed(1)),
                elev: 0 // Fallback to sea level
            }));
        }
    }

    /**
     * Get elevation at a single point
     * Uses TOPODATA for Brazil, Open-Elevation for international
     */
    static async getElevationAt(lat: number, lng: number): Promise<number | null> {
        // Check if in Brazil
        if (TopodataService.isWithinBrazil(lat, lng)) {
            try {
                return await TopodataService.getElevation(lat, lng);
            } catch (error: any) {
                logger.warn('TOPODATA single point failed, trying open-elevation', { error: error.message });
                // Fall through to open-elevation
            }
        }
        
        // Fallback to open-elevation
        try {
            const response = await fetchWithCircuitBreaker(
                'OPEN_ELEVATION',
                'https://api.open-elevation.com/api/v1/lookup',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ locations: [{ latitude: lat, longitude: lng }] }),
                    signal: AbortSignal.timeout(10000),
                },
                { maxRetries: 2, initialDelay: 500, maxDelay: 2500 }
            );

            const data = await response.json();
            return data.results[0]?.elevation ?? null;
        } catch (error: any) {
            logger.error('getElevationAt failed', { error: error.message, lat, lng });
            return null;
        }
    }
}
