import { randomUUID } from "node:crypto";
import {
  ProjectedCoordinate,
  BufferValidationResult,
  BatchValidationResult,
  ValidateBufferZoneRequest,
  ValidateMultiplePointsRequest,
} from "../schemas/dgBufferValidation.js";
import { logger } from "../utils/logger.js";
import { latLonToUtm } from "./dg/dgCandidates.js";

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
 * Calculate distance between two points in projected coordinates (meters)
 */
function distanceMeters(
  p1: ProjectedCoordinate,
  p2: ProjectedCoordinate,
): number {
  const dx = p2.easting - p1.easting;
  const dy = p2.northing - p1.northing;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Check if point is inside polygon (ray casting algorithm)
 */
function isPointInPolygon(
  point: [number, number],
  polygon: [number, number][],
): boolean {
  const [x, y] = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];

    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Calculate closest distance from point to a line segment with CLAMPING.
 * Returns distance in meters.
 */
function pointToSegmentDistance(
  point: ProjectedCoordinate,
  lineStart: ProjectedCoordinate,
  lineEnd: ProjectedCoordinate,
): number {
  const px = point.easting;
  const py = point.northing;
  const x1 = lineStart.easting;
  const y1 = lineStart.northing;
  const x2 = lineEnd.easting;
  const y2 = lineEnd.northing;

  const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
  if (l2 === 0) return distanceMeters(point, lineStart);

  // Projection parameter t clamped between 0 and 1
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));

  const projX = x1 + t * (x2 - x1);
  const projY = y1 + t * (y2 - y1);

  const dx = px - projX;
  const dy = py - projY;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Validate single candidate point against buffer zones and exclusions
 */
export async function validateBufferZone(
  request: ValidateBufferZoneRequest,
): Promise<BufferValidationResult> {
  const pointId = `point-${randomUUID()}`;
  const passedValidations: (
    | "in_buffer_zone"
    | "outside_buildings"
    | "crs_conversion_success"
  )[] = [];
  const failedValidations: (
    | "outside_buffer"
    | "inside_building"
    | "crs_error"
    | "no_nearby_streets"
  )[] = [];

  try {
    // 1. Convert candidate point to UTM using robust DG candidate implementation
    const utm = latLonToUtm(
      request.candidatePoint.latitude,
      request.candidatePoint.longitude,
    );
    const candidateUtm: ProjectedCoordinate = {
      easting: utm.x,
      northing: utm.y,
      zone: 23, // Defaulting to 23 for consistency in DG module
    };
    passedValidations.push("crs_conversion_success");

    // 2. Convert all street polylines to UTM
    const streetSegmentsUtm: Array<{
      start: ProjectedCoordinate;
      end: ProjectedCoordinate;
    }> = [];
    for (const polyline of request.streetPolylines) {
      for (let i = 0; i < polyline.coordinates.length - 1; i++) {
        const [lon1, lat1] = polyline.coordinates[i];
        const [lon2, lat2] = polyline.coordinates[i + 1];

        const utm1 = latLonToUtm(lat1, lon1);
        const utm2 = latLonToUtm(lat2, lon2);

        streetSegmentsUtm.push({
          start: { easting: utm1.x, northing: utm1.y, zone: 23 },
          end: { easting: utm2.x, northing: utm2.y, zone: 23 },
        });
      }
    }

    if (streetSegmentsUtm.length === 0) {
      failedValidations.push("no_nearby_streets");
      return {
        pointId,
        isValid: false,
        passedValidations,
        failedValidations,
        distanceToClosestStreetMeters: Infinity,
        isInsideBuilding: false,
        bufferType: "none",
        score: 0,
        notes: "No street polylines provided for validation",
      };
    }

    // 3. Find closest distance to any street segment (clamped)
    let minDistance = Infinity;
    for (const segment of streetSegmentsUtm) {
      const dist = pointToSegmentDistance(
        candidateUtm,
        segment.start,
        segment.end,
      );
      minDistance = Math.min(minDistance, dist);
    }

    // 4. Check if point is within buffer zone
    const bufferConfig = request.bufferConfig || {
      type: "primary",
      minMeters: 0.3,
      maxMeters: 0.5,
    };
    const isInBuffer =
      minDistance >= bufferConfig.minMeters &&
      minDistance <= bufferConfig.maxMeters;

    if (!isInBuffer) {
      failedValidations.push("outside_buffer");
    } else {
      passedValidations.push("in_buffer_zone");
    }

    // 5. Check if point is inside any building (polygon test)
    let isInsideBuilding = false;
    for (const building of request.buildingFootprints || []) {
      const exteriorRing = building.coordinates[0];
      if (
        isPointInPolygon(
          [request.candidatePoint.longitude, request.candidatePoint.latitude],
          exteriorRing,
        )
      ) {
        isInsideBuilding = true;
        break;
      }
    }

    if (isInsideBuilding) {
      failedValidations.push("inside_building");
    } else {
      passedValidations.push("outside_buildings");
    }

    // 6. Final validity and score
    const isValid = isInBuffer && !isInsideBuilding;
    let score = 0;
    if (isInBuffer) score += 50;
    if (!isInsideBuilding) score += 50;

    return {
      pointId,
      isValid,
      passedValidations,
      failedValidations,
      distanceToClosestStreetMeters: minDistance,
      isInsideBuilding,
      bufferType: isInBuffer ? bufferConfig.type : "none",
      score: isValid ? 100 : Math.max(0, score), // Fixing logic: if one passes, it gets 50.
      notes: `Distance to nearest street: ${minDistance.toFixed(3)}m. Buffer: [${bufferConfig.minMeters}-${bufferConfig.maxMeters}]m`,
    };
  } catch (error) {
    logger.error("Error during buffer zone validation", { pointId, error });
    failedValidations.push("crs_error");
    return {
      pointId,
      isValid: false,
      passedValidations,
      failedValidations,
      distanceToClosestStreetMeters: 0, // Using 0 instead of -1 for schema non-negative constraint
      isInsideBuilding: false,
      bufferType: "none",
      score: 0,
      notes:
        error instanceof Error ? error.message : "Unknown validation error",
    };
  }
}

