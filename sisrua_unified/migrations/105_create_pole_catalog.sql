-- Migration: 105_create_pole_catalog.sql
-- Purpose: Create pole_catalog table for storing standardized pole specifications
--          with technical properties, nominal effort, and material details.
--
-- Objetivo: Criar catálogo estruturado de postes com propriedades técnicas,
--           esforço nominal, dimensões e materiais para seleção em projetos.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. TABELA PRINCIPAL: pole_catalog
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.pole_catalog (
  -- Identidade
  id                      BIGSERIAL       PRIMARY KEY,
  pole_id                 TEXT            NOT NULL UNIQUE,  -- "12m-300daN-CC"
  display_name            TEXT            NOT NULL,         -- "12m / 300 daN - Concreto Circular"

  -- Classificação
  material                TEXT            NOT NULL,         -- "CC", "FV", "CDT", "Metalico"
  pole_type               TEXT            NOT NULL,         -- "circular", "duplo_t", "H-shape"

  -- Dimensões Físicas
  height_m                NUMERIC(5,2)    NOT NULL,         -- 12.0
  external_diameter_mm    NUMERIC(7,1),                     -- 230.0 (para circular)
  wall_thickness_mm       NUMERIC(6,2),                     -- 40.0 (para circular)
  base_diameter_mm        NUMERIC(7,1),                     -- 300.0 (para circular)

  -- Propriedades Mecânicas
  nominal_effort_dan      NUMERIC(10,2)   NOT NULL,         -- 300.0
  breaking_load_dan       NUMERIC(10,2),                    -- Carga de ruptura
  buckling_length_m       NUMERIC(5,2),                     -- Comprimento de flambagem
  safety_factor           NUMERIC(4,2)    NOT NULL DEFAULT 2.5, -- Fator de segurança padrão

  -- Propriedades do Material
  density_kg_m3           NUMERIC(8,2),                     -- 2400 para concreto
  compressive_strength_pa NUMERIC(12,0),                    -- Para concreto: ~40 MPa
  tensile_strength_pa     NUMERIC(12,0),                    -- Tensão de tração

  -- Padrões e Normas
  standard                TEXT,           -- "NBR 8489", "IEC 60168"
  norm_document           TEXT,           -- URL ou referência
  manufacturer_standard   TEXT,           -- Padrão do fabricante específico

  -- Informações de Projeto
  recommended_span_m      NUMERIC(6,1),   -- Vão recomendado máximo (m)
  max_loading_daN_per_m   NUMERIC(8,3),  -- Carregamento máximo por unidade de comprimento
  max_wind_speed_kmh      NUMERIC(5,1),  -- Velocidade máxima de vento (km/h)
  max_temperature_celsius NUMERIC(5,1),  -- Temperatura máxima de operação

  -- Alternativas de nomenclatura (para buscas)
  aliases                 TEXT[] DEFAULT '{}',  -- ["12m/300", "Poste 12", "CC 300"]

  -- Auditoria e Governança
  is_active               BOOLEAN     NOT NULL DEFAULT true,
  deprecated_date         TIMESTAMPTZ,
  deprecated_reason       TEXT,
  notes                   TEXT,
  created_by              TEXT        DEFAULT 'system',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by              TEXT,
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Rastreabilidade
  source                  TEXT        DEFAULT 'manual',  -- manual | import | auto_generated
  external_id             TEXT,       -- ID externo (ERP, catalog, etc)

  -- Constraints
  CONSTRAINT ck_material CHECK (material IN ('CC', 'FV', 'CDT', 'Metalico', 'Other')),
  CONSTRAINT ck_type CHECK (pole_type IN ('circular', 'duplo_t', 'h_shape', 'lattice')),
  CONSTRAINT ck_positive_height CHECK (height_m > 0),
  CONSTRAINT ck_positive_effort CHECK (nominal_effort_dan > 0),
  CONSTRAINT ck_valid_safety CHECK (safety_factor >= 1.5 AND safety_factor <= 4.0)
);

COMMENT ON TABLE public.pole_catalog IS
  'Catálogo estruturado de postes para redes BT/MT. '
  'Armazena propriedades técnicas, dimensões, esforço nominal e normas. '
  'Referenciar em canonical_poles para validação e seleção estrutural.';

