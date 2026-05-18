import Stripe from 'stripe';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { getDbClient, type SqlClient } from '../repositories/dbClient.js';

/**
 * StripeService — Gestão de pagamentos, assinaturas e tiers de usuários.
 *
 * Responsabilidades:
 * 1. Criar produtos e preços na Stripe (tiers: Community, Professional, Enterprise)
 * 2. Gerenciar checkouts e assinaturas
 * 3. Sincronizar dados de tier entre Stripe e PostgreSQL
 * 4. Validar acesso a features baseado em tier
 */

export type SisRuaTier = 'community' | 'professional' | 'enterprise';

export interface TierDefinition {
  id: SisRuaTier;
  name: string;
  description: string;
  priceMonthlyBRL: number;
  stripeProductId?: string;
  stripePriceId?: string;
  features: {
    maxAreaKm2: number;
    maxDxfPerMonth: number;
    maxTerrainProcessingPerMonth: number;
    maxDgRunsPerMonth: number;
    maxProjectsStorage: number;
    projectRetentionDays: number;
    hasApiAccess: boolean;
    hasWebhooks: boolean;
    supportLevel: 'community' | 'email-24h' | 'email-chat-24-7';
    slaUptime: number;
  };
}

/**
 * Definição canônica dos tiers sisRUA
 * Mantém sincronização entre código e Stripe
 */
const TIER_DEFINITIONS: Record<SisRuaTier, TierDefinition> = {
  community: {
    id: 'community',
    name: 'Community (Gratuito)',
    description: 'Análise básica e visualização de dados geoespaciais',
    priceMonthlyBRL: 0,
    stripePriceId: process.env.STRIPE_PRICE_COMMUNITY,
    features: {
      maxAreaKm2: 2,
      maxDxfPerMonth: 0,
      maxTerrainProcessingPerMonth: 0,
      maxDgRunsPerMonth: 0,
      maxProjectsStorage: 5,
      projectRetentionDays: 30,
      hasApiAccess: false,
      hasWebhooks: false,
      supportLevel: 'community',
      slaUptime: 0.95,
    },
  },
  professional: {
    id: 'professional',
    name: 'Professional',
    description: 'Exportação DXF, análise completa de topologia, 50km²',
    priceMonthlyBRL: 120,
    stripePriceId: process.env.STRIPE_PRICE_PROFESSIONAL,
    features: {
      maxAreaKm2: 50,
      maxDxfPerMonth: 20,
      maxTerrainProcessingPerMonth: 5,
      maxDgRunsPerMonth: 5,
      maxProjectsStorage: -1, // Unlimited
      projectRetentionDays: 90,
      hasApiAccess: true,
      hasWebhooks: true,
      supportLevel: 'email-24h',
      slaUptime: 0.95,
    },
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Acesso ilimitado, multi-tenant, suporte dedicado',
    priceMonthlyBRL: 1500,
    stripePriceId: process.env.STRIPE_PRICE_ENTERPRISE,
    features: {
      maxAreaKm2: -1, // Unlimited
      maxDxfPerMonth: -1,
      maxTerrainProcessingPerMonth: -1,
      maxDgRunsPerMonth: -1,
      maxProjectsStorage: -1,
      projectRetentionDays: -1, // Indefinido
      hasApiAccess: true,
      hasWebhooks: true,
      supportLevel: 'email-chat-24-7',
      slaUptime: 0.995,
    },
  },
};

class StripeService {
  private stripe: Stripe | null = null;

  private resolveTierFromPriceId(priceId?: string | null): SisRuaTier {
    if (!priceId) {
      return 'community';
    }

    for (const [tierKey, tierDef] of Object.entries(TIER_DEFINITIONS)) {
      if (tierDef.stripePriceId === priceId) {
        return tierKey as SisRuaTier;
      }
    }

    return 'community';
  }

  private getStripe(): Stripe {
    if (!this.stripe) {
      throw new Error('Stripe não configurada (STRIPE_SECRET_KEY não definida)');
    }
    return this.stripe;
  }

  private getRequiredDbClient(): SqlClient {
    const dbClient = getDbClient(true);
    if (!dbClient) {
      throw new Error('PostgreSQL indisponível para operação de billing.');
    }
    return dbClient;
  }

