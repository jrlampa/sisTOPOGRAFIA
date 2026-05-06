-- Migration: 060_rls_partition_children_and_perf_index.sql
-- 2026-05-04
--
-- Objetivo: Resolver os dois achados 🟡 MÉDIO da auditoria live (20260504_003940):
--
--   1. RLS em partições filhas (49 tabelas sem Row Level Security):
--      As tabelas pai (audit_logs, dxf_tasks, jobs, bt_export_history) têm RLS habilitado
--      com políticas de isolamento por tenant. As partições filhas herdam as políticas
--      quando acessadas via tabela pai, mas NÃO quando acessadas diretamente por nome.
--      Solução: ENABLE ROW LEVEL SECURITY em todas as partições filhas.
--      Sem policies adicionais — acesso direto a partições não é rota da aplicação;
--      o service_role (BYPASSRLS) continua operando sem restrição.
--
--   2. Query lenta em v_audit_siem_export (1119ms avg):
--      A view executa ORDER BY changed_at DESC LIMIT $1.
--      Os índices existentes são BRIN (bons para range scan, inúteis para ORDER BY LIMIT).
--      Solução: índice BTREE em audit_logs(changed_at DESC) + cobertura do actor_user_id
--      para suportar filtro combinado tipo-ator comum nos SIEM.
--
-- Idempotente: usa DO $$ + IF NOT EXISTS / pg_class checks.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. PERFORMANCE: ÍNDICE BTREE EM audit_logs.changed_at ───────────────────
--
-- O ORDER BY event_time DESC LIMIT $1 da v_audit_siem_export requer BTREE DESC.
-- BRIN (existente) não suporta ordered scans eficientes.
-- Inclui changed_by para cobrir filtros por ator (queries SIEM comuns).

CREATE INDEX IF NOT EXISTS idx_audit_logs_changed_at_btree
  ON public.audit_logs (changed_at DESC, changed_by);

COMMENT ON INDEX public.idx_audit_logs_changed_at_btree IS
  'BTREE DESC para ORDER BY changed_at DESC LIMIT N usado por v_audit_siem_export. '
  'Cobre também filtro por actor (changed_by). Substitui efetivamente os BRIN para sorted queries.';

-- ─── 2. RLS: PARTIÇÕES FILHAS – audit_logs_YYYY_MM ───────────────────────────

DO $$
DECLARE
  tbl TEXT;
  partition_children TEXT[] := ARRAY[
    'audit_logs_2025_05', 'audit_logs_2025_06', 'audit_logs_2025_07',
    'audit_logs_2025_08', 'audit_logs_2025_09', 'audit_logs_2025_10',
    'audit_logs_2025_11', 'audit_logs_2025_12',
    'audit_logs_2026_01', 'audit_logs_2026_02', 'audit_logs_2026_03',
    'audit_logs_2026_04'
  ];
BEGIN
  FOREACH tbl IN ARRAY partition_children LOOP
    -- Enable RLS only if the table exists
    IF EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = tbl
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    END IF;
  END LOOP;
END
$$;

-- ─── 3. RLS: PARTIÇÕES FILHAS – bt_export_history_YYYY_MM ────────────────────

DO $$
DECLARE
  tbl TEXT;
  partition_children TEXT[] := ARRAY[
    'bt_export_history_2025_05', 'bt_export_history_2025_06', 'bt_export_history_2025_07',
    'bt_export_history_2025_08', 'bt_export_history_2025_09', 'bt_export_history_2025_10',
    'bt_export_history_2025_11', 'bt_export_history_2025_12',
    'bt_export_history_2026_01', 'bt_export_history_2026_02', 'bt_export_history_2026_03',
    'bt_export_history_2026_04'
  ];
BEGIN
  FOREACH tbl IN ARRAY partition_children LOOP
    IF EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = tbl
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    END IF;
  END LOOP;
END
$$;

-- ─── 4. RLS: PARTIÇÕES FILHAS – dxf_tasks_YYYY_MM ────────────────────────────

DO $$
DECLARE
  tbl TEXT;
  partition_children TEXT[] := ARRAY[
    'dxf_tasks_2025_05', 'dxf_tasks_2025_06', 'dxf_tasks_2025_07',
    'dxf_tasks_2025_08', 'dxf_tasks_2025_09', 'dxf_tasks_2025_10',
    'dxf_tasks_2025_11', 'dxf_tasks_2025_12',
    'dxf_tasks_2026_01', 'dxf_tasks_2026_02', 'dxf_tasks_2026_03',
    'dxf_tasks_2026_04'
  ];
BEGIN
  FOREACH tbl IN ARRAY partition_children LOOP
    IF EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = tbl
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    END IF;
  END LOOP;
END
$$;

-- ─── 5. RLS: PARTIÇÕES FILHAS – jobs_YYYY_MM ─────────────────────────────────

DO $$
DECLARE
  tbl TEXT;
  partition_children TEXT[] := ARRAY[
    'jobs_2025_05', 'jobs_2025_06', 'jobs_2025_07',
    'jobs_2025_08', 'jobs_2025_09', 'jobs_2025_10',
    'jobs_2025_11', 'jobs_2025_12',
    'jobs_2026_01', 'jobs_2026_02', 'jobs_2026_03',
    'jobs_2026_04'
  ];
BEGIN
  FOREACH tbl IN ARRAY partition_children LOOP
    IF EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = tbl
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    END IF;
  END LOOP;
END
$$;

-- ─── 6. RLS: TABELA _migrations ──────────────────────────────────────────────
--
-- Tabela interna do sistema de migrations. Deve ser inacessível para
-- roles anon/authenticated. service_role tem BYPASSRLS e continua operando.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = '_migrations'
  ) THEN
    ALTER TABLE public._migrations ENABLE ROW LEVEL SECURITY;
  END IF;
END
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Nota sobre partições futuras:
-- Quando o particionamento automático criar novas partições (YYYY_05 em diante),
-- elas precisarão ter RLS habilitado. Recomenda-se adicionar um script de
-- manutenção mensal ou trigger DDL para automatizar isso.
-- ─────────────────────────────────────────────────────────────────────────────
