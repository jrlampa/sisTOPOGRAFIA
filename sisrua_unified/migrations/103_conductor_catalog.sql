-- Migration: 103_conductor_catalog.sql
-- Purpose: Create a comprehensive conductor catalog for BT/MT networks.
--
-- Objetivo: Criar catálogo estruturado de condutores com propriedades técnicas
--           completas para cálculos elétricos, CQT, queda de tensão, etc.
--
-- Features:
--   - Propriedades técnicas: seção, diâmetro, resistência, reactância
--   - Propriedades mecânicas: peso, resistência à tração
--   - Suporte a aliases para normalização de nomes
--   - Histórico de alterações
--   - RLS para controle de acesso
--
-- Padrão seguido: similar a constants_catalog mas com schema específico para condutores.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. TABELA PRINCIPAL: conductor_catalog
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.conductor_catalog (
  -- Identidade
  id                    BIGSERIAL       PRIMARY KEY,
  conductor_id          TEXT            NOT NULL UNIQUE,  -- "70 Al - MX"
  display_name          TEXT            NOT NULL,         -- "70 mm² Alumínio - MX"

  -- Classificação
  material              TEXT            NOT NULL,         -- Al | Cu | Al-CONC
  category              TEXT            NOT NULL,         -- BT | MT | HV
  stranding_type        TEXT,                             -- MX | QX | DX | TX | DU

  -- Propriedades Geométricas
  section_mm2           NUMERIC(10,2),                    -- 70
  diameter_mm           NUMERIC(8,3),                     -- 9.45
  number_of_strands     INTEGER,                          -- 12, 19, etc.

  -- Propriedades Elétricas (20°C, AC 60Hz)
  resistance_ohm_per_km NUMERIC(10,5),  -- Resistência linear: 0.41
  reactance_mohm_per_km NUMERIC(10,3),  -- Reactância: 0.38
  conductivity_siemens  NUMERIC(12,4),  -- 58.0 (para Cu), 35.5 (para Al)

  -- Propriedades Mecânicas
  weight_kg_per_km      NUMERIC(10,4),  -- 0.23
  tensile_strength_dan  NUMERIC(10,2),  -- 1700 daN
  breaking_load_dan     NUMERIC(10,2),  -- Carga de ruptura
  elastic_modulus_pa    NUMERIC(15,0),  -- Módulo de elasticidade

  -- Propriedades Termais
  max_temperature_celsius     NUMERIC(5,1),  -- 80
  coefficient_temp_res_per_c  NUMERIC(10,6), -- Para Al: 0.00403

  -- Padrões e Normas
  standard              TEXT,  -- "NBR 8092", "IEC 61089", etc.
  norm_document         TEXT,  -- URL ou referência

  -- Alternativas de nomenclatura (para normalização e buscas)
  aliases               TEXT[] DEFAULT '{}',  -- ["70 Al", "AL 70 MX", "70AL-MX"]

  -- Auditoria e Governança
  is_active             BOOLEAN     NOT NULL DEFAULT true,
  deprecated_date       TIMESTAMPTZ,
  deprecated_reason     TEXT,
  notes                 TEXT,
  created_by            TEXT        DEFAULT 'system',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by            TEXT,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Rastreabilidade
  source                TEXT        DEFAULT 'manual',  -- manual | import | auto_generated
  external_id           TEXT,  -- ID externo (catalogo fabricante, ERP, etc)

  -- Constraints
  CONSTRAINT ck_material CHECK (material IN ('Al', 'Cu', 'Al-CONC', 'Other')),
  CONSTRAINT ck_category CHECK (category IN ('BT', 'MT', 'HV', 'EHV')),
  CONSTRAINT ck_positive_section CHECK (section_mm2 > 0),
  CONSTRAINT ck_positive_resistance CHECK (resistance_ohm_per_km > 0)
);

COMMENT ON TABLE public.conductor_catalog IS
  'Catálogo estruturado de condutores para redes BT/MT. '
  'Armazena propriedades técnicas, elétricas e mecânicas completas. '
  'Referenciar em canonical_edges para enriquecer dados de condutores.';

COMMENT ON COLUMN public.conductor_catalog.conductor_id IS
  'ID único do condutor (e.g., "70 Al - MX"). '
  'Chave para buscar em arestas (canonical_edges.bt_conductors[].conductorName).';

