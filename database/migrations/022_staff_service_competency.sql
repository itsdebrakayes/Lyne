-- =============================================================
-- 022 — What each officer is trained to do
--
-- There was no competency concept in this system at all. staff.assigned_service_id
-- is a single column recording where somebody is sitting today — that is a desk
-- assignment, not a qualification, and it cannot express "Marcia can work TRN and
-- GCT but has never been trained on Property Tax".
--
-- Without this the supervisor's board will happily put anyone on any counter,
-- and the staffing recommendation can only say "move someone" — never "move
-- someone who can actually do the work". For a tax authority, where an officer
-- handling the wrong transaction type is a compliance question and not just a
-- slow queue, that distinction is the whole point.
--
-- Deliberately modest: this records what an organisation asserts about its own
-- people. It does not verify a certificate against an external register, and
-- nothing here should be described as verifying a qualification.
-- =============================================================

CREATE TABLE IF NOT EXISTS staff_services (
    staff_id      CHAR(36)    NOT NULL,
    service_id    CHAR(36)    NOT NULL,

    -- 'primary'   — their main line of work, counts first for recommendations
    -- 'secondary' — trained and safe to place, typically slower
    -- 'shadowing' — learning; may be placed only alongside someone competent
    proficiency   ENUM('primary','secondary','shadowing') NOT NULL DEFAULT 'secondary',

    -- Who signed it off and when. An assertion by the organisation, with a name
    -- against it, so "trained" is auditable rather than folklore.
    certified_on  DATE        NULL,
    certified_by  CHAR(36)    NULL,
    note          VARCHAR(255) NULL,

    created_at    TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP   DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (staff_id, service_id),
    FOREIGN KEY (staff_id)     REFERENCES staff(id)    ON DELETE CASCADE,
    FOREIGN KEY (service_id)   REFERENCES services(id) ON DELETE CASCADE,
    FOREIGN KEY (certified_by) REFERENCES staff(id)    ON DELETE SET NULL,

    -- "who can cover this service right now" is the hot path on the section board
    INDEX idx_staff_services_service (service_id, proficiency)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Everyone is, at minimum, competent at the service they are already assigned to.
-- This is a floor, not a survey: it makes the feature true on day one for an
-- existing deployment without inventing skills nobody claimed.
INSERT IGNORE INTO staff_services (staff_id, service_id, proficiency, note)
SELECT s.id, s.assigned_service_id, 'primary',
       'Derived from the officer''s standing assignment when competencies were introduced.'
FROM staff s
WHERE s.assigned_service_id IS NOT NULL
  AND s.is_active = TRUE;
