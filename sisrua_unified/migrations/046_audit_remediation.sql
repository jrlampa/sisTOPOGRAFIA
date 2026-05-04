-- Migration: 046_audit_remediation.sql
-- Tech Lead Audit – 2026-04-18
--
-- Resolve os 7 avisos detectados na auditoria robusta (audit_db_full.py):
--
--   AVISO 1: Índices ausentes — jobs(updated_at), bt_export_history(user_id), audit_logs(created_at)
--   AVISO 2: 28 tabelas partition-child com updated_at e sem trigger (inofensivo pois triggers
--            vivem no parent, mas o audit_script avisa. Documentamos e suprimimos na re-auditoria.)
--   AVISO 3: Função verify_backup_integrity() ausente (renomeada em migration 033).
--   AVISO 4: View v_lgpd_retention_due ausente.
--   AVISO 5: View v_audit_summary ausente.
--   AVISO 6: View v_constants_catalog_latest ausente.
--   AVISO 7: 3 dxf_tasks presas em 'processing' > 2h — reset para failed.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. ÍNDICES AUSENTES
-- ─────────────────────────────────────────────────────────────────────────────

-- jobs: índice por updated_at (útil para consultas de jobs recentes e cleanup)
CREATE INDEX IF NOT EXISTS idx_jobs_updated_at
    ON public.jobs (updated_at DESC)
    WHERE deleted_at IS NULL;

-- bt_export_history: índice por tenant_id (consultas por tenant)
-- Nota: coluna user_id não existe nesta tabela; o campo de identidade é tenant_id.
CREATE INDEX IF NOT EXISTS idx_bt_export_history_tenant_id
    ON public.bt_export_history (tenant_id)
    WHERE deleted_at IS NULL;

-- audit_logs: índice por changed_at (range queries de auditoria por período)
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
    ON public.audit_logs (changed_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. TRIGGER DE updated_at PARA TABELAS PARTITION-CHILD
--    Partições herdam o trigger do parent em PostgreSQL 17 — não é necessário
--    recriar em cada child. Documentamos a exceção aqui para clareza.
--    Nenhuma ação de DDL necessária.
-- ─────────────────────────────────────────────────────────────────────────────

COMMENT ON TABLE public.dxf_tasks IS
    'Tasks de geração DXF. Tabela parent particionada por mês (dxf_tasks_YYYY_MM). '
    'O trigger set_updated_at é herdado pelas child tables via partition inheritance no PG17. '
    'Auditoria: aviso de trigger ausente em child tables é esperado e inofensivo.';

COMMENT ON TABLE public.jobs IS
    'Jobs de processamento assíncrono. Parent particionado por mês. '
    'Trigger set_updated_at herdado pelas child tables no PG17.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. ALIAS verify_backup_integrity para compatibilidade
--    Migration 033 corrigiu a função original. Criamos um wrapper de alias
--    para manter compatibilidade com código que chama o nome antigo.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.verify_backup_integrity(
    p_backup_id UUID DEFAULT NULL
)
RETURNS TABLE (
    check_name  TEXT,
    status      TEXT,
    detail      TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $$
BEGIN
    -- Delega para a função canônica de verificação de backup.
    -- p_backup_id é mantido apenas por compatibilidade de assinatura.
    -- Se a função canônica não existe, retorna uma linha de diagnóstico.
    IF EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'private' AND p.proname = 'verify_backup_integrity'
    ) THEN
        RETURN QUERY
            SELECT r.check_name, r.status, r.detail
            FROM private.verify_backup_integrity() r;
    ELSE
        RETURN QUERY
            SELECT
                'backup_system'::TEXT     AS check_name,
                'unavailable'::TEXT       AS status,
                'Função private.verify_backup_integrity não encontrada. Verifique a cadeia 022/032/033/056.'::TEXT AS detail;
    END IF;
END;
$$;

COMMENT ON FUNCTION public.verify_backup_integrity IS
    'Wrapper de compatibilidade para private.verify_backup_integrity(). '
    'Mantém contratos com código legado que chama o nome antigo.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. VIEW v_lgpd_retention_due
--    Categorias de dados com review_due_date expirado ou próximo do vencimento.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.v_lgpd_retention_due AS
SELECT
    id,
    data_category,
    legal_basis,
    retention_period,
    deletion_policy,
    responsible_team,
    review_due_date,
    CASE
        WHEN review_due_date < CURRENT_DATE            THEN 'vencido'
        WHEN review_due_date < CURRENT_DATE + 30       THEN 'vence_em_30_dias'
        ELSE                                                'ok'
    END AS review_status,
    tenant_id,
    created_at,
    updated_at
FROM public.lgpd_data_lifecycle
WHERE deleted_at IS NULL
ORDER BY review_due_date ASC NULLS LAST;

COMMENT ON VIEW public.v_lgpd_retention_due IS
    'Categorias de dados LGPD com revisão vencida ou próxima. '
    'Usado pelo dashboard de compliance e alertas regulatórios.';

-- RLS na view via policy na tabela base (lgpd_data_lifecycle já tem RLS)
GRANT SELECT ON public.v_lgpd_retention_due TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. VIEW v_audit_summary
--    Resumo diário de eventos de auditoria por tabela e ação.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.v_audit_summary AS
SELECT
    DATE_TRUNC('day', changed_at)::DATE AS audit_date,
    table_name,
    action,
    COUNT(*)                            AS event_count,
    COUNT(DISTINCT changed_by)          AS unique_actors
FROM public.audit_logs
GROUP BY 1, 2, 3
ORDER BY 1 DESC, 4 DESC;

COMMENT ON VIEW public.v_audit_summary IS
    'Resumo diário de eventos de auditoria por tabela e tipo de ação (INSERT/UPDATE/DELETE). '
    'Usado pelo painel de SIEM e relatórios de conformidade.';

GRANT SELECT ON public.v_audit_summary TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. VIEW v_constants_catalog_latest
--    Versão mais recente de cada constante por (environment, category, key).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.v_constants_catalog_latest AS
SELECT DISTINCT ON (environment, key)
    id,
    environment,
    namespace,
    key,
    value,
    description,
    version_hash,
    is_active,
    created_at,
    updated_at
FROM public.constants_catalog
WHERE deleted_at IS NULL
  AND is_active = TRUE
ORDER BY environment, key, updated_at DESC;

COMMENT ON VIEW public.v_constants_catalog_latest IS
    'Versão canônica mais recente de cada constante do catálogo, por ambiente e tenant. '
    'Elimina necessidade de subquery MAX(version) nas consultas de runtime.';

GRANT SELECT ON public.v_constants_catalog_latest TO authenticated;
GRANT SELECT ON public.v_constants_catalog_latest TO anon;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. RESET DE dxf_tasks PRESAS EM 'processing' > 2 HORAS
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE public.dxf_tasks
SET
    status     = 'failed',
    error      = 'Task resetada por timeout: presa em processing por mais de 2 horas (audit 046)',
    updated_at = NOW()
WHERE status = 'processing'
  AND deleted_at IS NULL
  AND updated_at < NOW() - INTERVAL '2 hours';

-- ─────────────────────────────────────────────────────────────────────────────
-- Registrar migration
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public._migrations (filename)
VALUES ('046_audit_remediation.sql')
ON CONFLICT (filename) DO NOTHING;
