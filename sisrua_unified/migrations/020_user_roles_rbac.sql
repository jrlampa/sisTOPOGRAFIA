-- Migration 020: User Roles and RBAC Foundation
-- Description: Create user_roles table and enum for role-based access control
-- Date: 2026-04-13
-- Author: RBAC Implementation

BEGIN;

-- Create enum type for roles
CREATE TYPE user_role AS ENUM (
    'admin',       -- Full system access
    'technician',  -- Read, write, export, calculate
    'viewer',      -- Read-only access
    'guest'        -- No permissions (logged out or unauthenticated)
);

-- Create user_roles table
CREATE TABLE IF NOT EXISTS user_roles (
    user_id TEXT PRIMARY KEY,
    role user_role NOT NULL DEFAULT 'viewer',
    assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    assigned_by TEXT,
    last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reason TEXT,
    CONSTRAINT valid_user_id CHECK (user_id <> '')
);

-- Create index for efficient role lookups
CREATE INDEX IF NOT EXISTS idx_user_roles_role 
    ON user_roles(role) 
    WHERE role <> 'guest'::user_role;

-- Create index for audit trails (last_updated)
CREATE INDEX IF NOT EXISTS idx_user_roles_updated 
    ON user_roles(last_updated DESC);

-- Create audit log table for RBAC changes
CREATE TABLE IF NOT EXISTS user_roles_audit (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    old_role user_role,
    new_role user_role NOT NULL,
    changed_by TEXT NOT NULL,
    changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reason TEXT,
    CONSTRAINT valid_audit_user_id CHECK (user_id <> ''),
    CONSTRAINT valid_audit_editor CHECK (changed_by <> '')
);

-- Create index for audit queries
CREATE INDEX IF NOT EXISTS idx_user_roles_audit_user 
    ON user_roles_audit(user_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_roles_audit_timestamp 
    ON user_roles_audit(changed_at DESC);

-- Trigger to update last_updated on user_roles
CREATE OR REPLACE FUNCTION update_user_roles_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_updated = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_user_roles_updated ON user_roles;
CREATE TRIGGER trigger_user_roles_updated
    BEFORE UPDATE ON user_roles
    FOR EACH ROW
    EXECUTE FUNCTION update_user_roles_timestamp();

-- Trigger to log changes to user_roles_audit
CREATE OR REPLACE FUNCTION audit_user_roles_changes()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_roles_audit (user_id, old_role, new_role, changed_by, reason)
    VALUES (
        NEW.user_id,
        OLD.role,
        NEW.role,
        COALESCE(NEW.assigned_by, 'system'),
        NEW.reason
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_audit_user_roles_insert ON user_roles;
CREATE TRIGGER trigger_audit_user_roles_insert
    AFTER INSERT ON user_roles
    FOR EACH ROW
    EXECUTE FUNCTION audit_user_roles_changes();

DROP TRIGGER IF EXISTS trigger_audit_user_roles_update ON user_roles;
CREATE TRIGGER trigger_audit_user_roles_update
    AFTER UPDATE ON user_roles
    FOR EACH ROW
    WHEN (OLD.role != NEW.role)
    EXECUTE FUNCTION audit_user_roles_changes();

-- Insert default admin role for monitoring/system operations
INSERT INTO user_roles (user_id, role, assigned_by, reason)
VALUES (
    'system-admin',
    'admin'::user_role,
    'migration',
    'System administrator for monitoring and maintenance'
)
ON CONFLICT (user_id) DO NOTHING;

-- Create view for role statistics
CREATE OR REPLACE VIEW v_user_roles_summary AS
SELECT 
    role,
    COUNT(*) as user_count,
    COUNT(DISTINCT assigned_by) as assigned_by_count,
    MIN(assigned_at) as earliest_assignment,
    MAX(last_updated) as latest_update
FROM user_roles
WHERE role <> 'guest'::user_role
GROUP BY role;

COMMIT;
