# Stripe Billing — Quick Start Guide

**Tempo de setup:** ~30 minutos  
**Dificuldade:** Intermediária  
**Objetivo:** Implementar 3 tiers + bloqueios de features

---

## 🚀 Quick Start (5 passos)

### Passo 1: Copiar Chaves Stripe (5 min)

Abrir https://dashboard.stripe.com/apikeys

```bash
# .env.local ou .env.production
STRIPE_SECRET_KEY=sk_live_1234567890ABCDEF...
STRIPE_PUBLIC_KEY=pk_live_ABCDEF1234567890...
```

Criar webhook em https://dashboard.stripe.com/webhooks:

- URL: `https://yourdomain.com/api/billing/webhook`
- Eventos: `customer.subscription.*`, `invoice.payment.*`

```bash
STRIPE_WEBHOOK_SECRET=whsec_1234567890ABCDEF...
```

---

### Passo 2: Rodar Migração SQL (5 min)

```bash
# Via Supabase CLI
supabase migration up

# Verificar
psql -c "SELECT * FROM user_tiers LIMIT 1;"
```

---

### Passo 3: Bootstrap Produtos Stripe (2 min)

```bash
# Desenvolvimento local
curl -X POST http://localhost:3000/api/billing/admin/bootstrap \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN_HERE"

# Copiar os productIds e priceIds retornados
```

---

### Passo 4: Atualizar stripeService.ts (3 min)

File: `server/services/stripeService.ts`

Procurar por `const TIER_DEFINITIONS` e atualizar:

```typescript
TIER_DEFINITIONS: Record<SisRuaTier, TierDefinition> = {
  community: {
    ...
    stripeProductId: 'prod_123456',     // ← Cole aqui
    stripePriceId: undefined,
    ...
  },
  professional: {
    ...
    stripeProductId: 'prod_234567',     // ← Cole aqui
    stripePriceId: 'price_100monthly',  // ← Cole aqui
    ...
  },
  enterprise: {
    ...
    stripeProductId: 'prod_345678',     // ← Cole aqui
    stripePriceId: 'price_500monthly',  // ← Cole aqui
    ...
  },
};
```

---

### Passo 5: Testar (15 min)

#### 5a. Listar tiers

```bash
curl http://localhost:3000/api/billing/pricing | jq
```

#### 5b. Simular checkout (com JWT token)

```bash
TOKEN="seu_jwt_aqui"

curl -X POST http://localhost:3000/api/billing/checkout \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tier": "professional"}' | jq .checkoutUrl
```

#### 5c. Testar webhook (Stripe CLI)

```bash
# Instalar Stripe CLI
brew install stripe/stripe-cli/stripe  # Mac
# ou
choco install stripe-cli  # Windows

# Fazer login
stripe login

# Testar webhook
stripe listen --forward-to localhost:3000/api/billing/webhook

# Em outro terminal
stripe trigger customer.subscription.created
```

---

## 🔐 Feature Blocking Setup

Depois que Stripe estiver funcionando, adicionar bloqueios:

### 1. Criar Middleware

File: `server/middleware/tierGuard.ts`

```typescript
import { Request, Response, NextFunction } from 'express';
import { stripeService } from '../services/stripeService.js';
import { createError } from '../errorHandler.js';

export const requireTier = (minimumTier: 'community' | 'professional' | 'enterprise') => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.headers['x-user-id'] as string;
      if (!userId) return next(createError.authorization('User not authenticated'));

      const tierDef = await stripeService.getUserTierDefinition(userId);
      const tierOrder = { community: 0, professional: 1, enterprise: 2 };

      if (tierOrder[tierDef.id] < tierOrder[minimumTier]) {
        return res.status(403).json({
          error: `Upgrade required to ${minimumTier}`,
          currentTier: tierDef.id,
          requiredTier: minimumTier,
          upgradeUrl: '/pricing',
        });
      }

      next();
    } catch (error) {
      next(createError.authorization('Tier check failed'));
    }
  };
};
```

### 2. Adicionar em Rotas

File: `server/routes/dxfRoutes.ts`

```typescript
import { requireTier } from '../middleware/tierGuard.js';

// Proteger exports DXF
router.post('/export', requireTier('professional'), async (req, res) => {
  // ... DXF export logic
});

// Proteger terrain processing
router.post('/process-terrain', requireTier('professional'), async (req, res) => {
  // ... terrain logic
});
```

---

## 🎨 Frontend Setup

### Pricing Page

File: `src/pages/Pricing.tsx` (criar se não existir)

