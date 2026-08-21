-- =============================================================
-- LYNE — Migration 003: Session Management & Token Security
-- Version: 3.0  |  Date: 2026-06-01
-- =============================================================
-- Adds:
--   1. user_sessions   — tracks active login sessions, enforces per-user limit
--   2. token_revocations — JWT revocation list (for explicit logout)
--   3. analytics_summaries population trigger helper view
-- =============================================================

-- =============================================================
-- SECTION 24: USER SESSIONS
-- One row per active browser/device session.
-- Max 5 concurrent sessions per user enforced in middleware.
-- =============================================================
CREATE TABLE IF NOT EXISTS user_sessions (
    id              VARCHAR(36)  NOT NULL PRIMARY KEY,
    user_id         CHAR(36)     NULL,                       -- users.id (nullable for staff)
    staff_id        CHAR(36)     NULL,                       -- staff.id (nullable for users)
    session_type    ENUM('user','staff') NOT NULL DEFAULT 'user',
    supabase_uid    VARCHAR(255) NOT NULL,                   -- Supabase Auth user.id
    jti             VARCHAR(255) NULL UNIQUE,                -- JWT ID claim (for revocation lookup)
    ip_address      VARCHAR(45)  NULL,
    user_agent      TEXT         NULL,
    device_hint     VARCHAR(100) NULL,                       -- e.g. "iPhone 14 / Safari"
    last_seen_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    expires_at      TIMESTAMP    NOT NULL,
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_sessions_user_id     (user_id),
    INDEX idx_sessions_staff_id    (staff_id),
    INDEX idx_sessions_supabase    (supabase_uid),
    INDEX idx_sessions_expires     (expires_at),
    INDEX idx_sessions_jti         (jti),

    CONSTRAINT fk_session_user  FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE CASCADE,
    CONSTRAINT fk_session_staff FOREIGN KEY (staff_id) REFERENCES staff(id)  ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =============================================================
-- SECTION 25: TOKEN REVOCATIONS
-- Records explicitly revoked JWTs (logout, forced sign-out, role change).
-- The middleware checks this table before trusting a valid JWT signature.
-- TTL: rows are safe to purge after their listed expires_at has passed.
-- =============================================================
CREATE TABLE IF NOT EXISTS token_revocations (
    id           VARCHAR(36)  NOT NULL PRIMARY KEY,
    supabase_uid VARCHAR(255) NOT NULL,
    jti          VARCHAR(255) NULL,                          -- JWT ID if present; NULL = revoke ALL for uid
    reason       ENUM('logout','forced_signout','role_change','security') NOT NULL DEFAULT 'logout',
    revoked_by   VARCHAR(36)  NULL,                         -- staff.id who forced the revocation
    expires_at   TIMESTAMP    NOT NULL,                     -- when the JWT would have expired anyway
    created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_revoke_uid     (supabase_uid),
    INDEX idx_revoke_jti     (jti),
    INDEX idx_revoke_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =============================================================
-- CLEANUP EVENT: purge expired sessions and revocations nightly
-- Requires MySQL event scheduler: SET GLOBAL event_scheduler = ON;
-- =============================================================
DROP EVENT IF EXISTS purge_expired_sessions;
DELIMITER $$
CREATE EVENT purge_expired_sessions
    ON SCHEDULE EVERY 1 DAY
    STARTS (TIMESTAMP(CURDATE()) + INTERVAL 3 HOUR)
    DO BEGIN
        DELETE FROM user_sessions     WHERE expires_at    < NOW();
        DELETE FROM token_revocations WHERE expires_at    < NOW();
    END$$
DELIMITER ;
