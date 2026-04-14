-- Migration: 038_audit_context_siem.sql
-- Roadmap Item 68: IP/geo/device context in audit_logs
-- Roadmap Item 34: Tenant-level audit context
-- Roadmap Item 93: SIEM export view + bookkeeping
--
-- Objetivo:
--   1. Adicionar colunas de contexto (IP, user_agent, device_fingerprint,
--      geo_country, geo_region) à tabela audit_logs para conformidade SIEM.
--   2. Adicionar tenant_id para isolamento multi-tenant nos logs de auditoria.
--   3. Criar view v_audit_siem_export formatada para consumo por Splunk/Datadog/SIEM.
--
-- Idempotente: usa ADD COLUMN IF NOT EXISTS / OR REPLACE.

-- ─── 1. Colunas de contexto de sessão ────────────────────────────────────────

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS ip_address        TEXT,
  ADD COLUMN IF NOT EXISTS user_agent        TEXT,
  ADD COLUMN IF NOT EXISTS device_fingerprint TEXT,
  ADD COLUMN IF NOT EXISTS geo_country       TEXT,
  ADD COLUMN IF NOT EXISTS geo_region        TEXT,
  ADD COLUMN IF NOT EXISTS tenant_id         UUID REFERENCES public.tenants(id),
  ADD COLUMN IF NOT EXISTS session_id        TEXT;

COMMENT ON COLUMN public.audit_logs.ip_address IS
  'IP de origem da requisição (IPv4 ou IPv6). Pode ser anonimizado por LGPD.';
COMMENT ON COLUMN public.audit_logs.user_agent IS
  'User-Agent HTTP do cliente. Suporte a análise de device/browser.';
COMMENT ON COLUMN public.audit_logs.device_fingerprint IS
  'Hash opaco do fingerprint de dispositivo, se disponível.';
COMMENT ON COLUMN public.audit_logs.geo_country IS
  'País de origem da requisição (ISO 3166-1 alpha-2). Ex: BR, US.';
COMMENT ON COLUMN public.audit_logs.geo_region IS
  'Estado/região de origem da requisição. Ex: SP, RJ.';
COMMENT ON COLUMN public.audit_logs.tenant_id IS
  'Tenant proprietário do evento. Suporta isolamento de auditoria multi-tenant. Roadmap #34.';

-- ─── 2. Índices para consulta eficiente por SIEM ─────────────────────────────

CREATE INDEX IF NOT EXISTS idx_audit_logs_ip_address
  ON public.audit_logs (ip_address)
  WHERE ip_address IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id
  ON public.audit_logs (tenant_id)
  WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_changed_at_brin
  ON public.audit_logs USING BRIN (changed_at);

-- ─── 3. Vista SIEM (Roadmap Item 93) ─────────────────────────────────────────

CREATE OR REPLACE VIEW public.v_audit_siem_export AS
SELECT
  al.id                               AS event_id,
  al.changed_at                       AS event_time,
  al.table_name                       AS resource_type,
  al.record_id::TEXT                  AS resource_id,
  al.action                           AS event_action,
  al.changed_by::TEXT                 AS actor_user_id,
  al.ip_address                       AS actor_ip,
  al.user_agent                       AS actor_user_agent,
  al.device_fingerprint               AS actor_device,
  al.geo_country                      AS actor_geo_country,
  al.geo_region                       AS actor_geo_region,
  al.session_id                       AS actor_session_id,
  al.tenant_id::TEXT                  AS tenant_id,
  t.name                              AS tenant_name,
  al.old_data                         AS data_before,
  al.new_data                         AS data_after,
  -- Campo padronizado CEF/LEEF para SIEM ingestion
  'CEF:0|sisRUA|AuditLog|1.0|'
    || al.action || '|'
    || al.table_name || '|'
    || CASE al.action
         WHEN 'DELETE' THEN '7'
         WHEN 'UPDATE' THEN '5'
         ELSE '3'
       END
    || '|'
    || 'actor=' || COALESCE(al.changed_by::TEXT, 'system')
    || ' src='   || COALESCE(al.ip_address, 'unknown')
    || ' dhost=' || COALESCE(t.name, 'default')
    || ' act='   || al.action
                                      AS cef_message
FROM public.audit_logs al
LEFT JOIN public.tenants t ON t.id = al.tenant_id;

COMMENT ON VIEW public.v_audit_siem_export IS
  'Vista para exportação SIEM. Formato CEF (Common Event Format) compatível com '
  'Splunk, Datadog, IBM QRadar e outros SIEMs. Roadmap #93.';

-- ─── Migration bookkeeping ────────────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = '_migrations'
  ) THEN
    INSERT INTO public._migrations (filename)
    VALUES ('038_audit_context_siem.sql')
    ON CONFLICT (filename) DO NOTHING;
  END IF;
END $$;
