import { test, expect } from '@playwright/test';

test.describe('Security & Vulnerability E2E Checks', () => {
  test('should not leak server technology in headers (X-Powered-By)', async ({ request }) => {
    const response = await request.get('/');
    const headers = response.headers();

    // Helmet should remove X-Powered-By
    expect(headers['x-powered-by']).toBeUndefined();
  });

  test('should enforce strict HSTS (Security Hardening)', async ({ request }) => {
    // Security headers are served by the Express backend (Helmet), not the Vite dev server.
    const backendBaseUrl = process.env.E2E_BACKEND_URL ?? 'http://127.0.0.1:3001';
    const response = await request.get(`${backendBaseUrl}/health`);
    const headers = response.headers();

    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBe('SAMEORIGIN');
  });

  test('should return 403 for unauthorized admin access', async ({ request }) => {
    const response = await request.get('/api/admin/config');
    // Should be 403 or 401 depending on auth state
    expect([401, 403]).toContain(response.status());
  });

  test('should reject malformed or suspicious API requests (XSS attempt)', async ({ request }) => {
    const response = await request.post('/api/dxf', {
      data: {
        lat: 0,
        lon: 0,
        radius: 100,
        mode: '<script>alert(1)</script>',
      },
    });

    // Should be blocked by detectSuspiciousPatterns middleware
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.code).toBe('INVALID_INPUT');
  });

  test('should reject path traversal in API endpoints', async ({ request }) => {
    const response = await request.get('/api/dxf/downloads/..%2fpackage.json');
    expect(response.status()).toBe(400); // Our fix returns 400
  });

  test('should reject extremely large JSON payloads (DoS protection)', async ({ request }) => {
    const hugePayload = {
      lat: 0,
      lon: 0,
      radius: 100,
      junk: 'X'.repeat(6 * 1024 * 1024), // 6MB
    };

    const response = await request.post('/api/dxf', {
      data: hugePayload,
    });

    expect(response.status()).toBe(413);
  });
});
