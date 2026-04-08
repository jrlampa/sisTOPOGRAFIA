-- Migration: 003_constants_refresh_events.sql
-- Purpose: Audit manual/runtime constants refresh operations for SaaS observability.

CREATE TABLE IF NOT EXISTS constants_refresh_events (
  id            BIGSERIAL PRIMARY KEY,
  namespaces    TEXT[]      NOT NULL,
  success       BOOLEAN     NOT NULL,
  http_status   INTEGER     NOT NULL,
  actor         TEXT        NOT NULL,
  error_message TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_constants_refresh_events_created_at
  ON constants_refresh_events (created_at DESC);

ALTER TABLE constants_refresh_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS constants_refresh_events_deny_anon ON constants_refresh_events;
CREATE POLICY constants_refresh_events_deny_anon ON constants_refresh_events
  FOR ALL
  TO anon, authenticated
  USING (false);

GRANT SELECT, INSERT, UPDATE, DELETE ON constants_refresh_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE constants_refresh_events_id_seq TO service_role;
