-- The connection charset must be declared before any non-ASCII data (see
-- demo_credit_union_seed.sql for the latin1 story).
SET NAMES utf8mb4;

-- =============================================================
-- Fictional commercial bank — Lignum Bank (DEMO ONLY)
--
-- Built for the Scotiabank demo on 18 November 2026. Never on production
-- (CLAUDE.md rule 4). The bank is invented and named after the national
-- flower so it cannot be mistaken for any real Jamaican bank: no real brand,
-- branch address or client is used, and no prospect sees another bank's name.
--
-- What the data is shaped to show, from the research in
-- docs/demo/SCOTIABANK_DEMO_BRIEF.md:
--   • a congested flagship teller line next to a quiet branch, so the executive
--     view answers "which branch needs help today";
--   • account opening and loans with a what-to-bring list, and visits that
--     ended incomplete for the reasons that send Jamaicans back a second time
--     (proof of address too old, no TRN, job letter missing);
--   • Saturday banking as a session, the way Sagicor and NCB have run it and
--     Scotia has not;
--   • a Saturday loan clinic gated by an approved list: only pre-approved
--     applicants may register, and they check in on the day.
--
-- Needs migrations 040 (short_name, help_guide) and 041 (banking sector).
-- Load order matters: this file runs BEFORE demo_sector_seed.sql, whose
-- closing sweep deactivates every branch line on a day the branch is shut.
-- Safe to rerun: every row has a deterministic id.
-- =============================================================

USE lyne;

INSERT INTO businesses
  (id, name, slug, short_name, sector, description, logo_url, subscription_tier_id, is_active)
VALUES
  ('biz-lgb-001', 'Lignum Bank', 'lignum-bank', 'LIGNUM', 'banking',
   'Fictional Jamaican commercial bank for branch-flow, appointment and Saturday-banking demonstrations.',
   NULL, 'tier-exec-001', TRUE)
ON DUPLICATE KEY UPDATE
  name = VALUES(name), short_name = VALUES(short_name), sector = VALUES(sector),
  description = VALUES(description), subscription_tier_id = VALUES(subscription_tier_id), is_active = TRUE;

UPDATE businesses SET help_guide = '{
  "hours": "Monday – Friday, 8:30 AM – 2:30 PM",
  "hoursNote": "Half Way Tree stays open to 4:00 PM. Saturday banking runs on announced Saturdays; see Sessions. Closed on public holidays.",
  "general": "Cash deposits, withdrawals and transfers can be done at any Lignum ABM or in the app. Bring the original of every document; photocopies alone are not accepted for account opening or loans.",
  "services": [
    {
      "name": "Account opening",
      "documents": ["A valid government photo ID: passport, driver’s licence or voter’s ID", "Your TRN card or a clear copy", "Proof of address dated within the last three months", "A job letter or recent payslip"],
      "jp": "No JP certification needed when you bring the originals.",
      "jpRequired": false
    },
    {
      "name": "Loans & mortgages",
      "documents": ["A valid government photo ID", "Your TRN", "A job letter on company letterhead", "Your three most recent payslips", "Proof of address dated within the last three months"],
      "jp": "A statutory declaration, if one is asked for, must be signed before a JP.",
      "jpRequired": true
    },
    {
      "name": "Updating your details",
      "documents": ["A valid government photo ID", "Proof of your new address dated within the last three months"],
      "jp": "No JP certification required.",
      "jpRequired": false
    }
  ]
}'
WHERE id = 'biz-lgb-001';

-- Real Jamaican banking hours, weekdays only. Half Way Tree is the flagship and
-- the late branch, which also keeps a weekday evening rehearsal workable there.
INSERT INTO branches
  (id, business_id, name, address, city, parish, phone, latitude, longitude,
   opening_time, closing_time, open_days, is_main_branch, is_active)
VALUES
  ('br-lgb-hwt', 'biz-lgb-001', 'Half Way Tree',
   '22 Hope Road, Kingston 10', 'Kingston', 'Kingston', '876-555-0300',
   18.012400, -76.796100, '08:30:00', '16:00:00', '1,2,3,4,5', TRUE, TRUE),
  ('br-lgb-nkg', 'biz-lgb-001', 'New Kingston',
   '40 Knutsford Boulevard, Kingston 5', 'Kingston', 'St. Andrew', '876-555-0310',
   18.007600, -76.784900, '08:30:00', '14:30:00', '1,2,3,4,5', FALSE, TRUE),
  ('br-lgb-mob', 'biz-lgb-001', 'Montego Bay',
   '8 Union Street, Montego Bay', 'Montego Bay', 'St. James', '876-555-0320',
   18.470800, -77.918500, '08:30:00', '14:30:00', '1,2,3,4,5', FALSE, TRUE)
ON DUPLICATE KEY UPDATE
  name = VALUES(name), address = VALUES(address), city = VALUES(city), parish = VALUES(parish),
  phone = VALUES(phone), latitude = VALUES(latitude), longitude = VALUES(longitude),
  opening_time = VALUES(opening_time), closing_time = VALUES(closing_time),
  open_days = VALUES(open_days), is_main_branch = VALUES(is_main_branch), is_active = TRUE;

INSERT INTO services
  (id, business_id, name, description, ticket_prefix, base_avg_time_minutes, is_active)
VALUES
  ('svc-lgb-teller', 'biz-lgb-001', 'Teller: Deposits & Withdrawals',
   'Cash deposits and withdrawals, cheques and bill payments at the counter.', 'TEL', 5, TRUE),
  ('svc-lgb-acct', 'biz-lgb-001', 'Account Opening',
   'Open a savings or chequing account with a personal banking officer.', 'ACC', 35, TRUE),
  ('svc-lgb-card', 'biz-lgb-001', 'Debit & Credit Cards',
   'Replace a lost or damaged card, reset a PIN, or ask about a card dispute.', 'CRD', 12, TRUE),
  ('svc-lgb-loan', 'biz-lgb-001', 'Loans & Mortgages',
   'Talk through a personal loan, car loan or mortgage with a lending officer.', 'LON', 40, TRUE),
  ('svc-lgb-enq', 'biz-lgb-001', 'Account Enquiries & Updates',
   'Update your address or details, statements, and questions about your account.', 'ENQ', 14, TRUE),
  ('svc-lgb-biz', 'biz-lgb-001', 'Business Banking',
   'Business deposits, merchant services and business account questions.', 'BIZ', 18, TRUE)
ON DUPLICATE KEY UPDATE
  name = VALUES(name), description = VALUES(description), ticket_prefix = VALUES(ticket_prefix),
  base_avg_time_minutes = VALUES(base_avg_time_minutes), is_active = TRUE;

-- What to have ready. These are the reasons a Jamaican bank visit ends with
-- "come back with...", so each one is a second trip the bank never has to serve.
INSERT INTO service_readiness
  (id, service_id, kind, seq, label, detail, is_mandatory, lead_minutes, is_active)
VALUES
  ('rdy-lgb-acct-01', 'svc-lgb-acct', 'bring', 1, 'Valid government photo ID',
   'Passport, driver’s licence or voter’s ID. The original, not a photo of it.', TRUE, NULL, TRUE),
  ('rdy-lgb-acct-02', 'svc-lgb-acct', 'bring', 2, 'TRN',
   'Your Tax Registration Number card or a clear copy.', TRUE, NULL, TRUE),
  ('rdy-lgb-acct-03', 'svc-lgb-acct', 'bring', 3, 'Proof of address',
   'A utility bill or statement dated within the last three months, in your name.', TRUE, NULL, TRUE),
  ('rdy-lgb-acct-04', 'svc-lgb-acct', 'bring', 4, 'Proof of income',
   'A job letter or your most recent payslip.', TRUE, NULL, TRUE),
  ('rdy-lgb-acct-05', 'svc-lgb-acct', 'prepare', 5, 'Know your opening deposit',
   'Decide how much you will deposit to open the account.', FALSE, NULL, TRUE),

  ('rdy-lgb-loan-01', 'svc-lgb-loan', 'bring', 1, 'Valid government photo ID',
   'Passport, driver’s licence or voter’s ID.', TRUE, NULL, TRUE),
  ('rdy-lgb-loan-02', 'svc-lgb-loan', 'bring', 2, 'Job letter on company letterhead',
   'Showing your position, start date and salary, signed and dated this month.', TRUE, NULL, TRUE),
  ('rdy-lgb-loan-03', 'svc-lgb-loan', 'bring', 3, 'Three most recent payslips',
   'Printed or downloaded copies are accepted.', TRUE, NULL, TRUE),
  ('rdy-lgb-loan-04', 'svc-lgb-loan', 'bring', 4, 'Proof of address',
   'Dated within the last three months.', TRUE, NULL, TRUE),
  ('rdy-lgb-loan-05', 'svc-lgb-loan', 'prepare', 5, 'Start the application online',
   'Fill in the pre-screening form in the app before you come, so the meeting is about your options.', FALSE, 60, TRUE),

  ('rdy-lgb-card-01', 'svc-lgb-card', 'bring', 1, 'Valid government photo ID',
   'Needed to issue a replacement card or reset a PIN.', TRUE, NULL, TRUE),
  ('rdy-lgb-card-02', 'svc-lgb-card', 'bring', 2, 'Your damaged card, if you still have it',
   'So it can be destroyed at the counter.', FALSE, NULL, TRUE),

  ('rdy-lgb-enq-01', 'svc-lgb-enq', 'bring', 1, 'Valid government photo ID',
   'The original document.', TRUE, NULL, TRUE),
  ('rdy-lgb-enq-02', 'svc-lgb-enq', 'bring', 2, 'Proof of your new address',
   'Only if you are updating your address. Dated within the last three months.', FALSE, NULL, TRUE),

  ('rdy-lgb-biz-01', 'svc-lgb-biz', 'bring', 1, 'Certificate of incorporation or business registration',
   'From the Companies Office of Jamaica.', TRUE, NULL, TRUE),
  ('rdy-lgb-biz-02', 'svc-lgb-biz', 'bring', 2, 'Photo ID for each signatory',
   'Every person who signs on the account.', TRUE, NULL, TRUE),
  ('rdy-lgb-biz-03', 'svc-lgb-biz', 'bring', 3, 'Business TRN',
   'The company’s Tax Registration Number.', TRUE, NULL, TRUE)
ON DUPLICATE KEY UPDATE
  kind = VALUES(kind), seq = VALUES(seq), label = VALUES(label), detail = VALUES(detail),
  is_mandatory = VALUES(is_mandatory), lead_minutes = VALUES(lead_minutes), is_active = TRUE;

INSERT INTO counters (id, branch_id, service_id, counter_number, label, is_active)
VALUES
  ('ctr-lgb-hwt-tel-1', 'br-lgb-hwt', 'svc-lgb-teller', 1, 'Teller 1', TRUE),
  ('ctr-lgb-hwt-tel-2', 'br-lgb-hwt', 'svc-lgb-teller', 2, 'Teller 2', TRUE),
  ('ctr-lgb-hwt-tel-3', 'br-lgb-hwt', 'svc-lgb-teller', 3, 'Teller 3', TRUE),
  ('ctr-lgb-hwt-acct',  'br-lgb-hwt', 'svc-lgb-acct',   4, 'Personal Banking 1', TRUE),
  ('ctr-lgb-hwt-loan',  'br-lgb-hwt', 'svc-lgb-loan',   5, 'Lending Desk', TRUE),
  ('ctr-lgb-hwt-card',  'br-lgb-hwt', 'svc-lgb-card',   6, 'Card Services', TRUE),
  ('ctr-lgb-hwt-enq',   'br-lgb-hwt', 'svc-lgb-enq',    7, 'Client Service', TRUE),
  ('ctr-lgb-nkg-tel-1', 'br-lgb-nkg', 'svc-lgb-teller', 1, 'Teller 1', TRUE),
  ('ctr-lgb-nkg-tel-2', 'br-lgb-nkg', 'svc-lgb-teller', 2, 'Teller 2', TRUE),
  ('ctr-lgb-nkg-acct',  'br-lgb-nkg', 'svc-lgb-acct',   3, 'Personal Banking 1', TRUE),
  ('ctr-lgb-nkg-loan',  'br-lgb-nkg', 'svc-lgb-loan',   4, 'Lending Desk', TRUE),
  ('ctr-lgb-nkg-biz',   'br-lgb-nkg', 'svc-lgb-biz',    5, 'Business Banking', TRUE),
  ('ctr-lgb-mob-tel-1', 'br-lgb-mob', 'svc-lgb-teller', 1, 'Teller 1', TRUE),
  ('ctr-lgb-mob-acct',  'br-lgb-mob', 'svc-lgb-acct',   2, 'Personal Banking 1', TRUE)
