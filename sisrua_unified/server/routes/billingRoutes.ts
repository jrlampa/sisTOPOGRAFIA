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

<<<<<<< HEAD
import { Router, Request, Response, NextFunction } from 'express';
=======
import { Router, Request, Response } from 'express';
>>>>>>> 7065075 (chore: stabilize audit gates, remediate security deps, update RAG/MEMORY + CAC)
import { z } from 'zod';
import { stripeService } from '../services/stripeService.js';
import { requirePermission } from '../middleware/permissionHandler.js';
import { logger } from '../utils/logger.js';
import { config } from '../config.js';
import { getDbClient } from '../repositories/dbClient.js';
<<<<<<< HEAD
import { createError, asyncHandler } from '../errorHandler.js';
=======
>>>>>>> 7065075 (chore: stabilize audit gates, remediate security deps, update RAG/MEMORY + CAC)

const router = Router();

// ─── Helper: Extract user ID from request ────────────────────────────────────

function getUserIdFromRequest(req: Request): string | null {
  return (req as any).user?.id || (req.headers['x-user-id'] as string);
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const CheckoutRequestSchema = z.object({
  tier: z.enum(['professional', 'enterprise']),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

// ─── GET /api/billing/pricing ─────────────────────────────────────────────────

/**
 * Retorna lista de planos disponíveis (sem autenticação necessária)
 */
<<<<<<< HEAD
router.get('/pricing', asyncHandler(async (req: Request, res: Response) => {
=======
router.get('/pricing', async (req: Request, res: Response) => {
>>>>>>> 7065075 (chore: stabilize audit gates, remediate security deps, update RAG/MEMORY + CAC)
  try {
    const catalog = await stripeService.getProductCatalog();
    return res.json({
      tiers: catalog,
      currency: 'BRL',
    });
  } catch (error) {
    logger.error('Erro ao buscar catálogo de preços', error);
<<<<<<< HEAD
    throw createError.internal('Erro ao buscar preços');
  }
}));
=======
    return res.status(500).json({ erro: 'Erro ao buscar preços' });
  }
});
>>>>>>> 7065075 (chore: stabilize audit gates, remediate security deps, update RAG/MEMORY + CAC)

// ─── GET /api/billing/me ──────────────────────────────────────────────────────

/**
 * Retorna informações de subscription do usuário autenticado
 */
<<<<<<< HEAD
router.get('/me', requirePermission('read'), asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserIdFromRequest(req);
  if (!userId) {
    throw createError.authentication('Não autenticado');
  }

  const tierDef = await stripeService.getUserTierDefinition(userId);
  const dbClient = getDbClient(true);
  if (!dbClient) {
    throw createError.externalService('Banco de dados');
  }

  const result = await dbClient.unsafe(
    `SELECT tier, stripe_subscription_id, status, created_at, updated_at 
     FROM user_tiers WHERE user_id = $1`,
    [userId]
  );

  const row = result[0] as
    | {
        tier?: string;
        stripe_subscription_id?: string;
        status?: string;
        created_at?: string;
        updated_at?: string;
      }
    | undefined;

  return res.json({
    userId,
    tier: row?.tier || 'community',
    tierName: tierDef.name,
    status: row?.status || 'active',
    subscriptionId: row?.stripe_subscription_id || null,
    features: tierDef.features,
    createdAt: row?.created_at,
    updatedAt: row?.updated_at,
  });
}));
=======
router.get('/me', requirePermission('read'), async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ erro: 'Não autenticado' });
    }

    const tierDef = await stripeService.getUserTierDefinition(userId);
    const dbClient = getDbClient(true);
    if (!dbClient) {
      return res.status(503).json({ erro: 'Banco de dados indisponível' });
    }

    const result = await dbClient.unsafe(
      `SELECT tier, stripe_subscription_id, status, created_at, updated_at 
       FROM user_tiers WHERE user_id = $1`,
      [userId]
    );

    const row = result[0] as
      | {
          tier?: string;
          stripe_subscription_id?: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        }
      | undefined;

    return res.json({
      userId,
      tier: row?.tier || 'community',
      tierName: tierDef.name,
      status: row?.status || 'active',
      subscriptionId: row?.stripe_subscription_id || null,
      features: tierDef.features,
      createdAt: row?.created_at,
      updatedAt: row?.updated_at,
    });
  } catch (error) {
    logger.error('Erro ao buscar informações de tier do usuário', error);
    return res.status(500).json({ erro: 'Erro ao buscar dados' });
  }
});
>>>>>>> 7065075 (chore: stabilize audit gates, remediate security deps, update RAG/MEMORY + CAC)

