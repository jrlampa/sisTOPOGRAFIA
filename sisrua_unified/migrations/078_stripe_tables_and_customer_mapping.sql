-- Migration: 078_stripe_tables_and_customer_mapping.sql
-- Date: 2026-05-13
-- Purpose: Add Stripe payment integration schema for subscription management
--
-- Tables:
--   - stripe_customers: Map users to Stripe customer IDs
--   - stripe_subscriptions: Track active subscriptions per customer
--   - stripe_invoices: Invoice history for billing records
--   - stripe_webhooks_log: Audit trail for webhook events
--
-- Strategy:
--   1. Create payment tables with strong FK constraints
--   2. Enable RLS for data isolation
--   3. Create indexes for common queries
--   4. Add audit logging for compliance

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. STRIPE CUSTOMERS - Map users to Stripe customer IDs
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.stripe_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  stripe_customer_id TEXT NOT NULL,
  email TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_stripe_customers_user UNIQUE (user_id),
  CONSTRAINT fk_stripe_customers_stripe_id UNIQUE (stripe_customer_id)
);

CREATE INDEX IF NOT EXISTS idx_stripe_customers_user_id 
  ON public.stripe_customers (user_id);
CREATE INDEX IF NOT EXISTS idx_stripe_customers_tenant_id
  ON public.stripe_customers (tenant_id);
CREATE INDEX IF NOT EXISTS idx_stripe_customers_stripe_id
  ON public.stripe_customers (stripe_customer_id);

-- Enable RLS
ALTER TABLE public.stripe_customers ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own Stripe customer record
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'stripe_customers' 
    AND policyname = 'user_can_view_own_stripe_customer'
  ) THEN
    CREATE POLICY user_can_view_own_stripe_customer ON public.stripe_customers
      FOR SELECT USING (user_id = auth.uid()::TEXT);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'stripe_customers' 
    AND policyname = 'stripe_customers_select_authenticated'
  ) THEN
    CREATE POLICY stripe_customers_select_authenticated ON public.stripe_customers
      FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
END
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. STRIPE SUBSCRIPTIONS - Track active subscriptions
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.stripe_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_customer_id TEXT NOT NULL REFERENCES public.stripe_customers(stripe_customer_id) ON DELETE CASCADE,
  stripe_subscription_id TEXT NOT NULL,
  stripe_price_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'past_due', 'unpaid', 'cancelled', 'incomplete')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_stripe_subscriptions_stripe_id UNIQUE (stripe_subscription_id)
);

CREATE INDEX IF NOT EXISTS idx_stripe_subscriptions_customer_id
  ON public.stripe_subscriptions (stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_stripe_subscriptions_status
  ON public.stripe_subscriptions (status) WHERE status IN ('active', 'past_due');
CREATE INDEX IF NOT EXISTS idx_stripe_subscriptions_period_end
  ON public.stripe_subscriptions (current_period_end DESC);

-- Enable RLS
ALTER TABLE public.stripe_subscriptions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'stripe_subscriptions' 
    AND policyname = 'user_can_view_own_subscriptions'
  ) THEN
    CREATE POLICY user_can_view_own_subscriptions ON public.stripe_subscriptions
      FOR SELECT USING (
        stripe_customer_id IN (
          SELECT stripe_customer_id FROM public.stripe_customers 
          WHERE user_id = auth.uid()::TEXT
        )
      );
  END IF;
END
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. STRIPE INVOICES - Payment history for billing records
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.stripe_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_customer_id TEXT NOT NULL REFERENCES public.stripe_customers(stripe_customer_id) ON DELETE CASCADE,
  stripe_invoice_id TEXT NOT NULL,
  stripe_subscription_id TEXT,
  amount_due BIGINT,
  amount_paid BIGINT,
  currency TEXT DEFAULT 'brl' CHECK (currency IN ('brl', 'usd')),
  status TEXT NOT NULL CHECK (status IN ('draft', 'open', 'paid', 'void', 'uncollectible')),
  paid BOOLEAN DEFAULT false,
  payment_intent TEXT,
  invoice_pdf_url TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_stripe_invoices_stripe_id UNIQUE (stripe_invoice_id)
);

