-- The connection charset must be declared before any non-ASCII data.
-- Without it, mysql's docker-entrypoint import runs as latin1, so every
-- em-dash and curly quote in this file is read one byte at a time and
-- re-encoded — 'Sitting — Camp Road' lands in a utf8mb4 column as
-- 'Sitting â€" Camp Road'. The columns were never wrong; the pipe was.
SET NAMES utf8mb4;

-- =============================================================
-- LYNE — Demo Branch Active Data Refresh
-- Creates a living demo sandbox for TAJ, Passport Office/PICA, and NHT.
-- Safe to rerun on the demo branch to refresh today's queues/tickets.
--
-- PICA and NHT stay. They were briefly cut on 2026-08-17 as "not named targets"
-- after the sector pivot; that was wrong. Both are public-procurement prospects
-- precisely BECAUSE neither runs a queue system today — which is the opposite of
-- the TAJ situation, where an incumbent CFMS already exists. Do not remove them
-- without checking the procurement pipeline first.
-- =============================================================

USE lyne;
SET FOREIGN_KEY_CHECKS = 0;

INSERT INTO subscription_tiers
  (id, name, label, description, can_view_analytics, can_view_predictions, can_view_multi_branch, can_view_executive_reports, max_branches, max_staff)
VALUES
  ('tier-basic-001', 'basic', 'Basic', 'Live queue display only.', FALSE, FALSE, FALSE, FALSE, 1, 5),
  ('tier-adv-001', 'advanced', 'Advanced', 'Live queues + historical analytics dashboards.', TRUE, FALSE, FALSE, FALSE, 3, 20),
  ('tier-pred-001', 'predictions', 'Predictions', 'Advanced + AI-powered best-time predictions.', TRUE, TRUE, FALSE, FALSE, 5, 50),
  ('tier-multi-001', 'multi_branch', 'Multi-Branch', 'Predictions + cross-branch manager views.', TRUE, TRUE, TRUE, FALSE, 20, 200),
  ('tier-exec-001', 'executive', 'Executive', 'Full platform: executive dashboards + scheduled reports.', TRUE, TRUE, TRUE, TRUE, 999, 9999)
ON DUPLICATE KEY UPDATE
  label = VALUES(label),
  description = VALUES(description),
  can_view_analytics = VALUES(can_view_analytics),
  can_view_predictions = VALUES(can_view_predictions),
  can_view_multi_branch = VALUES(can_view_multi_branch),
  can_view_executive_reports = VALUES(can_view_executive_reports),
  max_branches = VALUES(max_branches),
  max_staff = VALUES(max_staff);

INSERT INTO roles (id, name, label, description) VALUES
  ('role-staff-001', 'line_staff', 'Line Staff', 'Assigned queue/counter/service operator'),
  ('role-mgr-001', 'manager', 'Manager', 'Branch manager for staff assignments and branch operations'),
  ('role-exec-001', 'executive', 'Executive', 'Business-wide executive dashboard and analytics access'),
  ('role-platform-admin-001', 'platform_admin', 'Platform Admin', 'Internal Lyne operator for onboarding and support')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  label = VALUES(label),
  description = VALUES(description);

INSERT INTO businesses (id, name, slug, description, logo_url, subscription_tier_id, is_active) VALUES
  ('biz-taj-001', 'Tax Administration Jamaica', 'taj', 'Jamaica''s national tax authority. Handles TRN registration, income tax, GCT, property tax, payments, and stamp duty services.', '/logos/taj.png', 'tier-exec-001', TRUE),
  ('biz-pica-001', 'Passport Office of Jamaica (PICA)', 'pica', 'Passport Office demo environment for applications, renewals, child passports, and collection queues.', '/logos/pica.png', 'tier-pred-001', TRUE),
  ('biz-nht-001', 'National Housing Trust', 'nht', 'Housing benefits, contribution, loan, refund, compliance, and advisory services for Jamaican workers.', '/logos/nht.png', 'tier-multi-001', TRUE)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description),
  logo_url = VALUES(logo_url),
  subscription_tier_id = VALUES(subscription_tier_id),
  is_active = TRUE;

INSERT INTO branches (id, business_id, name, address, city, parish, phone, latitude, longitude, is_main_branch, is_active) VALUES
  ('br-taj-kgn', 'biz-taj-001', 'Kingston - Half Way Tree', '1 Half Way Tree Road, Kingston 5', 'Kingston', 'Kingston', '876-922-3470', 18.017900, -76.796900, TRUE, TRUE),
  ('br-taj-mob', 'biz-taj-001', 'Montego Bay', '31 Market Street, Montego Bay', 'Montego Bay', 'St. James', '876-952-5002', 18.476200, -77.893900, FALSE, TRUE),
  ('br-taj-man', 'biz-taj-001', 'Mandeville', '4 Ward Avenue, Mandeville', 'Mandeville', 'Manchester', '876-962-2420', 18.041700, -77.507100, FALSE, TRUE),
  ('br-taj-por', 'biz-taj-001', 'Portmore', 'Portmore Mall, Portmore', 'Portmore', 'St. Catherine', '876-988-1234', 17.950500, -76.879500, FALSE, TRUE),
  ('br-taj-och', 'biz-taj-001', 'Ocho Rios', 'Ocean Village Plaza, Ocho Rios', 'Ocho Rios', 'St. Ann', '876-974-2459', 18.407400, -77.103100, FALSE, TRUE),
  ('br-pica-kgn', 'biz-pica-001', 'Kingston - Constant Spring', '25 Constant Spring Road, Kingston 10', 'Kingston', 'Kingston', '876-754-7422', 18.019200, -76.796300, TRUE, TRUE),
  ('br-pica-mob', 'biz-pica-001', 'Montego Bay', '1 Sunset Boulevard, Montego Bay', 'Montego Bay', 'St. James', '876-952-6789', 18.476900, -77.893100, FALSE, FALSE),
  ('br-nht-kgn', 'biz-nht-001', 'Kingston - Head Office', '4 Park Boulevard, Kingston 5', 'Kingston', 'Kingston', '876-929-6500', 18.016700, -76.781900, TRUE, TRUE),
  ('br-nht-mob', 'biz-nht-001', 'Montego Bay', '23 Barnett Street, Montego Bay', 'Montego Bay', 'St. James', '876-952-3800', 18.476600, -77.893600, FALSE, TRUE),
  ('br-nht-may', 'biz-nht-001', 'May Pen', 'Main Street, May Pen', 'May Pen', 'Clarendon', '876-986-2345', 17.965600, -77.245000, FALSE, TRUE),
  ('br-nht-man', 'biz-nht-001', 'Mandeville', 'Caledonia Road, Mandeville', 'Mandeville', 'Manchester', '876-962-2408', 18.041300, -77.507800, FALSE, TRUE)