// ─── POST /api/billing/checkout ────────────────────────────────────────────────

/**
 * Cria uma sessão de checkout Stripe para upgrade
 */
<<<<<<< HEAD
router.post('/checkout', requirePermission('read'), asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserIdFromRequest(req);
  if (!userId) {
    throw createError.authentication('Não autenticado');
  }

  const body = CheckoutRequestSchema.safeParse(req.body);
  if (!body.success) {
    throw createError.validation('Dados inválidos', { detalhes: body.error.issues });
  }

  // Obter email do usuário (simplificado — em produção, buscar de auth.users)
  const userEmail = (req as any).user?.email || `user-${userId}@sisrua.local`;

  // URLs padrão (podem ser sobrescritas)
  const baseUrl = config.FRONTEND_URL || 'http://localhost:5173';
  const successUrl = body.data.successUrl || `${baseUrl}/billing/success`;
  const cancelUrl = body.data.cancelUrl || `${baseUrl}/billing/cancel`;

  const session = await stripeService.createCheckoutSession(
    body.data.tier,
    userEmail,
    userId,
    successUrl,
    cancelUrl
  );

  logger.info('Checkout session criado', {
    sessionId: session.id,
    userId,
    tier: body.data.tier,
  });

  return res.json({
    checkoutUrl: session.url,
    sessionId: session.id,
  });
}));
=======
router.post('/checkout', requirePermission('read'), async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ erro: 'Não autenticado' });
    }

    const body = CheckoutRequestSchema.safeParse(req.body);
    if (!body.success) {
      return res.status(400).json({ erro: 'Dados inválidos', detalhes: body.error.issues });
    }

    // Obter email do usuário (simplificado — em produção, buscar de auth.users)
    const userEmail = (req as any).user?.email || `user-${userId}@sisrua.local`;

    // URLs padrão (podem ser sobrescritas)
    const baseUrl = config.FRONTEND_URL || 'http://localhost:5173';
    const successUrl = body.data.successUrl || `${baseUrl}/billing/success`;
    const cancelUrl = body.data.cancelUrl || `${baseUrl}/billing/cancel`;

    const session = await stripeService.createCheckoutSession(
      body.data.tier,
      userEmail,
      userId,
      successUrl,
      cancelUrl
    );

    logger.info('Checkout session criado', {
      sessionId: session.id,
      userId,
      tier: body.data.tier,
    });

    return res.json({
      checkoutUrl: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    logger.error('Erro ao criar checkout', error);
    return res.status(500).json({ erro: 'Erro ao criar sessão de pagamento' });
  }
});
>>>>>>> 7065075 (chore: stabilize audit gates, remediate security deps, update RAG/MEMORY + CAC)

// ─── GET /api/billing/portal ──────────────────────────────────────────────────

/**
 * Redireciona para o Stripe Billing Portal (gerenciar assinatura)
 * Requer Stripe Customer ID
 */
<<<<<<< HEAD
router.get('/portal', requirePermission('read'), asyncHandler(async (req: Request, res: Response) => {
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
    `SELECT stripe_customer_id FROM user_tiers WHERE user_id = $1`,
    [userId]
  );

  const customerId = (result[0] as { stripe_customer_id?: string } | undefined)
    ?.stripe_customer_id;
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
}));
=======
router.get('/portal', requirePermission('read'), async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ erro: 'Não autenticado' });
    }

    if (!config.STRIPE_SECRET_KEY) {
      return res.status(503).json({ erro: 'Pagamentos não configurados' });
    }

    const dbClient = getDbClient(true);
    if (!dbClient) {
      return res.status(503).json({ erro: 'Banco de dados indisponível' });
    }
    const result = await dbClient.unsafe(
      `SELECT stripe_customer_id FROM user_tiers WHERE user_id = $1`,
      [userId]
    );

    const customerId = (result[0] as { stripe_customer_id?: string } | undefined)
      ?.stripe_customer_id;
    if (!customerId) {
      return res.status(404).json({
        erro: 'Nenhuma assinatura encontrada',
        message: 'Crie uma assinatura primeiro',
      });
    }

    const portalSession = await stripeService.createPortalSession(
      customerId,
      `${config.FRONTEND_URL || 'http://localhost:5173'}/account/billing`
    );

    return res.json({
      portalUrl: portalSession.url,
    });
  } catch (error) {
    logger.error('Erro ao criar billing portal', error);
    return res.status(500).json({ erro: 'Erro ao acessar portal de faturamento' });
  }
});
>>>>>>> 7065075 (chore: stabilize audit gates, remediate security deps, update RAG/MEMORY + CAC)

