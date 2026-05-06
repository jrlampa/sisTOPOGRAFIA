import type { APIRequestContext, APIResponse } from "@playwright/test";

export function buildMetricsHeaders(metricsToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${metricsToken}`,
  };
}

export function normalizeHealthForSnapshot(body: Record<string, unknown>) {
  const dependencies = (body.dependencies ?? {}) as Record<string, unknown>;
  const config = (body.config ?? {}) as Record<string, unknown>;
  const constantsCatalog =
    (config.constantsCatalog as Record<string, unknown> | undefined) ?? {};
  const system = (body.system ?? {}) as Record<string, unknown>;

  return {
    status: body.status,
    service: body.service,
    dependencyKeys: Object.keys(dependencies).sort(),
    configEnvironment:
      typeof config.environment === "string" ? config.environment : null,
    constantsCatalogNamespaces:
      constantsCatalog.enabledNamespaces ?? null,
    queueBackendType: typeof dependencies.queueBackend,
    queueBackendAllowed: ["local-async", "supabase-postgres"].includes(
      String(dependencies.queueBackend),
    ),
    hasExternalApiSection: typeof dependencies.externalApis === "object",
    systemKeys: Object.keys(system).sort(),
  };
}

export interface OptionalTokenRequestResult<T = unknown> {
  response: APIResponse;
  body: T;
  usedToken: boolean;
}

export async function getJsonWithOptionalToken<T = unknown>(
  request: APIRequestContext,
  url: string,
  options: {
    headerName: string;
    token?: string;
    expectedUnauthorizedStatus?: number;
  },
): Promise<OptionalTokenRequestResult<T>> {
  const unauthorizedStatus = options.expectedUnauthorizedStatus ?? 401;
  const response = await request.get(url);

  if (response.status() !== unauthorizedStatus) {
    return {
      response,
      body: (await response.json()) as T,
      usedToken: false,
    };
  }

  if (!options.token) {
    return {
      response,
      body: {} as T,
      usedToken: false,
    };
  }

  const withToken = await request.get(url, {
    headers: {
      [options.headerName]: options.token,
    },
  });

  return {
    response: withToken,
    body: (await withToken.json()) as T,
    usedToken: true,
  };
}
