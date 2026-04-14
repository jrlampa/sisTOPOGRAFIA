-- Migration: 034_time_series_partitioning.sql
-- Purpose: Implementar particionamento por tempo para tabelas time-series.
--
-- Estratégia:
--   1. Audit logs: particionar por MÊS (retention 90 dias = ~3 partições ativas)
--   2. Jobs: particionar por MÊS (retention 30 dias = ~1-2 partições ativas)
--   3. DXF tasks: particionar por MÊS (cleanup automático semanal)
--   4. BT export history: particionar por MÊS (crescimento gradual)
--
-- Benefícios:
--   - Partition pruning em queries com WHERE created_at / changed_at
--   - Vacuum, ANALYZE, REINDEX localizados por partição
--   - Aged data removido eficientemente via DROP PARTITION vs DELETE
--   - Índices BRIN/B-tree distribuídos entre partições menores
--
-- Nota: Requer DATA migration se tabelas já têm dados volumosos.
-- Para ambiente de teste, este é um design prospectivo.

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. Extensões
-- ─────────────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA extensions;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Estratégia: Converter audit_logs para RANGE PARTITIONING por changed_at
--
-- Pré-requisitos:
--   - Colunas: changed_at (timestamp with time zone)
--   - Constraint: changed_at NOT NULL (se possível)
--   - Índices existentes serão herdados pelas partições
--
-- Processo:
--   1. Criar nova tabela particionada (audit_logs_partitioned)
--   2. Copy data em lotes
--   3. Swap tabelas + rename
--   4. Recrear triggers
--
-- Para ambiente de teste com volumes pequenos, este é design prospectivo.
-- ─────────────────────────────────────────────────────────────────────────────

-- Criar nova tabela com RANGE PARTITIONING (por timestamp absoluto, não por função)
-- PK deve incluir a coluna de particionamento: (id, changed_at)
CREATE TABLE IF NOT EXISTS public.audit_logs_partitioned (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  action TEXT NOT NULL,
  old_data JSONB,
  new_data JSONB,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id, changed_at)
) PARTITION BY RANGE (changed_at);

-- Habilitar RLS
ALTER TABLE public.audit_logs_partitioned ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Audit logs partitioned are viewable by authenticated users" 
  ON public.audit_logs_partitioned
  FOR SELECT USING (auth.role() = 'authenticated');

-- Criar partições para os últimos 12 meses (prospectively)
-- Partições mensais começando de 2025-04
-- Usando timestamps absolutos como boundaries
DO $do$
DECLARE
  v_month_start TIMESTAMPTZ;
  v_month_end TIMESTAMPTZ;
  v_partition_name TEXT;
  v_i INT;
BEGIN
  FOR v_i IN 0..11 LOOP
    v_month_start := date_trunc('month', now() - (v_i || ' months')::INTERVAL);
    v_month_end := v_month_start + INTERVAL '1 month';
    v_partition_name := 'audit_logs_' || TO_CHAR(v_month_start, 'YYYY_MM');
    
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I PARTITION OF public.audit_logs_partitioned
       FOR VALUES FROM (%L) TO (%L)',
      v_partition_name, v_month_start, v_month_end
    );
    
    -- Recriar índices BRIN por partição
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS idx_brin_%s_changed_at 
       ON %I USING BRIN (changed_at) WITH (pages_per_range = 64)',
      v_partition_name, v_partition_name
    );
  END LOOP;
END
$do$;

GRANT SELECT ON public.audit_logs_partitioned TO service_role, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Criar tabelas particionadas prospectivas para jobs, dxf_tasks, bt_export_history
--    (Design: não reciclar en linha; permitir que novas inserts usem partições)
-- ─────────────────────────────────────────────────────────────────────────────

-- jobs particionado (created_at)
-- PK inclui a coluna de particionamento: (id, created_at)
CREATE TABLE IF NOT EXISTS public.jobs_partitioned (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  trigger_source TEXT,
  trigger_value JSONB,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INT DEFAULT 0,
  max_attempts INT DEFAULT 3,
  error_message TEXT,
  result JSONB,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

DO $do$
DECLARE v_month_start TIMESTAMPTZ; v_partition_name TEXT; v_i INT;
BEGIN
  FOR v_i IN 0..11 LOOP
    v_month_start := date_trunc('month', now() - (v_i || ' months')::INTERVAL);
    v_partition_name := 'jobs_' || TO_CHAR(v_month_start, 'YYYY_MM');
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I PARTITION OF public.jobs_partitioned
       FOR VALUES FROM (%L) TO (%L)',
      v_partition_name, v_month_start, v_month_start + INTERVAL '1 month'
    );
  END LOOP;
END
$do$;

GRANT SELECT ON public.jobs_partitioned TO service_role;

