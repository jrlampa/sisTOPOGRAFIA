import { vi } from "vitest";
import express from 'express';
import request from 'supertest';

const getFeaturesByBBoxMock = vi.fn();
const getWmsMapUrlMock = vi.fn();

vi.mock('../services/indeService', () => ({
  IndeService: {
    getWfsCapabilities: vi.fn(),
    getFeaturesByBBox: (...args: unknown[]) => getFeaturesByBBoxMock(...args),
    getWmsMapUrl: (...args: unknown[]) => getWmsMapUrlMock(...args),
  },
}));

describe('indeRoutes bbox validation', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('rejects invalid bbox on /features/:source', async () => {
    const { default: router } = await import('../routes/indeRoutes');
    const app = express();
    app.use('/api/inde', router);

    const response = await request(app)
      .get('/api/inde/features/ibge')
      .query({ layer: 'foo', west: '200', south: '-10', east: '-40', north: '-20', limit: '100' });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Parâmetros inválidos');
    expect(JSON.stringify(response.body.details)).toContain('Invalid bounding box');
    expect(getFeaturesByBBoxMock).not.toHaveBeenCalled();
  });

  it('rejects invalid dimensions on /wms/:source', async () => {
    const { default: router } = await import('../routes/indeRoutes');
    const app = express();
    app.use('/api/inde', router);

    const response = await request(app)
      .get('/api/inde/wms/ibge')
      .query({ layer: 'foo', west: '-49', south: '-23', east: '-46', north: '-21', width: '99999', height: '768' });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Parâmetros inválidos');
    expect(JSON.stringify(response.body.details)).toContain(
      "Too big: expected number to be <=4096",
    );
    expect(getWmsMapUrlMock).not.toHaveBeenCalled();
  });

  it('applies list contract on /features/:source with paging metadata', async () => {
    getFeaturesByBBoxMock.mockResolvedValueOnce({
      type: 'FeatureCollection',
      features: [
        { id: 2, type: 'Feature', properties: {} },
        { id: 1, type: 'Feature', properties: {} }
      ]
    });

    const { default: router } = await import('../routes/indeRoutes');
    const app = express();
    app.use('/api/inde', router);

    const response = await request(app)
      .get('/api/inde/features/ibge')
      .query({
        layer: 'foo',
        west: '-49',
        south: '-23',
        east: '-46',
        north: '-21',
        limit: '1',
        offset: '0',
        sortBy: 'id',
        sortOrder: 'asc'
      });

    expect(response.status).toBe(200);
    expect(response.body.features).toEqual([
      { id: 1, type: 'Feature', properties: {} }
    ]);
    expect(response.body.meta.total).toBe(2);
  });
});

