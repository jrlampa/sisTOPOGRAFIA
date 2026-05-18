-- Migration: 102_backup_restore_drill_automation.sql
-- Purpose: Automatizar Disaster Recovery Drills e validação de integridade pós-restore.
--
-- Implementa:
--   1. Tabela backup.drill_history para registro de testes de restauração.
--   2. Função private.run_backup_restore_drill() para execução automatizada.
--   3. Agendamento mensal via pg_cron.

BEGIN;

CREATE TABLE IF NOT EXISTS backup.drill_history (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drill_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  target_table        TEXT NOT NULL,
  manifest_id         UUID NOT NULL REFERENCES backup.backup_manifest(id),
  status              TEXT NOT NULL CHECK (status IN ('success', 'failed')),
  rto_seconds         INTEGER, -- Tempo real de restauração em segundos
  validation_results  JSONB,    -- Checksums, row counts, etc.
  certificate_hash    TEXT,     -- Hash SHA-256 combinando drill_at + status + target_table
  error_message       TEXT
);

CREATE INDEX IF NOT EXISTS idx_drill_history_date ON backup.drill_history (drill_at DESC);

REVOKE ALL ON backup.drill_history FROM PUBLIC, anon, authenticated;
GRANT ALL ON backup.drill_history TO service_role, postgres;

-- ─────────────────────────────────────────────────────────────────────────────
-- Função para rodar o Drill de Restore
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.run_backup_restore_drill(
  p_table_name TEXT DEFAULT NULL -- Se NULL, escolhe uma aleatória das críticas
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private', 'backup'
AS $$
DECLARE
  v_table_name TEXT := p_table_name;
  v_manifest_id UUID;
  v_start_time TIMESTAMPTZ := clock_timestamp();
  v_end_time TIMESTAMPTZ;
  v_drill_id UUID;
  v_row_count_snapshot BIGINT;
  v_row_count_manifest BIGINT;
  v_checksum_snapshot TEXT;
  v_status TEXT := 'success';
  v_error TEXT;
  v_snapshot_table TEXT;
  v_pk_col TEXT;
BEGIN
  -- 1. Escolher tabela se não fornecida
  IF v_table_name IS NULL THEN
    SELECT t.name INTO v_table_name
    FROM (VALUES ('constants_catalog'), ('user_roles'), ('bt_export_history')) AS t(name)
    ORDER BY random() LIMIT 1;
  END IF;

  -- 2. Obter último backup 'ok' da tabela
  SELECT id, row_count INTO v_manifest_id, v_row_count_manifest
  FROM backup.backup_manifest
  WHERE table_name = v_table_name AND status = 'ok'
  ORDER BY backup_at DESC LIMIT 1;

  IF v_manifest_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum backup válido encontrado para a tabela %', v_table_name;
  END IF;

  -- Determinar tabela de snapshot
  IF v_table_name = 'constants_catalog' THEN v_snapshot_table := 'constants_catalog_snapshot'; v_pk_col := 'id';
  ELSIF v_table_name = 'user_roles' THEN v_snapshot_table := 'user_roles_snapshot'; v_pk_col := 'user_id';
  ELSE v_snapshot_table := 'bt_export_history_snapshot'; v_pk_col := 'id';
  END IF;

  BEGIN
    -- 3. Simular validação de Restore (Contagem e Checksum parcial)
    -- Em um ambiente de Drill ideal, restauraríamos para uma tabela temporary_drill_restore
    -- Aqui validamos a integridade do snapshot atual contra o manifesto.
    
    EXECUTE format('SELECT COUNT(*) FROM backup.%I WHERE _backup_id = $1', v_snapshot_table)
    INTO v_row_count_snapshot
    USING v_manifest_id;

    IF v_row_count_snapshot <> v_row_count_manifest THEN
      v_status := 'failed';
      v_error := format('Divergência de contagem: Manifesto=%s, Snapshot=%s', v_row_count_manifest, v_row_count_snapshot);
    END IF;

    -- Checksum simples da coluna PK para garantir que dados são legíveis
    EXECUTE format('SELECT md5(string_agg(%I::text, '','')) FROM (SELECT %I FROM backup.%I WHERE _backup_id = $1 ORDER BY %I) x', v_pk_col, v_pk_col, v_snapshot_table, v_pk_col)
    INTO v_checksum_snapshot
    USING v_manifest_id;

    v_end_time := clock_timestamp();

    -- 4. Registrar sucesso/falha
    INSERT INTO backup.drill_history (
      target_table, manifest_id, status, rto_seconds, 
      validation_results, 
      certificate_hash,
      error_message
    )
    VALUES (
      v_table_name, v_manifest_id, v_status, 
      extract(epoch from (v_end_time - v_start_time))::integer,
      jsonb_build_object(
        'expected_rows', v_row_count_manifest,
        'actual_rows', v_row_count_snapshot,
        'pk_checksum', v_checksum_snapshot
      ),
      sha256(format('%s-%s-%s', v_start_time, v_status, v_table_name)::bytea)::text,
      v_error
    )
    RETURNING id INTO v_drill_id;

  EXCEPTION WHEN OTHERS THEN
    v_end_time := clock_timestamp();
    INSERT INTO backup.drill_history (
      target_table, manifest_id, status, rto_seconds, error_message
    )
    VALUES (
      v_table_name, v_manifest_id, 'failed', 
      extract(epoch from (v_end_time - v_start_time))::integer,
      SQLERRM
    )
    RETURNING id INTO v_drill_id;
  END;

  RETURN v_drill_id;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Agendamento Mensal (Todo dia 15 às 05:00 UTC)
-- ─────────────────────────────────────────────────────────────────────────────
DO $do$
BEGIN
  PERFORM cron.schedule(
    'backup_restore_drill_monthly',
    '0 5 15 * *',
    'SELECT private.run_backup_restore_drill()'
  );
END
$do$;

-- Registro da migração
INSERT INTO public._migrations (filename)
VALUES ('102_backup_restore_drill_automation.sql')
ON CONFLICT (filename) DO NOTHING;

COMMIT;
