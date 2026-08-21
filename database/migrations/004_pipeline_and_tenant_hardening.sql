-- =============================================================
-- LYNE — Migration 004: Pipeline metadata and prediction freshness
-- =============================================================

INSERT IGNORE INTO roles (id, name, label, description) VALUES
('role-platform-admin-001', 'platform_admin', 'Platform Admin', 'Internal QMe operator for onboarding and support');
