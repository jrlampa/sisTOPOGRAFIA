# Guia de Implementação: Stripe Billing & Tiers — sisRUA

**Data:** 13 Maio 2026  
**Versão:** 1.0  
**Status:** Pronto para Implementação

---

## 1. VISÃO GERAL ARQUITETURAL

```
┌──────────────────────────────────────────────────────────┐
│                     Frontend (React)                      │
│  - Pricing page (/pricing)                               │
│  - Billing dashboard (/account/billing)                  │
│  - Checkout redirection (Stripe.com)                     │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ├─→ GET /api/billing/pricing
                     ├─→ POST /api/billing/checkout
                     ├─→ GET /api/billing/me
                     └─→ GET /api/billing/portal
                     │
┌────────────────────┴─────────────────────────────────────┐
│            Backend (Node.js + Express)                    │
│ ┌──────────────────────────────────────────────────────┐ │
│ │  billingRoutes.ts                                     │ │
│ │  ├─ GET /pricing          → TIER_DEFINITIONS         │ │
│ │  ├─ GET /me               → user_tiers (DB)          │ │
│ │  ├─ POST /checkout        → Stripe.Session           │ │
│ │  ├─ GET /portal           → Stripe.BillingPortal     │ │
│ │  └─ POST /webhook         → syncSubscriptionToDB()   │ │
│ └──────────────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────────────┐ │
│ │  stripeService.ts                                     │ │
│ │  ├─ bootstrapSisRuaProducts()                        │ │
│ │  ├─ createCheckoutSession()                          │ │
│ │  ├─ syncSubscriptionToDB()                           │ │
│ │  ├─ getUserTierDefinition()                          │ │
│ │  └─ canAccessFeature()                               │ │
│ └──────────────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────────────┐ │
│ │  Middleware: requireTier() [NÃO IMPLEMENTADO AINDA]  │ │
│ │  Aplicado em: /export/dxf, /run-dg, etc.            │ │
│ └──────────────────────────────────────────────────────┘ │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ├─→ PostgreSQL (user_tiers table)
                     │
                     └─→ Stripe API
                         ├─ Create Products
                         ├─ Create Prices
                         ├─ Create Subscriptions
                         └─ Webhook Events
```

---

## 2. CHECKLIST DE CONFIGURAÇÃO

### Passo 1: Configurar Variáveis de Ambiente

**Arquivo:** `.env.local` (ou `.env.production`)

```bash
# ─── Stripe API Keys ──────────────────────────────────
STRIPE_SECRET_KEY=sk_live_REDACTED_secret_key_here        # Live key em prod
STRIPE_PUBLIC_KEY=pk_live_REDACTED_public_key_here        # Público (frontend)
STRIPE_WEBHOOK_SECRET=whsec_REDACTED_webhook_secret_here  # Webhook signing secret

# ─── Frontend URLs ────────────────────────────────────
FRONTEND_URL=https://sisrua.yourdomain.com           # Used for success/cancel URLs
```

**Obter essas chaves:**

1. Ir em https://dashboard.stripe.com/apikeys
2. Copiar "Secret Key" (live) → `STRIPE_SECRET_KEY`
3. Copiar "Publishable Key" (live) → `STRIPE_PUBLIC_KEY`
4. Ir em https://dashboard.stripe.com/webhooks
5. Criar webhook para:
   - URL: `https://yourdomain.com/api/billing/webhook`
   - Eventos: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
   - Copiar "Signing Secret" → `STRIPE_WEBHOOK_SECRET`

---

### Passo 2: Aplicar Migração SQL

Executar a migração que cria `user_tiers` table:

```bash
# Via Supabase CLI
supabase migration up

# OU via psql direto
psql -U postgres -d sisrua -f migrations/100_create_user_tiers_stripe.sql
```

**Verificar que a tabela foi criada:**

```sql
SELECT * FROM user_tiers LIMIT 1;
-- Deve retornar coluna: user_id, tier, stripe_customer_id, stripe_subscription_id, status, created_at, updated_at
```

---

### Passo 3: Bootstrap dos Produtos Stripe

Executar **uma única vez** para criar os 3 produtos na Stripe:

```bash
# Via curl (local development)
curl -X POST http://localhost:3000/api/billing/admin/bootstrap \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Resposta esperada:
{
  "message": "Produtos criados/sincronizados com sucesso na Stripe",
  "products": {
    "community": {
      "productId": "prod_123456",
      "priceId": null  # Sem preço para gratuito
    },
    "professional": {
      "productId": "prod_234567",
      "priceId": "price_100monthly"
    },
    "enterprise": {
      "productId": "prod_345678",
      "priceId": "price_500monthly"
    }
  },
  "nextSteps": [...]
}
```

---

### Passo 4: Atualizar stripeService.ts com IDs Reais

Após bootstrap, atualizar as definições:

