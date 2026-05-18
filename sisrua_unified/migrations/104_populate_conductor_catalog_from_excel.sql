-- Migration: 104_populate_conductor_catalog_from_excel.sql
-- Purpose: Populate conductor_catalog com dados extraídos do arquivo de cálculo de tração
-- Source: GD - IMPACT CONSULTORIA LTDA - UFV ESTIMA__PARTE_3_POSTE_22.xlsm

-- ─────────────────────────────────────────────────────────────────────────────
-- LIMPAR DADOS ANTERIORES (se houver, para permitir re-run da migration)
-- ─────────────────────────────────────────────────────────────────────────────

DELETE FROM public.conductor_catalog
  WHERE created_by = 'excel_import' AND source = 'import';

-- ─────────────────────────────────────────────────────────────────────────────
-- INSERIR CONDUTORES MT (MÉDIA TENSÃO)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.conductor_catalog (
  conductor_id, display_name, material, category, stranding_type,
  section_mm2, diameter_mm, weight_kg_per_km,
  standard, aliases, is_active, created_by, source, external_id
) VALUES
-- 556 MCM - Cobre nú (Alta capacidade)
('556MCM-CA, Nu', '556 MCM Cobre - Nú', 'Cu', 'MT', 'Nu',
 NULL, 22.0, 779.0,
 'ABNT NBR', ARRAY['556MCM', '556 MCM'], true, 'excel_import', 'import', 'EXCEL_556MCM_CANu'),

-- 397 MCM - Cobre nú
('397MCM-CA, Nu', '397 MCM Cobre - Nú', 'Cu', 'MT', 'Nu',
 NULL, 18.4, 558.0,
 'ABNT NBR', ARRAY['397MCM', '397 MCM'], true, 'excel_import', 'import', 'EXCEL_397MCM_CANu'),

-- 1/0 AWG - Cobre armado nú
('1/0AWG-CAA, Nu', '1/0 AWG Cobre Armado - Nú', 'Cu', 'MT', 'Nu',
 NULL, 10.2, 217.0,
 'ABNT NBR', ARRAY['1/0 AWG', 'AWG 1/0'], true, 'excel_import', 'import', 'EXCEL_1_0AWG_CAANu'),

-- 4 AWG - Cobre armado nú
('4 AWG-CAA, Nu', '4 AWG Cobre Armado - Nú', 'Cu', 'MT', 'Nu',
 NULL, 6.4, 85.0,
 'ABNT NBR', ARRAY['4 AWG', 'AWG 4'], true, 'excel_import', 'import', 'EXCEL_4AWG_CAANu'),

-- ─────────────────────────────────────────────────────────────────────────────
-- INSERIR CABOS MT ISOLADOS (XLPE - 34,5 kV)
-- ─────────────────────────────────────────────────────────────────────────────

-- 397 MCM - XLPE 34,5 kV
('397MCM-CA-XLPE-34', '397 MCM Cobre XLPE 34,5 kV', 'Cu', 'MT', 'XLPE',
 NULL, 34.0, 1195.0,
 'ABNT NBR', ARRAY['397MCM 34,5kV', '397MCM XLPE'], true, 'excel_import', 'import', 'EXCEL_397MCM_XLPE_34'),

-- ─────────────────────────────────────────────────────────────────────────────
-- INSERIR CABOS MT ISOLADOS (XLPE - 13,8 kV)
-- ─────────────────────────────────────────────────────────────────────────────

-- 397 MCM - XLPE 13,8 kV
('397MCM-CA-XLPE-13', '397 MCM Cobre XLPE 13,8 kV', 'Cu', 'MT', 'XLPE',
 NULL, 26.0, 749.0,
 'ABNT NBR', ARRAY['397MCM 13,8kV', '397MCM XLPE 13.8'], true, 'excel_import', 'import', 'EXCEL_397MCM_XLPE_13'),

