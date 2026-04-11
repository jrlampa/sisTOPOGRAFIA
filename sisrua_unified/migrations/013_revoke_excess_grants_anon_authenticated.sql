-- Migration 013: Revoke excessive grants from anon/authenticated
-- Purpose:
--   - Remove broad default grants (INSERT/UPDATE/DELETE/TRIGGER/TRUNCATE/REFERENCES).
--   - Keep only the minimum access required by existing public RLS policies.
--
-- Access model after this migration:
--   - anon/authenticated: SELECT only on jobs and constants_catalog.
--   - all other public tables/views/sequences: no direct SQL privileges for anon/authenticated.

DO $$
DECLARE
  obj RECORD;
BEGIN
  -- Revoke from all base tables in public
  FOR obj IN
    SELECT quote_ident(schemaname) || '.' || quote_ident(tablename) AS fqname
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE %s FROM anon, authenticated', obj.fqname);
  END LOOP;

  -- Revoke from all views in public
  FOR obj IN
    SELECT quote_ident(schemaname) || '.' || quote_ident(viewname) AS fqname
    FROM pg_views
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE %s FROM anon, authenticated', obj.fqname);
  END LOOP;

  -- Revoke from all sequences in public
  FOR obj IN
    SELECT quote_ident(sequence_schema) || '.' || quote_ident(sequence_name) AS fqname
    FROM information_schema.sequences
    WHERE sequence_schema = 'public'
  LOOP
    EXECUTE format('REVOKE ALL PRIVILEGES ON SEQUENCE %s FROM anon, authenticated', obj.fqname);
  END LOOP;
END
$$;

-- Re-grant only what is intentionally public by policy.
GRANT SELECT ON TABLE public.jobs TO anon, authenticated;
GRANT SELECT ON TABLE public.constants_catalog TO anon, authenticated;
-- Migration 013: Revoke excessive grants from anon/authenticated (item 6)
-- Purpose: Defense-in-depth grant hardening.
--
-- Context: Supabase defaults grant ALL privileges to anon/authenticated on
-- every new table in the public schema. While RLS policies already deny access
-- on most tables, keeping the underlying GRANTs is unnecessary risk surface.
-- This migration aligns grant state with the RLS intent for each table.
--
-- Table-by-table strategy:
--   FULL REVOKE (deny-all RLS policy + now no GRANT either):
--     _migrations, dxf_tasks, constants_catalog_history,
--     constants_catalog_snapshots, constants_refresh_events, bt_export_history
--   WRITE-ONLY REVOKE (keep SELECT, which matches the intentional RLS policy):
--     jobs            → anon/authenticated may SELECT recent jobs (policy in 001)
--     constants_catalog → anon/authenticated may SELECT active entries (policy in 002)
--   FULL REVOKE on views (underlying table is deny-all for anon/authenticated):
--     v_constants_refresh_stats, v_constants_refresh_ns_frequency,
--     v_constants_refresh_top_actors
--
-- Safety analysis:
--   - Backend connects via DATABASE_URL (service_role) → unaffected.
--   - Frontend uses backend REST API only; no direct supabase-js client found
--     in src/ → unaffected.
--   - REVOKE is idempotent: revoking a privilege not held is a no-op.
--   - RLS policies remain in place as the second layer of defense.
--   - Verified pre-condition: all deny-all tables have active RLS + deny policies.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Full revoke on deny-all tables
-- ─────────────────────────────────────────────────────────────────────────────

-- _migrations: internal tracking table; no external access warranted
REVOKE ALL ON TABLE public._migrations FROM anon, authenticated;

-- dxf_tasks: internal task queue; accessed only by service_role worker
REVOKE ALL ON TABLE public.dxf_tasks FROM anon, authenticated;

-- constants_catalog_history: append-only audit trail; backend-only
REVOKE ALL ON TABLE public.constants_catalog_history FROM anon, authenticated;

-- constants_catalog_snapshots: operator snapshots; backend-only
REVOKE ALL ON TABLE public.constants_catalog_snapshots FROM anon, authenticated;

-- constants_refresh_events: internal telemetry; backend-only
REVOKE ALL ON TABLE public.constants_refresh_events FROM anon, authenticated;

-- bt_export_history: BT critical-point export records; backend-only
REVOKE ALL ON TABLE public.bt_export_history FROM anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Revoke write grants on intentionally read-only tables
--    Keep SELECT so the existing RLS SELECT policies remain exercisable if
--    a supabase-js client is ever added (by design in migrations 001 and 002).
-- ─────────────────────────────────────────────────────────────────────────────

-- jobs: keep SELECT for recent-job polling; remove all write capabilities
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.jobs FROM anon, authenticated;

-- constants_catalog: keep SELECT for active-entries read; remove all writes
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.constants_catalog FROM anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Revoke grants on views
--    security_invoker is already set (migration 007) so queries run under
--    the caller's permissions; the underlying constants_refresh_events deny-all
--    policy blocks everything anyway. Remove the grants for clarity.
-- ─────────────────────────────────────────────────────────────────────────────

REVOKE ALL ON public.v_constants_refresh_stats        FROM anon, authenticated;
REVOKE ALL ON public.v_constants_refresh_ns_frequency FROM anon, authenticated;
REVOKE ALL ON public.v_constants_refresh_top_actors   FROM anon, authenticated;
