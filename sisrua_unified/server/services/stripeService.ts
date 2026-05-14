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
      this.stripe = new Stripe(config.STRIPE_SECRET_KEY, {
        apiVersion: '2023-10-16' as any, // Versão estável confirmada (Roadmap #116)
      });
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
    successUrl: string,
    cancelUrl: string
  ) {
    const stripe = this.getStripe();

    const tierDef = TIER_DEFINITIONS[tier];
    if (!tierDef.stripePriceId) {
      throw new Error(`stripePriceId não configurado para tier: ${tier}`);
    }

    try {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'subscription',
        line_items: [
          {
            price: tierDef.stripePriceId,
            quantity: 1,
          },
        ],
        customer_email: userEmail,
        client_reference_id: userId, // Vincular ao user ID sisRUA
        metadata: {
          sisrua_user_id: userId,
          sisrua_tier_target: tier,
        },
        success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl,
      });

      logger.info('Checkout session criado', { sessionId: session.id, userId, tier });
      return session;
    } catch (error) {
      logger.error('Erro ao criar checkout session', error);
      throw error;
    }
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
  async syncSubscriptionToDB(event: any): Promise<void> {
    const { type, data } = event;
    const subscription = data.object;

    if (!subscription.client_reference_id) {
      logger.warn('Webhook: subscription sem client_reference_id', {
        subscriptionId: subscription.id,
      });
      return;
    }

    const userId = subscription.client_reference_id;
    const dbClient = this.getRequiredDbClient();

    try {
      // Determinar tier a partir dos produtos/prices da subscription
      let newTier: SisRuaTier = 'community';

      if (subscription.items?.data?.length > 0) {
        const priceId = subscription.items.data[0].price.id;

        // Encontrar qual tier tem este priceId
        for (const [tierKey, tierDef] of Object.entries(TIER_DEFINITIONS)) {
          if (tierDef.stripePriceId === priceId) {
            newTier = tierKey as SisRuaTier;
            break;
          }
        }
      }

      // Registrar status da subscription
      const status = subscription.status; // active, past_due, unpaid, canceled, etc.

      if (status === 'active' || status === 'past_due') {
        // Usuário tem subscription ativa → atualizar tier
        await dbClient.unsafe(
          `UPDATE user_tiers 
           SET tier = $1, stripe_subscription_id = $2, stripe_customer_id = $3, 
               status = 'active', updated_at = NOW()
           WHERE user_id = $4`,
          [newTier, subscription.id, subscription.customer, userId]
        );

        logger.info('Tier sincronizado após webhook', { userId, tier: newTier, status });
      } else if (status === 'canceled') {
        // Subscription cancelada → revert para community
        await dbClient.unsafe(
          `UPDATE user_tiers 
           SET tier = 'community', status = 'canceled', updated_at = NOW()
           WHERE user_id = $1`,
          [userId]
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
      const result = await dbClient.unsafe(`SELECT tier FROM user_tiers WHERE user_id = $1`, [
        userId,
      ]);

      const userTier = (result[0] as { tier?: SisRuaTier } | undefined)?.tier || 'community';
      return TIER_DEFINITIONS[userTier as SisRuaTier];
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
