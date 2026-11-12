-- 052_lobby_displays.sql — "Now Serving" screens for the waiting room. (12 November 2026)
--
-- A queue system is expected to have a screen in the room: the number being
-- called and the counter to go to, for everyone who is not looking at a phone.
-- Lyne had none. Rather than sell hardware, a lobby display is a web page with
-- its own private link (/display/<token>) that runs on whatever the organisation
-- already has: a smart TV's browser, a streaming stick, an old PC, or an iframe
-- inside its digital-signage software. No sign-in, nothing to install.
--
-- One row per screen. The token IS the access: anyone holding the link sees
-- what the screen shows, which is ticket numbers, counters and how many are
-- waiting. NEVER names or phone numbers, so a leaked link shows no more than
-- someone standing in the room could read. A manager can switch a screen off
-- (revoked_at) and the link stops working at once.
--
-- service_id NULL means every line at the branch; set, the screen shows one
-- line only (a screen above the pharmacy counter, say).
--
-- Additive: a new table and nothing else. Safe to apply before or after the
-- code (the routes answer 404 for an unknown link, 503 if the table is missing).
-- PRODUCTION: backup first, owner's approval.

CREATE TABLE IF NOT EXISTS lobby_displays (
  id                  CHAR(36)     NOT NULL,
  business_id         CHAR(36)     NOT NULL,
  branch_id           CHAR(36)     NOT NULL,
  service_id          CHAR(36)     NULL,
  name                VARCHAR(80)  NOT NULL,
  token               CHAR(43)     NOT NULL,
  created_by_staff_id CHAR(36)     NULL,
  created_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at        TIMESTAMP    NULL,
  revoked_at          TIMESTAMP    NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_lobby_displays_token (token),
  KEY idx_lobby_displays_branch (branch_id, revoked_at),
  CONSTRAINT fk_lobby_displays_business FOREIGN KEY (business_id) REFERENCES businesses (id) ON DELETE CASCADE,
  CONSTRAINT fk_lobby_displays_branch   FOREIGN KEY (branch_id)   REFERENCES branches (id)   ON DELETE CASCADE,
  CONSTRAINT fk_lobby_displays_service  FOREIGN KEY (service_id)  REFERENCES services (id)   ON DELETE SET NULL,
  CONSTRAINT fk_lobby_displays_staff    FOREIGN KEY (created_by_staff_id) REFERENCES staff (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