COMMENT ON COLUMN public.conductor_catalog.aliases IS
  'Variações de nomenclatura (e.g., ["70 Al", "AL 70 MX", "70AL-MX"]). '
  'Utilizado para normalização e busca fuzzy.';

COMMENT ON COLUMN public.conductor_catalog.resistance_ohm_per_km IS
  'Resistência linear em 20°C. Utilizado para cálculo de queda de tensão.';

COMMENT ON COLUMN public.conductor_catalog.reactance_mohm_per_km IS
  'Reactância indutiva (mΩ/km) em 60Hz. Para cálculo de impedância.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. TABELA DE HISTÓRICO: conductor_catalog_history
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.conductor_catalog_history (
  id                    BIGSERIAL       PRIMARY KEY,
  catalog_id            BIGINT          NOT NULL,
  conductor_id          TEXT            NOT NULL,
  old_values            JSONB,          -- Valores anteriores (para auditoria)
  new_values            JSONB,          -- Valores novos
  change_type           TEXT            NOT NULL,  -- INSERT | UPDATE | DELETE
  changed_by            TEXT,
  changed_at            TIMESTAMPTZ     NOT NULL DEFAULT now(),
  change_reason         TEXT,

  CONSTRAINT fk_conductor_history_catalog
    FOREIGN KEY (catalog_id)
    REFERENCES public.conductor_catalog (id)
    ON DELETE CASCADE
);

COMMENT ON TABLE public.conductor_catalog_history IS
  'Histórico completo de alterações na tabela conductor_catalog. '
  'Populate by trigger para auditoria e rastreabilidade.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. ÍNDICES PARA PERFORMANCE
-- ─────────────────────────────────────────────────────────────────────────────

-- Busca por ID do condutor (query principal)
CREATE INDEX IF NOT EXISTS idx_conductor_catalog_id
  ON public.conductor_catalog (conductor_id)
  WHERE is_active = true;

-- Busca por material e categoria (filtros)
CREATE INDEX IF NOT EXISTS idx_conductor_catalog_material_category
  ON public.conductor_catalog (material, category)
  WHERE is_active = true;

-- Busca por seção (agregações)
CREATE INDEX IF NOT EXISTS idx_conductor_catalog_section
  ON public.conductor_catalog (section_mm2)
  WHERE is_active = true;

-- Busca por aliases (GIN para array)
CREATE INDEX IF NOT EXISTS idx_conductor_catalog_aliases
  ON public.conductor_catalog USING GIN (aliases);

