-- Migration: 103_legal_hold_and_ediscovery.sql
-- Purpose: Implementar Legal Hold para conformidade regulatória e eDiscovery granular.
--
-- Implementa:
--   1. Tabela backup.legal_holds para travar deleção de registros em litígio.
--   2. Triggers para impedir DELETE/UPDATE se houver legal hold ativo.
--   3. View para busca consolidada em backups (eDiscovery).

BEGIN;

-- 1. Tabela de Legal Holds
CREATE TABLE IF NOT EXISTS backup.legal_holds (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name    TEXT NOT NULL,
  record_id     TEXT NOT NULL, -- UUID ou PK do registro
  reason        TEXT NOT NULL,
  held_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  held_by       TEXT NOT NULL,
  expires_at    TIMESTAMPTZ, -- NULL significa permanente até remoção manual
  is_active     BOOLEAN NOT NULL DEFAULT true,
  metadata      JSONB
);

CREATE INDEX IF NOT EXISTS idx_legal_holds_lookup 
  ON backup.legal_holds (table_name, record_id) 
  WHERE is_active = true;

REVOKE ALL ON backup.legal_holds FROM PUBLIC, anon, authenticated;
GRANT ALL ON backup.legal_holds TO service_role, postgres;

-- 2. Trigger Function para proteção de Legal Hold
CREATE OR REPLACE FUNCTION private.check_legal_hold_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Se for DELETE ou UPDATE que "deleta" (deleted_at), verifica hold
  IF (TG_OP = 'DELETE') OR (TG_OP = 'UPDATE' AND NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL) THEN
    IF EXISTS (
      SELECT 1 FROM backup.legal_holds
      WHERE table_name = TG_TABLE_NAME
        AND record_id = OLD.id::text
        AND is_active = true
        AND (expires_at IS NULL OR expires_at > now())
    ) THEN
      RAISE EXCEPTION 'Operação negada: O registro possui um Legal Hold ativo (Conformidade LGPD/Litígio).';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Aplicar trava em tabelas críticas
DO $do$
DECLARE
  v_table TEXT;
BEGIN
  FOR v_table IN SELECT unnest(ARRAY['constants_catalog', 'bt_export_history']) LOOP
    EXECUTE format('
      CREATE TRIGGER trg_legal_hold_lock_%I
      BEFORE UPDATE OR DELETE ON public.%I
      FOR EACH ROW EXECUTE FUNCTION private.check_legal_hold_lock()',
      v_table, v_table);
  END LOOP;
END
$do$;

-- 3. View de eDiscovery (Busca consolidada em snapshots)
CREATE OR REPLACE VIEW backup.v_ediscovery_search AS
SELECT 
  'constants_catalog' as source_table,
  _backup_id as manifest_id,
  id::text as record_id,
  jsonb_build_object('key', key, 'value', value, 'desc', description) as content,
  _backed_up_at as captured_at
FROM backup.constants_catalog_snapshot
UNION ALL
SELECT 
  'user_roles' as source_table,
  _backup_id as manifest_id,
  user_id::text as record_id,
  jsonb_build_object('role', role, 'reason', reason) as content,
  _backed_up_at as captured_at
FROM backup.user_roles_snapshot
UNION ALL
SELECT 
  'bt_export_history' as source_table,
  _backup_id as manifest_id,
  id::text as record_id,
  jsonb_build_object('project', project_type, 'url', bt_context_url) as content,
  _backed_up_at as captured_at
FROM backup.bt_export_history_snapshot;

GRANT SELECT ON backup.v_ediscovery_search TO service_role, postgres;

-- Registro da migração
INSERT INTO public._migrations (filename)
VALUES ('103_legal_hold_and_ediscovery.sql')
ON CONFLICT (filename) DO NOTHING;

COMMIT;
