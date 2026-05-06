import { z } from 'zod';

/**
 * Schemas for Design Generativo Buffer Validation
 * 
 * Correção: Adicionado highwayClass e min(1) em ruas para batch.
 */

// Point in WGS-84 (input from user)
export const coordinateSchema = z.object({
  latitude: z.number().min(-90).max(90).describe('Latitude in WGS-84'),
  longitude: z.number().min(-180).max(180).describe('Longitude in WGS-84')
});

// Point in projected CRS (SIRGAS 2000 UTM)
export const projectedCoordinateSchema = z.object({
  easting: z.number().positive().describe('Easting in UTM'),
  northing: z.number().positive().describe('Northing in UTM'),
  zone: z.number().min(1).max(60).describe('UTM zone')
});

// Buffer zone configuration
export const bufferConfigSchema = z.object({
  type: z.enum(['primary', 'fallback']).describe('Buffer type (curb or centerline)'),
  minMeters: z.number().nonnegative().describe('Minimum offset from reference'),
  maxMeters: z.number().positive().describe('Maximum offset from reference')
}).refine(
  data => data.minMeters <= data.maxMeters,
  'minMeters must be <= maxMeters'
);

// OSM street geometry (polyline)
export const osmLineStringSchema = z.object({
  type: z.literal('LineString'),
  coordinates: z.array(
    z.tuple([
      z.number().min(-180).max(180), // longitude
      z.number().min(-90).max(90)     // latitude
    ])
  ).min(2, 'LineString must have at least 2 points'),
  osmTags: z.object({
    highway: z.string().optional(),
    name: z.string().optional()
  }).optional(),
  /** Classe OSM para restrição de calçada */
  highwayClass: z.enum(["residential", "tertiary", "secondary", "primary", "trunk", "unknown"]).optional()
});

// Building footprint (polygon)
export const buildingPolygonSchema = z.object({
  type: z.literal('Polygon'),
  coordinates: z.array(z.array(z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]))),
  indeId: z.string().optional(),
  buildingType: z.enum(['residential', 'commercial', 'industrial', 'public', 'other']).optional()
});

// Request for buffer zone validation
export const validateBufferZoneRequestSchema = z.object({
  candidatePoint: coordinateSchema.describe('Candidate pole/point location'),
  streetPolylines: z.array(osmLineStringSchema).min(1, 'At least one street polyline required'),
  buildingFootprints: z.array(buildingPolygonSchema).optional().default([]),
  bufferConfig: bufferConfigSchema.optional().default({
    type: 'primary',
    minMeters: 0.3,
    maxMeters: 0.5
  }),
  utm: z.object({ zone: z.number().min(1).max(60) }).optional(),
  networkIsNewGreenfield: z.boolean().default(false)
});

// Validation result for a single point
export const bufferValidationResultSchema = z.object({
  pointId: z.string(),
  isValid: z.boolean(),
  passedValidations: z.array(z.enum(['in_buffer_zone', 'outside_buildings', 'crs_conversion_success'])),
  failedValidations: z.array(z.enum(['outside_buffer', 'inside_building', 'crs_error', 'no_nearby_streets'])),
  distanceToClosestStreetMeters: z.number().nonnegative(),
  isInsideBuilding: z.boolean(),
  bufferType: z.enum(['primary', 'fallback', 'none']),
  score: z.number().min(0).max(100),
  notes: z.string().optional()
});

// Batch validation request
export const validateMultiplePointsRequestSchema = z.object({
  candidatePoints: z.array(coordinateSchema.extend({ id: z.string().optional() })).min(1, 'At least one candidate point required'),
  streetPolylines: z.array(osmLineStringSchema).min(1, 'At least one street polyline required for batch'),
  buildingFootprints: z.array(buildingPolygonSchema).optional().default([]),
  bufferConfig: bufferConfigSchema.optional(),
  networkIsNewGreenfield: z.boolean().optional().default(false)
});

// Batch validation response
export const batchValidationResultSchema = z.object({
  batchId: z.string().uuid(),
  processedAt: z.string().datetime(),
  pointsValidated: z.number().nonnegative(),
  pointsAccepted: z.number().nonnegative(),
  pointsRejected: z.number().nonnegative(),
  acceptanceRate: z.number().min(0).max(1),
  results: z.array(bufferValidationResultSchema),
  rejectionSummary: z.object({
    outside_buffer: z.number().nonnegative(),
    inside_building: z.number().nonnegative(),
    no_nearby_streets: z.number().nonnegative(),
    other_errors: z.number().nonnegative()
  }),
  recommendationForDg: z.enum(['proceed_full_dg', 'manual_review_recommended', 'insufficient_valid_points'])
});

export type Coordinate = z.infer<typeof coordinateSchema>;
export type ProjectedCoordinate = z.infer<typeof projectedCoordinateSchema>;
export type BufferConfig = z.infer<typeof bufferConfigSchema>;
export type OsmLineString = z.infer<typeof osmLineStringSchema>;
export type BuildingPolygon = z.infer<typeof buildingPolygonSchema>;
export type BufferValidationResult = z.infer<typeof bufferValidationResultSchema>;
export type ValidateBufferZoneRequest = z.infer<typeof validateBufferZoneRequestSchema>;
export type ValidateMultiplePointsRequest = z.infer<typeof validateMultiplePointsRequestSchema>;
export type BatchValidationResult = z.infer<typeof batchValidationResultSchema>;
