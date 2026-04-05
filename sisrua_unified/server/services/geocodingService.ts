import { IbgeService } from './ibgeService.js';

export interface GeoLocation {
    lat: number;
    lng: number;
    label?: string;
}

export class GeocodingService {
    private static normalizeText(value: string): string {
        return value
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim();
    }

    private static parseLatLng(query: string): GeoLocation | null {
        const normalized = query
            .replace(/\(([^)]+)\)/g, '$1')
            .replace(/(\d),(\d)/g, '$1.$2')
            .replace(/,/g, ' ');

        const numbers = normalized.match(/[-+]?\d+(?:\.\d+)?/g);
        if (!numbers || numbers.length < 2) return null;

        const lat = parseFloat(numbers[0]);
        const lng = parseFloat(numbers[1]);

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;

        return {
            lat,
            lng,
            label: `Lat/Lng ${lat.toFixed(6)}, ${lng.toFixed(6)}`
        };
    }

    private static parseUtm(query: string): { zone: number; hemisphere: 'N' | 'S'; easting: number; northing: number } | null {
        const normalized = query
            .replace(/(\d),(\d)/g, '$1.$2')
            .replace(/,/g, ' ')
            .trim();

        const utmMatch = normalized.match(/(\d{1,2})([C-HJ-NP-X]|[NS])?\s+(\d{6,7}(?:\.\d+)?)\s+(\d{7}(?:\.\d+)?)/i);
        if (!utmMatch) return null;

        const zone = parseInt(utmMatch[1], 10);
        const zoneLetter = utmMatch[2]?.toUpperCase();
        const easting = parseFloat(utmMatch[3]);
        const northing = parseFloat(utmMatch[4]);

        if (!Number.isFinite(zone) || !Number.isFinite(easting) || !Number.isFinite(northing)) return null;
        if (zone < 1 || zone > 60) return null;

        const isSouthBand = zoneLetter === 'S' || !!zoneLetter?.match(/^[C-M]$/);
        const isNorthBand = zoneLetter === 'N' || !!zoneLetter?.match(/^[N-X]$/);

        if (zoneLetter && !isSouthBand && !isNorthBand) return null;

        let hemisphere: 'N' | 'S' = 'S';
        if (zoneLetter) {
            // MGRS latitude bands: C-M = South, N-X = North (I and O omitted)
            hemisphere = isSouthBand ? 'S' : 'N';
        }

        return { zone, hemisphere, easting, northing };
    }

    /**
     * Converts UTM coordinates to Latitude/Longitude
     */
    static utmToLatLon(zone: number, hemisphere: 'N' | 'S', easting: number, northing: number): GeoLocation | null {
        if (!zone || !easting || !northing) return null;

        const a = 6378137; // WGS84 semi-major axis
        const f = 1 / 298.257223563; // WGS84 flattening
        const k0 = 0.9996; // UTM scale factor
        const e = Math.sqrt(f * (2 - f));

        const x = easting - 500000;
        const y = hemisphere === 'S' ? northing - 10000000 : northing;

        const m = y / k0;
        const mu = m / (a * (1 - Math.pow(e, 2) / 4 - 3 * Math.pow(e, 4) / 64 - 5 * Math.pow(e, 6) / 256));

        const e1 = (1 - Math.sqrt(1 - Math.pow(e, 2))) / (1 + Math.sqrt(1 - Math.pow(e, 2)));

        const J1 = (3 * e1 / 2 - 27 * Math.pow(e1, 3) / 32);
        const J2 = (21 * Math.pow(e1, 2) / 16 - 55 * Math.pow(e1, 4) / 32);
        const J3 = (151 * Math.pow(e1, 3) / 96);
        const J4 = (1097 * Math.pow(e1, 4) / 512);

        const fp = mu + J1 * Math.sin(2 * mu) + J2 * Math.sin(4 * mu) + J3 * Math.sin(6 * mu) + J4 * Math.sin(8 * mu);

        const e2 = Math.pow(e, 2) / (1 - Math.pow(e, 2));
        const c1 = e2 * Math.pow(Math.cos(fp), 2);
        const t1 = Math.pow(Math.tan(fp), 2);
        const r1 = a * (1 - Math.pow(e, 2)) / Math.pow(1 - Math.pow(e, 2) * Math.pow(Math.sin(fp), 2), 1.5);
        const n1 = a / Math.sqrt(1 - Math.pow(e, 2) * Math.pow(Math.sin(fp), 2));
        const d = x / (n1 * k0);

        const latRad = fp - (n1 * Math.tan(fp) / r1) * (Math.pow(d, 2) / 2 - (5 + 3 * t1 + 10 * c1 - 4 * Math.pow(c1, 2) - 9 * e2) * Math.pow(d, 4) / 24 + (61 + 90 * t1 + 298 * c1 + 45 * Math.pow(t1, 2) - 252 * e2 - 3 * Math.pow(c1, 2)) * Math.pow(d, 6) / 720);
        const lngRad = (d - (1 + 2 * t1 + c1) * Math.pow(d, 3) / 6 + (5 - 2 * c1 + 28 * t1 - 3 * Math.pow(c1, 2) + 8 * e2 + 24 * Math.pow(t1, 2)) * Math.pow(d, 5) / 120) / Math.cos(fp);

        const zoneCentralMeridian = (zone - 1) * 6 - 180 + 3;
        const lng = (lngRad * 180 / Math.PI) + zoneCentralMeridian;
        const lat = latRad * 180 / Math.PI;

        return { lat, lng };
    }

    /**
     * Resolves a query string into coordinates using explicit parsing only.
     */
    static async resolveLocation(query: string): Promise<GeoLocation | null> {
        // 0. Try direct lat/lng
        const latLng = this.parseLatLng(query);
        if (latLng) {
            return latLng;
        }

        // 1. Try UTM
        const utm = this.parseUtm(query);
        if (utm) {
            const coords = this.utmToLatLon(utm.zone, utm.hemisphere, utm.easting, utm.northing);
            if (coords) {
                return { ...coords, label: `UTM ${utm.zone}${utm.hemisphere} ${utm.easting} ${utm.northing}` };
            }
        }

        // 2. Try IBGE for Brazilian municipalities
        const ibgeLocation = await this.searchIbgeMunicipio(query);
        if (ibgeLocation) {
            return ibgeLocation;
        }

        return null;
    }

    /**
     * Search for Brazilian municipality using IBGE API
     */
    private static async searchIbgeMunicipio(query: string): Promise<GeoLocation | null> {
        // Check if query looks like a Brazilian municipality name
        const parts = query.split(/,\s*|\s+-\s+/);
        const municipioName = parts[0].trim();
        const ufHint = parts[1]?.trim().toUpperCase() || undefined;

        // Validate: must be at least 3 characters and contain letters
        if (municipioName.length < 3 || !/[a-zA-Z]/.test(municipioName)) {
            return null;
        }

        const municipio = await IbgeService.findMunicipioByName(municipioName, ufHint);
        
        if (municipio) {
            // Avoid false positives from fuzzy search (e.g. malformed text matching random city)
            const normalizedQuery = this.normalizeText(municipioName);
            const normalizedMunicipio = this.normalizeText(municipio.nome || '');
            const queryTokens = normalizedQuery
                .split(/[^a-z]+/)
                .filter(token => token.length >= 3);

            if (queryTokens.length === 0) {
                return null;
            }

            const hasRelevantToken = queryTokens.some(token => normalizedMunicipio.includes(token));
            if (!hasRelevantToken) {
                return null;
            }

            const uf = municipio.microrregiao?.mesorregiao?.UF?.sigla || 
                       municipio.microrregiao?.mesorregiao?.UF?.sigla || 'SP';
            
            // Use state centroid as location (simplified approach)
            const stateCentroid = this.getStateCentroid(uf);
            if (stateCentroid) {
                return {
                    lat: stateCentroid.lat,
                    lng: stateCentroid.lng,
                    label: `${municipio.nome}, ${uf} (IBGE)`
                };
            }
        }

        return null;
    }

    /**
     * Get approximate centroid for Brazilian state
     */
    private static getStateCentroid(uf: string): { lat: number; lng: number } | null {
        // Approximate centroids for Brazilian states
        const centroids: Record<string, { lat: number; lng: number }> = {
            'AC': { lat: -9.02, lng: -70.81 },
            'AL': { lat: -9.62, lng: -36.54 },
            'AM': { lat: -3.42, lng: -65.00 },
            'AP': { lat: 1.41, lng: -51.77 },
            'BA': { lat: -12.27, lng: -41.71 },
            'CE': { lat: -5.20, lng: -39.53 },
            'DF': { lat: -15.83, lng: -47.86 },
            'ES': { lat: -19.57, lng: -40.62 },
            'GO': { lat: -15.93, lng: -50.14 },
            'MA': { lat: -4.96, lng: -45.27 },
            'MG': { lat: -18.10, lng: -44.38 },
            'MS': { lat: -20.51, lng: -54.55 },
            'MT': { lat: -12.64, lng: -55.42 },
            'PA': { lat: -3.79, lng: -52.48 },
            'PB': { lat: -7.24, lng: -36.78 },
            'PE': { lat: -8.38, lng: -37.86 },
            'PI': { lat: -6.60, lng: -42.28 },
            'PR': { lat: -24.89, lng: -51.55 },
            'RJ': { lat: -22.25, lng: -42.66 },
            'RN': { lat: -5.81, lng: -36.59 },
            'RO': { lat: -10.83, lng: -63.34 },
            'RR': { lat: 2.00, lng: -61.00 },
            'RS': { lat: -30.17, lng: -53.33 },
            'SC': { lat: -27.33, lng: -51.22 },
            'SE': { lat: -10.57, lng: -37.45 },
            'SP': { lat: -22.25, lng: -48.63 },
            'TO': { lat: -9.46, lng: -48.26 }
        };
        
        return centroids[uf] || null;
    }

    /**
     * Calculate centroid from GeoJSON geometry
     */
    private static calculateCentroid(geometry: any): { lat: number; lng: number } | null {
        try {
            if (geometry.type === 'Point') {
                return { lng: geometry.coordinates[0], lat: geometry.coordinates[1] };
            }
            
            if (geometry.type === 'Polygon') {
                // Use first ring coordinates
                const coords = geometry.coordinates[0];
                let sumLng = 0, sumLat = 0;
                for (const coord of coords) {
                    sumLng += coord[0];
                    sumLat += coord[1];
                }
                return {
                    lng: sumLng / coords.length,
                    lat: sumLat / coords.length
                };
            }
            
            if (geometry.type === 'MultiPolygon') {
                // Use first polygon's first ring
                const coords = geometry.coordinates[0][0];
                let sumLng = 0, sumLat = 0;
                for (const coord of coords) {
                    sumLng += coord[0];
                    sumLat += coord[1];
                }
                return {
                    lng: sumLng / coords.length,
                    lat: sumLat / coords.length
                };
            }
        } catch (e) {
            // Silent fail
        }
        return null;
    }
}
