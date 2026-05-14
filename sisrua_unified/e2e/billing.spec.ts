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
    expect(body.erro).toBe('Assinatura ausente');
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
    expect(body.erro).toBe('Falha na validação do webhook');
  });

  test('Checkout API: requires authentication', async ({ request }) => {
    const response = await request.post('/api/billing/checkout', {
      data: {
        priceId: 'price_123',
      }
    });
    
    // Should be unauthorized (auth not provided in this request)
    expect(response.status()).toBe(401);
  });
});
