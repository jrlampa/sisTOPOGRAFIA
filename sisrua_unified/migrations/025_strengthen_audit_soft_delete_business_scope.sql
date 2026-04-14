-- Migration: 025_strengthen_audit_soft_delete_business_scope.sql
-- Purpose:
--   Strengthen and verify audit + soft-delete across business tables beyond
--   constants_catalog, fixing non-UUID primary key compatibility.
--
-- Why this migration exists:
--   - 019 created public.audit_logs(record_id UUID), which is incompatible with
--     non-UUID PKs used by business tables (TEXT, SERIAL, BIGSERIAL).
--   - 021 attempted to generalize auditing, but relied on UUID casts and default
--     id extraction, which breaks for non-UUID and user_roles(user_id PK).
--
-- Strategy:
--   1) Normalize audit_logs.record_id to TEXT for universal PK support.
--   2) Replace trigger functions with robust generic PK extraction (TG_ARGV[0]).
--   3) Apply soft delete + indexes + audit triggers to relevant business tables.
--   4) Align SELECT policies to exclude soft-deleted rows where applicable.

BEGIN;

-- -----------------------------------------------------------------------------
-- 1) Universalize audit record key storage (UUID -> TEXT)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'audit_logs'
      AND column_name = 'record_id'
      AND data_type <> 'text'
  ) THEN
    ALTER TABLE public.audit_logs
      ALTER COLUMN record_id TYPE TEXT USING record_id::text;
  END IF;
END
$$;

-- Keep archive table type aligned when maintenance migration (024) has already run.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'private'
      AND table_name = 'audit_logs_archive'
      AND column_name = 'record_id'
      AND data_type <> 'text'
  ) THEN
    ALTER TABLE private.audit_logs_archive
      ALTER COLUMN record_id TYPE TEXT USING record_id::text;
  END IF;
END
$$;