ON DUPLICATE KEY UPDATE
  business_id = VALUES(business_id),
  name = VALUES(name),
  address = VALUES(address),
  city = VALUES(city),
  parish = VALUES(parish),
  phone = VALUES(phone),
  latitude = VALUES(latitude),
  longitude = VALUES(longitude),
  is_main_branch = VALUES(is_main_branch),
  is_active = VALUES(is_active);

INSERT INTO services (id, business_id, name, description, ticket_prefix, base_avg_time_minutes, is_active) VALUES
  ('svc-taj-trn', 'biz-taj-001', 'TRN Registration', 'Apply for or update a Tax Registration Number.', 'TRN', 20, TRUE),
  ('svc-taj-inc', 'biz-taj-001', 'Income Tax Filing', 'File annual income tax returns.', 'INC', 30, TRUE),
  ('svc-taj-gct', 'biz-taj-001', 'GCT Registration', 'General Consumption Tax registration and compliance.', 'GCT', 25, TRUE),
  ('svc-taj-pay', 'biz-taj-001', 'Tax Payments', 'Make tax payments and receive receipts.', 'PAY', 10, TRUE),
  ('svc-taj-enq', 'biz-taj-001', 'General Enquiries', 'General tax information and account queries.', 'ENQ', 15, TRUE),
  ('svc-taj-prop', 'biz-taj-001', 'Property Tax', 'Property tax assessments and payments.', 'PRP', 20, TRUE),
  ('svc-taj-stamp', 'biz-taj-001', 'Stamp Duty', 'Stamp duty assessment, payment, and document stamping.', 'STP', 18, TRUE),
  ('svc-pica-new', 'biz-pica-001', 'New Passport Application', 'Apply for a first-time Jamaican passport.', 'NEW', 30, TRUE),
  ('svc-pica-ren', 'biz-pica-001', 'Passport Renewal', 'Renew an existing Jamaican passport.', 'REN', 20, TRUE),
  ('svc-pica-child', 'biz-pica-001', 'Child Passport Application', 'Apply for a child passport.', 'CHD', 35, TRUE),
  ('svc-pica-col', 'biz-pica-001', 'Passport Collection', 'Collect a completed passport.', 'COL', 5, TRUE),
  ('svc-pica-vis', 'biz-pica-001', 'Visa Enquiry', 'Inactive legacy demo service.', 'VIS', 15, FALSE),
  ('svc-pica-cit', 'biz-pica-001', 'Citizenship Application', 'Inactive legacy demo service.', 'CIT', 45, FALSE),
  ('svc-nht-ben', 'biz-nht-001', 'Benefits Enquiry', 'Check NHT contribution balance and benefit eligibility.', 'BEN', 15, TRUE),
  ('svc-nht-app', 'biz-nht-001', 'Loan Application', 'Apply for an NHT housing loan.', 'LAN', 45, TRUE),
  ('svc-nht-reg', 'biz-nht-001', 'Contributor Registration', 'Register as a new NHT contributor.', 'REG', 20, TRUE),
  ('svc-nht-pay', 'biz-nht-001', 'Contribution Payment', 'Make or verify NHT contribution payments.', 'NPY', 10, TRUE),
  ('svc-nht-ref', 'biz-nht-001', 'Contribution Refund', 'Apply for or check contribution refund status.', 'REF', 25, TRUE),
  ('svc-nht-comp', 'biz-nht-001', 'Compliance Letter', 'Request compliance letters and employer documentation.', 'COM', 18, TRUE),
  ('svc-nht-adv', 'biz-nht-001', 'Housing Advice', 'Speak with an advisor about schemes, eligibility, and next steps.', 'ADV', 22, TRUE)
ON DUPLICATE KEY UPDATE
  business_id = VALUES(business_id),
  name = VALUES(name),
  description = VALUES(description),
  ticket_prefix = VALUES(ticket_prefix),
  base_avg_time_minutes = VALUES(base_avg_time_minutes),
  is_active = VALUES(is_active);

INSERT INTO counters (id, branch_id, service_id, counter_number, label, is_active)
SELECT
  CONCAT('ctr-', REPLACE(br.id, 'br-', ''), '-', REPLACE(REPLACE(REPLACE(s.id, 'svc-taj-', ''), 'svc-pica-', ''), 'svc-nht-', '')) AS id,
  br.id,
  s.id,
  10 + ROW_NUMBER() OVER (PARTITION BY br.id ORDER BY s.name) AS counter_number,
  CONCAT('Window ', 10 + ROW_NUMBER() OVER (PARTITION BY br.id ORDER BY s.name), ' - ', s.name) AS label,
  TRUE