  constructor() {
    if (config.STRIPE_SECRET_KEY) {
      this.stripe = new Stripe(config.STRIPE_SECRET_KEY);
      logger.info('StripeService initialized with API key');
    } else {
      logger.warn(
        'StripeService: STRIPE_SECRET_KEY não configurada. Funcionalidades de pagamento desabilitadas.'
      );
    }
  }

  /**
   * Valida a assinatura de um webhook recebido da Stripe
   */
  constructEvent(payload: string | Buffer, sig: string, secret: string): Stripe.Event {
    const stripe = this.getStripe();
    return stripe.webhooks.constructEvent(payload, sig, secret);
  }

  /**
   * ─────────────────────────────────────────────────────────────────────────
   * PARTE 1: Criação de Produtos Stripe (Bootstrapping)
   * ─────────────────────────────────────────────────────────────────────────
   */

  /**
   * Cria os 3 produtos sisRUA na Stripe (executar uma única vez)
   * Atualiza as definições locais com IDs reais da Stripe
   */
  async bootstrapSisRuaProducts(): Promise<
    Record<SisRuaTier, { productId: string; priceId?: string }>
  > {
    const stripe = this.getStripe();

    const results = {} as Record<SisRuaTier, { productId: string; priceId?: string }>;

    for (const [tierKey, tierDef] of Object.entries(TIER_DEFINITIONS)) {
      const tier = tierKey as SisRuaTier;

      try {
        logger.info(`Criando produto Stripe para tier: ${tier}`, { name: tierDef.name });

        // 1. Verificar se já existe (por metadados)
        const existingProducts = await stripe.products.search({
          query: `metadata['sisrua_tier']:'${tier}'`,
          limit: 100,
        });

        if (existingProducts.data.length > 0) {
          const existing = existingProducts.data[0];
          logger.info(`Produto ${tier} já existe na Stripe`, { productId: existing.id });
          results[tier] = { productId: existing.id };

          // Persistência em memória (Fix Item 2)
          TIER_DEFINITIONS[tier].stripeProductId = existing.id;

          // Se não for Community, buscar preço
          if (tier !== 'community') {
            const prices = await stripe.prices.list({ product: existing.id, limit: 1 });
            if (prices.data.length > 0) {
              results[tier].priceId = prices.data[0].id;
              TIER_DEFINITIONS[tier].stripePriceId = prices.data[0].id;
            }
          }
          continue;
        }

        // 2. Criar novo produto
        const product = await stripe.products.create({
          name: tierDef.name,
          description: tierDef.description,
          metadata: {
            sisrua_tier: tier,
            system: 'sisRUA',
            max_area_km2: String(tierDef.features.maxAreaKm2),
            max_dxf_per_month: String(tierDef.features.maxDxfPerMonth),
          },
          active: true,
        });

        results[tier] = { productId: product.id };
        logger.info(`Produto ${tier} criado na Stripe`, { productId: product.id });

        // 3. Criar preço (exceto Community que é gratuito)
        if (tier !== 'community') {
          const price = await stripe.prices.create({
            product: product.id,
            unit_amount: Math.round(tierDef.priceMonthlyBRL * 100), // Centavos
            currency: 'brl',
            recurring: {
              interval: 'month',
              usage_type: 'licensed',
            },
            metadata: {
              sisrua_tier: tier,
            },
          });

          results[tier].priceId = price.id;

          // Persistência em memória (Fix Item 2)
          TIER_DEFINITIONS[tier].stripeProductId = product.id;
          TIER_DEFINITIONS[tier].stripePriceId = price.id;

          logger.info(`Preço para ${tier} criado`, {
            priceId: price.id,
            amountBRL: tierDef.priceMonthlyBRL,
          });
        }
      } catch (error) {
        logger.error(`Erro ao criar produto ${tier} na Stripe`, error);
        throw error;
      }
    }

    logger.info('Bootstrap de produtos Stripe concluído', results);
    return results;
  }

  /**
   * ─────────────────────────────────────────────────────────────────────────
   * PARTE 2: Gerenciamento de Assinaturas & Checkouts
   * ─────────────────────────────────────────────────────────────────────────
   */

