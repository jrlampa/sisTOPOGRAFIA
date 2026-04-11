-- Migration: 004_constants_refresh_events_duration.sql
-- Purpose: Add duration telemetry and query indexes for constants refresh audit trail.

ALTER TABLE constants_refresh_events
  ADD COLUMN IF NOT EXISTS duration_ms INTEGER;

ALTER TABLE constants_refresh_events
  DROP CONSTRAINT IF EXISTS constants_refresh_events_duration_ms_check;

ALTER TABLE constants_refresh_events
  ADD CONSTRAINT constants_refresh_events_duration_ms_check
  CHECK (duration_ms IS NULL OR duration_ms >= 0);

CREATE INDEX IF NOT EXISTS idx_constants_refresh_events_actor_created_at
  ON constants_refresh_events (actor, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_constants_refresh_events_success_created_at
  ON constants_refresh_events (success, created_at DESC);
