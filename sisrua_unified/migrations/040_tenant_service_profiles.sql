-- Migration: 040_tenant_service_profiles.sql
-- Objetivo: Catálogo de perfis de serviço por tenant (SaaS SoA enterprise).
-- Escopo:
--   1) Tabela tenant_service_profiles com SLA/SLO e governança de suporte.
--   2) Índices para consultas operacionais por tenant e tier.
--   3) Trigger de updated_at.

CREATE TABLE IF NOT EXISTS public.tenant_service_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  service_code TEXT NOT NULL,
  service_name TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum')),
  sla_availability_pct NUMERIC(6,3) NOT NULL CHECK (sla_availability_pct >= 90 AND sla_availability_pct <= 99.999),
  slo_latency_p95_ms INTEGER NOT NULL CHECK (slo_latency_p95_ms >= 10 AND slo_latency_p95_ms <= 60000),
  support_channel TEXT NOT NULL,
  support_hours TEXT NOT NULL,
  escalation_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_tenant_service_profiles_tenant_service UNIQUE (tenant_id, service_code)
);

COMMENT ON TABLE public.tenant_service_profiles IS
  'Catálogo de perfil de serviço por tenant com SLA/SLO, suporte e escalonamento. Roadmap enterprise SoA.';

COMMENT ON COLUMN public.tenant_service_profiles.escalation_policy IS
  'Regras de escalonamento e on-call por tenant/serviço.';

COMMENT ON COLUMN public.tenant_service_profiles.metadata IS
  'Metadados complementares de contrato e operação (BIM/ops/compliance).';

CREATE INDEX IF NOT EXISTS idx_tenant_service_profiles_tenant_id
  ON public.tenant_service_profiles (tenant_id);

CREATE INDEX IF NOT EXISTS idx_tenant_service_profiles_tier
  ON public.tenant_service_profiles (tier)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_tenant_service_profiles_service_code
  ON public.tenant_service_profiles (service_code);

CREATE OR REPLACE FUNCTION public.set_tenant_service_profiles_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tenant_service_profiles_updated_at ON public.tenant_service_profiles;
CREATE TRIGGER trg_tenant_service_profiles_updated_at
  BEFORE UPDATE ON public.tenant_service_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_service_profiles_updated_at();

INSERT INTO public.schema_migrations (filename)
VALUES ('040_tenant_service_profiles.sql')
ON CONFLICT (filename) DO NOTHING;
