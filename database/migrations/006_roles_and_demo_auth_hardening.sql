-- =============================================================
-- Q ME NOW — Migration 006: Role backfill for fresh production DBs
-- =============================================================

INSERT IGNORE INTO roles (id, name, label, description) VALUES
('role-staff-001',          'line_staff',     'Line Staff',     'Assigned queue/counter/service operator'),
('role-mgr-001',            'manager',        'Manager',        'Branch manager for staff assignments and branch operations'),
('role-exec-001',           'executive',      'Executive',      'Business-wide executive dashboard and analytics access'),
('role-platform-admin-001', 'platform_admin', 'Platform Admin', 'Internal QMe operator for onboarding and support');
