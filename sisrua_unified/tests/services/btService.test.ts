import { afterEach, describe, expect, it, vi } from 'vitest';
import { calculateBtTopology } from '../../src/services/btService';

const mockResponse = {
    version: 'v1',
    summary: {
        version: 'v1',
        totalConsumers: 1,
        totalClandestine: 0,
        totalDemandKw: 2,
        totalDemandKva: 2.19,
        maxVoltageDropPercent: 0.5,
        transformerLoadPercent: 2.92,
        withinVoltageDropLimit: true,
    },
    accumulatedByPole: [
        {
            poleId: 'P1',
            label: 'Poste 1',
            localDemandKw: 2,
            accumulatedDemandKw: 2,
            voltageDropPercent: 0.5,
            currentA: 9.88,
            withinLimit: true,
        },
    ],
    estimatedByTransformer: {
        demandKw: 2,
        demandKva: 2.19,
        currentA: 9.88,
        loadPercent: 2.92,
    },
    sectioningImpact: [],
    derivedReadings: [
        {
            consumerId: 'C1',
            poleId: 'P1',
            derivedDemandKw: 2,
            readingMode: 'auto',
            dmdi: 3,
        },
    ],
};

const minimalRequest = {
    topology: {
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
                        label: 'Res 1',
                        powerKw: 2,
                        type: 'residential' as const,
                        readingMode: 'auto' as const,
                    },
                ],
            },
        ],
    },
};

describe('btService – calculateBtTopology', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns parsed BtCalculationResponse on success', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
            new Response(JSON.stringify(mockResponse), {
                status: 200,
                headers: { 'content-type': 'application/json' },
            }),
        );

        const result = await calculateBtTopology(minimalRequest);

        expect(result.version).toBe('v1');
        expect(result.summary.totalConsumers).toBe(1);
        expect(result.accumulatedByPole).toHaveLength(1);
        expect(result.estimatedByTransformer.demandKw).toBe(2);
    });

    it('throws with backend error message on 400', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
            new Response(
                JSON.stringify({ error: 'Invalid BT calculation request', details: 'poles missing' }),
                { status: 400, headers: { 'content-type': 'application/json' } },
            ),
        );

        await expect(calculateBtTopology(minimalRequest)).rejects.toThrow('poles missing');
    });

    it('throws with generic message on 500 with empty body', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
            new Response('', {
                status: 500,
                headers: { 'content-type': 'application/json' },
            }),
        );

        await expect(calculateBtTopology(minimalRequest)).rejects.toThrow('empty response');
    });

    it('throws on non-JSON response body', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
            new Response('bad gateway', {
                status: 502,
                headers: { 'content-type': 'text/html' },
            }),
        );

        await expect(calculateBtTopology(minimalRequest)).rejects.toThrow('invalid JSON');
    });

    it('posts to /api/bt/calculate endpoint', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
            new Response(JSON.stringify(mockResponse), {
                status: 200,
                headers: { 'content-type': 'application/json' },
            }),
        );

        await calculateBtTopology(minimalRequest);

        expect(fetchSpy).toHaveBeenCalledWith(
            expect.stringContaining('/bt/calculate'),
            expect.objectContaining({ method: 'POST' }),
        );
    });

    it('sends topology data in request body', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
            new Response(JSON.stringify(mockResponse), {
                status: 200,
                headers: { 'content-type': 'application/json' },
            }),
        );

        await calculateBtTopology(minimalRequest);

        const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
        expect(body.topology.transformerId).toBe('TR-001');
    });
});
