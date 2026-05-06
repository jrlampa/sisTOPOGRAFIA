import { vi } from "vitest";
import request from 'supertest';
import express from 'express';
import { dgBufferValidationRoutes } from '../routes/dgBufferValidationRoutes.js';
import * as bufferService from '../services/dgBufferValidationService.js';
import { errorHandler } from '../errorHandler.js';

// Mock permissions and validator to skip complex setups
vi.mock('../middleware/permissionHandler.js', () => ({
  permissionHandler: () => (req: any, res: any, next: any) => {
    res.locals.userId = 'test-user';
    res.locals.tenantId = 'test-tenant';
    next();
  },
}));

vi.mock("../middleware/schemaValidator.js", async () => {
  const { z } = await import("zod");
  return {
    schemaValidator: (schema: z.ZodTypeAny) => (req: any, res: any, next: any) => {
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Parâmetros inválidos",
          details: parsed.error.issues,
        });
      }
      req.body = parsed.data;
      next();
    },
  };
});

// Mock the service
vi.mock('../services/dgBufferValidationService.js');

describe('dgBufferValidationRoutes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/dg', dgBufferValidationRoutes);
    app.use(errorHandler);
    vi.clearAllMocks();
  });

  describe('GET /api/dg/buffer-config', () => {
    it('deve retornar as configurações de buffer recomendadas', async () => {
      const res = await request(app).get('/api/dg/buffer-config');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('primary_curb');
    });
  });

  describe('POST /api/dg/validate-buffer-zone', () => {
    it('deve validar um ponto individual com sucesso', async () => {
      const mockResult = {
        isValid: true,
        metersToNearestStreet: 0.4,
        isInsideBuilding: false,
      };
      (bufferService.validateBufferZone as vi.Mock).mockResolvedValue(mockResult);

      const payload = {
        candidatePoint: { latitude: -22.9, longitude: -43.2 },
        streetPolylines: [
          {
            type: 'LineString',
            coordinates: [[-43.2, -22.9], [-43.21, -22.91]],
            highwayClass: 'residential'
          }
        ],
      };

      const res = await request(app).post('/api/dg/validate-buffer-zone').send(payload);
      
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual(mockResult);
    });

    it('deve retornar erro 400 se o payload for inválido (via schemaValidator)', async () => {
      // Payload sem candidatePoint
      const res = await request(app).post('/api/dg/validate-buffer-zone').send({});
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/dg/validate-batch', () => {
    it('deve validar múltiplos pontos em lote', async () => {
      const mockResult = {
        results: [],
        acceptanceRate: 0.8,
      };
      (bufferService.validateMultiplePoints as vi.Mock).mockResolvedValue(mockResult);

      const payload = {
        candidatePoints: [{ latitude: -22.9, longitude: -43.2 }],
        streetPolylines: [
          {
            type: 'LineString',
            coordinates: [[-43.2, -22.9], [-43.21, -22.91]],
            highwayClass: 'residential'
          }
        ],
      };

      const res = await request(app).post('/api/dg/validate-batch').send(payload);

      expect(res.status).toBe(200);
      expect(res.body.data.acceptanceRate).toBe(0.8);
    });
  });

  describe('POST /api/dg/validate-with-constraints', () => {
    it('deve retornar 501 Not Implemented (placeholder atual)', async () => {
      const res = await request(app).post('/api/dg/validate-with-constraints');
      expect(res.status).toBe(501);
      expect(res.body.error).toBe('Not Implemented');
    });
  });
});

