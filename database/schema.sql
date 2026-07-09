-- =============================================================
-- Q ME NOW — Complete MySQL Database Schema
-- Version: 1.0  |  Date: 2026-04-30
-- Auth: Supabase Auth (login/signup only)
-- Data: All application data stored in MySQL
-- =============================================================

CREATE DATABASE IF NOT EXISTS qme_now
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE qme_now;

SET FOREIGN_KEY_CHECKS = 0;

-- =============================================================
-- SECTION 1: SUBSCRIPTION TIERS
-- =============================================================

CREATE TABLE IF NOT EXISTS subscription_tiers (
    id                          CHAR(36)     NOT NULL,
    name                        VARCHAR(50)  NOT NULL UNIQUE,
    label                       VARCHAR(100) NOT NULL,
    description                 TEXT,
    can_view_analytics          BOOLEAN      NOT NULL DEFAULT FALSE,
    can_view_predictions        BOOLEAN      NOT NULL DEFAULT FALSE,
    can_view_multi_branch       BOOLEAN      NOT NULL DEFAULT FALSE,
    can_view_executive_reports  BOOLEAN      NOT NULL DEFAULT FALSE,
    max_branches                INT          NOT NULL DEFAULT 1,
    max_staff                   INT          NOT NULL DEFAULT 5,
    created_at                  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- =============================================================
-- SECTION 2: BUSINESSES (ORGANIZATIONS)
-- =============================================================

CREATE TABLE IF NOT EXISTS businesses (
    id                   CHAR(36)     NOT NULL,
    name                 VARCHAR(255) NOT NULL,
    slug                 VARCHAR(255) NOT NULL UNIQUE,
    description          TEXT,
    logo_url             VARCHAR(512),
    website_url          VARCHAR(512),
    phone                VARCHAR(50),
    email                VARCHAR(255),
    subscription_tier_id CHAR(36)     NOT NULL,
    is_active            BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at           TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (subscription_tier_id) REFERENCES subscription_tiers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- =============================================================
-- SECTION 3: BRANCHES
-- =============================================================

CREATE TABLE IF NOT EXISTS branches (
    id              CHAR(36)     NOT NULL,
    business_id     CHAR(36)     NOT NULL,
    name            VARCHAR(255) NOT NULL,
    address         TEXT,
    city            VARCHAR(100),
    parish          VARCHAR(100),
    phone           VARCHAR(50),
    latitude        DECIMAL(9,6),
    longitude       DECIMAL(9,6),
    opening_time    TIME,                   -- daily open time, e.g. 08:30
    closing_time    TIME,                   -- daily close time, e.g. 16:30
    open_days       VARCHAR(20),            -- CSV of weekday numbers open, 0=Sun..6=Sat (e.g. '1,2,3,4,5')
    is_main_branch  BOOLEAN      NOT NULL DEFAULT FALSE,
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- =============================================================
-- SECTION 4: SERVICES
-- =============================================================

CREATE TABLE IF NOT EXISTS services (
    id                    CHAR(36)     NOT NULL,
    business_id           CHAR(36)     NOT NULL,
    name                  VARCHAR(255) NOT NULL,
    description           TEXT,
    ticket_prefix         VARCHAR(10),
    base_avg_time_minutes INT          NOT NULL DEFAULT 15,
    is_active             BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at            TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- =============================================================
-- SECTION 5: COUNTERS
-- =============================================================

CREATE TABLE IF NOT EXISTS counters (
    id              CHAR(36)  NOT NULL,
    branch_id       CHAR(36)  NOT NULL,
    service_id      CHAR(36),
    counter_number  INT       NOT NULL,
    label           VARCHAR(100),
    is_active       BOOLEAN   NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL,
    UNIQUE KEY uk_branch_counter (branch_id, counter_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- =============================================================
-- SECTION 6: USERS (CLIENTS / END USERS)
-- supabase_uid links this record to the Supabase Auth user.
-- Populated automatically when a user registers via Supabase Auth.
-- =============================================================

CREATE TABLE IF NOT EXISTS users (
    id              CHAR(36)     NOT NULL,
    supabase_uid    VARCHAR(255) UNIQUE,     -- Supabase Auth user.id
    email           VARCHAR(255) NOT NULL UNIQUE,
    full_name       VARCHAR(255) NOT NULL,
    phone           VARCHAR(50),
    national_id     VARCHAR(100),
    trn             VARCHAR(20),
    is_premium      BOOLEAN      NOT NULL DEFAULT FALSE,
    stripe_customer_id VARCHAR(255),
    date_of_birth   DATE,
    created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- =============================================================
-- SECTION 7: ROLES
-- =============================================================

CREATE TABLE IF NOT EXISTS roles (
    id          CHAR(36)    NOT NULL,
    name        VARCHAR(50) NOT NULL UNIQUE,
    label       VARCHAR(100),
    description TEXT,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO roles (id, name, label, description) VALUES
('role-staff-001',          'line_staff',     'Line Staff',     'Assigned queue/counter/service operator'),
('role-mgr-001',            'manager',        'Manager',        'Branch manager for staff assignments and branch operations'),
('role-exec-001',           'executive',      'Executive',      'Business-wide executive dashboard and analytics access'),
('role-platform-admin-001', 'platform_admin', 'Platform Admin', 'Internal QMe operator for onboarding and support');


-- =============================================================
-- SECTION 8: STAFF
-- supabase_uid links to the Supabase Auth account used for login.
-- =============================================================

CREATE TABLE IF NOT EXISTS staff (
    id                  CHAR(36)     NOT NULL,
    business_id         CHAR(36)     NOT NULL,
    branch_id           CHAR(36),
    role_id             CHAR(36)     NOT NULL,
    supabase_uid        VARCHAR(255) UNIQUE,
    staff_code          VARCHAR(50)  NOT NULL UNIQUE,
    full_name           VARCHAR(255) NOT NULL,
    email               VARCHAR(255) NOT NULL UNIQUE,
    phone               VARCHAR(50),
    date_of_birth       DATE,
    address             TEXT,
    assigned_service_id CHAR(36),
    availability_status ENUM('active','on_leave','inactive') NOT NULL DEFAULT 'active',
    is_active           BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL,
    FOREIGN KEY (role_id) REFERENCES roles(id),
    FOREIGN KEY (assigned_service_id) REFERENCES services(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- =============================================================
-- SECTION 9: STAFF ASSIGNMENTS
-- =============================================================

CREATE TABLE IF NOT EXISTS staff_assignments (
    id              CHAR(36)  NOT NULL,
    staff_id        CHAR(36)  NOT NULL,
    counter_id      CHAR(36)  NOT NULL,
    assignment_date DATE      NOT NULL,
    shift_start     TIME,
    shift_end       TIME,
    created_by      CHAR(36),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE,
    FOREIGN KEY (counter_id) REFERENCES counters(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES staff(id) ON DELETE SET NULL,
    UNIQUE KEY uk_staff_date (staff_id, assignment_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- =============================================================
-- SECTION 10: INTAKE FORMS
-- =============================================================

CREATE TABLE IF NOT EXISTS intake_forms (
    id          CHAR(36)  NOT NULL,
    service_id  CHAR(36)  NOT NULL,
    user_id     CHAR(36),
    form_data   JSON      NOT NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- =============================================================
-- SECTION 11: QUEUES
-- =============================================================

CREATE TABLE IF NOT EXISTS queues (
    id              CHAR(36)  NOT NULL,
    branch_id       CHAR(36)  NOT NULL,
    service_id      CHAR(36)  NOT NULL,
    queue_date      DATE      NOT NULL,
    max_capacity    INT       NOT NULL DEFAULT 50,
    is_active       BOOLEAN   NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
    UNIQUE KEY uk_queue_day (branch_id, service_id, queue_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- =============================================================
-- SECTION 12: QUEUE TICKETS
-- =============================================================

CREATE TABLE IF NOT EXISTS queue_tickets (
    id                    CHAR(36)  NOT NULL,
    queue_id              CHAR(36)  NOT NULL,
    user_id               CHAR(36),
    intake_form_id        CHAR(36),
    ticket_number         VARCHAR(50) NOT NULL,
    verification_code     VARCHAR(12) NOT NULL,
    position              INT         NOT NULL,
    status                ENUM('waiting','called','in_service','served','left','cancelled','no_show') NOT NULL DEFAULT 'waiting',
    estimated_wait_minutes INT,
    joined_at             TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
    called_at             TIMESTAMP   NULL,
    call_timeout_seconds  INT         NOT NULL DEFAULT 120,
    call_expires_at       TIMESTAMP   NULL,
    started_serving_at    TIMESTAMP   NULL,
    completed_at          TIMESTAMP   NULL,
    served_by_staff_id    CHAR(36),
    served_at_counter_id  CHAR(36),
    PRIMARY KEY (id),
    FOREIGN KEY (queue_id) REFERENCES queues(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (intake_form_id) REFERENCES intake_forms(id) ON DELETE SET NULL,
    FOREIGN KEY (served_by_staff_id) REFERENCES staff(id) ON DELETE SET NULL,
    FOREIGN KEY (served_at_counter_id) REFERENCES counters(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- =============================================================
-- SECTION 13: QUEUE EVENTS (AUDIT LOG)
-- =============================================================

CREATE TABLE IF NOT EXISTS queue_events (
    id                    CHAR(36)    NOT NULL,
    ticket_id             CHAR(36)    NOT NULL,
    previous_status       VARCHAR(50),
    new_status            VARCHAR(50) NOT NULL,
    event_timestamp       TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
    triggered_by_staff_id CHAR(36),
    notes                 TEXT,
    PRIMARY KEY (id),
    FOREIGN KEY (ticket_id) REFERENCES queue_tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (triggered_by_staff_id) REFERENCES staff(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- =============================================================
-- SECTION 14: WAIT-TIME RECORDS (ML INPUT)
-- =============================================================

CREATE TABLE IF NOT EXISTS wait_time_records (
    id                      CHAR(36)      NOT NULL,
    ticket_id               CHAR(36)      NOT NULL,
    business_id             CHAR(36)      NOT NULL,
    branch_id               CHAR(36)      NOT NULL,
    service_id              CHAR(36)      NOT NULL,
    visit_date              DATE          NOT NULL,
    day_of_week             TINYINT       NOT NULL,
    hour_of_day             TINYINT       NOT NULL,
    month_of_year           TINYINT       NOT NULL,
    wait_time_minutes       DECIMAL(10,2),
    service_time_minutes    DECIMAL(10,2),
    status                  VARCHAR(50)   NOT NULL,
    staff_count_at_time     INT,
    queue_length_at_time    INT,
    active_counters_at_time INT,
    created_at              TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (ticket_id) REFERENCES queue_tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- =============================================================
-- SECTION 15: ANALYTICS SUMMARIES
-- =============================================================

CREATE TABLE IF NOT EXISTS analytics_summaries (
    id                       CHAR(36)      NOT NULL,
    business_id              CHAR(36)      NOT NULL,
    branch_id                CHAR(36),
    service_id               CHAR(36),
    summary_date             DATE          NOT NULL,
    total_visitors           INT           NOT NULL DEFAULT 0,
    completed_count          INT           NOT NULL DEFAULT 0,
    cancelled_count          INT           NOT NULL DEFAULT 0,
    no_show_count            INT           NOT NULL DEFAULT 0,
    left_count               INT           NOT NULL DEFAULT 0,
    avg_wait_time_minutes    DECIMAL(10,2) DEFAULT 0,
    avg_service_time_minutes DECIMAL(10,2) DEFAULT 0,
    peak_hour                TINYINT,
    completion_rate          DECIMAL(5,2)  DEFAULT 0,
    created_at               TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    updated_at               TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
    UNIQUE KEY uk_summary (business_id, branch_id, service_id, summary_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- =============================================================
-- SECTION 16: PREDICTIVE RESULTS (JUPYTER OUTPUT)
-- =============================================================

CREATE TABLE IF NOT EXISTS predictive_results (
    id            CHAR(36)     NOT NULL,
    business_id   CHAR(36)     NOT NULL,
    branch_id     CHAR(36),
    service_id    CHAR(36),
    insight_type  VARCHAR(100) NOT NULL,
    insight_data  JSON         NOT NULL,
    model_version VARCHAR(50),
    source_window_start DATETIME,
    source_window_end   DATETIME,
    records_processed   INT          DEFAULT 0,
    stale_after         DATETIME,
    generated_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_prediction_freshness
    ON predictive_results(business_id, insight_type, generated_at, stale_after);

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
    FOREIGN KEY (requested_by_staff_id) REFERENCES staff(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_pipeline_runs_business
    ON pipeline_runs(business_id, status, created_at);


-- =============================================================
-- SECTION 17: SAVED BUSINESSES
-- =============================================================

CREATE TABLE IF NOT EXISTS saved_businesses (
    user_id     CHAR(36)  NOT NULL,
    business_id CHAR(36)  NOT NULL,
    saved_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, business_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- =============================================================
-- SECTION 18: VISIT HISTORY
-- =============================================================

CREATE TABLE IF NOT EXISTS visit_history (
    id                   CHAR(36)     NOT NULL,
    user_id              CHAR(36)     NOT NULL,
    ticket_id            CHAR(36)     NOT NULL,
    business_id          CHAR(36)     NOT NULL,
    branch_id            CHAR(36)     NOT NULL,
    service_id           CHAR(36)     NOT NULL,
    business_name        VARCHAR(255) NOT NULL,
    branch_name          VARCHAR(255) NOT NULL,
    service_name         VARCHAR(255) NOT NULL,
    ticket_number        VARCHAR(50)  NOT NULL,
    visit_date           DATE         NOT NULL,
    wait_time_minutes    INT,
    service_time_minutes INT,
    status               VARCHAR(50)  NOT NULL,
    created_at           TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (ticket_id) REFERENCES queue_tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- =============================================================
-- SECTION 19: NOTIFICATIONS
-- =============================================================

CREATE TABLE IF NOT EXISTS notifications (
    id                CHAR(36)    NOT NULL,
    user_id           CHAR(36)    NOT NULL,
    ticket_id         CHAR(36),
    notification_type VARCHAR(50) NOT NULL,
    channel           VARCHAR(20) NOT NULL DEFAULT 'push',
    message           TEXT        NOT NULL,
    is_read           BOOLEAN     NOT NULL DEFAULT FALSE,
    sent_at           TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (ticket_id) REFERENCES queue_tickets(id) ON DELETE SET NULL
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
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Executive-set operational targets with a chosen horizon.
CREATE TABLE IF NOT EXISTS business_targets (
    business_id            CHAR(36)  NOT NULL,
    target_wait_minutes    INT       NOT NULL DEFAULT 20,
    target_completion_rate INT       NOT NULL DEFAULT 80,
    target_no_show_rate    INT       NOT NULL DEFAULT 10,
    horizon_months         INT       NOT NULL DEFAULT 6,
    target_date            DATE      NULL,
    note                   VARCHAR(255) NULL,
    set_by_staff_id        CHAR(36)  NULL,
    created_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (business_id),
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
    FOREIGN KEY (set_by_staff_id) REFERENCES staff(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- =============================================================
-- PAYMENTS (Stripe · event-sourced immutable ledger — see migration 012)
-- =============================================================

CREATE TABLE IF NOT EXISTS payment_methods (
  id                        CHAR(36)     NOT NULL,
  user_id                   CHAR(36)     NOT NULL,
  stripe_payment_method_id  VARCHAR(255) NOT NULL,
  brand                     VARCHAR(20),
  last4                     VARCHAR(4),
  exp_month                 INT,
  exp_year                  INT,
  is_default                BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at                TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_user_pm (user_id, stripe_payment_method_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS payment_intents (
  id                        CHAR(36)     NOT NULL,
  user_id                   CHAR(36)     NOT NULL,
  idempotency_key           VARCHAR(64)  NOT NULL,
  stripe_payment_intent_id  VARCHAR(255),
  purpose                   VARCHAR(50)  NOT NULL DEFAULT 'premium_subscription',
  amount_cents              INT          NOT NULL,
  currency                  CHAR(3)      NOT NULL DEFAULT 'usd',
  status                    ENUM('initialized','authorized','captured','failed','refunded','canceled')
                                         NOT NULL DEFAULT 'initialized',
  created_at                TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at                TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_idempotency (idempotency_key),
  UNIQUE KEY uk_stripe_pi (stripe_payment_intent_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Append-only ledger (immutability enforced by triggers in migration 012).
CREATE TABLE IF NOT EXISTS payment_events (
  id                 CHAR(36)     NOT NULL,
  payment_intent_id  CHAR(36)     NOT NULL,
  stripe_event_id    VARCHAR(255),
  event_type         VARCHAR(50)  NOT NULL,
  amount_cents       INT,
  payload            JSON,
  occurred_at        TIMESTAMP    NULL,
  recorded_at        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_stripe_event (stripe_event_id),
  KEY idx_pe_intent (payment_intent_id),
  FOREIGN KEY (payment_intent_id) REFERENCES payment_intents(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- =============================================================
-- PERFORMANCE INDEXES
-- =============================================================

CREATE INDEX idx_tickets_queue_status    ON queue_tickets(queue_id, status);
CREATE INDEX idx_tickets_user            ON queue_tickets(user_id);
CREATE INDEX idx_tickets_position        ON queue_tickets(queue_id, position);
CREATE INDEX idx_tickets_call_expiry     ON queue_tickets(queue_id, status, call_expires_at);
CREATE UNIQUE INDEX idx_tickets_verification_code ON queue_tickets(verification_code);
CREATE INDEX idx_wtr_analytics           ON wait_time_records(business_id, visit_date, hour_of_day);
CREATE INDEX idx_wtr_service             ON wait_time_records(service_id, visit_date);
CREATE INDEX idx_summary_date            ON analytics_summaries(business_id, summary_date);
CREATE INDEX idx_prediction_type         ON predictive_results(business_id, insight_type, generated_at);
CREATE INDEX idx_events_ticket           ON queue_events(ticket_id, event_timestamp);
CREATE INDEX idx_visit_history_user      ON visit_history(user_id, visit_date DESC);
CREATE INDEX idx_notifications_unread    ON notifications(user_id, is_read, sent_at);
CREATE INDEX idx_device_push_tokens_user ON device_push_tokens(user_id, is_active);
CREATE INDEX idx_staff_business          ON staff(business_id, is_active);
CREATE INDEX idx_assignments_date        ON staff_assignments(assignment_date, counter_id);
CREATE INDEX idx_branches_business       ON branches(business_id, is_active);
CREATE INDEX idx_services_business       ON services(business_id, is_active);
CREATE INDEX idx_users_supabase_uid      ON users(supabase_uid);
CREATE INDEX idx_staff_supabase_uid      ON staff(supabase_uid);

SET FOREIGN_KEY_CHECKS = 1;
