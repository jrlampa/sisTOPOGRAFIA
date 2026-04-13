-- 019_audit_soft_delete_indices.sql
-- Implementação de Auditoria, Soft Delete e Índices de Performance

-- 1. SISTEMA DE AUDITORIA
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    action TEXT NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
    old_data JSONB,
    new_data JSONB,
    changed_by UUID REFERENCES auth.users(id),
    changed_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS na auditoria (apenas leitura para técnicos/admin)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Audit logs are viewable by authenticated users" ON public.audit_logs
    FOR SELECT USING (auth.role() = 'authenticated');

-- Trigger function para auditoria
CREATE OR REPLACE FUNCTION public.proc_audit_log()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        INSERT INTO public.audit_logs (table_name, record_id, action, old_data, changed_by)
        VALUES (TG_TABLE_NAME, OLD.id, TG_OP, to_jsonb(OLD), auth.uid());
        RETURN OLD;
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO public.audit_logs (table_name, record_id, action, old_data, new_data, changed_by)
        VALUES (TG_TABLE_NAME, NEW.id, TG_OP, to_jsonb(OLD), to_jsonb(NEW), auth.uid());
        RETURN NEW;
    ELSIF (TG_OP = 'INSERT') THEN
        INSERT INTO public.audit_logs (table_name, record_id, action, new_data, changed_by)
        VALUES (TG_TABLE_NAME, NEW.id, TG_OP, to_jsonb(NEW), auth.uid());
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. SOFT DELETE E ÍNDICES EM CONSTANTS_CATALOG
ALTER TABLE public.constants_catalog ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Índices compostos para busca rápida no catálogo
CREATE INDEX IF NOT EXISTS idx_constants_ns_key_deleted ON public.constants_catalog (namespace, key) WHERE (deleted_at IS NULL);

-- Aplicar auditoria ao catálogo
DROP TRIGGER IF EXISTS trg_audit_constants_catalog ON public.constants_catalog;
CREATE TRIGGER trg_audit_constants_catalog
AFTER INSERT OR UPDATE OR DELETE ON public.constants_catalog
FOR EACH ROW EXECUTE FUNCTION public.proc_audit_log();

-- 3. ÍNDICES DE PERFORMANCE NO HISTÓRICO BT
-- Índice composto para histórico por usuário e data
CREATE INDEX IF NOT EXISTS idx_bt_history_user_date ON public.bt_export_history (user_id, created_at DESC);

-- 4. ÍNDICES NO JOBS
CREATE INDEX IF NOT EXISTS idx_jobs_status_created ON public.jobs (status, created_at DESC);

-- Sugestão de manutenção automática (requer pg_cron se disponível)
-- DELETE FROM public.jobs WHERE created_at < now() - interval '30 days';
