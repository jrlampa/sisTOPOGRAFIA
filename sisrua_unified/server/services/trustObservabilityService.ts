import { Request, Response } from "express";
import {
  ResultadoJob,
  TipoOperacao,
  registrarEventoKpi,
} from "./businessKpiService.js";
import {
  EtapaFluxoCritico,
  registrarEventoFluxoCritico,
} from "./criticalFlowContractService.js";
import { logger } from "../utils/logger.js";

const DEFAULT_TENANT_ID = "tenant-default";
const RETRABALHO_WINDOW_MS = 20 * 60 * 1000;

interface RouteMapping {
  tipo: TipoOperacao;
  uxEvent: string;
  stage?: EtapaFluxoCritico;
}

interface ReprocessMarker {
  firstSeenAt: number;
  lastSeenAt: number;
  count: number;
}

const markerStore = new Map<string, ReprocessMarker>();

function safeString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function resolveTenantId(req: Request): string {
  const tenantFromHeader = safeString(req.headers["x-tenant-id"]);
  if (tenantFromHeader) {
    return tenantFromHeader.toLowerCase();
  }

  const queryTenant = Array.isArray(req.query.tenantId)
    ? req.query.tenantId[0]
    : req.query.tenantId;
  const tenantFromQuery = safeString(queryTenant);
  if (tenantFromQuery) {
    return tenantFromQuery.toLowerCase();
  }

  return DEFAULT_TENANT_ID;
}

function routeKey(req: Request): string {
  const base = req.baseUrl || "";
  const routePath = req.route?.path ? String(req.route.path) : req.path;
  const collapsed = `${base}${routePath}`.replace(/\/+/g, "/");
  return collapsed.endsWith("/") && collapsed.length > 1
    ? collapsed.slice(0, -1)
    : collapsed;
}

function mapRoute(req: Request): RouteMapping | null {
  if (req.method !== "POST") {
    return null;
  }

  const key = routeKey(req);
  if (key === "/api/analyze") {
    return {
      tipo: "analise_rede",
      uxEvent: "ux_fluxo_analise_solicitada",
      stage: "projeto",
    };
  }

  if (key === "/api/bt/calculate") {
    return {
      tipo: "calculo_bt",
      uxEvent: "ux_fluxo_calculo_bt_executado",
      stage: "persistido",
    };
  }

  if (key === "/api/dxf") {
    return {
      tipo: "exportacao_dxf",
      uxEvent: "ux_fluxo_dxf_disparado",
      stage: "snapshot",
    };
  }

  return null;
}

function buildMarkerKey(
  tenantId: string,
  tipo: TipoOperacao,
  operationId?: string,
  projetoId?: string,
  pontoId?: string,
): string {
  return [
    tenantId,
    tipo,
    operationId || "sem-operacao",
    projetoId || "sem-projeto",
    pontoId || "sem-ponto",
  ].join("::");
}

function classifyResult(
  tenantId: string,
  tipo: TipoOperacao,
  statusCode: number,
  operationId?: string,
  projetoId?: string,
  pontoId?: string,
): ResultadoJob {
  if (statusCode >= 400) {
    return "falha";
  }

  const now = Date.now();
  const markerKey = buildMarkerKey(
    tenantId,
    tipo,
    operationId,
    projetoId,
    pontoId,
  );
  const marker = markerStore.get(markerKey);

  if (!marker) {
    markerStore.set(markerKey, {
      firstSeenAt: now,
      lastSeenAt: now,
      count: 1,
    });
    return "sucesso";
  }

  marker.count += 1;
  marker.lastSeenAt = now;
  if (now - marker.firstSeenAt <= RETRABALHO_WINDOW_MS) {
    return "retrabalho";
  }

  marker.firstSeenAt = now;
  return "sucesso";
}

function ensureCriticalFlowContext(
  tenantId: string,
  projetoId?: string,
  pontoId?: string,
  metadados?: Record<string, unknown>,
): void {
  if (!projetoId) {
    return;
  }

  const basePayload = {
    tenantId,
    projetoId,
    metadados,
    ocorridoEm: new Date(),
  };

  registrarEventoFluxoCritico({
    ...basePayload,
    etapa: "projeto",
  });

  if (pontoId) {
    registrarEventoFluxoCritico({
      ...basePayload,
      etapa: "ponto",
      pontoId,
    });
  }
}

function safeRecordCriticalStage(
  tenantId: string,
  stage: EtapaFluxoCritico,
  projetoId?: string,
  pontoId?: string,
  metadados?: Record<string, unknown>,
): void {
  if (!projetoId) {
    return;
  }

  try {
    ensureCriticalFlowContext(tenantId, projetoId, pontoId, metadados);

    if (stage === "persistido" || stage === "snapshot") {
      if (!pontoId) {
        return;
      }

      registrarEventoFluxoCritico({
        tenantId,
        projetoId,
        pontoId,
        etapa: "persistido",
        metadados,
        ocorridoEm: new Date(),
      });
    }

    if (stage === "snapshot") {
      if (!pontoId) {
        return;
      }

      registrarEventoFluxoCritico({
        tenantId,
        projetoId,
        pontoId,
        etapa: "snapshot",
        metadados,
        ocorridoEm: new Date(),
      });
    }
  } catch (err) {
    logger.warn("Falha ao registrar estágio de fluxo crítico", {
      tenantId,
      projetoId,
      pontoId,
      stage,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export function trackTrustObservability(
  req: Request,
  res: Response,
  durationMs: number,
): void {
  const mapping = mapRoute(req);
  if (!mapping) {
    return;
  }

  const tenantId = resolveTenantId(req);
  const projetoId = safeString(res.locals.projeto_id);
  const pontoId = safeString(res.locals.ponto_id);
  const operationId = safeString(res.locals.operation_id);
  const durationSafeMs =
    Number.isFinite(durationMs) && durationMs >= 0 ? Math.round(durationMs) : 0;
  const resultado = classifyResult(
    tenantId,
    mapping.tipo,
    res.statusCode,
    operationId,
    projetoId,
    pontoId,
  );

  try {
    registrarEventoKpi(tenantId, mapping.tipo, resultado, durationSafeMs, {
      projetoId,
      metadados: {
        uxEvent: mapping.uxEvent,
        operationId,
        pontoId,
        statusCode: res.statusCode,
      },
    });

    if (res.statusCode < 400 && mapping.stage) {
      safeRecordCriticalStage(tenantId, mapping.stage, projetoId, pontoId, {
        origem: "observability-trust",
        uxEvent: mapping.uxEvent,
        operationId,
      });
    }
  } catch (err) {
    logger.warn("Falha ao registrar observabilidade de confiança", {
      route: routeKey(req),
      tenantId,
      projetoId,
      pontoId,
      statusCode: res.statusCode,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export function _resetTrustObservabilityState(): void {
  markerStore.clear();
}
