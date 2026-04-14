import posthog from 'posthog-js';

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY || 'placeholder_key';
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://app.posthog.com';

/**
 * Initializes PostHog for client-side tracking.
 * Only initializes if a key is provided and not in development mode (optional).
 */
export const initAnalytics = () => {
    if (POSTHOG_KEY && POSTHOG_KEY !== 'placeholder_key') {
        posthog.init(POSTHOG_KEY, {
            api_host: POSTHOG_HOST,
            autocapture: true, // Automatically capture clicks and pageviews
            persistence: 'localStorage'
        });
    } else {
        console.info('PostHog Analytics: Placeholder key detected. Tracking disabled.');
    }
};

/**
 * Tracks a custom event.
 * @param eventName Name of the event to track
 * @param properties Additional context for the event
 */
export const trackEvent = (eventName: string, properties?: Record<string, any>) => {
    if (posthog.__loaded) {
        posthog.capture(eventName, properties);
    }
};

/**
 * Specifically track DXF generation success/failure.
 */
export const trackDxfGeneration = (mode: string, success: boolean, durationMs?: number, error?: string) => {
    trackEvent('dxf_generation', {
        mode,
        success,
        duration_ms: durationMs,
        error_message: error
    });
};
