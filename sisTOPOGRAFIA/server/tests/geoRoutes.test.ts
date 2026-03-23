jest.mock('../services/geocodingService', () => ({
    GeocodingService: { resolveLocation: jest.fn() }
}));
jest.mock('../services/elevationService', () => ({
    ElevationService: { getElevationProfile: jest.fn() }
}));
jest.mock('../pythonBridge', () => ({
    analyzePad: jest.fn()
}));
jest.mock('../middleware/rateLimiter', () => ({
    geoRateLimiter: (_req: unknown, _res: unknown, next: () => void) => next()
}));

import express from 'express';
import request from 'supertest';
import { GeocodingService } from '../services/geocodingService';
import { ElevationService } from '../services/elevationService';
import { analyzePad } from '../pythonBridge';
import geoRouter from '../interfaces/routes/geoRoutes';

const buildApp = () => {
    const app = express();
    app.use(express.json());
    app.use('/', geoRouter);
    return app;
};

describe('POST /search', () => {
    beforeEach(() => jest.clearAllMocks());

    it('returns 200 with location on valid query', async () => {
        const mockLocation = { lat: -23.5, lon: -46.6, name: 'São Paulo' };
        (GeocodingService.resolveLocation as jest.Mock).mockResolvedValueOnce(mockLocation);
        const res = await request(buildApp()).post('/search').send({ query: 'São Paulo' });
        expect(res.status).toBe(200);
        expect(res.body).toEqual(mockLocation);
        expect(GeocodingService.resolveLocation).toHaveBeenCalledWith('São Paulo');
    });

    it('returns 404 when location not found', async () => {
        (GeocodingService.resolveLocation as jest.Mock).mockResolvedValueOnce(null);
        const res = await request(buildApp()).post('/search').send({ query: 'UnknownPlace' });
        expect(res.status).toBe(404);
        expect(res.body.error).toBeDefined();
    });

    it('returns 400 on invalid body (empty query)', async () => {
        const res = await request(buildApp()).post('/search').send({ query: '' });
        expect(res.status).toBe(400);
    });

    it('returns 500 when resolveLocation throws', async () => {
        (GeocodingService.resolveLocation as jest.Mock).mockRejectedValueOnce(new Error('network error'));
        const res = await request(buildApp()).post('/search').send({ query: 'São Paulo' });
        expect(res.status).toBe(500);
        expect(res.body.error).toContain('network error');
    });

    it('returns 500 with string error when non-Error is thrown', async () => {
        (GeocodingService.resolveLocation as jest.Mock).mockRejectedValueOnce('string error');
        const res = await request(buildApp()).post('/search').send({ query: 'São Paulo' });
        expect(res.status).toBe(500);
        expect(res.body.error).toBe('string error');
    });
});

describe('POST /elevation/profile', () => {
    beforeEach(() => jest.clearAllMocks());

    const validElevationBody = {
        start: { lat: -23.5, lng: -46.6 },
        end: { lat: -23.6, lng: -46.7 },
        steps: 10
    };

    it('returns 200 with profile on valid body', async () => {
        const mockProfile = [{ distance: 0, elevation: 100 }, { distance: 1, elevation: 110 }];
        (ElevationService.getElevationProfile as jest.Mock).mockResolvedValueOnce(mockProfile);
        const res = await request(buildApp()).post('/elevation/profile').send(validElevationBody);
        expect(res.status).toBe(200);
        expect(res.body.profile).toEqual(mockProfile);
    });

    it('returns 400 on invalid body (missing start)', async () => {
        const res = await request(buildApp()).post('/elevation/profile')
            .send({ end: validElevationBody.end, steps: 10 });
        expect(res.status).toBe(400);
    });

    it('returns 500 when ElevationService throws', async () => {
        (ElevationService.getElevationProfile as jest.Mock).mockRejectedValueOnce(new Error('elevation error'));
        const res = await request(buildApp()).post('/elevation/profile').send(validElevationBody);
        expect(res.status).toBe(500);
        expect(res.body.error).toContain('elevation error');
    });

    it('returns 500 with string error when non-Error is thrown', async () => {
        (ElevationService.getElevationProfile as jest.Mock).mockRejectedValueOnce('string elevation error');
        const res = await request(buildApp()).post('/elevation/profile').send(validElevationBody);
        expect(res.status).toBe(500);
        expect(res.body.error).toBe('string elevation error');
    });
});

describe('POST /analyze-pad', () => {
    beforeEach(() => jest.clearAllMocks());

    const validPadBody = {
        polygon: '[[0,0],[1,0],[1,1],[0,0]]',
        target_z: 100
    };

    it('returns 200 with result on valid body', async () => {
        const mockResult = { volume_cut: 100, volume_fill: 50, net_volume: 50, cut_area: 200, fill_area: 100, balance_factor: 2.0 };
        (analyzePad as jest.Mock).mockResolvedValueOnce(mockResult);
        const res = await request(buildApp()).post('/analyze-pad').send(validPadBody);
        expect(res.status).toBe(200);
        expect(res.body).toEqual(mockResult);
    });

    it('returns 400 on invalid body (missing polygon)', async () => {
        const res = await request(buildApp()).post('/analyze-pad').send({ target_z: 100 });
        expect(res.status).toBe(400);
    });

    it('returns 500 when analyzePad throws', async () => {
        (analyzePad as jest.Mock).mockRejectedValueOnce(new Error('pad error'));
        const res = await request(buildApp()).post('/analyze-pad').send(validPadBody);
        expect(res.status).toBe(500);
        expect(res.body.error).toContain('pad error');
    });

    it('returns 500 with string error when non-Error is thrown', async () => {
        (analyzePad as jest.Mock).mockRejectedValueOnce('string pad error');
        const res = await request(buildApp()).post('/analyze-pad').send(validPadBody);
        expect(res.status).toBe(500);
        expect(res.body.error).toBe('string pad error');
    });
});