-- -----------------------------------------------------------------------------
-- 2) Harden audit trigger functions (supports PK column argument)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.proc_audit_log_generic()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'auth'
AS $$
DECLARE
  v_row JSONB;
  v_pk_col TEXT := COALESCE(NULLIF(TG_ARGV[0], ''), 'id');
  v_pk TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_row := to_jsonb(OLD);
  ELSE
    v_row := to_jsonb(NEW);
  END IF;

  v_pk := COALESCE(v_row ->> v_pk_col, '<missing_pk>');

  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (table_name, record_id, action, old_data, changed_by)
    VALUES (TG_TABLE_NAME, v_pk, TG_OP, to_jsonb(OLD), auth.uid());
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (table_name, record_id, action, old_data, new_data, changed_by)
    VALUES (TG_TABLE_NAME, v_pk, TG_OP, to_jsonb(OLD), to_jsonb(NEW), auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (table_name, record_id, action, new_data, changed_by)
    VALUES (TG_TABLE_NAME, v_pk, TG_OP, to_jsonb(NEW), auth.uid());
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

-- Keep legacy function name used by 019 triggers, now with universal behavior.
CREATE OR REPLACE FUNCTION public.proc_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'auth'
AS $$
DECLARE
  v_row JSONB;
  v_pk TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_row := to_jsonb(OLD);
  ELSE
    v_row := to_jsonb(NEW);
  END IF;

  v_pk := COALESCE(v_row ->> 'id', '<missing_pk>');

  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (table_name, record_id, action, old_data, changed_by)
    VALUES (TG_TABLE_NAME, v_pk, TG_OP, to_jsonb(OLD), auth.uid());
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (table_name, record_id, action, old_data, new_data, changed_by)
    VALUES (TG_TABLE_NAME, v_pk, TG_OP, to_jsonb(OLD), to_jsonb(NEW), auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (table_name, record_id, action, new_data, changed_by)
    VALUES (TG_TABLE_NAME, v_pk, TG_OP, to_jsonb(NEW), auth.uid());
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.proc_audit_log_generic() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.proc_audit_log_generic() TO service_role, postgres;

REVOKE ALL ON FUNCTION public.proc_audit_log() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.proc_audit_log() TO service_role, postgres;

-- -----------------------------------------------------------------------------
-- 3) Soft delete columns across relevant business entities
-- -----------------------------------------------------------------------------
ALTER TABLE public.constants_catalog           ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.jobs                        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.dxf_tasks                   ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.bt_export_history           ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.user_roles                  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.constants_refresh_events    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.constants_catalog_snapshots ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- -----------------------------------------------------------------------------
-- 4) Active-only indexes for soft-delete aware queries
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_constants_ns_key_env_active
  ON public.constants_catalog (namespace, key, environment)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_status_created_active
  ON public.jobs (status, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_created_active
  ON public.jobs (created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_dxf_tasks_status_created_active
  ON public.dxf_tasks (status, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_bt_export_history_created_active
  ON public.bt_export_history (created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_bt_export_history_type_created_active
  ON public.bt_export_history (project_type, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_roles_user_active
  ON public.user_roles (user_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_constants_refresh_events_created_active
  ON public.constants_refresh_events (created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ccs_namespace_created_active
  ON public.constants_catalog_snapshots (namespace, created_at DESC)
  WHERE deleted_at IS NULL;

-- -----------------------------------------------------------------------------
-- 5) Apply/repair audit triggers for business entities
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_audit_constants_catalog ON public.constants_catalog;
CREATE TRIGGER trg_audit_constants_catalog
AFTER INSERT OR UPDATE OR DELETE ON public.constants_catalog
FOR EACH ROW EXECUTE FUNCTION public.proc_audit_log_generic('id');

DROP TRIGGER IF EXISTS trg_audit_jobs ON public.jobs;
CREATE TRIGGER trg_audit_jobs
AFTER INSERT OR UPDATE OR DELETE ON public.jobs
FOR EACH ROW EXECUTE FUNCTION public.proc_audit_log_generic('id');

DROP TRIGGER IF EXISTS trg_audit_dxf_tasks ON public.dxf_tasks;
CREATE TRIGGER trg_audit_dxf_tasks
AFTER INSERT OR UPDATE OR DELETE ON public.dxf_tasks
FOR EACH ROW EXECUTE FUNCTION public.proc_audit_log_generic('id');

DROP TRIGGER IF EXISTS trg_audit_bt_export_history ON public.bt_export_history;
CREATE TRIGGER trg_audit_bt_export_history
AFTER INSERT OR UPDATE OR DELETE ON public.bt_export_history
FOR EACH ROW EXECUTE FUNCTION public.proc_audit_log_generic('id');

DROP TRIGGER IF EXISTS trg_audit_user_roles ON public.user_roles;
CREATE TRIGGER trg_audit_user_roles
AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.proc_audit_log_generic('user_id');

DROP TRIGGER IF EXISTS trg_audit_constants_refresh_events ON public.constants_refresh_events;
CREATE TRIGGER trg_audit_constants_refresh_events
AFTER INSERT OR UPDATE OR DELETE ON public.constants_refresh_events
FOR EACH ROW EXECUTE FUNCTION public.proc_audit_log_generic('id');

DROP TRIGGER IF EXISTS trg_audit_constants_catalog_snapshots ON public.constants_catalog_snapshots;
CREATE TRIGGER trg_audit_constants_catalog_snapshots
AFTER INSERT OR UPDATE OR DELETE ON public.constants_catalog_snapshots
FOR EACH ROW EXECUTE FUNCTION public.proc_audit_log_generic('id');

-- -----------------------------------------------------------------------------
-- 6) Policy alignment: hide soft-deleted rows from client-visible reads
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS constants_catalog_select_anon ON public.constants_catalog;
CREATE POLICY constants_catalog_select_anon ON public.constants_catalog
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true AND deleted_at IS NULL);

DROP POLICY IF EXISTS jobs_select_recent_anon ON public.jobs;
CREATE POLICY jobs_select_recent_anon ON public.jobs
  FOR SELECT
  TO anon, authenticated
  USING (
    deleted_at IS NULL
    AND created_at >= NOW() - INTERVAL '24 hours'
  );

-- -----------------------------------------------------------------------------
-- 7) Operational view for soft-deleted counts (expanded scope)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_soft_deleted_summary AS
SELECT 'constants_catalog'           AS table_name, COUNT(*) AS deleted_count, MAX(deleted_at) AS last_deleted_at
FROM public.constants_catalog
WHERE deleted_at IS NOT NULL
UNION ALL
SELECT 'jobs', COUNT(*), MAX(deleted_at)
FROM public.jobs
WHERE deleted_at IS NOT NULL
UNION ALL
SELECT 'dxf_tasks', COUNT(*), MAX(deleted_at)
FROM public.dxf_tasks
WHERE deleted_at IS NOT NULL
UNION ALL
SELECT 'bt_export_history', COUNT(*), MAX(deleted_at)
FROM public.bt_export_history
WHERE deleted_at IS NOT NULL
UNION ALL
SELECT 'user_roles', COUNT(*), MAX(deleted_at)
FROM public.user_roles
WHERE deleted_at IS NOT NULL
UNION ALL
SELECT 'constants_refresh_events', COUNT(*), MAX(deleted_at)
FROM public.constants_refresh_events
WHERE deleted_at IS NOT NULL
UNION ALL
SELECT 'constants_catalog_snapshots', COUNT(*), MAX(deleted_at)
FROM public.constants_catalog_snapshots
WHERE deleted_at IS NOT NULL;

GRANT SELECT ON public.v_soft_deleted_summary TO service_role, postgres;

-- -----------------------------------------------------------------------------
-- 8) Migration bookkeeping
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = '_migrations'
  ) THEN
    INSERT INTO public._migrations (filename)
    VALUES ('025_strengthen_audit_soft_delete_business_scope.sql')
    ON CONFLICT (filename) DO NOTHING;
  END IF;
END
$$;

COMMIT;
