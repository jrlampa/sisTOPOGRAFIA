import proj4 from 'proj4';
import { GeoLocation } from '../types';

const UTM_REGEX = /^(\d{1,2})\s*([C-HJ-NP-X]|[NS])\s+(\d{6,7}(?:\.\d+)?)\s+(\d{7}(?:\.\d+)?)$/i;

export const parseLatLngQuery = (query: string): GeoLocation | null => {
  const normalized = query
    .replace(/\(([^)]+)\)/g, '$1')
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/,/g, ' ')
    .replace(/;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!/^[-+]?\d+(?:\.\d+)?\s+[-+]?\d+(?:\.\d+)?$/.test(normalized)) {
    return null;
  }

  const [latRaw, lngRaw] = normalized.split(' ');
  const lat = Number.parseFloat(latRaw);
  const lng = Number.parseFloat(lngRaw);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;

  return {
    lat,
    lng,
    label: `Lat/Lng ${lat.toFixed(6)}, ${lng.toFixed(6)}`
  };
};

export const parseUtmQuery = (query: string): GeoLocation | null => {
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

  // If SAD69 support is needed: +proj=utm +zone=${zone} +south +ellps=aust_SA +units=m +no_defs
  const [lng, lat] = proj4(projString, 'WGS84').forward([easting, northing]);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;

  return {
    lat,
    lng,
    label: `UTM ${zone}${band} ${easting} ${northing}`
  };
};

/**
 * Calculates the UTM zone for a given longitude.
 */
export const getUtmZone = (lng: number): number => {
  return Math.floor((lng + 180) / 6) + 1;
};

/**
 * Identifies the UTM band for a given latitude.
 */
export const getUtmBand = (lat: number): string => {
  if (lat >= 84 || lat < -80) return "Z"; // Outside UTM range
  const bands = "CDEFGHJKLMNPQRSTUVWXX";
  const index = Math.floor((lat + 80) / 8);
  return bands[index] || "X";
};

/**
 * Converts WGS84 coordinates to UTM Easting/Northing.
 */
export const toUtm = (lat: number, lng: number) => {
  const zone = getUtmZone(lng);
  const band = getUtmBand(lat);
  const isSouth = lat < 0;

  const projString = `+proj=utm +zone=${zone}${isSouth ? " +south" : ""} +datum=WGS84 +units=m +no_defs`;
  
  const [easting, northing] = proj4("WGS84", projString).forward([lng, lat]);

  return {
    easting,
    northing,
    zone,
    band,
    isSouth,
    projString
  };
};
