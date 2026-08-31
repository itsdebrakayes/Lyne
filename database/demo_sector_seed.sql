-- The connection charset must be declared before any non-ASCII data.
-- Without it, mysql's docker-entrypoint import runs as latin1, so every
-- em-dash and curly quote in this file is read one byte at a time and
-- re-encoded — 'Sitting — Camp Road' lands in a utf8mb4 column as
-- 'Sitting â€" Camp Road'. The columns were never wrong; the pipe was.
SET NAMES utf8mb4;

-- =============================================================
-- LYNE — Sector demo tenants
--
-- Four organisations that exercise the sector vocabulary layer end to end, so
-- the SAME screens can be shown reading "Court Users / Matters / Divisions" to a
-- Court Administrator and "Students / Issues / Campus Offices" to a registrar.
-- Until this file existed, every seeded tenant was government_revenue and the
-- vocabulary work had nothing to prove itself against.
--
--   Traffic Court                 judiciary          — the urgent one
--   UWI Mona                      university
--   UTech Jamaica                 university         — deliberately SEPARATE
--   First Heritage Co-op CU       financial_services — a real, large credit union
--
-- Structure, addresses and service lists are drawn from the organisations' own
-- published material (see research/Sector_Personas_and_Role_Design_2026-07-30.md
-- and the sources noted inline). Staff are invented; no real employee is named.
-- Volumes are modelled.
--
-- Safe to rerun: every row has a deterministic id.
-- =============================================================

USE lyne;
SET FOREIGN_KEY_CHECKS = 0;

-- =============================================================
-- 1 · TRAFFIC COURT  (sector: judiciary)
--
-- Corporate Area Parish Court, Traffic Division. Sittings run at BOTH Camp Road
-- and Melbourne Road, and the backlog is the story: traffic offences are ~70% of
-- all Parish Court cases, against roughly 400,000 outstanding tickets, and the
-- judiciary's answer has been Saturday and night sittings with four judges.
-- That is why this tenant is seeded heavily congested — a traffic court demo
-- showing short, comfortable lines would not be recognised by anyone who has
-- stood in one.
-- =============================================================
INSERT INTO businesses
  (id, name, slug, sector, description, logo_url, subscription_tier_id, is_active)
VALUES
  ('biz-court-001', 'Kingston & St Andrew Parish Court — Traffic Division', 'traffic-court', 'judiciary',
   'Traffic ticket matters for the Corporate Area: payment, plea, disputes and summons enquiries, across the Camp Road and Melbourne Road sittings.',
   NULL, 'tier-exec-001', TRUE)
ON DUPLICATE KEY UPDATE
  name = VALUES(name), sector = VALUES(sector), description = VALUES(description),
  subscription_tier_id = VALUES(subscription_tier_id), is_active = TRUE;

-- A "branch" is a COURT in judiciary wording. Weekday sittings only; the
-- Saturday extension is a scheduled_session further down, not an opening hour,
-- because it is an announced event with its own capacity.
INSERT INTO branches
  (id, business_id, name, address, city, parish, phone, latitude, longitude,
   opening_time, closing_time, open_days, is_main_branch, is_active)
VALUES
  ('br-court-camp', 'biz-court-001', 'Camp Road Traffic Court',
   '36 Camp Road, Kingston 5', 'Kingston', 'Kingston', '876-948-2711',
   18.010500, -76.780200, '09:00:00', '16:00:00', '1,2,3,4,5', TRUE, TRUE),
  ('br-court-melb', 'biz-court-001', 'Melbourne Road Traffic Court',
   'Melbourne Road, Kingston 4', 'Kingston', 'Kingston', '876-948-2712',
   17.986900, -76.798400, '09:00:00', '16:00:00', '1,2,3,4,5', FALSE, TRUE)
ON DUPLICATE KEY UPDATE
  name = VALUES(name), address = VALUES(address), phone = VALUES(phone),
  opening_time = VALUES(opening_time), closing_time = VALUES(closing_time),
  open_days = VALUES(open_days), is_active = TRUE;

-- A "service" is a MATTER. These are the four things a motorist is actually at
-- traffic court to do, plus the two administrative errands that clog the counter.
INSERT INTO services
  (id, business_id, name, description, ticket_prefix, base_avg_time_minutes, is_active)
VALUES
  ('svc-court-pay',   'biz-court-001', 'Ticket Payment',        'Pay a traffic ticket the court has already imposed.', 'PAY', 8,  TRUE),
  ('svc-court-plea',  'biz-court-001', 'Plea & Mitigation',     'Plead guilty to the offence and have the fine imposed.', 'PLE', 12, TRUE),
  ('svc-court-disp',  'biz-court-001', 'Dispute A Ticket',      'Challenge the ticket and be given a trial date.', 'DIS', 20, TRUE),
  ('svc-court-summ',  'biz-court-001', 'Summons Enquiry',       'Check a summons, a court date, or an outstanding matter.', 'SUM', 10, TRUE),
  ('svc-court-warr',  'biz-court-001', 'Warrant / Failure To Appear', 'Deal with a warrant raised after a missed court date.', 'WAR', 25, TRUE),
  ('svc-court-cert',  'biz-court-001', 'Court Order Collection','Collect a court order, receipt or certified document.', 'ORD', 6,  TRUE)
ON DUPLICATE KEY UPDATE
  name = VALUES(name), description = VALUES(description),
  ticket_prefix = VALUES(ticket_prefix), base_avg_time_minutes = VALUES(base_avg_time_minutes),
  is_active = TRUE;

