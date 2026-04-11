-- Seed: 001_cqt_lookup_tables.sql
-- Purpose: Seed CQT electrical lookup tables into constants_catalog.
--          Data sourced from server/constants/cqtLookupTables.ts v1.0.0.
--
-- Run after migration 002_constants_catalog.sql.
-- Safe to re-run (ON CONFLICT ... DO UPDATE).

-- ─────────────────────────────────────────────────────────────────────────────
-- TRAFOS_Z_BASELINE — 7 transformer kVA entries with impedance factors
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO constants_catalog (namespace, key, value, version_hash, environment, description)
VALUES (
  'cqt',
  'TRAFOS_Z_BASELINE',
  '[
    {"trafoKva": 30,    "qtFactor": 0.035},
    {"trafoKva": 45,    "qtFactor": 0.035},
    {"trafoKva": 75,    "qtFactor": 0.035},
    {"trafoKva": 112.5, "qtFactor": 0.035},
    {"trafoKva": 150,   "qtFactor": 0.035},
    {"trafoKva": 225,   "qtFactor": 0.035},
    {"trafoKva": 300,   "qtFactor": 0.035}
  ]'::jsonb,
  '1.0.0',
  'production',
  'Transformer kVA to impedance factor lookup — sourced from CQT workbook'
)
ON CONFLICT (namespace, key, environment) DO UPDATE
  SET value        = EXCLUDED.value,
      version_hash = EXCLUDED.version_hash,
      description  = EXCLUDED.description,
      is_active    = true;

-- ─────────────────────────────────────────────────────────────────────────────
-- CABOS_BASELINE — 25 cable types with electrical parameters
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO constants_catalog (namespace, key, value, version_hash, environment, description)
VALUES (
  'cqt',
  'CABOS_BASELINE',
  '[
    {"name": "25 Al - Arm",    "ampacity": 0,   "resistance": 1.5693, "reactance": 0.1039, "alpha": 0.00403, "divisorR": 1.2821},
    {"name": "50 Al - Arm",    "ampacity": 0,   "resistance": 0.8388, "reactance": 0.1039, "alpha": 0.00403, "divisorR": 1.2821},
    {"name": "95 Al - Arm",    "ampacity": 237, "resistance": 0.4197, "reactance": 0.098,  "alpha": 0.00403, "divisorR": 1.2821},
    {"name": "150 Al - Arm",   "ampacity": 0,   "resistance": 0.266,  "reactance": 0.096,  "alpha": 0.00403, "divisorR": 1.2821},
    {"name": "240 Al - Arm",   "ampacity": 395, "resistance": 0.1665, "reactance": 0.0858, "alpha": 0.00403, "divisorR": 1.2821},
    {"name": "25 Al",          "ampacity": 0,   "resistance": 1.5693, "reactance": 0.109,  "alpha": 0.00403, "divisorR": 1.2821},
    {"name": "35 Cu",          "ampacity": 0,   "resistance": 0.6887, "reactance": 0.1048, "alpha": 0.00393, "divisorR": 1.2821},
    {"name": "70 Cu",          "ampacity": 0,   "resistance": 0.3523, "reactance": 0.1024, "alpha": 0.00393, "divisorR": 1.2821},
    {"name": "95 Al",          "ampacity": 0,   "resistance": 0.4195, "reactance": 0.0958, "alpha": 0.00403, "divisorR": 1.2821},
    {"name": "120 Cu",         "ampacity": 0,   "resistance": 0.2023, "reactance": 0.0971, "alpha": 0.00393, "divisorR": 1.2821},
    {"name": "240 Al",         "ampacity": 476, "resistance": 0.1663, "reactance": 0.0897, "alpha": 0.00403, "divisorR": 1.2821},
    {"name": "240 Cu",         "ampacity": 430, "resistance": 0.1035, "reactance": 0.0897, "alpha": 0.00393, "divisorR": 1.2821},
    {"name": "500 Cu",         "ampacity": 0,   "resistance": 0.0568, "reactance": 0.0849, "alpha": 0.00393, "divisorR": 1.2821},
    {"name": "10 Cu_CONC_bi",  "ampacity": 63,  "resistance": 2.3801, "reactance": 0.101,  "alpha": 0.00403, "divisorR": 1.2821},
    {"name": "10 Cu_CONC_Tri", "ampacity": 63,  "resistance": 2.3801, "reactance": 0.101,  "alpha": 0.00403, "divisorR": 1.2821},
    {"name": "16 Al_CONC_bi",  "ampacity": 63,  "resistance": 2.4978, "reactance": 0.085,  "alpha": 0.00403, "divisorR": 1.2821},
    {"name": "16 Al_CONC_Tri", "ampacity": 63,  "resistance": 2.4978, "reactance": 0.85,   "alpha": 0.00403, "divisorR": 1.2821},
    {"name": "13 Al - DX",     "ampacity": 63,  "resistance": 2.6655, "reactance": 0.1022, "alpha": 0.00403, "divisorR": 1.2821},
    {"name": "13 Al - TX",     "ampacity": 63,  "resistance": 2.6655, "reactance": 0.1158, "alpha": 0.00403, "divisorR": 1.2821},
    {"name": "13 Al - QX",     "ampacity": 63,  "resistance": 2.6655, "reactance": 0.1384, "alpha": 0.00403, "divisorR": 1.2821},
    {"name": "21 Al - QX",     "ampacity": 63,  "resistance": 1.677,  "reactance": 0.135,  "alpha": 0.00403, "divisorR": 1.2821},
    {"name": "53 Al - QX",     "ampacity": 63,  "resistance": 0.6641, "reactance": 0.1311, "alpha": 0.00403, "divisorR": 1.2821},
    {"name": "70 Al - MX",     "ampacity": 202, "resistance": 0.5697, "reactance": 0.126,  "alpha": 0.00403, "divisorR": 1.2821},
    {"name": "185 Al - MX",    "ampacity": 355, "resistance": 0.2404, "reactance": 0.1178, "alpha": 0.00403, "divisorR": 1.4368},
    {"name": "240 Al - MX",    "ampacity": 473, "resistance": 0.163,  "reactance": 0.0903, "alpha": 0.00403, "divisorR": 1.2821}
  ]'::jsonb,
  '1.0.0',
  'production',
  'Cable electrical parameters lookup — sourced from CQT workbook'
)
ON CONFLICT (namespace, key, environment) DO UPDATE
  SET value        = EXCLUDED.value,
      version_hash = EXCLUDED.version_hash,
      description  = EXCLUDED.description,
      is_active    = true;

