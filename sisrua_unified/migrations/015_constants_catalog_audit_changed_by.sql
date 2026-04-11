-- Migration 015: Capture changed_by in constants_catalog audit trigger
-- Purpose:
--   Ensure constants_catalog_history.changed_by is populated for UPDATE audits.
--
-- Actor precedence:
--   1) app.changed_by session setting (set by backend jobs/scripts)
--   2) request.jwt.claim.email (when called through PostgREST context)
--   3) request.jwt.claim.sub
--   4) current_user (final safe fallback)
--
-- Safety notes:
--   - CREATE OR REPLACE FUNCTION keeps trigger wiring intact.
--   - No table rewrite, no data backfill, no API contract break.

CREATE OR REPLACE FUNCTION public.constants_catalog_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_changed_by TEXT;
BEGIN
  v_changed_by := COALESCE(
    NULLIF(current_setting('app.changed_by', true), ''),
    NULLIF(current_setting('request.jwt.claim.email', true), ''),
    NULLIF(current_setting('request.jwt.claim.sub', true), ''),
    current_user
  );

  INSERT INTO constants_catalog_history
    (catalog_id, namespace, key, value, version_hash, environment, changed_by)
  VALUES
    (OLD.id, OLD.namespace, OLD.key, OLD.value, OLD.version_hash, OLD.environment, v_changed_by);

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.constants_catalog_audit()
  SET search_path = public, pg_temp;