-- Counters are COURTROOMS and cashier windows. Camp Road carries the load.
INSERT INTO counters (id, branch_id, service_id, counter_number, label, is_active) VALUES
  ('ctr-court-camp-1', 'br-court-camp', 'svc-court-pay',  1, 'Cashier 1',            TRUE),
  ('ctr-court-camp-2', 'br-court-camp', 'svc-court-pay',  2, 'Cashier 2',            TRUE),
  ('ctr-court-camp-3', 'br-court-camp', 'svc-court-plea', 3, 'Courtroom 1',          TRUE),
  ('ctr-court-camp-4', 'br-court-camp', 'svc-court-plea', 4, 'Courtroom 2',          TRUE),
  ('ctr-court-camp-5', 'br-court-camp', 'svc-court-disp', 5, 'Courtroom 3',          TRUE),
  ('ctr-court-camp-6', 'br-court-camp', 'svc-court-summ', 6, 'Enquiries Window',     TRUE),
  ('ctr-court-camp-7', 'br-court-camp', 'svc-court-warr', 7, 'Courtroom 4',          TRUE),
  ('ctr-court-camp-8', 'br-court-camp', 'svc-court-cert', 8, 'Records Window',       TRUE),
  ('ctr-court-melb-1', 'br-court-melb', 'svc-court-pay',  1, 'Cashier 1',            TRUE),
  ('ctr-court-melb-2', 'br-court-melb', 'svc-court-plea', 2, 'Courtroom 1',          TRUE),
  ('ctr-court-melb-3', 'br-court-melb', 'svc-court-summ', 3, 'Enquiries Window',     TRUE)
ON DUPLICATE KEY UPDATE
  service_id = VALUES(service_id), label = VALUES(label), is_active = TRUE;

-- The published hierarchy is Court Clerk → Court Supervisor → Court
-- Administrator → Director of Client Services.
INSERT INTO staff
  (id, business_id, branch_id, role_id, staff_code, full_name, email, assigned_service_id, is_active, availability_status)
VALUES
  ('stf-court-clerk-1', 'biz-court-001', 'br-court-camp', 'role-staff-001', 'CRT-0001', 'Sasha-Gay Lawrence', 'sgl@court.demo',    'svc-court-pay',  TRUE, 'active'),
  ('stf-court-clerk-2', 'biz-court-001', 'br-court-camp', 'role-staff-001', 'CRT-0002', 'Omar Beckford',      'ob@court.demo',     'svc-court-plea', TRUE, 'active'),
  ('stf-court-clerk-3', 'biz-court-001', 'br-court-camp', 'role-staff-001', 'CRT-0003', 'Kimone Douglas',     'kd@court.demo',     'svc-court-summ', TRUE, 'active'),
  ('stf-court-clerk-4', 'biz-court-001', 'br-court-camp', 'role-staff-001', 'CRT-0004', 'Devon Sinclair',     'ds@court.demo',     'svc-court-disp', TRUE, 'active'),
  ('stf-court-clerk-5', 'biz-court-001', 'br-court-melb', 'role-staff-001', 'CRT-0005', 'Annmarie Foster',    'af@court.demo',     'svc-court-pay',  TRUE, 'active'),
  ('stf-court-sup-1',   'biz-court-001', 'br-court-camp', 'role-supervisor-001', 'CRT-SUP-1', 'Georgia Palmer',  'gp@court.demo', NULL, TRUE, 'active'),
  ('stf-court-mgr-1',   'biz-court-001', 'br-court-camp', 'role-mgr-001',  'CRT-ADM-1', 'Everton Brissett',   'eb@court.demo',     NULL,             TRUE, 'active'),
  ('stf-court-mgr-2',   'biz-court-001', 'br-court-melb', 'role-mgr-001',  'CRT-ADM-2', 'Marlene Hutchinson', 'mh@court.demo',     NULL,             TRUE, 'active'),
  ('stf-court-exec-1',  'biz-court-001', NULL,            'role-exec-001', 'CRT-DCS-1', 'Carlton Bailey',     'cb@court.demo',     NULL,             TRUE, 'active')
ON DUPLICATE KEY UPDATE
  business_id = VALUES(business_id), branch_id = VALUES(branch_id), role_id = VALUES(role_id),
  full_name = VALUES(full_name), assigned_service_id = VALUES(assigned_service_id), is_active = TRUE;

-- What a motorist must bring. Taken from the judiciary's own public-day notice —
-- and the "amount may differ" line is the one that matters, because somebody who
-- travels with exactly the ticket amount and is fined more has wasted the trip.
INSERT INTO service_readiness (id, service_id, kind, label, detail, is_mandatory, lead_minutes, seq)
VALUES
  ('rdy-court-1', 'svc-court-plea', 'bring',   'Valid driver''s licence or government-issued ID', 'You will not be heard without identification.', TRUE, NULL, 1),
  ('rdy-court-2', 'svc-court-plea', 'bring',   'Documents relevant to your matter', 'The ticket or summons, and anything you intend to rely on.', TRUE, NULL, 2),
  ('rdy-court-3', 'svc-court-plea', 'bring',   'Sufficient funds — the court amount may differ from the ticket', 'The judge may impose more than the printed amount. Cash, debit and credit are accepted.', TRUE, NULL, 3),
  ('rdy-court-4', 'svc-court-plea', 'prepare', 'Arrive 30 minutes early for security screening', 'Everyone entering is screened. Leave time for it.', TRUE, 30, 4),
  ('rdy-court-5', 'svc-court-plea', 'prepare', 'Leave firearms at home', 'The court cannot store them and you will not be admitted with one.', TRUE, NULL, 5),
  ('rdy-court-6', 'svc-court-disp', 'bring',   'Your evidence', 'Photographs, receipts, witness details — whatever supports your challenge.', TRUE, NULL, 1),
  ('rdy-court-7', 'svc-court-disp', 'prepare', 'Expect to be given a trial date, not a decision today', 'A disputed ticket is set down for trial; it is not resolved on the spot.', FALSE, NULL, 2)
ON DUPLICATE KEY UPDATE
  label = VALUES(label), detail = VALUES(detail), is_mandatory = VALUES(is_mandatory),
  lead_minutes = VALUES(lead_minutes), seq = VALUES(seq);


-- =============================================================
-- 2 · UWI MONA  (sector: university)
--
-- Offices, not branches. The Student Administrative Services Section sits on the
-- ground floor of the Annex next to the Bursary Cashiers and is the liaison for
-- student financial and administrative issues; Registry Information Systems is
-- on the 1st floor of the Assembly Hall building.
-- =============================================================
INSERT INTO businesses
  (id, name, slug, sector, description, logo_url, subscription_tier_id, is_active)
VALUES
  ('biz-uwi-001', 'The University of the West Indies, Mona', 'uwi-mona', 'university',
   'Student-facing administrative services at Mona: accounts, registration, financing and records.',
   NULL, 'tier-multi-001', TRUE)
ON DUPLICATE KEY UPDATE
  name = VALUES(name), sector = VALUES(sector), description = VALUES(description),
  subscription_tier_id = VALUES(subscription_tier_id), is_active = TRUE;