CREATE INDEX IF NOT EXISTS idx_stripe_invoices_customer_id
  ON public.stripe_invoices (stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_stripe_invoices_status
  ON public.stripe_invoices (status);
CREATE INDEX IF NOT EXISTS idx_stripe_invoices_created
  ON public.stripe_invoices (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stripe_invoices_paid
  ON public.stripe_invoices (paid) WHERE paid = false;

-- Enable RLS
ALTER TABLE public.stripe_invoices ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'stripe_invoices' 
    AND policyname = 'user_can_view_own_invoices'
  ) THEN
    CREATE POLICY user_can_view_own_invoices ON public.stripe_invoices
      FOR SELECT USING (
        stripe_customer_id IN (
          SELECT stripe_customer_id FROM public.stripe_customers 
          WHERE user_id = auth.uid()::TEXT
        )
      );
  END IF;
END
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. STRIPE WEBHOOKS LOG - Audit trail for webhook events
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.stripe_webhooks_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  stripe_customer_id TEXT,
  data JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  error TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_stripe_webhooks_event_id UNIQUE (event_id)
);

CREATE INDEX IF NOT EXISTS idx_stripe_webhooks_event_type
  ON public.stripe_webhooks_log (event_type);
CREATE INDEX IF NOT EXISTS idx_stripe_webhooks_customer_id
  ON public.stripe_webhooks_log (stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_stripe_webhooks_processed
  ON public.stripe_webhooks_log (processed) WHERE processed = false;
CREATE INDEX IF NOT EXISTS idx_stripe_webhooks_created
  ON public.stripe_webhooks_log (created_at DESC);

-- Enable RLS (system/service role only)
ALTER TABLE public.stripe_webhooks_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'stripe_webhooks_log' 
    AND policyname = 'stripe_webhooks_service_only'
  ) THEN
    CREATE POLICY stripe_webhooks_service_only ON public.stripe_webhooks_log
      FOR SELECT USING (false);
  END IF;
END
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. VIEW: Active subscriptions per user (for quick status checks)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.v_user_active_subscriptions AS
SELECT
  sc.user_id,
  sc.tenant_id,
  ss.id as subscription_id,
  ss.stripe_subscription_id,
  ss.stripe_price_id,
  ss.status,
  ss.current_period_start,
  ss.current_period_end,
  ss.cancel_at,
  CASE
    WHEN ss.status = 'active' THEN 'ATIVO'
    WHEN ss.status = 'past_due' THEN 'VENCIDO'
    WHEN ss.status = 'cancelled' THEN 'CANCELADO'
    WHEN ss.status = 'incomplete' THEN 'INCOMPLETO'
    ELSE 'DESCONHECIDO'
  END as status_pt
FROM public.stripe_customers sc
LEFT JOIN public.stripe_subscriptions ss 
  ON sc.stripe_customer_id = ss.stripe_customer_id
WHERE ss.status IN ('active', 'past_due', 'incomplete')
  OR (ss.status = 'cancelled' AND ss.cancel_at > now() - INTERVAL '30 days');

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Audit logging for Stripe tables
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TRIGGER trg_audit_stripe_customers
AFTER INSERT OR UPDATE OR DELETE ON public.stripe_customers
FOR EACH ROW EXECUTE FUNCTION public.proc_audit_log_generic();

CREATE TRIGGER trg_audit_stripe_subscriptions
AFTER INSERT OR UPDATE OR DELETE ON public.stripe_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.proc_audit_log_generic();

CREATE TRIGGER trg_audit_stripe_invoices
AFTER INSERT OR UPDATE OR DELETE ON public.stripe_invoices
FOR EACH ROW EXECUTE FUNCTION public.proc_audit_log_generic();

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Document migration in audit log
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
  'pg_catalog.pg_class',
  'migration-078:stripe-integration',
  jsonb_build_object(
    'tables_created', jsonb_build_array(
      'stripe_customers',
      'stripe_subscriptions',
      'stripe_invoices',
      'stripe_webhooks_log'
    )
  ),
  jsonb_build_object(
    'status', 'completed',
    'migration', '078_stripe_tables_and_customer_mapping.sql',
    'purpose', 'Payment integration schema for Stripe subscriptions',
    'rls_enabled', true,
    'audit_logging_enabled', true
  ),
  null,
  now(),
  '00000000-0000-0000-0000-000000000001'
);

COMMIT;