-- 1/0 AWG - XLPE 13,8 kV
('1_0AWG-CAA-XLPE-13', '1/0 AWG Cobre Armado XLPE 13,8 kV', 'Cu', 'MT', 'XLPE',
 NULL, 17.0, 370.0,
 'ABNT NBR', ARRAY['1/0 AWG 13,8kV', '1/0 AWG XLPE'], true, 'excel_import', 'import', 'EXCEL_1_0AWG_XLPE_13'),

-- 4 AWG - XLPE 13,8 kV
('4AWG-CAA-XLPE-13', '4 AWG Cobre Armado XLPE 13,8 kV', 'Cu', 'MT', 'XLPE',
 NULL, 13.2, 193.0,
 'ABNT NBR', ARRAY['4 AWG 13,8kV', '4 AWG XLPE'], true, 'excel_import', 'import', 'EXCEL_4AWG_XLPE_13'),

-- ─────────────────────────────────────────────────────────────────────────────
-- INSERIR CABOS MULTIPLEXADOS MT (MTX)
-- ─────────────────────────────────────────────────────────────────────────────

-- 185 mm² - MTX 20/35 kV (3 fases)
('185mm2-MTX-MT-20_35', '185 mm² Multiplexado 20/35 kV', 'Cu', 'MT', 'MTX',
 185.0, 100.0, 5370.0,
 'ABNT NBR', ARRAY['185 mm2 20/35', '185 MTX 20/35'], true, 'excel_import', 'import', 'EXCEL_185MTX_20_35'),

-- 185 mm² - MTX 12/20 kV (3 fases)
('185mm2-MTX-MT-12_20', '185 mm² Multiplexado 12/20 kV', 'Cu', 'MT', 'MTX',
 185.0, 88.0, 4430.0,
 'ABNT NBR', ARRAY['185 mm2 12/20', '185 MTX 12/20'], true, 'excel_import', 'import', 'EXCEL_185MTX_12_20'),

-- 50 mm² - MTX 12/20 kV (3 fases)
('50mm2-MTX-MT-12_20', '50 mm² Multiplexado 12/20 kV', 'Cu', 'MT', 'MTX',
 50.0, 67.0, 2480.0,
 'ABNT NBR', ARRAY['50 mm2 12/20', '50 MTX 12/20'], true, 'excel_import', 'import', 'EXCEL_50MTX_12_20'),

-- ─────────────────────────────────────────────────────────────────────────────
-- INSERIR CABOS BT ISOLADOS (PVC)
-- ─────────────────────────────────────────────────────────────────────────────

-- 397 MCM - PVC
('397MCM-CA-PVC', '397 MCM Cobre PVC', 'Cu', 'BT', 'PVC',
 NULL, 24.0, 660.0,
 'ABNT NBR', ARRAY['397MCM PVC'], true, 'excel_import', 'import', 'EXCEL_397MCM_PVC'),

-- 1/0 AWG - PVC
('1_0AWG-CAA-PVC', '1/0 AWG Cobre Armado PVC', 'Cu', 'BT', 'PVC',
 NULL, 13.2, 192.0,
 'ABNT NBR', ARRAY['1/0 AWG PVC'], true, 'excel_import', 'import', 'EXCEL_1_0AWG_PVC'),

-- ─────────────────────────────────────────────────────────────────────────────
-- INSERIR CABOS MULTIPLEXADOS BT (MTX-BT)
-- ─────────────────────────────────────────────────────────────────────────────

-- 240 mm² - MTX-BT
('240mm2-MTX-BT', '240 mm² Multiplexado BT', 'Cu', 'BT', 'MTX',
 240.0, 61.0, 2745.0,
 'ABNT NBR', ARRAY['240 mm2 BT', '240 MTX'], true, 'excel_import', 'import', 'EXCEL_240MTX_BT'),

-- 185 mm² - MTX-BT
('185mm2-MTX-BT', '185 mm² Multiplexado BT', 'Cu', 'BT', 'MTX',
 185.0, 58.0, 2334.0,
 'ABNT NBR', ARRAY['185 mm2 BT', '185 MTX'], true, 'excel_import', 'import', 'EXCEL_185MTX_BT'),

