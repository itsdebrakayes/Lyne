-- =============================================================
-- 024 — What kind of organisation is this?
--
-- Every screen in this system calls the person in the line a "customer", the
-- place a "branch", and the person serving them an "officer". That is correct
-- for a tax office and wrong everywhere else: a university has students at a
-- campus office seen by an adviser, a credit union has members at a branch seen
-- by a loan officer, a diagnostic centre has patients at a centre seen by a
-- technologist.
--
-- The wrong noun is not cosmetic. A registrar looking at a dashboard that says
-- "Customers Served" does not see their own operation, and a member of staff
-- asked for a "Tax Registration Number" when they need a student ID will simply
-- stop using the screen.
--
-- So the vocabulary moves into data. One row per sector, inherited by every
-- organisation of that sector, overridable per organisation where a client
-- insists on its own words. Government keeps exactly the words it has today, so
-- nothing currently on screen changes.
-- =============================================================

CREATE TABLE IF NOT EXISTS sector_profiles (
    sector              VARCHAR(40)  NOT NULL,
    label               VARCHAR(80)  NOT NULL,   -- 'University', 'Credit Union'

    -- the person in the line
    visitor_singular    VARCHAR(40)  NOT NULL,   -- Student / Member / Patient
    visitor_plural      VARCHAR(40)  NOT NULL,

    -- where they are seen
    location_singular   VARCHAR(40)  NOT NULL,   -- Campus Office / Branch / Centre
    location_plural     VARCHAR(40)  NOT NULL,

    -- what they queue for
    service_singular    VARCHAR(40)  NOT NULL,   -- Service / Issue / Test
    service_plural      VARCHAR(40)  NOT NULL,

    -- who serves them
    server_singular     VARCHAR(40)  NOT NULL,   -- Adviser / Loan Officer / Technologist
    server_plural       VARCHAR(40)  NOT NULL,

    -- what the counter asks for at the desk. NULL means do not ask for one:
    -- a diagnostic centre must not be prompted for a Tax Registration Number.
    identifier_label    VARCHAR(60)  NULL,       -- Student ID / Member Number / TRN
    identifier_hint     VARCHAR(120) NULL,

    -- the word for a group of counters (TAJ calls these sections)
    section_singular    VARCHAR(40)  NOT NULL DEFAULT 'Section',
    section_plural      VARCHAR(40)  NOT NULL DEFAULT 'Sections',

    PRIMARY KEY (sector)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO sector_profiles
  (sector, label, visitor_singular, visitor_plural, location_singular, location_plural,
   service_singular, service_plural, server_singular, server_plural,
   identifier_label, identifier_hint, section_singular, section_plural)
VALUES
-- Exactly the language the system uses today, so TAJ/PICA/NHT are unchanged.
('government_revenue', 'Government Agency',
 'Customer', 'Customers', 'Branch', 'Branches', 'Service', 'Services', 'Officer', 'Officers',
 'TRN', 'Nine-digit Tax Registration Number', 'Section', 'Sections'),

('university', 'University',
 'Student', 'Students', 'Campus Office', 'Campus Offices', 'Issue', 'Issues', 'Adviser', 'Advisers',
 'Student ID', 'Your student identification number', 'Office', 'Offices'),

('financial_services', 'Credit Union / Microfinance',
 'Member', 'Members', 'Branch', 'Branches', 'Service', 'Services', 'Officer', 'Officers',
 'Member Number', 'The number on your member card', 'Section', 'Sections'),

('diagnostics', 'Diagnostic / Imaging Centre',
 'Patient', 'Patients', 'Centre', 'Centres', 'Service', 'Services', 'Technologist', 'Technologists',
 -- Deliberately NULL. A diagnostic centre's identifier is a clinical/insurance
 -- matter and must be agreed per client, not defaulted by us.
 NULL, NULL, 'Modality', 'Modalities');

ALTER TABLE businesses
  ADD COLUMN sector VARCHAR(40) NOT NULL DEFAULT 'government_revenue' AFTER slug,
  ADD CONSTRAINT fk_businesses_sector
    FOREIGN KEY (sector) REFERENCES sector_profiles(sector);

-- Existing organisations are government agencies. Explicit rather than implied.
UPDATE businesses SET sector = 'government_revenue' WHERE sector IS NULL OR sector = '';
