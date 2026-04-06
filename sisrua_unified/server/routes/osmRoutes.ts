import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger.js';

const router = Router();

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.nchc.org.tw/api/interpreter'
];

const fetchWithTimeout = async (url: string, body: string, timeoutMs: number): Promise<Response> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      method: 'POST',
      body,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
};

router.post('/', async (req: Request, res: Response) => {
  const lat = Number(req.body?.lat);
  const lng = Number(req.body?.lng);
  const radius = Number(req.body?.radius);

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(radius) || radius <= 0) {
    return res.status(400).json({ error: 'Invalid coordinates or radius' });
  }

  const query = `
    [out:json][timeout:60];
    (
      nwr(around:${radius},${lat},${lng});
    );
    out body geom qt;
  `;

  const requestBody = `data=${encodeURIComponent(query)}`;
  let lastError: unknown = null;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetchWithTimeout(endpoint, requestBody, 30000);
      if (!response.ok) {
        throw new Error(`Overpass API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return res.json(data);
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      logger.warn('Overpass endpoint failed', { endpoint, message });
    }
  }

  logger.error('All Overpass endpoints failed', {
    lat,
    lng,
    radius,
    error: lastError instanceof Error ? lastError.message : String(lastError)
  });
  return res.status(502).json({ error: 'Failed to fetch OSM data from Overpass endpoints' });
});

export default router;
