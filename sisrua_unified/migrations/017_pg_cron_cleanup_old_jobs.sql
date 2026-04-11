-- Migration: 017_pg_cron_cleanup_old_jobs.sql
-- Purpose:
--   Configure pg_cron cleanup for old rows in public.jobs.
--
-- Strategy:
--   - Keep recent jobs available for frontend polling and operational debugging.
--   - Remove only terminal jobs (completed/failed) older than 14 days.
--   - Run daily at 03:20 UTC with pg_cron.
--
-- Safety:
--   - Idempotent: drops prior schedule with same name before creating new one.
--   - Uses private schema for security-definer helper function.
--   - Does not touch queued/processing jobs.

CREATE SCHEMA IF NOT EXISTS private;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION private.cleanup_old_jobs(
  p_keep_for INTERVAL DEFAULT INTERVAL '14 days',
  p_batch_limit INTEGER DEFAULT 10000
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private'
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  WITH to_delete AS (
    SELECT id
    FROM public.jobs
    WHERE status IN ('completed', 'failed')
      AND created_at < (NOW() - p_keep_for)
    ORDER BY created_at ASC
    LIMIT GREATEST(p_batch_limit, 1)
  )
  DELETE FROM public.jobs j
  USING to_delete td
  WHERE j.id = td.id;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION private.cleanup_old_jobs(INTERVAL, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.cleanup_old_jobs(INTERVAL, INTEGER) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION private.cleanup_old_jobs(INTERVAL, INTEGER) TO postgres, service_role;

DO $do$
DECLARE
  v_job RECORD;
BEGIN
  FOR v_job IN
    SELECT jobid
    FROM cron.job
    WHERE jobname = 'cleanup_old_jobs_daily'
  LOOP
    PERFORM cron.unschedule(v_job.jobid);
  END LOOP;

  PERFORM cron.schedule(
    'cleanup_old_jobs_daily',
    '20 3 * * *',
    'SELECT private.cleanup_old_jobs(INTERVAL ''14 days'', 10000);'
  );
END
$do$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = '_migrations'
  ) THEN
    INSERT INTO public._migrations (filename)
    VALUES ('017_pg_cron_cleanup_old_jobs.sql')
    ON CONFLICT (filename) DO NOTHING;
  END IF;
END
$$;
