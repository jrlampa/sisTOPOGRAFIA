import proj4 from 'proj4';
import { GeoLocation } from '../types';

const UTM_REGEX = /^(\d{1,2})\s*([C-HJ-NP-X]|[NS])\s+(\d{6,7}(?:\.\d+)?)\s+(\d{7}(?:\.\d+)?)$/i;

export const parseUtmQuery = (query: string): GeoLocation | null => {
  // ... (previous implementation remains same)
  const normalized = query
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/,/g, ' ')
    .trim();

  const match = normalized.match(UTM_REGEX);
  if (!match) return null;

  const zone = parseInt(match[1], 10);
  const band = match[2].toUpperCase();
  const easting = parseFloat(match[3]);
  const northing = parseFloat(match[4]);

  if (!Number.isFinite(zone) || zone < 1 || zone > 60) return null;
  if (!Number.isFinite(easting) || !Number.isFinite(northing)) return null;

  const isSouthBand = band === 'S' || /^[C-M]$/.test(band);
  const isNorthBand = band === 'N' || /^[N-X]$/.test(band);
  if (!isSouthBand && !isNorthBand) return null;

  const projString = isSouthBand
    ? `+proj=utm +zone=${zone} +south +datum=WGS84 +units=m +no_defs`
    : `+proj=utm +zone=${zone} +datum=WGS84 +units=m +no_defs`;

  const [lng, lat] = proj4(projString, 'WGS84').forward([easting, northing]);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;

  return {
    lat,
    lng,
    label: `UTM ${zone}${band} ${easting} ${northing}`
  };
};

export const osmToGeoJSON = (elements: any[] | null): any => {
  if (!elements) return null;

  const features = elements.map(el => {
    let geometry: any = null;
    if (el.type === 'node') {
      geometry = { type: 'Point', coordinates: [el.lon, el.lat] };
    } else if (el.type === 'way' && el.geometry) {
      geometry = { type: 'LineString', coordinates: el.geometry.map((g: any) => [g.lon, g.lat]) };
    } else if (el.type === 'relation' && el.members) {
      // Simple fallback for relations
      return null;
    }

    if (!geometry) return null;

    // Phase 10: Dispatch UC Metadata for Toast
    if (el.tags?.is_uc && (el.tags?.TOPO_type || el.tags?.sisTOPO_type)) {
      if (!(window as any).__uc_toasted) {
        (window as any).__uc_toasted = new Set();
      }
      if (!(window as any).__uc_toasted.has(el.tags.name)) {
        (window as any).__uc_toasted.add(el.tags.name);
        const event = new CustomEvent('uc-detected', {
          detail: { name: el.tags.name, type: el.tags.TOPO_type || el.tags.sisTOPO_type }
        });
        window.dispatchEvent(event);
      }
    }

    return {
      type: 'Feature',
      properties: el.tags || {},
      geometry: geometry
    };
  }).filter(Boolean);

  return {
    type: 'FeatureCollection',
    features: features
  };
};
