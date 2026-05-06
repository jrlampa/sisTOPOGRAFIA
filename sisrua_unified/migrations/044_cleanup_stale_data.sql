-- Migration: 044_cleanup_stale_data.sql
-- Tech Lead Debug – 2026-04-17
--
-- Limpeza de dados obsoletos identificados no audit:
--   1. dxf_tasks failed com erros de parametrização (dados de teste)
--   2. jobs presos em processing/queued por > 2 dias sem progresso
--
-- CRITÉRIO CONSERVADOR: apenas registros com mais de 1 hora de idade
-- e sem artifact_sha256 (i.e., nunca produziram artefatos válidos).

-- 1. Soft-delete dxf_tasks failed que são resíduos de testes
--    (erro "Missing required parameters" — sem lat/lon/radius válidos)
UPDATE public.dxf_tasks
SET    deleted_at = NOW()
WHERE  status = 'failed'
  AND  deleted_at IS NULL
  AND  (
         error LIKE 'Missing required parameters%'
         OR error LIKE 'Python script%failed with code 1%'
       )
  AND  artifact_sha256 IS NULL
  AND  created_at < NOW() - INTERVAL '1 hour';

-- 2. Registrar a limpeza no audit_log
INSERT INTO public.audit_logs (table_name, record_id, action, old_data, new_data, changed_by)
SELECT
    'dxf_tasks',
    id::text,
    'UPDATE',
    jsonb_build_object('status', status, 'error', error),
    jsonb_build_object('status', status, 'deleted_at', NOW()),
    NULL   -- system operation, no user
FROM public.dxf_tasks
WHERE deleted_at IS NOT NULL
  AND error LIKE 'Missing required parameters%'
  AND created_at < NOW() - INTERVAL '1 hour'
ON CONFLICT DO NOTHING;

-- 3. Resetar jobs em processing/queued presos por > 6 horas para status 'failed'
--    (serão reprocessados pelo orchestrator na próxima rodada)
UPDATE public.jobs
SET    status     = 'failed',
       error      = 'Job resetado por timeout: preso em ' || status || ' por mais de 6 horas',
       updated_at = NOW()
WHERE  status IN ('processing', 'queued')
  AND  updated_at < NOW() - INTERVAL '6 hours'
  AND  deleted_at IS NULL;

-- ─── Registrar migration ─────────────────────────────────────────────────────
INSERT INTO public._migrations (filename)
VALUES ('044_cleanup_stale_data.sql')
ON CONFLICT (filename) DO NOTHING;
