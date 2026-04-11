import express from 'express';
import request from 'supertest';

const getFeaturesByBBoxMock = jest.fn();
const getWmsMapUrlMock = jest.fn();

jest.mock('../services/indeService', () => ({
  IndeService: {
    getWfsCapabilities: jest.fn(),
    getFeaturesByBBox: (...args: unknown[]) => getFeaturesByBBoxMock(...args),
    getWmsMapUrl: (...args: unknown[]) => getWmsMapUrlMock(...args),
  },
}));

describe('indeRoutes bbox validation', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('rejects invalid bbox on /features/:source', async () => {
    const { default: router } = await import('../routes/indeRoutes');
    const app = express();
    app.use('/api/inde', router);

    const response = await request(app)
      .get('/api/inde/features/ibge')
      .query({ layer: 'foo', west: '200', south: '-10', east: '-40', north: '-20', limit: '100' });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Invalid bounding box');
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
    expect(response.body.error).toContain('Invalid width/height');
    expect(getWmsMapUrlMock).not.toHaveBeenCalled();
  });
});
