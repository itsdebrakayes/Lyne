-- 048_sms.sql — text messages: who agreed, who said stop, what was sent.
--
-- A text costs money and goes to a person's own phone, so nobody is texted without
-- saying yes, and "stop" has to work everywhere: the sender is a name, so people
-- cannot reply STOP. sms_opt_outs is by number, which is what covers a walk-in.
--
-- notify_consent_at on queue_tickets (migration 023) is the ticket's yes.
-- sms_log stores a hash of the number, enough for the per-number throttle and no more.
ALTER TABLE users
  ADD COLUMN sms_opt_in        TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN sms_opt_in_at     DATETIME   NULL,
  ADD COLUMN phone_verified_at DATETIME   NULL;

ALTER TABLE queue_tickets
  ADD COLUMN sms_stop_code CHAR(8) NULL,
  ADD UNIQUE KEY uk_sms_stop_code (sms_stop_code);

ALTER TABLE session_registrations
  ADD COLUMN sms_consent_at DATETIME NULL;

ALTER TABLE branch_settings
  ADD COLUMN text_when_called TINYINT(1) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS sms_opt_outs (
  phone          VARCHAR(20) NOT NULL,
  source         VARCHAR(20) NOT NULL,
  opted_out_at   TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (phone)
);

CREATE TABLE IF NOT EXISTS sms_log (
  id           CHAR(36)    NOT NULL,
  phone_hash   CHAR(64)    NOT NULL,
  purpose      VARCHAR(30) NOT NULL,
  status       VARCHAR(20) NOT NULL,
  provider_id  VARCHAR(64) NULL,
  detail       VARCHAR(255) NULL,
  ticket_id    CHAR(36)    NULL,
  user_id      CHAR(36)    NULL,
  created_at   TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_sms_number (phone_hash, created_at),
  KEY idx_sms_day (created_at, status)
);
