-- Migration 009: Persisted BT export history (frontend + backend)
-- Purpose: store BT critical point summaries in Postgres for cross-session traceability.

CREATE TABLE IF NOT EXISTS bt_export_history (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    project_type TEXT NOT NULL CHECK (project_type IN ('ramais', 'clandestino')),
    bt_context_url TEXT NOT NULL,
    critical_pole_id TEXT NOT NULL,
    critical_accumulated_clients INTEGER NOT NULL CHECK (critical_accumulated_clients >= 0),
    critical_accumulated_demand_kva NUMERIC(14,3) NOT NULL CHECK (critical_accumulated_demand_kva >= 0),
    verified_poles INTEGER,
    total_poles INTEGER,
    verified_edges INTEGER,
    total_edges INTEGER,
    verified_transformers INTEGER,
    total_transformers INTEGER,
    cqt_scenario TEXT,
    cqt_dmdi NUMERIC(14,6),
    cqt_p31 NUMERIC(14,6),
    cqt_p32 NUMERIC(14,6),
    cqt_k10_qt_mttr NUMERIC(14,9),
    cqt_parity_status TEXT,
    cqt_parity_passed INTEGER,
    cqt_parity_failed INTEGER,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_bt_export_history_created_at_desc
    ON bt_export_history (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bt_export_history_project_type_created_at
    ON bt_export_history (project_type, created_at DESC);

-- Defense in depth: deny Data API access from anon/authenticated.
ALTER TABLE bt_export_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bt_export_history_deny_anon ON bt_export_history;
CREATE POLICY bt_export_history_deny_anon ON bt_export_history
    FOR ALL TO anon
    USING (false)
    WITH CHECK (false);

DROP POLICY IF EXISTS bt_export_history_deny_authenticated ON bt_export_history;
CREATE POLICY bt_export_history_deny_authenticated ON bt_export_history
    FOR ALL TO authenticated
    USING (false)
    WITH CHECK (false);

GRANT SELECT, INSERT, UPDATE, DELETE ON bt_export_history TO service_role;
GRANT USAGE, SELECT ON SEQUENCE bt_export_history_id_seq TO service_role;