FROM branches br
JOIN services s ON s.business_id = br.business_id AND s.is_active = TRUE
WHERE br.is_active = TRUE
  AND br.business_id IN ('biz-taj-001', 'biz-pica-001', 'biz-nht-001')
ON DUPLICATE KEY UPDATE
  service_id = VALUES(service_id),
  label = VALUES(label),
  is_active = TRUE;

-- Extra windows for the busier services. A real government branch does not run
-- a single clerk for a service with a dozen people in line, it opens several
-- windows, and the wait divides across them. The customer ETA is counter-aware
-- (people ahead over open counters times per-person time), so without this
-- every projected wait read as a single-file line: a passport queue showed 245
-- minutes. Slower services get a third window, every service gets a second.
-- counter_number starts at 200 to stay clear of the base windows in the unique
-- (branch_id, counter_number) key.
INSERT INTO counters (id, branch_id, service_id, counter_number, label, is_active)
SELECT
  CONCAT('ctr-', REPLACE(br.id, 'br-', ''), '-', REPLACE(REPLACE(REPLACE(s.id, 'svc-taj-', ''), 'svc-pica-', ''), 'svc-nht-', ''), '-w', seq.n) AS id,
  br.id,
  s.id,
  200 + ROW_NUMBER() OVER (PARTITION BY br.id ORDER BY s.name, seq.n) AS counter_number,
  CONCAT('Window ', s.name, ' - ', seq.n) AS label,
  TRUE
FROM branches br
JOIN services s ON s.business_id = br.business_id AND s.is_active = TRUE
JOIN (SELECT 2 AS n UNION ALL SELECT 3) seq
WHERE br.is_active = TRUE
  AND br.business_id IN ('biz-taj-001', 'biz-pica-001', 'biz-nht-001')
  AND seq.n <= CASE WHEN s.base_avg_time_minutes > 15 THEN 3 ELSE 2 END
ON DUPLICATE KEY UPDATE
  service_id = VALUES(service_id),
  label = VALUES(label),
  is_active = TRUE;

INSERT INTO staff (id, business_id, branch_id, role_id, staff_code, full_name, email, assigned_service_id, is_active, availability_status) VALUES
  ('stf-demo-taj-kgn-trn', 'biz-taj-001', 'br-taj-kgn', 'role-staff-001', 'TAJ-DEMO-TRN', 'Alicia Bennett', 'demo.trn@taj.gov.jm', 'svc-taj-trn', TRUE, 'active'),
  ('stf-demo-taj-kgn-pay', 'biz-taj-001', 'br-taj-kgn', 'role-staff-001', 'TAJ-DEMO-PAY', 'Kemar Livingston', 'demo.pay@taj.gov.jm', 'svc-taj-pay', TRUE, 'active'),
  ('stf-demo-taj-kgn-enq', 'biz-taj-001', 'br-taj-kgn', 'role-staff-001', 'TAJ-DEMO-ENQ', 'Simone Barrett', 'demo.enq@taj.gov.jm', 'svc-taj-enq', TRUE, 'active'),
  ('stf-demo-taj-kgn-kiosk', 'biz-taj-001', 'br-taj-kgn', 'role-kiosk-001', 'TAJ-DEMO-KIOSK', 'Kingston Front-Desk Kiosk', 'kiosk@test.com', NULL, TRUE, 'active'),
  ('stf-demo-taj-mob-mgr', 'biz-taj-001', 'br-taj-mob', 'role-mgr-001', 'TAJ-MOB-MGR', 'Racquel Gayle', 'demo.mob.manager@taj.gov.jm', NULL, TRUE, 'active'),
  ('stf-demo-taj-man-mgr', 'biz-taj-001', 'br-taj-man', 'role-mgr-001', 'TAJ-MAN-MGR', 'Trevor Hylton', 'demo.man.manager@taj.gov.jm', NULL, TRUE, 'active'),
  ('stf-demo-taj-por-mgr', 'biz-taj-001', 'br-taj-por', 'role-mgr-001', 'TAJ-POR-MGR', 'Camille Ellis', 'demo.por.manager@taj.gov.jm', NULL, TRUE, 'active'),
  ('stf-demo-taj-och-mgr', 'biz-taj-001', 'br-taj-och', 'role-mgr-001', 'TAJ-OCH-MGR', 'Dwayne Pryce', 'demo.och.manager@taj.gov.jm', NULL, TRUE, 'active'),
  ('stf-demo-pica-kgn-mgr', 'biz-pica-001', 'br-pica-kgn', 'role-mgr-001', 'PICA-KGN-MGR', 'Yvonne Chambers', 'demo.manager@pica.gov.jm', NULL, TRUE, 'active'),
  ('stf-demo-nht-kgn-mgr', 'biz-nht-001', 'br-nht-kgn', 'role-mgr-001', 'NHT-KGN-MGR', 'Garfield Whyte', 'demo.kgn.manager@nht.gov.jm', NULL, TRUE, 'active'),
  ('stf-demo-nht-mob-mgr', 'biz-nht-001', 'br-nht-mob', 'role-mgr-001', 'NHT-MOB-MGR', 'Latoya Sinclair', 'demo.mob.manager@nht.gov.jm', NULL, TRUE, 'active'),
  ('stf-demo-nht-may-mgr', 'biz-nht-001', 'br-nht-may', 'role-mgr-001', 'NHT-MAY-MGR', 'Oneil Bryan', 'demo.may.manager@nht.gov.jm', NULL, TRUE, 'active'),
  ('stf-demo-nht-man-mgr', 'biz-nht-001', 'br-nht-man', 'role-mgr-001', 'NHT-MAN-MGR', 'Sheryl Grant', 'demo.man.manager@nht.gov.jm', NULL, TRUE, 'active')
