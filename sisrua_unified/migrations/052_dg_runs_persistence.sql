-- 052_dg_runs_persistence.sql
-- Persistência operacional de execuções do Design Generativo (DG).

CREATE TABLE IF NOT EXISTS dg_runs (
  run_id TEXT PRIMARY KEY,
  input_hash TEXT NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL,
  total_candidates_evaluated INTEGER NOT NULL,
  total_feasible INTEGER NOT NULL,
  output_json JSONB NOT NULL,
  recommendation_json JSONB,
  scenarios_json JSONB NOT NULL,
  params_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dg_runs_computed_at ON dg_runs (computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_dg_runs_created_at ON dg_runs (created_at DESC);
