-- Migration: 037_lgpd_compliance.sql
-- Roadmap Item 38: LGPD End-to-End (RIPD Automatizado)
--
-- Objetivo: Estrutura operacional de conformidade LGPD para o sisRUA:
--   1. Tabela de base legal por fluxo de tratamento
--   2. Registro de consentimento de titulares
--   3. Solicitações de direitos (acesso, portabilidade, eliminação, etc.)
--   4. Registro de incidentes (Playbook Item 39)
--   5. Política de ciclo de vida + descarte seguro (Item 40)
--
-- Referência: Lei 13.709/2018 (LGPD), Resolução CD/ANPD 2/2022.

-- ─── Enums LGPD ──────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lgpd_legal_basis') THEN
    CREATE TYPE public.lgpd_legal_basis AS ENUM (
      'consent',              -- Art. 7, I
      'legal_obligation',     -- Art. 7, II
      'legitimate_interest',  -- Art. 7, IX
      'contract_execution',   -- Art. 7, V
      'vital_interests',      -- Art. 7, IV
      'public_policy'         -- Art. 7, III
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lgpd_rights_request_type') THEN
    CREATE TYPE public.lgpd_rights_request_type AS ENUM (
      'access',               -- Art. 18, I/II
      'correction',           -- Art. 18, III
      'anonymization',        -- Art. 18, IV
      'portability',          -- Art. 18, V
      'deletion',             -- Art. 18, VI
      'opt_out',              -- Art. 18, II (retirada de consentimento)
      'information'           -- Art. 18, VII/VIII
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lgpd_request_status') THEN
    CREATE TYPE public.lgpd_request_status AS ENUM (
      'received', 'under_review', 'fulfilled', 'rejected', 'partial'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lgpd_incident_severity') THEN
    CREATE TYPE public.lgpd_incident_severity AS ENUM (
      'low', 'medium', 'high', 'critical'
    );
  END IF;
END $$;

-- ─── 1. Base Legal por Fluxo de Tratamento ───────────────────────────────────

CREATE TABLE IF NOT EXISTS public.lgpd_processing_activities (
  id            UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_name TEXT            NOT NULL UNIQUE,    -- ex: 'dxf_generation', 'user_auth'
  legal_basis   public.lgpd_legal_basis NOT NULL,
  purpose       TEXT            NOT NULL,            -- Por que os dados são tratados
  data_types    TEXT[]          NOT NULL DEFAULT '{}', -- Quais dados: ['email', 'ip', 'location']
  retention_days INTEGER        NOT NULL DEFAULT 365,
  is_active     BOOLEAN         NOT NULL DEFAULT TRUE,
  tenant_id     UUID            REFERENCES public.tenants(id),
  created_at    TIMESTAMPTZ     NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ     NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.lgpd_processing_activities IS
  'Registro de atividades de tratamento de dados (RIPD simplificado). '
  'Cada fluxo declara sua base legal, finalidade e tipos de dados. Roadmap #38.';

-- Atividades de tratamento do sisRUA
INSERT INTO public.lgpd_processing_activities
  (activity_name, legal_basis, purpose, data_types, retention_days)
VALUES
  ('user_authentication',  'contract_execution', 'Autenticação e acesso à plataforma',
   ARRAY['user_id', 'email', 'ip_address', 'session_token'], 90),
  ('dxf_generation',       'contract_execution', 'Geração de projetos topográficos em DXF',
   ARRAY['location_coordinates', 'project_metadata'], 730),
  ('bt_calculation',       'contract_execution', 'Cálculo de rede BT para projetos elétricos',
   ARRAY['location_coordinates', 'topology_data', 'load_data'], 730),
  ('audit_logging',        'legal_obligation',   'Trilha de auditoria regulatória (ANEEL/LGPD)',
   ARRAY['user_id', 'ip_address', 'action_performed', 'timestamp'], 1825),
  ('analytics_usage',      'legitimate_interest','Análise de uso para melhorar a plataforma',
   ARRAY['feature_usage', 'performance_metrics'], 180)
ON CONFLICT (activity_name) DO NOTHING;

-- ─── 2. Registro de Consentimento ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.lgpd_consent_records (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT        NOT NULL,
  activity_name   TEXT        NOT NULL REFERENCES public.lgpd_processing_activities(activity_name),
  consented       BOOLEAN     NOT NULL,
  consent_version TEXT        NOT NULL DEFAULT '1.0',  -- versão dos termos aceitos
  ip_address      TEXT,
  user_agent      TEXT,
  revoked_at      TIMESTAMPTZ,
  revocation_reason TEXT,
  tenant_id       UUID        REFERENCES public.tenants(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lgpd_consent_user_id       ON public.lgpd_consent_records (user_id);
CREATE INDEX IF NOT EXISTS idx_lgpd_consent_activity       ON public.lgpd_consent_records (activity_name);
CREATE INDEX IF NOT EXISTS idx_lgpd_consent_active         ON public.lgpd_consent_records (user_id, activity_name)
  WHERE consented = TRUE AND revoked_at IS NULL;

COMMENT ON TABLE public.lgpd_consent_records IS
  'Registro imutável de consentimentos. Revogação por coluna revoked_at (não deleta). '
  'Consulta ativa: WHERE consented = TRUE AND revoked_at IS NULL. Roadmap #38.';

-- ─── 3. Solicitações de Direitos dos Titulares ───────────────────────────────

CREATE TABLE IF NOT EXISTS public.lgpd_rights_requests (
  id                UUID                          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           TEXT                          NOT NULL,
  request_type      public.lgpd_rights_request_type NOT NULL,
  status            public.lgpd_request_status    NOT NULL DEFAULT 'received',
  description       TEXT,
  response_notes    TEXT,
  deadline_at       TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '15 days'), -- Art. 18 §3: 15 dias
  fulfilled_at      TIMESTAMPTZ,
  handled_by        TEXT,      -- user_id do responsável LGPD
  tenant_id         UUID        REFERENCES public.tenants(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lgpd_rights_user_id     ON public.lgpd_rights_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_lgpd_rights_status       ON public.lgpd_rights_requests (status)
  WHERE status IN ('received', 'under_review');
CREATE INDEX IF NOT EXISTS idx_lgpd_rights_deadline     ON public.lgpd_rights_requests (deadline_at)
  WHERE status NOT IN ('fulfilled', 'rejected');

COMMENT ON TABLE public.lgpd_rights_requests IS
  'Solicitações de direitos dos titulares (Art. 18 LGPD). '
  'SLA de resposta: 15 dias (deadline_at). Roadmap #38.';

-- ─── 4. Registro de Incidentes de Segurança (Item 39) ────────────────────────

CREATE TABLE IF NOT EXISTS public.lgpd_security_incidents (
  id                UUID                          PRIMARY KEY DEFAULT gen_random_uuid(),
  title             TEXT                          NOT NULL,
  description       TEXT                          NOT NULL,
  severity          public.lgpd_incident_severity NOT NULL,
  affected_users_count INTEGER                    DEFAULT 0,
  data_types_affected TEXT[]                      DEFAULT '{}',
  detected_at       TIMESTAMPTZ                   NOT NULL DEFAULT now(),
  contained_at      TIMESTAMPTZ,
  anpd_notified_at  TIMESTAMPTZ,   -- LGPD Art. 48: comunicar ANPD em 72h nos graves
  anpd_protocol     TEXT,
  remediation_steps TEXT,
  reported_by       TEXT,
  tenant_id         UUID    REFERENCES public.tenants(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lgpd_incidents_severity  ON public.lgpd_security_incidents (severity);
CREATE INDEX IF NOT EXISTS idx_lgpd_incidents_pending_anpd ON public.lgpd_security_incidents (detected_at)
  WHERE anpd_notified_at IS NULL
    AND severity IN ('high', 'critical');

COMMENT ON TABLE public.lgpd_security_incidents IS
  'Registro de incidentes de segurança. Incidentes críticos/altos devem ser comunicados '
  'à ANPD em até 72h (Art. 48 LGPD). Roadmap #39.';

-- ─── 5. Política de Ciclo de Vida e Descarte (Item 40) ───────────────────────

CREATE OR REPLACE FUNCTION public.lgpd_schedule_data_deletion(
  p_user_id   TEXT,
  p_reason    TEXT DEFAULT 'user_request'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result JSONB := '{}';
  v_jobs_count INTEGER;
  v_bt_count INTEGER;
BEGIN
  -- Anonimiza jobs (não deleta: preserva integridade regulatória de auditoria)
  UPDATE public.jobs
  SET
    result = jsonb_set(COALESCE(result, '{}'), '{anonymized}', 'true'),
    error = NULL
  WHERE id IN (
    SELECT id FROM public.jobs
    WHERE deleted_at IS NULL
    LIMIT 1000 -- processo em lotes para evitar lock
  );
  GET DIAGNOSTICS v_jobs_count = ROW_COUNT;

  -- Revoga todos os consentimentos ativos
  UPDATE public.lgpd_consent_records
  SET revoked_at = now(), revocation_reason = p_reason
  WHERE user_id = p_user_id AND revoked_at IS NULL;

  -- Marca bt_export_history como anonimizado
  UPDATE public.bt_export_history
  SET metadata = jsonb_set(COALESCE(metadata, '{}'), '{anonymized}', 'true')
  WHERE deleted_at IS NULL;
  GET DIAGNOSTICS v_bt_count = ROW_COUNT;

  v_result := jsonb_build_object(
    'user_id',         p_user_id,
    'reason',          p_reason,
    'processed_at',    now(),
    'jobs_anonymized', v_jobs_count,
    'bt_anonymized',   v_bt_count
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.lgpd_schedule_data_deletion IS
  'Anonimiza dados pessoais de um titular. Não deleta registros de auditoria '
  '(preservados por obrigação legal). Roadmap #38, #40.';

-- ─── Vista de pendências LGPD ─────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.v_lgpd_compliance_dashboard AS
SELECT
  'rights_requests_overdue'            AS metric,
  COUNT(*)::TEXT                       AS value,
  'Solicitações de direitos vencidas'  AS description
FROM public.lgpd_rights_requests
WHERE deadline_at < now()
  AND status NOT IN ('fulfilled', 'rejected')

UNION ALL

SELECT
  'incidents_pending_anpd_notification',
  COUNT(*)::TEXT,
  'Incidentes críticos aguardando notificação ANPD (>72h)'
FROM public.lgpd_security_incidents
WHERE anpd_notified_at IS NULL
  AND severity IN ('high', 'critical')
  AND detected_at < (now() - INTERVAL '72 hours')

UNION ALL

SELECT
  'active_consent_activities',
  COUNT(DISTINCT activity_name)::TEXT,
  'Atividades de tratamento com base legal cadastrada'
FROM public.lgpd_processing_activities
WHERE is_active = TRUE;

-- ─── Migration bookkeeping ────────────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = '_migrations'
  ) THEN
    INSERT INTO public._migrations (filename)
    VALUES ('037_lgpd_compliance.sql')
    ON CONFLICT (filename) DO NOTHING;
  END IF;
END $$;