  /**
   * Cria um link de checkout para upgrade/downgrade de tier
   */
  async createCheckoutSession(
    tier: SisRuaTier,
    userEmail: string,
    userId: string,
    tenantId: string | null,
    successUrl: string,
    cancelUrl: string,
    idempotencyKey?: string
  ) {
    const stripe = this.getStripe();

    const tierDef = TIER_DEFINITIONS[tier];
    if (!tierDef.stripePriceId) {
      throw new Error(`stripePriceId não configurado para tier: ${tier}`);
    }

    try {
      const stripeCustomerId = await this.getOrCreateStripeCustomer(userId, tenantId, userEmail);

      const sessionPayload: Stripe.Checkout.SessionCreateParams = {
        payment_method_types: ['card'],
        mode: 'subscription',
        line_items: [
          {
            price: tierDef.stripePriceId,
            quantity: 1,
          },
        ],
        customer: stripeCustomerId,
        customer_email: userEmail,
        client_reference_id: userId, // Vincular ao user ID sisRUA
        metadata: {
          sisrua_user_id: userId,
          sisrua_tier_target: tier,
          sisrua_tenant_id: tenantId ?? '',
        },
        subscription_data: {
          metadata: {
            sisrua_user_id: userId,
            sisrua_tier_target: tier,
            sisrua_tenant_id: tenantId ?? '',
          },
        },
        success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl,
      };

      const session = await stripe.checkout.sessions.create(
        sessionPayload,
        idempotencyKey ? { idempotencyKey } : undefined
      );

      logger.info('Checkout session criado', { sessionId: session.id, userId, tier });
      return session;
    } catch (error) {
      logger.error('Erro ao criar checkout session', error);
      throw error;
    }
  }

  async getOrCreateStripeCustomer(
    userId: string,
    tenantId: string | null,
    email: string
  ): Promise<string> {
    const dbClient = this.getRequiredDbClient();
    const stripe = this.getStripe();

    const existingCustomer = await dbClient.unsafe(
      `SELECT stripe_customer_id
         FROM stripe_customers
        WHERE user_id = $1
        LIMIT 1`,
      [userId]
    );

    const mappedStripeCustomerId = (
      existingCustomer[0] as { stripe_customer_id?: string } | undefined
    )?.stripe_customer_id;

    if (mappedStripeCustomerId) {
      return mappedStripeCustomerId;
    }

    const legacyCustomer = await dbClient.unsafe(
      `SELECT stripe_customer_id
         FROM user_tiers
        WHERE user_id = $1
          AND stripe_customer_id IS NOT NULL
        LIMIT 1`,
      [userId]
    );

    const legacyStripeCustomerId = (
      legacyCustomer[0] as { stripe_customer_id?: string } | undefined
    )?.stripe_customer_id;

    if (legacyStripeCustomerId) {
      if (!tenantId) {
        return legacyStripeCustomerId;
      }

      await dbClient.unsafe(
        `INSERT INTO stripe_customers (user_id, tenant_id, stripe_customer_id, email)
         VALUES ($1, $2::uuid, $3, $4)
         ON CONFLICT (user_id)
         DO UPDATE SET
           stripe_customer_id = EXCLUDED.stripe_customer_id,
           email = EXCLUDED.email,
           updated_at = NOW()`,
        [userId, tenantId, legacyStripeCustomerId, email]
      );

      return legacyStripeCustomerId;
    }

    if (!tenantId) {
      throw new Error('Tenant obrigatório para criação de customer Stripe.');
    }

    const customer = await stripe.customers.create({
      email,
      metadata: {
        sisrua_user_id: userId,
        sisrua_tenant_id: tenantId,
      },
    });

    await dbClient.unsafe(
      `INSERT INTO stripe_customers (user_id, tenant_id, stripe_customer_id, email)
       VALUES ($1, $2::uuid, $3, $4)
       ON CONFLICT (user_id)
       DO UPDATE SET
         stripe_customer_id = EXCLUDED.stripe_customer_id,
         email = EXCLUDED.email,
         updated_at = NOW()`,
      [userId, tenantId, customer.id, email]
    );

    return customer.id;
  }

  async createPortalSession(customerId: string, returnUrl: string) {
    const stripe = this.getStripe();
    return stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
  }