ON DUPLICATE KEY UPDATE service_id = VALUES(service_id), label = VALUES(label), is_active = TRUE;

-- The role ladder. The executive has no branch_id, which is what makes them
-- bank-wide. The four demo logins (sync-demo-test-accounts.js) adopt the first
-- teller, the HWT supervisor and manager, and the executive.
INSERT INTO staff
  (id, business_id, branch_id, role_id, staff_code, full_name, email, assigned_service_id, is_active, availability_status)
VALUES
  ('stf-lgb-exec',      'biz-lgb-001', NULL,         'role-exec-001',       'LGB-EX1', 'Lorraine Gordon',  'lorraine@lignumbank.demo', NULL, TRUE, 'active'),
  ('stf-lgb-hwt-mgr',   'biz-lgb-001', 'br-lgb-hwt', 'role-mgr-001',        'LGB-BM1', 'Dwayne Pottinger', 'dwayne@lignumbank.demo',   NULL, TRUE, 'active'),
  ('stf-lgb-hwt-sup',   'biz-lgb-001', 'br-lgb-hwt', 'role-supervisor-001', 'LGB-SV1', 'Kimberley Hylton', 'kimberley@lignumbank.demo',NULL, TRUE, 'active'),
  ('stf-lgb-hwt-tel1',  'biz-lgb-001', 'br-lgb-hwt', 'role-staff-001',      'LGB-T01', 'Shauna Edwards',   'shauna@lignumbank.demo',   'svc-lgb-teller', TRUE, 'active'),
  ('stf-lgb-hwt-tel2',  'biz-lgb-001', 'br-lgb-hwt', 'role-staff-001',      'LGB-T02', 'Omar Francis',     'omar@lignumbank.demo',     'svc-lgb-teller', TRUE, 'active'),
  ('stf-lgb-hwt-pbo',   'biz-lgb-001', 'br-lgb-hwt', 'role-staff-001',      'LGB-P01', 'Natalie Brooks',   'natalie@lignumbank.demo',  'svc-lgb-acct',   TRUE, 'active'),
  ('stf-lgb-hwt-lend',  'biz-lgb-001', 'br-lgb-hwt', 'role-staff-001',      'LGB-L01', 'Christopher Lyn',  'christopher@lignumbank.demo','svc-lgb-loan', TRUE, 'active'),
  ('stf-lgb-nkg-mgr',   'biz-lgb-001', 'br-lgb-nkg', 'role-mgr-001',        'LGB-BM2', 'Paulette Grant',   'paulette@lignumbank.demo', NULL, TRUE, 'active'),
  ('stf-lgb-nkg-tel1',  'biz-lgb-001', 'br-lgb-nkg', 'role-staff-001',      'LGB-T11', 'Javon Thompson',   'javon@lignumbank.demo',    'svc-lgb-teller', TRUE, 'active'),
  ('stf-lgb-mob-mgr',   'biz-lgb-001', 'br-lgb-mob', 'role-mgr-001',        'LGB-BM3', 'Andrea Walters',   'andrea@lignumbank.demo',   NULL, TRUE, 'active'),
  ('stf-lgb-mob-tel1',  'biz-lgb-001', 'br-lgb-mob', 'role-staff-001',      'LGB-T21', 'Ricardo Henry',    'ricardo@lignumbank.demo',  'svc-lgb-teller', TRUE, 'active')
ON DUPLICATE KEY UPDATE
  business_id = VALUES(business_id), branch_id = VALUES(branch_id), role_id = VALUES(role_id),
  full_name = VALUES(full_name), assigned_service_id = VALUES(assigned_service_id),
  is_active = TRUE, availability_status = VALUES(availability_status);

INSERT INTO queues (id, branch_id, service_id, queue_date, max_capacity, is_active)
VALUES
  ('q-lgb-hwt-teller', 'br-lgb-hwt', 'svc-lgb-teller', CURDATE(), 160, TRUE),
  ('q-lgb-hwt-acct',   'br-lgb-hwt', 'svc-lgb-acct',   CURDATE(), 30,  TRUE),
  ('q-lgb-hwt-loan',   'br-lgb-hwt', 'svc-lgb-loan',   CURDATE(), 20,  TRUE),
  ('q-lgb-hwt-card',   'br-lgb-hwt', 'svc-lgb-card',   CURDATE(), 40,  TRUE),
  ('q-lgb-hwt-enq',    'br-lgb-hwt', 'svc-lgb-enq',    CURDATE(), 40,  TRUE),
  ('q-lgb-nkg-teller', 'br-lgb-nkg', 'svc-lgb-teller', CURDATE(), 120, TRUE),
  ('q-lgb-nkg-acct',   'br-lgb-nkg', 'svc-lgb-acct',   CURDATE(), 25,  TRUE),
  ('q-lgb-nkg-loan',   'br-lgb-nkg', 'svc-lgb-loan',   CURDATE(), 15,  TRUE),
  ('q-lgb-nkg-biz',    'br-lgb-nkg', 'svc-lgb-biz',    CURDATE(), 30,  TRUE),
  ('q-lgb-mob-teller', 'br-lgb-mob', 'svc-lgb-teller', CURDATE(), 90,  TRUE),
  ('q-lgb-mob-acct',   'br-lgb-mob', 'svc-lgb-acct',   CURDATE(), 20,  TRUE)
ON DUPLICATE KEY UPDATE queue_date = CURDATE(), max_capacity = VALUES(max_capacity), is_active = TRUE;

-- Live lines. Deliberately uneven: Half Way Tree's teller line is the payday
-- crowd, New Kingston is busy, Montego Bay is quiet. One client is already at
-- Teller 1 and everyone else is WAITING, not called: a seeded call ages against
-- the no-show countdown and would be stale before anyone opens the desk (see the
-- credit-union seed). So Call Next calls somebody real.
INSERT INTO queue_tickets
  (id, queue_id, user_id, ticket_number, verification_code, position, status,
   estimated_wait_minutes, channel, joined_at, called_at, call_timeout_seconds,
   call_expires_at, started_serving_at, served_by_staff_id, served_at_counter_id)
VALUES
  ('t-lgb-hwt-tel-01', 'q-lgb-hwt-teller', NULL, 'TEL-001', 'KQ7MRD', 1, 'in_service', 0, 'walk_in',
   DATE_SUB(NOW(), INTERVAL 31 MINUTE), DATE_SUB(NOW(), INTERVAL 3 MINUTE), 120,
   DATE_ADD(NOW(), INTERVAL 117 SECOND), DATE_SUB(NOW(), INTERVAL 2 MINUTE), 'stf-lgb-hwt-tel1', 'ctr-lgb-hwt-tel-1'),
  ('t-lgb-hwt-tel-02', 'q-lgb-hwt-teller', 'usr-demo-01', 'TEL-002', 'NP4CFE', 2, 'waiting', 2,  'app',     DATE_SUB(NOW(), INTERVAL 29 MINUTE), NULL, 120, NULL, NULL, NULL, NULL),
  ('t-lgb-hwt-tel-03', 'q-lgb-hwt-teller', NULL,          'TEL-003', 'DM9QKA', 3, 'waiting', 4,  'walk_in', DATE_SUB(NOW(), INTERVAL 27 MINUTE), NULL, 120, NULL, NULL, NULL, NULL),
  ('t-lgb-hwt-tel-04', 'q-lgb-hwt-teller', NULL,          'TEL-004', 'R6FPC3', 4, 'waiting', 7,  'kiosk',   DATE_SUB(NOW(), INTERVAL 24 MINUTE), NULL, 120, NULL, NULL, NULL, NULL),
  ('t-lgb-hwt-tel-05', 'q-lgb-hwt-teller', 'usr-demo-02', 'TEL-005', 'CE3MNQ', 5, 'waiting', 9,  'app',     DATE_SUB(NOW(), INTERVAL 21 MINUTE), NULL, 120, NULL, NULL, NULL, NULL),
  ('t-lgb-hwt-tel-06', 'q-lgb-hwt-teller', NULL,          'TEL-006', 'P9KDR4', 6, 'waiting', 12, 'walk_in', DATE_SUB(NOW(), INTERVAL 18 MINUTE), NULL, 120, NULL, NULL, NULL, NULL),
  ('t-lgb-hwt-tel-07', 'q-lgb-hwt-teller', NULL,          'TEL-007', 'FQ7E9M', 7, 'waiting', 14, 'kiosk',   DATE_SUB(NOW(), INTERVAL 14 MINUTE), NULL, 120, NULL, NULL, NULL, NULL),
  ('t-lgb-hwt-tel-08', 'q-lgb-hwt-teller', 'usr-demo-03', 'TEL-008', 'MA4KPF', 8, 'waiting', 17, 'app',     DATE_SUB(NOW(), INTERVAL 11 MINUTE), NULL, 120, NULL, NULL, NULL, NULL),
  ('t-lgb-hwt-tel-09', 'q-lgb-hwt-teller', NULL,          'TEL-009', '3RCN7D', 9, 'waiting', 19, 'walk_in', DATE_SUB(NOW(), INTERVAL 7 MINUTE),  NULL, 120, NULL, NULL, NULL, NULL),
  ('t-lgb-hwt-tel-10', 'q-lgb-hwt-teller', NULL,          'TEL-010', 'K4DMQ9', 10,'waiting', 22, 'walk_in', DATE_SUB(NOW(), INTERVAL 3 MINUTE),  NULL, 120, NULL, NULL, NULL, NULL),
  ('t-lgb-hwt-acc-01', 'q-lgb-hwt-acct',   'usr-demo-04', 'ACC-001', 'QF3NCK', 1, 'waiting', 0,  'app',     DATE_SUB(NOW(), INTERVAL 22 MINUTE), NULL, 120, NULL, NULL, NULL, NULL),
  ('t-lgb-hwt-acc-02', 'q-lgb-hwt-acct',   NULL,          'ACC-002', 'D7MPR4', 2, 'waiting', 35, 'walk_in', DATE_SUB(NOW(), INTERVAL 15 MINUTE), NULL, 120, NULL, NULL, NULL, NULL),
  ('t-lgb-hwt-acc-03', 'q-lgb-hwt-acct',   NULL,          'ACC-003', 'NC9KF3', 3, 'waiting', 70, 'app',     DATE_SUB(NOW(), INTERVAL 6 MINUTE),  NULL, 120, NULL, NULL, NULL, NULL),
  ('t-lgb-hwt-lon-01', 'q-lgb-hwt-loan',   NULL,          'LON-001', 'RM4QD7', 1, 'waiting', 0,  'app',     DATE_SUB(NOW(), INTERVAL 12 MINUTE), NULL, 120, NULL, NULL, NULL, NULL),
  ('t-lgb-hwt-lon-02', 'q-lgb-hwt-loan',   NULL,          'LON-002', 'F4KCN9', 2, 'waiting', 40, 'walk_in', DATE_SUB(NOW(), INTERVAL 4 MINUTE),  NULL, 120, NULL, NULL, NULL, NULL),
  ('t-lgb-hwt-crd-01', 'q-lgb-hwt-card',   NULL,          'CRD-001', 'P3DMQ7', 1, 'waiting', 0,  'walk_in', DATE_SUB(NOW(), INTERVAL 9 MINUTE),  NULL, 120, NULL, NULL, NULL, NULL),
  ('t-lgb-hwt-crd-02', 'q-lgb-hwt-card',   NULL,          'CRD-002', 'Q9RKF4', 2, 'waiting', 12, 'app',     DATE_SUB(NOW(), INTERVAL 2 MINUTE),  NULL, 120, NULL, NULL, NULL, NULL),
  ('t-lgb-nkg-tel-01', 'q-lgb-nkg-teller', NULL,          'TEL-101', 'M7CQD4', 1, 'waiting', 0,  'walk_in', DATE_SUB(NOW(), INTERVAL 16 MINUTE), NULL, 120, NULL, NULL, NULL, NULL),
  ('t-lgb-nkg-tel-02', 'q-lgb-nkg-teller', NULL,          'TEL-102', 'C4NPK9', 2, 'waiting', 3,  'app',     DATE_SUB(NOW(), INTERVAL 12 MINUTE), NULL, 120, NULL, NULL, NULL, NULL),
  ('t-lgb-nkg-tel-03', 'q-lgb-nkg-teller', NULL,          'TEL-103', 'K9FMD3', 3, 'waiting', 5,  'kiosk',   DATE_SUB(NOW(), INTERVAL 8 MINUTE),  NULL, 120, NULL, NULL, NULL, NULL),
  ('t-lgb-nkg-tel-04', 'q-lgb-nkg-teller', NULL,          'TEL-104', 'D3QRN7', 4, 'waiting', 8,  'walk_in', DATE_SUB(NOW(), INTERVAL 3 MINUTE),  NULL, 120, NULL, NULL, NULL, NULL),
  ('t-lgb-nkg-biz-01', 'q-lgb-nkg-biz',    NULL,          'BIZ-101', 'N4MKC7', 1, 'waiting', 0,  'app',     DATE_SUB(NOW(), INTERVAL 5 MINUTE),  NULL, 120, NULL, NULL, NULL, NULL),
  ('t-lgb-mob-tel-01', 'q-lgb-mob-teller', NULL,          'TEL-201', 'F7KQM3', 1, 'waiting', 0,  'walk_in', DATE_SUB(NOW(), INTERVAL 4 MINUTE),  NULL, 120, NULL, NULL, NULL, NULL)
