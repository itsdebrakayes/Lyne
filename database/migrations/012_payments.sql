-- =============================================================
-- LYNE — Migration 012: Payments (Stripe, event-sourced ledger)
-- Card data never touches our server; Stripe tokenizes on the client and
-- reports state via webhooks. We record every payment event in an append-only
-- ledger (payment_events) and derive status from it — so retries, out-of-order
-- or duplicate webhooks, and outages can never double-charge or lose state.
--   • idempotency_key (unique) — dedupes charge creation
--   • stripe_event_id (unique) — dedupes webhook delivery (at-least-once)
--   • payment_events is immutable (BEFORE UPDATE/DELETE triggers block changes)
-- =============================================================

USE lyne;

SET @db_name = DATABASE();

-- users.stripe_customer_id (maps a user to their Stripe customer)
SET @sql = (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE users ADD COLUMN stripe_customer_id VARCHAR(255) NULL AFTER is_premium',
    'SELECT 1')
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'users' AND COLUMN_NAME = 'stripe_customer_id'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Saved cards (metadata only — never the PAN). last4/brand/exp for display.
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

-- One row per payment attempt. `status` is a cached projection of the event
-- timeline (forward-only), never the source of truth.
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

-- Immutable, append-only ledger. Internal events (payment_initialized) have a
-- NULL stripe_event_id; webhook events carry the real id for dedupe.
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

-- Enforce append-only: block any UPDATE or DELETE on the ledger.
DROP TRIGGER IF EXISTS trg_payment_events_no_update;
DROP TRIGGER IF EXISTS trg_payment_events_no_delete;
CREATE TRIGGER trg_payment_events_no_update BEFORE UPDATE ON payment_events
  FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'payment_events is append-only';
CREATE TRIGGER trg_payment_events_no_delete BEFORE DELETE ON payment_events
  FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'payment_events is append-only';