INSERT INTO branches
  (id, business_id, name, address, city, parish, phone, latitude, longitude,
   opening_time, closing_time, open_days, is_main_branch, is_active)
VALUES
  ('br-uwi-sass', 'biz-uwi-001', 'Student Administrative Services',
   'Ground Floor, The Annex, Mona Campus', 'Kingston', 'Kingston', '876-927-1660',
   18.005400, -76.746900, '08:30:00', '16:00:00', '1,2,3,4,5', TRUE, TRUE),
  ('br-uwi-registry', 'biz-uwi-001', 'Registry Information Systems',
   '1st Floor, Assembly Hall Building, Mona Campus', 'Kingston', 'Kingston', '876-927-1661',
   18.005900, -76.747600, '08:30:00', '16:00:00', '1,2,3,4,5', FALSE, TRUE),
  ('br-uwi-osf', 'biz-uwi-001', 'Office of Student Financing',
   'Mona Campus', 'Kingston', 'Kingston', '876-927-1662',
   18.006200, -76.748100, '08:30:00', '16:00:00', '1,2,3,4,5', FALSE, TRUE)
ON DUPLICATE KEY UPDATE
  name = VALUES(name), address = VALUES(address), phone = VALUES(phone),
  opening_time = VALUES(opening_time), closing_time = VALUES(closing_time),
  open_days = VALUES(open_days), is_active = TRUE;

-- A "service" is an ISSUE in university wording. These are SASS's own listed
-- functions rather than invented categories.
INSERT INTO services
  (id, business_id, name, description, ticket_prefix, base_avg_time_minutes, is_active)
VALUES
  ('svc-uwi-stmt',  'biz-uwi-001', 'Statement Of Account',   'Get a statement of what you owe or have paid.', 'STM', 8,  TRUE),
  ('svc-uwi-plan',  'biz-uwi-001', 'Payment Plan Request',   'Apply to pay tuition in instalments.', 'PLN', 18, TRUE),
  ('svc-uwi-gate',  'biz-uwi-001', 'GATE Application',       'Government of Jamaica tuition assistance.', 'GTE', 20, TRUE),
  ('svc-uwi-slb',   'biz-uwi-001', 'SLB Grant-In-Aid',       'Students'' Loan Bureau grant-in-aid support.', 'SLB', 20, TRUE),
  ('svc-uwi-reg',   'biz-uwi-001', 'Registration Query',     'Fix a registration problem on your record.', 'REG', 15, TRUE),
  ('svc-uwi-house', 'biz-uwi-001', 'Housing Allocation',     'Hall of residence allocation and charges.', 'HSE', 14, TRUE),
  ('svc-uwi-trans', 'biz-uwi-001', 'Transcript Request',     'Request an official transcript.', 'TRS', 10, TRUE)
ON DUPLICATE KEY UPDATE
  name = VALUES(name), description = VALUES(description),
  ticket_prefix = VALUES(ticket_prefix), base_avg_time_minutes = VALUES(base_avg_time_minutes),
  is_active = TRUE;

INSERT INTO counters (id, branch_id, service_id, counter_number, label, is_active) VALUES
  ('ctr-uwi-sass-1', 'br-uwi-sass', 'svc-uwi-stmt',  1, 'Window 1 - Accounts',   TRUE),
  ('ctr-uwi-sass-2', 'br-uwi-sass', 'svc-uwi-stmt',  2, 'Window 2 - Accounts',   TRUE),
  ('ctr-uwi-sass-3', 'br-uwi-sass', 'svc-uwi-plan',  3, 'Window 3 - Payment Plans', TRUE),
  ('ctr-uwi-sass-4', 'br-uwi-sass', 'svc-uwi-gate',  4, 'Window 4 - GATE',       TRUE),
  ('ctr-uwi-sass-5', 'br-uwi-sass', 'svc-uwi-slb',   5, 'Window 5 - SLB',        TRUE),
  ('ctr-uwi-reg-1',  'br-uwi-registry', 'svc-uwi-reg',   1, 'Desk 1 - Registration', TRUE),
  ('ctr-uwi-reg-2',  'br-uwi-registry', 'svc-uwi-trans', 2, 'Desk 2 - Transcripts',  TRUE),
  ('ctr-uwi-osf-1',  'br-uwi-osf', 'svc-uwi-house', 1, 'Desk 1 - Housing',      TRUE)
ON DUPLICATE KEY UPDATE
  service_id = VALUES(service_id), label = VALUES(label), is_active = TRUE;

INSERT INTO staff
  (id, business_id, branch_id, role_id, staff_code, full_name, email, assigned_service_id, is_active, availability_status)
VALUES
  ('stf-uwi-adv-1', 'biz-uwi-001', 'br-uwi-sass', 'role-staff-001', 'UWI-0001', 'Roxanne Barnett', 'rb@uwi.demo', 'svc-uwi-stmt', TRUE, 'active'),
  ('stf-uwi-adv-2', 'biz-uwi-001', 'br-uwi-sass', 'role-staff-001', 'UWI-0002', 'Jermaine Clarke', 'jc@uwi.demo', 'svc-uwi-plan', TRUE, 'active'),
  ('stf-uwi-adv-3', 'biz-uwi-001', 'br-uwi-sass', 'role-staff-001', 'UWI-0003', 'Petagaye Rowe',   'pr@uwi.demo', 'svc-uwi-gate', TRUE, 'active'),
  ('stf-uwi-adv-4', 'biz-uwi-001', 'br-uwi-registry', 'role-staff-001', 'UWI-0004', 'Andre Bennett', 'ab@uwi.demo', 'svc-uwi-reg', TRUE, 'active'),
  ('stf-uwi-sup-1', 'biz-uwi-001', 'br-uwi-sass', 'role-supervisor-001', 'UWI-SUP-1', 'Nadine Grant', 'ng@uwi.demo', NULL, TRUE, 'active'),
  ('stf-uwi-mgr-1', 'biz-uwi-001', 'br-uwi-sass', 'role-mgr-001', 'UWI-MGR-1', 'Sophia Reid',     'sr@uwi.demo', NULL, TRUE, 'active'),
  ('stf-uwi-mgr-2', 'biz-uwi-001', 'br-uwi-registry', 'role-mgr-001', 'UWI-MGR-2', 'Damion Wright', 'dw@uwi.demo', NULL, TRUE, 'active'),
  ('stf-uwi-exec-1','biz-uwi-001', NULL, 'role-exec-001', 'UWI-EXE-1', 'Dr. Marcia Thompson', 'mt@uwi.demo', NULL, TRUE, 'active')