```typescript
// server/services/stripeService.ts
const TIER_DEFINITIONS: Record<SisRuaTier, TierDefinition> = {
  community: {
    id: 'community',
    name: 'Community (Gratuito)',
    description: 'Análise básica e visualização de dados geoespaciais',
    priceMonthlyBRL: 0,
    stripeProductId: 'prod_123456',  // ← Adicionar aqui
    stripePriceId: undefined,         // ← Sem preço
    features: { ... },
  },
  professional: {
    id: 'professional',
    ...
    stripeProductId: 'prod_234567',  // ← Adicionar aqui
    stripePriceId: 'price_100monthly', // ← Adicionar aqui
    features: { ... },
  },
  // ... etc
};
```

---

### Passo 5: Testar Endpoints

#### 5a. Listar preços disponíveis

```bash
curl http://localhost:3000/api/billing/pricing
```

**Resposta esperada:**

```json
{
  "tiers": [
    {
      "id": "community",
      "name": "Community (Gratuito)",
      "description": "Análise básica e visualização de dados geoespaciais",
      "priceMonthlyBRL": 0,
      "features": { ... }
    },
    {
      "id": "professional",
      "name": "Professional",
      "priceMonthlyBRL": 120,
      "features": { ... }
    },
    {
      "id": "enterprise",
      "name": "Enterprise",
      "priceMonthlyBRL": 1500,
      "features": { ... }
    }
  ],
  "currency": "BRL"
}
```

#### 5b. Obter tier do usuário autenticado

```bash
curl -H "Authorization: Bearer USER_JWT_TOKEN" \
     http://localhost:3000/api/billing/me
```

**Resposta esperada:**

```json
{
  "userId": "123e4567-e89b-12d3-a456-426614174000",
  "tier": "community",
  "tierName": "Community (Gratuito)",
  "status": "active",
  "subscriptionId": null,
  "features": {
    /* tier features */
  },
  "createdAt": "2026-05-13T10:00:00Z",
  "updatedAt": "2026-05-13T10:00:00Z"
}
```

#### 5c. Criar checkout para upgrade

```bash
curl -X POST http://localhost:3000/api/billing/checkout \
  -H "Authorization: Bearer USER_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tier": "professional"}'
```

**Resposta esperada:**

```json
{
  "checkoutUrl": "https://checkout.stripe.com/pay/cs_live_...",
  "sessionId": "cs_live_..."
}
```

---

## 3. WORKFLOW DE USUÁRIO (Customer Journey)

### Cenário 1: Novo Usuário (Community)

1. Usuário faz signup → Trigger cria row em `user_tiers` com `tier='community'`
2. Frontend GET `/api/billing/me` → Retorna features limitadas
3. UI renderiza botões bloqueados (Export DXF, etc.) com link para upgrade
4. Usuário clica "Upgrade" → Redireciona para `/api/billing/checkout?tier=professional`
5. ✅ Recebe `checkoutUrl` → Redireciona para Stripe
6. Usuário preenche cartão → Stripe processa pagamento
7. ✅ Stripe envia webhook `customer.subscription.created`
8. Backend sincroniza: `UPDATE user_tiers SET tier='professional'`
9. ✅ Próximo GET `/api/billing/me` retorna `tier='professional'`
10. UI renderiza features desbloqueadas ✅

### Cenário 2: Cancelar Assinatura

1. Usuário acessa `/api/billing/portal` → Redireciona para Stripe
2. Em https://customer.stripe.com, cancela subscription
3. Stripe envia webhook `customer.subscription.deleted`
4. Backend sincroniza: `UPDATE user_tiers SET tier='community'`
5. Próximo GET `/api/billing/me` retorna `tier='community'` novamente

### Cenário 3: Falha de Pagamento

1. Stripe envia webhook `invoice.payment_failed`
2. Backend marca `status='past_due'` na DB
3. Usuário recebe email de Stripe alertando
4. UI pode mostrar aviso: "Pagamento pendente"
5. Se pagar até prazo → Webhook `customer.subscription.updated` → `status='active'`

---

## 4. INTEGRAÇÃO COM FRONTEND

### Component de Preços (já deve estar em `src/pages/Pricing.tsx`)

```tsx
// Exemplo
import { useEffect, useState } from 'react';

export function Pricing() {
  const [tiers, setTiers] = useState([]);

  useEffect(() => {
    fetch('/api/billing/pricing')
      .then(r => r.json())
      .then(data => setTiers(data.tiers));
  }, []);

  return (
    <div className="pricing-grid">
      {tiers.map(tier => (
        <Card key={tier.id}>
          <h3>{tier.name}</h3>
          <p>R$ {tier.priceMonthlyBRL}/mês</p>
          <Button onClick={() => handleCheckout(tier.id)}>
            {tier.id === 'community' ? 'Currently Free' : 'Upgrade'}
          </Button>
        </Card>
      ))}
    </div>
  );

  function handleCheckout(tier: string) {
    fetch('/api/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ tier }),
    })
      .then(r => r.json())
      .then(data => {
        window.location.href = data.checkoutUrl; // Redireciona para Stripe
      });
  }
}
```

### Component de Informações (já deve estar em `src/pages/Account/Billing.tsx`)

