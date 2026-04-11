-- Migration: 002_constants_catalog.sql
-- Purpose: Create a versioned catalog for business-logic lookup tables.
--          Each row stores one lookup table (or scalar constant) as a JSONB value,
--          keyed by (namespace, key, environment).
--
-- Access model:
--   - Backend service role can read and write (bypasses RLS).
--   - anon / authenticated roles: read-only, active entries only.
--   - No client (browser) writes allowed.
--
-- Pattern: follows 001_jobs_rls.sql conventions.
-- Run once against your Supabase database using the SQL editor or `psql`.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Main catalog table
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS constants_catalog (
  id            BIGSERIAL PRIMARY KEY,
  namespace     TEXT        NOT NULL, -- e.g. 'cqt', 'clandestino', 'config'
  key           TEXT        NOT NULL, -- e.g. 'CABOS_BASELINE', 'RATE_LIMIT_DXF_MAX'
  value         JSONB       NOT NULL, -- array, object, or scalar payload
  version_hash  TEXT        NOT NULL, -- deterministic identifier for this payload version
  environment   TEXT        NOT NULL DEFAULT 'production',
  description   TEXT,
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_constants_ns_key_env UNIQUE (namespace, key, environment)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. History / audit table — append-only; trigger populates on each UPDATE
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS constants_catalog_history (
  id            BIGSERIAL   PRIMARY KEY,
  catalog_id    BIGINT      NOT NULL,
  namespace     TEXT        NOT NULL,
  key           TEXT        NOT NULL,
  value         JSONB       NOT NULL,
  version_hash  TEXT        NOT NULL,
  environment   TEXT        NOT NULL,
  changed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  changed_by    TEXT        -- service tag or operator note
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Indexes
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_constants_ns_key
  ON constants_catalog (namespace, key, environment)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_constants_history_catalog_id
  ON constants_catalog_history (catalog_id, changed_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Auto-update updated_at on row changes
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION constants_catalog_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_constants_updated_at ON constants_catalog;
CREATE TRIGGER trg_constants_updated_at
  BEFORE UPDATE ON constants_catalog
  FOR EACH ROW EXECUTE FUNCTION constants_catalog_set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Audit trigger — copy previous value to history before each UPDATE
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION constants_catalog_audit()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO constants_catalog_history
    (catalog_id, namespace, key, value, version_hash, environment)
  VALUES
    (OLD.id, OLD.namespace, OLD.key, OLD.value, OLD.version_hash, OLD.environment);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_constants_audit ON constants_catalog;
CREATE TRIGGER trg_constants_audit
  BEFORE UPDATE ON constants_catalog
  FOR EACH ROW EXECUTE FUNCTION constants_catalog_audit();

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Enable Row Level Security
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE constants_catalog         ENABLE ROW LEVEL SECURITY;
ALTER TABLE constants_catalog_history ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Policies
-- ─────────────────────────────────────────────────────────────────────────────

-- 7a. constants_catalog — anon/authenticated can read active entries only.
--     No insert/update/delete from client roles.

DROP POLICY IF EXISTS constants_catalog_select_anon ON constants_catalog;
CREATE POLICY constants_catalog_select_anon ON constants_catalog
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- 7b. constants_catalog_history — no client access.

DROP POLICY IF EXISTS constants_history_deny_anon ON constants_catalog_history;
CREATE POLICY constants_history_deny_anon ON constants_catalog_history
  FOR ALL
  TO anon, authenticated
  USING (false);

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Grants for the service role (explicit for auditability)
-- ─────────────────────────────────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON constants_catalog         TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON constants_catalog_history TO service_role;
GRANT USAGE, SELECT ON SEQUENCE constants_catalog_id_seq          TO service_role;
GRANT USAGE, SELECT ON SEQUENCE constants_catalog_history_id_seq  TO service_role;
