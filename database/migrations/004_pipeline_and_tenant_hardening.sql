-- =============================================================
-- Q ME NOW — Migration 004: Pipeline metadata and prediction freshness
-- =============================================================

ALTER TABLE predictive_results
    ADD COLUMN IF NOT EXISTS service_id CHAR(36) NULL AFTER branch_id,
    ADD COLUMN IF NOT EXISTS source_window_start DATETIME NULL AFTER model_version,
    ADD COLUMN IF NOT EXISTS source_window_end DATETIME NULL AFTER source_window_start,
    ADD COLUMN IF NOT EXISTS records_processed INT DEFAULT 0 AFTER source_window_end,
    ADD COLUMN IF NOT EXISTS stale_after DATETIME NULL AFTER records_processed;

ALTER TABLE queue_tickets
    ADD COLUMN IF NOT EXISTS verification_code VARCHAR(12) NULL AFTER ticket_number,
    MODIFY COLUMN status ENUM('waiting','called','in_service','served','left','cancelled','no_show')
    NOT NULL DEFAULT 'waiting';

UPDATE queue_tickets
SET verification_code = UPPER(SUBSTRING(REPLACE(UUID(), '-', ''), 1, 8))
WHERE verification_code IS NULL;

ALTER TABLE queue_tickets
    MODIFY COLUMN verification_code VARCHAR(12) NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tickets_verification_code
    ON queue_tickets(verification_code);

CREATE INDEX IF NOT EXISTS idx_prediction_freshness
    ON predictive_results(business_id, insight_type, generated_at, stale_after);

INSERT IGNORE INTO roles (id, name, label, description) VALUES
('role-platform-admin-001', 'platform_admin', 'Platform Admin', 'Internal QMe operator for onboarding and support');

CREATE TABLE IF NOT EXISTS pipeline_runs (
    id                  CHAR(36)     NOT NULL,
    business_id         CHAR(36)     NOT NULL,
    run_type            ENUM('export','notebook','import','full','manual_trigger') NOT NULL DEFAULT 'full',
    status              ENUM('queued','running','succeeded','failed') NOT NULL DEFAULT 'queued',
    model_version       VARCHAR(50),
    source_window_start DATETIME,
    source_window_end   DATETIME,
    records_exported    INT          DEFAULT 0,
    records_imported    INT          DEFAULT 0,
    error_message       TEXT,
    requested_by_staff_id CHAR(36),
    started_at          TIMESTAMP    NULL,
    completed_at        TIMESTAMP    NULL,
    created_at          TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
    FOREIGN KEY (requested_by_staff_id) REFERENCES staff(id) ON DELETE SET NULL,
    INDEX idx_pipeline_runs_business (business_id, status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS device_push_tokens (
    id              CHAR(36)     NOT NULL,
    user_id         CHAR(36)     NOT NULL,
    expo_push_token VARCHAR(255) NOT NULL,
    platform        VARCHAR(30),
    device_name     VARCHAR(255),
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    last_seen_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_device_push_token (expo_push_token),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_device_push_tokens_user (user_id, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