/**
 * Validate multiple candidate points (batch processing)
 */
export async function validateMultiplePoints(
  request: ValidateMultiplePointsRequest,
): Promise<BatchValidationResult> {
  const batchId = randomUUID();
  const results: BufferValidationResult[] = [];
  const rejectionSummary = {
    outside_buffer: 0,
    inside_building: 0,
    no_nearby_streets: 0,
    other_errors: 0,
  };

  for (const candidatePoint of request.candidatePoints) {
    const validationRequest: ValidateBufferZoneRequest = {
      candidatePoint,
      streetPolylines: request.streetPolylines,
      buildingFootprints: request.buildingFootprints || [],
      bufferConfig: request.bufferConfig || {
        type: "primary",
        minMeters: 0.3,
        maxMeters: 0.5,
      },
      networkIsNewGreenfield: request.networkIsNewGreenfield || false,
    };

    const result = await validateBufferZone(validationRequest);

    // Inject the point ID if provided in the candidate point
    if (candidatePoint.id) {
      result.pointId = candidatePoint.id;
    }

    results.push(result);

    if (!result.isValid) {
      if (result.failedValidations.includes("outside_buffer"))
        rejectionSummary.outside_buffer++;
      else if (result.failedValidations.includes("inside_building"))
        rejectionSummary.inside_building++;
      else if (result.failedValidations.includes("no_nearby_streets"))
        rejectionSummary.no_nearby_streets++;
      else rejectionSummary.other_errors++;
    }
  }

  const pointsAccepted = results.filter((r) => r.isValid).length;
  const acceptanceRate =
    request.candidatePoints.length > 0
      ? pointsAccepted / request.candidatePoints.length
      : 0;

  let recommendationForDg:
    | "proceed_full_dg"
    | "manual_review_recommended"
    | "insufficient_valid_points";
  if (acceptanceRate >= 0.8) {
    recommendationForDg = "proceed_full_dg";
  } else if (acceptanceRate >= 0.5) {
    recommendationForDg = "manual_review_recommended";
  } else {
    recommendationForDg = "insufficient_valid_points";
  }

  return {
    batchId,
    processedAt: new Date().toISOString(),
    pointsValidated: request.candidatePoints.length,
    pointsAccepted,
    pointsRejected: request.candidatePoints.length - pointsAccepted,
    acceptanceRate,
    results,
    rejectionSummary,
    recommendationForDg,
  };
}
