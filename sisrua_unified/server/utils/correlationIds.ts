import type { Request, Response } from "express";

export interface CorrelationIds {
  operation_id?: string;
  projeto_id?: string;
  ponto_id?: string;
}

const ID_MAX_LEN = 128;
const SAFE_ID = /^[A-Za-z0-9._:-]{1,128}$/;

function pickFirstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

function normalizeId(raw?: string): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim().slice(0, ID_MAX_LEN);
  if (!SAFE_ID.test(trimmed)) return undefined;
  return trimmed;
}

export function extractCorrelationIds(req: Request): CorrelationIds {
  const body =
    req.body && typeof req.body === "object" && !Array.isArray(req.body)
      ? (req.body as Record<string, unknown>)
      : {};

  const operationRaw = pickFirstString(
    req.get("x-operation-id"),
    req.get("operation-id"),
    req.get("operation_id"),
    req.query.operation_id,
    req.query.operationId,
    req.params.operation_id,
    req.params.operationId,
    body.operation_id,
    body.operationId,
  );

  const projectRaw = pickFirstString(
    req.get("x-projeto-id"),
    req.get("x-project-id"),
    req.get("projeto-id"),
    req.get("project-id"),
    req.get("projeto_id"),
    req.get("project_id"),
    req.query.projeto_id,
    req.query.project_id,
    req.query.projetoId,
    req.query.projectId,
    req.params.projeto_id,
    req.params.project_id,
    req.params.projetoId,
    req.params.projectId,
    body.projeto_id,
    body.project_id,
    body.projetoId,
    body.projectId,
  );

  const pointRaw = pickFirstString(
    req.get("x-ponto-id"),
    req.get("x-point-id"),
    req.get("ponto-id"),
    req.get("point-id"),
    req.get("ponto_id"),
    req.get("point_id"),
    req.query.ponto_id,
    req.query.point_id,
    req.query.pontoId,
    req.query.pointId,
    req.params.ponto_id,
    req.params.point_id,
    req.params.pontoId,
    req.params.pointId,
    body.ponto_id,
    body.point_id,
    body.pontoId,
    body.pointId,
  );

  const operation_id = normalizeId(operationRaw);
  const projeto_id = normalizeId(projectRaw);
  const ponto_id = normalizeId(pointRaw);

  return {
    ...(operation_id ? { operation_id } : {}),
    ...(projeto_id ? { projeto_id } : {}),
    ...(ponto_id ? { ponto_id } : {}),
  };
}

export function setCorrelationResponseHeaders(
  res: Response,
  ids: CorrelationIds,
): void {
  if (ids.operation_id) {
    res.setHeader("x-operation-id", ids.operation_id);
  }
  if (ids.projeto_id) {
    res.setHeader("x-projeto-id", ids.projeto_id);
  }
  if (ids.ponto_id) {
    res.setHeader("x-ponto-id", ids.ponto_id);
  }
}

export function formatCorrelationSuffix(ids: CorrelationIds): string {
  const parts: string[] = [];
  if (ids.operation_id) parts.push(`op=${ids.operation_id}`);
  if (ids.projeto_id) parts.push(`projeto=${ids.projeto_id}`);
  if (ids.ponto_id) parts.push(`ponto=${ids.ponto_id}`);
  return parts.length > 0 ? `|${parts.join("|")}` : "";
}