```tsx
import { useEffect, useState } from 'react';

export function Pricing() {
  const [tiers, setTiers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/billing/pricing')
      .then(r => r.json())
      .then(data => setTiers(data.tiers))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Carregando...</div>;

  return (
    <div className="pricing-container">
      <h1>Escolha seu Plano</h1>
      <div className="pricing-grid">
        {tiers.map(tier => (
          <div key={tier.id} className="tier-card">
            <h2>{tier.name}</h2>
            <p className="price">
              R$ {tier.priceMonthlyBRL}
              {tier.priceMonthlyBRL > 0 && '/mês'}
            </p>
            <p className="description">{tier.description}</p>

            <ul className="features">
              <li>
                Área máx: {tier.features.maxAreaKm2 === -1 ? 'Ilimitada' : tier.features.maxAreaKm2}{' '}
                km²
              </li>
              <li>
                DXF/mês:{' '}
                {tier.features.maxDxfPerMonth === -1 ? 'Ilimitado' : tier.features.maxDxfPerMonth}
              </li>
              <li>API: {tier.features.hasApiAccess ? '✅' : '❌'}</li>
              <li>Suporte: {tier.features.supportLevel}</li>
            </ul>

            <button
              className="upgrade-btn"
              onClick={() => handleUpgrade(tier.id)}
              disabled={tier.id === 'community'}
            >
              {tier.id === 'community' ? 'Seu Plano Atual' : 'Fazer Upgrade'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  function handleUpgrade(tier: string) {
    const token = sessionStorage.getItem('jwtToken');

    fetch('/api/billing/checkout', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tier }),
    })
      .then(r => r.json())
      .then(data => {
        window.location.href = data.checkoutUrl;
      })
      .catch(err => alert('Erro ao iniciar checkout: ' + err.message));
  }
}
```

### Billing Dashboard

File: `src/pages/Account/Billing.tsx`

```tsx
import { useEffect, useState } from 'react';

export function BillingDashboard() {
  const [billing, setBilling] = useState(null);
  const token = sessionStorage.getItem('jwtToken');

  useEffect(() => {
    fetch('/api/billing/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => setBilling(data));
  }, [token]);

  if (!billing) return <div>Carregando...</div>;

  return (
    <div className="billing-dashboard">
      <h1>Meu Plano</h1>

      <div className="plan-info">
        <p>
          <strong>Plano Atual:</strong> {billing.tierName}
        </p>
        <p>
          <strong>Status:</strong> {billing.status}
        </p>
        <p>
          <strong>Desde:</strong> {new Date(billing.createdAt).toLocaleDateString('pt-BR')}
        </p>
      </div>

      <div className="plan-features">
        <h2>Seus Benefícios</h2>
        <ul>
          <li>
            Área máx:{' '}
            {billing.features.maxAreaKm2 === -1 ? 'Ilimitada' : billing.features.maxAreaKm2} km²
          </li>
          <li>
            DXF/mês:{' '}
            {billing.features.maxDxfPerMonth === -1 ? 'Ilimitado' : billing.features.maxDxfPerMonth}
          </li>
          <li>
            Terrain Processing:{' '}
            {billing.features.maxTerrainProcessingPerMonth === -1
              ? 'Ilimitado'
              : billing.features.maxTerrainProcessingPerMonth}
            /mês
          </li>
          <li>
            DG Optimization:{' '}
            {billing.features.maxDgRunsPerMonth === -1
              ? 'Ilimitado'
              : billing.features.maxDgRunsPerMonth}
            /mês
          </li>
          <li>API Access: {billing.features.hasApiAccess ? '✅' : '❌'}</li>
          <li>Webhooks: {billing.features.hasWebhooks ? '✅' : '❌'}</li>
        </ul>
      </div>

      <button className="manage-btn" onClick={handleManageBilling}>
        Gerenciar Faturamento
      </button>
    </div>
  );

  function handleManageBilling() {
    fetch('/api/billing/portal', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        window.location.href = data.portalUrl;
      });
  }
}
```

---

## 📊 Verificações Finais

- [ ] `user_tiers` table criada no PostgreSQL
- [ ] 3 produtos criados na Stripe (verificar em https://dashboard.stripe.com/products)
- [ ] Webhook registrado e respondendo
- [ ] GET `/api/billing/pricing` retorna 3 tiers
- [ ] POST `/api/billing/checkout` gera URL válida
- [ ] Frontend renderiza pricing page
- [ ] Feature blocking funciona (403 em `/export/dxf` para community users)

---

## 🐛 Debugging

### Webhook não dispara

```bash
# Via Stripe CLI
stripe logs tail

# Ou check webhook deliveries
https://dashboard.stripe.com/webhooks
```

### User sempre vê community tier

```sql
-- Check user tier
SELECT * FROM user_tiers WHERE user_id = 'xxx';

-- Se não existe, create manualmente
INSERT INTO user_tiers (user_id, tier, status)
VALUES ('xxx', 'professional', 'active');
```

### Checkout retorna 403

```bash
# Verificar autenticação
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/billing/me | jq
```

---

## 📚 Documentação Completa

- `STRIPE_IMPLEMENTATION_SUMMARY.md` — Overview arquitetural
- `docs/STRIPE_BILLING_IMPLEMENTATION_GUIDE.md` — Documentação detalhada
- `FINOPS_STRIPE_VALUATION.md` — Análise de negócio
- `FEATURE_FLAGS_BY_TIER.md` — Matrix de features

---

**✅ Pronto!** Seu sistema de tiers Stripe está rodando.

**Próximos passos:** Feature blocking → Frontend pages → E2E testing
