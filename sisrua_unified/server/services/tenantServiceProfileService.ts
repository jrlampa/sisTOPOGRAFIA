/**
 * tenantServiceProfileService.ts — Catálogo de Serviços por Tenant (SaaS SoA).
 *
 * Objetivo:
 *   - Permitir governança de perfil de serviço por tenant (SLA/SLO, suporte, escalonamento).
 *   - Fornecer base operacional para contratos enterprise com rastreabilidade.
 */

import { getDbClient } from "../repositories/dbClient.js";
import { logger } from "../utils/logger.js";

export type ServiceTier = "bronze" | "silver" | "gold" | "platinum";

export interface TenantServiceProfileInput {
  tenantId: string;
  serviceCode: string;
  serviceName: string;
  tier: ServiceTier;
  slaAvailabilityPct: number;
  sloLatencyP95Ms: number;
  supportChannel: string;
  supportHours: string;
  escalationPolicy: Record<string, unknown>;
  metadata: Record<string, unknown>;
  isActive?: boolean;
}

export interface TenantServiceProfile {
  id: string;
  tenantId: string;
  tenantSlug: string | null;
  tenantName: string | null;
  serviceCode: string;
  serviceName: string;
  tier: ServiceTier;
  slaAvailabilityPct: number;
  sloLatencyP95Ms: number;
  supportChannel: string;
  supportHours: string;
  escalationPolicy: Record<string, unknown>;
  metadata: Record<string, unknown>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

function normalizeTenantId(input: string): string {
  const value = input.trim().toLowerCase();
  if (!value || value.includes("..")) {
    throw new Error("tenantId inválido");
  }
  return value;
}

function normalizeServiceCode(input: string): string {
  const value = input.trim().toLowerCase();
  if (!value || value.length > 64 || !/^[a-z0-9_.-]+$/.test(value)) {
    throw new Error("serviceCode inválido");
  }
  return value;
}

function normalizeText(input: string, field: string, max = 255): string {
  const value = input.trim();
  if (!value || value.length > max) {
    throw new Error(`${field} inválido`);
  }
  return value;
}

function normalizeInput(
  input: TenantServiceProfileInput,
): TenantServiceProfileInput {
  return {
    tenantId: normalizeTenantId(input.tenantId),
    serviceCode: normalizeServiceCode(input.serviceCode),
    serviceName: normalizeText(input.serviceName, "serviceName", 120),
    tier: input.tier,
    slaAvailabilityPct: input.slaAvailabilityPct,
    sloLatencyP95Ms: input.sloLatencyP95Ms,
    supportChannel: normalizeText(input.supportChannel, "supportChannel", 60),
    supportHours: normalizeText(input.supportHours, "supportHours", 120),
    escalationPolicy: input.escalationPolicy ?? {},
    metadata: input.metadata ?? {},
    isActive: input.isActive ?? true,
  };
}

function validateSloSla(input: TenantServiceProfileInput): void {
  if (
    !Number.isFinite(input.slaAvailabilityPct) ||
    input.slaAvailabilityPct < 90 ||
    input.slaAvailabilityPct > 99.999
  ) {
    throw new Error("slaAvailabilityPct fora do intervalo permitido (90..99.999)");
  }

  if (
    !Number.isFinite(input.sloLatencyP95Ms) ||
    input.sloLatencyP95Ms < 10 ||
    input.sloLatencyP95Ms > 60000
  ) {
    throw new Error("sloLatencyP95Ms fora do intervalo permitido (10..60000)");
  }
}

function mapRow(row: Record<string, unknown>): TenantServiceProfile {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    tenantSlug: row.tenant_slug ? String(row.tenant_slug) : null,
    tenantName: row.tenant_name ? String(row.tenant_name) : null,
    serviceCode: String(row.service_code),
    serviceName: String(row.service_name),
    tier: row.tier as ServiceTier,
    slaAvailabilityPct: Number(row.sla_availability_pct),
    sloLatencyP95Ms: Number(row.slo_latency_p95_ms),
    supportChannel: String(row.support_channel),
    supportHours: String(row.support_hours),
    escalationPolicy: (row.escalation_policy as Record<string, unknown>) ?? {},
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    isActive: Boolean(row.is_active),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export async function listServiceProfiles(
  tenantId?: string,
): Promise<TenantServiceProfile[]> {
  const sql = getDbClient();
  if (!sql) {
    throw new Error("Banco indisponível");
  }

  if (tenantId) {
    const normalizedTenantId = normalizeTenantId(tenantId);
    const rows = await sql<Record<string, unknown>[]>`
      SELECT
        tsp.id,
        tsp.tenant_id,
        t.slug AS tenant_slug,
        t.name AS tenant_name,
        tsp.service_code,
        tsp.service_name,
        tsp.tier,
        tsp.sla_availability_pct,
        tsp.slo_latency_p95_ms,
        tsp.support_channel,
        tsp.support_hours,
        tsp.escalation_policy,
        tsp.metadata,
        tsp.is_active,
        tsp.created_at,
        tsp.updated_at
      FROM tenant_service_profiles tsp
      LEFT JOIN tenants t ON t.id = tsp.tenant_id
      WHERE tsp.tenant_id::text = ${normalizedTenantId}
      ORDER BY tsp.service_code ASC
    `;
    return rows.map(mapRow);
  }

  const rows = await sql<Record<string, unknown>[]>`
    SELECT
      tsp.id,
      tsp.tenant_id,
      t.slug AS tenant_slug,
      t.name AS tenant_name,
      tsp.service_code,
      tsp.service_name,
      tsp.tier,
      tsp.sla_availability_pct,
      tsp.slo_latency_p95_ms,
      tsp.support_channel,
      tsp.support_hours,
      tsp.escalation_policy,
      tsp.metadata,
      tsp.is_active,
      tsp.created_at,
      tsp.updated_at
    FROM tenant_service_profiles tsp
    LEFT JOIN tenants t ON t.id = tsp.tenant_id
    ORDER BY t.name ASC NULLS LAST, tsp.service_code ASC
  `;

  return rows.map(mapRow);
}

export async function upsertServiceProfile(
  rawInput: TenantServiceProfileInput,
): Promise<TenantServiceProfile> {
  const sql = getDbClient();
  if (!sql) {
    throw new Error("Banco indisponível");
  }

  const input = normalizeInput(rawInput);
  validateSloSla(input);

  const rows = await sql<Record<string, unknown>[]>`
    INSERT INTO tenant_service_profiles (
      tenant_id,
      service_code,
      service_name,
      tier,
      sla_availability_pct,
      slo_latency_p95_ms,
      support_channel,
      support_hours,
      escalation_policy,
      metadata,
      is_active
    ) VALUES (
      ${input.tenantId}::uuid,
      ${input.serviceCode},
      ${input.serviceName},
      ${input.tier},
      ${input.slaAvailabilityPct},
      ${Math.trunc(input.sloLatencyP95Ms)},
      ${input.supportChannel},
      ${input.supportHours},
      ${JSON.stringify(input.escalationPolicy)}::jsonb,
      ${JSON.stringify(input.metadata)}::jsonb,
      ${Boolean(input.isActive)}
    )
    ON CONFLICT (tenant_id, service_code)
    DO UPDATE SET
      service_name = EXCLUDED.service_name,
      tier = EXCLUDED.tier,
      sla_availability_pct = EXCLUDED.sla_availability_pct,
      slo_latency_p95_ms = EXCLUDED.slo_latency_p95_ms,
      support_channel = EXCLUDED.support_channel,
      support_hours = EXCLUDED.support_hours,
      escalation_policy = EXCLUDED.escalation_policy,
      metadata = EXCLUDED.metadata,
      is_active = EXCLUDED.is_active,
      updated_at = NOW()
    RETURNING
      id,
      tenant_id,
      NULL::text AS tenant_slug,
      NULL::text AS tenant_name,
      service_code,
      service_name,
      tier,
      sla_availability_pct,
      slo_latency_p95_ms,
      support_channel,
      support_hours,
      escalation_policy,
      metadata,
      is_active,
      created_at,
      updated_at
  `;

  const profile = mapRow(rows[0]);
  logger.info("[TenantServiceProfileService] Perfil de serviço upsertado", {
    tenantId: profile.tenantId,
    serviceCode: profile.serviceCode,
    tier: profile.tier,
    isActive: profile.isActive,
  });

  return profile;
}

export async function removeServiceProfile(
  tenantId: string,
  serviceCode: string,
): Promise<boolean> {
  const sql = getDbClient();
  if (!sql) {
    throw new Error("Banco indisponível");
  }

  const normalizedTenantId = normalizeTenantId(tenantId);
  const normalizedServiceCode = normalizeServiceCode(serviceCode);

  const rows = await sql<{ id: string }[]>`
    DELETE FROM tenant_service_profiles
    WHERE tenant_id::text = ${normalizedTenantId}
      AND service_code = ${normalizedServiceCode}
    RETURNING id
  `;

  const removed = rows.length > 0;
  if (removed) {
    logger.info("[TenantServiceProfileService] Perfil de serviço removido", {
      tenantId: normalizedTenantId,
      serviceCode: normalizedServiceCode,
    });
  }

  return removed;
}
