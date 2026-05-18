import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { billingRoutes } from '../routes/billingRoutes.js';

// Mock do middleware e serviços
vi.mock('../../middleware/permissionHandler.js', () => ({
  requirePermission: () => (req: any, res: any, next: any) => {
    // Simula usuário autenticado se houver header x-user-id
    if (req.headers['x-user-id']) {
      req.user = { id: req.headers['x-user-id'] };
      return next();
    }
    // Retorna payload compatível com createError.authentication('Não autenticado')
    return res.status(401).json({ 
      error: 'Não autenticado', 
      erro: 'Não autenticado',
      code: 'UNAUTHORIZED',
      category: 'AuthenticationError'
    });
  }
}));

import { stripeService } from '../services/stripeService.js';
vi.mock('../services/stripeService.js', () => ({
  stripeService: {
    constructEvent: vi.fn(),
    syncSubscriptionToDB: vi.fn(),
    createCheckoutSession: vi.fn(),
    getProductCatalog: vi.fn().mockResolvedValue([]),
    getUserTierDefinition: vi.fn().mockResolvedValue({ name: 'Community', features: {} }),
  }
}));

vi.mock('../config.js', () => ({
  config: {
    STRIPE_WEBHOOK_SECRET: 'whsec_test',
    FRONTEND_URL: 'http://localhost:5173',
    STRIPE_SECRET_KEY: 'sk_test',
  }
}));

const app = express();
app.use(express.json());
// Middleware para rawBody (necessário para o webhook)
app.use((req: any, _res, next) => {
  req.rawBody = JSON.stringify(req.body);
  next();
});
app.use('/api/billing', billingRoutes);
// Error handler centralizado (importante para testar o contrato real)
import { errorHandler } from '../errorHandler.js';
app.use(errorHandler);

describe('Billing API Contract Tests', () => {
  describe('POST /api/billing/webhook', () => {
    it('deve retornar 400 se a assinatura estiver ausente', async () => {
      const res = await request(app).post('/api/billing/webhook').send({});
      expect(res.status).toBe(400);
      expect(res.body.erro).toBe('Assinatura ausente');
    });

    it('deve retornar 400 se a assinatura for inválida', async () => {
      (stripeService.constructEvent as any).mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      const res = await request(app)
        .post('/api/billing/webhook')
        .set('stripe-signature', 'invalid')
        .send({});
      
      expect(res.status).toBe(400);
      expect(res.body.erro).toBe('Falha na validação do webhook');
    });
  });

  describe('POST /api/billing/checkout', () => {
    it('deve retornar 401 se o usuário não estiver autenticado', async () => {
      const res = await request(app).post('/api/billing/checkout').send({ tier: 'professional' });
      expect(res.status).toBe(401);
      expect(res.body.erro).toBe('Authentication required');
    });
  });
});
