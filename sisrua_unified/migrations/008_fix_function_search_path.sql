-- Migration 008: Fix function search_path mutability for security advisor.
-- Addresses warnings for:
--   public.set_updated_at
--   public.constants_catalog_set_updated_at
--   public.constants_catalog_audit

ALTER FUNCTION public.set_updated_at()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.constants_catalog_set_updated_at()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.constants_catalog_audit()
  SET search_path = public, pg_temp;
