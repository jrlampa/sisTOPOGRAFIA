-- Migration: 106_populate_pole_catalog_from_excel.sql
-- Purpose: Populate pole_catalog com dados extraídos do arquivo de cálculo de tração
-- Source: GD - IMPACT CONSULTORIA LTDA - UFV ESTIMA__PARTE_3_POSTE_22.xlsm

-- ─────────────────────────────────────────────────────────────────────────────
-- LIMPAR DADOS ANTERIORES
-- ─────────────────────────────────────────────────────────────────────────────

DELETE FROM public.pole_catalog
  WHERE created_by = 'excel_import' AND source = 'import';

-- ─────────────────────────────────────────────────────────────────────────────
-- INSERIR POSTES DE CONCRETO CIRCULAR (CC)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.pole_catalog (
  pole_id, display_name, material, pole_type,
  height_m, external_diameter_mm, wall_thickness_mm, base_diameter_mm,
  nominal_effort_dan, safety_factor, density_kg_m3, compressive_strength_pa,
  standard, recommended_span_m, max_wind_speed_kmh, max_temperature_celsius,
  aliases, is_active, created_by, source, external_id
) VALUES
-- 8.5 m / 150 daN
('8.5m-150daN-CC', '8,5 m / 150 daN - Concreto Circular', 'CC', 'circular',
 8.5, 210, 35, 280,
 150.0, 2.5, 2400, 40000000,
 'NBR 8489', 20.0, 130, 80.0,
 ARRAY['8.5m/150', 'CC 150', 'Poste 8.5'], true, 'excel_import', 'import', 'EXCEL_8_5M_150DAN'),

-- 10.5 m / 200 daN
('10.5m-200daN-CC', '10,5 m / 200 daN - Concreto Circular', 'CC', 'circular',
 10.5, 220, 38, 290,
 200.0, 2.5, 2400, 40000000,
 'NBR 8489', 25.0, 140, 80.0,
 ARRAY['10.5m/200', 'CC 200', 'Poste 10.5'], true, 'excel_import', 'import', 'EXCEL_10_5M_200DAN'),

-- 12.0 m / 300 daN (Usado no exemplo do Excel)
('12m-300daN-CC', '12 m / 300 daN - Concreto Circular', 'CC', 'circular',
 12.0, 230, 40, 300,
 300.0, 2.5, 2400, 40000000,
 'NBR 8489', 30.0, 150, 80.0,
 ARRAY['12m/300', 'CC 300', 'Poste 12', 'Poste 12 m'], true, 'excel_import', 'import', 'EXCEL_12M_300DAN'),

-- 12.5 m / 300 daN
('12.5m-300daN-CC', '12,5 m / 300 daN - Concreto Circular', 'CC', 'circular',
 12.5, 235, 40, 310,
 300.0, 2.5, 2400, 40000000,
 'NBR 8489', 32.0, 150, 80.0,
 ARRAY['12.5m/300', 'CC 300 12.5', 'Poste 12.5'], true, 'excel_import', 'import', 'EXCEL_12_5M_300DAN'),

-- 14.0 m / 400 daN
('14m-400daN-CC', '14 m / 400 daN - Concreto Circular', 'CC', 'circular',
 14.0, 250, 45, 330,
 400.0, 2.5, 2400, 40000000,
 'NBR 8489', 35.0, 160, 80.0,
 ARRAY['14m/400', 'CC 400', 'Poste 14', 'Poste 14 m'], true, 'excel_import', 'import', 'EXCEL_14M_400DAN'),

-- ─────────────────────────────────────────────────────────────────────────────
-- INSERIR POSTES DE FIBRA DE VIDRO CIRCULAR (FV)
-- ─────────────────────────────────────────────────────────────────────────────

-- 8.5 m / 150 daN - Fibra de vidro
('8.5m-150daN-FV', '8,5 m / 150 daN - Fibra de Vidro Circular', 'FV', 'circular',
 8.5, 200, NULL, 200,
 150.0, 3.0, 1900, 90000000,  -- Fibra de vidro é mais resistente
 'IEC 60168', 22.0, 180, 80.0,
 ARRAY['8.5m/150 FV', 'FV 150', 'Fibra vidro 8.5'], true, 'excel_import', 'import', 'EXCEL_8_5M_150FV'),

-- 12.0 m / 300 daN - Fibra de vidro
('12m-300daN-FV', '12 m / 300 daN - Fibra de Vidro Circular', 'FV', 'circular',
 12.0, 220, NULL, 220,
 300.0, 3.0, 1900, 90000000,
 'IEC 60168', 32.0, 180, 80.0,
 ARRAY['12m/300 FV', 'FV 300', 'Fibra vidro 12'], true, 'excel_import', 'import', 'EXCEL_12M_300FV'),

-- ─────────────────────────────────────────────────────────────────────────────
-- INSERIR POSTES DE CONCRETO DUPLO T (CDT)
-- ─────────────────────────────────────────────────────────────────────────────

-- 10.5 m / 250 daN - Concreto duplo T
('10.5m-250daN-CDT', '10,5 m / 250 daN - Concreto Duplo T', 'CDT', 'duplo_t',
 10.5, NULL, NULL, NULL,
 250.0, 2.5, 2400, 40000000,
 'NBR 8489', 28.0, 140, 80.0,
 ARRAY['10.5m/250 CDT', 'CDT 250', 'Duplo T 10.5'], true, 'excel_import', 'import', 'EXCEL_10_5M_250CDT'),

-- 12.0 m / 350 daN - Concreto duplo T
('12m-350daN-CDT', '12 m / 350 daN - Concreto Duplo T', 'CDT', 'duplo_t',
 12.0, NULL, NULL, NULL,
 350.0, 2.5, 2400, 40000000,
 'NBR 8489', 32.0, 150, 80.0,
 ARRAY['12m/350 CDT', 'CDT 350', 'Duplo T 12'], true, 'excel_import', 'import', 'EXCEL_12M_350CDT'),

-- ─────────────────────────────────────────────────────────────────────────────
-- INSERIR POSTES METÁLICOS (Treliçados/Tubulares)
-- ─────────────────────────────────────────────────────────────────────────────

-- 12.0 m / 400 daN - Metálico treliçado
('12m-400daN-Metal', '12 m / 400 daN - Metálico Treliçado', 'Metalico', 'lattice',
 12.0, NULL, NULL, NULL,
 400.0, 2.0, 7850, 250000000,  -- Aço
 'NBR 8850', 35.0, 180, 60.0,
 ARRAY['12m/400 Metal', 'Metal 400', 'Treliçado 12'], true, 'excel_import', 'import', 'EXCEL_12M_400Metal'),

-- 15.0 m / 500 daN - Metálico treliçado
('15m-500daN-Metal', '15 m / 500 daN - Metálico Treliçado', 'Metalico', 'lattice',
 15.0, NULL, NULL, NULL,
 500.0, 2.0, 7850, 250000000,
 'NBR 8850', 40.0, 180, 60.0,
 ARRAY['15m/500 Metal', 'Metal 500', 'Treliçado 15'], true, 'excel_import', 'import', 'EXCEL_15M_500Metal')

ON CONFLICT (pole_id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- REGISTRAR MIGRATION
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public._migrations (filename)
VALUES ('106_populate_pole_catalog_from_excel.sql')
ON CONFLICT (filename) DO NOTHING;
