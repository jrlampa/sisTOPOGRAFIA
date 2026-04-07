import { dxfRequestSchema } from '../schemas/dxfRequest';

describe('dxfRequestSchema', () => {
    const basePayload = {
        lat: -23.5505,
        lon: -46.6333,
        radius: 300,
        mode: 'circle' as const
    };

    it('accepts a valid request without btContext', () => {
        const parsed = dxfRequestSchema.safeParse(basePayload);
        expect(parsed.success).toBe(true);
    });

    it('accepts a valid request with btContext', () => {
        const payload = {
            ...basePayload,
            btContext: {
                projectType: 'ramais',
                btNetworkScenario: 'proj2',
                clandestinoAreaM2: 0,
                totalTransformers: 1,
                totalPoles: 2,
                totalEdges: 1,
                verifiedTransformers: 1,
                verifiedPoles: 2,
                verifiedEdges: 1,
                cqtComputationInputs: {
                    scenario: 'proj2',
                    dmdi: {
                        clandestinoEnabled: true,
                        aa24DemandBase: 206.99,
                        sumClientsX: 73,
                        ab35LookupDmdi: 2.84
                    }
                },
                accumulatedByPole: [
                    {
                        poleId: 'P-001',
                        title: 'Poste 1',
                        accumulatedClients: 8,
                        accumulatedDemandKva: 22.4
                    }
                ],
                criticalPole: {
                    poleId: 'P-001',
                    title: 'Poste 1',
                    accumulatedClients: 8,
                    accumulatedDemandKva: 22.4
                },
                topology: {
                    poles: [
                        {
                            id: 'P-001',
                            lat: -23.55,
                            lng: -46.63,
                            title: 'Poste 1',
                            verified: true,
                            ramais: [{ id: 'R-1', quantity: 4, ramalType: 'normal' }]
                        },
                        {
                            id: 'P-002',
                            lat: -23.551,
                            lng: -46.631,
                            title: 'Poste 2',
                            verified: true,
                            ramais: []
                        }
                    ],
                    transformers: [
                        {
                            id: 'T-1',
                            poleId: 'P-001',
                            lat: -23.55,
                            lng: -46.63,
                            title: 'Trafo 1',
                            projectPowerKva: 75,
                            demandKw: 36.5,
                            verified: true
                        }
                    ],
                    edges: [
                        {
                            id: 'E-1',
                            fromPoleId: 'P-001',
                            toPoleId: 'P-002',
                            lengthMeters: 32,
                            verified: true,
                            conductors: [{ id: 'C-1', quantity: 1, conductorName: '70 Al - MX' }]
                        }
                    ]
                }
            }
        };

        const parsed = dxfRequestSchema.safeParse(payload);
        expect(parsed.success).toBe(true);
    });

    it('rejects invalid btContext project type', () => {
        const payload = {
            ...basePayload,
            btContext: {
                projectType: 'invalid-type',
                totalTransformers: 1,
                totalPoles: 1,
                totalEdges: 0,
                verifiedTransformers: 1,
                verifiedPoles: 1,
                verifiedEdges: 0,
                accumulatedByPole: []
            }
        };

        const parsed = dxfRequestSchema.safeParse(payload);
        expect(parsed.success).toBe(false);
    });

    it('accepts cqt db inputs without trafosZ (backend fallback)', () => {
        const payload = {
            ...basePayload,
            btContext: {
                projectType: 'ramais',
                totalTransformers: 1,
                totalPoles: 1,
                totalEdges: 0,
                verifiedTransformers: 1,
                verifiedPoles: 1,
                verifiedEdges: 0,
                accumulatedByPole: [],
                cqtComputationInputs: {
                    scenario: 'atual',
                    db: {
                        trAtual: 225,
                        demAtual: 101.9,
                        qtMt: 0.0183
                    }
                }
            }
        };

        const parsed = dxfRequestSchema.safeParse(payload);
        expect(parsed.success).toBe(true);
    });
});
