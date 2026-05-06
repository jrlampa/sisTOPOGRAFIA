export const swaggerPaths = {
  '/': {
    get: {
      summary: 'Health check',
      responses: {
        '200': {
          description: 'Service status',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/HealthResponse' }
            }
          }
        }
      }
    }
  },
  '/api/dxf': {
    post: {
      summary: 'Queue DXF generation',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/DxfRequest' }
          }
        }
      },
      responses: {
        '200': {
          description: 'DXF served from cache',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DxfCachedResponse' }
            }
          }
        },
        '202': {
          description: 'DXF job queued',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DxfQueuedResponse' }
            }
          }
        },
        '400': {
          description: 'Invalid request',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' }
            }
          }
        },
        '500': {
          description: 'Generation failed',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' }
            }
          }
        }
      }
    }
  },
  '/api/jobs/{id}': {
    get: {
      summary: 'Get DXF job status',
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string' }
        }
      ],
      responses: {
        '200': {
          description: 'Job status',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/JobStatusResponse' }
            }
          }
        },
        '404': {
          description: 'Job not found',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' }
            }
          }
        }
      }
    }
  },
  '/api/dxf/batch': {
    post: {
      summary: 'Batch DXF generation via CSV',
      requestBody: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              properties: {
                csv: { type: 'string', format: 'binary' }
              },
              required: ['csv']
            }
          }
        }
      },
      responses: {
        '200': {
          description: 'Batch queued',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/BatchResponse' }
            }
          }
        },
        '400': {
          description: 'Invalid CSV',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' }
            }
          }
        }
      }
    }
  },
  '/api/search': {
    post: {
      summary: 'Resolve location from query',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/SearchRequest' }
          }
        }
      },
      responses: {
        '200': {
          description: 'Resolved location',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/GeoLocation' }
            }
          }
        },
        '400': {
          description: 'Query required',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' }
            }
          }
        },
        '404': {
          description: 'Location not found',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' }
            }
          }
        }
      }
    }
  },
  '/api/elevation/profile': {
    post: {
      summary: 'Get elevation profile between two points',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ElevationProfileRequest' }
          }
        }
      },
      responses: {
        '200': {
          description: 'Elevation profile',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ElevationProfileResponse' }
            }
          }
        },
        '400': {
          description: 'Invalid coordinates',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' }
            }
          }
        }
      }
    }
  },
  '/api/analyze': {
    post: {
      summary: 'Analyze area using AI',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/AnalyzeRequest' }
          }
        }
      },
      responses: {
        '200': {
          description: 'Analysis result',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AnalyzeResponse' }
            }
          }
        },
        '500': {
          description: 'Analysis failed',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' }
            }
          }
        }
      }
    }
  }
};
