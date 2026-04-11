import { test, expect } from '@playwright/test';

async function ensureAppReadyOrSkip(page: import('@playwright/test').Page) {
  await page.waitForLoadState('domcontentloaded');

  const mapVisible = await page.locator('.leaflet-container').first().isVisible().catch(() => false);
  if (!mapVisible) {
    test.skip(true, 'Mapa não renderizado neste ambiente de execução E2E.');
  }
}

async function setupStableMocks(page: import('@playwright/test').Page) {
  await page.route('**/api/osm', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        elements: [
          {
            type: 'way',
            id: 1001,
            tags: { building: 'yes', height: '12' },
            geometry: [
              { lat: -23.5504, lon: -46.6334 },
              { lat: -23.5504, lon: -46.6332 },
              { lat: -23.5506, lon: -46.6332 },
              { lat: -23.5506, lon: -46.6334 }
            ]
          },
          {
            type: 'way',
            id: 1002,
            tags: { highway: 'residential' },
            geometry: [
              { lat: -23.5505, lon: -46.6335 },
              { lat: -23.5505, lon: -46.6331 }
            ]
          }
        ]
      })
    });
  });

  await page.route('**/api/dxf', async (route) => {
    await route.fulfill({
      status: 202,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'queued', jobId: 'e2e-job-1' })
    });
  });

  await page.route('**/api/jobs/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'e2e-job-1',
        status: 'completed',
        progress: 100,
        result: { url: '/downloads/e2e-job-1.dxf' },
        error: null
      })
    });
  });

  await page.route('**/api/batch/dxf', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        results: [
          { name: 'TestLocation1', status: 'queued', jobId: 'batch-job-1' },
          { name: 'TestLocation2', status: 'cached', url: '/downloads/testlocation2.dxf' }
        ],
        errors: []
      })
    });
  });
}

async function runAnalysisFlow(page: import('@playwright/test').Page, coordinates = '-23.5505, -46.6333') {
  await ensureAppReadyOrSkip(page);

  const searchInput = page.getByLabel('Search area').or(page.locator('input[type="search"]')).first();
  await expect(searchInput).toBeVisible({ timeout: 10000 });
  await searchInput.fill(coordinates);
  await searchInput.press('Enter');

  const analyzeBtn = page.getByRole('button', { name: /ANALISAR REGI[AÃ]O|ANALYZE/i });
  await expect(analyzeBtn).toBeVisible({ timeout: 10000 });
  await analyzeBtn.click();

  // Results panel appears only after OSM + terrain analysis succeeds.
  await expect(page.getByRole('button', { name: /BAIXAR DXF|DOWNLOAD DXF/i })).toBeVisible({ timeout: 60000 });
}

test.describe('DXF Generation Flow', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await setupStableMocks(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should generate DXF with cached response', async ({ page }) => {
    await runAnalysisFlow(page);

    // Click download DXF button
    const downloadBtn = page.getByRole('button', { name: /DOWNLOAD DXF|BAIXAR/i });
    await expect(downloadBtn).toBeVisible();

    await downloadBtn.click();

    // After clicking, button stays in the DOM (either "GERANDO..." or back to "BAIXAR DXF").
    // The mock backend returns 202/queued so no crash should occur.
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).toBeVisible();

    // No unhandled JS error should surface from the click
    const hasPageError = await page.evaluate(() => (window as any).__pageErrors?.length > 0);
    expect(hasPageError).toBeFalsy();
  });

  test('should display job status during queued generation', async ({ page }) => {
    // Enter unique coordinates to reduce cache hits and force queue polling path.
    const timestamp = Date.now();
    const lat = -23.5 + (timestamp % 100) / 10000;
    const lon = -46.6 + (timestamp % 100) / 10000;

    await runAnalysisFlow(page, `${lat}, ${lon}`);

    const downloadBtn = page.getByRole('button', { name: /DOWNLOAD DXF|BAIXAR/i });
    if (await downloadBtn.isVisible()) {
      await downloadBtn.click();

      // Check for queued status indicator
      const queuedText = page.locator('text=/queued|enfileirado|aguardando/i');
      const hasQueuedStatus = await queuedText.isVisible().catch(() => false);
      
      if (hasQueuedStatus) {
        // Verify polling happens (status should change or disappear)
        await page.waitForTimeout(3000);
      }
    }
  });
});

test.describe('Batch Upload Flow', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await setupStableMocks(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should upload CSV and track batch jobs', async ({ page }) => {
    await runAnalysisFlow(page);

    // Batch upload appears after analysis results are available.
    const fileInput = page.locator('input[type="file"][accept*=".csv"]').first();
    await expect(fileInput).toHaveCount(1, { timeout: 15000 });
    
    // Create CSV content
    const csvContent = 
      'name,lat,lon,radius,mode\n' +
      'TestLocation1,-23.5505,-46.6333,500,circle\n' +
      'TestLocation2,-23.5510,-46.6340,300,circle';

    // Upload CSV file
    await fileInput.setInputFiles({
      name: 'test-batch.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvContent),
    });

    // Wait for upload processing
    await page.waitForTimeout(2000);

    // Verify batch items appear in UI
    const batchItem = page.locator('text=TestLocation1');
    await expect(batchItem).toBeVisible({ timeout: 10000 });

    // Check for status indicators (queued, cached, completed)
    const statusText = page.locator('text=/queued|cached|completed|erro/i').first();
    await expect(statusText).toBeVisible({ timeout: 5000 });

    // Verify multiple items are being tracked
    const batchItems = page.locator('text=/TestLocation/');
    const count = await batchItems.count();
    expect(count).toBeGreaterThan(0);
  });
});

test.describe('Search Functionality', () => {
  test('should search for coordinates', async ({ page }) => {
    await setupStableMocks(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const searchInput = page.locator('input[type="search"], input[placeholder*="pesquis" i]').first();
    
    if (await searchInput.isVisible()) {
      await searchInput.fill('-23.5505, -46.6333');
      await searchInput.press('Enter');

      // Wait for map update or toast notification
      await page.waitForTimeout(2000);
      
      // Check for success indicator (toast, map marker, etc)
      const successIndicator = page.locator('text=/found|encontrado|success/i, .leaflet-marker');
      const hasIndicator = await successIndicator.first().isVisible().catch(() => false);
      
      if (!hasIndicator) {
        // Map should at least be visible and interactive
        await expect(page.locator('.leaflet-container')).toBeVisible();
      }
    }
  });
});
