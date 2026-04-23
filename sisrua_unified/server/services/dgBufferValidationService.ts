import { randomUUID } from 'crypto';
import {
  Coordinate,
  ProjectedCoordinate,
  BufferConfig,
  OsmLineString,
  BuildingPolygon,
  BufferValidationResult,
  BatchValidationResult,
  ValidateBufferZoneRequest,
  ValidateMultiplePointsRequest,
} from '../schemas/dgBufferValidation.js';
import { logger } from '../utils/logger.js';

/**
 * Design Generativo Buffer Validation Service
 * 
 * Validates candidate pole/point positions against:
 * 1. Street buffer zones (primary: 0.3-0.5m from curb, fallback: 0.5-2.0m from centerline)
 * 2. Building exclusion zones (no points inside buildings)
 * 3. CRS conversion (WGS-84 to SIRGAS 2000 / UTM for metric precision)
 * 
 * Specification: docs/DG_IMPLEMENTATION_ADDENDUM_2026.md (Frente 2 - Backend)
 */

/**
 * Convert WGS-84 (lat/lon) to SIRGAS 2000 / UTM
 * 
 * Simple approximation: uses zone calculation from longitude
 * For production: integrate with proj4 or Turf.js advanced transforms
 * 
 * @param lat - Latitude in WGS-84
 * @param lon - Longitude in WGS-84
 * @returns Projected coordinate in UTM
 */
function wgs84ToUtm(lat: number, lon: number): ProjectedCoordinate {
  // Calculate UTM zone from longitude
  const zone = Math.floor((lon + 180) / 6) + 1;

  // Simplified conversion (for accuracy, use proj4js library)
  // This is a rough approximation for demonstration
  const falseEasting = 500000;
  const falseNorthing = lat >= 0 ? 0 : 10000000;

  // Mercator-like projection (simplified)
  const easting = falseEasting + lon * 111320 * Math.cos((lat * Math.PI) / 180);
  const northing = falseNorthing + lat * 110540;

  return {
    easting,
    northing,
    zone,
  };
}

/**
 * Calculate distance between two points in projected coordinates (meters)
 */
function distanceMeters(p1: ProjectedCoordinate, p2: ProjectedCoordinate): number {
  if (p1.zone !== p2.zone) {
    logger.warn('Points in different UTM zones for distance calculation', { p1Zone: p1.zone, p2Zone: p2.zone });
  }
  const dx = p2.easting - p1.easting;
  const dy = p2.northing - p1.northing;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Check if point is inside polygon (ray casting algorithm)
 */
function isPointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  const [x, y] = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];

    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Calculate closest distance from point to a line segment
 * Returns distance in meters (approximate, in WGS-84 degrees then converted)
 */
function pointToLineDistance(
  point: ProjectedCoordinate,
  lineStart: ProjectedCoordinate,
  lineEnd: ProjectedCoordinate
): number {
  const { easting: px, northing: py } = point;
  const { easting: x1, northing: y1 } = lineStart;
  const { easting: x2, northing: y2 } = lineEnd;

  const numerator = Math.abs((y2 - y1) * px - (x2 - x1) * py + x2 * y1 - y2 * x1);
  const denominator = Math.sqrt((y2 - y1) ** 2 + (x2 - x1) ** 2);

  if (denominator === 0) {
    return distanceMeters(point, lineStart);
  }

  return numerator / denominator;
}

/**
 * Validate single candidate point against buffer zones and exclusions
 */
