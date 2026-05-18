-- Migration: 108_revoke_dangerous_grants_catalog_tables.sql
-- Date: 2026-05-15
-- Purpose: Revoke REFERENCES and TRIGGER privileges from anon/authenticated
--          roles on catalog tables introduced by migrations 103 and 105.

BEGIN;

REVOKE REFERENCES ON public.conductor_catalog FROM anon;
REVOKE TRIGGER ON public.conductor_catalog FROM anon;
REVOKE REFERENCES ON public.conductor_catalog FROM authenticated;
REVOKE TRIGGER ON public.conductor_catalog FROM authenticated;

REVOKE REFERENCES ON public.conductor_catalog_history FROM anon;
REVOKE TRIGGER ON public.conductor_catalog_history FROM anon;
REVOKE REFERENCES ON public.conductor_catalog_history FROM authenticated;
REVOKE TRIGGER ON public.conductor_catalog_history FROM authenticated;

REVOKE REFERENCES ON public.pole_catalog FROM anon;
REVOKE TRIGGER ON public.pole_catalog FROM anon;
REVOKE REFERENCES ON public.pole_catalog FROM authenticated;
REVOKE TRIGGER ON public.pole_catalog FROM authenticated;

REVOKE REFERENCES ON public.pole_catalog_history FROM anon;
REVOKE TRIGGER ON public.pole_catalog_history FROM anon;
REVOKE REFERENCES ON public.pole_catalog_history FROM authenticated;
REVOKE TRIGGER ON public.pole_catalog_history FROM authenticated;

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
  'pg_catalog.pg_class',
  'migration-108:catalog-grant-revocation',
  jsonb_build_object(
    'tables_affected', jsonb_build_array(
      'conductor_catalog',
      'conductor_catalog_history',
      'pole_catalog',
      'pole_catalog_history'
    ),
    'roles_affected', jsonb_build_array('anon', 'authenticated'),
    'privileges_revoked', jsonb_build_array('REFERENCES', 'TRIGGER')
  ),
  jsonb_build_object(
    'status', 'completed',
    'migration', '108_revoke_dangerous_grants_catalog_tables.sql',
    'reason', 'Security hardening: remove dangerous DML privileges from public catalog tables'
  ),
  null,
  now(),
  '00000000-0000-0000-0000-000000000001'
);

COMMIT;
