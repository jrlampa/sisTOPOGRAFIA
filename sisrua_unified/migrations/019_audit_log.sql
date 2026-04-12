-- Migration: 019_audit_log.sql
-- Purpose: Create a generic audit_log table that records INSERT, UPDATE and DELETE
--          events for all key business tables via a shared trigger function.
--
-- Tables covered in this migration:
--   - jobs
--   - constants_catalog
--   - bt_export_history
--
-- Pattern: follows existing migration conventions.
-- Run once against your Supabase database using the SQL editor or `psql`.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Audit log table
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_log (
  id           BIGSERIAL    PRIMARY KEY,
  table_name   TEXT         NOT NULL,
  operation    TEXT         NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data     JSONB,
  new_data     JSONB,
  changed_by   TEXT,
  changed_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Index for quick lookup by table and time
CREATE INDEX IF NOT EXISTS idx_audit_log_table_time
  ON audit_log (table_name, changed_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Shared trigger function
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO audit_log (table_name, operation, old_data, new_data, changed_by)
  VALUES (
    TG_TABLE_NAME,
    TG_OP,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
    current_setting('app.current_user', true)
  );
  RETURN NULL; -- AFTER trigger: return value is ignored
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Attach trigger to business tables
-- ─────────────────────────────────────────────────────────────────────────────

-- jobs
DROP TRIGGER IF EXISTS trg_audit_jobs ON jobs;
CREATE TRIGGER trg_audit_jobs
  AFTER INSERT OR UPDATE OR DELETE ON jobs
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- constants_catalog
DROP TRIGGER IF EXISTS trg_audit_constants_catalog ON constants_catalog;
CREATE TRIGGER trg_audit_constants_catalog
  AFTER INSERT OR UPDATE OR DELETE ON constants_catalog
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- bt_export_history
DROP TRIGGER IF EXISTS trg_audit_bt_export_history ON bt_export_history;
CREATE TRIGGER trg_audit_bt_export_history
  AFTER INSERT OR UPDATE OR DELETE ON bt_export_history
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Row-Level Security
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Only the service role (bypasses RLS) may read or write audit_log.
-- anon and authenticated roles have no direct access.
REVOKE ALL ON TABLE audit_log FROM anon, authenticated;
