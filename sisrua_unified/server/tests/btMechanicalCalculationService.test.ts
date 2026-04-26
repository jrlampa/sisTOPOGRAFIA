import { describe, it, expect } from '@jest/globals';
import { calculateBtMechanical, calculateBearing } from '../services/btMechanicalCalculationService';
import { BtMechanicalInput } from '../services/bt/btMechanicalTypes';

describe('btMechanicalCalculationService', () => {
    describe('calculateBearing', () => {
        it('calculates 0 for North', () => {
            const bearing = calculateBearing(-22.0, -43.0, -21.0, -43.0);
            expect(bearing).toBeCloseTo(0);
        });

        it('calculates 90 for East', () => {
            const bearing = calculateBearing(-22.0, -43.0, -22.0, -42.999); // Smaller distance
            expect(bearing).toBeCloseTo(90, 0);
        });

        it('calculates 180 for South', () => {
            const bearing = calculateBearing(-22.0, -43.0, -22.001, -43.0);
            expect(bearing).toBeCloseTo(180, 1);
        });

        it('calculates 270 for West', () => {
            const bearing = calculateBearing(-22.0, -43.0, -22.0, -43.001);
            expect(bearing).toBeCloseTo(270, 0);
        });
    });

    describe('calculateBtMechanical', () => {
        it('calculates traction for a single span (end of line)', () => {
            const input: BtMechanicalInput = {
                nodes: [
                    { id: 'P1', lat: -22.8255, lng: -43.3259 },
                    { id: 'P2', lat: -22.8255, lng: -43.3250 } // Roughly West
                ],
                edges: [
                    {
                        id: 'E1',
                        fromNodeId: 'P1',
                        toNodeId: 'P2',
                        conductors: [{ conductorName: '70 Al - MX', quantity: 1 }]
                    }
                ]
            };

            const result = calculateBtMechanical(input);
            const p1 = result.nodeResults.find(n => n.nodeId === 'P1')!;
            
            expect(p1.resultantForceDaN).toBeCloseTo(200);
            expect(p1.overloaded).toBe(false);
        });

        it('calculates near-zero traction for a straight line (balanced)', () => {
            const input: BtMechanicalInput = {
                nodes: [
                    { id: 'P1', lat: -22.8255, lng: -43.3260 },
                    { id: 'P2', lat: -22.8255, lng: -43.3255 },
                    { id: 'P3', lat: -22.8255, lng: -43.3250 }
                ],
                edges: [
                    {
                        id: 'E1',
                        fromNodeId: 'P1',
                        toNodeId: 'P2',
                        conductors: [{ conductorName: '70 Al - MX', quantity: 1 }]
                    },
                    {
                        id: 'E2',
                        fromNodeId: 'P2',
                        toNodeId: 'P3',
                        conductors: [{ conductorName: '70 Al - MX', quantity: 1 }]
                    }
                ]
            };

            const result = calculateBtMechanical(input);
            const p2 = result.nodeResults.find(n => n.nodeId === 'P2')!;
            
            // Resultant should be very small for nearly collinear points
            expect(p2.resultantForceDaN).toBeLessThan(5); 
        });

        it('calculates resultant for 90-degree corner', () => {
            const input: BtMechanicalInput = {
                nodes: [
                    { id: 'P1', lat: -22.8254, lng: -43.3255 }, // North of P2 (-22.8254 > -22.8255)
                    { id: 'P2', lat: -22.8255, lng: -43.3255 }, // Center
                    { id: 'P3', lat: -22.8255, lng: -43.3254 }  // East of P2 (-43.3254 > -43.3255)
                ],
                edges: [
                    {
                        id: 'E1',
                        fromNodeId: 'P2',
                        toNodeId: 'P1',
                        conductors: [{ conductorName: '70 Al - MX', quantity: 1 }]
                    },
                    {
                        id: 'E2',
                        fromNodeId: 'P2',
                        toNodeId: 'P3',
                        conductors: [{ conductorName: '70 Al - MX', quantity: 1 }]
                    }
                ]
            };

            const result = calculateBtMechanical(input);
            const p2 = result.nodeResults.find(n => n.nodeId === 'P2')!;
            
            // Force 200 North (0) + 200 East (90)
            // Magnitude: sqrt(200^2 + 200^2) = 282.84
            // Angle: 45 degrees
            expect(p2.resultantForceDaN).toBeCloseTo(282.84, 0);
            expect(p2.resultantAngleDegrees).toBeCloseTo(45, 0);
        });

        it('detects overload when capacity is exceeded', () => {
            const input: BtMechanicalInput = {
                nodes: [
                    { id: 'P1', lat: -22.0, lng: -43.0, nominalCapacityDaN: 150 },
                    { id: 'P2', lat: -22.0, lng: -42.0 }
                ],
                edges: [
                    {
                        id: 'E1',
                        fromNodeId: 'P1',
                        toNodeId: 'P2',
                        conductors: [{ conductorName: '70 Al - MX', quantity: 1 }] // 200 daN
                    }
                ]
            };

            const result = calculateBtMechanical(input);
            const p1 = result.nodeResults.find(n => n.nodeId === 'P1')!;
            
            expect(p1.resultantForceDaN).toBe(200);
            expect(p1.overloaded).toBe(true);
        });
    });
});