ON DUPLICATE KEY UPDATE
  business_id = VALUES(business_id),
  branch_id = VALUES(branch_id),
  role_id = VALUES(role_id),
  full_name = VALUES(full_name),
  assigned_service_id = VALUES(assigned_service_id),
  is_active = TRUE,
  availability_status = VALUES(availability_status);

-- Every branch gets a supervisor.
-- The demo shipped exactly one, at TAJ Kingston, so a manager at any other
-- branch pressing "Ask Supervisor To Staff It" got "no active supervisor is
-- assigned to this branch" — a correct answer to a badly-staffed demo.
-- A branch with a manager and no supervisor is also not a realistic branch.
INSERT INTO staff (id, business_id, branch_id, role_id, staff_code, full_name, email, assigned_service_id, is_active, availability_status)
SELECT
  CONCAT('stf-demo-sup-', REPLACE(b.id, 'br-', '')),
  b.business_id,
  b.id,
  'role-supervisor-001',
  CONCAT(UPPER(REPLACE(b.id, 'br-', '')), '-SUP'),
  -- A person's name, picked deterministically per branch. "Demo <Branch>
  -- Supervisor" is a role description in a full_name column, and it read as
  -- placeholder data on every board that lists people.
  ELT(1 + MOD(CRC32(b.id), 8),
      'Andre Campbell', 'Nadine Foster', 'Rohan Peart', 'Kerry-Ann Brown',
      'Damion Stewart', 'Shanice Miller', 'Tarik Palmer', 'Janelle Rose'),
  CONCAT('demo.sup.', REPLACE(b.id, 'br-', ''), '@lyne.test'),
  NULL, TRUE, 'active'
FROM branches b
WHERE b.is_active = TRUE
  AND NOT EXISTS (
    SELECT 1 FROM staff s
     WHERE s.branch_id = b.id AND s.role_id = 'role-supervisor-001' AND s.is_active = TRUE)
ON DUPLICATE KEY UPDATE is_active = TRUE;

INSERT INTO staff_assignments (id, staff_id, counter_id, assignment_date, shift_start, shift_end, created_by)
SELECT
  CONCAT('asgn-', SUBSTRING(MD5(CONCAT(s.id, c.id, CURDATE())), 1, 30)),
  s.id,
  c.id,
  CURDATE(),
  '08:30:00',
  '16:30:00',
  NULL
FROM staff s
JOIN counters c
  ON c.branch_id = s.branch_id
 AND c.service_id = s.assigned_service_id
WHERE s.role_id = 'role-staff-001'
  AND s.is_active = TRUE
  AND s.assigned_service_id IS NOT NULL
ON DUPLICATE KEY UPDATE
  counter_id = VALUES(counter_id),
  assignment_date = VALUES(assignment_date),
  shift_start = VALUES(shift_start),
  shift_end = VALUES(shift_end);

INSERT INTO users (id, email, full_name, phone, national_id, trn, date_of_birth)
SELECT
  CONCAT('usr-demo-', LPAD(n.n, 2, '0')),
  CONCAT('demo.customer', LPAD(n.n, 2, '0'), '@lyne.test'),
  ELT(n.n,
    'Aaliyah Brown', 'Daniel Campbell', 'Maya Clarke', 'Owen Davis', 'Nia Edwards',
    'Jason Fraser', 'Sasha Grant', 'Andre Henry', 'Renee Johnson', 'Kyle Lewis',
    'Tanya McKenzie', 'Brian Morgan', 'Simone Nelson', 'Rohan Palmer', 'Latoya Reid',
    'Damian Scott', 'Kendra Thomas', 'Nicholas Walker', 'Monique Williams', 'Gavin Wright'
  ),
  CONCAT('876-555-', LPAD(2000 + n.n, 4, '0')),
  CONCAT('JM-DEMO-', LPAD(n.n, 4, '0')),
  CONCAT(LPAD(100 + n.n, 3, '0'), '-', LPAD(200 + n.n, 3, '0'), '-', LPAD(300 + n.n, 3, '0')),
  DATE_SUB(CURDATE(), INTERVAL (25 + n.n) YEAR)
FROM (
  SELECT 1 n UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5
  UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9 UNION ALL SELECT 10
  UNION ALL SELECT 11 UNION ALL SELECT 12 UNION ALL SELECT 13 UNION ALL SELECT 14 UNION ALL SELECT 15
  UNION ALL SELECT 16 UNION ALL SELECT 17 UNION ALL SELECT 18 UNION ALL SELECT 19 UNION ALL SELECT 20
) n
ON DUPLICATE KEY UPDATE
  full_name = VALUES(full_name),
  phone = VALUES(phone),
  national_id = VALUES(national_id),
  trn = VALUES(trn);

INSERT INTO saved_businesses (user_id, business_id)
SELECT u.id, b.id
FROM users u
JOIN businesses b ON b.id IN ('biz-taj-001', 'biz-pica-001', 'biz-nht-001')
WHERE u.id LIKE 'usr-demo-%'
ON DUPLICATE KEY UPDATE saved_at = saved_at;

