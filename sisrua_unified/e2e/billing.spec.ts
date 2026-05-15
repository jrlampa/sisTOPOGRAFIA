import { test, expect } from '@playwright/test';

test.describe('Stripe/Billing E2E', () => {
  test('Webhook security: should reject requests without signature', async ({ request }) => {
    const response = await request.post('/api/billing/webhook', {
      data: {
        id: 'evt_test',
        type: 'customer.subscription.updated',
      }
    });
    
    // Expect 400 Bad Request because signature is missing
    expect(response.status()).toBe(400);
    const body = await response.json();
    // Aceita 'erro' ou 'error' para maior resiliência durante transição de contrato
    const errorMsg = body.erro || body.error;
    expect(errorMsg).toMatch(/Assinatura ausente/i);
  });

  test('Webhook security: should reject requests with invalid signature', async ({ request }) => {
    const response = await request.post('/api/billing/webhook', {
      headers: {
        'stripe-signature': 't=123,v1=bad_signature',
      },
      data: {
        id: 'evt_test',
        type: 'customer.subscription.updated',
      }
    });
    
    // Expect 400 Bad Request for invalid signature
    expect(response.status()).toBe(400); 
    const body = await response.json();
    const errorMsg = body.erro || body.error;
    expect(errorMsg).toMatch(/Falha na validação do webhook/i);
  });

  test('Checkout API: requires authentication', async ({ request }) => {
    const response = await request.post('/api/billing/checkout', {
      data: {
        tier: 'professional',
      }
    });
    
    // Should be unauthorized (auth not provided in this request)
    // Recomendação: 401 para ausência de autenticação
    expect(response.status()).toBe(401);
  });
});
