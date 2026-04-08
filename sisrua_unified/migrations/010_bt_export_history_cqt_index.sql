-- Migration 010: BT export history filtering optimization
-- Purpose: accelerate paginated queries filtered by cqt_scenario and recency.

CREATE INDEX IF NOT EXISTS idx_bt_export_history_cqt_created_at
    ON bt_export_history (cqt_scenario, created_at DESC)
    WHERE cqt_scenario IS NOT NULL;