-- The API opens the day lazily (ensureQueuesForToday) the moment any staff
-- member signs in, minting queue rows with UUID ids. Those rows collide with
-- the deterministic ids below on uk_queue_day (branch, service, date), and the
-- collision aborted the ENTIRE nightly re-seed — so a demo box that had been
-- touched after midnight came up with no lines at all.
--
-- A lazily-opened queue is empty by definition, so clearing today's empty
-- non-seed rows lets the seeded day take ownership without losing anything.
DELETE q FROM queues q
 WHERE q.queue_date = CURDATE()
   AND q.id NOT LIKE 'q-%'
   AND NOT EXISTS (SELECT 1 FROM queue_tickets t WHERE t.queue_id = q.id);

INSERT INTO queues (id, branch_id, service_id, queue_date, max_capacity, is_active)
SELECT
  CONCAT('q-', REPLACE(br.id, 'br-', ''), '-', REPLACE(REPLACE(REPLACE(s.id, 'svc-taj-', ''), 'svc-pica-', ''), 'svc-nht-', '')),
  br.id,
  s.id,
  CURDATE(),
  CASE
    WHEN br.business_id = 'biz-pica-001' THEN 40
    WHEN br.business_id = 'biz-nht-001' THEN 45
    ELSE 55
  END,
  TRUE
FROM branches br
JOIN services s ON s.business_id = br.business_id AND s.is_active = TRUE
WHERE br.is_active = TRUE
  AND br.business_id IN ('biz-taj-001', 'biz-pica-001', 'biz-nht-001')
ON DUPLICATE KEY UPDATE
  queue_date = VALUES(queue_date),   -- re-date the queue to today on every refresh (ids are date-independent)
  max_capacity = VALUES(max_capacity),
  is_active = TRUE;

INSERT INTO queue_tickets
  (id, queue_id, user_id, intake_form_id, ticket_number, verification_code, position, status, estimated_wait_minutes,
   joined_at, called_at, call_timeout_seconds, call_expires_at, started_serving_at, completed_at, served_by_staff_id, served_at_counter_id)
SELECT
  CONCAT('t-', SUBSTRING(MD5(CONCAT(q.id, ':', seq.n)), 1, 30)),  -- stable id per (queue,seat): refresh updates in place instead of piling up daily
  q.id,
  CONCAT('usr-demo-', LPAD(1 + MOD(seq.n + CRC32(q.id), 20), 2, '0')),
  NULL,
  CONCAT(s.ticket_prefix, '-', LPAD(seq.n, 3, '0')),
  -- Six numeric digits, matching what the server issues and what the desk can
  -- accept. This was UPPER(SUBSTRING(MD5(...), 1, 8)) — an eight-character hex
  -- string with letters in it — while createVerificationCode() mints
  -- String(randomInt(100000, 1000000)) and the counter screen renders exactly
  -- six numeric boxes. 590 demo tickets carried a code a clerk physically could
  -- not type, so Start Service could never be completed against them and the
  -- button read as broken.
  LPAD(CONV(SUBSTRING(MD5(CONCAT('verify:', q.id, ':', seq.n, ':', CURDATE())), 1, 6), 16, 10) MOD 1000000, 6, '0'),
  seq.n,
  CASE
    WHEN q.branch_id = 'br-taj-kgn' AND q.service_id = 'svc-taj-trn' AND seq.n = 1 THEN 'in_service'
    WHEN q.branch_id = 'br-taj-kgn' AND q.service_id = 'svc-taj-trn' AND seq.n = 2 THEN 'called'
    WHEN seq.n = 1 AND MOD(CRC32(q.id), 5) = 0 THEN 'in_service'
    WHEN seq.n = 2 AND MOD(CRC32(q.id), 7) = 0 THEN 'called'
    ELSE 'waiting'
  END,
  GREATEST(0, ROUND((seq.n - 1) / GREATEST(1, (
    SELECT COUNT(*) FROM counters c
    WHERE c.branch_id = q.branch_id AND c.service_id = q.service_id AND c.is_active = TRUE
  )) * s.base_avg_time_minutes)),
  -- Never earlier than the day this queue belongs to.
  -- Arrivals are written as "n * 6 minutes ago", which is fine at 10am and
  -- wrong just after midnight: refreshed at 01:05, the tenth person in line
  -- gets an arrival time of 23:58 YESTERDAY, on a queue dated TODAY. A ticket
  -- standing in today's line that arrived yesterday is the exact inconsistency
  -- the daily model exists to rule out, and the integrity check rightly fails
  -- on it. GREATEST pins the earliest arrival to just after the queue's own
  -- midnight, so a line refreshed in the small hours simply looks young.
  GREATEST(
    DATE_SUB(NOW(), INTERVAL (seq.n * 6 + MOD(CRC32(q.id), 9)) MINUTE),
    TIMESTAMP(q.queue_date, '00:00:30')
  ),
  CASE
    WHEN q.branch_id = 'br-taj-kgn' AND q.service_id = 'svc-taj-trn' AND seq.n IN (1, 2) THEN DATE_SUB(NOW(), INTERVAL 4 MINUTE)
    WHEN seq.n = 1 AND MOD(CRC32(q.id), 5) = 0 THEN DATE_SUB(NOW(), INTERVAL 3 MINUTE)
    WHEN seq.n = 2 AND MOD(CRC32(q.id), 7) = 0 THEN DATE_SUB(NOW(), INTERVAL 30 SECOND)
    ELSE NULL
  END,
  CASE
    WHEN (q.branch_id = 'br-taj-kgn' AND q.service_id = 'svc-taj-trn' AND seq.n = 2)
      OR (seq.n = 2 AND MOD(CRC32(q.id), 7) = 0) THEN 120
    ELSE 120
  END,
  CASE
    WHEN q.branch_id = 'br-taj-kgn' AND q.service_id = 'svc-taj-trn' AND seq.n = 2 THEN DATE_SUB(NOW(), INTERVAL 2 MINUTE)
    WHEN seq.n = 2 AND MOD(CRC32(q.id), 7) = 0 THEN DATE_ADD(NOW(), INTERVAL 90 SECOND)
    ELSE NULL
  END,
  CASE
    WHEN q.branch_id = 'br-taj-kgn' AND q.service_id = 'svc-taj-trn' AND seq.n = 1 THEN DATE_SUB(NOW(), INTERVAL 2 MINUTE)
    WHEN seq.n = 1 AND MOD(CRC32(q.id), 5) = 0 THEN DATE_SUB(NOW(), INTERVAL 1 MINUTE)
    ELSE NULL
  END,
  NULL,
  NULL,
  NULL
