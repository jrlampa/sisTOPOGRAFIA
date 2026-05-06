export interface GeoCoordinates {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_METERS = 6371000;

export function haversineDistanceMeters(
  from: GeoCoordinates,
  to: GeoCoordinates,
): number {
  const dLat = ((to.lat - from.lat) * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;

  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
