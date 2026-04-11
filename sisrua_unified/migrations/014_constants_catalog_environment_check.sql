-- Migration 014: Enforce allowed values for constants_catalog.environment
-- Purpose:
--   Restrict environment to values supported by backend config.NODE_ENV.
--
-- Allowed values:
--   development, test, production
--
-- Safety notes:
--   - The backend only queries constants_catalog with config.NODE_ENV, where
--     NODE_ENV is validated as one of the same three values.
--   - Constraint is created NOT VALID first, then validated.
--   - Idempotent: guarded by pg_constraint lookup.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_constants_catalog_environment'
      AND conrelid = 'public.constants_catalog'::regclass
  ) THEN
    ALTER TABLE public.constants_catalog
      ADD CONSTRAINT chk_constants_catalog_environment
      CHECK (environment IN ('development', 'test', 'production'))
      NOT VALID;
  END IF;
END
$$;

ALTER TABLE public.constants_catalog
  VALIDATE CONSTRAINT chk_constants_catalog_environment;