ON DUPLICATE KEY UPDATE
  queue_id = VALUES(queue_id), user_id = VALUES(user_id), ticket_number = VALUES(ticket_number),
  position = VALUES(position), status = VALUES(status), estimated_wait_minutes = VALUES(estimated_wait_minutes),
  channel = VALUES(channel), joined_at = VALUES(joined_at), called_at = VALUES(called_at),
  call_expires_at = VALUES(call_expires_at), started_serving_at = VALUES(started_serving_at),
  served_by_staff_id = VALUES(served_by_staff_id), served_at_counter_id = VALUES(served_at_counter_id),
  completed_at = CASE WHEN VALUES(status) IN ('waiting', 'called', 'in_service') THEN NULL ELSE completed_at END,
  closed_reason = CASE WHEN VALUES(status) IN ('waiting', 'called', 'in_service') THEN NULL ELSE closed_reason END;

-- Today's finished visits. The incomplete ones are the bank's real cost: an
-- officer's half hour spent on a visit that has to happen again.
INSERT INTO queue_tickets
  (id, queue_id, user_id, ticket_number, verification_code, position, status,
   estimated_wait_minutes, channel, joined_at, called_at, started_serving_at, completed_at,
   served_by_staff_id, served_at_counter_id, readiness_shown_at, readiness_outcome, readiness_note)
VALUES
  ('t-lgb-done-01', 'q-lgb-hwt-acct', NULL, 'ACC-P01', 'MQ4DKR', 101, 'served', 20, 'app',     DATE_SUB(NOW(), INTERVAL 5 HOUR), DATE_SUB(NOW(), INTERVAL 280 MINUTE), DATE_SUB(NOW(), INTERVAL 278 MINUTE), DATE_SUB(NOW(), INTERVAL 245 MINUTE), 'stf-lgb-hwt-pbo', 'ctr-lgb-hwt-acct', DATE_SUB(NOW(), INTERVAL 5 HOUR), 'ready', NULL),
  ('t-lgb-done-02', 'q-lgb-hwt-acct', NULL, 'ACC-P02', 'C9NFQ4', 102, 'served', 31, 'walk_in', DATE_SUB(NOW(), INTERVAL 4 HOUR), DATE_SUB(NOW(), INTERVAL 220 MINUTE), DATE_SUB(NOW(), INTERVAL 218 MINUTE), DATE_SUB(NOW(), INTERVAL 196 MINUTE), 'stf-lgb-hwt-pbo', 'ctr-lgb-hwt-acct', DATE_SUB(NOW(), INTERVAL 4 HOUR), 'incomplete', 'Proof of address was older than three months.'),
  ('t-lgb-done-03', 'q-lgb-hwt-acct', NULL, 'ACC-P03', 'R4KMD9', 103, 'served', 18, 'app',     DATE_SUB(NOW(), INTERVAL 3 HOUR), DATE_SUB(NOW(), INTERVAL 165 MINUTE), DATE_SUB(NOW(), INTERVAL 163 MINUTE), DATE_SUB(NOW(), INTERVAL 130 MINUTE), 'stf-lgb-hwt-pbo', 'ctr-lgb-hwt-acct', DATE_SUB(NOW(), INTERVAL 3 HOUR), 'ready', NULL),
  ('t-lgb-done-04', 'q-lgb-hwt-acct', NULL, 'ACC-P04', 'F3QCN7', 104, 'served', 26, 'walk_in', DATE_SUB(NOW(), INTERVAL 2 HOUR), DATE_SUB(NOW(), INTERVAL 105 MINUTE), DATE_SUB(NOW(), INTERVAL 103 MINUTE), DATE_SUB(NOW(), INTERVAL 88 MINUTE),  'stf-lgb-hwt-pbo', 'ctr-lgb-hwt-acct', DATE_SUB(NOW(), INTERVAL 2 HOUR), 'incomplete', 'Client did not have a TRN card or copy.'),
  ('t-lgb-done-05', 'q-lgb-hwt-loan', NULL, 'LON-P01', 'K7DRQ3', 101, 'served', 15, 'app',     DATE_SUB(NOW(), INTERVAL 5 HOUR), DATE_SUB(NOW(), INTERVAL 290 MINUTE), DATE_SUB(NOW(), INTERVAL 288 MINUTE), DATE_SUB(NOW(), INTERVAL 245 MINUTE), 'stf-lgb-hwt-lend', 'ctr-lgb-hwt-loan', DATE_SUB(NOW(), INTERVAL 5 HOUR), 'ready', NULL),
  ('t-lgb-done-06', 'q-lgb-hwt-loan', NULL, 'LON-P02', 'N9QMF4', 102, 'served', 22, 'app',     DATE_SUB(NOW(), INTERVAL 3 HOUR), DATE_SUB(NOW(), INTERVAL 170 MINUTE), DATE_SUB(NOW(), INTERVAL 168 MINUTE), DATE_SUB(NOW(), INTERVAL 140 MINUTE), 'stf-lgb-hwt-lend', 'ctr-lgb-hwt-loan', DATE_SUB(NOW(), INTERVAL 3 HOUR), 'incomplete', 'Job letter was not on company letterhead.'),
  ('t-lgb-done-07', 'q-lgb-hwt-loan', NULL, 'LON-P03', 'D4CKR9', 103, 'served', 12, 'app',     DATE_SUB(NOW(), INTERVAL 90 MINUTE), DATE_SUB(NOW(), INTERVAL 80 MINUTE), DATE_SUB(NOW(), INTERVAL 78 MINUTE), DATE_SUB(NOW(), INTERVAL 40 MINUTE), 'stf-lgb-hwt-lend', 'ctr-lgb-hwt-loan', DATE_SUB(NOW(), INTERVAL 90 MINUTE), 'ready', NULL),
  ('t-lgb-done-08', 'q-lgb-nkg-acct', NULL, 'ACC-P11', 'Q3MNK7', 101, 'served', 9,  'app',     DATE_SUB(NOW(), INTERVAL 4 HOUR), DATE_SUB(NOW(), INTERVAL 232 MINUTE), DATE_SUB(NOW(), INTERVAL 230 MINUTE), DATE_SUB(NOW(), INTERVAL 199 MINUTE), NULL, 'ctr-lgb-nkg-acct', DATE_SUB(NOW(), INTERVAL 4 HOUR), 'ready', NULL)
ON DUPLICATE KEY UPDATE
  status = VALUES(status), joined_at = VALUES(joined_at), called_at = VALUES(called_at),
  started_serving_at = VALUES(started_serving_at), completed_at = VALUES(completed_at),
  served_by_staff_id = VALUES(served_by_staff_id), served_at_counter_id = VALUES(served_at_counter_id),
  readiness_shown_at = VALUES(readiness_shown_at), readiness_outcome = VALUES(readiness_outcome),
  readiness_note = VALUES(readiness_note);

-- Served teller history across the day, so the executive view has a trend to
-- compare and a no-show rate to read.
INSERT INTO queue_tickets
  (id, queue_id, user_id, ticket_number, verification_code, position, status,
   estimated_wait_minutes, channel, joined_at, called_at, started_serving_at, completed_at,
   served_by_staff_id, served_at_counter_id)
