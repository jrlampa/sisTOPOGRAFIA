-- Migration: 035_idempotency_key_and_artifact_hash.sql
-- Roadmap Item 71: Idempotência Garantida em Jobs de Exportação
-- Roadmap Item 72: Assinatura de Hash SHA-256 por Artefato
--
-- Objetivo:
--   Garantir exactly-once semantics nos jobs de exportação DXF:
--   1. idempotency_key: hash SHA-256 dos inputs normalizados → UNIQUE constraint evita
--      criação duplicada de jobs para a mesma requisição (retry-safe).
--   2. artifact_sha256: hash SHA-256 do arquivo DXF gerado → rastreabilidade de artefato
--      e prova de proveniência por entrega.
--
-- Segurança: idempotent (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).

-- ─── jobs: idempotency_key ────────────────────────────────────────────────────

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- Índice único: garante que apenas um job ativo/concluído exista por hash de input.
-- Exclui jobs failed/cancelled (permite re-tentativa quando falha permanente).
CREATE UNIQUE INDEX IF NOT EXISTS uq_jobs_idempotency_key
  ON public.jobs (idempotency_key)
  WHERE idempotency_key IS NOT NULL
    AND status NOT IN ('failed', 'cancelled');

-- ─── jobs: hash SHA-256 do artefato gerado ───────────────────────────────────

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS artifact_sha256 TEXT;

COMMENT ON COLUMN public.jobs.artifact_sha256 IS
  'SHA-256 do arquivo DXF gerado. Calculado pelo py_engine após save(). '
  'Permite verificação de integridade e rastreabilidade de proveniência (Roadmap #72).';

COMMENT ON COLUMN public.jobs.idempotency_key IS
  'SHA-256 normalizado dos parâmetros de entrada (lat, lon, radius, layers, bt_context). '
  'Garante exactly-once: requisições idempotentes retornam job existente (Roadmap #71).';

-- ─── dxf_tasks: propagação do hash ───────────────────────────────────────────

ALTER TABLE public.dxf_tasks
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

ALTER TABLE public.dxf_tasks
  ADD COLUMN IF NOT EXISTS artifact_sha256 TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_dxf_tasks_idempotency_key
  ON public.dxf_tasks (idempotency_key)
  WHERE idempotency_key IS NOT NULL
    AND status NOT IN ('failed', 'cancelled');

-- ─── Função auxiliar: lookup idempotente ─────────────────────────────────────

CREATE OR REPLACE FUNCTION public.find_or_claim_job(
  p_idempotency_key TEXT,
  p_job_id          TEXT,
  p_status          TEXT DEFAULT 'queued',
  p_user_id         TEXT DEFAULT NULL
)
RETURNS TABLE(job_id TEXT, was_created BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing_id TEXT;
BEGIN
  -- Tenta encontrar job ativo/concluído com mesmo key
  SELECT id INTO v_existing_id
  FROM public.jobs
  WHERE idempotency_key = p_idempotency_key
    AND status NOT IN ('failed', 'cancelled')
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT v_existing_id, FALSE;
    RETURN;
  END IF;

  -- Nenhum job existente: insere o novo
  INSERT INTO public.jobs (id, status, progress, attempts, idempotency_key)
  VALUES (p_job_id, p_status, 0, 0, p_idempotency_key)
  ON CONFLICT DO NOTHING;

  -- Verifica se nossa inserção ganhou a corrida
  SELECT id INTO v_existing_id
  FROM public.jobs
  WHERE idempotency_key = p_idempotency_key
    AND status NOT IN ('failed', 'cancelled')
  LIMIT 1;

  RETURN QUERY SELECT v_existing_id, (v_existing_id = p_job_id);
END;
$$;

COMMENT ON FUNCTION public.find_or_claim_job IS
  'Lookup idempotente: retorna job existente ou cria novo atomicamente. '
  'Seguro contra race conditions (ON CONFLICT). Roadmap #71.';

-- ─── Migration bookkeeping ────────────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = '_migrations'
  ) THEN
    INSERT INTO public._migrations (filename)
    VALUES ('035_idempotency_key_and_artifact_hash.sql')
    ON CONFLICT (filename) DO NOTHING;
  END IF;
END $$;
