/**
 * billingRoutes.ts — Gerenciamento de assinaturas Stripe
 *
 * Endpoints:
 * - GET  /api/billing/pricing         — Lista de planos disponíveis
 * - GET  /api/billing/me               — Informações de subscription do usuário
 * - POST /api/billing/checkout         — Criar sessão de checkout
 * - GET  /api/billing/portal           — Link para customer portal (Stripe)
 * - POST /api/billing/webhook          — Webhook de eventos Stripe
 *
 * Todos os endpoints (exceto webhook) requerem autenticação JWT
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { stripeService } from '../services/stripeService.js';
import { requirePermission } from '../middleware/permissionHandler.js';
import { logger } from '../utils/logger.js';
import { config } from '../config.js';
import { getDbClient } from '../repositories/dbClient.js';
import { createError, asyncHandler } from '../errorHandler.js';

const router = Router();

const CheckoutRequestSchema = z.object({
  tier: z.enum(['professional', 'enterprise']),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

type BillingRequest = Request & {
  user?: {
    id?: string;
    sub?: string;
    email?: string;
  };
  rawBody?: string | Buffer;
};

function getUserIdFromRequest(req: Request): string | null {
  const user = (req as BillingRequest).user;
  const headerValue = req.headers['x-user-id'];
  const userIdCandidate =
    user?.id ?? user?.sub ?? (typeof headerValue === 'string' ? headerValue : null);

  if (typeof userIdCandidate !== 'string') {
    return null;
  }

  const normalizedUserId = userIdCandidate.trim();
  return normalizedUserId.length > 0 ? normalizedUserId : null;
}

function getTenantIdFromRequest(req: Request, res: Response): string | null {
  const localTenantId = typeof res.locals.tenantId === 'string' ? res.locals.tenantId.trim() : '';
  if (localTenantId.length > 0) {
    return localTenantId;
  }

  const rawHeader = req.headers['x-tenant-id'] ?? req.headers['x-projeto-id'];
  const headerValue = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
  if (typeof headerValue !== 'string') {
    return null;
  }

  const normalizedTenantId = headerValue.trim();
  return normalizedTenantId.length > 0 ? normalizedTenantId : null;
}

function getUserEmailFromRequest(req: Request): string {
  const user = (req as BillingRequest).user;
  const userEmail = typeof user?.email === 'string' ? user.email.trim() : '';
  return userEmail.length > 0 ? userEmail : '';
}

function getIdempotencyKeyFromRequest(req: Request): string | undefined {
  const headerKey = req.headers['idempotency-key'] ?? req.headers['x-idempotency-key'];
  const raw = Array.isArray(headerKey) ? headerKey[0] : headerKey;
  if (typeof raw !== 'string') {
    return undefined;
  }

  const normalized = raw.trim();
  if (normalized.length < 8 || normalized.length > 128) {
    return undefined;
  }

  // Keep a conservative character set to avoid accidental log/control characters.
  return /^[A-Za-z0-9:_-]+$/.test(normalized) ? normalized : undefined;
}

// ─── GET /api/billing/pricing ────────────────────────────────────────────────

/**
 * Lista planos disponíveis no catálogo Stripe configurado
 */
router.get(
  '/pricing',
  requirePermission('read'),
  asyncHandler(async (_req: Request, res: Response) => {
    try {
      const catalog = await stripeService.getProductCatalog();
      return res.json({
        tiers: catalog,
        currency: 'BRL',
      });
    } catch (error) {
      logger.error('Erro ao buscar catálogo de preços', error);
      throw createError.internal('Erro ao buscar preços');
    }
  })
);

// ─── GET /api/billing/me ──────────────────────────────────────────────────────

/**
 * Retorna informações de subscription do usuário autenticado
 */
