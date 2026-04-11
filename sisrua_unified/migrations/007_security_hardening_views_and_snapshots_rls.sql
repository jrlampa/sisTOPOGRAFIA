-- Migration 007: Security hardening for views and snapshots table
-- 1) Force views to use caller permissions/RLS context (security_invoker)
-- 2) Enable RLS on constants_catalog_snapshots and allow only service_role

-- Views should not run under definer privileges in exposed schemas.
ALTER VIEW public.v_constants_refresh_stats SET (security_invoker = true);
ALTER VIEW public.v_constants_refresh_ns_frequency SET (security_invoker = true);
ALTER VIEW public.v_constants_refresh_top_actors SET (security_invoker = true);

-- Enable RLS on snapshots table.
ALTER TABLE public.constants_catalog_snapshots ENABLE ROW LEVEL SECURITY;

-- Ensure policy set is deterministic.
DROP POLICY IF EXISTS constants_catalog_snapshots_service_role_all ON public.constants_catalog_snapshots;
DROP POLICY IF EXISTS constants_catalog_snapshots_no_access_anon ON public.constants_catalog_snapshots;
DROP POLICY IF EXISTS constants_catalog_snapshots_no_access_authenticated ON public.constants_catalog_snapshots;

-- Explicitly allow service_role full access for backend operations.
CREATE POLICY constants_catalog_snapshots_service_role_all
ON public.constants_catalog_snapshots
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Defense-in-depth explicit denies for exposed API roles.
CREATE POLICY constants_catalog_snapshots_no_access_anon
ON public.constants_catalog_snapshots
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

CREATE POLICY constants_catalog_snapshots_no_access_authenticated
ON public.constants_catalog_snapshots
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);
