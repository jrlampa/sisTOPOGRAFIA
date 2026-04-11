-- Migration 006: Constants catalog snapshot store.
-- Before each successful manual refresh, the current in-memory catalog state
-- is serialised and persisted here so operators can inspect and roll back.

CREATE TABLE IF NOT EXISTS constants_catalog_snapshots (
    id          BIGSERIAL   PRIMARY KEY,
    namespace   TEXT        NOT NULL,
    actor       TEXT        NOT NULL DEFAULT 'system',
    label       TEXT,                                  -- optional human-readable note
    data        JSONB       NOT NULL,                  -- { key: value, ... } for the namespace
    entry_count INTEGER     NOT NULL CHECK (entry_count >= 0),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for listing snapshots per-namespace in reverse-chronological order.
CREATE INDEX IF NOT EXISTS idx_ccs_namespace_created
    ON constants_catalog_snapshots (namespace, created_at DESC);

-- Index for actor-scoped queries.
CREATE INDEX IF NOT EXISTS idx_ccs_actor_created
    ON constants_catalog_snapshots (actor, created_at DESC);

-- RLS: keep disabled so service_role reads freely; row-level controls are via
-- token-protected API layer.
ALTER TABLE constants_catalog_snapshots DISABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON constants_catalog_snapshots TO service_role;
GRANT USAGE, SELECT ON SEQUENCE constants_catalog_snapshots_id_seq TO service_role;