router.get(
  '/me',
  requirePermission('read'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      throw createError.authentication('Não autenticado');
    }

    const dbClient = getDbClient(true);
    if (!dbClient) {
      throw createError.externalService('Banco de dados');
    }

    const subscriptionResult = await dbClient.unsafe(
      `SELECT ss.stripe_subscription_id, ss.status, ss.created_at, ss.updated_at, ss.stripe_price_id
         FROM stripe_subscriptions ss
         INNER JOIN stripe_customers sc ON sc.stripe_customer_id = ss.stripe_customer_id
        WHERE sc.user_id = $1
        ORDER BY ss.updated_at DESC
        LIMIT 1`,
      [userId]
    );

    const subscriptionRow = subscriptionResult[0] as
      | {
          stripe_subscription_id?: string;
          status?: string;
          stripe_price_id?: string;
          created_at?: string;
          updated_at?: string;
        }
      | undefined;

    const fallbackResult = await dbClient.unsafe(
      `SELECT tier, stripe_subscription_id, status, created_at, updated_at
         FROM user_tiers
        WHERE user_id = $1`,
      [userId]
    );

    const fallbackRow = fallbackResult[0] as
      | {
          tier?: string;
          stripe_subscription_id?: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        }
      | undefined;

    const tierDef = await stripeService.getUserTierDefinition(userId);

    return res.json({
      userId,
      tier: tierDef.id,
      tierName: tierDef.name,
      status: subscriptionRow?.status || fallbackRow?.status || 'active',
      subscriptionId:
        subscriptionRow?.stripe_subscription_id || fallbackRow?.stripe_subscription_id || null,
      features: tierDef.features,
      createdAt: subscriptionRow?.created_at || fallbackRow?.created_at,
      updatedAt: subscriptionRow?.updated_at || fallbackRow?.updated_at,
    });
  })
);

// ─── POST /api/billing/checkout ────────────────────────────────────────────────

/**
 * Cria uma sessão de checkout Stripe para upgrade
 */
router.post(
  '/checkout',
  requirePermission('read'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      throw createError.authentication('Não autenticado');
    }

    const body = CheckoutRequestSchema.safeParse(req.body);
    if (!body.success) {
      throw createError.validation('Dados inválidos', { detalhes: body.error.issues });
    }

    // Obter email do usuário autenticado
    const resolvedEmail = getUserEmailFromRequest(req);
    const userEmail = resolvedEmail || `user-${userId}@sisrua.local`;
    const tenantId = getTenantIdFromRequest(req, res);

    // URLs padrão (podem ser sobrescritas)
    const baseUrl = config.FRONTEND_URL || 'http://localhost:5173';
    const successUrl = body.data.successUrl || `${baseUrl}/billing/success`;
    const cancelUrl = body.data.cancelUrl || `${baseUrl}/billing/cancel`;
    const idempotencyKey = getIdempotencyKeyFromRequest(req);

    const session = await stripeService.createCheckoutSession(
      body.data.tier,
      userEmail,
      userId,
      tenantId,
      successUrl,
      cancelUrl,
      idempotencyKey
    );

    logger.info('Checkout session criado', {
      sessionId: session.id,
      userId,
      tier: body.data.tier,
      idempotencyKey: idempotencyKey ?? null,
    });

    return res.json({
      checkoutUrl: session.url,
      sessionId: session.id,
    });
  })
);

// ─── GET /api/billing/portal ──────────────────────────────────────────────────

/**
 * Redireciona para o Stripe Billing Portal (gerenciar assinatura)
 * Requer Stripe Customer ID
 */
router.get(
  '/portal',
  requirePermission('read'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      throw createError.authentication('Não autenticado');
    }

    if (!config.STRIPE_SECRET_KEY) {
      throw createError.externalService('Stripe');
    }

    const dbClient = getDbClient(true);
    if (!dbClient) {
      throw createError.externalService('Banco de dados');
    }

    const result = await dbClient.unsafe(
      `SELECT stripe_customer_id
         FROM stripe_customers
        WHERE user_id = $1
        LIMIT 1`,
      [userId]
    );

    let customerId = (result[0] as { stripe_customer_id?: string } | undefined)?.stripe_customer_id;

    if (!customerId) {
      const legacyResult = await dbClient.unsafe(
        `SELECT stripe_customer_id
           FROM user_tiers
          WHERE user_id = $1
          LIMIT 1`,
        [userId]
      );
      customerId = (legacyResult[0] as { stripe_customer_id?: string } | undefined)
        ?.stripe_customer_id;
    }

    if (!customerId) {
      throw createError.notFound('Assinatura', { message: 'Crie uma assinatura primeiro' });
    }

    const portalSession = await stripeService.createPortalSession(
      customerId,
      `${config.FRONTEND_URL || 'http://localhost:5173'}/account/billing`
    );

    return res.json({
      portalUrl: portalSession.url,
    });
  })
);

