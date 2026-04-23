-- 053_dg_normalized_persistence.sql
-- Expande a persistencia DG para tabelas normalizadas de candidatos/cenarios/restricoes/recomendacoes.

CREATE TABLE IF NOT EXISTS dg_candidates (
  run_id TEXT NOT NULL,
  candidate_id TEXT NOT NULL,
  source TEXT,
  position_latlon_json JSONB NOT NULL,
  position_utm_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (run_id, candidate_id),
  CONSTRAINT fk_dg_candidates_run
    FOREIGN KEY (run_id)
    REFERENCES dg_runs(run_id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS dg_scenarios (
  run_id TEXT NOT NULL,
  scenario_id TEXT NOT NULL,
  candidate_id TEXT,
  feasible BOOLEAN NOT NULL,
  objective_score DOUBLE PRECISION NOT NULL,
  electrical_json JSONB NOT NULL,
  score_components_json JSONB NOT NULL,
  violations_count INTEGER NOT NULL DEFAULT 0,
  scenario_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (run_id, scenario_id),
  CONSTRAINT fk_dg_scenarios_run
    FOREIGN KEY (run_id)
    REFERENCES dg_runs(run_id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS dg_constraints (
  id BIGSERIAL PRIMARY KEY,
  run_id TEXT NOT NULL,
  scenario_id TEXT NOT NULL,
  ordinal INTEGER NOT NULL,
  code TEXT NOT NULL,
  detail TEXT NOT NULL,
  entity_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_dg_constraints_scenario
    FOREIGN KEY (run_id, scenario_id)
    REFERENCES dg_scenarios(run_id, scenario_id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS dg_recommendations (
  id BIGSERIAL PRIMARY KEY,
  run_id TEXT NOT NULL,
  rank_order INTEGER NOT NULL,
  scenario_id TEXT,
  kind TEXT NOT NULL,
  objective_score DOUBLE PRECISION,
  recommendation_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_dg_recommendations_run_rank UNIQUE (run_id, rank_order),
  CONSTRAINT fk_dg_recommendations_run
    FOREIGN KEY (run_id)
    REFERENCES dg_runs(run_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_dg_candidates_run_created
  ON dg_candidates (run_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dg_scenarios_run_score
  ON dg_scenarios (run_id, objective_score DESC);

CREATE INDEX IF NOT EXISTS idx_dg_scenarios_created
  ON dg_scenarios (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dg_constraints_run_code
  ON dg_constraints (run_id, code);

CREATE INDEX IF NOT EXISTS idx_dg_recommendations_run_rank
  ON dg_recommendations (run_id, rank_order);

-- Colunas de geometria opcionais (somente quando PostGIS estiver instalado)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') THEN
    EXECUTE 'ALTER TABLE dg_candidates ADD COLUMN IF NOT EXISTS geom_point geometry(Point, 4326)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_dg_candidates_geom ON dg_candidates USING GIST (geom_point)';

    EXECUTE 'ALTER TABLE dg_scenarios ADD COLUMN IF NOT EXISTS geom_trafo geometry(Point, 4326)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_dg_scenarios_geom_trafo ON dg_scenarios USING GIST (geom_trafo)';
  END IF;
END $$;

CREATE OR REPLACE VIEW dg_run_ranking_v AS
SELECT
  s.run_id,
  s.scenario_id,
  s.feasible,
  s.objective_score,
  ROW_NUMBER() OVER (
    PARTITION BY s.run_id
    ORDER BY s.feasible DESC, s.objective_score DESC
  ) AS rank_in_run,
  s.created_at
FROM dg_scenarios s;

CREATE OR REPLACE VIEW dg_discard_rate_by_constraint_v AS
WITH totals AS (
  SELECT run_id, COUNT(*)::NUMERIC AS total_scenarios
  FROM dg_scenarios
  GROUP BY run_id
)
SELECT
  c.run_id,
  c.code,
  COUNT(DISTINCT c.scenario_id) AS discarded_scenarios,
  t.total_scenarios,
  CASE
    WHEN t.total_scenarios = 0 THEN 0
    ELSE ROUND((COUNT(DISTINCT c.scenario_id)::NUMERIC / t.total_scenarios) * 100, 2)
  END AS discard_rate_percent
FROM dg_constraints c
JOIN totals t ON t.run_id = c.run_id
GROUP BY c.run_id, c.code, t.total_scenarios;