  /**
   * ─────────────────────────────────────────────────────────────────────────
   * PARTE 3: Sincronização com Banco de Dados
   * ─────────────────────────────────────────────────────────────────────────
   */

  /**
   * Webhook handler: Sincroniza mudanças de subscription com DB
   * Chamado quando: subscription.created, subscription.updated, customer.subscription.deleted
   */
  async syncSubscriptionToDB(event: Stripe.Event): Promise<void> {
    const { type, data } = event;
    const subscription = data.object as Stripe.Subscription;
    const subscriptionCompat = subscription as unknown as {
      current_period_start?: number | null;
      current_period_end?: number | null;
    };
    const dbClient = this.getRequiredDbClient();

    const stripeCustomerId =
      typeof subscription.customer === 'string'
        ? subscription.customer
        : (subscription.customer?.id as string | undefined);

    if (!stripeCustomerId) {
      logger.warn('Webhook: subscription sem customer válido', {
        subscriptionId: subscription.id,
      });
      return;
    }

    const metadataUserId = subscription.metadata?.sisrua_user_id as string | undefined;

    let userId = metadataUserId ?? null;
    if (!userId) {
      const mapping = await dbClient.unsafe(
        `SELECT user_id
           FROM stripe_customers
          WHERE stripe_customer_id = $1
          LIMIT 1`,
        [stripeCustomerId]
      );
      userId = (mapping[0] as { user_id?: string } | undefined)?.user_id || null;
    }

    if (!userId) {
      logger.warn('Webhook: não foi possível resolver user_id da subscription', {
        eventType: type,
        subscriptionId: subscription.id,
        stripeCustomerId,
      });
      return;
    }

    try {
      const priceId = (subscription.items?.data?.[0]?.price?.id as string | undefined) ?? null;
      const newTier = this.resolveTierFromPriceId(priceId);

      // Registrar status da subscription
      const status = subscription.status as string; // active, past_due, unpaid, canceled, etc.
      const stripeSubscriptionsStatus = status === 'canceled' ? 'cancelled' : status;
      const userTiersStatus = status === 'canceled' ? 'canceled' : status;

      await dbClient.unsafe(
        `INSERT INTO stripe_subscriptions (
           stripe_customer_id,
           stripe_subscription_id,
           stripe_price_id,
           status,
           current_period_start,
           current_period_end,
           cancel_at,
           cancelled_at,
           metadata,
           updated_at
         )
         VALUES (
           $1,
           $2,
           COALESCE($3, ''),
           $4,
           to_timestamp($5),
           to_timestamp($6),
           to_timestamp($7),
           to_timestamp($8),
           $9::jsonb,
           NOW()
         )
         ON CONFLICT (stripe_subscription_id)
         DO UPDATE SET
           stripe_price_id = COALESCE(EXCLUDED.stripe_price_id, stripe_subscriptions.stripe_price_id),
           status = EXCLUDED.status,
           current_period_start = EXCLUDED.current_period_start,
           current_period_end = EXCLUDED.current_period_end,
           cancel_at = EXCLUDED.cancel_at,
           cancelled_at = EXCLUDED.cancelled_at,
           metadata = COALESCE(EXCLUDED.metadata, stripe_subscriptions.metadata),
           updated_at = NOW()`,
        [
          stripeCustomerId,
          subscription.id,
          priceId,
          stripeSubscriptionsStatus,
          subscriptionCompat.current_period_start ?? null,
          subscriptionCompat.current_period_end ?? null,
          subscription.cancel_at ?? null,
          subscription.canceled_at ?? null,
          JSON.stringify(subscription.metadata || {}),
        ]
      );

      if (status === 'active' || status === 'past_due') {
        // Usuário tem subscription ativa → atualizar tier
        await dbClient.unsafe(
          `INSERT INTO user_tiers (user_id, tier, stripe_subscription_id, stripe_customer_id, status)
           VALUES ($1::uuid, $2, $3, $4, $5)
           ON CONFLICT (user_id)
           DO UPDATE SET
             tier = EXCLUDED.tier,
             stripe_subscription_id = EXCLUDED.stripe_subscription_id,
             stripe_customer_id = EXCLUDED.stripe_customer_id,
             status = EXCLUDED.status,
             updated_at = NOW()`,
          [userId, newTier, subscription.id, stripeCustomerId, userTiersStatus]
        );

        logger.info('Tier sincronizado após webhook', { userId, tier: newTier, status });
      } else if (status === 'canceled' || status === 'cancelled') {
        // Subscription cancelada → revert para community
        await dbClient.unsafe(
          `INSERT INTO user_tiers (user_id, tier, stripe_subscription_id, stripe_customer_id, status)
           VALUES ($1::uuid, 'community', $2, $3, 'canceled')
           ON CONFLICT (user_id)
           DO UPDATE SET
             tier = 'community',
             stripe_subscription_id = EXCLUDED.stripe_subscription_id,
             stripe_customer_id = EXCLUDED.stripe_customer_id,
             status = 'canceled',
             updated_at = NOW()`,
          [userId, subscription.id, stripeCustomerId]
        );

        logger.info('Usuário revertido para community após cancelamento', { userId });
      }
    } catch (error) {
      logger.error('Erro ao sincronizar subscription com DB', { error, userId });
      throw error;
    }
  }

