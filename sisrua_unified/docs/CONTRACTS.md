# API Contracts — sisTOPOGRAFIA

Este documento formaliza os contratos HTTP para os domínios críticos de Autenticação e Faturamento, garantindo estabilidade entre Backend e Testes E2E.

## 🔐 Autenticação (Auth)

### Login
- **Endpoint:** `POST /api/auth/login` (via Supabase SDK)
- **Regra de Domínio:** Apenas e-mails do domínio `im3brasil.com.br` são permitidos.
- **Validação Frontend:** Bloqueia submissão se o domínio for inválido.
- **Payload de Erro (Domínio):**
  - **Status:** 403 (ou bloqueio local)
  - **Mensagem:** `Somente emails @im3brasil.com.br têm autoatendimento liberado.`

## 💳 Faturamento (Billing)

### Webhook Stripe
- **Endpoint:** `POST /api/billing/webhook`
- **Segurança:** Requer cabeçalho `stripe-signature` válido.
- **Cenários de Erro:**
  - **Assinatura Ausente:** 
    - **Status:** 400
    - **Payload:** `{ "erro": "Assinatura ausente" }`
  - **Assinatura Inválida:**
    - **Status:** 400
    - **Payload:** `{ "erro": "Falha na validação do webhook" }`
  - **Configuração Ausente (`STRIPE_WEBHOOK_SECRET`):**
    - **Status:** 400
    - **Payload:** `{ "erro": "Webhook não configurado" }`

### Checkout
- **Endpoint:** `POST /api/billing/checkout`
- **Segurança:** Requer Autenticação JWT + Permissão `read`.
- **Cenário Sem Autenticação:**
  - **Status:** 401
  - **Payload:** `{ "error": "Authentication required", "erro": "Authentication required", "code": "UNAUTHORIZED", "category": "AuthenticationError" }`

## 📏 Padrões de Teste E2E

1.  **Seletores Estáveis:** SEMPRE utilizar `data-testid` para elementos interativos e mensagens de feedback.
2.  **Redirecionamentos:** Testes devem aguardar a URL final com timeout adequado (mínimo 10s para fluxos com animação).
3.  **Independência:** Cada teste E2E deve ser atômico e não depender do estado residual de outros testes.
