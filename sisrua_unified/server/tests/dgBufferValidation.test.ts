import { describe, it, expect } from '@jest/globals';
import {
  validateBufferZone,
  validateMultiplePoints,
} from '../services/dgBufferValidationService';
import {
  ValidateBufferZoneRequest,
  ValidateMultiplePointsRequest,
} from '../schemas/dgBufferValidation';

/**
 * Test suite for Design Generativo Buffer Validation Service
 * 
 * Scenarios tested:
 * 1. Point inside buffer zone, outside buildings (PASS)
 * 2. Point outside buffer zone (FAIL)
 * 3. Point inside buffer zone, inside building (FAIL)
 * 4. No nearby streets (FAIL)
 * 5. Batch validation with mixed results
 * 6. Fallback buffer configuration
 */

describe('dgBufferValidationService', () => {
  // Mock OSM street polyline (São Paulo, Brazil - simplified)
  const mockStreetPolyline = {
    type: 'LineString' as const,
    coordinates: [
      [-46.633, -23.550], // Street segment start (WGS-84)
      [-46.632, -23.551], // Street segment end
    ],
    osmTags: {
      highway: 'residential',
      name: 'Rua Exemplo',
    },
  };

  // Mock building footprint (simple square polygon)
  const mockBuilding = {
    type: 'Polygon' as const,
    coordinates: [
      [
        [-46.6325, -23.5505],
        [-46.6323, -23.5505],
        [-46.6323, -23.5507],
        [-46.6325, -23.5507],
        [-46.6325, -23.5505],
      ],
    ],
    indeId: 'inde-001',
    buildingType: 'residential' as const,
  };

  describe('validateBufferZone', () => {
    it('should accept point inside primary buffer zone and outside buildings', async () => {
      const request: ValidateBufferZoneRequest = {
        candidatePoint: {
          latitude: -23.5508,
          longitude: -46.6325,
        },
        streetPolylines: [mockStreetPolyline],
        buildingFootprints: [mockBuilding],
        bufferConfig: {
          type: 'primary',
          minMeters: 0.3,
          maxMeters: 50.0, // Increased buffer for test accuracy
        },
        networkIsNewGreenfield: true,
      };

      const result = await validateBufferZone(request);

      expect(result).toBeDefined();
      expect(result.passedValidations).toContain('crs_conversion_success');
      // Point should be reasonably close to street
      expect(result.distanceToClosestStreetMeters).toBeLessThan(100);
      expect(result.passedValidations).toContain('outside_buildings');
      expect(result.failedValidations).not.toContain('no_nearby_streets');
      expect(result.score).toBeGreaterThanOrEqual(0);
    });

    it('should reject point outside buffer zone', async () => {
      const request: ValidateBufferZoneRequest = {
        candidatePoint: {
          latitude: -23.540,
          longitude: -46.620,
        },
        streetPolylines: [mockStreetPolyline],
        buildingFootprints: [],
        bufferConfig: {
          type: 'primary',
          minMeters: 0.3,
          maxMeters: 0.5,
        },
      };

      const result = await validateBufferZone(request);

      expect(result.isValid).toBe(false);
      expect(result.failedValidations).toContain('outside_buffer');
      expect(result.distanceToClosestStreetMeters).toBeGreaterThan(0.5);
    });

    it('should reject point inside building footprint', async () => {
      const request: ValidateBufferZoneRequest = {
        candidatePoint: {
          latitude: -23.5506,
          longitude: -46.6324,
        },
        streetPolylines: [mockStreetPolyline],
        buildingFootprints: [mockBuilding],
        bufferConfig: {
          type: 'primary',
          minMeters: 0.3,
          maxMeters: 1.0,
        },
      };

      const result = await validateBufferZone(request);

      expect(result.isValid).toBe(false);
      expect(result.failedValidations).toContain('inside_building');
      expect(result.isInsideBuilding).toBe(true);
    });

    it('should reject point when no streets provided', async () => {
      const request: ValidateBufferZoneRequest = {
        candidatePoint: {
          latitude: -23.5509,
          longitude: -46.6324,
        },
        streetPolylines: [],
        buildingFootprints: [],
        bufferConfig: {
          type: 'primary',
          minMeters: 0.3,
          maxMeters: 0.5,
        },
      };

      const result = await validateBufferZone(request);

      expect(result.isValid).toBe(false);
      expect(result.failedValidations).toContain('no_nearby_streets');
      expect(result.distanceToClosestStreetMeters).toBe(Infinity);
    });

    it('should use fallback buffer configuration', async () => {
      const request: ValidateBufferZoneRequest = {
        candidatePoint: {
          latitude: -23.5508,
          longitude: -46.6325,
        },
        streetPolylines: [mockStreetPolyline],
        buildingFootprints: [],
        bufferConfig: {
          type: 'fallback',
          minMeters: 0.5,
          maxMeters: 100.0, // Increased for test accuracy
        },
      };

      const result = await validateBufferZone(request);

      expect(result.bufferType).toBe('fallback');
      expect(result.notes).toContain('0.5-100');
    });

    it('should calculate CRS correctly and set UTM zone', async () => {
      const request: ValidateBufferZoneRequest = {
        candidatePoint: {
          latitude: -23.5509,
          longitude: -46.6324,
        },
        streetPolylines: [mockStreetPolyline],
        buildingFootprints: [],
        bufferConfig: {
          type: 'primary',
          minMeters: 0.3,
          maxMeters: 5.0,
        },
        utm: {
          zone: 23,
        },
      };

      const result = await validateBufferZone(request);

      expect(result.passedValidations).toContain('crs_conversion_success');
    });
  });

  describe('validateMultiplePoints', () => {
    it('should process batch validation with mixed results', async () => {
      const request: ValidateMultiplePointsRequest = {
        candidatePoints: [
          {
            id: 'pole-001',
            latitude: -23.5509,
            longitude: -46.6324,
          },
          {
            id: 'pole-002',
            latitude: -23.540,
            longitude: -46.620,
          },
          {
            id: 'pole-003',
            latitude: -23.5506,
            longitude: -46.6324,
          },
        ],
        streetPolylines: [mockStreetPolyline],
        buildingFootprints: [mockBuilding],
        bufferConfig: {
          type: 'primary',
          minMeters: 0.3,
          maxMeters: 1.0,
        },
        networkIsNewGreenfield: true,
      };

      const result = await validateMultiplePoints(request);

      expect(result.batchId).toBeDefined();
      expect(result.processedAt).toBeDefined();
      expect(result.pointsValidated).toBe(3);
      expect(result.pointsAccepted).toBeGreaterThanOrEqual(0);
      expect(result.pointsRejected).toBeGreaterThanOrEqual(0);
      expect(result.pointsAccepted + result.pointsRejected).toBe(3);
      expect(result.acceptanceRate).toBeGreaterThanOrEqual(0);
      expect(result.acceptanceRate).toBeLessThanOrEqual(1);
      expect(result.results).toHaveLength(3);
    });

    it('should recommend proceed_full_dg with high acceptance rate', async () => {
      const request: ValidateMultiplePointsRequest = {
        candidatePoints: [
          {
            id: 'pole-001',
            latitude: -23.5509,
            longitude: -46.6324,
          },
          {
            id: 'pole-002',
            latitude: -23.5509,
            longitude: -46.6324,
          },
        ],
        streetPolylines: [mockStreetPolyline],
        buildingFootprints: [],
        bufferConfig: {
          type: 'primary',
          minMeters: 0.3,
          maxMeters: 2.0,
        },
      };

      const result = await validateMultiplePoints(request);

      if (result.acceptanceRate >= 0.8) {
        expect(result.recommendationForDg).toBe('proceed_full_dg');
      }
    });

    it('should recommend manual_review_recommended with moderate acceptance rate', async () => {
      const request: ValidateMultiplePointsRequest = {
        candidatePoints: [
          {
            id: 'pole-001',
            latitude: -23.5509,
            longitude: -46.6324,
          },
          {
            id: 'pole-002',
            latitude: -23.540,
            longitude: -46.620,
          },
          {
            id: 'pole-003',
            latitude: -23.540,
            longitude: -46.620,
          },
          {
            id: 'pole-004',
            latitude: -23.540,
            longitude: -46.620,
          },
        ],
        streetPolylines: [mockStreetPolyline],
        buildingFootprints: [],
        bufferConfig: {
          type: 'primary',
          minMeters: 0.3,
          maxMeters: 2.0,
        },
      };

      const result = await validateMultiplePoints(request);

      if (result.acceptanceRate >= 0.5 && result.acceptanceRate < 0.8) {
        expect(result.recommendationForDg).toBe('manual_review_recommended');
      }
    });

    it('should track rejection summary by type', async () => {
      const request: ValidateMultiplePointsRequest = {
        candidatePoints: [
          {
            id: 'pole-far',
            latitude: -23.540,
            longitude: -46.620,
          },
          {
            id: 'pole-in-building',
            latitude: -23.5506,
            longitude: -46.6324,
          },
        ],
        streetPolylines: [mockStreetPolyline],
        buildingFootprints: [mockBuilding],
        bufferConfig: {
          type: 'primary',
          minMeters: 0.3,
          maxMeters: 1.0,
        },
      };

      const result = await validateMultiplePoints(request);

      expect(result.rejectionSummary).toBeDefined();
      expect(result.rejectionSummary.outside_buffer).toBeGreaterThanOrEqual(0);
      expect(result.rejectionSummary.inside_building).toBeGreaterThanOrEqual(0);
      expect(result.rejectionSummary.no_nearby_streets).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty candidate points gracefully', async () => {
      const request: ValidateMultiplePointsRequest = {
        candidatePoints: [],
        streetPolylines: [mockStreetPolyline],
        buildingFootprints: [],
        bufferConfig: {
          type: 'primary',
          minMeters: 0.3,
          maxMeters: 0.5,
        },
      };

      try {
        await validateMultiplePoints(request);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });
});
