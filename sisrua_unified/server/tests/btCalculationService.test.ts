import { BtCalculationService, BT_CALCULATION_VERSION } from '../services/btCalculationService';
import { BtCalculationRequest } from '../schemas/btSchema';

// Helper to build a minimal valid request
function makeRequest(overrides: Partial<BtCalculationRequest> = {}): BtCalculationRequest {
    return {
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
                            type: 'residential',
                            readingMode: 'auto',
                        },
                    ],
                },
                {
                    id: 'P2',
                    label: 'Poste 2',
                    distanceFromTransformerM: 100,
                    conductorCrossSectionMm2: 16,
                    consumers: [
                        {
                            id: 'C2',
                            label: 'Res 2',
                            powerKw: 3,
                            type: 'residential',
                            readingMode: 'manual',
                        },
                    ],
                },
            ],
        },
        settings: {
            demandFactor: 1.0,
            powerFactor: 0.92,
            safetyMargin: 0.0,
        },
        constants: {
            conductorResistivityOhmPerKmPerMm2: 18.1,
            maxVoltageDropPercent: 7.0,
            transformerRatedKva: 75,
            transformerEfficiency: 0.97,
        },
        mode: 'standard',
        ...overrides,
    };
}

describe('BtCalculationService', () => {
    // ── deriveConsumerDemand ──────────────────────────────────────────────────

    describe('deriveConsumerDemand', () => {
        it('returns powerKw directly for auto reading mode', () => {
            const consumer = {
                id: 'c1', label: 'c', powerKw: 5,
                type: 'residential' as const, readingMode: 'auto' as const,
            };
            expect(BtCalculationService.deriveConsumerDemand(consumer, 1.0)).toBeCloseTo(5, 5);
        });

        it('applies demand factor', () => {
            const consumer = {
                id: 'c1', label: 'c', powerKw: 10,
                type: 'residential' as const, readingMode: 'manual' as const,
            };
            expect(BtCalculationService.deriveConsumerDemand(consumer, 0.5)).toBeCloseTo(5, 5);
        });

        it('converts monthly kWh to kW demand for estimated mode', () => {
            // 720 kWh / (30*24h) = 1 kW average, × 1.5 DMDI factor = 1.5 kW
            const consumer = {
                id: 'c1', label: 'c', powerKw: 0,
                type: 'residential' as const, readingMode: 'estimated' as const,
                readingKwh: 720,
            };
            expect(BtCalculationService.deriveConsumerDemand(consumer, 1.0)).toBeCloseTo(1.5, 5);
        });

        it('falls back to powerKw when readingKwh missing in estimated mode', () => {
            const consumer = {
                id: 'c1', label: 'c', powerKw: 4,
                type: 'residential' as const, readingMode: 'estimated' as const,
            };
            expect(BtCalculationService.deriveConsumerDemand(consumer, 1.0)).toBeCloseTo(4, 5);
        });
    });

    // ── computeDmdi ───────────────────────────────────────────────────────────

    describe('computeDmdi', () => {
        it('applies DMDI peak factor to non-estimated consumers', () => {
            const consumer = {
                id: 'c1', label: 'c', powerKw: 2,
                type: 'residential' as const, readingMode: 'auto' as const,
            };
            expect(BtCalculationService.computeDmdi(consumer, 1.0)).toBeCloseTo(3.0, 5);
        });

        it('computes DMDI correctly for estimated mode', () => {
            // 720 kWh → 1 kW avg → × 1.5 DMDI = 1.5 kW DMDI (× demand factor)
            const consumer = {
                id: 'c1', label: 'c', powerKw: 0,
                type: 'residential' as const, readingMode: 'estimated' as const,
                readingKwh: 720,
            };
            expect(BtCalculationService.computeDmdi(consumer, 1.0)).toBeCloseTo(1.5, 5);
        });
    });

    // ── voltageDropPercent ────────────────────────────────────────────────────

    describe('voltageDropPercent', () => {
        it('returns 0 when distance is 0', () => {
            expect(
                BtCalculationService.voltageDropPercent(5, 0, 220, 16, 0.92, 18.1),
            ).toBe(0);
        });

        it('returns 0 when voltage is 0', () => {
            expect(
                BtCalculationService.voltageDropPercent(5, 100, 0, 16, 0.92, 18.1),
            ).toBe(0);
        });

        it('returns positive drop for valid inputs', () => {
            const drop = BtCalculationService.voltageDropPercent(5, 100, 220, 16, 0.92, 18.1);
            expect(drop).toBeGreaterThan(0);
        });

        it('increases with distance', () => {
            const drop50 = BtCalculationService.voltageDropPercent(5, 50, 220, 16, 0.92, 18.1);
            const drop100 = BtCalculationService.voltageDropPercent(5, 100, 220, 16, 0.92, 18.1);
            expect(drop100).toBeGreaterThan(drop50);
        });

        it('decreases with larger conductor section', () => {
            const drop16 = BtCalculationService.voltageDropPercent(5, 100, 220, 16, 0.92, 18.1);
            const drop35 = BtCalculationService.voltageDropPercent(5, 100, 220, 35, 0.92, 18.1);
            expect(drop35).toBeLessThan(drop16);
        });
    });

    // ── sectionCurrentA ───────────────────────────────────────────────────────

    describe('sectionCurrentA', () => {
        it('computes current correctly', () => {
            // I = (5kW × 1000) / (220V × 0.92) ≈ 24.72 A
            const current = BtCalculationService.sectionCurrentA(5, 220, 0.92);
            expect(current).toBeCloseTo(24.72, 1);
        });

        it('returns 0 for zero voltage', () => {
            expect(BtCalculationService.sectionCurrentA(5, 0, 0.92)).toBe(0);
        });

        it('returns 0 for zero power factor', () => {
            expect(BtCalculationService.sectionCurrentA(5, 220, 0)).toBe(0);
        });
    });

    // ── computeAccumulatedByPole ──────────────────────────────────────────────

    describe('computeAccumulatedByPole', () => {
        it('accumulates demand pole-by-pole', () => {
            const req = makeRequest();
            const acc = BtCalculationService.computeAccumulatedByPole(req);

            expect(acc).toHaveLength(2);
            expect(acc[0].localDemandKw).toBeCloseTo(2, 5);
            expect(acc[0].accumulatedDemandKw).toBeCloseTo(2, 5);
            expect(acc[1].localDemandKw).toBeCloseTo(3, 5);
            expect(acc[1].accumulatedDemandKw).toBeCloseTo(5, 5);
        });

        it('marks poles exceeding voltage drop limit', () => {
            const req = makeRequest();
            // Inject a topology with very high demand to breach the limit
            (req.constants as any).maxVoltageDropPercent = 0.0001;
            const acc = BtCalculationService.computeAccumulatedByPole(req);
            expect(acc.some((p) => !p.withinLimit)).toBe(true);
        });

        it('sets withinLimit true when drop is below threshold', () => {
            const req = makeRequest();
            // Tiny demand → very small drop
            req.topology.poles[0].consumers[0].powerKw = 0.001;
            req.topology.poles[1].consumers[0].powerKw = 0.001;
            const acc = BtCalculationService.computeAccumulatedByPole(req);
            expect(acc.every((p) => p.withinLimit)).toBe(true);
        });
    });

    // ── computeSectioningImpact ───────────────────────────────────────────────

    describe('computeSectioningImpact', () => {
        it('returns empty array when no sectioning points', () => {
            const req = makeRequest();
            expect(BtCalculationService.computeSectioningImpact(req)).toHaveLength(0);
        });

        it('computes upstream and downstream demand correctly', () => {
            const req = makeRequest({
                topology: {
                    ...makeRequest().topology,
                    sectioningPoints: ['P2'],
                },
            });
            const impact = BtCalculationService.computeSectioningImpact(req);

            expect(impact).toHaveLength(1);
            expect(impact[0].sectioningPointId).toBe('P2');
            // P2 is the sectioning point: upstream = P1 (2 kW), downstream = P2 (3 kW)
            expect(impact[0].demandUpstreamKw).toBeCloseTo(2, 5);
            expect(impact[0].demandDownstreamKw).toBeCloseTo(3, 5);
            expect(impact[0].affectedPoleIds).toEqual(['P2']);
            expect(impact[0].affectedConsumers).toBe(1);
        });

        it('returns zeroed impact for unknown sectioning point id', () => {
            const req = makeRequest({
                topology: {
                    ...makeRequest().topology,
                    sectioningPoints: ['UNKNOWN'],
                },
            });
            const impact = BtCalculationService.computeSectioningImpact(req);
            expect(impact[0].demandUpstreamKw).toBe(0);
            expect(impact[0].demandDownstreamKw).toBe(0);
        });
    });

    // ── computeDerivedReadings ────────────────────────────────────────────────

    describe('computeDerivedReadings', () => {
        it('returns one reading per consumer', () => {
            const req = makeRequest();
            const readings = BtCalculationService.computeDerivedReadings(req);
            expect(readings).toHaveLength(2);
        });

        it('preserves pole and consumer ids', () => {
            const req = makeRequest();
            const readings = BtCalculationService.computeDerivedReadings(req);
            expect(readings[0].poleId).toBe('P1');
            expect(readings[0].consumerId).toBe('C1');
        });

        it('carries reading mode through', () => {
            const req = makeRequest();
            const readings = BtCalculationService.computeDerivedReadings(req);
            expect(readings[0].readingMode).toBe('auto');
            expect(readings[1].readingMode).toBe('manual');
        });
    });

    // ── calculate (full integration) ──────────────────────────────────────────

    describe('calculate', () => {
        it('returns versioned response', () => {
            const req = makeRequest();
            const res = BtCalculationService.calculate(req);
            expect(res.version).toBe(BT_CALCULATION_VERSION);
            expect(res.summary.version).toBe(BT_CALCULATION_VERSION);
        });

        it('summary aggregates consumers correctly', () => {
            const req = makeRequest();
            const res = BtCalculationService.calculate(req);
            expect(res.summary.totalConsumers).toBe(2);
            expect(res.summary.totalClandestine).toBe(0);
        });

        it('counts clandestine consumers', () => {
            const req = makeRequest();
            req.topology.poles[0].consumers[0].type = 'clandestine';
            const res = BtCalculationService.calculate(req);
            expect(res.summary.totalClandestine).toBe(1);
        });

        it('returns all response sections', () => {
            const req = makeRequest();
            const res = BtCalculationService.calculate(req);
            expect(res).toHaveProperty('summary');
            expect(res).toHaveProperty('accumulatedByPole');
            expect(res).toHaveProperty('estimatedByTransformer');
            expect(res).toHaveProperty('sectioningImpact');
            expect(res).toHaveProperty('derivedReadings');
        });

        it('transformer load increases with higher demand', () => {
            const lowReq = makeRequest();
            const highReq = makeRequest();
            highReq.topology.poles[0].consumers[0].powerKw = 50;
            highReq.topology.poles[1].consumers[0].powerKw = 50;

            const low = BtCalculationService.calculate(lowReq);
            const high = BtCalculationService.calculate(highReq);
            expect(high.summary.transformerLoadPercent).toBeGreaterThan(
                low.summary.transformerLoadPercent,
            );
        });

        it('handles single-pole topology', () => {
            const req = makeRequest();
            req.topology.poles = [req.topology.poles[0]];
            const res = BtCalculationService.calculate(req);
            expect(res.accumulatedByPole).toHaveLength(1);
            expect(res.summary.totalConsumers).toBe(1);
        });

        it('handles pole with no consumers', () => {
            const req = makeRequest();
            req.topology.poles[0].consumers = [];
            const res = BtCalculationService.calculate(req);
            expect(res.accumulatedByPole[0].localDemandKw).toBe(0);
        });

        it('demand factor 0 produces zero demand', () => {
            const req = makeRequest();
            req.settings.demandFactor = 0;
            const res = BtCalculationService.calculate(req);
            expect(res.summary.totalDemandKw).toBe(0);
        });

        it('safety margin increases estimated transformer demand', () => {
            const req0 = makeRequest();
            const req5 = makeRequest();
            req5.settings.safetyMargin = 0.1;
            const res0 = BtCalculationService.calculate(req0);
            const res5 = BtCalculationService.calculate(req5);
            expect(res5.estimatedByTransformer.demandKw).toBeGreaterThan(
                res0.estimatedByTransformer.demandKw,
            );
        });
    });
});
