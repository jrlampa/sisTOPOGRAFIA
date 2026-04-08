-- Seed: 003_operational_config_constants.sql
-- Purpose: Seed small operational configuration constants into constants_catalog.
--          This is the pilot namespace for runtime config overrides with safe fallback.
--
-- Run after migration 002_constants_catalog.sql.
-- Safe to re-run (ON CONFLICT ... DO UPDATE).

INSERT INTO constants_catalog (namespace, key, value, version_hash, environment, description)
VALUES
  ('config', 'DXF_FILE_TTL_MS', 600000::jsonb, '1.0.0', 'production', 'DXF scheduled deletion TTL in milliseconds'),
  ('config', 'DXF_MAX_AGE_MS', 7200000::jsonb, '1.0.0', 'production', 'Hard maximum DXF retention age in milliseconds'),
  ('config', 'DXF_CLEANUP_INTERVAL_MS', 120000::jsonb, '1.0.0', 'production', 'DXF cleanup sweep interval in milliseconds'),
  ('config', 'RATE_LIMIT_GENERAL_WINDOW_MS', 900000::jsonb, '1.0.0', 'production', 'General API rate limit fixed window in milliseconds'),
  ('config', 'RATE_LIMIT_GENERAL_MAX', 100::jsonb, '1.0.0', 'production', 'General API rate limit max requests per fixed window'),
  ('config', 'RATE_LIMIT_DXF_WINDOW_MS', 3600000::jsonb, '1.0.0', 'production', 'DXF API rate limit fixed window in milliseconds'),
  ('config', 'RATE_LIMIT_DXF_MAX', 10::jsonb, '1.0.0', 'production', 'DXF API rate limit max requests per fixed window')
ON CONFLICT (namespace, key, environment) DO UPDATE
  SET value        = EXCLUDED.value,
      version_hash = EXCLUDED.version_hash,
      description  = EXCLUDED.description,
      is_active    = true;