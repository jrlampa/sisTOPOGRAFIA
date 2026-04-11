export const swaggerComponents = {
  schemas: {
    ErrorResponse: {
      type: 'object',
      properties: {
        error: { type: 'string' },
        details: { type: 'string' }
      }
    },
    DxfRequest: {
      type: 'object',
      required: ['lat', 'lon', 'radius', 'mode'],
      properties: {
        lat: { type: 'number', minimum: -90, maximum: 90 },
        lon: { type: 'number', minimum: -180, maximum: 180 },
        radius: { type: 'number', minimum: 10, maximum: 5000 },
        mode: { type: 'string', enum: ['circle', 'polygon', 'bbox'] },
        polygon: {
          oneOf: [
            { type: 'string' },
            {
              type: 'array',
              items: {
                type: 'array',
                items: { type: 'number' },
                minItems: 2,
                maxItems: 2
              }
            }
          ]
        },
        layers: {
          type: 'object',
          additionalProperties: true
        },
        projection: { type: 'string', example: 'local' }
      }
    },
    DxfQueuedResponse: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'queued' },
        jobId: { oneOf: [{ type: 'string' }, { type: 'number' }] }
      }
    },
    DxfCachedResponse: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'success' },
        url: { type: 'string' }
      }
    },
    JobStatusResponse: {
      type: 'object',
      properties: {
        id: { oneOf: [{ type: 'string' }, { type: 'number' }] },
        status: { type: 'string', enum: ['queued', 'active', 'completed', 'failed'] },
        progress: { type: 'number' },
        result: {
          type: 'object',
          nullable: true,
          properties: {
            url: { type: 'string' }
          }
        },
        error: { type: 'string', nullable: true }
      }
    },
    BatchResult: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        status: { type: 'string', enum: ['queued', 'cached'] },
        jobId: { oneOf: [{ type: 'string' }, { type: 'number' }] },
        url: { type: 'string' }
      }
    },
    BatchError: {
      type: 'object',
      properties: {
        line: { type: 'number' },
        message: { type: 'string' }
      }
    },
    BatchResponse: {
      type: 'object',
      properties: {
        results: {
          type: 'array',
          items: { $ref: '#/components/schemas/BatchResult' }
        },
        errors: {
          type: 'array',
          items: { $ref: '#/components/schemas/BatchError' }
        }
      }
    },
    HealthResponse: {
      type: 'object',
      properties: {
        status: { type: 'string' },
        service: { type: 'string' },
        version: { type: 'string' }
      }
    },
    SearchRequest: {
      type: 'object',
      required: ['query'],
      properties: {
        query: { type: 'string' }
      }
    },
    GeoLocation: {
      type: 'object',
      properties: {
        lat: { type: 'number' },
        lng: { type: 'number' },
        label: { type: 'string' }
      }
    },
    ElevationProfileRequest: {
      type: 'object',
      required: ['start', 'end'],
      properties: {
        start: { $ref: '#/components/schemas/GeoLocation' },
        end: { $ref: '#/components/schemas/GeoLocation' },
        steps: { type: 'number', example: 25 }
      }
    },
    ElevationProfilePoint: {
      type: 'object',
      properties: {
        dist: { type: 'number' },
        elev: { type: 'number' }
      }
    },
    ElevationProfileResponse: {
      type: 'object',
      properties: {
        profile: {
          type: 'array',
          items: { $ref: '#/components/schemas/ElevationProfilePoint' }
        }
      }
    },
    AnalyzeRequest: {
      type: 'object',
      required: ['stats', 'locationName'],
      properties: {
        stats: { type: 'object', additionalProperties: true },
        locationName: { type: 'string' }
      }
    },
    AnalyzeResponse: {
      type: 'object',
      properties: {
        analysis: { type: 'string' }
      }
    }
  }
};
