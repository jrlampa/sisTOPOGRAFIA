import request from 'supertest';
import express from 'express';
import btRoutes from '../routes/btRoutes';

// Mock logger
jest.mock('../utils/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    },
}));

function buildApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/bt', btRoutes);
    return app;
}

const minimalTopology = {
    transformerId: 'TR-001',
    nominalVoltageV: 220,
    poles: [
        {
            id: 'P1',
            label: 'Poste 1',
            distanceFromTransformerM: 50,
            conductorCrossSectionMm2: 16,
            consumers: [
                {
                    id: 'C1',
                    label: 'Residência 1',
                    powerKw: 2,
                    type: 'residential',
                    readingMode: 'auto',
                },
            ],
        },
    ],
};

describe('POST /api/bt/calculate', () => {
    let app: express.Application;

    beforeAll(() => {
        app = buildApp();
    });

    // ── Happy path ────────────────────────────────────────────────────────────

    it('returns 200 with a versioned response for valid request', async () => {
        const res = await request(app)
            .post('/api/bt/calculate')
            .send({ topology: minimalTopology });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('version');
        expect(res.body).toHaveProperty('summary');
        expect(res.body).toHaveProperty('accumulatedByPole');
        expect(res.body).toHaveProperty('estimatedByTransformer');
        expect(res.body).toHaveProperty('sectioningImpact');
        expect(res.body).toHaveProperty('derivedReadings');
    });

    it('summary has expected numeric fields', async () => {
        const res = await request(app)
            .post('/api/bt/calculate')
            .send({ topology: minimalTopology });

        const { summary } = res.body;
        expect(typeof summary.totalConsumers).toBe('number');
        expect(typeof summary.totalDemandKw).toBe('number');
        expect(typeof summary.totalDemandKva).toBe('number');
        expect(typeof summary.maxVoltageDropPercent).toBe('number');
        expect(typeof summary.transformerLoadPercent).toBe('number');
        expect(typeof summary.withinVoltageDropLimit).toBe('boolean');
    });

    it('accumulatedByPole contains one entry per pole', async () => {
        const topology = {
            ...minimalTopology,
            poles: [
                ...minimalTopology.poles,
                {
                    id: 'P2', label: 'Poste 2',
                    distanceFromTransformerM: 100,
                    conductorCrossSectionMm2: 16,
                    consumers: [{ id: 'C2', label: 'Res 2', powerKw: 3, type: 'residential', readingMode: 'manual' }],
                },
            ],
        };

        const res = await request(app)
            .post('/api/bt/calculate')
            .send({ topology });

        expect(res.status).toBe(200);
        expect(res.body.accumulatedByPole).toHaveLength(2);
    });

    it('uses default settings when not provided', async () => {
        const res = await request(app)
            .post('/api/bt/calculate')
            .send({ topology: minimalTopology });

        expect(res.status).toBe(200);
        // demand should equal consumer powerKw with default factor=1
        expect(res.body.summary.totalDemandKw).toBeCloseTo(2, 5);
    });

    it('respects custom demand factor', async () => {
        const res = await request(app)
            .post('/api/bt/calculate')
            .send({
                topology: minimalTopology,
                settings: { demandFactor: 0.5 },
            });

        expect(res.status).toBe(200);
        expect(res.body.summary.totalDemandKw).toBeCloseTo(1, 5);
    });

    it('reports sectioning impact when sectioningPoints provided', async () => {
        const topology = {
            ...minimalTopology,
            poles: [
                ...minimalTopology.poles,
                {
                    id: 'P2', label: 'Poste 2',
                    distanceFromTransformerM: 100,
                    conductorCrossSectionMm2: 16,
                    consumers: [{ id: 'C2', label: 'Res 2', powerKw: 3, type: 'residential', readingMode: 'auto' }],
                },
            ],
            sectioningPoints: ['P2'],
        };

        const res = await request(app)
            .post('/api/bt/calculate')
            .send({ topology });

        expect(res.status).toBe(200);
        expect(res.body.sectioningImpact).toHaveLength(1);
        expect(res.body.sectioningImpact[0].sectioningPointId).toBe('P2');
    });

    it('accepts all valid calculation modes', async () => {
        for (const mode of ['standard', 'sectioning', 'clandestine', 'full']) {
            const res = await request(app)
                .post('/api/bt/calculate')
                .send({ topology: minimalTopology, mode });

            expect(res.status).toBe(200);
        }
    });

    // ── Validation errors ─────────────────────────────────────────────────────

    it('returns 400 when topology is missing', async () => {
        const res = await request(app)
            .post('/api/bt/calculate')
            .send({});

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
    });

    it('returns 400 when poles array is empty', async () => {
        const res = await request(app)
            .post('/api/bt/calculate')
            .send({
                topology: { ...minimalTopology, poles: [] },
            });

        expect(res.status).toBe(400);
    });

    it('returns 400 for invalid nominalVoltageV (negative)', async () => {
        const res = await request(app)
            .post('/api/bt/calculate')
            .send({
                topology: { ...minimalTopology, nominalVoltageV: -1 },
            });

        expect(res.status).toBe(400);
    });

    it('returns 400 for unknown mode', async () => {
        const res = await request(app)
            .post('/api/bt/calculate')
            .send({ topology: minimalTopology, mode: 'invalid_mode' });

        expect(res.status).toBe(400);
    });

    it('returns 400 for invalid consumer type', async () => {
        const topology = {
            ...minimalTopology,
            poles: [{
                ...minimalTopology.poles[0],
                consumers: [{
                    ...minimalTopology.poles[0].consumers[0],
                    type: 'robot',
                }],
            }],
        };

        const res = await request(app)
            .post('/api/bt/calculate')
            .send({ topology });

        expect(res.status).toBe(400);
    });

    it('returns 400 for negative powerKw', async () => {
        const topology = {
            ...minimalTopology,
            poles: [{
                ...minimalTopology.poles[0],
                consumers: [{
                    ...minimalTopology.poles[0].consumers[0],
                    powerKw: -5,
                }],
            }],
        };

        const res = await request(app)
            .post('/api/bt/calculate')
            .send({ topology });

        expect(res.status).toBe(400);
    });
});
