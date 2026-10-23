-- =============================================================
-- 043 — Sections of a branch, and the supervisor who runs one
--
-- A supervisor is not a second branch manager. A bank branch has a teller
-- supervisor and a personal-banking supervisor; a tax office has a supervisor
-- per section of the floor. Until now a supervisor saw the whole branch, the
-- same as the manager above them, which is exactly the separation the role is
-- supposed to provide.
--
-- A section is a named part of one branch, defined by the services it covers
-- ("Teller Services": deposits and withdrawals, cards). A supervisor belongs to
-- at most one. With a section they see that section's lines, staff, counters,
-- clients and patterns; without one they keep seeing the whole branch, so every
-- existing supervisor behaves exactly as before until a section is assigned.
--
-- Additive only; contains no organisation data; safe on production.
-- =============================================================

CREATE TABLE IF NOT EXISTS branch_sections (
    id          CHAR(36)     NOT NULL,
    branch_id   CHAR(36)     NOT NULL,
    name        VARCHAR(80)  NOT NULL,
    created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_branch_section_name (branch_id, name),
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Which services make up a section. A service sits in at most one section of a
-- branch in practice; the key does not forbid two, so a shared desk can belong
-- to both supervisors if a branch genuinely runs it that way.
CREATE TABLE IF NOT EXISTS branch_section_services (
    section_id  CHAR(36)     NOT NULL,
    service_id  CHAR(36)     NOT NULL,
    PRIMARY KEY (section_id, service_id),
    FOREIGN KEY (section_id) REFERENCES branch_sections(id) ON DELETE CASCADE,
    FOREIGN KEY (service_id) REFERENCES services(id)        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE staff
  ADD COLUMN section_id CHAR(36) NULL AFTER branch_id,
  ADD CONSTRAINT fk_staff_section FOREIGN KEY (section_id) REFERENCES branch_sections(id) ON DELETE SET NULL;