VALUES
  ('t-lgb-h-01', 'q-lgb-hwt-teller', NULL, 'TEL-P01', 'MK3QD9', 101, 'served',  38, 'walk_in', DATE_SUB(NOW(), INTERVAL 6 HOUR),  DATE_SUB(NOW(), INTERVAL 322 MINUTE), DATE_SUB(NOW(), INTERVAL 321 MINUTE), DATE_SUB(NOW(), INTERVAL 316 MINUTE), 'stf-lgb-hwt-tel1', 'ctr-lgb-hwt-tel-1'),
  ('t-lgb-h-02', 'q-lgb-hwt-teller', NULL, 'TEL-P02', 'C7RNF3', 102, 'served',  41, 'app',     DATE_SUB(NOW(), INTERVAL 5 HOUR),  DATE_SUB(NOW(), INTERVAL 262 MINUTE), DATE_SUB(NOW(), INTERVAL 261 MINUTE), DATE_SUB(NOW(), INTERVAL 255 MINUTE), 'stf-lgb-hwt-tel2', 'ctr-lgb-hwt-tel-2'),
  ('t-lgb-h-03', 'q-lgb-hwt-teller', NULL, 'TEL-P03', 'Q4FDM7', 103, 'served',  33, 'kiosk',   DATE_SUB(NOW(), INTERVAL 4 HOUR),  DATE_SUB(NOW(), INTERVAL 207 MINUTE), DATE_SUB(NOW(), INTERVAL 206 MINUTE), DATE_SUB(NOW(), INTERVAL 201 MINUTE), 'stf-lgb-hwt-tel1', 'ctr-lgb-hwt-tel-1'),
  ('t-lgb-h-04', 'q-lgb-hwt-teller', NULL, 'TEL-P04', 'N7KCQ4', 104, 'no_show', 29, 'app',     DATE_SUB(NOW(), INTERVAL 3 HOUR),  DATE_SUB(NOW(), INTERVAL 150 MINUTE), NULL, NULL, NULL, NULL),
  ('t-lgb-h-05', 'q-lgb-hwt-teller', NULL, 'TEL-P05', 'D9MRK3', 105, 'served',  27, 'walk_in', DATE_SUB(NOW(), INTERVAL 2 HOUR),  DATE_SUB(NOW(), INTERVAL 95 MINUTE),  DATE_SUB(NOW(), INTERVAL 94 MINUTE),  DATE_SUB(NOW(), INTERVAL 89 MINUTE),  'stf-lgb-hwt-tel2', 'ctr-lgb-hwt-tel-2'),
  ('t-lgb-h-06', 'q-lgb-nkg-teller', NULL, 'TEL-P11', 'F4QMN9', 101, 'served',  14, 'walk_in', DATE_SUB(NOW(), INTERVAL 5 HOUR),  DATE_SUB(NOW(), INTERVAL 286 MINUTE), DATE_SUB(NOW(), INTERVAL 285 MINUTE), DATE_SUB(NOW(), INTERVAL 280 MINUTE), 'stf-lgb-nkg-tel1', 'ctr-lgb-nkg-tel-1'),
  ('t-lgb-h-07', 'q-lgb-nkg-teller', NULL, 'TEL-P12', 'K3DCR7', 102, 'served',  11, 'app',     DATE_SUB(NOW(), INTERVAL 3 HOUR),  DATE_SUB(NOW(), INTERVAL 170 MINUTE), DATE_SUB(NOW(), INTERVAL 169 MINUTE), DATE_SUB(NOW(), INTERVAL 165 MINUTE), 'stf-lgb-nkg-tel1', 'ctr-lgb-nkg-tel-1'),
  ('t-lgb-h-08', 'q-lgb-mob-teller', NULL, 'TEL-P21', 'M9QFD4', 101, 'served',  4,  'walk_in', DATE_SUB(NOW(), INTERVAL 4 HOUR),  DATE_SUB(NOW(), INTERVAL 236 MINUTE), DATE_SUB(NOW(), INTERVAL 235 MINUTE), DATE_SUB(NOW(), INTERVAL 231 MINUTE), 'stf-lgb-mob-tel1', 'ctr-lgb-mob-tel-1'),
  ('t-lgb-h-09', 'q-lgb-mob-teller', NULL, 'TEL-P22', 'R3NKC9', 102, 'served',  6,  'app',     DATE_SUB(NOW(), INTERVAL 2 HOUR),  DATE_SUB(NOW(), INTERVAL 112 MINUTE), DATE_SUB(NOW(), INTERVAL 111 MINUTE), DATE_SUB(NOW(), INTERVAL 107 MINUTE), 'stf-lgb-mob-tel1', 'ctr-lgb-mob-tel-1')
ON DUPLICATE KEY UPDATE
  status = VALUES(status), joined_at = VALUES(joined_at), called_at = VALUES(called_at),
  started_serving_at = VALUES(started_serving_at), completed_at = VALUES(completed_at),
  served_by_staff_id = VALUES(served_by_staff_id), served_at_counter_id = VALUES(served_at_counter_id);

INSERT INTO business_targets
  (business_id, target_wait_minutes, target_completion_rate, target_no_show_rate, horizon_months, note, set_by_staff_id)
VALUES
  ('biz-lgb-001', 15, 90.00, 7.00, 6, 'Pilot target: every client at the counter within 15 minutes, payday included.', 'stf-lgb-exec')
ON DUPLICATE KEY UPDATE
  target_wait_minutes = VALUES(target_wait_minutes), target_completion_rate = VALUES(target_completion_rate),
  target_no_show_rate = VALUES(target_no_show_rate), horizon_months = VALUES(horizon_months),
  note = VALUES(note), set_by_staff_id = VALUES(set_by_staff_id);

INSERT INTO branch_targets
  (branch_id, business_id, target_wait_minutes, target_completion_rate, target_no_show_rate, note, set_by_staff_id)
VALUES
  ('br-lgb-hwt', 'biz-lgb-001', 20, 88.00, 8.00, 'Flagship and busiest; payday crowds expected.', 'stf-lgb-exec'),
  ('br-lgb-nkg', 'biz-lgb-001', 15, 90.00, 7.00, 'Corporate area lunchtime peak.', 'stf-lgb-exec'),
  ('br-lgb-mob', 'biz-lgb-001', 12, 92.00, 6.00, 'Lower volume; expected to beat target.', 'stf-lgb-exec')
ON DUPLICATE KEY UPDATE
  target_wait_minutes = VALUES(target_wait_minutes), target_completion_rate = VALUES(target_completion_rate),
  target_no_show_rate = VALUES(target_no_show_rate), note = VALUES(note), set_by_staff_id = VALUES(set_by_staff_id);

-- =============================================================
-- Sessions: Saturday banking, and a loan clinic for an approved list
--
-- Both are the same mechanism the Traffic Court uses (migrations 027 and 029):
-- register in advance, check in on the day, and the check-in becomes an
-- ordinary ticket in the line. Neither depends on the branch's weekday hours.
-- =============================================================
INSERT INTO scheduled_sessions
  (id, business_id, branch_id, service_id, name, description,
   venue_name, venue_address, session_date, starts_at, ends_at,
   capacity, requires_eligibility, second_factor,
   registration_opens_at, registration_closes_at,
   arrive_minutes_before, status)
VALUES
  ('ses-lgb-sat-bank', 'biz-lgb-001', 'br-lgb-hwt', 'svc-lgb-teller',
   'Saturday Banking — Half Way Tree',
   'Teller services on Saturday morning: deposits, withdrawals and bill payments. Reserve a place and check in when you arrive.',
   NULL, NULL,
   DATE_ADD(CURDATE(), INTERVAL ((7 - WEEKDAY(CURDATE()) + 5) % 7) DAY),
   '09:00:00', '12:00:00', 150, 0, 'none',
   DATE_SUB(NOW(), INTERVAL 4 DAY), DATE_ADD(NOW(), INTERVAL 1 DAY), 10, 'open'),
  ('ses-lgb-sat-loans', 'biz-lgb-001', 'br-lgb-nkg', 'svc-lgb-loan',
   'Saturday Loan & Mortgage Clinic — New Kingston',
   'For pre-approved applicants only. Meet a lending officer to finalise your loan. Bring the documents on your approval letter.',
   NULL, NULL,
   DATE_ADD(CURDATE(), INTERVAL ((7 - WEEKDAY(CURDATE()) + 5) % 7) DAY),
   '10:00:00', '13:00:00', 24, 1, 'surname',
   DATE_SUB(NOW(), INTERVAL 6 DAY), DATE_ADD(NOW(), INTERVAL 1 DAY), 15, 'open')
ON DUPLICATE KEY UPDATE
  name = VALUES(name), description = VALUES(description), service_id = VALUES(service_id),
  branch_id = VALUES(branch_id), requires_eligibility = VALUES(requires_eligibility),
  second_factor = VALUES(second_factor), session_date = VALUES(session_date),
  starts_at = VALUES(starts_at), ends_at = VALUES(ends_at), capacity = VALUES(capacity),
  registration_opens_at = VALUES(registration_opens_at),
  registration_closes_at = VALUES(registration_closes_at),
  arrive_minutes_before = VALUES(arrive_minutes_before), status = VALUES(status);

-- The approved list for the loan clinic: the bank's own pre-approval
-- references. Only these people can take a place.
DELETE FROM session_cause_list WHERE session_id = 'ses-lgb-sat-loans';
INSERT INTO session_cause_list (id, session_id, reference, reference_key, party_surname, division, appointment_time)
VALUES
  ('cl-lgb-01', 'ses-lgb-sat-loans', 'PA-26-1041', 'PA261041', 'Campbell',  'Lending Desk', '10:00:00'),
  ('cl-lgb-02', 'ses-lgb-sat-loans', 'PA-26-1042', 'PA261042', 'Williams',  'Lending Desk', '10:15:00'),
  ('cl-lgb-03', 'ses-lgb-sat-loans', 'PA-26-1043', 'PA261043', 'Brown',     'Lending Desk', '10:30:00'),
  ('cl-lgb-04', 'ses-lgb-sat-loans', 'PA-26-1044', 'PA261044', 'McKenzie',  'Lending Desk', '10:45:00'),
  ('cl-lgb-05', 'ses-lgb-sat-loans', 'PA-26-1045', 'PA261045', 'Thompson',  'Lending Desk', '11:00:00'),
  ('cl-lgb-06', 'ses-lgb-sat-loans', 'PA-26-1046', 'PA261046', 'Robinson',  'Lending Desk', '11:15:00'),
  ('cl-lgb-07', 'ses-lgb-sat-loans', 'PA-26-1047', 'PA261047', 'Clarke',    'Lending Desk', '11:30:00'),
  ('cl-lgb-08', 'ses-lgb-sat-loans', 'PA-26-1048', 'PA261048', 'Johnson',   'Lending Desk', '11:45:00'),
  ('cl-lgb-09', 'ses-lgb-sat-loans', 'PA-26-1049', 'PA261049', 'Reid',      'Lending Desk', '12:00:00'),
  ('cl-lgb-10', 'ses-lgb-sat-loans', 'PA-26-1050', 'PA261050', 'Stewart',   'Lending Desk', '12:15:00'),
  ('cl-lgb-11', 'ses-lgb-sat-loans', 'PA-26-1051', 'PA261051', 'Morgan',    'Lending Desk', '12:30:00'),
  ('cl-lgb-12', 'ses-lgb-sat-loans', 'PA-26-1052', 'PA261052', 'Gordon',    'Lending Desk', '12:45:00');

-- Seven of the twelve have reserved; five places left on the list, so the demo
-- can register one more live with PA-26-1052 / Gordon (12:45 appointment).
-- Each list entry carries the client's appointment time (migration 042).
DELETE FROM session_registrations WHERE id LIKE 'reg-lgb-%';
INSERT INTO session_registrations
  (id, session_id, user_id, guest_name, guest_phone, reference, appointment_time, verified, registration_code, registered_at, status)
VALUES
  ('reg-lgb-loan-01', 'ses-lgb-sat-loans', NULL, 'Andrea Campbell',  '876-555-1041', 'PA-26-1041', '10:00:00', 1, 'LGBK4M', DATE_SUB(NOW(), INTERVAL 5 DAY), 'registered'),
  ('reg-lgb-loan-02', 'ses-lgb-sat-loans', NULL, 'Kevin Williams',   '876-555-1042', 'PA-26-1042', '10:15:00', 1, 'LGBQ7D', DATE_SUB(NOW(), INTERVAL 4 DAY), 'registered'),
  ('reg-lgb-loan-03', 'ses-lgb-sat-loans', NULL, 'Tanya Brown',      '876-555-1043', 'PA-26-1043', '10:30:00', 1, 'LGBN3R', DATE_SUB(NOW(), INTERVAL 4 DAY), 'registered'),
  ('reg-lgb-loan-04', 'ses-lgb-sat-loans', NULL, 'Garfield McKenzie','876-555-1044', 'PA-26-1044', '10:45:00', 1, 'LGBC9F', DATE_SUB(NOW(), INTERVAL 3 DAY), 'registered'),
  ('reg-lgb-loan-05', 'ses-lgb-sat-loans', NULL, 'Sherika Thompson', '876-555-1045', 'PA-26-1045', '11:00:00', 1, 'LGBM4K', DATE_SUB(NOW(), INTERVAL 2 DAY), 'registered'),
  ('reg-lgb-loan-06', 'ses-lgb-sat-loans', NULL, 'Dale Robinson',    '876-555-1046', 'PA-26-1046', '11:15:00', 1, 'LGBD7Q', DATE_SUB(NOW(), INTERVAL 1 DAY), 'registered'),
  ('reg-lgb-loan-07', 'ses-lgb-sat-loans', NULL, 'Marsha Clarke',    '876-555-1047', 'PA-26-1047', '11:30:00', 1, 'LGBR3N', DATE_SUB(NOW(), INTERVAL 1 DAY), 'registered');