COMMENT ON COLUMN public.pole_catalog.pole_id IS
  'ID único do poste (e.g., "12m-300daN-CC"). Usado em projetos para seleção.';

COMMENT ON COLUMN public.pole_catalog.nominal_effort_dan IS
  'Esforço nominal em daN (decanewton). Carga máxima a 2/3 da altura (regra NBR 8489).';

COMMENT ON COLUMN public.pole_catalog.recommended_span_m IS
  'Vão máximo recomendado para este poste com carregamentos padrão.';

COMMENT ON COLUMN public.pole_catalog.aliases IS
  'Variações de nomenclatura (e.g., ["12m/300", "Poste 12 m", "CC 300 daN"]).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. TABELA DE HISTÓRICO: pole_catalog_history
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.pole_catalog_history (
  id                    BIGSERIAL       PRIMARY KEY,
  catalog_id            BIGINT          NOT NULL,
  pole_id               TEXT            NOT NULL,
  old_values            JSONB,          -- Valores anteriores (auditoria)
  new_values            JSONB,          -- Valores novos
  change_type           TEXT            NOT NULL,  -- INSERT | UPDATE | DELETE
  changed_by            TEXT,
  changed_at            TIMESTAMPTZ     NOT NULL DEFAULT now(),
  change_reason         TEXT,

  CONSTRAINT fk_pole_history_catalog
    FOREIGN KEY (catalog_id)
    REFERENCES public.pole_catalog (id)
    ON DELETE CASCADE
);

COMMENT ON TABLE public.pole_catalog_history IS
  'Histórico completo de alterações na tabela pole_catalog.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. ÍNDICES PARA PERFORMANCE
-- ─────────────────────────────────────────────────────────────────────────────

-- Busca por ID do poste
CREATE INDEX IF NOT EXISTS idx_pole_catalog_id
  ON public.pole_catalog (pole_id)
  WHERE is_active = true;

-- Busca por material e tipo
CREATE INDEX IF NOT EXISTS idx_pole_catalog_material_type
  ON public.pole_catalog (material, pole_type)
  WHERE is_active = true;

-- Busca por altura e esforço (agregações)
CREATE INDEX IF NOT EXISTS idx_pole_catalog_height_effort
  ON public.pole_catalog (height_m, nominal_effort_dan)
  WHERE is_active = true;

-- Busca por aliases
CREATE INDEX IF NOT EXISTS idx_pole_catalog_aliases
  ON public.pole_catalog USING GIN (aliases);

