-- Migration: 081_revoke_dangerous_grants_stripe_view.sql
-- Date: 2026-05-13
-- Purpose: Revoke REFERENCES and TRIGGER permissions from anon/authenticated roles
--          on Stripe subscription view

BEGIN;

-- Revoke dangerous grants from the view
REVOKE REFERENCES ON public.v_user_active_subscriptions FROM anon;
REVOKE TRIGGER ON public.v_user_active_subscriptions FROM anon;
REVOKE REFERENCES ON public.v_user_active_subscriptions FROM authenticated;
REVOKE TRIGGER ON public.v_user_active_subscriptions FROM authenticated;

-- Document in audit log
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
  'migration-081:stripe-view-grant-revocation',
  jsonb_build_object(
    'view_affected', 'v_user_active_subscriptions',
    'roles_affected', jsonb_build_array('anon', 'authenticated'),
    'privileges_revoked', jsonb_build_array('REFERENCES', 'TRIGGER')
  ),
  jsonb_build_object(
    'status', 'completed',
    'migration', '081_revoke_dangerous_grants_stripe_view.sql'
  ),
  null,
  now(),
  '00000000-0000-0000-0000-000000000001'
);

COMMIT;
