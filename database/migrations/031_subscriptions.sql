-- 031_subscriptions.sql
--
-- Real recurring subscriptions, replacing the one-time PaymentIntent that was
-- labelled `premium_subscription` but charged once, never renewed, and could
-- not be cancelled because there was nothing to cancel.
--
-- $10/month or $100/year, USD. The annual is two months free, which is the
-- reason to offer it — not a rounding artefact.
--
-- The invariant this establishes: ACCESS ALWAYS HAS AN END DATE. A trial sets
-- premium_until to its expiry; a subscription sets it to the paid-through date
-- from Stripe's current_period_end and moves it forward on each successful
-- renewal. lib/premium.js already refuses to treat a lapsed date as access, so
-- a failed payment or a cancellation expires on its own without a sweep job.
--
-- Rows that predate this keep premium_until NULL and stay premium. They were
-- granted access under the old behaviour, and silently taking it back would be
-- worse than the bug — the same call migration 014 made.

SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'stripe_subscription_id');
SET @sql := IF(@col = 0,
  'ALTER TABLE users ADD COLUMN stripe_subscription_id VARCHAR(255) NULL',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'subscription_plan');
SET @sql := IF(@col = 0,
  "ALTER TABLE users ADD COLUMN subscription_plan ENUM('monthly','yearly') NULL",
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- Stripe's own vocabulary, stored verbatim rather than mapped to ours. A
-- narrower ENUM would need a migration every time Stripe adds a state, and the
-- one that matters most (past_due — paid before, payment failing now) is
-- exactly the kind of value a lossy mapping loses.
SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'subscription_status');
SET @sql := IF(@col = 0,
  'ALTER TABLE users ADD COLUMN subscription_status VARCHAR(32) NULL',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- Cancelling stops the NEXT charge; it does not confiscate the period already
-- paid for. That is the honest behaviour and it is also what the app must show:
-- "active until 14 March", not "cancelled".
SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'cancel_at_period_end');
SET @sql := IF(@col = 0,
  'ALTER TABLE users ADD COLUMN cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- Which upcoming invoice the customer has already been warned about. Stripe can
-- deliver invoice.upcoming more than once, and a duplicate "we are about to
-- charge you" is the opposite of the reassurance it is meant to be.
SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'renewal_notice_sent_for');
SET @sql := IF(@col = 0,
  'ALTER TABLE users ADD COLUMN renewal_notice_sent_for DATETIME NULL',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @idx := (SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'idx_users_stripe_subscription');
SET @sql := IF(@idx = 0,
  'CREATE INDEX idx_users_stripe_subscription ON users (stripe_subscription_id)',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
