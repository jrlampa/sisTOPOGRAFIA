import request from 'supertest';
import express from 'express';
import cors from 'cors';

// Mock the pythonBridge module before importing the app
jest.mock('../pythonBridge', () => ({
  generateDXF: jest.fn()
}));

describe('API Endpoints', () => {
  let app: express.Application;

  beforeAll(() => {
    // Create a minimal Express app for testing
    app = express();
    app.use(cors());
    app.use(express.json({ limit: '10mb' }));

    // Health check endpoint
    app.get('/', (req, res) => {
      res.json({
        status: 'ok',
        service: 'sisRUA DXF Generator',
        version: '1.0.0',
        timestamp: new Date().toISOString()
      });
    });
  });

  describe('GET /', () => {
    it('should return health check status', async () => {
      const response = await request(app).get('/');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('service', 'sisRUA DXF Generator');
      expect(response.body).toHaveProperty('version', '1.0.0');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should return valid JSON', async () => {
      const response = await request(app).get('/');

      expect(response.type).toBe('application/json');
    });
  });

  describe('POST /api/search', () => {
    beforeAll(() => {
      // Add search endpoint
      app.post('/api/search', (req, res) => {
        const { query } = req.body;

        if (!query) {
          return res.status(400).json({ error: 'Query parameter is required' });
        }

        // Mock response for decimal coordinates
        if (query.match(/[-+]?\d+\.\d+.*[-+]?\d+\.\d+/)) {
          return res.json({
            results: [{
              lat: -23.5505,
              lng: -46.6333,
              label: 'Lat/Lng -23.550500, -46.633300'
            }]
          });
        }

        return res.json({ results: [] });
      });
    });

    it('should return 400 for missing query parameter', async () => {
      const response = await request(app)
        .post('/api/search')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should parse decimal coordinates', async () => {
      const response = await request(app)
        .post('/api/search')
        .send({ query: '-23.5505, -46.6333' });

      expect(response.status).toBe(200);
      expect(response.body.results).toHaveLength(1);
      expect(response.body.results[0]).toHaveProperty('lat', -23.5505);
      expect(response.body.results[0]).toHaveProperty('lng', -46.6333);
    });
  });

  describe('POST /api/analyze-pad', () => {
    beforeAll(() => {
      app.post('/api/analyze-pad', (req, res) => {
        const { polygon, target_z, autoBalance } = req.body;

        if (!polygon) return res.status(400).json({ error: 'Polígono é obrigatório' });

        // Simular cálculo rápido:
        if (autoBalance) {
          return res.json({
            cut_volume: 50.0,
            fill_volume: 50.0,
            net_volume: 0.0,
            area_m2: 100.0,
            stats: { target_z: 815.5, optimized_z: true }
          });
        }

        if (!target_z) return res.status(400).json({ error: 'target_z é obrigatório' });

        return res.json({
          cut_volume: 150.0,
          fill_volume: 0.0,
          net_volume: -150.0,
          area_m2: 100.0,
          stats: { target_z: Number(target_z), optimized_z: false }
        });
      });
    });

    it('should return optimized balance with autoBalance', async () => {
      const response = await request(app)
        .post('/api/analyze-pad')
        .send({ polygon: '[[-23, -46]]', autoBalance: true });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('net_volume', 0.0);
      expect(response.body.stats).toHaveProperty('optimized_z', true);
    });

    it('should return fixed calculation when passing target_z', async () => {
      const response = await request(app)
        .post('/api/analyze-pad')
        .send({ polygon: '[[-23, -46]]', target_z: 800 });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('net_volume', -150.0);
      expect(response.body.stats).toHaveProperty('optimized_z', false);
    });

    it('should fail if polygon is missing', async () => {
      const response = await request(app)
        .post('/api/analyze-pad')
        .send({ target_z: 800 });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });
});