-- ─────────────────────────────────────────────────────────────────────────────
-- DISJUNTORES_BASELINE — 20 breaker protection entries (ib → disjuntor nominal)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO constants_catalog (namespace, key, value, version_hash, environment, description)
VALUES (
  'cqt',
  'DISJUNTORES_BASELINE',
  '[
    {"ib": 0,   "disjuntor": 0},
    {"ib": 6,   "disjuntor": 6},
    {"ib": 10,  "disjuntor": 10},
    {"ib": 16,  "disjuntor": 16},
    {"ib": 20,  "disjuntor": 20},
    {"ib": 25,  "disjuntor": 25},
    {"ib": 32,  "disjuntor": 32},
    {"ib": 40,  "disjuntor": 40},
    {"ib": 50,  "disjuntor": 50},
    {"ib": 63,  "disjuntor": 63},
    {"ib": 80,  "disjuntor": 80},
    {"ib": 100, "disjuntor": 100},
    {"ib": 125, "disjuntor": 125},
    {"ib": 160, "disjuntor": 160},
    {"ib": 200, "disjuntor": 200},
    {"ib": 250, "disjuntor": 250},
    {"ib": 315, "disjuntor": 315},
    {"ib": 400, "disjuntor": 400},
    {"ib": 500, "disjuntor": 500},
    {"ib": 630, "disjuntor": 630}
  ]'::jsonb,
  '1.0.0',
  'production',
  'Breaker nominal current lookup (ib → disjuntor) — sourced from CQT workbook'
)
ON CONFLICT (namespace, key, environment) DO UPDATE
  SET value        = EXCLUDED.value,
      version_hash = EXCLUDED.version_hash,
      description  = EXCLUDED.description,
      is_active    = true;
