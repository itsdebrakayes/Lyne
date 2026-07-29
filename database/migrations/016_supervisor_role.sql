-- =============================================================
-- Q ME NOW — Migration 016: Supervisor role
-- Adds a section/branch supervisor tier between line staff and manager.
-- Supervisors get a read-only operational view of their branch (queues,
-- staff, busy times) and can VIEW targets, but not set them.
-- =============================================================

USE qme_now;

INSERT IGNORE INTO roles (id, name, label, description) VALUES
('role-supervisor-001', 'supervisor', 'Supervisor',
 'Section/branch supervisor — read-only operational view; sees branch targets, does not set them');