-- dxf_tasks particionado (created_at)
-- PK inclui a coluna de particionamento: (id, created_at)
CREATE TABLE IF NOT EXISTS public.dxf_tasks_partitioned (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  job_id UUID,
  file_path TEXT,
  status TEXT DEFAULT 'pending',
  error_details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

DO $do$
DECLARE v_month_start TIMESTAMPTZ; v_partition_name TEXT; v_i INT;
BEGIN
  FOR v_i IN 0..11 LOOP
    v_month_start := date_trunc('month', now() - (v_i || ' months')::INTERVAL);
    v_partition_name := 'dxf_tasks_' || TO_CHAR(v_month_start, 'YYYY_MM');
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I PARTITION OF public.dxf_tasks_partitioned
       FOR VALUES FROM (%L) TO (%L)',
      v_partition_name, v_month_start, v_month_start + INTERVAL '1 month'
    );
  END LOOP;
END
$do$;

GRANT SELECT ON public.dxf_tasks_partitioned TO service_role;

-- bt_export_history particionado (created_at)
-- PK inclui a coluna de particionamento: (id, created_at)
CREATE TABLE IF NOT EXISTS public.bt_export_history_partitioned (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES public.user_roles(user_id),
  project_type TEXT,
  bt_context_url TEXT,
  critical_pole_id TEXT NOT NULL,
  critical_pole_name TEXT,
  critical_accumulated_clients NUMERIC,
  critical_accumulated_demand_kva NUMERIC,
  cqt_scenario TEXT,
  cqt_parity_status TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

DO $do$
DECLARE v_month_start TIMESTAMPTZ; v_partition_name TEXT; v_i INT;
BEGIN
  FOR v_i IN 0..11 LOOP
    v_month_start := date_trunc('month', now() - (v_i || ' months')::INTERVAL);
    v_partition_name := 'bt_export_history_' || TO_CHAR(v_month_start, 'YYYY_MM');
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I PARTITION OF public.bt_export_history_partitioned
       FOR VALUES FROM (%L) TO (%L)',
      v_partition_name, v_month_start, v_month_start + INTERVAL '1 month'
    );
  END LOOP;
END
$do$;

GRANT SELECT ON public.bt_export_history_partitioned TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Vista prospectiva: Partition management
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW private.v_partition_status AS
SELECT
  schemaname,
  tablename,
  COUNT(*) as partition_count,
  MAX(char_length(tablename)) as partition_name_sample
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename ~ '^(audit_logs|jobs|dxf_tasks|bt_export_history)_[0-9]{4}_[0-9]{2}$'
GROUP BY schemaname, tablename
ORDER BY tablename;

GRANT SELECT ON private.v_partition_status TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Função auxiliar: Monitorar partições (prospectivamente)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.partition_health_check()
RETURNS TABLE (
  partition_base TEXT,
  total_partitions INT,
  size_total TEXT,
  oldest_partition_month TEXT,
  newest_partition_month TEXT,
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private'
AS $$
DECLARE
  v_partition_base TEXT;
  v_partition_count INT;
  v_size_total TEXT;
  v_oldest TEXT;
  v_newest TEXT;
  v_status TEXT;
BEGIN
  -- audit_logs_* partitions
  SELECT 'audit_logs', COUNT(*), pg_size_pretty(SUM(pg_total_relation_size(schemaname||'.'||tablename)))
  INTO v_partition_base, v_partition_count, v_size_total
  FROM pg_tables
  WHERE schemaname = 'public' AND tablename ~ '^audit_logs_[0-9]{4}_[0-9]{2}$';
  
  SELECT MIN(tablename) INTO v_oldest FROM pg_tables WHERE tablename ~ '^audit_logs_[0-9]{4}_[0-9]{2}$';
  SELECT MAX(tablename) INTO v_newest FROM pg_tables WHERE tablename ~ '^audit_logs_[0-9]{4}_[0-9]{2}$';
  
  v_status := CASE WHEN v_partition_count >= 3 THEN 'ok' ELSE 'WARNING' END;
  
  partition_base := v_partition_base;
  total_partitions := v_partition_count;
  size_total := v_size_total;
  oldest_partition_month := v_oldest;
  newest_partition_month := v_newest;
  status := v_status;
  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION private.partition_health_check() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.partition_health_check() TO postgres, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Documentação e próximos passos
-- ─────────────────────────────────────────────────────────────────────────────
-- NOTA: Este é um design PROSPECTIVO. Tabelas particionadas foram criadas,
--       mas dados antigos ainda residem nas tabelas originais.
--
-- Próximos passos (manual ou em scheduling separado):
--   1. Se audit_logs crescer > 100K linhas: migrar dados históricos
--   2. Configurar pg_cron para criar partições futuras automaticamente
--   3. Configurar policy de retenção: DROP PARTITION após 12 meses
--   4. Validar performance de queries em dados particionados
--
-- Comando para visualizar partições:
--   SELECT * FROM pg_partitioned_table;
--   SELECT * FROM information_schema.tables WHERE table_name ~ 'audit_logs_[0-9]';

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
    VALUES ('034_time_series_partitioning.sql')
    ON CONFLICT (filename) DO NOTHING;
  END IF;
END
$$;
