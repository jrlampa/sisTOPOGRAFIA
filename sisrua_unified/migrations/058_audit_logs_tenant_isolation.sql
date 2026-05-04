-- Migration: 058_audit_logs_tenant_isolation.sql
-- Objetivo: Garantir que logs de auditoria sejam isolados por tenant e persistentes.
--
-- Estratégia:
--   1. Adicionar tenant_id às tabelas de auditoria.
--   2. Habilitar RLS com isolamento por tenant.
--   3. Atualizar função de trigger para capturar tenant_id do contexto.

-- 1. Adicionar tenant_id às tabelas (Idempotente)
ALTER TABLE IF EXISTS public.audit_logs
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE RESTRICT;

ALTER TABLE IF EXISTS public.audit_logs_partitioned
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE RESTRICT;

ALTER TABLE IF EXISTS private.audit_logs_archive
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE RESTRICT;

-- 2. Backfill: Associar logs órfãos ao tenant padrão
UPDATE public.audit_logs SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.audit_logs_partitioned SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;

-- 3. Índices de performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON public.audit_logs (tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_partitioned_tenant_id ON public.audit_logs_partitioned (tenant_id);

-- 4. Habilitar RLS e Policies
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs_partitioned ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Policy para audit_logs
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'audit_logs' AND policyname = 'tenant_isolation_audit_logs'
  ) THEN
    CREATE POLICY tenant_isolation_audit_logs ON public.audit_logs
      USING (tenant_id = public.current_tenant_id() OR auth.role() = 'service_role');
  END IF;

  -- Policy para audit_logs_partitioned
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'audit_logs_partitioned' AND policyname = 'tenant_isolation_audit_logs_partitioned'
  ) THEN
    CREATE POLICY tenant_isolation_audit_logs_partitioned ON public.audit_logs_partitioned
      USING (tenant_id = public.current_tenant_id() OR auth.role() = 'service_role');
  END IF;
END $$;

-- 5. Atualizar função de trigger de auditoria para capturar tenant_id
CREATE OR REPLACE FUNCTION public.proc_audit_log()
RETURNS TRIGGER AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    -- Tenta pegar do contexto da app, senão do registro se disponível, senão default
    v_tenant_id := COALESCE(
        public.current_tenant_id(),
        (CASE WHEN TG_OP = 'DELETE' THEN (OLD.tenant_id) ELSE (NEW.tenant_id) END),
        '00000000-0000-0000-0000-000000000001'::UUID
    );

    IF (TG_OP = 'DELETE') THEN
        INSERT INTO public.audit_logs (table_name, record_id, action, old_data, changed_by, tenant_id)
        VALUES (TG_TABLE_NAME, OLD.id::TEXT, TG_OP, to_jsonb(OLD), auth.uid(), v_tenant_id);
        RETURN OLD;
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO public.audit_logs (table_name, record_id, action, old_data, new_data, changed_by, tenant_id)
        VALUES (TG_TABLE_NAME, NEW.id::TEXT, TG_OP, to_jsonb(OLD), to_jsonb(NEW), auth.uid(), v_tenant_id);
        RETURN NEW;
    ELSIF (TG_OP = 'INSERT') THEN
        INSERT INTO public.audit_logs (table_name, record_id, action, new_data, changed_by, tenant_id)
        VALUES (TG_TABLE_NAME, NEW.id::TEXT, TG_OP, to_jsonb(NEW), auth.uid(), v_tenant_id);
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Registrar migração
INSERT INTO public._migrations (filename)
VALUES ('058_audit_logs_tenant_isolation.sql')
ON CONFLICT (filename) DO NOTHING;
