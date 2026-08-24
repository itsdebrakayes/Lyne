-- 030_prediction_kill_switch.sql
--
-- Three independent switches for the prediction / "JamAI" layer, resolved
-- most-restrictive-wins: a prediction is shown only when the platform, the
-- business AND the user all allow it.
--
-- Three tiers rather than one because each answers a different question that
-- actually gets asked:
--
--   platform  — the model is producing garbage; stop serving it to everyone,
--               right now, without a deploy. This is incident response, so it
--               lives in the database and not in an environment variable: an
--               env var needs a restart, and a restart is the one thing you do
--               not want to be doing mid-incident.
--   business  — a tenant that does not want predicted waits shown to its
--               customers. Agencies ask for this in procurement, and the answer
--               has to be a toggle, not a code change.
--   user      — a single customer opting out, and the boundary the premium
--               entitlement already needs.
--
-- Defaults are ON everywhere, so this migration changes no behaviour on its own.

-- ── Platform tier ─────────────────────────────────────────────────────────
-- A general key/value store rather than a one-column table, because the next
-- switch of this kind should not need another migration.
CREATE TABLE IF NOT EXISTS platform_settings (
  setting_key   VARCHAR(64)  NOT NULL,
  setting_value VARCHAR(255) NOT NULL,
  description   VARCHAR(500) NULL,
  updated_by    VARCHAR(64)  NULL,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO platform_settings (setting_key, setting_value, description)
VALUES (
  'predictions_enabled',
  'true',
  'Master switch for the prediction layer. Set to false to stop serving predicted waits and insights platform-wide without a deploy.'
)
ON DUPLICATE KEY UPDATE setting_key = setting_key;

-- ── Business tier ─────────────────────────────────────────────────────────
SET @col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'businesses' AND COLUMN_NAME = 'predictions_enabled'
);
SET @sql := IF(@col = 0,
  'ALTER TABLE businesses ADD COLUMN predictions_enabled BOOLEAN NOT NULL DEFAULT TRUE',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── User tier ─────────────────────────────────────────────────────────────
SET @col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'predictions_enabled'
);
SET @sql := IF(@col = 0,
  'ALTER TABLE users ADD COLUMN predictions_enabled BOOLEAN NOT NULL DEFAULT TRUE',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
