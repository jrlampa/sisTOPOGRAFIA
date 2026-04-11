-- Migration: 018_align_jobs_and_dxf_tasks_schema.sql
-- Purpose:
--   Align runtime-required schema for public.jobs and public.dxf_tasks.
--
-- Why:
--   Runtime services expect additional columns not guaranteed by 001/012 base migrations.
--   This migration removes environment drift between migration-provisioned DBs and
--   service-first/provision-on-boot DBs.
--
-- Safety:
--   - Idempotent: uses IF NOT EXISTS where possible.
--   - Backfills with safe defaults for existing rows.
--   - Keeps existing RLS/policies untouched.

-- -----------------------------------------------------------------------------
-- 1) public.jobs: add runtime-required columns
-- -----------------------------------------------------------------------------

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS progress INTEGER;

ALTER TABLE public.jobs
  ALTER COLUMN progress SET DEFAULT 0;

UPDATE public.jobs
SET progress = 0
WHERE progress IS NULL;

ALTER TABLE public.jobs
  ALTER COLUMN progress SET NOT NULL;

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS result JSONB;

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS attempts INTEGER;

ALTER TABLE public.jobs
  ALTER COLUMN attempts SET DEFAULT 0;

UPDATE public.jobs
SET attempts = 0
WHERE attempts IS NULL;

ALTER TABLE public.jobs
  ALTER COLUMN attempts SET NOT NULL;

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS error TEXT;

-- -----------------------------------------------------------------------------
-- 2) public.dxf_tasks: add operational metadata columns used by queue worker
-- -----------------------------------------------------------------------------

ALTER TABLE public.dxf_tasks
  ADD COLUMN IF NOT EXISTS error TEXT;

ALTER TABLE public.dxf_tasks
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;

ALTER TABLE public.dxf_tasks
  ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ;

-- -----------------------------------------------------------------------------
-- 3) Migration bookkeeping
-- -----------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = '_migrations'
  ) THEN
    INSERT INTO public._migrations (filename)
    VALUES ('018_align_jobs_and_dxf_tasks_schema.sql')
    ON CONFLICT (filename) DO NOTHING;
  END IF;
END
$$;