// ─── POST /api/billing/webhook ────────────────────────────────────────────────

/**
 * Webhook para eventos Stripe
 * Sincroniza mudanças de subscription com DB
 *
 * Stripe enviará POST com X-Stripe-Signature para validação
 */
router.post('/webhook', (req: Request, res: Response, next: NextFunction) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = config.STRIPE_WEBHOOK_SECRET;

  if (!endpointSecret) {
    logger.warn('Webhook Stripe recebido mas STRIPE_WEBHOOK_SECRET não configurada');
    return next(createError.validation('Webhook não configurado'));
  }

  if (!sig) {
    logger.warn('Webhook Stripe recebido sem assinatura (stripe-signature)');
    return next(createError.validation('Assinatura ausente'));
  }

  try {
    // Usar o rawBody capturado pelo middleware express.json configurado em app.ts
    const payload = (req as BillingRequest).rawBody;

    if (!payload) {
      logger.error('Webhook Stripe falhou: rawBody não capturado pelo middleware express.json');
      return next(createError.internal('Erro interno de configuração de body'));
    }

    const event = stripeService.constructEvent(payload, sig as string, endpointSecret);

    logger.info('Webhook Stripe verificado e recebido', {
      type: event.type,
      id: event.id,
    });

    // Processamento async (não bloqueia a resposta 200 ao Stripe)
    (async () => {
      try {
        switch (event.type) {
          case 'customer.subscription.created':
          case 'customer.subscription.updated':
          case 'customer.subscription.deleted':
            await stripeService.syncSubscriptionToDB(event);
            break;

          case 'invoice.payment_succeeded':
            logger.info('Pagamento de invoice bem-sucedido', { invoiceId: event.data.object.id });
            break;

          case 'invoice.payment_failed':
            logger.warn('Falha de pagamento de invoice', { invoiceId: event.data.object.id });
            break;

          default:
            logger.debug('Evento Stripe não tratado', { type: event.type });
        }
      } catch (err) {
        logger.error('Erro no processamento async do webhook Stripe', err);
      }
    })();

    // Responder com 200 OK (Stripe requer isto)
    return res.json({ received: true });
  } catch (error) {
    logger.error('Erro ao processar webhook Stripe (assinatura inválida ou erro interno)', error);
    return next(createError.validation('Falha na validação do webhook'));
  }
});

// ─── Bootstrap endpoint (admin only) ───────────────────────────────────────────

/**
 * Cria os 3 produtos sisRUA na Stripe (executar uma única vez)
 * Requer bearer token de admin
 */
router.post(
  '/admin/bootstrap',
  asyncHandler(async (req: Request, res: Response) => {
    // Validar admin token (Fix Item 4: Separar ADMIN de METRICS)
    const adminToken = config.ADMIN_TOKEN;
    const authHeader = req.headers.authorization?.replace('Bearer ', '');

    if (!adminToken || authHeader !== adminToken) {
      logger.warn('[BillingRoutes] Tentativa de bootstrap com token inválido ou METRICS_TOKEN', {
        hasAdminToken: !!adminToken,
        isSecurity: true,
      });
      throw createError.authentication('Token de admin obrigatório para esta operação');
    }

    const results = await stripeService.bootstrapSisRuaProducts();

    logger.info('Bootstrap de produtos Stripe completado com sucesso', results);

    return res.json({
      message: 'Produtos criados/sincronizados com sucesso na Stripe',
      products: results,
      nextSteps: [
        '1. Copiar os productIds e priceIds para as variáveis de ambiente',
        '2. Atualizar TIER_DEFINITIONS no stripeService com os IDs reais',
        '3. Fazer deploy das mudanças',
      ],
    });
  })
);

export const billingRoutes = router;
