SET NAMES utf8mb4;

-- =============================================================
-- Showcase organisation — Lignum Bank (fictional), PRODUCTION-SAFE
--
-- An example bank in the live app, beside Blue Harbour, so prospects can see
-- what Lyne looks like for a bank. Everything is invented: the bank, its
-- branches and addresses. Its description says it is fictional.
--
-- What this file is NOT (and why it may run on production when the demo
-- seeds may not): no logins and no staff, so nobody can sign in as Lignum and
-- the seven demo logins are untouched; no people in any line and no client
-- records; nothing outside its own rows ("biz-lgb-001", "br-lgb-*",
-- "svc-lgb-*", "ctr-lgb-*", "sec-lgb-*", "ses-lgb-show-*").
--
-- Lines are kept open and moving by the review simulator: add biz-lgb-001 to
-- REVIEW_SHOWCASE_IDS in .env. Past visits for Busy Times and Trends come from
-- apps/backend/scripts/seed-showcase-history.js.
--
-- Safe to rerun; rerun about monthly so Saturday Banking always has the next
-- four Saturdays. Generated from the organisation part of the demo seed
-- (database/demo_bank_seed.sql, staging), so the two stay alike.
-- Needs migrations 040, 041, 042 and 043.
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
  ('svc-lgb-teller', 'biz-lgb-001', 'Deposits & Withdrawals',
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

-- Sections of each branch (migration 043): what a supervisor runs. The
-- manager sees the whole branch; each supervisor sees only their section.
INSERT INTO branch_sections (id, branch_id, name) VALUES
  ('sec-lgb-hwt-teller',   'br-lgb-hwt', 'Teller Services'),
  ('sec-lgb-hwt-personal', 'br-lgb-hwt', 'Personal Banking'),
  ('sec-lgb-nkg-teller',   'br-lgb-nkg', 'Teller Services'),
  ('sec-lgb-nkg-business', 'br-lgb-nkg', 'Business & Personal Banking'),
  ('sec-lgb-mob-all',      'br-lgb-mob', 'Branch Services')
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT IGNORE INTO branch_section_services (section_id, service_id) VALUES
  ('sec-lgb-hwt-teller',   'svc-lgb-teller'), ('sec-lgb-hwt-teller',   'svc-lgb-card'),
  ('sec-lgb-hwt-personal', 'svc-lgb-acct'),   ('sec-lgb-hwt-personal', 'svc-lgb-loan'), ('sec-lgb-hwt-personal', 'svc-lgb-enq'),
  ('sec-lgb-nkg-teller',   'svc-lgb-teller'),
  ('sec-lgb-nkg-business', 'svc-lgb-acct'),   ('sec-lgb-nkg-business', 'svc-lgb-loan'), ('sec-lgb-nkg-business', 'svc-lgb-biz'),
  ('sec-lgb-mob-all',      'svc-lgb-teller'), ('sec-lgb-mob-all',      'svc-lgb-acct');


INSERT INTO business_targets
  (business_id, target_wait_minutes, target_completion_rate, target_no_show_rate, horizon_months, note, set_by_staff_id)
VALUES
  ('biz-lgb-001', 15, 90.00, 7.00, 6, 'Every client at the counter within 15 minutes, payday included.', NULL)
ON DUPLICATE KEY UPDATE
  target_wait_minutes = VALUES(target_wait_minutes), target_completion_rate = VALUES(target_completion_rate),
  target_no_show_rate = VALUES(target_no_show_rate), horizon_months = VALUES(horizon_months), note = VALUES(note);

INSERT INTO branch_targets
  (branch_id, business_id, target_wait_minutes, target_completion_rate, target_no_show_rate, note, set_by_staff_id)
VALUES
  ('br-lgb-hwt', 'biz-lgb-001', 20, 88.00, 8.00, 'Flagship and busiest; payday crowds expected.', NULL),
  ('br-lgb-nkg', 'biz-lgb-001', 15, 90.00, 7.00, 'Corporate area lunchtime peak.', NULL),
  ('br-lgb-mob', 'biz-lgb-001', 12, 92.00, 6.00, 'Lower volume; expected to beat target.', NULL)
ON DUPLICATE KEY UPDATE
  target_wait_minutes = VALUES(target_wait_minutes), target_completion_rate = VALUES(target_completion_rate),
  target_no_show_rate = VALUES(target_no_show_rate), note = VALUES(note);

-- Saturday Banking: the next four Saturdays, open to anyone, registration
-- closing at 5 p.m. the Friday before each.
INSERT INTO scheduled_sessions
  (id, business_id, branch_id, service_id, name, description,
   venue_name, venue_address, session_date, starts_at, ends_at,
   capacity, requires_eligibility, second_factor,
   registration_opens_at, registration_closes_at,
   arrive_minutes_before, status)
VALUES
  ('ses-lgb-show-sat-1', 'biz-lgb-001', 'br-lgb-hwt', 'svc-lgb-teller',
   'Saturday Banking — Half Way Tree',
   'Teller services on Saturday morning: deposits, withdrawals and bill payments. Reserve a place and check in when you arrive.',
   NULL, NULL, DATE_ADD(DATE_ADD(CURDATE(), INTERVAL ((7 - WEEKDAY(CURDATE()) + 5) % 7) DAY), INTERVAL 0 DAY), '09:00:00', '12:00:00', 150, 0, 'none',
   NOW(), TIMESTAMP(DATE_SUB(DATE_ADD(DATE_ADD(CURDATE(), INTERVAL ((7 - WEEKDAY(CURDATE()) + 5) % 7) DAY), INTERVAL 0 DAY), INTERVAL 1 DAY), '17:00:00'), 10, 'open'),
  ('ses-lgb-show-sat-2', 'biz-lgb-001', 'br-lgb-hwt', 'svc-lgb-teller',
   'Saturday Banking — Half Way Tree',
   'Teller services on Saturday morning: deposits, withdrawals and bill payments. Reserve a place and check in when you arrive.',
   NULL, NULL, DATE_ADD(DATE_ADD(CURDATE(), INTERVAL ((7 - WEEKDAY(CURDATE()) + 5) % 7) DAY), INTERVAL 7 DAY), '09:00:00', '12:00:00', 150, 0, 'none',
   NOW(), TIMESTAMP(DATE_SUB(DATE_ADD(DATE_ADD(CURDATE(), INTERVAL ((7 - WEEKDAY(CURDATE()) + 5) % 7) DAY), INTERVAL 7 DAY), INTERVAL 1 DAY), '17:00:00'), 10, 'open'),
  ('ses-lgb-show-sat-3', 'biz-lgb-001', 'br-lgb-hwt', 'svc-lgb-teller',
   'Saturday Banking — Half Way Tree',
   'Teller services on Saturday morning: deposits, withdrawals and bill payments. Reserve a place and check in when you arrive.',
   NULL, NULL, DATE_ADD(DATE_ADD(CURDATE(), INTERVAL ((7 - WEEKDAY(CURDATE()) + 5) % 7) DAY), INTERVAL 14 DAY), '09:00:00', '12:00:00', 150, 0, 'none',
   NOW(), TIMESTAMP(DATE_SUB(DATE_ADD(DATE_ADD(CURDATE(), INTERVAL ((7 - WEEKDAY(CURDATE()) + 5) % 7) DAY), INTERVAL 14 DAY), INTERVAL 1 DAY), '17:00:00'), 10, 'open'),
  ('ses-lgb-show-sat-4', 'biz-lgb-001', 'br-lgb-hwt', 'svc-lgb-teller',
   'Saturday Banking — Half Way Tree',
   'Teller services on Saturday morning: deposits, withdrawals and bill payments. Reserve a place and check in when you arrive.',
   NULL, NULL, DATE_ADD(DATE_ADD(CURDATE(), INTERVAL ((7 - WEEKDAY(CURDATE()) + 5) % 7) DAY), INTERVAL 21 DAY), '09:00:00', '12:00:00', 150, 0, 'none',
   NOW(), TIMESTAMP(DATE_SUB(DATE_ADD(DATE_ADD(CURDATE(), INTERVAL ((7 - WEEKDAY(CURDATE()) + 5) % 7) DAY), INTERVAL 21 DAY), INTERVAL 1 DAY), '17:00:00'), 10, 'open')
ON DUPLICATE KEY UPDATE
  name = VALUES(name), description = VALUES(description), session_date = VALUES(session_date),
  starts_at = VALUES(starts_at), ends_at = VALUES(ends_at), capacity = VALUES(capacity),
  registration_opens_at = VALUES(registration_opens_at),
  registration_closes_at = VALUES(registration_closes_at), status = VALUES(status);
