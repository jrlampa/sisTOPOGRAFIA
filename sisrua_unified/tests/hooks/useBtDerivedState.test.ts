import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useBtDerivedState } from '../../src/hooks/useBtDerivedState';

// Mock the service module
vi.mock('../../src/services/btService', () => ({
    calculateBtTopology: vi.fn(),
}));

import { calculateBtTopology } from '../../src/services/btService';

const mockCalculate = calculateBtTopology as ReturnType<typeof vi.fn>;

const mockTopology = {
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
                    id: 'C1', label: 'Res 1', powerKw: 2,
                    type: 'residential' as const,
                    readingMode: 'auto' as const,
                },
            ],
        },
    ],
};

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
            poleId: 'P1', label: 'Poste 1',
            localDemandKw: 2, accumulatedDemandKw: 2,
            voltageDropPercent: 0.5, currentA: 9.88, withinLimit: true,
        },
    ],
    estimatedByTransformer: { demandKw: 2, demandKva: 2.19, currentA: 9.88, loadPercent: 2.92 },
    sectioningImpact: [],
    derivedReadings: [
        { consumerId: 'C1', poleId: 'P1', derivedDemandKw: 2, readingMode: 'auto' as const, dmdi: 3 },
    ],
};

describe('useBtDerivedState', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('initialises with null result and no error', () => {
        const { result } = renderHook(() => useBtDerivedState());

        expect(result.current.result).toBeNull();
        expect(result.current.error).toBeNull();
        expect(result.current.isCalculating).toBe(false);
    });

    it('sets isCalculating to true while request is in flight', async () => {
        let resolveCalc!: (value: unknown) => void;
        mockCalculate.mockReturnValueOnce(new Promise((r) => { resolveCalc = r; }));

        const { result } = renderHook(() => useBtDerivedState());

        act(() => {
            result.current.calculate(mockTopology);
        });

        expect(result.current.isCalculating).toBe(true);

        await act(async () => {
            resolveCalc(mockResponse);
        });

        expect(result.current.isCalculating).toBe(false);
    });

    it('stores result on successful calculation', async () => {
        mockCalculate.mockResolvedValueOnce(mockResponse);

        const { result } = renderHook(() => useBtDerivedState());

        await act(async () => {
            await result.current.calculate(mockTopology);
        });

        await waitFor(() => {
            expect(result.current.result).not.toBeNull();
        });

        expect(result.current.result?.version).toBe('v1');
        expect(result.current.result?.summary.totalConsumers).toBe(1);
        expect(result.current.error).toBeNull();
    });

    it('stores error message on failed calculation', async () => {
        mockCalculate.mockRejectedValueOnce(new Error('BT service unavailable'));

        const { result } = renderHook(() => useBtDerivedState());

        await act(async () => {
            await result.current.calculate(mockTopology);
        });

        await waitFor(() => {
            expect(result.current.error).toBe('BT service unavailable');
        });

        expect(result.current.result).toBeNull();
        expect(result.current.isCalculating).toBe(false);
    });

    it('handles non-Error rejection gracefully', async () => {
        mockCalculate.mockRejectedValueOnce('string rejection');

        const { result } = renderHook(() => useBtDerivedState());

        await act(async () => {
            await result.current.calculate(mockTopology);
        });

        await waitFor(() => {
            expect(result.current.error).toBe('BT calculation failed');
        });
    });

    it('reset clears result and error', async () => {
        mockCalculate.mockResolvedValueOnce(mockResponse);

        const { result } = renderHook(() => useBtDerivedState());

        await act(async () => {
            await result.current.calculate(mockTopology);
        });

        act(() => {
            result.current.reset();
        });

        expect(result.current.result).toBeNull();
        expect(result.current.error).toBeNull();
    });

    it('passes settings and constants to service', async () => {
        mockCalculate.mockResolvedValueOnce(mockResponse);

        const options = {
            settings: { demandFactor: 0.8 },
            constants: { transformerRatedKva: 100 },
            mode: 'full' as const,
        };

        const { result } = renderHook(() => useBtDerivedState(options));

        await act(async () => {
            await result.current.calculate(mockTopology);
        });

        expect(mockCalculate).toHaveBeenCalledWith(
            expect.objectContaining({
                topology: mockTopology,
                settings: options.settings,
                constants: options.constants,
                mode: 'full',
            }),
        );
    });

    it('clears previous error on new calculation', async () => {
        mockCalculate
            .mockRejectedValueOnce(new Error('first error'))
            .mockResolvedValueOnce(mockResponse);

        const { result } = renderHook(() => useBtDerivedState());

        // First call fails
        await act(async () => {
            await result.current.calculate(mockTopology);
        });
        expect(result.current.error).toBe('first error');

        // Second call succeeds
        await act(async () => {
            await result.current.calculate(mockTopology);
        });

        await waitFor(() => {
            expect(result.current.error).toBeNull();
            expect(result.current.result).not.toBeNull();
        });
    });
});
