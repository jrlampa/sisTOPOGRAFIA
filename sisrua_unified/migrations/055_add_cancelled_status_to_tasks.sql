-- Migration 055: Add 'cancelled' status to jobs and dxf_tasks
-- Purpose: Allow sanitation of invalid/stale jobs without deleting them.

-- 1. Update jobs table constraint
ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS chk_jobs_status;
ALTER TABLE public.jobs ADD CONSTRAINT chk_jobs_status 
  CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled'));

-- 2. Update dxf_tasks table constraint
ALTER TABLE public.dxf_tasks DROP CONSTRAINT IF EXISTS chk_dxf_tasks_status;
ALTER TABLE public.dxf_tasks ADD CONSTRAINT chk_dxf_tasks_status 
  CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled'));