// ─── POST /api/billing/webhook ────────────────────────────────────────────────

/**
 * Webhook para eventos Stripe
 * Sincroniza mudanças de subscription com DB
 *
 * Stripe enviará POST com X-Stripe-Signature para validação
 */
<<<<<<< HEAD
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
    const payload = (req as any).rawBody;
    
    if (!payload) {
      logger.error('Webhook Stripe falhou: rawBody não capturado pelo middleware express.json');
      return next(createError.internal('Erro interno de configuração de body'));
    }
    
    const event = stripeService.constructEvent(payload, sig as string, endpointSecret);

    logger.info('Webhook Stripe verificado e recebido', {
=======
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    if (!config.STRIPE_WEBHOOK_SECRET) {
      logger.warn('Webhook Stripe recebido mas STRIPE_WEBHOOK_SECRET não configurada');
      return res.status(400).json({ erro: 'Webhook não configurado' });
    }

    // Em produção, usar verifyStripeSignature aqui
    // Por enquanto, assumindo que o corpo é válido
    const event = req.body;

    logger.info('Webhook Stripe recebido', {
>>>>>>> 7065075 (chore: stabilize audit gates, remediate security deps, update RAG/MEMORY + CAC)
      type: event.type,
      id: event.id,
    });

<<<<<<< HEAD
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
=======
    // Processar eventos relevantes
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
>>>>>>> 7065075 (chore: stabilize audit gates, remediate security deps, update RAG/MEMORY + CAC)

    // Responder com 200 OK (Stripe requer isto)
    return res.json({ received: true });
  } catch (error) {
<<<<<<< HEAD
    logger.error('Erro ao processar webhook Stripe (assinatura inválida ou erro interno)', error);
    return next(createError.validation('Falha na validação do webhook'));
=======
    logger.error('Erro ao processar webhook Stripe', error);
    return res.status(500).json({ erro: 'Erro ao processar webhook' });
>>>>>>> 7065075 (chore: stabilize audit gates, remediate security deps, update RAG/MEMORY + CAC)
  }
});

// ─── Bootstrap endpoint (admin only) ───────────────────────────────────────────

/**
 * Cria os 3 produtos sisRUA na Stripe (executar uma única vez)
 * Requer bearer token de admin
 */
<<<<<<< HEAD
router.post('/admin/bootstrap', asyncHandler(async (req: Request, res: Response) => {
  // Validar admin token (Fix Item 4: Separar ADMIN de METRICS)
  const adminToken = config.ADMIN_TOKEN;
  const authHeader = req.headers.authorization?.replace('Bearer ', '');

  if (!adminToken || authHeader !== adminToken) {
    logger.warn('[BillingRoutes] Tentativa de bootstrap com token inválido ou METRICS_TOKEN', {
      hasAdminToken: !!adminToken,
      isSecurity: true
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
}));
=======
router.post('/admin/bootstrap', async (req: Request, res: Response) => {
  try {
    // Validar admin token
    const adminToken = config.ADMIN_TOKEN || config.METRICS_TOKEN;
    const authHeader = req.headers.authorization?.replace('Bearer ', '');

    if (!adminToken || authHeader !== adminToken) {
      return res.status(401).json({ erro: 'Token de admin inválido' });
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
  } catch (error) {
    logger.error('Erro ao fazer bootstrap de produtos Stripe', error);
    return res.status(500).json({ erro: 'Erro ao criar produtos' });
  }
});
>>>>>>> 7065075 (chore: stabilize audit gates, remediate security deps, update RAG/MEMORY + CAC)

export const billingRoutes = router;
