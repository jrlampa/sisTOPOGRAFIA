-- Migration: 110_default_privileges_hardening_public.sql
-- Date: 2026-05-17
-- Purpose: Prevent dangerous default grants for anon/authenticated on future
--          objects created in schema public.
--
-- Rationale:
-- - Healthcheck blocks dangerous DML grants (INSERT/UPDATE/DELETE/TRUNCATE/
--   REFERENCES/TRIGGER) for anon/authenticated.
-- - This migration hardens default privileges so newly created objects do not
--   inherit unsafe privileges by default.

BEGIN;

-- Revoke dangerous table privileges by default for future objects in public.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLES FROM anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLES FROM authenticated;

-- Keep reads opt-in: future migrations should explicitly grant SELECT where needed.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE SELECT ON TABLES FROM anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE SELECT ON TABLES FROM authenticated;

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
  'SECURITY_HARDENING',
  'pg_default_acl',
  'migration-110:default-privileges-hardened',
  NULL,
  jsonb_build_object(
    'migration', '110_default_privileges_hardening_public.sql',
    'schema', 'public',
    'roles_hardened', jsonb_build_array('anon', 'authenticated'),
    'revoked_table_privileges', jsonb_build_array(
      'SELECT',
      'INSERT',
      'UPDATE',
      'DELETE',
      'TRUNCATE',
      'REFERENCES',
      'TRIGGER'
    ),
    'note', 'Future objects must grant privileges explicitly'
  ),
  NULL,
  now(),
  '00000000-0000-0000-0000-000000000001'
);

COMMIT;
