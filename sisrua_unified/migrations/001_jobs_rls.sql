-- Migration: 001_jobs_rls.sql
-- Purpose: Enable RLS on backend tables; backend connects via service role (DATABASE_URL).
-- Because the backend uses a direct Postgres connection (service role), these policies
-- primarily protect against accidental direct access by unauthenticated roles.
--
-- Run once against your Supabase database using the SQL editor or `psql`.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Ensure tables exist (idempotent — service creates them on first boot, but
--    this migration can run first if desired).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS jobs (
  id            TEXT PRIMARY KEY,
  status        TEXT NOT NULL DEFAULT 'queued',
  attempts      INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  error         TEXT
);

CREATE TABLE IF NOT EXISTS dxf_tasks (
  id         SERIAL PRIMARY KEY,
  task_id    TEXT UNIQUE NOT NULL,
  status     TEXT NOT NULL DEFAULT 'queued',
  payload    JSONB NOT NULL,
  attempts   INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Indexes for common access patterns
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_jobs_status      ON jobs (status);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at  ON jobs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dxf_tasks_status ON dxf_tasks (status, created_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Enable Row Level Security
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE jobs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE dxf_tasks ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Policies
--
-- The backend uses the service role key (bypasses RLS automatically).
-- These policies apply to anon / authenticated roles from Supabase client.
-- ─────────────────────────────────────────────────────────────────────────────

-- 4a. jobs — allow anon to read recent job status by id (polling from the
--     browser). No insert/update/delete allowed from client.

DROP POLICY IF EXISTS jobs_select_recent_anon ON jobs;
CREATE POLICY jobs_select_recent_anon ON jobs
  FOR SELECT
  TO anon, authenticated
  USING (
    created_at >= NOW() - INTERVAL '24 hours'
  );

-- 4b. dxf_tasks — no client access; only the service role worker touches this.

DROP POLICY IF EXISTS dxf_tasks_deny_anon ON dxf_tasks;
CREATE POLICY dxf_tasks_deny_anon ON dxf_tasks
  FOR ALL
  TO anon, authenticated
  USING (false);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Grant service role explicit permissions (normally implicit but explicit
--    grants make auditing easier).
-- ─────────────────────────────────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON jobs      TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON dxf_tasks TO service_role;
GRANT USAGE, SELECT ON SEQUENCE dxf_tasks_id_seq  TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Optional: auto-update updated_at via trigger
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS jobs_updated_at      ON jobs;
DROP TRIGGER IF EXISTS dxf_tasks_updated_at ON dxf_tasks;

CREATE TRIGGER jobs_updated_at
  BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER dxf_tasks_updated_at
  BEFORE UPDATE ON dxf_tasks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
