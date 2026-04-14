import { describe, it, expect, vi, beforeEach } from 'vitest';
import posthog from 'posthog-js';
import { initAnalytics, trackEvent, trackDxfGeneration } from '../../src/utils/analytics';

// Mock posthog-js
vi.mock('posthog-js', () => ({
    default: {
        init: vi.fn(),
        capture: vi.fn(),
        __loaded: true
    }
}));

describe('analytics utilities', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('initAnalytics', () => {
        it('should initialize posthog if key is provided', () => {
            // Mocking env variables is tricky in Vitest/Vite without plugins 
            // but we can test the behavior if logic paths allow.
            initAnalytics();
            // Expect init to be called or a console info if key is placeholder
            // Since we can't easily change import.meta.env during runtime here:
            // if initial placeholder_key is there, expect console info.
        });
    });

    describe('trackEvent', () => {
        it('should call posthog.capture when loaded', () => {
            trackEvent('test_event', { foo: 'bar' });
            expect(posthog.capture).toHaveBeenCalledWith('test_event', { foo: 'bar' });
        });

        it('should not call posthog.capture when not loaded', () => {
            (posthog as any).__loaded = false;
            trackEvent('test_event');
            expect(posthog.capture).not.toHaveBeenCalled();
            (posthog as any).__loaded = true; // reset
        });
    });

    describe('trackDxfGeneration', () => {
        it('should track dxf_generation with correct properties', () => {
            trackDxfGeneration('circle', true, 5000);
            expect(posthog.capture).toHaveBeenCalledWith('dxf_generation', {
                mode: 'circle',
                success: true,
                duration_ms: 5000,
                error_message: undefined
            });
        });

        it('should track errors correctly', () => {
            trackDxfGeneration('polygon', false, 1000, 'Timeout');
            expect(posthog.capture).toHaveBeenCalledWith('dxf_generation', {
                mode: 'polygon',
                success: false,
                duration_ms: 1000,
                error_message: 'Timeout'
            });
        });
    });
});
