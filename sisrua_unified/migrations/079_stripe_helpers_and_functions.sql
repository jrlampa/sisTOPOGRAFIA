-- Migration: 079_stripe_helpers_and_functions.sql
-- Date: 2026-05-13
-- Purpose: Add PL/pgSQL functions for Stripe integration operations
--
-- Functions:
--   - get_user_active_subscription(): Query user's active subscription
--   - ensure_stripe_customer(): Idempotent customer creation/lookup
--   - update_subscription_status(): Sync Stripe subscription state

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Get user's active subscription details
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_user_active_subscription(p_user_id TEXT)
RETURNS TABLE (
  subscription_id UUID,
  stripe_subscription_id TEXT,
  stripe_price_id TEXT,
  status TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  is_active BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ss.id,
    ss.stripe_subscription_id,
    ss.stripe_price_id,
    ss.status,
    ss.current_period_start,
    ss.current_period_end,
    (ss.status IN ('active', 'past_due'))::BOOLEAN
  FROM public.stripe_subscriptions ss
  INNER JOIN public.stripe_customers sc 
    ON ss.stripe_customer_id = sc.stripe_customer_id
  WHERE sc.user_id = p_user_id
    AND ss.status IN ('active', 'past_due')
  ORDER BY ss.updated_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Ensure Stripe customer exists (idempotent)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.ensure_stripe_customer(
  p_user_id TEXT,
  p_tenant_id UUID,
  p_stripe_customer_id TEXT,
  p_email TEXT
)
RETURNS UUID AS $$
DECLARE
  v_customer_id UUID;
BEGIN
  -- Try to find existing customer
  SELECT id INTO v_customer_id
  FROM public.stripe_customers
  WHERE user_id = p_user_id;

  -- If exists, return it
  IF v_customer_id IS NOT NULL THEN
    RETURN v_customer_id;
  END IF;

  -- Create new customer
  INSERT INTO public.stripe_customers (
    user_id,
    tenant_id,
    stripe_customer_id,
    email,
    metadata
  ) VALUES (
    p_user_id,
    p_tenant_id,
    p_stripe_customer_id,
    p_email,
    jsonb_build_object('created_by', 'auth_onboarding')
  )
  RETURNING id INTO v_customer_id;

  RETURN v_customer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Update subscription status (called from webhook)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_stripe_subscription_from_webhook(
  p_stripe_subscription_id TEXT,
  p_stripe_price_id TEXT,
  p_status TEXT,
  p_current_period_start TIMESTAMPTZ,
  p_current_period_end TIMESTAMPTZ,
  p_cancel_at TIMESTAMPTZ,
  p_metadata JSONB
)
RETURNS UUID AS $$
DECLARE
  v_subscription_id UUID;
BEGIN
  -- Try to find and update existing subscription
  UPDATE public.stripe_subscriptions
  SET
    stripe_price_id = COALESCE(p_stripe_price_id, stripe_price_id),
    status = COALESCE(p_status, status),
    current_period_start = COALESCE(p_current_period_start, current_period_start),
    current_period_end = COALESCE(p_current_period_end, current_period_end),
    cancel_at = COALESCE(p_cancel_at, cancel_at),
    metadata = jsonb_set(COALESCE(metadata, '{}'), '{webhook_updated}', to_jsonb(now())),
    updated_at = now()
  WHERE stripe_subscription_id = p_stripe_subscription_id
  RETURNING id INTO v_subscription_id;

  -- If update succeeded, return subscription ID
  IF v_subscription_id IS NOT NULL THEN
    RETURN v_subscription_id;
  END IF;

  -- If no subscription exists, return NULL (should be handled by webhook logic)
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Log failed webhook for manual review
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.log_failed_webhook(
  p_event_id TEXT,
  p_event_type TEXT,
  p_stripe_customer_id TEXT,
  p_data JSONB,
  p_error_message TEXT
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.stripe_webhooks_log (
    event_id,
    event_type,
    stripe_customer_id,
    data,
    processed,
    error,
    created_at
  ) VALUES (
    p_event_id,
    p_event_type,
    p_stripe_customer_id,
    p_data,
    false,
    p_error_message,
    now()
  )
  RETURNING id INTO v_log_id;

  -- Log to audit trail as well
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
    'WEBHOOK_FAILED',
    'stripe_webhooks_log',
    v_log_id::TEXT,
    jsonb_build_object('event_type', p_event_type),
    jsonb_build_object('error', p_error_message),
    null,
    now(),
    '00000000-0000-0000-0000-000000000001'
  );

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Get subscription renewal warning (for reminder emails)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_subscriptions_needing_renewal_warning()
RETURNS TABLE (
  user_id TEXT,
  email TEXT,
  tenant_id UUID,
  stripe_subscription_id TEXT,
  days_until_renewal INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sc.user_id,
    sc.email,
    sc.tenant_id,
    ss.stripe_subscription_id,
    (EXTRACT(DAY FROM (ss.current_period_end - now())))::INT as days_until_renewal
  FROM public.stripe_subscriptions ss
  INNER JOIN public.stripe_customers sc 
    ON ss.stripe_customer_id = sc.stripe_customer_id
  WHERE ss.status IN ('active', 'past_due')
    AND ss.current_period_end > now()
    AND EXTRACT(DAY FROM (ss.current_period_end - now())) <= 7  -- Within 7 days
  ORDER BY ss.current_period_end ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Cleanup: Archive old webhook logs (retention: 90 days)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.cleanup_old_webhook_logs()
RETURNS INTEGER AS $$
DECLARE
  v_deleted_count INT;
BEGIN
  -- Move old logs to archive (in production, you'd move to cold storage)
  WITH deleted AS (
    DELETE FROM public.stripe_webhooks_log
    WHERE created_at < now() - INTERVAL '90 days'
      AND processed = true
    RETURNING *
  )
  SELECT COUNT(*) INTO v_deleted_count FROM deleted;

  -- Log cleanup operation
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
    'MAINTENANCE',
    'stripe_webhooks_log',
    'cleanup-old-logs',
    null,
    jsonb_build_object('deleted_records', v_deleted_count),
    null,
    now(),
    '00000000-0000-0000-0000-000000000001'
  );

  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Verify subscription is valid for tenant (authorization check)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_tenant_subscription_active(
  p_user_id TEXT,
  p_tenant_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_has_active BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1
    FROM public.stripe_subscriptions ss
    INNER JOIN public.stripe_customers sc 
      ON ss.stripe_customer_id = sc.stripe_customer_id
    WHERE sc.user_id = p_user_id
      AND sc.tenant_id = p_tenant_id
      AND ss.status IN ('active', 'past_due')
      AND ss.current_period_end > now()
  ) INTO v_has_active;

  RETURN v_has_active;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Document migration
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
  'MIGRATION',
  'pg_catalog.pg_proc',
  'migration-079:stripe-helpers',
  null,
  jsonb_build_object(
    'functions_created', jsonb_build_array(
      'get_user_active_subscription',
      'ensure_stripe_customer',
      'update_stripe_subscription_from_webhook',
      'log_failed_webhook',
      'get_subscriptions_needing_renewal_warning',
      'cleanup_old_webhook_logs',
      'is_tenant_subscription_active'
    )
  ),
  null,
  now(),
  '00000000-0000-0000-0000-000000000001'
);

COMMIT;
