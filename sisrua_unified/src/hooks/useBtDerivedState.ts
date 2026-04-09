import { useState, useCallback, useRef } from 'react';
import {
    calculateBtTopology,
    BtCalculationRequest,
    BtCalculationResponse,
    BtTopology,
    BtSettings,
    BtConstants,
    BtCalculationMode,
} from '../services/btService';

/**
 * useBtDerivedState
 *
 * Hook that orchestrates BT topology calculation by delegating entirely to the
 * backend service layer.  It manages only:
 *   - request/response lifecycle (loading, error state)
 *   - cached response data for rendering
 *
 * THERE ARE NO ELECTRICAL CALCULATIONS IN THIS FILE.
 * All domain formulas live in server/services/btCalculationService.ts.
 */

export interface UseBtDerivedStateOptions {
    settings?: BtSettings;
    constants?: BtConstants;
    mode?: BtCalculationMode;
}

export interface UseBtDerivedState {
    /** Latest calculation result from the backend. Null before first call. */
    result: BtCalculationResponse | null;
    /** True while an API request is in flight. */
    isCalculating: boolean;
    /** Error message from the last failed request, or null. */
    error: string | null;
    /** Trigger a (re-)calculation for the given topology. */
    calculate: (topology: BtTopology) => Promise<void>;
    /** Reset result and error state. */
    reset: () => void;
}

export function useBtDerivedState(
    options: UseBtDerivedStateOptions = {},
): UseBtDerivedState {
    const [result, setResult] = useState<BtCalculationResponse | null>(null);
    const [isCalculating, setIsCalculating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Keep options in a ref so the `calculate` callback stays stable
    const optionsRef = useRef(options);
    optionsRef.current = options;

    const calculate = useCallback(async (topology: BtTopology) => {
        setIsCalculating(true);
        setError(null);

        const request: BtCalculationRequest = {
            topology,
            settings: optionsRef.current.settings,
            constants: optionsRef.current.constants,
            mode: optionsRef.current.mode,
        };

        try {
            const response = await calculateBtTopology(request);
            setResult(response);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'BT calculation failed';
            setError(message);
        } finally {
            setIsCalculating(false);
        }
    }, []);

    const reset = useCallback(() => {
        setResult(null);
        setError(null);
    }, []);

    return { result, isCalculating, error, calculate, reset };
}