ON DUPLICATE KEY UPDATE
  business_id = VALUES(business_id), branch_id = VALUES(branch_id), role_id = VALUES(role_id),
  full_name = VALUES(full_name), assigned_service_id = VALUES(assigned_service_id), is_active = TRUE;


-- =============================================================
-- 3 · UTECH JAMAICA  (sector: university)
--
-- A SEPARATE tenant from UWI, deliberately. They are different institutions with
-- different offices, and modelling them as one would misrepresent both — it also
-- gives the demo a genuine two-tenant, same-sector comparison, which is the
-- case multi-branch analytics is weakest at.
-- Papine campus at 237 Old Hope Road, plus the Western Campus in Montego Bay.
-- =============================================================
INSERT INTO businesses
  (id, name, slug, sector, description, logo_url, subscription_tier_id, is_active)
VALUES
  ('biz-utech-001', 'University of Technology, Jamaica', 'utech', 'university',
   'Student services, registry and admissions across the Papine and Western campuses.',
   NULL, 'tier-multi-001', TRUE)
ON DUPLICATE KEY UPDATE
  name = VALUES(name), sector = VALUES(sector), description = VALUES(description),
  subscription_tier_id = VALUES(subscription_tier_id), is_active = TRUE;

INSERT INTO branches
  (id, business_id, name, address, city, parish, phone, latitude, longitude,
   opening_time, closing_time, open_days, is_main_branch, is_active)
VALUES
  ('br-utech-papine', 'biz-utech-001', 'Papine — Student Services & Registry',
   '237 Old Hope Road, Kingston 6', 'Kingston', 'St. Andrew', '876-927-1680',
   18.016800, -76.742900, '08:30:00', '16:30:00', '1,2,3,4,5', TRUE, TRUE),
  ('br-utech-admis', 'biz-utech-001', 'Admissions & Enrolment Management',
   'Papine Campus, 237 Old Hope Road, Kingston 6', 'Kingston', 'St. Andrew', '876-927-1680',
   18.017200, -76.743400, '08:30:00', '16:30:00', '1,2,3,4,5', FALSE, TRUE),
  ('br-utech-west', 'biz-utech-001', 'Western Campus',
   'Montego Bay', 'Montego Bay', 'St. James', '876-971-6000',
   18.470600, -77.913800, '08:30:00', '16:30:00', '1,2,3,4,5', FALSE, TRUE)
ON DUPLICATE KEY UPDATE
  name = VALUES(name), address = VALUES(address), phone = VALUES(phone),
  opening_time = VALUES(opening_time), closing_time = VALUES(closing_time),
  open_days = VALUES(open_days), is_active = TRUE;

INSERT INTO services
  (id, business_id, name, description, ticket_prefix, base_avg_time_minutes, is_active)
VALUES
  ('svc-utech-enrol', 'biz-utech-001', 'Registration & Enrolment', 'Register for the semester or fix an enrolment problem.', 'ENR', 16, TRUE),
  ('svc-utech-adm',   'biz-utech-001', 'Admissions Enquiry',       'Application status, offers and entry requirements.', 'ADM', 14, TRUE),
  ('svc-utech-fee',   'biz-utech-001', 'Fee Payment & Accounts',   'Pay fees or query your student account.', 'FEE', 9,  TRUE),
  ('svc-utech-rec',   'biz-utech-001', 'Academic Records',         'Transcripts, letters and result queries.', 'REC', 12, TRUE),
  ('svc-utech-id',    'biz-utech-001', 'Student ID',               'New or replacement student identification card.', 'SID', 6,  TRUE)
ON DUPLICATE KEY UPDATE
  name = VALUES(name), description = VALUES(description),
  ticket_prefix = VALUES(ticket_prefix), base_avg_time_minutes = VALUES(base_avg_time_minutes),
  is_active = TRUE;

INSERT INTO counters (id, branch_id, service_id, counter_number, label, is_active) VALUES
  ('ctr-utech-pap-1', 'br-utech-papine', 'svc-utech-enrol', 1, 'Window 1 - Enrolment', TRUE),
  ('ctr-utech-pap-2', 'br-utech-papine', 'svc-utech-enrol', 2, 'Window 2 - Enrolment', TRUE),
  ('ctr-utech-pap-3', 'br-utech-papine', 'svc-utech-fee',   3, 'Window 3 - Accounts',  TRUE),
  ('ctr-utech-pap-4', 'br-utech-papine', 'svc-utech-rec',   4, 'Window 4 - Records',   TRUE),
  ('ctr-utech-pap-5', 'br-utech-papine', 'svc-utech-id',    5, 'Window 5 - Student ID',TRUE),
  ('ctr-utech-adm-1', 'br-utech-admis',  'svc-utech-adm',   1, 'Desk 1 - Admissions',  TRUE),
  ('ctr-utech-adm-2', 'br-utech-admis',  'svc-utech-adm',   2, 'Desk 2 - Admissions',  TRUE),
  ('ctr-utech-wst-1', 'br-utech-west',   'svc-utech-enrol', 1, 'Window 1 - Enrolment', TRUE),
  ('ctr-utech-wst-2', 'br-utech-west',   'svc-utech-fee',   2, 'Window 2 - Accounts',  TRUE)
ON DUPLICATE KEY UPDATE
  service_id = VALUES(service_id), label = VALUES(label), is_active = TRUE;

INSERT INTO staff
  (id, business_id, branch_id, role_id, staff_code, full_name, email, assigned_service_id, is_active, availability_status)