-- 70 mm² - MTX-BT
('70mm2-MTX-BT', '70 mm² Multiplexado BT', 'Cu', 'BT', 'MTX',
 70.0, 30.0, 1008.0,
 'ABNT NBR', ARRAY['70 mm2 BT', '70 MTX'], true, 'excel_import', 'import', 'EXCEL_70MTX_BT'),

-- ─────────────────────────────────────────────────────────────────────────────
-- INSERIR CABOS ARMADOS
-- ─────────────────────────────────────────────────────────────────────────────

-- Cabo armado 240 mm²
('Cabo-Armado-240mm2', 'Cabo Armado 240 mm²', 'Cu', 'BT', 'Armado',
 240.0, 65.0, 5250.0,
 'ABNT NBR', ARRAY['Armado 240', 'CA 240'], true, 'excel_import', 'import', 'EXCEL_CaboArmado_240'),

-- Cabo armado 95 mm²
('Cabo-Armado-95mm2', 'Cabo Armado 95 mm²', 'Cu', 'BT', 'Armado',
 95.0, 43.0, 2300.0,
 'ABNT NBR', ARRAY['Armado 95', 'CA 95'], true, 'excel_import', 'import', 'EXCEL_CaboArmado_95'),

-- ─────────────────────────────────────────────────────────────────────────────
-- INSERIR MENSAGEIRO (Cordoalha de aço)
-- ─────────────────────────────────────────────────────────────────────────────

-- Cordoalha de aço 3/8"
('Cordoalha-Aco-3_8', 'Cordoalha de Aço 3/8" (9,52mm)', 'Other', 'BT', 'Aco',
 NULL, 9.5, 407.0,
 'ABNT NBR', ARRAY['Cordoalha 3/8"', 'Mensageiro aço'], true, 'excel_import', 'import', 'EXCEL_Cordoalha_3_8'),

-- ─────────────────────────────────────────────────────────────────────────────
-- INSERIR CABOS DUPLEX, TRIPLEX, QUADRIPLEX BT (6-AWG, 4-AWG, 1/0-AWG)
-- ─────────────────────────────────────────────────────────────────────────────

-- 6-AWG MTX-BT - Duplex
('6AWG-MTX-BT-Duplex', '6 AWG Multiplexado BT - Duplex', 'Cu', 'BT', 'MTX',
 NULL, 12.09, 113.0,
 'ABNT NBR', ARRAY['6 AWG Duplex'], true, 'excel_import', 'import', 'EXCEL_6AWG_Duplex'),

-- 6-AWG MTX-BT - Triplex
('6AWG-MTX-BT-Triplex', '6 AWG Multiplexado BT - Triplex', 'Cu', 'BT', 'MTX',
 NULL, 14.1, 173.0,
 'ABNT NBR', ARRAY['6 AWG Triplex'], true, 'excel_import', 'import', 'EXCEL_6AWG_Triplex'),

-- 6-AWG MTX-BT - Quadriplex
('6AWG-MTX-BT-Quad', '6 AWG Multiplexado BT - Quadriplex', 'Cu', 'BT', 'MTX',
 NULL, 17.48, 232.0,
 'ABNT NBR', ARRAY['6 AWG Quadriplex'], true, 'excel_import', 'import', 'EXCEL_6AWG_Quad'),

-- 4-AWG MTX-BT
('4AWG-MTX-BT', '4 AWG Multiplexado BT', 'Cu', 'BT', 'MTX',
 NULL, 20.94, 349.0,
 'ABNT NBR', ARRAY['4 AWG BT'], true, 'excel_import', 'import', 'EXCEL_4AWG_MTX_BT'),

-- 1/0-AWG MTX-BT
('1_0AWG-MTX-BT', '1/0 AWG Multiplexado BT', 'Cu', 'BT', 'MTX',
 NULL, 25.5, 834.0,
 'ABNT NBR', ARRAY['1/0 AWG BT'], true, 'excel_import', 'import', 'EXCEL_1_0AWG_MTX_BT')

ON CONFLICT (conductor_id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- REGISTRAR MIGRATION
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public._migrations (filename)
VALUES ('104_populate_conductor_catalog_from_excel.sql')
ON CONFLICT (filename) DO NOTHING;
