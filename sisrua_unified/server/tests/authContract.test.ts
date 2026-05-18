import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import authRoutes from '../routes/authRoutes.js';
import { errorHandler } from '../errorHandler.js';

// Mock dos serviços
vi.mock('../services/roleService.js', () => ({
  getUserRole: vi.fn().mockResolvedValue({ role: 'viewer', tenantId: 'tenant-123' })
}));

vi.mock('../services/authOnboardingService.js', () => ({
  provisionAuthenticatedUserAccess: vi.fn()
}));

vi.mock('../config.js', () => ({
  config: {
    SUPABASE_ALLOWED_EMAIL_DOMAIN: 'im3brasil.com.br',
    SUPABASE_SUPERADMIN_EMAIL: 'admin@im3brasil.com.br'
  }
}));

const app = express();
app.use(express.json());

// Mock middleware de autenticação (simula o que o Supabase middleware faria)
app.use((req: any, res, next) => {
  if (req.headers.authorization === 'Bearer valid-token') {
    res.locals.authenticatedUser = { userId: 'user-123', email: 'teste@im3brasil.com.br' };
  }
  next();
});

app.use('/api/auth', authRoutes);
app.use(errorHandler);

describe('Auth API Contract Tests', () => {
  describe('GET /api/auth/me', () => {
    it('deve retornar authenticated: false se não houver token', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.body.authenticated).toBe(false);
    });

    it('deve retornar dados do usuário se autenticado', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer valid-token');
      
      expect(res.body.authenticated).toBe(true);
      expect(res.body.user.email).toBe('teste@im3brasil.com.br');
      expect(res.body.signupPolicy.allowedDomain).toBe('im3brasil.com.br');
    });
  });

  describe('POST /api/auth/onboarding', () => {
    it('deve retornar 401 se não autenticado', async () => {
      const res = await request(app).post('/api/auth/onboarding');
      expect(res.status).toBe(401);
      expect(res.body.erro).toMatch(/Não autenticado/i);
    });

    it('deve retornar 403 se o domínio não for permitido', async () => {
      const { provisionAuthenticatedUserAccess } = await import('../services/authOnboardingService.js');
      (provisionAuthenticatedUserAccess as any).mockResolvedValue({ 
        status: 'domain-not-allowed',
        reason: 'Somente emails @im3brasil.com.br têm autoatendimento liberado.'
      });

      const res = await request(app)
        .post('/api/auth/onboarding')
        .set('Authorization', 'Bearer valid-token');
      
      expect(res.status).toBe(403);
      expect(res.body.status).toBe('domain-not-allowed');
    });
  });
});