VALUES
  ('stf-utech-adv-1', 'biz-utech-001', 'br-utech-papine', 'role-staff-001', 'UTC-0001', 'Kerone Wallace',  'kw@utech.demo', 'svc-utech-enrol', TRUE, 'active'),
  ('stf-utech-adv-2', 'biz-utech-001', 'br-utech-papine', 'role-staff-001', 'UTC-0002', 'Shanice Morgan',  'sm@utech.demo', 'svc-utech-fee',   TRUE, 'active'),
  ('stf-utech-adv-3', 'biz-utech-001', 'br-utech-admis',  'role-staff-001', 'UTC-0003', 'Raheem Blake',    'rbl@utech.demo','svc-utech-adm',   TRUE, 'active'),
  ('stf-utech-adv-4', 'biz-utech-001', 'br-utech-west',   'role-staff-001', 'UTC-0004', 'Tanisha Wright',  'tw@utech.demo', 'svc-utech-enrol', TRUE, 'active'),
  ('stf-utech-sup-1', 'biz-utech-001', 'br-utech-papine', 'role-supervisor-001', 'UTC-SUP-1', 'Delano Peart', 'dp@utech.demo', NULL, TRUE, 'active'),
  ('stf-utech-mgr-1', 'biz-utech-001', 'br-utech-papine', 'role-mgr-001', 'UTC-MGR-1', 'Clayton Service', 'cs@utech.demo', NULL, TRUE, 'active'),
  ('stf-utech-mgr-2', 'biz-utech-001', 'br-utech-west',   'role-mgr-001', 'UTC-MGR-2', 'Yanique Palmer',  'yp@utech.demo', NULL, TRUE, 'active'),
  ('stf-utech-exec-1','biz-utech-001', NULL, 'role-exec-001', 'UTC-EXE-1', 'Dr. Howard Chin', 'hc@utech.demo', NULL, TRUE, 'active')
ON DUPLICATE KEY UPDATE
  business_id = VALUES(business_id), branch_id = VALUES(branch_id), role_id = VALUES(role_id),
  full_name = VALUES(full_name), assigned_service_id = VALUES(assigned_service_id), is_active = TRUE;


-- =============================================================
-- 4 · FIRST HERITAGE CO-OPERATIVE CREDIT UNION  (sector: financial_services)
--
-- The largest open-bond credit union in Jamaica — formed from the 2012 merger of
-- Churches Co-operative and GSB Co-operative, later absorbing St Thomas
-- Co-operative — serving over 200,000 members across eleven locations. Head
-- office at 8-10 Eureka Road, Kingston 5.
--
-- This is a REAL institution, seeded as a prospect demo. It sits alongside the
-- fictional Community First rather than replacing it: Community First carries
-- the readiness-checklist story and the linked demo logins, and removing a
-- working demo to make room for a new one is how you end up with neither.
-- =============================================================
INSERT INTO businesses
  (id, name, slug, sector, description, logo_url, subscription_tier_id, is_active)
VALUES
  ('biz-fhc-001', 'First Heritage Co-operative Credit Union', 'first-heritage', 'financial_services',
   'Member services, loans, savings and insurance across eleven locations island-wide.',
   NULL, 'tier-exec-001', TRUE)
ON DUPLICATE KEY UPDATE
  name = VALUES(name), sector = VALUES(sector), description = VALUES(description),
  subscription_tier_id = VALUES(subscription_tier_id), is_active = TRUE;

INSERT INTO branches
  (id, business_id, name, address, city, parish, phone, latitude, longitude,
   opening_time, closing_time, open_days, is_main_branch, is_active)
VALUES
  ('br-fhc-eureka',  'biz-fhc-001', 'Eureka Road (Head Office)', '8-10 Eureka Road, Kingston 5', 'Kingston', 'Kingston', '876-929-5142', 18.011200, -76.788700, '08:30:00', '16:00:00', '1,2,3,4,5', TRUE, TRUE),
  ('br-fhc-newkgn',  'biz-fhc-001', 'New Kingston',              'New Kingston, Kingston 5',      'Kingston', 'Kingston', '876-929-5143', 18.008800, -76.784100, '08:30:00', '16:00:00', '1,2,3,4,5', FALSE, TRUE),
  ('br-fhc-kgngdns', 'biz-fhc-001', 'Kingston Gardens',          '10 East Avenue, Kingston 4',    'Kingston', 'Kingston', '876-929-5144', 17.985600, -76.792300, '08:30:00', '16:00:00', '1,2,3,4,5', FALSE, TRUE),
  ('br-fhc-portmore','biz-fhc-001', 'Portmore',                  'Lot 57 West Trade Way, Portmore','Portmore','St. Catherine','876-988-4455', 17.951900, -76.879100, '08:30:00', '16:00:00', '1,2,3,4,5', FALSE, TRUE),
  ('br-fhc-spantown','biz-fhc-001', 'Spanish Town',              'Spanish Town',                  'Spanish Town','St. Catherine','876-984-2233', 17.991400, -76.953800, '08:30:00', '16:00:00', '1,2,3,4,5', FALSE, TRUE),
  ('br-fhc-oldharb', 'biz-fhc-001', 'Old Harbour',               'Old Harbour',                   'Old Harbour','St. Catherine','876-983-2211', 17.941200, -77.107600, '08:30:00', '16:00:00', '1,2,3,4,5', FALSE, TRUE),
  ('br-fhc-maypen',  'biz-fhc-001', 'May Pen',                   'May Pen',                       'May Pen',  'Clarendon',   '876-986-2244', 17.965300, -77.245700, '08:30:00', '16:00:00', '1,2,3,4,5', FALSE, TRUE),
  ('br-fhc-mandev',  'biz-fhc-001', 'Mandeville',                'Mandeville',                    'Mandeville','Manchester', '876-962-3355', 18.041900, -77.507400, '08:30:00', '16:00:00', '1,2,3,4,5', FALSE, TRUE),
  ('br-fhc-mobay',   'biz-fhc-001', 'Montego Bay',               'Montego Bay',                   'Montego Bay','St. James',  '876-952-7788', 18.476400, -77.893300, '08:30:00', '16:00:00', '1,2,3,4,5', FALSE, TRUE),
  ('br-fhc-morant',  'biz-fhc-001', 'Morant Bay',                '26 Queen Street, Morant Bay',   'Morant Bay','St. Thomas', '876-982-2266', 17.881900, -76.409200, '08:30:00', '16:00:00', '1,2,3,4,5', FALSE, TRUE)
ON DUPLICATE KEY UPDATE
  name = VALUES(name), address = VALUES(address), phone = VALUES(phone),
  opening_time = VALUES(opening_time), closing_time = VALUES(closing_time),
  open_days = VALUES(open_days), is_active = TRUE;