-- Busca de histórico por catalog_id
CREATE INDEX IF NOT EXISTS idx_conductor_history_catalog_id
  ON public.conductor_catalog_history (catalog_id, changed_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. TRIGGERS E FUNÇÕES
-- ─────────────────────────────────────────────────────────────────────────────

-- Trigger: atualiza updated_at automaticamente
CREATE OR REPLACE FUNCTION public.set_conductor_catalog_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_conductor_catalog_updated_at ON public.conductor_catalog;
CREATE TRIGGER trg_conductor_catalog_updated_at
  BEFORE UPDATE ON public.conductor_catalog
  FOR EACH ROW EXECUTE FUNCTION public.set_conductor_catalog_updated_at();

-- Trigger: popula histórico de alterações
CREATE OR REPLACE FUNCTION public.conductor_catalog_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.conductor_catalog_history
    (catalog_id, conductor_id, old_values, new_values, change_type, changed_by)
  VALUES (
    COALESCE(NEW.id, OLD.id),
    COALESCE(NEW.conductor_id, OLD.conductor_id),
    to_jsonb(OLD),
    to_jsonb(NEW),
    TG_OP,
    current_user
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_conductor_catalog_audit ON public.conductor_catalog;
CREATE TRIGGER trg_conductor_catalog_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.conductor_catalog
  FOR EACH ROW EXECUTE FUNCTION public.conductor_catalog_audit();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. FUNÇÃO: buscar condutor por nome com suporte a aliases
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.find_conductor_by_name(p_name TEXT)
RETURNS TABLE (
  id BIGINT,
  conductor_id TEXT,
  display_name TEXT,
  material TEXT,
  section_mm2 NUMERIC,
  resistance_ohm_per_km NUMERIC,
  weight_kg_per_km NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.conductor_id,
    c.display_name,
    c.material,
    c.section_mm2,
    c.resistance_ohm_per_km,
    c.weight_kg_per_km
  FROM public.conductor_catalog c
  WHERE
    c.is_active = true
    AND (
      c.conductor_id = p_name
      OR c.display_name ILIKE '%' || p_name || '%'
      OR p_name = ANY(c.aliases)
    )
  LIMIT 1;
END;
$$;

COMMENT ON FUNCTION public.find_conductor_by_name(TEXT) IS
  'Busca um condutor por nome, display_name ou alias. Retorna apenas ativos.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. FUNÇÃO: enriquecer dados de condutor em uma aresta
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.enrich_conductor_data(p_conductor_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'conductor_id', c.conductor_id,
    'display_name', c.display_name,
    'material', c.material,
    'section_mm2', c.section_mm2,
    'diameter_mm', c.diameter_mm,
    'resistance_ohm_per_km', c.resistance_ohm_per_km,
    'reactance_mohm_per_km', c.reactance_mohm_per_km,
    'weight_kg_per_km', c.weight_kg_per_km,
    'tensile_strength_dan', c.tensile_strength_dan,
    'max_temperature_celsius', c.max_temperature_celsius
  ) INTO v_result
  FROM public.conductor_catalog c
  WHERE
    c.is_active = true
    AND (
      c.conductor_id = p_conductor_name
      OR p_conductor_name = ANY(c.aliases)
    )
  LIMIT 1;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

COMMENT ON FUNCTION public.enrich_conductor_data(TEXT) IS
  'Retorna objeto JSONB com propriedades completas do condutor.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.conductor_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conductor_catalog_history ENABLE ROW LEVEL SECURITY;

-- Anon/authenticated: read-only ativos
DROP POLICY IF EXISTS conductor_catalog_read_active ON public.conductor_catalog;
CREATE POLICY conductor_catalog_read_active ON public.conductor_catalog
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Service role: full access
DROP POLICY IF EXISTS conductor_catalog_service_full ON public.conductor_catalog;
CREATE POLICY conductor_catalog_service_full ON public.conductor_catalog
  FOR ALL
  TO service_role
  USING (true);

-- History: read-only para authenticated
DROP POLICY IF EXISTS conductor_history_read_authenticated ON public.conductor_catalog_history;
CREATE POLICY conductor_history_read_authenticated ON public.conductor_catalog_history
  FOR SELECT
  TO authenticated
  USING (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. GRANTS
-- ─────────────────────────────────────────────────────────────────────────────

GRANT SELECT ON public.conductor_catalog TO anon, authenticated;
GRANT SELECT ON public.conductor_catalog_history TO authenticated;
GRANT ALL ON public.conductor_catalog TO service_role;
GRANT ALL ON public.conductor_catalog_history TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.conductor_catalog_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.conductor_catalog_history_id_seq TO service_role;

GRANT EXECUTE ON FUNCTION public.find_conductor_by_name(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enrich_conductor_data(TEXT) TO anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. SAMPLE DATA (Condutores Brasileiros Padrão)
-- ─────────────────────────────────────────────────────────────────────────────

-- BT - Alumínio Meia Dura (MX)
INSERT INTO public.conductor_catalog (
  conductor_id, display_name, material, category, stranding_type,
  section_mm2, diameter_mm, number_of_strands,
  resistance_ohm_per_km, reactance_mohm_per_km,
  weight_kg_per_km, tensile_strength_dan,
  max_temperature_celsius, coefficient_temp_res_per_c,
  standard, aliases, created_by
) VALUES
-- 35 Al - MX
('35 Al - MX', '35 mm² Alumínio Meia Dura', 'Al', 'BT', 'MX',
 35.0, 6.64, 7,
 1.236, 0.380,
 0.095, 900.0,
 80.0, 0.00403,
 'NBR 8092', ARRAY['35 Al', 'AL 35 MX', '35AL-MX'], 'system'),

-- 70 Al - MX
('70 Al - MX', '70 mm² Alumínio Meia Dura', 'Al', 'BT', 'MX',
 70.0, 9.45, 12,
 0.618, 0.380,
 0.191, 1700.0,
 80.0, 0.00403,
 'NBR 8092', ARRAY['70 Al', 'AL 70 MX', '70AL-MX'], 'system'),

-- 120 Al - MX
('120 Al - MX', '120 mm² Alumínio Meia Dura', 'Al', 'BT', 'MX',
 120.0, 12.39, 19,
 0.381, 0.380,
 0.327, 2850.0,
 80.0, 0.00403,
 'NBR 8092', ARRAY['120 Al', 'AL 120 MX', '120AL-MX'], 'system'),

-- 185 Al - MX
('185 Al - MX', '185 mm² Alumínio Meia Dura', 'Al', 'BT', 'MX',
 185.0, 15.34, 19,
 0.246, 0.380,
 0.505, 4400.0,
 80.0, 0.00403,
 'NBR 8092', ARRAY['185 Al', 'AL 185 MX', '185AL-MX'], 'system'),

-- 240 Al - MX
('240 Al - MX', '240 mm² Alumínio Meia Dura', 'Al', 'BT', 'MX',
 240.0, 17.48, 19,
 0.190, 0.380,
 0.654, 5700.0,
 80.0, 0.00403,
 'NBR 8092', ARRAY['240 Al', 'AL 240 MX', '240AL-MX'], 'system'),

-- 25 Al - Armado
('25 Al - Arm', '25 mm² Alumínio Armado', 'Al', 'BT', 'Arm',
 25.0, 5.63, 7,
 1.828, 0.380,
 0.074, 600.0,
 80.0, 0.00403,
 'NBR 8092', ARRAY['25 Al', 'AL 25 ARM', '25AL-Arm'], 'system'),

-- 50 Al - Armado
('50 Al - Arm', '50 mm² Alumínio Armado', 'Al', 'BT', 'Arm',
 50.0, 8.00, 7,
 0.914, 0.380,
 0.148, 1200.0,
 80.0, 0.00403,
 'NBR 8092', ARRAY['50 Al', 'AL 50 ARM', '50AL-Arm'], 'system'),

-- 95 Al - Armado
('95 Al - Arm', '95 mm² Alumínio Armado', 'Al', 'BT', 'Arm',
 95.0, 11.00, 7,
 0.482, 0.380,
 0.279, 2250.0,
 80.0, 0.00403,
 'NBR 8092', ARRAY['95 Al', 'AL 95 ARM', '95AL-Arm'], 'system'),

-- Cobre
('70 Cu', '70 mm² Cobre', 'Cu', 'BT', 'MX',
 70.0, 9.45, 12,
 0.251, 0.350,
 0.607, 2500.0,
 80.0, 0.00383,
 'NBR 8092', ARRAY['70 Cu', 'CU 70'], 'system'),

-- MT
('35 Al', '35 mm² Alumínio MT', 'Al', 'MT', 'QX',
 35.0, 6.64, 6,
 1.236, 0.360,
 0.095, 900.0,
 80.0, 0.00403,
 'NBR 8092', ARRAY['35 AL MT', 'AL35'], 'system'),

('70 Al', '70 mm² Alumínio MT', 'Al', 'MT', 'QX',
 70.0, 9.45, 12,
 0.618, 0.360,
 0.191, 1700.0,
 80.0, 0.00403,
 'NBR 8092', ARRAY['70 AL MT', 'AL70'], 'system'),

('95 Al', '95 mm² Alumínio MT', 'Al', 'MT', 'QX',
 95.0, 11.00, 12,
 0.482, 0.360,
 0.241, 2250.0,
 80.0, 0.00403,
 'NBR 8092', ARRAY['95 AL MT', 'AL95'], 'system'),

('120 Al', '120 mm² Alumínio MT', 'Al', 'MT', 'QX',
 120.0, 12.39, 19,
 0.381, 0.360,
 0.327, 2850.0,
 80.0, 0.00403,
 'NBR 8092', ARRAY['120 AL MT', 'AL120'], 'system'),

('150 Al', '150 mm² Alumínio MT', 'Al', 'MT', 'QX',
 150.0, 13.84, 19,
 0.305, 0.360,
 0.409, 3550.0,
 80.0, 0.00403,
 'NBR 8092', ARRAY['150 AL MT', 'AL150'], 'system'),

('240 Al', '240 mm² Alumínio MT', 'Al', 'MT', 'QX',
 240.0, 17.48, 19,
 0.190, 0.360,
 0.654, 5700.0,
 80.0, 0.00403,
 'NBR 8092', ARRAY['240 AL MT', 'AL240'], 'system')
ON CONFLICT (conductor_id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. REGISTRAR MIGRATION
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public._migrations (filename)
VALUES ('103_conductor_catalog.sql')
ON CONFLICT (filename) DO NOTHING;