INSERT INTO session_registrations
  (id, session_id, user_id, guest_name, guest_phone, reference, registration_code, registered_at, status)
SELECT
  CONCAT('reg-lgb-sat-', LPAD(seq.n, 3, '0')),
  'ses-lgb-sat-bank',
  NULL,
  ELT(1 + MOD(seq.n, 10),
      'Errol Bailey','Donna Wright','Kirk Allen','Patrice Gayle','Leroy Smith',
      'Nicola Barrett','Wayne Hall','Simone Ennis','Courtney Daley','Yvonne Dixon'),
  CONCAT('876-', LPAD(300 + seq.n, 3, '0'), '-', LPAD(2000 + seq.n * 11, 4, '0')),
  NULL,
  UPPER(SUBSTRING(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(MD5(CONCAT('lgb:', seq.n)),'0','K'),'1','M'),'2','N'),'5','P'),'8','Q'),'b','R'), 1, 6)),
  DATE_SUB(NOW(), INTERVAL MOD(seq.n, 4) DAY),
  'registered'
FROM (SELECT (a.d + b.d * 10) + 1 AS n FROM
        (SELECT 0 d UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4
         UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) a,
        (SELECT 0 d UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4
         UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) b
      ) seq
WHERE seq.n <= 62;

-- =============================================================
-- Personal Banking appointments, every weekday (migration 042)
--
-- Today's account-opening bookings at Half Way Tree, one every half hour from
-- 09:00 to 15:30, as the bank's booking tool would export them. Check-in opens
-- 15 minutes before a slot and holds it 10 minutes after, so at almost any
-- time of the day one of these is checkable-in on time. Codes are PBK-HHMM
-- (e.g. PBK-1030 for the 10:30) so the demo can type one from memory.
-- =============================================================
INSERT INTO scheduled_sessions
  (id, business_id, branch_id, service_id, name, description,
   venue_name, venue_address, session_date, starts_at, ends_at,
   capacity, requires_eligibility, second_factor,
   registration_opens_at, registration_closes_at,
   arrive_minutes_before, appointment_early_minutes, appointment_late_minutes, status)
VALUES
  ('ses-lgb-appts', 'biz-lgb-001', 'br-lgb-hwt', 'svc-lgb-acct',
   'Personal Banking Appointments — Half Way Tree',
   'Booked account-opening appointments. Check in when you arrive and you will be called at your time, ahead of walk-ins.',
   NULL, NULL, CURDATE(), '09:00:00', '16:00:00', 14, 1, 'surname',
   DATE_SUB(NOW(), INTERVAL 7 DAY), DATE_ADD(NOW(), INTERVAL 8 HOUR), 10, 15, 10, 'open')
ON DUPLICATE KEY UPDATE
  name = VALUES(name), description = VALUES(description), session_date = VALUES(session_date),
  starts_at = VALUES(starts_at), ends_at = VALUES(ends_at), capacity = VALUES(capacity),
  requires_eligibility = VALUES(requires_eligibility), second_factor = VALUES(second_factor),
  registration_opens_at = VALUES(registration_opens_at), registration_closes_at = VALUES(registration_closes_at),
  appointment_early_minutes = VALUES(appointment_early_minutes),
  appointment_late_minutes = VALUES(appointment_late_minutes), status = VALUES(status);

DELETE FROM session_cause_list WHERE session_id = 'ses-lgb-appts';
DELETE FROM session_registrations WHERE session_id = 'ses-lgb-appts';
INSERT INTO session_cause_list (id, session_id, reference, reference_key, party_surname, division, appointment_time)
SELECT CONCAT('cl-lgb-appt-', LPAD(seq.n, 2, '0')), 'ses-lgb-appts',
       CONCAT('BK-26-', 2000 + seq.n), CONCAT('BK26', 2000 + seq.n),
       ELT(seq.n, 'Allen','Bailey','Barrett','Daley','Dixon','Ennis','Gayle','Hall','Lewis','Miller','Palmer','Smith','Spence','Wright'),
       'Personal Banking',
       SEC_TO_TIME((540 + (seq.n - 1) * 30) * 60)
FROM (SELECT 1 n UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7
      UNION SELECT 8 UNION SELECT 9 UNION SELECT 10 UNION SELECT 11 UNION SELECT 12 UNION SELECT 13 UNION SELECT 14) seq;

INSERT INTO session_registrations
  (id, session_id, user_id, guest_name, guest_phone, reference, appointment_time, verified, registration_code, registered_at, status)
SELECT CONCAT('reg-lgb-appt-', LPAD(seq.n, 2, '0')), 'ses-lgb-appts', NULL,
       CONCAT(ELT(seq.n, 'Marcia','Errol','Nicola','Courtney','Yvonne','Simone','Patrice','Wayne','Tanisha','Gary','Joan','Leroy','Kerry-Ann','Donna'), ' ',
              ELT(seq.n, 'Allen','Bailey','Barrett','Daley','Dixon','Ennis','Gayle','Hall','Lewis','Miller','Palmer','Smith','Spence','Wright')),
       CONCAT('876-555-', 2000 + seq.n),
       CONCAT('BK-26-', 2000 + seq.n),
       SEC_TO_TIME((540 + (seq.n - 1) * 30) * 60),
       1,
       CONCAT('PBK-', DATE_FORMAT(SEC_TO_TIME((540 + (seq.n - 1) * 30) * 60), '%H%i')),
       DATE_SUB(NOW(), INTERVAL 2 DAY),
       'registered'
FROM (SELECT 1 n UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7
      UNION SELECT 8 UNION SELECT 9 UNION SELECT 10 UNION SELECT 11 UNION SELECT 12 UNION SELECT 13 UNION SELECT 14) seq;

INSERT INTO saved_businesses (user_id, business_id)
SELECT id, 'biz-lgb-001' FROM users WHERE id LIKE 'usr-demo-%' OR id = 'usr-test-mobile'
ON DUPLICATE KEY UPDATE saved_at = saved_at;

-- =============================================================
-- History: four weeks of finished visits by registered clients
--
-- So Client Cases and the Customers directory have people in them, and every
-- teller and officer (the demo.*@uselyne.com personas included) has a served
-- history. Seven clients carry the stories a bank recognises: sent home three
-- times for documents, a pensioner whose payment is held, a card dispute
-- bounced between desks, a loan applicant, a returnee re-verifying identity, a
-- busy business owner who is fine, and repeated remittance outages.
--
-- Generated (deterministic) by a script; dates are relative to the day the
-- seed runs. Visits attach to whatever line exists for that branch, service and
-- day, so a line the server opened on its own that day is reused, not clashed.
-- Fictional people; emails use the reserved example domain.
-- =============================================================

-- The three demo officer personas served some of this history. On a fresh
-- demo database they do not exist until scripts/demo-switch.sh runs, so create
-- them here as Lignum staff if missing; demo-switch takes over from there.
INSERT IGNORE INTO staff (id, business_id, branch_id, role_id, staff_code, full_name, email, assigned_service_id, availability_status, is_active) VALUES
  ('stf-review-demo-ln1', 'biz-lgb-001', 'br-lgb-hwt', 'role-staff-001', 'DEMO-STAFF-001', 'Shanelle Grant', 'demo.officer@uselyne.com',  'svc-lgb-teller', 'active', TRUE),
  ('stf-review-demo-ln2', 'biz-lgb-001', 'br-lgb-hwt', 'role-staff-001', 'DEMO-STAFF-002', 'Marcus Walters', 'demo.officer2@uselyne.com', 'svc-lgb-acct',   'active', TRUE),
  ('stf-review-demo-ln3', 'biz-lgb-001', 'br-lgb-nkg', 'role-staff-001', 'DEMO-STAFF-003', 'Alicia Bryan',   'demo.officer3@uselyne.com', 'svc-lgb-teller', 'active', TRUE);

INSERT INTO users (id, email, full_name, phone) VALUES
  ('usr-lgb-c01', 'kerry-ann.thompson@client.lignum.example', 'Kerry-Ann Thompson', '876-555-4001'),
  ('usr-lgb-c02', 'beverley.walters@client.lignum.example', 'Beverley Walters', '876-555-4002'),
  ('usr-lgb-c03', 'oneil.bryan@client.lignum.example', 'Oneil Bryan', '876-555-4003'),
  ('usr-lgb-c04', 'tamara.lewis@client.lignum.example', 'Tamara Lewis', '876-555-4004'),
  ('usr-lgb-c05', 'winston.clarke@client.lignum.example', 'Winston Clarke', '876-555-4005'),
  ('usr-lgb-c06', 'shernette.palmer@client.lignum.example', 'Shernette Palmer', '876-555-4006'),
  ('usr-lgb-c07', 'desmond.reid@client.lignum.example', 'Desmond Reid', '876-555-4007'),
  ('usr-lgb-c08', 'andre.gayle@client.lignum.example', 'Andre Gayle', '876-555-4008'),
  ('usr-lgb-c09', 'nadia.blake@client.lignum.example', 'Nadia Blake', '876-555-4009'),
  ('usr-lgb-c10', 'kemar.wisdom@client.lignum.example', 'Kemar Wisdom', '876-555-4010'),
  ('usr-lgb-c11', 'simone.case@client.lignum.example', 'Simone Case', '876-555-4011'),
  ('usr-lgb-c12', 'racquel.dixon@client.lignum.example', 'Racquel Dixon', '876-555-4012'),
  ('usr-lgb-c13', 'garfield.mckenzie@client.lignum.example', 'Garfield McKenzie', '876-555-4013'),
  ('usr-lgb-c14', 'sherika.morgan@client.lignum.example', 'Sherika Morgan', '876-555-4014'),
  ('usr-lgb-c15', 'dale.robinson@client.lignum.example', 'Dale Robinson', '876-555-4015'),
  ('usr-lgb-c16', 'marsha.stewart@client.lignum.example', 'Marsha Stewart', '876-555-4016'),
  ('usr-lgb-c17', 'kevin.williams@client.lignum.example', 'Kevin Williams', '876-555-4017'),
  ('usr-lgb-c18', 'tanya.brown@client.lignum.example', 'Tanya Brown', '876-555-4018'),
  ('usr-lgb-c19', 'patrice.hall@client.lignum.example', 'Patrice Hall', '876-555-4019'),
  ('usr-lgb-c20', 'leroy.smith@client.lignum.example', 'Leroy Smith', '876-555-4020'),
  ('usr-lgb-c21', 'nicola.barrett@client.lignum.example', 'Nicola Barrett', '876-555-4021'),
  ('usr-lgb-c22', 'courtney.daley@client.lignum.example', 'Courtney Daley', '876-555-4022'),
  ('usr-lgb-c23', 'yvonne.ennis@client.lignum.example', 'Yvonne Ennis', '876-555-4023'),
  ('usr-lgb-c24', 'errol.bailey@client.lignum.example', 'Errol Bailey', '876-555-4024'),
  ('usr-lgb-c25', 'donna.wright@client.lignum.example', 'Donna Wright', '876-555-4025'),
  ('usr-lgb-c26', 'kirk.allen@client.lignum.example', 'Kirk Allen', '876-555-4026'),
  ('usr-lgb-c27', 'wayne.henry@client.lignum.example', 'Wayne Henry', '876-555-4027'),
  ('usr-lgb-c28', 'janelle.grant@client.lignum.example', 'Janelle Grant', '876-555-4028'),
  ('usr-lgb-c29', 'ricardo.spence@client.lignum.example', 'Ricardo Spence', '876-555-4029'),
  ('usr-lgb-c30', 'monique.francis@client.lignum.example', 'Monique Francis', '876-555-4030')
ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), phone = VALUES(phone);