FROM queues q
JOIN services s ON s.id = q.service_id
JOIN branches b ON b.id = q.branch_id
JOIN businesses bz ON bz.id = b.business_id
JOIN (
  SELECT 1 n UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5
  UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9 UNION ALL SELECT 10
) seq
WHERE q.queue_date = CURDATE()
  AND q.is_active = TRUE
  -- Only the tenants this file owns. Without it the block fills EVERY queue
  -- dated today, including the ones the credit-union and sector seeds populate
  -- moments later, and both blocks number from 1: LDR-001 written twice into
  -- one line, two live tickets on position 1, and "you're next" shown to both.
  AND b.business_id IN ('biz-taj-001', 'biz-nht-001', 'biz-pica-001')
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
  AND seq.n <= 3 + MOD(CRC32(q.id), 8)
ON DUPLICATE KEY UPDATE
  user_id = VALUES(user_id),
  ticket_number = VALUES(ticket_number),
  position = VALUES(position),
  status = VALUES(status),
  estimated_wait_minutes = VALUES(estimated_wait_minutes),
  joined_at = VALUES(joined_at),
  called_at = VALUES(called_at),
  call_timeout_seconds = VALUES(call_timeout_seconds),
  call_expires_at = VALUES(call_expires_at),
  started_serving_at = VALUES(started_serving_at),
  -- A revived ticket was never completed, and it was never closed.
  --
  -- Ticket ids here are stable per (queue, seat), so a re-seed lands on rows
  -- the expiry sweep may already have closed — and those carry completed_at
  -- and closed_reason='branch_closed_before_called'. Restoring status to
  -- 'waiting' while leaving that behind produced tickets that were waiting and
  -- completed three days earlier: a negative wait in every average, and the
  -- previous occupant's timings showing under a freshly called customer.
  --
  -- Only the live statuses are cleared. A row the seed genuinely writes as
  -- served keeps the completion it was given.
  completed_at = CASE WHEN VALUES(status) IN ('waiting', 'called', 'in_service')
                      THEN NULL ELSE VALUES(completed_at) END,
  closed_reason = CASE WHEN VALUES(status) IN ('waiting', 'called', 'in_service')
                       THEN NULL ELSE closed_reason END;

INSERT INTO queue_events (id, ticket_id, previous_status, new_status, event_timestamp, triggered_by_staff_id, notes)
SELECT
  CONCAT('evt-', SUBSTRING(MD5(CONCAT(t.id, ':seed')), 1, 28)),
  t.id,
  NULL,
  t.status,
  COALESCE(t.called_at, t.joined_at),
  NULL,
  'Demo seed event'
FROM queue_tickets t
JOIN queues q ON q.id = t.queue_id
WHERE q.queue_date = CURDATE()
  AND t.status IN ('called', 'in_service')
ON DUPLICATE KEY UPDATE
  new_status = VALUES(new_status),
  event_timestamp = VALUES(event_timestamp),
  notes = VALUES(notes);

-- Served-today history so the live productivity board has real signal. Most
-- staffed windows show recent activity, a few counters run deliberately slow
-- (3x the service norm, picked by a CRC32 hash), and three named staff sit idle
-- while their line waits. Driven off the staff assignments for today, three
-- served rows per assignment. Idempotent on re-seed.
INSERT INTO queue_tickets
  (id, queue_id, user_id, ticket_number, verification_code, position, status,
   estimated_wait_minutes, joined_at, called_at, started_serving_at, completed_at,
   call_timeout_seconds, served_by_staff_id, served_at_counter_id, channel)
SELECT
  CONCAT('pt-', SUBSTRING(MD5(CONCAT(sa.id, ':', seq.n)), 1, 27)),
  q.id,
  NULL,
  CONCAT(s.ticket_prefix, '-P', LPAD(seq.n, 2, '0'), SUBSTRING(MD5(sa.id), 1, 2)),
  LPAD(CONV(SUBSTRING(MD5(CONCAT('pv:', sa.id, ':', seq.n)), 1, 6), 16, 10) MOD 1000000, 6, '0'),
  900 + seq.n,
  'served',
  0,
  DATE_SUB(NOW(), INTERVAL (100 - seq.n * 10) MINUTE),
  DATE_SUB(NOW(), INTERVAL (80 - seq.n * 10) MINUTE),
  CASE
    WHEN sa.staff_id IN ('stf-nht-002', 'stf-pica-003', 'stf-demo-taj-kgn-enq')
      THEN DATE_SUB(NOW(), INTERVAL (58 + seq.n * 4 + LEAST(s.base_avg_time_minutes, 25)) MINUTE)
    ELSE DATE_SUB(NOW(), INTERVAL (seq.n * 8 + LEAST(s.base_avg_time_minutes, 25) * IF(MOD(CRC32(c.id), 20) = 0, 3, 1)) MINUTE)
  END,
  CASE
    WHEN sa.staff_id IN ('stf-nht-002', 'stf-pica-003', 'stf-demo-taj-kgn-enq')
      THEN DATE_SUB(NOW(), INTERVAL (58 + seq.n * 4) MINUTE)
    ELSE DATE_SUB(NOW(), INTERVAL (seq.n * 8) MINUTE)
  END,
  120,
  sa.staff_id,
  sa.counter_id,
  IF(MOD(seq.n, 3) = 0, 'app', 'walk_in')
