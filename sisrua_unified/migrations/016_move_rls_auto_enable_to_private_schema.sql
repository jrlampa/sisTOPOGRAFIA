-- Migration: 016_move_rls_auto_enable_to_private_schema.sql
-- Purpose:
--   Reduce attack surface by moving the event-trigger helper function
--   rls_auto_enable() from exposed schema public to private schema private.
--
-- Safety:
--   - Idempotent and no-op when function does not exist.
--   - Moves only the expected signature: rls_auto_enable() RETURNS event_trigger.
--   - Does not touch event triggers directly; ALTER FUNCTION ... SET SCHEMA
--     preserves function OID, so dependencies remain intact.

DO $$
BEGIN
  CREATE SCHEMA IF NOT EXISTS private;

  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_type t ON t.oid = p.prorettype
    WHERE n.nspname = 'public'
      AND p.proname = 'rls_auto_enable'
      AND p.pronargs = 0
      AND t.typname = 'event_trigger'
  ) THEN
    ALTER FUNCTION public.rls_auto_enable() SET SCHEMA private;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_type t ON t.oid = p.prorettype
    WHERE n.nspname = 'private'
      AND p.proname = 'rls_auto_enable'
      AND p.pronargs = 0
      AND t.typname = 'event_trigger'
  ) THEN
    ALTER FUNCTION private.rls_auto_enable() SET search_path = pg_catalog, public, pg_temp;

    REVOKE ALL ON FUNCTION private.rls_auto_enable() FROM PUBLIC;
    REVOKE ALL ON FUNCTION private.rls_auto_enable() FROM anon, authenticated;
    GRANT EXECUTE ON FUNCTION private.rls_auto_enable() TO postgres, service_role;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = '_migrations'
  ) THEN
    INSERT INTO public._migrations (filename)
    VALUES ('016_move_rls_auto_enable_to_private_schema.sql')
    ON CONFLICT (filename) DO NOTHING;
  END IF;
END
$$;