DROP TEMPORARY TABLE IF EXISTS _lgb_hist;
CREATE TEMPORARY TABLE _lgb_hist (
  tid VARCHAR(36), user_id VARCHAR(36), branch_id VARCHAR(36), service_id VARCHAR(36), prefix VARCHAR(5),
  d INT, hh TIME, wait_min INT, svc_min INT, status VARCHAR(20), closed_reason VARCHAR(40), note VARCHAR(255),
  staff_id VARCHAR(36), counter_id VARCHAR(36), channel VARCHAR(10), code VARCHAR(6), pos INT);
INSERT INTO _lgb_hist VALUES
  ('t-lgbh-0001', 'usr-lgb-c18', 'br-lgb-nkg', 'svc-lgb-teller', 'TEL', 26, '11:05:00', 10, 3, 'served', NULL, NULL, 'stf-lgb-nkg-tel1', 'ctr-lgb-nkg-tel-1', 'app', 'KWMKH3', 201),
  ('t-lgbh-0002', 'usr-lgb-c06', 'br-lgb-nkg', 'svc-lgb-biz', 'BIZ', 26, '11:25:00', 17, 21, 'served', NULL, NULL, 'stf-review-demo-ln3', 'ctr-lgb-nkg-biz', 'walk_in', 'FGWQN6', 202),
  ('t-lgbh-0003', 'usr-lgb-c20', 'br-lgb-hwt', 'svc-lgb-loan', 'LON', 26, '14:05:00', 32, 43, 'served', NULL, NULL, 'stf-lgb-hwt-lend', 'ctr-lgb-hwt-loan', 'walk_in', 'UP9H77', 203),
  ('t-lgbh-0004', 'usr-lgb-c08', 'br-lgb-mob', 'svc-lgb-teller', 'TEL', 25, '09:25:00', 26, 8, 'served', NULL, NULL, 'stf-lgb-mob-tel1', 'ctr-lgb-mob-tel-1', 'app', 'QN3YGE', 204),
  ('t-lgbh-0005', 'usr-lgb-c30', 'br-lgb-nkg', 'svc-lgb-teller', 'TEL', 24, '12:25:00', 6, 10, 'served', NULL, NULL, 'stf-review-demo-ln3', 'ctr-lgb-nkg-tel-2', 'app', 'RQVFJF', 205),
  ('t-lgbh-0006', 'usr-lgb-c04', 'br-lgb-hwt', 'svc-lgb-loan', 'LON', 24, '13:15:00', 10, 40, 'served', 'wrong_documents', 'Only two of the three payslips.', 'stf-lgb-hwt-lend', 'ctr-lgb-hwt-loan', 'app', 'DWAP6U', 206),
  ('t-lgbh-0007', 'usr-lgb-c11', 'br-lgb-mob', 'svc-lgb-teller', 'TEL', 24, '13:15:00', 14, 6, 'served', NULL, NULL, 'stf-lgb-mob-tel1', 'ctr-lgb-mob-tel-1', 'walk_in', 'MRTRW6', 207),
  ('t-lgbh-0008', 'usr-lgb-c29', 'br-lgb-hwt', 'svc-lgb-teller', 'TEL', 23, '11:50:00', 47, 7, 'no_show', NULL, NULL, NULL, NULL, 'app', '6JYHWT', 208),
  ('t-lgbh-0009', 'usr-lgb-c09', 'br-lgb-hwt', 'svc-lgb-teller', 'TEL', 23, '14:40:00', 22, 3, 'served', NULL, NULL, 'stf-lgb-hwt-tel1', 'ctr-lgb-hwt-tel-1', 'kiosk', '7CU4MW', 209),
  ('t-lgbh-0010', 'usr-lgb-c12', 'br-lgb-mob', 'svc-lgb-teller', 'TEL', 22, '10:05:00', 42, 10, 'served', NULL, NULL, 'stf-lgb-mob-tel1', 'ctr-lgb-mob-tel-1', 'walk_in', 'WFXGJX', 210),
  ('t-lgbh-0011', 'usr-lgb-c30', 'br-lgb-nkg', 'svc-lgb-teller', 'TEL', 22, '12:15:00', 12, 9, 'served', NULL, NULL, 'stf-lgb-nkg-tel1', 'ctr-lgb-nkg-tel-1', 'kiosk', 'EATNP4', 211),
  ('t-lgbh-0012', 'usr-lgb-c14', 'br-lgb-nkg', 'svc-lgb-biz', 'BIZ', 22, '14:05:00', 32, 20, 'served', NULL, NULL, 'stf-review-demo-ln3', 'ctr-lgb-nkg-biz', 'walk_in', 'KM7UPE', 212),
  ('t-lgbh-0013', 'usr-lgb-c05', 'br-lgb-hwt', 'svc-lgb-enq', 'ENQ', 22, '14:50:00', 31, 14, 'served', 'wrong_documents', 'Overseas address not accepted as proof of address.', 'stf-review-demo-ln2', 'ctr-lgb-hwt-enq', 'kiosk', 'KYUMFF', 213),
  ('t-lgbh-0014', 'usr-lgb-c29', 'br-lgb-hwt', 'svc-lgb-teller', 'TEL', 21, '11:05:00', 20, 2, 'served', NULL, NULL, 'stf-review-demo-ln1', 'ctr-lgb-hwt-tel-3', 'app', 'NAK7NE', 214),
  ('t-lgbh-0015', 'usr-lgb-c10', 'br-lgb-hwt', 'svc-lgb-teller', 'TEL', 20, '09:15:00', 33, 10, 'served', NULL, NULL, 'stf-lgb-hwt-tel1', 'ctr-lgb-hwt-tel-1', 'walk_in', 'V3Y9NY', 215),
  ('t-lgbh-0016', 'usr-lgb-c27', 'br-lgb-mob', 'svc-lgb-acct', 'ACC', 20, '10:25:00', 18, 30, 'no_show', NULL, NULL, NULL, NULL, 'kiosk', '76TAX9', 216),
  ('t-lgbh-0017', 'usr-lgb-c01', 'br-lgb-hwt', 'svc-lgb-acct', 'ACC', 20, '11:05:00', 8, 29, 'served', 'wrong_documents', 'Proof of address was older than three months.', 'stf-lgb-hwt-pbo', 'ctr-lgb-hwt-acct', 'app', 'UWY4F9', 217),
  ('t-lgbh-0018', 'usr-lgb-c14', 'br-lgb-nkg', 'svc-lgb-biz', 'BIZ', 20, '11:50:00', 17, 17, 'served', NULL, NULL, 'stf-lgb-nkg-tel1', 'ctr-lgb-nkg-biz', 'app', 'GNTRAK', 218),
  ('t-lgbh-0019', 'usr-lgb-c24', 'br-lgb-hwt', 'svc-lgb-loan', 'LON', 20, '12:50:00', 28, 42, 'served', NULL, NULL, 'stf-lgb-hwt-lend', 'ctr-lgb-hwt-loan', 'app', 'XEUHXA', 219),
  ('t-lgbh-0020', 'usr-lgb-c20', 'br-lgb-mob', 'svc-lgb-acct', 'ACC', 19, '14:25:00', 29, 33, 'no_show', NULL, NULL, NULL, NULL, 'walk_in', 'JRCW7T', 220),
  ('t-lgbh-0021', 'usr-lgb-c06', 'br-lgb-nkg', 'svc-lgb-biz', 'BIZ', 19, '14:50:00', 7, 17, 'served', NULL, NULL, 'stf-review-demo-ln3', 'ctr-lgb-nkg-biz', 'walk_in', 'PC7E76', 221),
  ('t-lgbh-0022', 'usr-lgb-c03', 'br-lgb-hwt', 'svc-lgb-card', 'CRD', 18, '10:50:00', 22, 10, 'served', 'referred_elsewhere', 'Sent to Account Enquiries to raise the dispute.', 'stf-review-demo-ln1', 'ctr-lgb-hwt-card', 'app', 'YTYTMV', 222),
  ('t-lgbh-0023', 'usr-lgb-c21', 'br-lgb-nkg', 'svc-lgb-acct', 'ACC', 17, '10:15:00', 39, 31, 'served', NULL, NULL, 'stf-lgb-nkg-tel1', 'ctr-lgb-nkg-acct', 'walk_in', 'ERRV4V', 223),
  ('t-lgbh-0024', 'usr-lgb-c12', 'br-lgb-hwt', 'svc-lgb-acct', 'ACC', 17, '12:05:00', 11, 30, 'no_show', NULL, NULL, NULL, NULL, 'app', '9UD4RX', 224),
  ('t-lgbh-0025', 'usr-lgb-c04', 'br-lgb-hwt', 'svc-lgb-loan', 'LON', 17, '12:40:00', 40, 44, 'served', 'wrong_documents', 'Job letter was older than 30 days.', 'stf-lgb-hwt-lend', 'ctr-lgb-hwt-loan', 'app', 'MAE4JD', 225),
  ('t-lgbh-0026', 'usr-lgb-c19', 'br-lgb-hwt', 'svc-lgb-teller', 'TEL', 17, '13:50:00', 40, 7, 'served', NULL, NULL, 'stf-review-demo-ln1', 'ctr-lgb-hwt-tel-3', 'walk_in', 'AYKEFV', 226),
  ('t-lgbh-0027', 'usr-lgb-c26', 'br-lgb-hwt', 'svc-lgb-card', 'CRD', 17, '14:50:00', 33, 14, 'served', NULL, NULL, 'stf-review-demo-ln1', 'ctr-lgb-hwt-card', 'kiosk', 'FDYYG7', 227),
  ('t-lgbh-0028', 'usr-lgb-c24', 'br-lgb-hwt', 'svc-lgb-acct', 'ACC', 16, '12:50:00', 20, 34, 'served', NULL, NULL, 'stf-review-demo-ln2', 'ctr-lgb-hwt-acct', 'app', 'Q4RKWN', 228),
  ('t-lgbh-0029', 'usr-lgb-c16', 'br-lgb-hwt', 'svc-lgb-acct', 'ACC', 16, '13:25:00', 25, 29, 'served', 'wrong_documents', 'Proof of address was older than three months.', 'stf-review-demo-ln2', 'ctr-lgb-hwt-acct', 'kiosk', '6CVPG9', 229),
  ('t-lgbh-0030', 'usr-lgb-c28', 'br-lgb-nkg', 'svc-lgb-loan', 'LON', 16, '14:50:00', 15, 44, 'served', 'wrong_documents', 'Proof of address was older than three months.', 'stf-lgb-nkg-tel1', 'ctr-lgb-nkg-loan', 'walk_in', 'TQHUNW', 230),
  ('t-lgbh-0031', 'usr-lgb-c05', 'br-lgb-hwt', 'svc-lgb-enq', 'ENQ', 15, '09:40:00', 16, 16, 'served', 'referred_elsewhere', 'Sent to Personal Banking to re-verify identity.', 'stf-lgb-hwt-pbo', 'ctr-lgb-hwt-enq', 'app', 'JEWQVX', 231),
  ('t-lgbh-0032', 'usr-lgb-c30', 'br-lgb-hwt', 'svc-lgb-loan', 'LON', 15, '10:15:00', 42, 44, 'served', NULL, NULL, 'stf-lgb-hwt-lend', 'ctr-lgb-hwt-loan', 'app', 'JH49A9', 232),
  ('t-lgbh-0033', 'usr-lgb-c12', 'br-lgb-hwt', 'svc-lgb-acct', 'ACC', 15, '11:05:00', 21, 35, 'served', 'wrong_documents', 'Proof of address was older than three months.', 'stf-review-demo-ln2', 'ctr-lgb-hwt-acct', 'walk_in', '9KN76D', 233),
  ('t-lgbh-0034', 'usr-lgb-c19', 'br-lgb-hwt', 'svc-lgb-teller', 'TEL', 15, '11:05:00', 18, 5, 'served', NULL, NULL, 'stf-lgb-hwt-tel1', 'ctr-lgb-hwt-tel-1', 'app', 'MTFK6F', 234),
  ('t-lgbh-0035', 'usr-lgb-c16', 'br-lgb-nkg', 'svc-lgb-loan', 'LON', 15, '11:25:00', 26, 36, 'served', NULL, NULL, 'stf-lgb-nkg-tel1', 'ctr-lgb-nkg-loan', 'app', 'DPC4P6', 235),
  ('t-lgbh-0036', 'usr-lgb-c03', 'br-lgb-hwt', 'svc-lgb-enq', 'ENQ', 15, '12:25:00', 9, 12, 'served', 'wrong_service', 'Disputes are handled at Card Services.', 'stf-review-demo-ln2', 'ctr-lgb-hwt-enq', 'app', 'TCEKP3', 236),
  ('t-lgbh-0037', 'usr-lgb-c13', 'br-lgb-nkg', 'svc-lgb-loan', 'LON', 14, '12:05:00', 34, 42, 'served', NULL, NULL, 'stf-lgb-nkg-tel1', 'ctr-lgb-nkg-loan', 'app', 'FRDE6V', 237),
  ('t-lgbh-0038', 'usr-lgb-c11', 'br-lgb-hwt', 'svc-lgb-teller', 'TEL', 13, '10:25:00', 15, 4, 'served', NULL, NULL, 'stf-lgb-hwt-tel2', 'ctr-lgb-hwt-tel-2', 'app', 'PJNQCT', 238),
  ('t-lgbh-0039', 'usr-lgb-c01', 'br-lgb-hwt', 'svc-lgb-acct', 'ACC', 13, '12:25:00', 37, 29, 'served', 'wrong_documents', 'Client did not have a TRN card or copy.', 'stf-lgb-hwt-pbo', 'ctr-lgb-hwt-acct', 'kiosk', 'FNXNMN', 239),
  ('t-lgbh-0040', 'usr-lgb-c09', 'br-lgb-nkg', 'svc-lgb-acct', 'ACC', 13, '14:05:00', 40, 31, 'served', 'wrong_documents', 'Proof of address was older than three months.', 'stf-lgb-nkg-tel1', 'ctr-lgb-nkg-acct', 'walk_in', 'RTUCH7', 240),
  ('t-lgbh-0041', 'usr-lgb-c16', 'br-lgb-mob', 'svc-lgb-teller', 'TEL', 12, '10:15:00', 37, 6, 'served', 'wrong_documents', 'Proof of address was older than three months.', 'stf-lgb-mob-tel1', 'ctr-lgb-mob-tel-1', 'app', 'RC3XG9', 241),
  ('t-lgbh-0042', 'usr-lgb-c06', 'br-lgb-nkg', 'svc-lgb-loan', 'LON', 12, '10:25:00', 15, 36, 'served', NULL, NULL, 'stf-lgb-nkg-tel1', 'ctr-lgb-nkg-loan', 'app', 'XMJY9U', 242),
  ('t-lgbh-0043', 'usr-lgb-c12', 'br-lgb-hwt', 'svc-lgb-teller', 'TEL', 12, '13:15:00', 48, 4, 'served', NULL, NULL, 'stf-review-demo-ln1', 'ctr-lgb-hwt-tel-3', 'app', 'YFQYTP', 243),
  ('t-lgbh-0044', 'usr-lgb-c03', 'br-lgb-hwt', 'svc-lgb-card', 'CRD', 11, '11:50:00', 44, 12, 'served', 'system_issue', 'Dispute system unavailable.', 'stf-review-demo-ln1', 'ctr-lgb-hwt-card', 'kiosk', 'HW6GRX', 244),
  ('t-lgbh-0045', 'usr-lgb-c28', 'br-lgb-nkg', 'svc-lgb-acct', 'ACC', 10, '10:15:00', 38, 35, 'served', NULL, NULL, 'stf-lgb-nkg-tel1', 'ctr-lgb-nkg-acct', 'app', '7M933M', 245),
  ('t-lgbh-0046', 'usr-lgb-c07', 'br-lgb-nkg', 'svc-lgb-teller', 'TEL', 10, '12:15:00', 42, 6, 'served', 'system_issue', 'Wire transfer system unavailable.', 'stf-lgb-nkg-tel1', 'ctr-lgb-nkg-tel-1', 'app', 'HNXHNP', 246),
  ('t-lgbh-0047', 'usr-lgb-c08', 'br-lgb-hwt', 'svc-lgb-loan', 'LON', 10, '13:25:00', 24, 37, 'served', NULL, NULL, 'stf-lgb-hwt-lend', 'ctr-lgb-hwt-loan', 'walk_in', 'M9HFTP', 247),
  ('t-lgbh-0048', 'usr-lgb-c17', 'br-lgb-hwt', 'svc-lgb-card', 'CRD', 10, '14:15:00', 11, 17, 'served', NULL, NULL, 'stf-lgb-hwt-tel2', 'ctr-lgb-hwt-card', 'kiosk', 'RVXNYY', 248),
  ('t-lgbh-0049', 'usr-lgb-c29', 'br-lgb-hwt', 'svc-lgb-teller', 'TEL', 9, '10:15:00', 26, 2, 'served', NULL, NULL, 'stf-review-demo-ln1', 'ctr-lgb-hwt-tel-3', 'kiosk', 'NRQ6QW', 249),
  ('t-lgbh-0050', 'usr-lgb-c26', 'br-lgb-hwt', 'svc-lgb-acct', 'ACC', 9, '10:40:00', 27, 32, 'served', 'wrong_documents', 'Proof of address was older than three months.', 'stf-lgb-hwt-pbo', 'ctr-lgb-hwt-acct', 'app', 'RPKCXQ', 250),
  ('t-lgbh-0051', 'usr-lgb-c07', 'br-lgb-nkg', 'svc-lgb-teller', 'TEL', 9, '10:50:00', 20, 6, 'served', 'system_issue', 'Wire transfer system unavailable.', 'stf-review-demo-ln3', 'ctr-lgb-nkg-tel-2', 'app', '3UVQC6', 251),
  ('t-lgbh-0052', 'usr-lgb-c04', 'br-lgb-hwt', 'svc-lgb-loan', 'LON', 9, '12:05:00', 38, 37, 'left', 'customer_left', NULL, 'stf-lgb-hwt-lend', 'ctr-lgb-hwt-loan', 'app', 'QFYJM3', 252),
  ('t-lgbh-0053', 'usr-lgb-c23', 'br-lgb-nkg', 'svc-lgb-loan', 'LON', 9, '13:15:00', 33, 35, 'no_show', NULL, NULL, NULL, NULL, 'walk_in', 'HHFY3J', 253),
  ('t-lgbh-0054', 'usr-lgb-c18', 'br-lgb-mob', 'svc-lgb-acct', 'ACC', 9, '13:40:00', 6, 30, 'served', NULL, NULL, 'stf-lgb-mob-tel1', 'ctr-lgb-mob-acct', 'walk_in', '4D3JPE', 254),
  ('t-lgbh-0055', 'usr-lgb-c05', 'br-lgb-hwt', 'svc-lgb-acct', 'ACC', 8, '12:05:00', 16, 29, 'served', 'wrong_documents', 'Passport expired; needs a current photo ID.', 'stf-lgb-hwt-pbo', 'ctr-lgb-hwt-acct', 'app', 'JYCJJW', 255),
  ('t-lgbh-0056', 'usr-lgb-c03', 'br-lgb-hwt', 'svc-lgb-card', 'CRD', 8, '12:25:00', 27, 12, 'served', 'referred_elsewhere', 'Escalated to the card disputes team.', 'stf-lgb-hwt-tel2', 'ctr-lgb-hwt-card', 'app', '7PEUWT', 256),
  ('t-lgbh-0057', 'usr-lgb-c09', 'br-lgb-nkg', 'svc-lgb-acct', 'ACC', 8, '13:40:00', 37, 31, 'no_show', NULL, NULL, NULL, NULL, 'kiosk', 'C4C9WU', 257),
  ('t-lgbh-0058', 'usr-lgb-c06', 'br-lgb-nkg', 'svc-lgb-teller', 'TEL', 7, '10:40:00', 23, 6, 'served', NULL, NULL, 'stf-lgb-nkg-tel1', 'ctr-lgb-nkg-tel-1', 'kiosk', 'HQDTME', 258),
  ('t-lgbh-0059', 'usr-lgb-c25', 'br-lgb-mob', 'svc-lgb-acct', 'ACC', 7, '13:40:00', 36, 35, 'served', NULL, NULL, 'stf-lgb-mob-tel1', 'ctr-lgb-mob-acct', 'walk_in', 'MVNNKX', 259),
  ('t-lgbh-0060', 'usr-lgb-c25', 'br-lgb-mob', 'svc-lgb-teller', 'TEL', 6, '09:15:00', 35, 5, 'served', NULL, NULL, 'stf-lgb-mob-tel1', 'ctr-lgb-mob-tel-1', 'app', 'JN3DXW', 260),
  ('t-lgbh-0061', 'usr-lgb-c02', 'br-lgb-hwt', 'svc-lgb-teller', 'TEL', 6, '09:50:00', 39, 10, 'served', 'system_issue', 'Pension payment not yet credited to the account.', 'stf-review-demo-ln1', 'ctr-lgb-hwt-tel-3', 'app', 'GXFFXM', 261),
  ('t-lgbh-0062', 'usr-lgb-c01', 'br-lgb-hwt', 'svc-lgb-acct', 'ACC', 6, '10:05:00', 20, 35, 'served', 'wrong_documents', 'Job letter was not on company letterhead.', 'stf-lgb-hwt-pbo', 'ctr-lgb-hwt-acct', 'app', 'XKM3PT', 262),
  ('t-lgbh-0063', 'usr-lgb-c08', 'br-lgb-hwt', 'svc-lgb-enq', 'ENQ', 6, '10:40:00', 41, 19, 'served', NULL, NULL, 'stf-review-demo-ln2', 'ctr-lgb-hwt-enq', 'walk_in', '4FFECJ', 263),
  ('t-lgbh-0064', 'usr-lgb-c13', 'br-lgb-hwt', 'svc-lgb-teller', 'TEL', 6, '10:50:00', 38, 6, 'served', NULL, NULL, 'stf-lgb-hwt-tel1', 'ctr-lgb-hwt-tel-1', 'app', 'WEKV6F', 264),
  ('t-lgbh-0065', 'usr-lgb-c28', 'br-lgb-mob', 'svc-lgb-teller', 'TEL', 6, '14:05:00', 24, 4, 'served', NULL, NULL, 'stf-lgb-mob-tel1', 'ctr-lgb-mob-tel-1', 'walk_in', '4HRYMC', 265),
  ('t-lgbh-0066', 'usr-lgb-c06', 'br-lgb-nkg', 'svc-lgb-biz', 'BIZ', 5, '09:15:00', 29, 15, 'served', 'wrong_documents', 'Board resolution for the new signatory was not signed.', 'stf-review-demo-ln3', 'ctr-lgb-nkg-biz', 'app', 'AMQ6HD', 266),
  ('t-lgbh-0067', 'usr-lgb-c11', 'br-lgb-hwt', 'svc-lgb-teller', 'TEL', 5, '09:40:00', 12, 8, 'served', NULL, NULL, 'stf-lgb-hwt-tel1', 'ctr-lgb-hwt-tel-1', 'kiosk', 'NN6W6U', 267),
  ('t-lgbh-0068', 'usr-lgb-c05', 'br-lgb-hwt', 'svc-lgb-acct', 'ACC', 5, '12:50:00', 15, 35, 'served', 'wrong_documents', 'Asked to bring certified copies of documents already uploaded online.', 'stf-lgb-hwt-pbo', 'ctr-lgb-hwt-acct', 'walk_in', 'YPCQAA', 268),
  ('t-lgbh-0069', 'usr-lgb-c21', 'br-lgb-nkg', 'svc-lgb-biz', 'BIZ', 5, '13:40:00', 7, 23, 'served', NULL, NULL, 'stf-review-demo-ln3', 'ctr-lgb-nkg-biz', 'walk_in', 'HF3QKN', 269),
  ('t-lgbh-0070', 'usr-lgb-c02', 'br-lgb-hwt', 'svc-lgb-teller', 'TEL', 4, '10:15:00', 43, 3, 'served', 'referred_elsewhere', 'Referred to the Accountant General about the held payment.', 'stf-lgb-hwt-tel2', 'ctr-lgb-hwt-tel-2', 'app', 'DX7QNP', 270),
  ('t-lgbh-0071', 'usr-lgb-c20', 'br-lgb-nkg', 'svc-lgb-biz', 'BIZ', 4, '10:50:00', 33, 16, 'served', NULL, NULL, 'stf-review-demo-ln3', 'ctr-lgb-nkg-biz', 'walk_in', 'GUW7R4', 271),
  ('t-lgbh-0072', 'usr-lgb-c04', 'br-lgb-hwt', 'svc-lgb-loan', 'LON', 4, '11:05:00', 12, 41, 'served', 'wrong_documents', 'Proof of address was in her spouse’s name.', 'stf-lgb-hwt-lend', 'ctr-lgb-hwt-loan', 'kiosk', 'VPXCV7', 272),
  ('t-lgbh-0073', 'usr-lgb-c22', 'br-lgb-hwt', 'svc-lgb-enq', 'ENQ', 4, '14:15:00', 20, 15, 'served', NULL, NULL, 'stf-review-demo-ln2', 'ctr-lgb-hwt-enq', 'app', 'HNJUWE', 273),
  ('t-lgbh-0074', 'usr-lgb-c21', 'br-lgb-hwt', 'svc-lgb-teller', 'TEL', 4, '14:40:00', 32, 5, 'served', NULL, NULL, 'stf-lgb-hwt-tel1', 'ctr-lgb-hwt-tel-1', 'walk_in', 'JJHQPE', 274),
  ('t-lgbh-0075', 'usr-lgb-c25', 'br-lgb-hwt', 'svc-lgb-acct', 'ACC', 3, '09:50:00', 6, 30, 'served', NULL, NULL, 'stf-review-demo-ln2', 'ctr-lgb-hwt-acct', 'app', 'UJYTQ9', 275),
  ('t-lgbh-0076', 'usr-lgb-c24', 'br-lgb-nkg', 'svc-lgb-biz', 'BIZ', 3, '11:25:00', 31, 24, 'served', NULL, NULL, 'stf-lgb-nkg-tel1', 'ctr-lgb-nkg-biz', 'kiosk', 'JVM67C', 276),
  ('t-lgbh-0077', 'usr-lgb-c03', 'br-lgb-hwt', 'svc-lgb-card', 'CRD', 3, '13:25:00', 33, 16, 'served', NULL, NULL, 'stf-lgb-hwt-tel2', 'ctr-lgb-hwt-card', 'kiosk', 'M66U9J', 277),
  ('t-lgbh-0078', 'usr-lgb-c07', 'br-lgb-nkg', 'svc-lgb-teller', 'TEL', 3, '14:40:00', 44, 8, 'served', 'system_issue', 'Remittance could not be released; system down.', 'stf-lgb-nkg-tel1', 'ctr-lgb-nkg-tel-1', 'kiosk', 'AKNCRV', 278),
  ('t-lgbh-0079', 'usr-lgb-c01', 'br-lgb-hwt', 'svc-lgb-acct', 'ACC', 2, '09:15:00', 23, 30, 'served', NULL, NULL, 'stf-review-demo-ln2', 'ctr-lgb-hwt-acct', 'walk_in', 'FACVP4', 279),
  ('t-lgbh-0080', 'usr-lgb-c29', 'br-lgb-hwt', 'svc-lgb-teller', 'TEL', 2, '10:15:00', 12, 8, 'served', NULL, NULL, 'stf-lgb-hwt-tel2', 'ctr-lgb-hwt-tel-2', 'kiosk', 'XAJY9Y', 280),
  ('t-lgbh-0081', 'usr-lgb-c06', 'br-lgb-nkg', 'svc-lgb-teller', 'TEL', 2, '11:25:00', 45, 6, 'served', NULL, NULL, 'stf-review-demo-ln3', 'ctr-lgb-nkg-tel-2', 'app', 'XMDC6D', 281),
  ('t-lgbh-0082', 'usr-lgb-c23', 'br-lgb-mob', 'svc-lgb-acct', 'ACC', 2, '11:50:00', 38, 32, 'served', NULL, NULL, 'stf-lgb-mob-tel1', 'ctr-lgb-mob-acct', 'walk_in', 'J3CVRU', 282),
  ('t-lgbh-0083', 'usr-lgb-c02', 'br-lgb-hwt', 'svc-lgb-teller', 'TEL', 2, '12:40:00', 19, 5, 'served', 'system_issue', 'Payment still showing as pending.', 'stf-lgb-hwt-tel1', 'ctr-lgb-hwt-tel-1', 'app', '3HRM74', 283),
  ('t-lgbh-0084', 'usr-lgb-c27', 'br-lgb-nkg', 'svc-lgb-loan', 'LON', 2, '12:40:00', 44, 44, 'served', NULL, NULL, 'stf-lgb-nkg-tel1', 'ctr-lgb-nkg-loan', 'kiosk', 'AXFURP', 284),
  ('t-lgbh-0085', 'usr-lgb-c09', 'br-lgb-hwt', 'svc-lgb-card', 'CRD', 1, '09:05:00', 40, 14, 'no_show', NULL, NULL, NULL, NULL, 'walk_in', 'PYYTYU', 285),
  ('t-lgbh-0086', 'usr-lgb-c15', 'br-lgb-hwt', 'svc-lgb-enq', 'ENQ', 1, '10:40:00', 14, 11, 'served', NULL, NULL, 'stf-lgb-hwt-pbo', 'ctr-lgb-hwt-enq', 'app', '9ETXQW', 286),
  ('t-lgbh-0087', 'usr-lgb-c27', 'br-lgb-mob', 'svc-lgb-acct', 'ACC', 1, '10:40:00', 11, 37, 'served', NULL, NULL, 'stf-lgb-mob-tel1', 'ctr-lgb-mob-acct', 'kiosk', 'WJ4GKD', 287),
  ('t-lgbh-0088', 'usr-lgb-c06', 'br-lgb-nkg', 'svc-lgb-biz', 'BIZ', 1, '11:50:00', 27, 16, 'served', NULL, NULL, 'stf-review-demo-ln3', 'ctr-lgb-nkg-biz', 'app', 'DFEEQ7', 288),
  ('t-lgbh-0089', 'usr-lgb-c20', 'br-lgb-hwt', 'svc-lgb-teller', 'TEL', 1, '12:40:00', 35, 4, 'served', NULL, NULL, 'stf-lgb-hwt-tel1', 'ctr-lgb-hwt-tel-1', 'app', '7CT69T', 289),
  ('t-lgbh-0090', 'usr-lgb-c07', 'br-lgb-nkg', 'svc-lgb-teller', 'TEL', 1, '13:15:00', 47, 7, 'served', NULL, NULL, 'stf-review-demo-ln3', 'ctr-lgb-nkg-tel-2', 'kiosk', '9UFGAY', 290),
  ('t-lgbh-0091', 'usr-lgb-c15', 'br-lgb-nkg', 'svc-lgb-loan', 'LON', 1, '14:05:00', 45, 37, 'served', NULL, NULL, 'stf-lgb-nkg-tel1', 'ctr-lgb-nkg-loan', 'app', 'RPGG9H', 291),
  ('t-lgbh-0092', 'usr-lgb-c23', 'br-lgb-nkg', 'svc-lgb-acct', 'ACC', 1, '14:15:00', 36, 36, 'served', NULL, NULL, 'stf-lgb-nkg-tel1', 'ctr-lgb-nkg-acct', 'kiosk', 'HWDHYN', 292);

