-- Migration: 043_lgpd_data_lifecycle.sql
-- Tech Lead Debug – 2026-04-17
--
-- Cria tabela lgpd_data_lifecycle para conformidade LGPD completa.
-- Registra o ciclo de vida dos dados pessoais: retenção, descarte e anonimização.

CREATE TABLE IF NOT EXISTS public.lgpd_data_lifecycle (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data_category       TEXT        NOT NULL,           -- categoria de dado (ex: 'email', 'gps_coords')
    legal_basis         public.lgpd_legal_basis NOT NULL,
    retention_period    INTERVAL    NOT NULL,           -- tempo máximo de retenção
    deletion_policy     TEXT        NOT NULL CHECK (deletion_policy IN ('hard_delete', 'anonymize', 'archive')),
    responsible_team    TEXT,
    review_due_date     DATE,
    notes               TEXT,
    tenant_id           UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_lgpd_data_lifecycle_tenant
    ON public.lgpd_data_lifecycle (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_lgpd_data_lifecycle_review
    ON public.lgpd_data_lifecycle (review_due_date) WHERE deleted_at IS NULL;

-- RLS
ALTER TABLE public.lgpd_data_lifecycle ENABLE ROW LEVEL SECURITY;

CREATE POLICY lgpd_data_lifecycle_service_role ON public.lgpd_data_lifecycle
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE POLICY lgpd_data_lifecycle_authenticated ON public.lgpd_data_lifecycle
    AS PERMISSIVE FOR SELECT
    TO authenticated
    USING (
        tenant_id = public.current_tenant_id()
        OR tenant_id IS NULL
    );

-- Trigger updated_at
CREATE TRIGGER set_lgpd_data_lifecycle_updated_at
    BEFORE UPDATE ON public.lgpd_data_lifecycle
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Grant mínimo para authenticated (somente leitura)
GRANT SELECT ON public.lgpd_data_lifecycle TO authenticated;

-- Seed: categorias de dados pessoais do sistema
INSERT INTO public.lgpd_data_lifecycle
    (data_category, legal_basis, retention_period, deletion_policy, responsible_team, notes)
VALUES
    ('email',          'consent',              INTERVAL '5 years',  'hard_delete', 'engenharia', 'E-mail de usuários cadastrados'),
    ('gps_coords',     'contract_execution',   INTERVAL '2 years',  'anonymize',   'engenharia', 'Coordenadas geográficas de projetos'),
    ('audit_logs',     'legal_obligation',     INTERVAL '5 years',  'archive',     'segurança',  'Logs de auditoria regulatórios'),
    ('dxf_artifacts',  'contract_execution',   INTERVAL '1 year',   'hard_delete', 'engenharia', 'Arquivos DXF gerados por usuários'),
    ('user_roles',     'legal_obligation',     INTERVAL '5 years',  'archive',     'segurança',  'Histórico de permissões')
ON CONFLICT DO NOTHING;

-- ─── Registrar migration ─────────────────────────────────────────────────────
INSERT INTO public._migrations (filename)
VALUES ('043_lgpd_data_lifecycle.sql')
ON CONFLICT (filename) DO NOTHING;