```tsx
import { useEffect, useState } from 'react';

export function BillingDashboard() {
  const [billing, setBilling] = useState(null);

  useEffect(() => {
    fetch('/api/billing/me', {
      headers: { Authorization: `Bearer ${sessionStorage.getItem('jwtToken')}` },
    })
      .then(r => r.json())
      .then(data => setBilling(data));
  }, []);

  return billing ? (
    <div>
      <h2>Plano Atual: {billing.tierName}</h2>
      <p>Status: {billing.status}</p>
      <p>Desde: {new Date(billing.createdAt).toLocaleDateString('pt-BR')}</p>

      <Button onClick={() => handlePortal()}>Gerenciar Faturamento</Button>
    </div>
  ) : null;

  function handlePortal() {
    fetch('/api/billing/portal')
      .then(r => r.json())
      .then(data => {
        window.location.href = data.portalUrl; // Redireciona para Stripe Portal
      });
  }
}
```

---

## 5. PRÓXIMOS PASSOS (Após Bootstrap)

### ✅ Fase 1: Bloqueio de Features (URGENTE)

Implementar middleware `requireTier()` em rotas críticas:

```typescript
// server/routes/dxfRoutes.ts
router.post('/export', requireTier('professional'), async (req, res) => {
  // Apenas users com tier >= professional acessam aqui
});

// server/routes/dgRoutes.ts
router.post('/run-optimization', requireTier('professional'), async (req, res) => {
  // DG requer Professional
});
```

**Arquivos a modificar:**

- `/export/dxf` → require Professional
- `/run-dg` → require Professional
- `/terrain-processing` → require Professional
- `/api/` (endpoints) → require Professional

### ✅ Fase 2: Metering & Usage Tracking (Opcional)

Para PAYG (Pay-as-You-Go), sincronizar uso com Stripe:

```typescript
// Após cada export DXF
await stripe.billing.meterEventAdjustment.create({
  eventName: 'dxf_export_count',
  value: 1,
  identifier: customerId,
});
```

### ✅ Fase 3: Webhooks de Eventos (Observabilidade)

Adicionar logging/alertas:

```typescript
// billingRoutes.ts webhook
logger.info('Subscription criada', { customerId, tier: newTier });
// Trigger: Enviar email de boas-vindas, adicionar a CRM, etc.
```

---

## 6. TROUBLESHOOTING

### Problema: Webhook não sincroniza tier

**Solução:**

1. Verificar `STRIPE_WEBHOOK_SECRET` está correto
2. Ir em https://dashboard.stripe.com/webhooks → View Details
3. Verificar se há "Failed" events
4. Re-enviar evento manualmente: "Resend event"

### Problema: Usuario sempre vê "community" tier

**Solução:**

1. Verificar que `user_tiers` row foi criado:
   ```sql
   SELECT * FROM user_tiers WHERE user_id = 'xxx';
   ```
2. Verificar que `stripeProductId` e `stripePriceId` estão preenchidos em TIER_DEFINITIONS
3. Verificar logs de webhook:
   ```bash
   tail -f logs/billing.log | grep "Tier sincronizado"
   ```

### Problema: Checkout retorna erro 403

**Solução:**

1. Verificar autenticação JWT no header `Authorization`
2. Verificar que user está em `user_tiers` (não foi criado automaticamente? Fazer insert manual)
3. Verificar CORS: Frontend deve estar no mesmo domínio ou whitelist CORS

---

## 7. MONITORAMENTO & MÉTRICAS

### Queries Úteis

```sql
-- Distribuição de usuários por tier
SELECT tier, COUNT(*) as user_count
FROM user_tiers
GROUP BY tier;

-- Assinaturas ativas
SELECT tier, COUNT(*) as active_subscriptions
FROM user_tiers
WHERE status = 'active'
GROUP BY tier;

-- Churn recente (canceladas nos últimos 30 dias)
SELECT COUNT(*) as canceled_last_30d
FROM user_tiers
WHERE status = 'canceled'
AND updated_at >= NOW() - INTERVAL '30 days';
```

### Dashboard Recomendado

Criar dashboard em `/api/metrics` ou Grafana com:

- MRR (Monthly Recurring Revenue)
- Churn Rate
- Upgrade Conversion Rate
- CAC (Customer Acquisition Cost)
- LTV (Lifetime Value)

---

## 8. FAQ

**P: Posso testar Stripe em sandbox (test mode)?**

R: Sim! Use as chaves TEST de https://dashboard.stripe.com/test/apikeys

- `STRIPE_SECRET_KEY=sk_test_...`
- `STRIPE_PUBLIC_KEY=pk_test_...`

Use cartão de teste: `4242 4242 4242 4242`

---

**P: Como cobrar taxa de setup ou anual?**

R: Modificar `createCheckoutSession()` para aceitar `billingCycle: 'annual'` e sincronizar preço anual via Stripe

---

**P: Posso ter tiers customizados por tenant?**

R: Sim! Estender `user_tiers` com coluna `tenant_id` e adicionar policy RLS

---

**Última atualização:** 13 Maio 2026  
**Próxima revisão:** 30 Junho 2026


