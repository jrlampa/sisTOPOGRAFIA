-- 061_formula_versions_persistence.sql
-- Catalogo auditavel de versionamento semantico de formulas.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.formula_versions (
  id uuid primary key default gen_random_uuid(),
  formula_id text not null,
  category text not null check (
    category in ('bt_radial', 'cqt', 'conductor', 'transformer', 'standards')
  ),
  version text not null check (version ~ '^[0-9]+\.[0-9]+\.[0-9]+$'),
  status text not null check (status in ('active', 'deprecated', 'draft', 'withdrawn')),
  name text not null,
  description text not null,
  expression text not null,
  constants jsonb not null default '{}'::jsonb,
  standard_reference text not null,
  effective_date date not null,
  deprecated_date date,
  definition_hash text not null check (definition_hash ~ '^[0-9a-f]{64}$'),
  change_reason text,
  created_at timestamptz not null default now(),
  created_by uuid,
  constraint formula_versions_formula_version_key unique (formula_id, version),
  constraint formula_versions_deprecation_order_check check (
    deprecated_date is null or deprecated_date >= effective_date
  )
);

create unique index if not exists formula_versions_one_active_per_formula_idx
  on public.formula_versions (formula_id)
  where status = 'active';

create index if not exists formula_versions_category_status_idx
  on public.formula_versions (category, status, effective_date desc);

create index if not exists formula_versions_formula_effective_idx
  on public.formula_versions (formula_id, effective_date desc);

create index if not exists formula_versions_constants_gin_idx
  on public.formula_versions using gin (constants);

alter table public.formula_versions enable row level security;

drop policy if exists "formula_versions_authenticated_read" on public.formula_versions;
create policy "formula_versions_authenticated_read"
  on public.formula_versions
  for select
  to authenticated
  using (status in ('active', 'deprecated'));

revoke all on public.formula_versions from anon;
revoke all on public.formula_versions from authenticated;
grant select on public.formula_versions to authenticated;
grant all on public.formula_versions to service_role;

comment on table public.formula_versions is
  'Catalogo auditavel de formulas de calculo com versionamento semantico e RLS.';
comment on column public.formula_versions.definition_hash is
  'SHA-256 canonico da expressao e constantes da formula.';
