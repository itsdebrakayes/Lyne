-- =============================================================
-- 025 — What to have ready before you come
--
-- Step 6 of the customer journey is "QMe Now shows what to have ready", and
-- there is nowhere to put it. services.description is a single sentence of
-- marketing copy ("Apply for a first-time Jamaican passport").
--
-- This is the difference between a queue app and something an organisation
-- actually values. A member who arrives for a business-loan interview without
-- proof of income has occupied an officer, lost their own morning, and must come
-- back — so the branch's real problem is not the length of the line, it is the
-- proportion of the line that cannot be completed. A patient who was never told
-- to fast has the same problem in a worse form.
--
-- Two separate ideas, deliberately not conflated:
--
--   requirement — something to BRING or HAVE   ("Two forms of ID")
--   preparation — something to DO beforehand   ("Do not eat for 10 hours")
--
-- A checklist the person ticks is not proof of anything and must never be
-- described as verification. It is a prompt. Staff still check at the desk.
-- =============================================================

CREATE TABLE IF NOT EXISTS service_readiness (
    id            CHAR(36)     NOT NULL,
    service_id    CHAR(36)     NOT NULL,

    kind          ENUM('bring','prepare') NOT NULL DEFAULT 'bring',
    seq           SMALLINT     NOT NULL DEFAULT 0,

    label         VARCHAR(140) NOT NULL,   -- 'Two forms of valid ID'
    detail        VARCHAR(400) NULL,       -- 'Driver''s licence, passport or voter ID'

    -- Mandatory items are what the desk cannot proceed without. Shown first and
    -- worded as a requirement rather than a suggestion.
    is_mandatory  BOOLEAN      NOT NULL DEFAULT TRUE,

    -- Timed preparation, for the cases where WHEN matters as much as what.
    -- 600 = "stop eating ten hours before your appointment".
    lead_minutes  INT          NULL,

    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
    -- the join screen asks for one service's list, in order
    INDEX idx_readiness_service (service_id, is_active, kind, seq)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Whether a ticket was created having seen the checklist, and whether the desk
-- found the person actually ready. Two different facts, and the gap between them
-- is the number worth reporting: "one visit in five could not be completed."
ALTER TABLE queue_tickets
  ADD COLUMN readiness_shown_at DATETIME NULL AFTER notify_consent_at,
  ADD COLUMN readiness_outcome  ENUM('ready','incomplete','not_checked')
              NOT NULL DEFAULT 'not_checked' AFTER readiness_shown_at,
  ADD COLUMN readiness_note     VARCHAR(255) NULL AFTER readiness_outcome;
