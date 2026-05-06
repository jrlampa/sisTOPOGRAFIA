-- Migration: 021_audit_soft_delete_business_tables.sql
-- Purpose: Expandir auditoria e soft delete para tabelas de negócio relevantes
--          além do constants_catalog (que já foi coberto em 019).
--
-- Tabelas cobertas:
--   - public.jobs            (TEXT PK)
--   - public.dxf_tasks       (SERIAL PK)
--   - public.bt_export_history (BIGSERIAL PK)
--   - public.user_roles      (UUID PK – já tem audit table, aqui adiciona soft delete)
--
-- Padrão aplicado:
--   1. Coluna deleted_at TIMESTAMPTZ (soft delete)
--   2. Índice parcial WHERE deleted_at IS NULL para consultas ativas
--   3. Trigger de auditoria via proc_audit_log_generic() que aceita PK de qualquer tipo
--
-- Idempotente: todas as operações usam IF NOT EXISTS / OR REPLACE.

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. Função de auditoria genérica (PK como TEXT, aceita qualquer tipo via cast)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.proc_audit_log_generic()
RETURNS TRIGGER AS $$
DECLARE
  v_pk TEXT;
  v_record_id UUID;
BEGIN
  -- Extrai a chave primária como texto independente do tipo
  IF (TG_OP = 'DELETE') THEN
    v_pk := (to_jsonb(OLD) ->> 'id');
    v_record_id := CASE
      WHEN v_pk ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        THEN v_pk::uuid
      ELSE gen_random_uuid()
    END;
    INSERT INTO public.audit_logs (table_name, record_id, action, old_data, changed_by)
    VALUES (
      TG_TABLE_NAME,
      v_record_id,
      TG_OP,
      to_jsonb(OLD),
      auth.uid()
    );
    RETURN OLD;
  ELSIF (TG_OP = 'UPDATE') THEN
    v_pk := (to_jsonb(NEW) ->> 'id');
    v_record_id := CASE
      WHEN v_pk ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        THEN v_pk::uuid
      ELSE gen_random_uuid()
    END;
    INSERT INTO public.audit_logs (table_name, record_id, action, old_data, new_data, changed_by)
    VALUES (
      TG_TABLE_NAME,
      v_record_id,
      TG_OP,
      to_jsonb(OLD),
      to_jsonb(NEW),
      auth.uid()
    );
    RETURN NEW;
  ELSIF (TG_OP = 'INSERT') THEN
    v_pk := (to_jsonb(NEW) ->> 'id');
    v_record_id := CASE
      WHEN v_pk ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        THEN v_pk::uuid
      ELSE gen_random_uuid()
    END;
    INSERT INTO public.audit_logs (table_name, record_id, action, new_data, changed_by)
    VALUES (
      TG_TABLE_NAME,
      v_record_id,
      TG_OP,
      to_jsonb(NEW),
      auth.uid()
    );
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'auth';

REVOKE ALL ON FUNCTION public.proc_audit_log_generic() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.proc_audit_log_generic() TO service_role, postgres;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. JOBS – soft delete + auditoria
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Índice parcial: somente jobs ativos
CREATE INDEX IF NOT EXISTS idx_jobs_status_active
  ON public.jobs (status, created_at DESC)
  WHERE deleted_at IS NULL;

-- Índice para listagem por data excluindo deletados
CREATE INDEX IF NOT EXISTS idx_jobs_created_active
  ON public.jobs (created_at DESC)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_audit_jobs ON public.jobs;
CREATE TRIGGER trg_audit_jobs
AFTER INSERT OR UPDATE OR DELETE ON public.jobs
FOR EACH ROW EXECUTE FUNCTION public.proc_audit_log_generic();

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. DXF_TASKS – soft delete + auditoria
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.dxf_tasks ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_dxf_tasks_active
  ON public.dxf_tasks (status, created_at DESC)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_audit_dxf_tasks ON public.dxf_tasks;
CREATE TRIGGER trg_audit_dxf_tasks
AFTER INSERT OR UPDATE OR DELETE ON public.dxf_tasks
FOR EACH ROW EXECUTE FUNCTION public.proc_audit_log_generic();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. BT_EXPORT_HISTORY – soft delete + auditoria
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.bt_export_history ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Substitui índice existente por versão com filtro de soft delete
DROP INDEX IF EXISTS idx_bt_export_history_created_at_desc;
CREATE INDEX IF NOT EXISTS idx_bt_export_history_active_date
  ON public.bt_export_history (created_at DESC)
  WHERE deleted_at IS NULL;

DROP INDEX IF EXISTS idx_bt_export_history_project_type_created_at;
CREATE INDEX IF NOT EXISTS idx_bt_export_history_active_type_date
  ON public.bt_export_history (project_type, created_at DESC)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_audit_bt_export_history ON public.bt_export_history;
CREATE TRIGGER trg_audit_bt_export_history
AFTER INSERT OR UPDATE OR DELETE ON public.bt_export_history
FOR EACH ROW EXECUTE FUNCTION public.proc_audit_log_generic();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. USER_ROLES – soft delete (já tem tabela de auditoria própria em 020)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_user_roles_active
  ON public.user_roles (user_id)
  WHERE deleted_at IS NULL;

-- Adiciona trigger de auditoria na tabela audit_logs também (dual-write)
DROP TRIGGER IF EXISTS trg_audit_user_roles ON public.user_roles;
CREATE TRIGGER trg_audit_user_roles
AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.proc_audit_log_generic();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Vista de itens deletados por tabela (operacional)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_soft_deleted_summary AS
SELECT 'jobs'              AS table_name, COUNT(*) AS deleted_count, MAX(deleted_at) AS last_deleted_at FROM public.jobs WHERE deleted_at IS NOT NULL
UNION ALL
SELECT 'dxf_tasks',        COUNT(*), MAX(deleted_at) FROM public.dxf_tasks WHERE deleted_at IS NOT NULL
UNION ALL
SELECT 'bt_export_history', COUNT(*), MAX(deleted_at) FROM public.bt_export_history WHERE deleted_at IS NOT NULL
UNION ALL
SELECT 'user_roles',        COUNT(*), MAX(deleted_at) FROM public.user_roles WHERE deleted_at IS NOT NULL
UNION ALL
SELECT 'constants_catalog', COUNT(*), MAX(deleted_at) FROM public.constants_catalog WHERE deleted_at IS NOT NULL;

GRANT SELECT ON public.v_soft_deleted_summary TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- Registro da migração
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = '_migrations'
  ) THEN
    INSERT INTO public._migrations (filename)
    VALUES ('021_audit_soft_delete_business_tables.sql')
    ON CONFLICT (filename) DO NOTHING;
  END IF;
END
$$;