INSERT INTO services
  (id, business_id, name, description, ticket_prefix, base_avg_time_minutes, is_active)
VALUES
  ('svc-fhc-teller',  'biz-fhc-001', 'Teller Services',        'Deposits, withdrawals and transfers.', 'TEL', 6,  TRUE),
  ('svc-fhc-member',  'biz-fhc-001', 'Membership & Accounts',  'Open an account, update your details, join the credit union.', 'MEM', 18, TRUE),
  ('svc-fhc-loan',    'biz-fhc-001', 'Loan Application',       'Apply for a loan and submit your documents.', 'LON', 35, TRUE),
  ('svc-fhc-support', 'biz-fhc-001', 'Loan & Repayment Support','Repayment arrangements and account queries on an existing loan.', 'SUP', 20, TRUE),
  ('svc-fhc-ins',     'biz-fhc-001', 'Insurance & Pensions',   'Family indemnity, insurance and pension products.', 'INS', 22, TRUE)
ON DUPLICATE KEY UPDATE
  name = VALUES(name), description = VALUES(description),
  ticket_prefix = VALUES(ticket_prefix), base_avg_time_minutes = VALUES(base_avg_time_minutes),
  is_active = TRUE;

-- Counters generated per branch: every branch runs tellers and member services;
-- the three largest also run a dedicated loan desk.
INSERT INTO counters (id, branch_id, service_id, counter_number, label, is_active)
SELECT CONCAT('ctr-', REPLACE(b.id, 'br-', ''), '-', REPLACE(s.id, 'svc-fhc-', '')) ,
       b.id, s.id,
       ROW_NUMBER() OVER (PARTITION BY b.id ORDER BY s.name),
       CONCAT('Window ', ROW_NUMBER() OVER (PARTITION BY b.id ORDER BY s.name), ' - ', s.name),
       TRUE
FROM branches b
JOIN services s ON s.business_id = b.business_id AND s.is_active = TRUE
WHERE b.business_id = 'biz-fhc-001'
  AND (s.id IN ('svc-fhc-teller', 'svc-fhc-member')
       OR (s.id = 'svc-fhc-loan' AND b.id IN ('br-fhc-eureka', 'br-fhc-portmore', 'br-fhc-mobay')))
ON DUPLICATE KEY UPDATE service_id = VALUES(service_id), label = VALUES(label), is_active = TRUE;

INSERT INTO staff
  (id, business_id, branch_id, role_id, staff_code, full_name, email, assigned_service_id, is_active, availability_status)
VALUES
  ('stf-fhc-tel-1', 'biz-fhc-001', 'br-fhc-eureka', 'role-staff-001', 'FHC-0001', 'Camille Henry',   'ch@fhc.demo',  'svc-fhc-teller', TRUE, 'active'),
  ('stf-fhc-tel-2', 'biz-fhc-001', 'br-fhc-eureka', 'role-staff-001', 'FHC-0002', 'Rohan Ellis',     're@fhc.demo',  'svc-fhc-teller', TRUE, 'active'),
  ('stf-fhc-mem-1', 'biz-fhc-001', 'br-fhc-eureka', 'role-staff-001', 'FHC-0003', 'Suzette Powell',  'sp@fhc.demo',  'svc-fhc-member', TRUE, 'active'),
  ('stf-fhc-lon-1', 'biz-fhc-001', 'br-fhc-eureka', 'role-staff-001', 'FHC-0004', 'Michael Dacosta', 'md@fhc.demo',  'svc-fhc-loan',   TRUE, 'active'),
  ('stf-fhc-tel-3', 'biz-fhc-001', 'br-fhc-portmore','role-staff-001','FHC-0005', 'Alicia Grant',    'ag@fhc.demo',  'svc-fhc-teller', TRUE, 'active'),
  ('stf-fhc-tel-4', 'biz-fhc-001', 'br-fhc-mobay',  'role-staff-001', 'FHC-0006', 'Devon Hall',      'dh@fhc.demo',  'svc-fhc-teller', TRUE, 'active'),
  ('stf-fhc-sup-1', 'biz-fhc-001', 'br-fhc-eureka', 'role-supervisor-001', 'FHC-SUP-1', 'Karlene Buchanan', 'kb@fhc.demo', NULL, TRUE, 'active'),
  ('stf-fhc-mgr-1', 'biz-fhc-001', 'br-fhc-eureka', 'role-mgr-001', 'FHC-MGR-1', 'Andrea Wilmot',   'aw@fhc.demo',  NULL, TRUE, 'active'),
  ('stf-fhc-mgr-2', 'biz-fhc-001', 'br-fhc-portmore','role-mgr-001','FHC-MGR-2', 'Oral Simpson',    'os@fhc.demo',  NULL, TRUE, 'active'),
  ('stf-fhc-mgr-3', 'biz-fhc-001', 'br-fhc-mobay',  'role-mgr-001', 'FHC-MGR-3', 'Tricia Lyn',      'tl@fhc.demo',  NULL, TRUE, 'active'),
  ('stf-fhc-exec-1','biz-fhc-001', NULL, 'role-exec-001', 'FHC-EXE-1', 'Neville Ffrench', 'nf@fhc.demo', NULL, TRUE, 'active')
ON DUPLICATE KEY UPDATE
  business_id = VALUES(business_id), branch_id = VALUES(branch_id), role_id = VALUES(role_id),
  full_name = VALUES(full_name), assigned_service_id = VALUES(assigned_service_id), is_active = TRUE;

SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================
-- 5 · TODAY'S LINES
--
-- Volumes are per-sector because the sectors do not feel alike. A traffic court
-- morning and a credit-union morning are different experiences, and seeding them
-- to the same depth would make every demo look like the same product.
--
--   Traffic court   very deep. 70% of Parish Court cases are traffic matters
--                   against a backlog in the hundreds of thousands; anyone who
--                   has stood in that line would not recognise a short one.
--   University      moderate, bursty — the registration-week shape.
--   Credit union    steady branch traffic.
-- =============================================================
SET FOREIGN_KEY_CHECKS = 0;

-- Clear any earlier generated rows for these tenants so re-running does not pile
-- tickets up day after day (the mistake that produced ticket PAY-904).
DELETE t FROM queue_tickets t
  JOIN queues q ON q.id = t.queue_id
  JOIN branches b ON b.id = q.branch_id
 WHERE b.business_id IN ('biz-court-001','biz-uwi-001','biz-utech-001','biz-fhc-001')
   AND t.id LIKE 'tsec-%';

