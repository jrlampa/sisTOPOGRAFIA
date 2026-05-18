import { useState, useEffect } from "react";
import posthog from "posthog-js";

/**
 * Hook to retrieve the active variant for a PostHog A/B test/feature flag.
 * Safely falls back to a default value if PostHog isn't ready or flags fail to load.
 */
export function useABTest(flagKey: string, defaultValue: boolean = false): boolean {
  const [isEnabled, setIsEnabled] = useState<boolean>(() => {
    if (!posthog.__loaded) return defaultValue;
    const val = posthog.getFeatureFlag(flagKey);
    return val === true || val === "test"; // PostHog usually returns boolean or string variant names like 'test'
  });

  useEffect(() => {
    if (!posthog.__loaded) return;
    
    // Register callback for when feature flags are loaded or updated
    posthog.onFeatureFlags(() => {
      const val = posthog.getFeatureFlag(flagKey);
      setIsEnabled(val === true || val === "test");
    });
  }, [flagKey, posthog.__loaded]);

  return isEnabled;
}
