-- Migration 012: Harden job status domain + stable id default
-- Purpose:
--   1) Enforce allowed status values in jobs and dxf_tasks.
--   2) Set default id generation for jobs using UUID text.
--
-- Safety notes:
--   - Allowed statuses are aligned with runtime code in server/services:
--       queued, processing, completed, failed
--   - Existing data verified before migration: no NULL statuses and no invalid values.
--   - Constraints are created NOT VALID first, then validated, reducing lock impact.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_jobs_status'
      AND conrelid = 'public.jobs'::regclass
  ) THEN
    ALTER TABLE public.jobs
      ADD CONSTRAINT chk_jobs_status
      CHECK (status IN ('queued', 'processing', 'completed', 'failed'))
      NOT VALID;
  END IF;
END
$$;

ALTER TABLE public.jobs
  VALIDATE CONSTRAINT chk_jobs_status;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_dxf_tasks_status'
      AND conrelid = 'public.dxf_tasks'::regclass
  ) THEN
    ALTER TABLE public.dxf_tasks
      ADD CONSTRAINT chk_dxf_tasks_status
      CHECK (status IN ('queued', 'processing', 'completed', 'failed'))
      NOT VALID;
  END IF;
END
$$;

ALTER TABLE public.dxf_tasks
  VALIDATE CONSTRAINT chk_dxf_tasks_status;

ALTER TABLE public.jobs
  ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