-- Start clean: this section's own tickets, then its own lines. Line ids are
-- named by days-ago, so tomorrow's run must not find yesterday's ids taken.
DELETE FROM queue_tickets WHERE id LIKE 't-lgbh-%';
DELETE FROM queues WHERE id LIKE 'q-lgbh-%'
  AND NOT EXISTS (SELECT 1 FROM queue_tickets x WHERE x.queue_id = queues.id);

-- Lines for those days (reused when one already exists).
INSERT IGNORE INTO queues (id, branch_id, service_id, queue_date, max_capacity, is_active)
SELECT DISTINCT CONCAT('q-lgbh-', SUBSTRING(h.branch_id, 8), '-', SUBSTRING(h.service_id, 9), '-', h.d),
       h.branch_id, h.service_id, DATE_SUB(CURDATE(), INTERVAL h.d DAY), 80, FALSE
  FROM _lgb_hist h;

INSERT INTO queue_tickets
  (id, queue_id, user_id, ticket_number, verification_code, position, status, estimated_wait_minutes, channel,
   joined_at, called_at, started_serving_at, completed_at, served_by_staff_id, served_at_counter_id,
   closed_reason, readiness_shown_at, readiness_outcome, readiness_note)
SELECT h.tid, qq.id, h.user_id, CONCAT(h.prefix, '-H', LPAD(h.pos, 3, '0')), h.code, h.pos, h.status, h.wait_min, h.channel,
       TIMESTAMP(qq.queue_date, h.hh),
       TIMESTAMP(qq.queue_date, h.hh) + INTERVAL h.wait_min MINUTE,
       IF(h.status IN ('served','left'), TIMESTAMP(qq.queue_date, h.hh) + INTERVAL h.wait_min + 1 MINUTE, NULL),
       TIMESTAMP(qq.queue_date, h.hh) + INTERVAL h.wait_min + h.svc_min MINUTE,
       h.staff_id, h.counter_id,
       h.closed_reason,
       IF(h.service_id IN ('svc-lgb-acct','svc-lgb-loan'), TIMESTAMP(qq.queue_date, h.hh), NULL),
       IF(h.service_id IN ('svc-lgb-acct','svc-lgb-loan'),
          IF(h.closed_reason = 'wrong_documents', 'incomplete', 'ready'), 'not_checked'),
       h.note
  FROM _lgb_hist h
  JOIN queues qq ON qq.branch_id = h.branch_id AND qq.service_id = h.service_id
                AND qq.queue_date = DATE_SUB(CURDATE(), INTERVAL h.d DAY);
DROP TEMPORARY TABLE IF EXISTS _lgb_hist;

-- Two staff flags, so the case list shows what flagging looks like.
DELETE FROM patient_flags WHERE id LIKE 'pf-lgb-%';
INSERT INTO patient_flags (id, business_id, user_id, flag, note, set_by_staff_id, created_at) VALUES
  ('pf-lgb-01', 'biz-lgb-001', 'usr-lgb-c02', 'priority', 'Pensioner, 78. Pension payment held; Client Service lead is following up.', 'stf-lgb-hwt-mgr', NOW() - INTERVAL 2 DAY),
  ('pf-lgb-02', 'biz-lgb-001', 'usr-lgb-c03', 'watch', 'Disputed card charges; Card Services lead to call back.', 'stf-lgb-hwt-sup', NOW() - INTERVAL 3 DAY);

