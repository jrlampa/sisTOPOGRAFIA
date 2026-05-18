-- Migration: 080_revoke_dangerous_grants_stripe_tables.sql
-- Date: 2026-05-13
-- Purpose: Revoke REFERENCES and TRIGGER permissions from anon/authenticated roles
--          on new Stripe payment tables (security hardening)
--
-- Context: The Stripe tables created in migration 078 inadvertently granted
-- REFERENCES and TRIGGER privileges to anon and authenticated roles. This
-- allows unauthenticated/semi-authenticated users to:
--   1. Create foreign key constraints (data integrity attacks)
--   2. Install custom triggers (code injection)
-- 
-- Fix: Revoke these dangerous grants explicitly for all Stripe tables.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- stripe_customers: Revoke dangerous grants
-- ─────────────────────────────────────────────────────────────────────────────

REVOKE REFERENCES ON public.stripe_customers FROM anon;
REVOKE TRIGGER ON public.stripe_customers FROM anon;
REVOKE REFERENCES ON public.stripe_customers FROM authenticated;
REVOKE TRIGGER ON public.stripe_customers FROM authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- stripe_subscriptions: Revoke dangerous grants
-- ─────────────────────────────────────────────────────────────────────────────

REVOKE REFERENCES ON public.stripe_subscriptions FROM anon;
REVOKE TRIGGER ON public.stripe_subscriptions FROM anon;
REVOKE REFERENCES ON public.stripe_subscriptions FROM authenticated;
REVOKE TRIGGER ON public.stripe_subscriptions FROM authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- stripe_invoices: Revoke dangerous grants
-- ─────────────────────────────────────────────────────────────────────────────

REVOKE REFERENCES ON public.stripe_invoices FROM anon;
REVOKE TRIGGER ON public.stripe_invoices FROM anon;
REVOKE REFERENCES ON public.stripe_invoices FROM authenticated;
REVOKE TRIGGER ON public.stripe_invoices FROM authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- stripe_webhooks_log: Revoke dangerous grants
-- ─────────────────────────────────────────────────────────────────────────────

REVOKE REFERENCES ON public.stripe_webhooks_log FROM anon;
REVOKE TRIGGER ON public.stripe_webhooks_log FROM anon;
REVOKE REFERENCES ON public.stripe_webhooks_log FROM authenticated;
REVOKE TRIGGER ON public.stripe_webhooks_log FROM authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Document in audit log
-- ─────────────────────────────────────────────────────────────────────────────

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
  'migration-080:stripe-grant-revocation',
  jsonb_build_object(
    'tables_affected', jsonb_build_array(
      'stripe_customers',
      'stripe_subscriptions',
      'stripe_invoices',
      'stripe_webhooks_log'
    ),
    'roles_affected', jsonb_build_array('anon', 'authenticated'),
    'privileges_revoked', jsonb_build_array('REFERENCES', 'TRIGGER')
  ),
  jsonb_build_object(
    'status', 'completed',
    'migration', '080_revoke_dangerous_grants_stripe_tables.sql',
    'reason', 'Security hardening: prevent FK injection and trigger installation attacks'
  ),
  null,
  now(),
  '00000000-0000-0000-0000-000000000001'
);

COMMIT;
