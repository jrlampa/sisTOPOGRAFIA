-- Migration: 076_revoke_dangerous_grants_collab_projects.sql
-- Date: 2026-05-13
-- Issue: CRITICAL security gap - anon/authenticated roles had REFERENCES and TRIGGER privileges
--        on collaboration and project tables, violating security hardening policy.
--
-- Fix: Revoke REFERENCES and TRIGGER privileges from anon/authenticated on:
--      - collaboration_history
--      - collaboration_sessions
--      - project_snapshots
--      - projects
--      - user_preferences
--
-- Impact: Maintains RLS protection while tightening grant-level security.
--         Service role (backend) retains full access via Supabase authentication.

BEGIN;

-- 1. Revoke from collaboration_history
REVOKE REFERENCES ON public.collaboration_history FROM anon;
REVOKE TRIGGER ON public.collaboration_history FROM anon;
REVOKE REFERENCES ON public.collaboration_history FROM authenticated;
REVOKE TRIGGER ON public.collaboration_history FROM authenticated;

-- 2. Revoke from collaboration_sessions
REVOKE REFERENCES ON public.collaboration_sessions FROM anon;
REVOKE TRIGGER ON public.collaboration_sessions FROM anon;
REVOKE REFERENCES ON public.collaboration_sessions FROM authenticated;
REVOKE TRIGGER ON public.collaboration_sessions FROM authenticated;

-- 3. Revoke from project_snapshots
REVOKE REFERENCES ON public.project_snapshots FROM anon;
REVOKE TRIGGER ON public.project_snapshots FROM anon;
REVOKE REFERENCES ON public.project_snapshots FROM authenticated;
REVOKE TRIGGER ON public.project_snapshots FROM authenticated;

-- 4. Revoke from projects
REVOKE REFERENCES ON public.projects FROM anon;
REVOKE TRIGGER ON public.projects FROM anon;
REVOKE REFERENCES ON public.projects FROM authenticated;
REVOKE TRIGGER ON public.projects FROM authenticated;

-- 5. Revoke from user_preferences
REVOKE REFERENCES ON public.user_preferences FROM anon;
REVOKE TRIGGER ON public.user_preferences FROM anon;
REVOKE REFERENCES ON public.user_preferences FROM authenticated;
REVOKE TRIGGER ON public.user_preferences FROM authenticated;

-- 6. Audit log: Record the security hardening action
INSERT INTO public.audit_logs (
  action,
  table_name,
  record_id,
  old_data,
  new_data,
  changed_by,
  changed_at,
  tenant_id
) VALUES (
  'SECURITY_REVOKE',
  'pg_catalog.pg_class',
  'migration-076:collab-projects-grants',
  jsonb_build_object(
    'tables', jsonb_build_array(
      'collaboration_history',
      'collaboration_sessions', 
      'project_snapshots',
      'projects',
      'user_preferences'
    ),
    'revoked_from', jsonb_build_array('anon', 'authenticated'),
    'revoked_privileges', jsonb_build_array('REFERENCES', 'TRIGGER')
  ),
  jsonb_build_object(
    'status', 'completed',
    'migration', '076_revoke_dangerous_grants_collab_projects.sql'
  ),
  null,
  now(),
  '00000000-0000-0000-0000-000000000001'
);

COMMIT;
