import React from "react";

type HealthStatus = "online" | "degraded" | "offline";

type HealthState = {
  status: HealthStatus;
  checkedAt: Date | null;
  responseTimeMs: number | null;
};

type BackendHealthPayload = {
  status?: string;
};

const DEFAULT_POLL_INTERVAL_MS = 30000;
const REQUEST_TIMEOUT_MS = 5000;

export function useBackendHealth(pollIntervalMs = DEFAULT_POLL_INTERVAL_MS) {
  const [state, setState] = React.useState<HealthState>({
    status: "offline",
    checkedAt: null,
    responseTimeMs: null,
  });

  React.useEffect(() => {
    let cancelled = false;

    const checkHealth = async () => {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(
        () => controller.abort(),
        REQUEST_TIMEOUT_MS,
      );
      const startedAt = performance.now();

      try {
        const response = await fetch("/health", {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
          headers: {
            Accept: "application/json",
          },
        });

        const duration = Math.round(performance.now() - startedAt);

        if (!response.ok) {
          if (!cancelled) {
            setState({
              status: "offline",
              checkedAt: new Date(),
              responseTimeMs: duration,
            });
          }
          return;
        }

        const data = (await response.json()) as BackendHealthPayload;
        const normalizedStatus: HealthStatus =
          data.status === "online"
            ? "online"
            : data.status === "degraded"
              ? "degraded"
              : "offline";

        if (!cancelled) {
          setState({
            status: normalizedStatus,
            checkedAt: new Date(),
            responseTimeMs: duration,
          });
        }
      } catch {
        if (!cancelled) {
          setState((prev) => ({
            status: "offline",
            checkedAt: new Date(),
            responseTimeMs: prev.responseTimeMs,
          }));
        }
      } finally {
        window.clearTimeout(timeoutId);
      }
    };

    void checkHealth();
    const intervalId = window.setInterval(() => {
      void checkHealth();
    }, pollIntervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [pollIntervalMs]);

  return state;
}

export type { HealthStatus };
