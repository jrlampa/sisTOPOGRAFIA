-- Migration 011: Referential integrity for constants_catalog_history
-- Purpose: enforce that history rows always point to a real catalog entry.
--
-- Safety analysis:
--   - constants_catalog_history is populated only by the trg_constants_audit
--     trigger (BEFORE UPDATE on constants_catalog), which inserts OLD.id — always
--     a valid existing row.
--   - The backend (constantsService.ts) only SELECTs from constants_catalog;
--     no DELETE is ever issued from application code.
--   - ON DELETE RESTRICT prevents accidental catalog deletion when history
--     exists, forcing an explicit operator decision.
--   - Verified pre-condition: zero orphan rows before this migration.

ALTER TABLE constants_catalog_history
  ADD CONSTRAINT fk_history_catalog_id
  FOREIGN KEY (catalog_id)
  REFERENCES constants_catalog (id)
  ON DELETE RESTRICT
  DEFERRABLE INITIALLY DEFERRED;