FROM staff_assignments sa
JOIN counters c ON c.id = sa.counter_id
JOIN services s ON s.id = c.service_id
JOIN queues q ON q.branch_id = c.branch_id AND q.service_id = c.service_id
             AND q.queue_date = CURDATE() AND q.is_active = TRUE
JOIN (SELECT 1 AS n UNION ALL SELECT 2 UNION ALL SELECT 3) seq
WHERE sa.assignment_date = CURDATE()
ON DUPLICATE KEY UPDATE
  status = VALUES(status),
  started_serving_at = VALUES(started_serving_at),
  completed_at = VALUES(completed_at),
  served_by_staff_id = VALUES(served_by_staff_id),
  served_at_counter_id = VALUES(served_at_counter_id);

INSERT INTO wait_time_records
  (id, ticket_id, business_id, branch_id, service_id, visit_date, day_of_week, hour_of_day, month_of_year,
   wait_time_minutes, service_time_minutes, status, staff_count_at_time, queue_length_at_time, active_counters_at_time)
SELECT
  CONCAT('wtr-', SUBSTRING(MD5(CONCAT(br.id, ':', s.id, ':', d.n, ':', h.hour_val)), 1, 28)),
  CONCAT('hist-', SUBSTRING(MD5(CONCAT('ticket:', br.id, ':', s.id, ':', d.n, ':', h.hour_val)), 1, 31)),
  br.business_id,
  br.id,
  s.id,
  DATE_SUB(CURDATE(), INTERVAL d.n DAY),
  DAYOFWEEK(DATE_SUB(CURDATE(), INTERVAL d.n DAY)) - 1,
  h.hour_val,
  MONTH(DATE_SUB(CURDATE(), INTERVAL d.n DAY)),
  CASE
    WHEN h.hour_val IN (9, 10, 13) THEN s.base_avg_time_minutes + 10 + MOD(CRC32(CONCAT(br.id, s.id, d.n, h.hour_val)), 28)
    ELSE GREATEST(4, s.base_avg_time_minutes - 5 + MOD(CRC32(CONCAT('wait', br.id, s.id, d.n, h.hour_val)), 18))
  END,
  5 + MOD(CRC32(CONCAT('service', br.id, s.id, d.n, h.hour_val)), 26),
  CASE
    WHEN MOD(CRC32(CONCAT('noshow', br.id, s.id, d.n, h.hour_val)), 18) = 0 THEN 'no_show'
    WHEN MOD(CRC32(CONCAT('cancel', br.id, s.id, d.n, h.hour_val)), 24) = 0 THEN 'cancelled'
    ELSE 'served'
  END,
  2 + MOD(CRC32(CONCAT('staff', br.id, d.n, h.hour_val)), 5),
  3 + MOD(CRC32(CONCAT('queue', br.id, s.id, d.n, h.hour_val)), 18),
  1 + MOD(CRC32(CONCAT('counters', br.id, s.id, d.n, h.hour_val)), 4)
FROM branches br
JOIN services s ON s.business_id = br.business_id AND s.is_active = TRUE
JOIN (
  SELECT 0 n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
  UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9
  UNION ALL SELECT 10 UNION ALL SELECT 11 UNION ALL SELECT 12 UNION ALL SELECT 13
  UNION ALL SELECT 14 UNION ALL SELECT 15 UNION ALL SELECT 16 UNION ALL SELECT 17
  UNION ALL SELECT 18 UNION ALL SELECT 19 UNION ALL SELECT 20 UNION ALL SELECT 21
  UNION ALL SELECT 22 UNION ALL SELECT 23 UNION ALL SELECT 24 UNION ALL SELECT 25
  UNION ALL SELECT 26 UNION ALL SELECT 27 UNION ALL SELECT 28 UNION ALL SELECT 29
) d
JOIN (
  SELECT 8 hour_val UNION ALL SELECT 9 UNION ALL SELECT 10 UNION ALL SELECT 11
  UNION ALL SELECT 13 UNION ALL SELECT 15
) h
WHERE br.is_active = TRUE
  AND br.business_id IN ('biz-taj-001', 'biz-pica-001', 'biz-nht-001')
ON DUPLICATE KEY UPDATE
  wait_time_minutes = VALUES(wait_time_minutes),
  service_time_minutes = VALUES(service_time_minutes),
  status = VALUES(status),
  staff_count_at_time = VALUES(staff_count_at_time),
  queue_length_at_time = VALUES(queue_length_at_time),
  active_counters_at_time = VALUES(active_counters_at_time);

INSERT INTO analytics_summaries
  (id, business_id, branch_id, service_id, summary_date, total_visitors, completed_count, cancelled_count, no_show_count, left_count,
   avg_wait_time_minutes, avg_service_time_minutes, peak_hour, completion_rate)