  /**
   * ─────────────────────────────────────────────────────────────────────────
   * PARTE 4: Consultas & Validações
   * ─────────────────────────────────────────────────────────────────────────
   */

  /**
   * Retorna a definição completa do tier de um usuário
   */
  async getUserTierDefinition(userId: string): Promise<TierDefinition> {
    const dbClient = this.getRequiredDbClient();

    try {
      const subscriptionResult = await dbClient.unsafe(
        `SELECT ss.stripe_price_id
           FROM stripe_subscriptions ss
           INNER JOIN stripe_customers sc ON sc.stripe_customer_id = ss.stripe_customer_id
          WHERE sc.user_id = $1
            AND ss.status IN ('active', 'past_due', 'incomplete')
          ORDER BY ss.updated_at DESC
          LIMIT 1`,
        [userId]
      );

      const activePriceId = (subscriptionResult[0] as { stripe_price_id?: string } | undefined)
        ?.stripe_price_id;

      if (activePriceId) {
        return TIER_DEFINITIONS[this.resolveTierFromPriceId(activePriceId)];
      }

      const legacyResult = await dbClient.unsafe(`SELECT tier FROM user_tiers WHERE user_id = $1`, [
        userId,
      ]);
      const legacyTier =
        (legacyResult[0] as { tier?: SisRuaTier } | undefined)?.tier || 'community';
      return TIER_DEFINITIONS[legacyTier as SisRuaTier];
    } catch (error) {
      logger.error('Erro ao buscar tier do usuário', { error, userId });
      return TIER_DEFINITIONS['community']; // Default safety
    }
  }

  /**
   * Valida se usuário pode acessar uma feature baseado em tier
   */
  async canAccessFeature(userId: string, featureName: string): Promise<boolean> {
    const tierDef = await this.getUserTierDefinition(userId);
    const tierFeatures = tierDef.features;

    // Mapeamento de feature → requisito de tier
    const featureRequirements: Record<string, keyof typeof tierFeatures> = {
      export_dxf: 'maxDxfPerMonth',
      terrain_processing: 'maxTerrainProcessingPerMonth',
      dg_optimization: 'maxDgRunsPerMonth',
      api_access: 'hasApiAccess',
      webhooks: 'hasWebhooks',
    };

    const requirement = featureRequirements[featureName];
    if (!requirement) return true; // Feature não possui restrição

    const featureValue = tierFeatures[requirement];

    // Se é um número, verificar se > 0 (não bloqueado)
    if (typeof featureValue === 'number') {
      return featureValue !== 0;
    }

    // Se é booleano
    return Boolean(featureValue);
  }

  /**
   * Retorna lista de produtos disponíveis com preços
   */
  async getProductCatalog() {
    return Object.values(TIER_DEFINITIONS).map(tier => ({
      id: tier.id,
      name: tier.name,
      description: tier.description,
      priceMonthlyBRL: tier.priceMonthlyBRL,
      features: tier.features,
    }));
  }
}

export const stripeService = new StripeService();

/**
 * Exportar definições para uso em middlewares e rotas
 */
export { TIER_DEFINITIONS };
