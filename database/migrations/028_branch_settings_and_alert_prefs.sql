-- =============================================================
-- 028 — Branch settings + per-staff alert preferences
--
-- The manager Settings tab shipped as pure React state: three toggles backed by
-- useState and two dropdowns wired to `onChange={() => undefined}`. A manager
-- could switch a control, watch it move, and change nothing — and a control that
-- silently lies is worse than one that is visibly disabled.
--
-- Only the settings with real behaviour behind them get storage here.
-- Deliberately NOT stored:
--   • "Text Customers When Called" — there is no SMS integration. The only
--     mention of SMS in the backend is a comment saying "later".
--   • "Lobby Kiosk Prints Tickets" — there is no printer integration; the kiosk
--     comment says the clerk writes the number on a slip.
-- Those two stay disabled in the UI with the reason shown, rather than being
-- given a database row that nothing reads. Add storage when the feature lands.
-- =============================================================

-- ── Branch-level operating policy ────────────────────────────
-- One row per branch, created on first save. Absent row = defaults.
CREATE TABLE IF NOT EXISTS branch_settings (
  branch_id       CHAR(36)     NOT NULL,
  -- When a line is long, may a free clerk call from it even if it is not their
  -- usual service? Enforced in assertLineStaffQueueAccess() — this is a real
  -- access-control relaxation, not a display preference.
  allow_overflow  TINYINT(1)   NOT NULL DEFAULT 0,
  updated_by      CHAR(36)     NULL,
  updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (branch_id),
  CONSTRAINT fk_branch_settings_branch
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
  CONSTRAINT fk_branch_settings_staff
    FOREIGN KEY (updated_by) REFERENCES staff(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Per-staff alert preferences ──────────────────────────────
-- The card is titled "Alerts To Me", so these are per person, not per branch:
-- two managers at one branch may reasonably want different thresholds.
CREATE TABLE IF NOT EXISTS staff_alert_prefs (
  staff_id            CHAR(36)  NOT NULL,
  -- Minutes a counter may sit idle with people waiting before it is worth
  -- telling this person about. NULL = never raise idle alerts.
  idle_after_minutes  INT       NULL     DEFAULT 20,
  -- Whether to raise an alert when a service passes its wait target.
  -- 'hourly' is intentionally NOT an option: there is no batching/digest
  -- infrastructure, and offering it would be another control that does nothing.
  line_over_target    ENUM('on','off') NOT NULL DEFAULT 'on',
  updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (staff_id),
  CONSTRAINT fk_alert_prefs_staff
    FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