SELECT
  CONCAT('sum-', SUBSTRING(MD5(CONCAT(br.id, ':', s.id, ':', d.n)), 1, 28)),
  br.business_id,
  br.id,
  s.id,
  DATE_SUB(CURDATE(), INTERVAL d.n DAY),
  24 + MOD(CRC32(CONCAT(br.id, s.id, d.n)), 55),
  18 + MOD(CRC32(CONCAT(s.id, br.id, d.n)), 38),
  1 + MOD(CRC32(CONCAT('cancel', br.id, s.id, d.n)), 5),
  MOD(CRC32(CONCAT('noshow', br.id, s.id, d.n)), 6),
  MOD(CRC32(CONCAT('left', br.id, s.id, d.n)), 4),
  8 + MOD(CRC32(CONCAT('wait', br.id, s.id, d.n)), 42),
  6 + MOD(CRC32(CONCAT('service', br.id, s.id, d.n)), 28),
  ELT(1 + MOD(CRC32(CONCAT('hour', br.id, s.id, d.n)), 8), 8, 9, 10, 11, 12, 13, 14, 15),
  72 + MOD(CRC32(CONCAT('rate', br.id, s.id, d.n)), 25)
FROM branches br
JOIN services s ON s.business_id = br.business_id AND s.is_active = TRUE
JOIN (
  SELECT 0 n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
  UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9
  UNION ALL SELECT 10 UNION ALL SELECT 11 UNION ALL SELECT 12 UNION ALL SELECT 13
) d
WHERE br.is_active = TRUE
  AND br.business_id IN ('biz-taj-001', 'biz-pica-001', 'biz-nht-001')
ON DUPLICATE KEY UPDATE
  total_visitors = VALUES(total_visitors),
  completed_count = VALUES(completed_count),
  cancelled_count = VALUES(cancelled_count),
  no_show_count = VALUES(no_show_count),
  left_count = VALUES(left_count),
  avg_wait_time_minutes = VALUES(avg_wait_time_minutes),
  avg_service_time_minutes = VALUES(avg_service_time_minutes),
  peak_hour = VALUES(peak_hour),
  completion_rate = VALUES(completion_rate);

INSERT INTO pipeline_runs
  (id, business_id, run_type, status, model_version, source_window_start, source_window_end, records_exported, records_imported, started_at, completed_at)
VALUES
  ('pipe-demo-taj-latest', 'biz-taj-001', 'full', 'succeeded', 'demo-v1', DATE_SUB(NOW(), INTERVAL 14 DAY), NOW(), 3200, 7, DATE_SUB(NOW(), INTERVAL 45 MINUTE), DATE_SUB(NOW(), INTERVAL 40 MINUTE)),
  ('pipe-demo-pica-latest', 'biz-pica-001', 'full', 'succeeded', 'demo-v1', DATE_SUB(NOW(), INTERVAL 14 DAY), NOW(), 860, 4, DATE_SUB(NOW(), INTERVAL 50 MINUTE), DATE_SUB(NOW(), INTERVAL 47 MINUTE)),
  ('pipe-demo-nht-latest', 'biz-nht-001', 'full', 'succeeded', 'demo-v1', DATE_SUB(NOW(), INTERVAL 14 DAY), NOW(), 2400, 7, DATE_SUB(NOW(), INTERVAL 55 MINUTE), DATE_SUB(NOW(), INTERVAL 51 MINUTE))
ON DUPLICATE KEY UPDATE
  status = VALUES(status),
  source_window_start = VALUES(source_window_start),
  source_window_end = VALUES(source_window_end),
  records_exported = VALUES(records_exported),
  records_imported = VALUES(records_imported),
  started_at = VALUES(started_at),
  completed_at = VALUES(completed_at);

-- predictive_results is OWNED BY THE LIVE MODEL WORKER (apps/model, #44), not
-- seeded. The worker runs the six models against this DB on boot and every 2h
-- and upserts real, fresh insights (wait_eta_grid, best_time_to_visit,
-- demand_forecast, no_show_risk, staffing_recommendation, target_attainment,
-- operational_anomalies, …). Seeding canned "demo-v1" rows here only created
-- stale duplicates alongside the live ones. The reasoning summaries
-- (ops_insights / resource_recommendations / the "why") are produced by the
-- reasoning layer (#45); heatmap_data is computed live by the dashboards.

SET FOREIGN_KEY_CHECKS = 1;

-- Per-branch opening hours (migration 011), so the mobile app shows honest
-- per-branch Open / About-to-open / Closed and gates joining accordingly.
-- open_days: CSV of weekday numbers, 0=Sun..6=Sat.
--
-- DEMO WINDOW, NOT REAL OFFICE HOURS. Real agency hours are 08:00–16:00 Mon–Fri,
-- but the join gate is enforced for real: outside these hours every branch reads
-- "Closed" and the customer journey cannot be shown at all. A demo or rehearsal
-- that runs early, late, or at a weekend would have nothing to demo.
--
-- The window was 07:00–20:00, which still failed the case that matters most:
-- investor and stakeholder calls land in the evening, and at 9pm every screen
-- in the app read "Closed" with a dash for every wait. The demo box is a
-- showroom, not a branch, so it is now open around the clock — the gate logic
-- is unchanged and still enforced, there is simply never an hour when there is
-- nothing to show. Production tenants set their own real hours through the
-- admin app; this file only ever touches the demo database.
-- To rehearse the closed state on purpose, set a narrow window here and re-seed.
UPDATE branches SET opening_time = '00:00:00', closing_time = '23:59:59', open_days = '0,1,2,3,4,5,6' WHERE business_id = 'biz-taj-001';
-- Any remaining branches fall back to the same demo window.
UPDATE branches SET opening_time = '00:00:00', closing_time = '23:59:59', open_days = '0,1,2,3,4,5,6' WHERE opening_time IS NULL;