INSERT INTO queues (id, branch_id, service_id, queue_date, max_capacity, is_active)
SELECT CONCAT('q-sec-', REPLACE(b.id, 'br-', ''), '-', SUBSTRING(MD5(s.id), 1, 6)),
       b.id, s.id, CURDATE(),
       CASE WHEN b.business_id = 'biz-court-001' THEN 250 ELSE 60 END,
       TRUE
FROM branches b
JOIN counters c ON c.branch_id = b.id AND c.is_active = TRUE
JOIN services s ON s.id = c.service_id AND s.is_active = TRUE
WHERE b.business_id IN ('biz-court-001','biz-uwi-001','biz-utech-001','biz-fhc-001')
  AND b.is_active = TRUE
GROUP BY b.id, s.id, b.business_id
ON DUPLICATE KEY UPDATE queue_date = VALUES(queue_date), is_active = TRUE;

-- A seat generator: 1..90, enough for the court's depth.
CREATE TEMPORARY TABLE IF NOT EXISTS _seq (n INT PRIMARY KEY);
INSERT IGNORE INTO _seq (n)
SELECT (a.d + b.d * 10) + 1 FROM
  (SELECT 0 d UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4
   UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) a,
  (SELECT 0 d UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4
   UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8) b;

INSERT INTO queue_tickets
  (id, queue_id, user_id, ticket_number, verification_code, position, status,
   estimated_wait_minutes, joined_at, called_at, call_timeout_seconds, call_expires_at,
   started_serving_at, completed_at, channel)
SELECT
  CONCAT('tsec-', SUBSTRING(MD5(CONCAT(q.id, ':', seq.n)), 1, 26)),
  q.id,
  NULL,
  CONCAT(s.ticket_prefix, '-', LPAD(seq.n, 3, '0')),
  LPAD(FLOOR(RAND(CRC32(CONCAT(q.id, seq.n))) * 1000000), 6, '0'),
  seq.n,
  CASE WHEN seq.n = 1 THEN 'in_service' WHEN seq.n = 2 THEN 'called' ELSE 'waiting' END,
  GREATEST(0, ROUND((seq.n - 1) / GREATEST(1, (
    SELECT COUNT(*) FROM counters c2
     WHERE c2.branch_id = q.branch_id AND c2.service_id = q.service_id AND c2.is_active = TRUE
  )) * s.base_avg_time_minutes)),
  -- Arrivals spread back across the morning. The court's are older, because the
  -- court's queue genuinely starts before the doors open.
  DATE_SUB(NOW(), INTERVAL (seq.n * CASE WHEN b.business_id = 'biz-court-001' THEN 4 ELSE 7 END) MINUTE),
  -- called_at. Seat 1 is already in service, so its call is safely in the past.
  -- Seat 2 is the one standing at the desk right now, and the counter screen
  -- runs a no-show countdown off call_expires_at — so it has to have been
  -- called RECENTLY or the timer is born expired. Forty seconds leaves a live
  -- countdown to watch, which is the whole point of showing it in a demo.
  CASE WHEN seq.n = 1 THEN DATE_SUB(NOW(), INTERVAL 5 MINUTE)
       WHEN seq.n = 2 THEN DATE_SUB(NOW(), INTERVAL 40 SECOND)
       ELSE NULL END,
  -- The product's own default (schema: 120s). Seeding status='called' without
  -- these two columns is what left 46 called tickets with an empty "time until
  -- no-show" on the line-staff screen: the timer had nothing to count to.
  120,
  CASE WHEN seq.n = 1 THEN DATE_SUB(NOW(), INTERVAL 3 MINUTE)
       WHEN seq.n = 2 THEN DATE_ADD(NOW(), INTERVAL 80 SECOND)
       ELSE NULL END,
  CASE WHEN seq.n = 1 THEN DATE_SUB(NOW(), INTERVAL 4 MINUTE) ELSE NULL END,
  NULL,
  -- Court users overwhelmingly arrive in person; a university cohort is the
  -- opposite. This is what makes the channel-mix card say something different
  -- per sector instead of the same 83/17 everywhere.
  CASE
    WHEN b.business_id = 'biz-court-001' THEN IF(MOD(seq.n, 4) = 0, 'app', 'walk_in')
    WHEN b.business_id IN ('biz-uwi-001','biz-utech-001') THEN IF(MOD(seq.n, 5) = 0, 'walk_in', 'app')
    ELSE IF(MOD(seq.n, 3) = 0, 'walk_in', 'app')
  END
FROM queues q
JOIN branches b ON b.id = q.branch_id
JOIN businesses bz ON bz.id = b.business_id
JOIN services s ON s.id = q.service_id
JOIN _seq seq
WHERE q.queue_date = CURDATE()
  AND b.business_id IN ('biz-court-001','biz-uwi-001','biz-utech-001','biz-fhc-001')
  -- Only where the doors are actually open right now.
  --
  -- Without this the seed writes a busy mid-morning line regardless of the
  -- clock, so at 22:13 the Traffic Court showed 320 people queuing six hours
  -- after it shut at 16:00 — and the expiry sweep then correctly cancelled all
  -- of them fifteen minutes later, and the next re-seed put them back. The demo
  -- and the sweep were fighting each other every quarter of an hour.
  --
  -- A demo that contradicts the wall clock is not a demo of a live system. The
  -- tenants that run to 23:59 stay busy at any hour, which is what keeps a late
  -- evening walkthrough worth doing; the ones with real closing times go quiet
  -- when they close, because that is the truth and the product should show it.
  AND CURTIME() BETWEEN COALESCE(b.opening_time, bz.default_opening_time)
                    AND COALESCE(b.closing_time, bz.default_closing_time)
  AND seq.n <= CASE
    -- Camp Road is the flagship congestion story.
    WHEN b.id = 'br-court-camp' THEN 34 + MOD(CRC32(q.id), 22)
    WHEN b.business_id = 'biz-court-001' THEN 18 + MOD(CRC32(q.id), 10)
    WHEN b.business_id IN ('biz-uwi-001','biz-utech-001') THEN 6 + MOD(CRC32(q.id), 11)
    ELSE 3 + MOD(CRC32(q.id), 8)
  END
