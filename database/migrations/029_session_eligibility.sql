-- =============================================================
-- 029 — The eligibility gate in front of a session
--
-- 027 built the session: a day you register for in advance, capped, checked in
-- on arrival. It assumed anyone may register. For a court that is not true —
-- only motorists whose matter is actually listed that day may take a place, and
-- the court has no way to tell us who those people are except by handing us the
-- day's list.
--
-- Researched 2026-08-18 (research/IECMS_Incumbency_Check): the ticket-to-court-
-- date mapping lives in the Traffic Ticket Management System run by eGov
-- Jamaica, NOT in IECMS. It already exists, it is already digital, and the court
-- date is printed on the ticket at issuance. So the cause list is a file the
-- court already produces, and this table is where a day's worth of it lands.
--
-- The design decision that matters: eligibility DEGRADES rather than blocks.
-- If no list was loaded for a session, the portal still issues a code and marks
-- the registration unverified, and the clerk's board shows that flag. A court
-- whose IT could not send the file this morning must still be able to run its
-- day — the counter check they do today is the backstop, exactly as now.
-- =============================================================

-- ── The day's list, as supplied by the organisation ───────────
CREATE TABLE IF NOT EXISTS session_cause_list (
    id           CHAR(36)    NOT NULL,
    session_id   CHAR(36)    NOT NULL,

    -- The reference as the court supplied it, kept verbatim for display and for
    -- arguing with when somebody says "that isn't my ticket number".
    reference    VARCHAR(60) NOT NULL,

    -- What we actually match on. People type ticket numbers with spaces, dashes
    -- and lowercase; the court exports them one canonical way. Normalising at
    -- write time means the match is a single indexed equality rather than a
    -- LIKE scan over a few hundred thousand rows.
    reference_key VARCHAR(60) NOT NULL,

    -- Optional second factor. A ticket number alone is guessable, and this
    -- endpoint answers "does this ticket exist" — which makes it an enumeration
    -- oracle unless something else must also match. Compared case-insensitively
    -- on the first characters only, because people spell their own surnames
    -- inconsistently under stress and a court date is not the place to be strict.
    party_surname VARCHAR(120) NULL,

    -- 'Traffic Division', 'Court 3'. Shown on the confirmation so the motorist
    -- walks to the right room. Never used for matching.
    division      VARCHAR(80) NULL,

    imported_at   TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
    imported_by   CHAR(36)    NULL,

    PRIMARY KEY (id),
    FOREIGN KEY (session_id)  REFERENCES scheduled_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (imported_by) REFERENCES staff(id)              ON DELETE SET NULL,

    -- One row per reference per session. Re-importing the same list must be
    -- idempotent: courts resend a corrected file and nobody should end up with
    -- two entitlements to the same place.
    UNIQUE KEY uq_cause_list_ref (session_id, reference_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ── What a session needs in order to run a gate and a queue ───

-- Which line a check-in joins. Normally resolvable from (branch_id, service_id),
-- but a session at a hired venue has branch_id NULL by design (027 refuses to
-- invent a branch row for the National Arena), and then there is nothing to
-- resolve from. Explicit beats inferred.
ALTER TABLE scheduled_sessions
    ADD COLUMN queue_id CHAR(36) NULL AFTER service_id,
    ADD CONSTRAINT fk_sessions_queue FOREIGN KEY (queue_id) REFERENCES queues(id) ON DELETE SET NULL;

-- Does this session check anybody against a list at all? A university's
-- registration-week session does not — every student is entitled to attend. A
-- traffic sitting does. Default off so 027's existing behaviour is unchanged.
ALTER TABLE scheduled_sessions
    ADD COLUMN requires_eligibility TINYINT(1) NOT NULL DEFAULT 0 AFTER capacity;

-- Whether the eligibility check demands a surname alongside the reference.
-- 'none' is honest for a session whose list has no names in it.
ALTER TABLE scheduled_sessions
    ADD COLUMN second_factor ENUM('none','surname') NOT NULL DEFAULT 'none' AFTER requires_eligibility;


-- ── What a registration needs in order to be trusted ──────────

-- TRUE only when this registration matched a loaded cause list. FALSE means
-- self-declared: they typed a reference we could not check. The clerk's board
-- MUST show this, because the two are not the same thing and a system that
-- displays them identically is telling the court something untrue.
ALTER TABLE session_registrations
    ADD COLUMN verified TINYINT(1) NOT NULL DEFAULT 0 AFTER reference;

-- The court holds no contact details for motorists (confirmed 2026-08-18), so
-- both channels are volunteered at the portal by the person themselves. Phone
-- already exists from 027; email is the other one people offer.
ALTER TABLE session_registrations
    ADD COLUMN guest_email VARCHAR(160) NULL AFTER guest_phone;

-- Looking up a registration by the code someone is holding at the door. The
-- unique key from 027 is (session_id, registration_code) — good for enforcing
-- uniqueness, useless when the person at the desk knows only the code and the
-- clerk has three sessions running.
ALTER TABLE session_registrations
    ADD INDEX idx_registrations_code (registration_code);
