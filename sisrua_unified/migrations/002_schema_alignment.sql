-- Migration: 002_schema_alignment.sql
-- Purpose: Schema alignment for jobs and dxf_tasks to ensure parity with runtime.

-- 1. Align `jobs` table
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS progress INTEGER NOT NULL DEFAULT 0;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS result JSONB;

-- 2. Align `dxf_tasks` table
-- Ensure columns required by backend logic exist 
ALTER TABLE dxf_tasks ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE dxf_tasks ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ;
ALTER TABLE dxf_tasks ADD COLUMN IF NOT EXISTS error TEXT;
