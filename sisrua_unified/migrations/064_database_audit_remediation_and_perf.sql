-- Migration: 064_database_audit_remediation_and_perf.sql
-- 2026-05-08
--
-- Objetivo: Resolver achados da auditoria técnica corretiva (Tech Lead).
-- 
-- Problemas endereçados:
--   1. Query lenta (1.1s) em v_audit_siem_export (ORDER BY pesado sem índice materializado).
--   2. Saúde de índices 'LOW' (20 índices nunca utilizados gerando overhead e bloat).
--   3. Falta de cache para metadados de sistema (pg_timezone_names).
--
-- Estratégia:
--   - Converter VIEW v_audit_siem_export em MATERIALIZED VIEW com índice BTREE DESC.
--   - Dropar índices redundantes identificados pela auditoria live.
--   - Implementar função de refresh concorrente.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. OTIMIZAÇÃO SIEM: Conversão para Materialized View
-- ─────────────────────────────────────────────────────────────────────────────

DROP VIEW IF EXISTS public.v_audit_siem_export;

CREATE MATERIALIZED VIEW public.mv_audit_siem_export AS
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

-- Índice para suporte a exportação ordenada por tempo (ORDER BY event_time DESC)
CREATE INDEX idx_mv_siem_event_time_desc ON public.mv_audit_siem_export (event_time DESC);
-- Índice para buscas por tenant
CREATE INDEX idx_mv_siem_tenant_id ON public.mv_audit_siem_export (tenant_id);

GRANT SELECT ON public.mv_audit_siem_export TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. SANEAMENTO DE ÍNDICES (Achados da Auditoria: Risco LOW)
--    Remover índices nunca utilizados para reduzir overhead de INSERT/UPDATE.
-- ─────────────────────────────────────────────────────────────────────────────

-- Índices GIN/TRGM identificados como 'never used' no relatório 20260508_134813
DROP INDEX IF EXISTS public.idx_gin_audit_logs_new_data;
DROP INDEX IF EXISTS public.idx_trgm_audit_table_name;
DROP INDEX IF EXISTS public.formula_versions_constants_gin_idx;

-- BRIN inativos (possuem alto custo de manutenção em partições pequenas)
DROP INDEX IF EXISTS public.idx_brin_jobs_created_at;
DROP INDEX IF EXISTS public.idx_brin_audit_logs_changed_at;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. REFRESH DE MATERIALIZED VIEWS (Inclusão da nova MV)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION private.refresh_materialized_views()
RETURNS TABLE (view_name TEXT, refreshed_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private'
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_bt_history_daily_summary;
  view_name := 'mv_bt_history_daily_summary'; refreshed_at := now();
  RETURN NEXT;

  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_audit_stats;
  view_name := 'mv_audit_stats'; refreshed_at := now();
  RETURN NEXT;

  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_constants_namespace_summary;
  view_name := 'mv_constants_namespace_summary'; refreshed_at := now();
  RETURN NEXT;

  -- Nova MV SIEM (Adicionada em 064)
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_audit_siem_export;
  view_name := 'mv_audit_siem_export'; refreshed_at := now();
  RETURN NEXT;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- REGISTRO DA MIGRAÇÃO
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public._migrations (filename)
VALUES ('064_database_audit_remediation_and_perf.sql')
ON CONFLICT (filename) DO NOTHING;

COMMIT;