-- Re-seeding has to restore the WHOLE lifecycle, not just the status.
--
-- This clause used to be `status, position` only, and that is a data-corruption
-- bug rather than an omission. The ticket ids are stable per (queue, seat), so
-- every re-seed lands on the same rows — including rows the expiry sweep has
-- since closed, which by then carry completed_at and a closed_reason. Setting
-- status back to 'waiting' while leaving that residue in place produced 460
-- tickets that were simultaneously waiting and completed three days earlier:
-- a negative wait in every average that touched them, and, on the counter
-- screen, a called customer showing the previous occupant's timings. That is
-- the "stale prior information" the line staff kept seeing.
--
-- Every column the lifecycle writes is now reset together, and closed_reason
-- is cleared explicitly because a revived ticket was never closed.
ON DUPLICATE KEY UPDATE
  status                = VALUES(status),
  position              = VALUES(position),
  joined_at             = VALUES(joined_at),
  called_at             = VALUES(called_at),
  call_timeout_seconds  = VALUES(call_timeout_seconds),
  call_expires_at       = VALUES(call_expires_at),
  started_serving_at    = VALUES(started_serving_at),
  completed_at          = VALUES(completed_at),
  closed_reason         = NULL;

DROP TEMPORARY TABLE IF EXISTS _seq;

-- Somebody on each desk, so "Serving" means something on these tenants too.
INSERT INTO staff_assignments (id, staff_id, counter_id, assignment_date, shift_start, shift_end)
SELECT CONCAT('asgn-sec-', SUBSTRING(MD5(CONCAT(st.id, CURDATE())), 1, 24)),
       st.id, MIN(c.id), CURDATE(), '08:30:00', '16:00:00'
FROM staff st
JOIN counters c ON c.branch_id = st.branch_id AND c.service_id = st.assigned_service_id AND c.is_active = TRUE
WHERE st.business_id IN ('biz-court-001','biz-uwi-001','biz-utech-001','biz-fhc-001')
  AND st.assigned_service_id IS NOT NULL
GROUP BY st.id
ON DUPLICATE KEY UPDATE counter_id = VALUES(counter_id);


-- =============================================================
-- 6 · THE SATURDAY SITTING  (scheduled_sessions, first real use)
--
-- The judiciary's answer to the backlog is Saturday and night sittings — four
-- judges sitting at the Corporate Area Traffic Court. That is NOT an opening
-- hour: it is an announced, capacity-capped event people are told to come to,
-- which is exactly the case migration 027 was written for.
-- =============================================================
INSERT INTO scheduled_sessions
  (id, business_id, branch_id, service_id, name, description,
   venue_name, venue_address, session_date, starts_at, ends_at,
   capacity, requires_eligibility, second_factor,
   registration_opens_at, registration_closes_at,
   arrive_minutes_before, status)
VALUES
  ('ses-court-sat',
   'biz-court-001', 'br-court-camp',
   -- Checking in has to put the person in an actual LINE, and a session with no
   -- service has none to resolve (routes/sessions.js resolveQueue). A public day
   -- is "plead and pay", so it feeds the Ticket Payment line.
   'svc-court-pay',
   'Saturday Traffic Ticket Sitting — Camp Road',
   'Extra Saturday sitting to clear outstanding traffic tickets. Four judges sitting. Bring your ticket or summons, valid ID, and enough to pay — the court amount may differ from the printed amount.',
   NULL, NULL,
   -- The next Saturday from today, whenever the demo is run.
   DATE_ADD(CURDATE(), INTERVAL ((7 - WEEKDAY(CURDATE()) + 5) % 7) DAY),
   '09:00:00', '16:00:00',
   400,
   -- The gate is ON with a surname second factor, but NO cause list is seeded —
   -- which is the honest default and the interesting demo. It exercises the
   -- degrade path: everybody is admitted and every registration shows as
   -- unverified on the clerk's board, exactly as it would on a morning the
   -- court's file did not arrive. Import a list to watch them turn verified.
   1, 'surname',
   DATE_SUB(NOW(), INTERVAL 5 DAY),
   DATE_ADD(NOW(), INTERVAL 1 DAY),
   30,
   'open')
ON DUPLICATE KEY UPDATE
  name = VALUES(name), description = VALUES(description),
  service_id = VALUES(service_id),
  requires_eligibility = VALUES(requires_eligibility),
  second_factor = VALUES(second_factor),
  session_date = VALUES(session_date), capacity = VALUES(capacity),
  registration_opens_at = VALUES(registration_opens_at),
  registration_closes_at = VALUES(registration_closes_at),
  arrive_minutes_before = VALUES(arrive_minutes_before),
  status = VALUES(status);

-- Registrations against it. Deliberately well short of the 400 cap, so the admin
-- screen has a real "places left" number rather than a full house.
DELETE FROM session_registrations WHERE id LIKE 'reg-court-sat-%';
INSERT INTO session_registrations
  (id, session_id, user_id, guest_name, guest_phone, reference, registration_code, registered_at, status)
SELECT
  CONCAT('reg-court-sat-', LPAD(seq.n, 3, '0')),
  'ses-court-sat',
  NULL,
  ELT(1 + MOD(seq.n, 10),
      'Delroy Wright','Simone Case','Andre Gayle','Nadia Blake','Kemar Wisdom',
      'Tashi Cameron','Oneil Grant','Racquel Dixon','Damion Reid','Suzette Barnes'),
  CONCAT('876-', LPAD(200 + seq.n, 3, '0'), '-', LPAD(1000 + seq.n * 7, 4, '0')),
  -- The motorist's own reference: the ticket number, which is what they hold and
  -- what the court's cause list keys on.
  CONCAT('TKT-', LPAD(40000 + seq.n * 13, 6, '0')),
  LPAD(FLOOR(RAND(seq.n * 977) * 1000000), 6, '0'),
  DATE_SUB(NOW(), INTERVAL MOD(seq.n, 5) DAY),
  'registered'
FROM (SELECT (a.d + b.d * 10) + 1 AS n FROM
        (SELECT 0 d UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4
         UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) a,
        (SELECT 0 d UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4
         UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) b
      ) seq
WHERE seq.n <= 87;

SET FOREIGN_KEY_CHECKS = 1;