-- Histórico
CREATE INDEX IF NOT EXISTS idx_pole_history_catalog_id
  ON public.pole_catalog_history (catalog_id, changed_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. TRIGGERS E FUNÇÕES
-- ─────────────────────────────────────────────────────────────────────────────

-- Trigger: atualiza updated_at automaticamente
CREATE OR REPLACE FUNCTION public.set_pole_catalog_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pole_catalog_updated_at ON public.pole_catalog;
CREATE TRIGGER trg_pole_catalog_updated_at
  BEFORE UPDATE ON public.pole_catalog
  FOR EACH ROW EXECUTE FUNCTION public.set_pole_catalog_updated_at();

-- Trigger: popula histórico de alterações
CREATE OR REPLACE FUNCTION public.pole_catalog_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.pole_catalog_history
    (catalog_id, pole_id, old_values, new_values, change_type, changed_by)
  VALUES (
    COALESCE(NEW.id, OLD.id),
    COALESCE(NEW.pole_id, OLD.pole_id),
    to_jsonb(OLD),
    to_jsonb(NEW),
    TG_OP,
    current_user
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pole_catalog_audit ON public.pole_catalog;
CREATE TRIGGER trg_pole_catalog_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.pole_catalog
  FOR EACH ROW EXECUTE FUNCTION public.pole_catalog_audit();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. FUNÇÃO: buscar poste por nome com suporte a aliases
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.find_pole_by_name(p_name TEXT)
RETURNS TABLE (
  id BIGINT,
  pole_id TEXT,
  display_name TEXT,
  height_m NUMERIC,
  nominal_effort_dan NUMERIC,
  material TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.pole_id,
    p.display_name,
    p.height_m,
    p.nominal_effort_dan,
    p.material
  FROM public.pole_catalog p
  WHERE
    p.is_active = true
    AND (
      p.pole_id = p_name
      OR p.display_name ILIKE '%' || p_name || '%'
      OR p_name = ANY(p.aliases)
    )
  LIMIT 1;
END;
$$;

COMMENT ON FUNCTION public.find_pole_by_name(TEXT) IS
  'Busca um poste por ID, display_name ou alias. Retorna apenas ativos.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. FUNÇÃO: validar carregamento no poste
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.validate_pole_loading(
  p_pole_id TEXT,
  p_loading_dan NUMERIC
)
RETURNS TABLE (
  is_valid BOOLEAN,
  pole_id TEXT,
  nominal_effort_dan NUMERIC,
  loading_dan NUMERIC,
  safety_margin NUMERIC,
  message TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_pole_record RECORD;
  v_allowed_load NUMERIC;
  v_safety_margin NUMERIC;
BEGIN
  -- Buscar poste
  SELECT id, pole_id, nominal_effort_dan, safety_factor
  INTO v_pole_record
  FROM public.pole_catalog
  WHERE pole_id = p_pole_id AND is_active = true;

  IF v_pole_record IS NULL THEN
    RETURN QUERY SELECT
      false, p_pole_id, NULL::NUMERIC, p_loading_dan, NULL::NUMERIC,
      'Poste não encontrado: ' || p_pole_id;
    RETURN;
  END IF;

  -- Calcular carga permitida (nominal_effort / safety_factor)
  v_allowed_load := v_pole_record.nominal_effort_dan / COALESCE(v_pole_record.safety_factor, 2.5);
  
  -- Calcular margem de segurança
  v_safety_margin := ((v_allowed_load - p_loading_dan) / v_allowed_load) * 100;

  RETURN QUERY SELECT
    (p_loading_dan <= v_allowed_load),
    v_pole_record.pole_id,
    v_pole_record.nominal_effort_dan,
    p_loading_dan,
    v_safety_margin,
    CASE 
      WHEN p_loading_dan <= v_allowed_load THEN 
        'OK - Margem: ' || ROUND(v_safety_margin, 2) || '%'
      ELSE
        'OVERLOAD - Excesso: ' || ROUND(ABS(v_safety_margin), 2) || '%'
    END;
END;
$$;

COMMENT ON FUNCTION public.validate_pole_loading(TEXT, NUMERIC) IS
  'Valida se um carregamento está dentro da capacidade do poste com fator de segurança.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.pole_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pole_catalog_history ENABLE ROW LEVEL SECURITY;

-- Anon/authenticated: read-only ativos
DROP POLICY IF EXISTS pole_catalog_read_active ON public.pole_catalog;
CREATE POLICY pole_catalog_read_active ON public.pole_catalog
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Service role: full access
DROP POLICY IF EXISTS pole_catalog_service_full ON public.pole_catalog;
CREATE POLICY pole_catalog_service_full ON public.pole_catalog
  FOR ALL
  TO service_role
  USING (true);

-- History: read-only para authenticated
DROP POLICY IF EXISTS pole_history_read_authenticated ON public.pole_catalog_history;
CREATE POLICY pole_history_read_authenticated ON public.pole_catalog_history
  FOR SELECT
  TO authenticated
  USING (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. GRANTS
-- ─────────────────────────────────────────────────────────────────────────────

GRANT SELECT ON public.pole_catalog TO anon, authenticated;
GRANT SELECT ON public.pole_catalog_history TO authenticated;
GRANT ALL ON public.pole_catalog TO service_role;
GRANT ALL ON public.pole_catalog_history TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.pole_catalog_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.pole_catalog_history_id_seq TO service_role;

GRANT EXECUTE ON FUNCTION public.find_pole_by_name(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_pole_loading(TEXT, NUMERIC) TO anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. REGISTRAR MIGRATION
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public._migrations (filename)
VALUES ('105_create_pole_catalog.sql')
ON CONFLICT (filename) DO NOTHING;
