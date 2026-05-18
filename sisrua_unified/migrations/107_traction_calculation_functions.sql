-- Migration: 107_traction_calculation_functions.sql
-- Purpose: Create PostgreSQL functions for conductor traction and mechanical calculations
--          based on method extracted from Excel file (Impact Consultoria)
--
-- Objetivo: Implementar funções para cálculo de tração em condutores segundo
--           normas ABNT e método validado pela Impact Consultoria.

-- ═══════════════════════════════════════════════════════════════════════════════
-- DOCUMENTAÇÃO DO MÉTODO DE CÁLCULO
-- ═══════════════════════════════════════════════════════════════════════════════

/*
MÉTODO DE CÁLCULO DE TRAÇÃO EM CONDUTORES - IMPACT CONSULTORIA

Baseado em: "GD - IMPACT CONSULTORIA LTDA - UFV ESTIMA__PARTE_3_POSTE_22.xlsm"

REFERÊNCIAS NORMATIVAS:
  • ABNT NBR 5349 - Cabos de alumínio nu e de cobre nu
  • ABNT NBR 8489 - Postes de concreto
  • ABNT NBR 15688 - Cabos isolados com isolação de borracha
  • IEC 61089 - Round wire concentric lay overhead electrical stranded conductors
  • IEEE 524 - Guide to the Installation of Overhead Transmission Line Conductors

PRINCÍPIOS:
1. Condutores em vão comportam-se como catenárias (não como parábolas simples)
2. A tração é resultado da combinação de:
   - Peso próprio do condutor + acessórios (mensageiros, blindagem)
   - Carregamento de vento lateral
   - Carregamento de gelo (em regiões específicas)
3. A flecha determina a tração via relação: T = (w * L²) / (8 * f)

DADOS DE ENTRADA:
  • Peso do condutor (w): kg/m
  • Comprimento do vão (L): metros
  • Flecha (f): metros (definida no projeto)
  • Pressão do vento: daN/m²
  • Diâmetro total do condutor: metros
  • Ângulo de deflexão entre vãos: graus

PROCESSAMENTO:
  1. Calcular carga vertical (peso)
  2. Calcular carga horizontal (vento)
  3. Calcular tração individual por vão (catenary equation)
  4. Combinar vetorialmente as forças em cada nó (poste)
  5. Calcular resultante no poste

SAÍDAS:
  • Tração no condutor (daN)
  • Componentes X e Y da força
  • Resultante da força
  • Ângulo de aplicação
  • Índice de segurança (comparado com nominal do poste)
*/

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. FUNÇÃO: Calcular Carga de Vento
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.calculate_wind_load(
  p_wind_pressure_dan_m2 NUMERIC,  -- Pressão: 16.956 daN/m²
  p_conductor_diameter_m NUMERIC,   -- Diâmetro total: 0.1115 m
  p_span_length_m NUMERIC           -- Vão: 21 m
)
RETURNS TABLE (
  wind_force_dan NUMERIC,
  pressure_dan_m2 NUMERIC,
  diameter_m NUMERIC,
  span_m NUMERIC
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_force NUMERIC;
BEGIN
  -- Força do vento = Pressão × Diâmetro × Comprimento do vão
  -- F = P × D × L
  v_force := p_wind_pressure_dan_m2 * p_conductor_diameter_m * p_span_length_m;

  RETURN QUERY SELECT
    v_force,
    p_wind_pressure_dan_m2,
    p_conductor_diameter_m,
    p_span_length_m;
END;
$$;

COMMENT ON FUNCTION public.calculate_wind_load(NUMERIC, NUMERIC, NUMERIC) IS
  'Calcula a força de vento em um condutor. Método linear: F = P × D × L';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. FUNÇÃO: Calcular Tração em Condutor (Catenary)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.calculate_conductor_traction(
  p_weight_daN_m NUMERIC,      -- Peso do condutor: 3.992 daN/m
  p_span_length_m NUMERIC,      -- Vão: 21 m ou 38 m
  p_sag_m NUMERIC               -- Flecha: 0.5 m ou 0.8 m
)
RETURNS TABLE (
  traction_dan NUMERIC,
  weight_dan_m NUMERIC,
  span_m NUMERIC,
  sag_m NUMERIC,
  method TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_traction NUMERIC;
  v_parabolic NUMERIC;
  v_catenary_correction NUMERIC;
BEGIN
  /*
    Método: Parábola com correção catenary
    
    Aproximação parabólica simples:
      T_parabola = (w × L²) / (8 × f)
    
    Onde:
      T = Tração (daN)
      w = Peso por unidade de comprimento (daN/m)
      L = Comprimento do vão (m)
      f = Flecha (m)
    
    Correção catenary para maior precisão:
      T_catenary ≈ T_parabola × [1 + (1/3) × (f/L)²]
    
    Aplicado para flechas pequenas (f/L < 0.2)
  */

  -- Validações
  IF p_weight_daN_m IS NULL OR p_weight_daN_m <= 0 THEN
    RAISE EXCEPTION 'Peso do condutor deve ser > 0';
  END IF;

  IF p_span_length_m IS NULL OR p_span_length_m <= 0 THEN
    RAISE EXCEPTION 'Comprimento do vão deve ser > 0';
  END IF;

  IF p_sag_m IS NULL OR p_sag_m <= 0 THEN
    RAISE EXCEPTION 'Flecha deve ser > 0';
  END IF;

  -- Cálculo parabólico básico
  v_parabolic := (p_weight_daN_m * POWER(p_span_length_m, 2)) / (8 * p_sag_m);

  -- Correção catenary (válida para f/L < 0.2, típico em distribuição)
  -- Fator: 1 + (1/3) × (f/L)²
  IF p_sag_m / p_span_length_m < 0.2 THEN
    v_catenary_correction := 1 + ((1::NUMERIC / 3) * POWER(p_sag_m / p_span_length_m, 2));
    v_traction := v_parabolic * v_catenary_correction;
  ELSE
    -- Para flechas maiores, usar catenary mais precisa (iterativa)
    -- Neste caso, usar parábola pura como aproximação
    v_traction := v_parabolic;
  END IF;

  RETURN QUERY SELECT
    ROUND(v_traction, 3),
    p_weight_daN_m,
    p_span_length_m,
    p_sag_m,
    'Parabolic with Catenary correction';
END;
$$;

COMMENT ON FUNCTION public.calculate_conductor_traction(NUMERIC, NUMERIC, NUMERIC) IS
  'Calcula tração em condutor em catenária. Método: Parábola corrigida.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. FUNÇÃO: Combinar Forças Vetorialmente (Nó do Poste)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.combine_span_forces(
  p_span1_tension_dan NUMERIC,     -- Tração vão 1
  p_span1_angle_degrees NUMERIC,   -- Ângulo vão 1
  p_span1_wind_force_dan NUMERIC,  -- Força de vento vão 1
  p_span2_tension_dan NUMERIC,     -- Tração vão 2
  p_span2_angle_degrees NUMERIC,   -- Ângulo vão 2
  p_span2_wind_force_dan NUMERIC   -- Força de vento vão 2
)
RETURNS TABLE (
  resultant_force_dan NUMERIC,
  angle_degrees NUMERIC,
  comp_x_dan NUMERIC,
  comp_y_dan NUMERIC,
  description TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_rad1 NUMERIC;
  v_rad2 NUMERIC;
  v_comp_x NUMERIC;
  v_comp_y NUMERIC;
  v_resultant NUMERIC;
  v_angle NUMERIC;
  v_tension_x1 NUMERIC;
  v_tension_y1 NUMERIC;
  v_tension_x2 NUMERIC;
  v_tension_y2 NUMERIC;
BEGIN
  /*
    Combinação vetorial de forças em um nó (poste):
    
    Vão 1: ângulo = 0° (horizontal para esquerda)
      Comp_X1 = T1 × cos(0°) = T1
      Comp_Y1 = T1 × sin(0°) = 0 + Vento_Y1
    
    Vão 2: ângulo = 119° (deflexão)
      Comp_X2 = T2 × cos(119°) = T2 × (-0.485)
      Comp_Y2 = T2 × sin(119°) = T2 × 0.875
    
    Força de vento aplicada horizontalmente (eixo X)
    
    Resultante:
      F_X = Comp_X1 + Comp_X2 + Vento_X
      F_Y = Comp_Y1 + Comp_Y2 + Vento_Y
      F_resultante = sqrt(F_X² + F_Y²)
      θ = atan2(F_Y, F_X)
  */

  -- Converter para radianos
  v_rad1 := (p_span1_angle_degrees::NUMERIC * PI()) / 180;
  v_rad2 := (p_span2_angle_degrees::NUMERIC * PI()) / 180;

  -- Componentes da tração (considerando vento separadamente)
  v_tension_x1 := p_span1_tension_dan * COS(v_rad1);
  v_tension_y1 := p_span1_tension_dan * SIN(v_rad1);

  v_tension_x2 := p_span2_tension_dan * COS(v_rad2);
  v_tension_y2 := p_span2_tension_dan * SIN(v_rad2);

  -- Componentes totais (tração + vento)
  -- Vento é horizontal (X)
  v_comp_x := v_tension_x1 + v_tension_x2 + p_span1_wind_force_dan + p_span2_wind_force_dan;
  v_comp_y := v_tension_y1 + v_tension_y2;

  -- Resultante
  v_resultant := SQRT(POWER(v_comp_x, 2) + POWER(v_comp_y, 2));

  -- Ângulo da resultante
  IF v_comp_x = 0 THEN
    v_angle := CASE WHEN v_comp_y >= 0 THEN 90 ELSE 270 END;
  ELSE
    v_angle := (ATAN(v_comp_y / v_comp_x) * 180) / PI();
    -- Ajustar quadrante
    IF v_comp_x < 0 THEN
      v_angle := v_angle + 180;
    ELSIF v_comp_y < 0 AND v_comp_x > 0 THEN
      v_angle := v_angle + 360;
    END IF;
  END IF;

  RETURN QUERY SELECT
    ROUND(v_resultant, 2),
    ROUND(v_angle, 2),
    ROUND(v_comp_x, 2),
    ROUND(v_comp_y, 2),
    'Força resultante no poste (vetorial)';
END;
$$;

COMMENT ON FUNCTION public.combine_span_forces(NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC) IS
  'Combina forças de dois vãos vetorialmente para calcular resultante no poste.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. FUNÇÃO: Validar Esforço no Poste
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.validate_pole_effort(
  p_pole_id TEXT,
  p_resultant_force_dan NUMERIC,
  p_application_height_m NUMERIC DEFAULT 10.0
)
RETURNS TABLE (
  pole_id TEXT,
  nominal_effort_dan NUMERIC,
  resultant_force_dan NUMERIC,
  safety_factor NUMERIC,
  stress_percentage NUMERIC,
  status TEXT,
  message TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_pole RECORD;
  v_safety NUMERIC;
  v_stress_pct NUMERIC;
  v_status TEXT;
  v_message TEXT;
BEGIN
  -- Buscar poste
  SELECT id, pole_id, nominal_effort_dan, safety_factor
  INTO v_pole
  FROM public.pole_catalog
  WHERE pole_id = p_pole_id AND is_active = true;

  IF v_pole IS NULL THEN
    RETURN QUERY SELECT
      p_pole_id, NULL::NUMERIC, p_resultant_force_dan, NULL::NUMERIC,
      NULL::NUMERIC, 'ERROR',
      'Poste não encontrado: ' || p_pole_id;
    RETURN;
  END IF;

  -- Calcular utilização
  v_stress_pct := (p_resultant_force_dan / v_pole.nominal_effort_dan) * 100;

  -- Segurança
  v_safety := v_pole.nominal_effort_dan / p_resultant_force_dan;

  -- Status
  IF v_stress_pct <= 50 THEN
    v_status := 'OK';
    v_message := 'Poste com reserva adequada';
  ELSIF v_stress_pct <= 80 THEN
    v_status := 'WARNING';
    v_message := 'Poste próximo ao limite';
  ELSIF v_stress_pct <= 100 THEN
    v_status := 'CRITICAL';
    v_message := 'Poste no limite nominal';
  ELSE
    v_status := 'FAIL';
    v_message := 'SOBRECARGA: Poste inadequado para este esforço';
  END IF;

  RETURN QUERY SELECT
    v_pole.pole_id,
    v_pole.nominal_effort_dan,
    p_resultant_force_dan,
    ROUND(v_safety, 2),
    ROUND(v_stress_pct, 1),
    v_status,
    v_message;
END;
$$;

COMMENT ON FUNCTION public.validate_pole_effort(TEXT, NUMERIC, NUMERIC) IS
  'Valida se a resultante de força está dentro da capacidade do poste.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. FUNÇÃO INTEGRADA: Cálculo Completo de Tração
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.calculate_traction_complete(
  p_conductor_name TEXT,
  p_pole_id TEXT,
  p_span1_length_m NUMERIC,
  p_span1_sag_m NUMERIC,
  p_span1_angle_degrees NUMERIC,
  p_span2_length_m NUMERIC,
  p_span2_sag_m NUMERIC,
  p_span2_angle_degrees NUMERIC,
  p_wind_pressure_dan_m2 NUMERIC DEFAULT 16.956  -- Pressão padrão
)
RETURNS TABLE (
  conductor_name TEXT,
  pole_id TEXT,
  span1_tension_dan NUMERIC,
  span2_tension_dan NUMERIC,
  wind_force1_dan NUMERIC,
  wind_force2_dan NUMERIC,
  resultant_force_dan NUMERIC,
  resultant_angle_degrees NUMERIC,
  pole_status TEXT,
  validation_message TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_conductor RECORD;
  v_pole RECORD;
  v_span1_tension NUMERIC;
  v_span2_tension NUMERIC;
  v_wind_force1 NUMERIC;
  v_wind_force2 NUMERIC;
  v_resultant NUMERIC;
  v_resultant_angle NUMERIC;
  v_pole_status TEXT;
  v_validation TEXT;
BEGIN
  -- Buscar dados do condutor
  SELECT *
  INTO v_conductor
  FROM public.conductor_catalog
  WHERE conductor_id = p_conductor_name AND is_active = true;

  IF v_conductor IS NULL THEN
    RAISE EXCEPTION 'Condutor não encontrado: %', p_conductor_name;
  END IF;

  -- Buscar dados do poste
  SELECT *
  INTO v_pole
  FROM public.pole_catalog
  WHERE pole_id = p_pole_id AND is_active = true;

  IF v_pole IS NULL THEN
    RAISE EXCEPTION 'Poste não encontrado: %', p_pole_id;
  END IF;

  -- Calcular tração vão 1
  SELECT traction_dan INTO v_span1_tension
  FROM public.calculate_conductor_traction(
    v_conductor.weight_kg_per_km / 1000::NUMERIC,  -- Converter kg/km para daN/m
    p_span1_length_m,
    p_span1_sag_m
  );

  -- Calcular tração vão 2
  SELECT traction_dan INTO v_span2_tension
  FROM public.calculate_conductor_traction(
    v_conductor.weight_kg_per_km / 1000::NUMERIC,
    p_span2_length_m,
    p_span2_sag_m
  );

  -- Calcular força de vento vão 1
  SELECT wind_force_dan INTO v_wind_force1
  FROM public.calculate_wind_load(
    p_wind_pressure_dan_m2,
    v_conductor.diameter_mm / 1000::NUMERIC,  -- Converter mm para m
    p_span1_length_m
  );

  -- Calcular força de vento vão 2
  SELECT wind_force_dan INTO v_wind_force2
  FROM public.calculate_wind_load(
    p_wind_pressure_dan_m2,
    v_conductor.diameter_mm / 1000::NUMERIC,
    p_span2_length_m
  );

  -- Combinar forças
  SELECT resultant_force_dan, angle_degrees
  INTO v_resultant, v_resultant_angle
  FROM public.combine_span_forces(
    v_span1_tension, p_span1_angle_degrees, v_wind_force1,
    v_span2_tension, p_span2_angle_degrees, v_wind_force2
  );

  -- Validar poste
  SELECT status, message
  INTO v_pole_status, v_validation
  FROM public.validate_pole_effort(p_pole_id, v_resultant, 10.0);

  RETURN QUERY SELECT
    p_conductor_name,
    p_pole_id,
    ROUND(v_span1_tension, 2),
    ROUND(v_span2_tension, 2),
    ROUND(v_wind_force1, 2),
    ROUND(v_wind_force2, 2),
    v_resultant,
    v_resultant_angle,
    v_pole_status,
    v_validation;
END;
$$;

COMMENT ON FUNCTION public.calculate_traction_complete(
  TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC
) IS
  'Função integrada completa para cálculo de tração e validação de poste.';

-- ─────────────────────────────────────────────────────────────────────────────
-- GRANTS
-- ─────────────────────────────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION public.calculate_wind_load(NUMERIC, NUMERIC, NUMERIC)
  TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.calculate_conductor_traction(NUMERIC, NUMERIC, NUMERIC)
  TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.combine_span_forces(NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC)
  TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.validate_pole_effort(TEXT, NUMERIC, NUMERIC)
  TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.calculate_traction_complete(
  TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC
) TO anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- REGISTRAR MIGRATION
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public._migrations (filename)
VALUES ('107_traction_calculation_functions.sql')
ON CONFLICT (filename) DO NOTHING;
