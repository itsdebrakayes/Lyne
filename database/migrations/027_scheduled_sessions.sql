-- =============================================================
-- 027 — Sessions you register for in advance
--
-- Everything in this system so far assumes a queue you join when you are ready
-- to be served: doors are open, you take a place, you are called. That is a
-- branch. It is not how a court works.
--
-- Kingston & St Andrew heard more than 43,000 traffic tickets over two days at
-- the National Arena in July 2026. Only motorists who REGISTERED IN ADVANCE
-- during a published window were accommodated, they were told to arrive thirty
-- minutes early for security screening, and the venue was not a courthouse. St
-- Catherine, working through roughly 200,000 outstanding tickets, added three
-- courtrooms outside and sat until 9pm. Demand there is not a daily rhythm; it
-- is a deadline — demerit points begin 1 October 2026 — discharged through
-- announced events.
--
-- Modelling that as a walk-in queue would be a lie a Court Administrator would
-- see through in the first minute of a demonstration.
--
-- The design decision that matters here: a session is a FRONT DOOR to the queue
-- that already exists, not a second parallel system. Registering reserves a
-- place in advance; CHECKING IN ON THE DAY creates an ordinary queue_ticket and
-- from that moment every existing mechanism — calling, counters, ETA, analytics,
-- the served/no-show record — works untouched. Nothing downstream of check-in
-- needs to know a session was involved.
--
-- This is deliberately not an appointment system. Nobody is given 10:15am. They
-- are given a DAY and a place in the order, which is what the judiciary actually
-- operates and what a capped venue can honestly promise.
-- =============================================================

CREATE TABLE IF NOT EXISTS scheduled_sessions (
    id             CHAR(36)     NOT NULL,
    business_id    CHAR(36)     NOT NULL,

    -- Normally a session runs at one of the organisation's own locations. It is
    -- NULL for a one-off venue: the National Arena is not a branch and must not
    -- be invented as one, or it pollutes every branch-level report afterwards.
    branch_id      CHAR(36)     NULL,

    -- NULL means the session covers everything the organisation does that day —
    -- a public day hears all ticket matters, not one category.
    service_id     CHAR(36)     NULL,

    name           VARCHAR(140) NOT NULL,  -- 'Traffic Ticket Public Day — Kingston & St Andrew'
    description    VARCHAR(400) NULL,

    -- Only used when branch_id is NULL. Kept as plain text rather than a fake
    -- branch row for the reason above.
    venue_name     VARCHAR(160) NULL,
    venue_address  VARCHAR(255) NULL,

    session_date   DATE         NOT NULL,
    starts_at      TIME         NOT NULL,
    ends_at        TIME         NULL,      -- NULL = runs until the list is finished

    -- What the venue can genuinely handle. The whole point of registering in
    -- advance is that this number is real and enforced; a cap nobody enforces is
    -- worse than no cap, because people travel on the strength of it.
    capacity       INT          NOT NULL,

    registration_opens_at  DATETIME NULL,
    registration_closes_at DATETIME NULL,

    -- 'Arrive at least 30 minutes early for security screening.' Distinct from
    -- service_readiness lead times: this is about entering the venue, not about
    -- preparing for the matter itself.
    arrive_minutes_before  INT      NULL,

    -- draft      — being set up, invisible to the public
    -- open       — accepting registrations
    -- closed     — cap reached or window passed; still upcoming
    -- in_progress— the day is running, check-ins are creating tickets
    -- completed  — finished
    -- cancelled  — called off; registrations should be notified
    status ENUM('draft','open','closed','in_progress','completed','cancelled')
           NOT NULL DEFAULT 'draft',

    created_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
    FOREIGN KEY (branch_id)   REFERENCES branches(id)   ON DELETE SET NULL,
    FOREIGN KEY (service_id)  REFERENCES services(id)   ON DELETE SET NULL,

    -- "What is coming up for this organisation" is the one question both the
    -- app and the admin ask constantly.
    INDEX idx_sessions_business_date (business_id, session_date, status),
    INDEX idx_sessions_branch_date   (branch_id, session_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- One person's reserved place in a session.
CREATE TABLE IF NOT EXISTS session_registrations (
    id             CHAR(36)     NOT NULL,
    session_id     CHAR(36)     NOT NULL,

    -- An app user, or NULL when staff registered somebody who does not use the
    -- app. The court cannot exclude people without smartphones from a mandatory
    -- court date, so the walk-in path is not optional here the way it is at a
    -- bank — it is the difference between a lawful process and an unlawful one.
    user_id        CHAR(36)     NULL,
    guest_name     VARCHAR(120) NULL,
    guest_phone    VARCHAR(30)  NULL,

    -- The person's own reference for what they are attending about: the traffic
    -- ticket number, the summons number, the student ID. Free text because every
    -- sector numbers things differently and none of them are ours to validate.
    reference      VARCHAR(60)  NULL,

    -- Confirmation the person shows on arrival. Distinct from the queue ticket
    -- number, which does not exist until check-in.
    registration_code VARCHAR(12) NOT NULL,

    registered_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    checked_in_at  DATETIME     NULL,

    -- The ticket created at check-in. This is the seam: once set, the person is
    -- an ordinary member of an ordinary queue and every existing feature applies.
    queue_ticket_id CHAR(36)    NULL,

    -- registered — holds a place, has not arrived
    -- checked_in — arrived; queue_ticket_id is now set
    -- no_show    — the day passed and they never checked in. THE number the
    --              court cares about, because a no-show is a capped place that
    --              somebody else could have travelled for.
    -- cancelled  — gave the place back before the day
    status ENUM('registered','checked_in','no_show','cancelled')
           NOT NULL DEFAULT 'registered',

    PRIMARY KEY (id),
    FOREIGN KEY (session_id)      REFERENCES scheduled_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)         REFERENCES users(id)              ON DELETE SET NULL,
    FOREIGN KEY (queue_ticket_id) REFERENCES queue_tickets(id)      ON DELETE SET NULL,

    -- The code a person presents must find their registration immediately, and
    -- must be unique within the session so two people cannot present the same one.
    UNIQUE KEY uq_registration_code (session_id, registration_code),

    -- Counting registrations against capacity, and listing arrivals on the day.
    INDEX idx_registrations_session_status (session_id, status),

    -- "What have I got booked?" on the phone.
    INDEX idx_registrations_user (user_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
