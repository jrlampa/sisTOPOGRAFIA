import { GeoLocation } from '../types';

export const downloadBlob = (content: string, type: string, filename: string) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

export const escapeCsvCell = (value: string | number) => {
  const normalized = String(value).replace(/\r?\n/g, ' ');
  if (normalized.includes(';') || normalized.includes('"')) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
};

export const distanceMeters = (a: GeoLocation, b: GeoLocation) => {
  const earthRadius = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * earthRadius * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

export const inferBranchSide = (rawLabel: string): 'ESQUERDO' | 'DIREITO' | undefined => {
  const label = rawLabel.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  if (label.includes('ESQ') || label.includes('ESQUER')) return 'ESQUERDO';
  if (label.includes('DIR') || label.includes('DIREIT')) return 'DIREITO';
  return undefined;
};

export const nextSequentialId = (ids: string[], prefix: string): string => {
  const matcher = new RegExp(`^${prefix}(\\d+)$`);
  let maxSuffix = 0;
  for (const id of ids) {
    const match = id.match(matcher);
    if (!match) continue;
    const suffix = Number.parseInt(match[1], 10);
    if (Number.isFinite(suffix) && suffix > maxSuffix) maxSuffix = suffix;
  }
  return `${prefix}${maxSuffix + 1}`;
};
