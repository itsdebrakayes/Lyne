-- =============================================================
-- Q ME NOW — Migration 002: Security, OCR, and Staff Invites
-- Version: 2.0  |  Date: 2026-05-27
-- =============================================================
-- This migration adds:
--   1. audit_logs        — Immutable audit trail for sensitive reads/writes
--   2. ocr_results       — OCR scan results (text only, no image storage in DB)
--   3. staff_invites     — Invite-code-based staff onboarding flow
--   4. staff_roles       — Normalized role table for staff (replaces inline role column)
--   5. Alters queue_tickets.status ENUM to remove 'called' (not a valid state)
--   6. Adds invited_by_staff_id and password_hash columns to staff table
-- =============================================================

-- =============================================================
-- SECTION 20: AUDIT LOGS
-- Immutable append-only log of sensitive data access and mutations.
-- Never update or delete rows in this table.
-- =============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id            VARCHAR(36)  NOT NULL PRIMARY KEY,
    actor_id      VARCHAR(36)  NULL,                     -- staff.id or users.id
    actor_type    ENUM('staff','user','anonymous','system') NOT NULL DEFAULT 'anonymous',
    action        VARCHAR(100) NOT NULL,                  -- e.g. 'read_customer', 'ocr_scan'
    resource_type VARCHAR(100) NULL,                      -- e.g. 'customer', 'ocr_document'
    resource_id   VARCHAR(36)  NULL,                      -- ID of the accessed resource
    ip_address    VARCHAR(45)  NULL,                      -- IPv4 or IPv6
    user_agent    TEXT         NULL,
    created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_audit_actor       (actor_id),
    INDEX idx_audit_action      (action),
    INDEX idx_audit_resource    (resource_type, resource_id),
    INDEX idx_audit_created_at  (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =============================================================
-- SECTION 21: OCR RESULTS
-- Stores extracted text from scanned documents.
-- The original image is stored in private Supabase Storage (bucket: ocr-documents).
-- Only the extracted text and metadata are stored in MySQL.
-- =============================================================
CREATE TABLE IF NOT EXISTS ocr_results (
    id                   VARCHAR(36)   NOT NULL PRIMARY KEY,
    user_id              CHAR(36)      NULL,
    queue_id             CHAR(36)      NULL,
    service_id           CHAR(36)      NULL,
    document_type        ENUM('national_id','trn','passport','drivers_license','other') NOT NULL DEFAULT 'other',
    raw_text             TEXT          NULL,              -- Full OCR text output (capped at 5000 chars)
    extracted_full_name  VARCHAR(255)  NULL,
    extracted_dob        VARCHAR(50)   NULL,              -- Stored as string to handle various formats
    extracted_national_id VARCHAR(100) NULL,              -- Stored encrypted in production
    extracted_trn        VARCHAR(20)   NULL,              -- Stored encrypted in production
    extracted_passport   VARCHAR(50)   NULL,
    confidence_score     DECIMAL(5,2)  NULL,              -- 0.00 to 100.00
    storage_path         VARCHAR(500)  NULL,              -- Path in Supabase Storage (private bucket)
    created_at           TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_ocr_user_id    (user_id),
    INDEX idx_ocr_queue_id   (queue_id),
    INDEX idx_ocr_service_id (service_id),
    CONSTRAINT fk_ocr_user    FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE SET NULL,
    CONSTRAINT fk_ocr_queue   FOREIGN KEY (queue_id)   REFERENCES queues(id)   ON DELETE SET NULL,
    CONSTRAINT fk_ocr_service FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =============================================================
-- SECTION 22: STAFF INVITES
-- Invite-code-based staff onboarding. Staff cannot self-register.
-- Managers create invites; invited staff redeem the code to activate.
-- =============================================================
CREATE TABLE IF NOT EXISTS staff_invites (
    id                    VARCHAR(36)  NOT NULL PRIMARY KEY,
    business_id           CHAR(36)     NOT NULL,
    branch_id             CHAR(36)     NULL,
    email                 VARCHAR(255) NOT NULL,
    full_name             VARCHAR(255) NOT NULL,
    role                  ENUM('line_staff','manager','executive') NOT NULL,
    invite_code           VARCHAR(64)  NOT NULL UNIQUE,
    invited_by_staff_id   CHAR(36)     NULL,
    status                ENUM('pending','redeemed','revoked','expired') NOT NULL DEFAULT 'pending',
    expires_at            TIMESTAMP    NOT NULL,
    redeemed_at           TIMESTAMP    NULL,
    redeemed_by_staff_id  CHAR(36)     NULL,
    revoked_at            TIMESTAMP    NULL,
    created_at            TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_invite_business  (business_id),
    INDEX idx_invite_email     (email),
    INDEX idx_invite_code      (invite_code),
    INDEX idx_invite_status    (status),
    CONSTRAINT fk_invite_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
    CONSTRAINT fk_invite_branch   FOREIGN KEY (branch_id)   REFERENCES branches(id)   ON DELETE SET NULL,
    CONSTRAINT fk_invite_inviter  FOREIGN KEY (invited_by_staff_id) REFERENCES staff(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =============================================================
-- SECTION 23: STAFF ROLES (normalized)
-- Provides a normalized role table for staff permissions.
-- Replaces the inline role string on the staff table.
-- =============================================================
CREATE TABLE IF NOT EXISTS staff_roles (
    id          VARCHAR(36)  NOT NULL PRIMARY KEY,
    role_name   VARCHAR(50)  NOT NULL UNIQUE,
    description TEXT         NULL,
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed default roles
INSERT IGNORE INTO staff_roles (id, role_name, description) VALUES
    (UUID(), 'line_staff', 'Front-line queue staff: can view and manage their assigned queue'),
    (UUID(), 'manager',    'Branch manager: can view all queues, assign staff, and see branch analytics'),
    (UUID(), 'executive',  'Executive: cross-branch analytics, reports, and predictions');

-- =============================================================
-- ALTER: Add new columns to existing staff table
-- =============================================================
ALTER TABLE staff
    ADD COLUMN password_hash       VARCHAR(255) NULL AFTER email,
    ADD COLUMN invited_by_staff_id CHAR(36)     NULL AFTER is_active;

-- =============================================================
-- INDEXES: Performance improvements for common queries
-- =============================================================
-- Core queue and wait-time indexes are created by schema.sql and migration 001.

-- =============================================================
-- VIEWS: Convenience views for common queries
-- =============================================================

-- View: Active queue with WAITING count only (for user-facing display)
CREATE OR REPLACE VIEW v_queue_waiting_count AS
SELECT
    q.id          AS queue_id,
    q.branch_id,
    q.service_id,
    q.queue_date,
    q.is_active,
    COUNT(CASE WHEN t.status = 'waiting' THEN 1 END)    AS waiting_count,
    COUNT(CASE WHEN t.status = 'in_service' THEN 1 END) AS in_service_count,
    MIN(CASE WHEN t.status = 'waiting' THEN t.estimated_wait_minutes END) AS min_wait_minutes,
    MAX(CASE WHEN t.status = 'waiting' THEN t.estimated_wait_minutes END) AS max_wait_minutes
FROM queues q
LEFT JOIN queue_tickets t ON q.id = t.queue_id
GROUP BY q.id, q.branch_id, q.service_id, q.queue_date, q.is_active;

-- View: Branch service summary (for branch detail page)
CREATE OR REPLACE VIEW v_branch_service_summary AS
SELECT
    b.id          AS branch_id,
    b.name        AS branch_name,
    b.business_id,
    s.id          AS service_id,
    s.name        AS service_name,
    s.ticket_prefix,
    s.base_avg_time_minutes,
    q.id          AS queue_id,
    q.is_active   AS queue_is_active,
    q.queue_date,
    COUNT(CASE WHEN t.status = 'waiting' THEN 1 END) AS waiting_count,
    MIN(CASE WHEN t.status = 'waiting' THEN t.estimated_wait_minutes END) AS estimated_wait_minutes
FROM branches b
JOIN services s  ON s.business_id = b.business_id AND s.is_active = TRUE
LEFT JOIN queues q ON q.branch_id = b.id AND q.service_id = s.id AND q.queue_date = CURDATE() AND q.is_active = TRUE
LEFT JOIN queue_tickets t ON t.queue_id = q.id
WHERE b.is_active = TRUE
GROUP BY b.id, b.name, b.business_id, s.id, s.name, s.ticket_prefix, s.base_avg_time_minutes,
         q.id, q.is_active, q.queue_date;