export async function validateBufferZone(
  request: ValidateBufferZoneRequest
): Promise<BufferValidationResult> {
  const pointId = `point-${randomUUID()}`;
  const passedValidations: ("in_buffer_zone" | "outside_buildings" | "crs_conversion_success")[] = [];
  const failedValidations: ("outside_buffer" | "inside_building" | "crs_error" | "no_nearby_streets")[] = [];

  try {
    // 1. Convert candidate point to UTM
    const candidateUtm = wgs84ToUtm(
      request.candidatePoint.latitude,
      request.candidatePoint.longitude
    );
    passedValidations.push('crs_conversion_success');

    // 2. Convert all street polylines to UTM
    const streetSegmentsUtm: Array<{ start: ProjectedCoordinate; end: ProjectedCoordinate }> = [];
    for (const polyline of request.streetPolylines) {
      for (let i = 0; i < polyline.coordinates.length - 1; i++) {
        const [lon1, lat1] = polyline.coordinates[i];
        const [lon2, lat2] = polyline.coordinates[i + 1];
        streetSegmentsUtm.push({
          start: wgs84ToUtm(lat1, lon1),
          end: wgs84ToUtm(lat2, lon2),
        });
      }
    }

    if (streetSegmentsUtm.length === 0) {
      failedValidations.push('no_nearby_streets');
      return {
        pointId,
        isValid: false,
        passedValidations,
        failedValidations,
        distanceToClosestStreetMeters: Infinity,
        isInsideBuilding: false,
        bufferType: 'none',
        score: 0,
        notes: 'No street polylines provided for validation',
      };
    }

    // 3. Find closest distance to any street
    let minDistance = Infinity;
    for (const segment of streetSegmentsUtm) {
      const dist = pointToLineDistance(candidateUtm, segment.start, segment.end);
      minDistance = Math.min(minDistance, dist);
    }

    // 4. Check if point is within buffer zone
    const bufferConfig = request.bufferConfig || { type: 'primary', minMeters: 0.3, maxMeters: 0.5 };
    const isInBuffer = minDistance >= bufferConfig.minMeters && minDistance <= bufferConfig.maxMeters;

    if (!isInBuffer) {
      failedValidations.push('outside_buffer');
    } else {
      passedValidations.push('in_buffer_zone');
    }

    // 5. Check if point is inside any building (polygon test)
    let isInsideBuilding = false;
    for (const building of request.buildingFootprints || []) {
      // Use first ring of polygon (exterior ring)
      const exteriorRing = building.coordinates[0];
      if (isPointInPolygon(
        [request.candidatePoint.longitude, request.candidatePoint.latitude],
        exteriorRing
      )) {
        isInsideBuilding = true;
        break;
      }
    }

    if (isInsideBuilding) {
      failedValidations.push('inside_building');
    } else {
      passedValidations.push('outside_buildings');
    }

    // 6. Calculate score
    const isValid = isInBuffer && !isInsideBuilding;
    let score = 0;
    if (isInBuffer) score += 50;
    if (!isInsideBuilding) score += 50;

    logger.info('Buffer zone validation completed', {
      pointId,
      isValid,
      distance: minDistance,
      bufferConfig,
      isInsideBuilding,
    });

    return {
      pointId,
      isValid,
      passedValidations,
      failedValidations,
      distanceToClosestStreetMeters: minDistance,
      isInsideBuilding,
      bufferType: isInBuffer ? bufferConfig.type : 'none',
      score: isValid ? 100 : Math.max(0, score - 50),
      notes: `Distance to nearest street: ${minDistance.toFixed(2)}m. Buffer: [${bufferConfig.minMeters}-${bufferConfig.maxMeters}]m`,
    };
  } catch (error) {
    logger.error('Error during buffer zone validation', { pointId, error });
    failedValidations.push('crs_error');
    return {
      pointId,
      isValid: false,
      passedValidations,
      failedValidations,
      distanceToClosestStreetMeters: -1,
      isInsideBuilding: false,
      bufferType: 'none',
      score: 0,
      notes: error instanceof Error ? error.message : 'Unknown validation error',
    };
  }
}

/**
 * Validate multiple candidate points (batch processing)
 */
export async function validateMultiplePoints(
  request: ValidateMultiplePointsRequest
): Promise<BatchValidationResult> {
  const batchId = randomUUID();
  const results: BufferValidationResult[] = [];
  const rejectionSummary = {
    outside_buffer: 0,
    inside_building: 0,
    no_nearby_streets: 0,
    other_errors: 0,
  };

  logger.info('Starting batch buffer validation', {
    batchId,
    pointCount: request.candidatePoints.length,
  });

  // Validate each point
  for (const candidatePoint of request.candidatePoints) {
    const pointWithId = {
      ...candidatePoint,
      id: candidatePoint.id || randomUUID(),
    };

    const validationRequest = {
      candidatePoint,
      streetPolylines: request.streetPolylines,
      buildingFootprints: request.buildingFootprints,
      ...(request.bufferConfig ? { bufferConfig: request.bufferConfig } : {}),
      networkIsNewGreenfield: request.networkIsNewGreenfield,
    } as ValidateBufferZoneRequest;

    const result = await validateBufferZone(validationRequest);
    results.push(result);

    // Track rejections
    if (!result.isValid) {
      if (result.failedValidations.includes('outside_buffer')) rejectionSummary.outside_buffer++;
      if (result.failedValidations.includes('inside_building')) rejectionSummary.inside_building++;
      if (result.failedValidations.includes('no_nearby_streets')) rejectionSummary.no_nearby_streets++;
      if (
        result.failedValidations.includes('crs_error') ||
        result.failedValidations.some((v: string) => !['outside_buffer', 'inside_building', 'no_nearby_streets'].includes(v))
      ) {
        rejectionSummary.other_errors++;
      }
    }
  }

  const pointsAccepted = results.filter(r => r.isValid).length;
  const pointsRejected = results.filter(r => !r.isValid).length;
  const acceptanceRate = request.candidatePoints.length > 0
    ? pointsAccepted / request.candidatePoints.length
    : 0;

  // Determine DG recommendation
  let recommendationForDg: 'proceed_full_dg' | 'manual_review_recommended' | 'insufficient_valid_points';
  if (acceptanceRate >= 0.8) {
    recommendationForDg = 'proceed_full_dg';
  } else if (acceptanceRate >= 0.5) {
    recommendationForDg = 'manual_review_recommended';
  } else {
    recommendationForDg = 'insufficient_valid_points';
  }

  const batchResult: BatchValidationResult = {
    batchId,
    processedAt: new Date().toISOString(),
    pointsValidated: request.candidatePoints.length,
    pointsAccepted,
    pointsRejected,
    acceptanceRate,
    results,
    rejectionSummary,
    recommendationForDg,
  };

  logger.info('Batch buffer validation completed', {
    batchId,
    acceptanceRate: `${(acceptanceRate * 100).toFixed(1)}%`,
    recommendation: recommendationForDg,
  });

  return batchResult;
}
