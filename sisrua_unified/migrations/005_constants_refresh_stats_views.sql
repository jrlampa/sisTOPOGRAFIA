-- Migration 005: Operational statistics views for the constants refresh audit trail.
-- These views aggregate constants_refresh_events for dashboards and the
-- /api/constants/refresh-stats endpoint.  They are read-only projections —
-- no schema changes to existing tables are made here.

-- -------------------------------------------------------------------------
-- v_constants_refresh_stats: single-row aggregate summary
-- -------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_constants_refresh_stats AS
SELECT
    COUNT(*)                                              AS total_count,
    COUNT(*)  FILTER (WHERE success = true)               AS success_count,
    COUNT(*)  FILTER (WHERE success = false)              AS failure_count,
    ROUND(AVG(duration_ms))                               AS avg_duration_ms,
    MAX(duration_ms)                                      AS max_duration_ms,
    MIN(duration_ms)  FILTER (WHERE success = true)       AS min_success_duration_ms,
    MAX(created_at)   FILTER (WHERE success = true)       AS last_success_at,
    MIN(created_at)                                       AS first_refresh_at
FROM constants_refresh_events;

-- -------------------------------------------------------------------------
-- v_constants_refresh_ns_frequency: per-namespace usage counts
-- -------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_constants_refresh_ns_frequency AS
SELECT
    ns,
    COUNT(*) AS refresh_count
FROM
    constants_refresh_events,
    UNNEST(namespaces) AS ns
GROUP BY ns
ORDER BY refresh_count DESC;

-- -------------------------------------------------------------------------
-- v_constants_refresh_top_actors: top refreshers (IPs / actor labels)
-- -------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_constants_refresh_top_actors AS
SELECT
    actor,
    COUNT(*)    AS refresh_count,
    COUNT(*)    FILTER (WHERE success = true)  AS success_count,
    MAX(created_at)                             AS last_seen_at
FROM constants_refresh_events
GROUP BY actor
ORDER BY refresh_count DESC;

-- Grant SELECT to the service_role used by the application.
GRANT SELECT ON v_constants_refresh_stats        TO service_role;
GRANT SELECT ON v_constants_refresh_ns_frequency TO service_role;
GRANT SELECT ON v_constants_refresh_top_actors   TO service_role;
