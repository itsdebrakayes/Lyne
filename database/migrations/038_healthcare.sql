-- 038_healthcare.sql
--
-- What a hospital needs that a tax office did not:
--
--   1. A 'healthcare' sector, so every screen says Patient, Facility,
--      Department and Clinician instead of Customer, Branch, Service, Officer.
--
--   2. Triage questions per department. A patient answers them when joining
--      a line. They NEVER change which line the patient is in or their place
--      in it: a "yes" to a red-flag question adds a "possibly urgent" tag that
--      the person watching the line can see, and the app tells the patient to
--      go to the triage desk now. A clinician decides; the software does not.
--
--   3. Patient flags set by staff ("priority": a patient whose condition
--      means they should be seen sooner; "watch": someone the team wants
--      to notice when they arrive). Frequent-visitor patterns are worked out
--      from visit history at read time and are not stored here.
--
-- Contains no organisation data, so it is safe on production. Idempotent
-- except for the two ADD COLUMNs, which fail harmlessly if re-run.

INSERT IGNORE INTO sector_profiles
  (sector, label, visitor_singular, visitor_plural, location_singular, location_plural,
   service_singular, service_plural, server_singular, server_plural,
   identifier_label, identifier_hint, section_singular, section_plural)
VALUES
('healthcare', 'Hospital / Health System',
 'Patient', 'Patients', 'Facility', 'Facilities', 'Department', 'Departments',
 'Clinician', 'Clinicians', NULL, NULL, 'Unit', 'Units');

CREATE TABLE IF NOT EXISTS service_triage_questions (
    id          CHAR(36)     NOT NULL,
    service_id  CHAR(36)     NOT NULL,
    seq         SMALLINT     NOT NULL DEFAULT 0,
    question    VARCHAR(200) NOT NULL,   -- 'Have you hit your head in the last 24 hours?'
    detail      VARCHAR(400) NULL,       -- extra wording shown under the question
    -- A "yes" to a red-flag question tags the ticket 'possibly_urgent'.
    red_flag    BOOLEAN      NOT NULL DEFAULT TRUE,
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_triage_service FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
    INDEX idx_triage_service (service_id, is_active, seq)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- The answers as given, with the question text copied in, so the record still
-- reads correctly after a question is reworded or removed.
-- visit_reason and guest_dob are what a hospital front desk takes from a
-- walk-in: why they came, and a date of birth to tell two people of the same
-- name apart. Both are optional and erased with the account.
ALTER TABLE queue_tickets
  ADD COLUMN triage_answers JSON NULL AFTER readiness_note,
  ADD COLUMN triage_flag ENUM('none','possibly_urgent') NOT NULL DEFAULT 'none' AFTER triage_answers,
  ADD COLUMN visit_reason VARCHAR(160) NULL AFTER triage_flag,
  ADD COLUMN guest_dob DATE NULL AFTER guest_phone;

CREATE TABLE IF NOT EXISTS patient_flags (
    id                   CHAR(36)     NOT NULL,
    business_id          CHAR(36)     NOT NULL,
    user_id              CHAR(36)     NOT NULL,
    flag                 ENUM('priority','watch') NOT NULL,
    note                 VARCHAR(255) NULL,
    set_by_staff_id      CHAR(36)     NULL,
    created_at           TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    cleared_at           DATETIME     NULL,
    cleared_by_staff_id  CHAR(36)     NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_pflag_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
    CONSTRAINT fk_pflag_user     FOREIGN KEY (user_id)     REFERENCES users(id)      ON DELETE CASCADE,
    CONSTRAINT fk_pflag_set_by   FOREIGN KEY (set_by_staff_id)     REFERENCES staff(id) ON DELETE SET NULL,
    CONSTRAINT fk_pflag_clear_by FOREIGN KEY (cleared_by_staff_id) REFERENCES staff(id) ON DELETE SET NULL,
    INDEX idx_pflag_active (business_id, user_id, cleared_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
