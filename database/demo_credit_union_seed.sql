-- The connection charset must be declared before any non-ASCII data.
-- Without it, mysql's docker-entrypoint import runs as latin1, so every
-- em-dash and curly quote in this file is read one byte at a time and
-- re-encoded — 'Sitting — Camp Road' lands in a utf8mb4 column as
-- 'Sitting â€" Camp Road'. The columns were never wrong; the pipe was.
SET NAMES utf8mb4;

-- =============================================================
-- Fictional credit-union pilot story
--
-- Demo-only, loaded after migration 025. No real institution branding or
-- member data is used. Safe to rerun: every row has a deterministic id.
-- =============================================================

USE lyne;

INSERT INTO businesses
  (id, name, slug, sector, description, logo_url, subscription_tier_id, is_active)
VALUES
  ('biz-cfcu-001', 'Community First Credit Union', 'community-first', 'financial_services',
   'Fictional Jamaican credit-union pilot for member service, loan-readiness, and branch-flow demonstrations.',
   NULL, 'tier-exec-001', TRUE)
ON DUPLICATE KEY UPDATE
  name = VALUES(name), sector = VALUES(sector), description = VALUES(description),
  subscription_tier_id = VALUES(subscription_tier_id), is_active = TRUE;

INSERT INTO branches
  (id, business_id, name, address, city, parish, phone, latitude, longitude,
   opening_time, closing_time, open_days, is_main_branch, is_active)
VALUES
  ('br-cfcu-hwt', 'biz-cfcu-001', 'Half Way Tree Member Centre',
   '10 Hope Road, Kingston 10', 'Kingston', 'Kingston', '876-555-0100',
   18.012900, -76.795200, '07:00:00', '20:00:00', '0,1,2,3,4,5,6', TRUE, TRUE)
ON DUPLICATE KEY UPDATE
  name = VALUES(name), address = VALUES(address), phone = VALUES(phone),
  opening_time = VALUES(opening_time), closing_time = VALUES(closing_time),
  open_days = VALUES(open_days), is_active = TRUE;

INSERT INTO services
  (id, business_id, name, description, ticket_prefix, base_avg_time_minutes, is_active)
VALUES
  ('svc-cfcu-loan', 'biz-cfcu-001', 'Loan Document Review',
   'Meet a loan officer to review a personal-loan application and supporting documents.', 'LDR', 24, TRUE),
  ('svc-cfcu-member', 'biz-cfcu-001', 'Membership & Account Opening',
   'Open membership and set up your first credit-union account.', 'MEM', 20, TRUE),
  ('svc-cfcu-support', 'biz-cfcu-001', 'Loan & Repayment Support',
   'Get help with an existing loan, payment arrangement, or account question.', 'LRS', 16, TRUE)
ON DUPLICATE KEY UPDATE
  name = VALUES(name), description = VALUES(description), ticket_prefix = VALUES(ticket_prefix),
  base_avg_time_minutes = VALUES(base_avg_time_minutes), is_active = TRUE;

INSERT INTO service_readiness
  (id, service_id, kind, seq, label, detail, is_mandatory, lead_minutes, is_active)
VALUES
  ('rdy-cfcu-loan-01', 'svc-cfcu-loan', 'bring', 1, 'Valid government-issued photo ID',
   'Driver''s licence, passport, or voter ID.', TRUE, NULL, TRUE),
  ('rdy-cfcu-loan-02', 'svc-cfcu-loan', 'bring', 2, 'Two most recent payslips',
   'Printed or downloaded copies are accepted for this pilot.', TRUE, NULL, TRUE),
  ('rdy-cfcu-loan-03', 'svc-cfcu-loan', 'bring', 3, 'Proof of address',
   'Utility bill or bank statement issued within the last three months.', TRUE, NULL, TRUE),
  ('rdy-cfcu-loan-04', 'svc-cfcu-loan', 'prepare', 4, 'Complete the personal-loan application',
   'Review every section and sign where indicated before arriving.', TRUE, 60, TRUE),
  ('rdy-cfcu-loan-05', 'svc-cfcu-loan', 'bring', 5, 'Member number',
   'Find it on your member card or account statement.', FALSE, NULL, TRUE),

  ('rdy-cfcu-member-01', 'svc-cfcu-member', 'bring', 1, 'Valid government-issued photo ID',
   'Bring the original document, not only a photo.', TRUE, NULL, TRUE),
  ('rdy-cfcu-member-02', 'svc-cfcu-member', 'bring', 2, 'TRN',
   'Your Tax Registration Number card or a clear copy.', TRUE, NULL, TRUE),
  ('rdy-cfcu-member-03', 'svc-cfcu-member', 'bring', 3, 'Proof of address',
   'Utility bill or bank statement issued within the last three months.', TRUE, NULL, TRUE),
  ('rdy-cfcu-member-04', 'svc-cfcu-member', 'prepare', 4, 'Choose an emergency contact',
   'Have their full name and phone number ready.', FALSE, NULL, TRUE),

  ('rdy-cfcu-support-01', 'svc-cfcu-support', 'bring', 1, 'Member number or loan account number',
   'Find either number on your member card, loan letter, or statement.', TRUE, NULL, TRUE),
  ('rdy-cfcu-support-02', 'svc-cfcu-support', 'bring', 2, 'Any letter or message about the issue',
   'A printed copy or the message on your phone is fine.', FALSE, NULL, TRUE)
ON DUPLICATE KEY UPDATE
  kind = VALUES(kind), seq = VALUES(seq), label = VALUES(label), detail = VALUES(detail),
  is_mandatory = VALUES(is_mandatory), lead_minutes = VALUES(lead_minutes), is_active = TRUE;

INSERT INTO counters (id, branch_id, service_id, counter_number, label, is_active)
VALUES
  ('ctr-cfcu-loan-1', 'br-cfcu-hwt', 'svc-cfcu-loan', 1, 'Loan Desk 1', TRUE),
  ('ctr-cfcu-loan-2', 'br-cfcu-hwt', 'svc-cfcu-loan', 2, 'Loan Desk 2', TRUE),
  ('ctr-cfcu-member-1', 'br-cfcu-hwt', 'svc-cfcu-member', 3, 'Member Services 1', TRUE),
  ('ctr-cfcu-support-1', 'br-cfcu-hwt', 'svc-cfcu-support', 4, 'Account Support 1', TRUE)
ON DUPLICATE KEY UPDATE service_id = VALUES(service_id), label = VALUES(label), is_active = TRUE;

INSERT INTO staff
  (id, business_id, branch_id, role_id, staff_code, full_name, email, assigned_service_id, is_active, availability_status)
VALUES
  ('stf-cfcu-loan', 'biz-cfcu-001', 'br-cfcu-hwt', 'role-staff-001', 'CFCU-L01', 'Janelle Morgan', 'janelle@communityfirst.demo', 'svc-cfcu-loan', TRUE, 'active'),
  ('stf-cfcu-member', 'biz-cfcu-001', 'br-cfcu-hwt', 'role-staff-001', 'CFCU-M01', 'Andre Lewis', 'andre@communityfirst.demo', 'svc-cfcu-member', TRUE, 'active'),
  ('stf-cfcu-manager', 'biz-cfcu-001', 'br-cfcu-hwt', 'role-mgr-001', 'CFCU-BM1', 'Nadine Campbell', 'nadine@communityfirst.demo', NULL, TRUE, 'active')
ON DUPLICATE KEY UPDATE
  business_id = VALUES(business_id), branch_id = VALUES(branch_id), role_id = VALUES(role_id),
  full_name = VALUES(full_name), assigned_service_id = VALUES(assigned_service_id),
  is_active = TRUE, availability_status = VALUES(availability_status);

INSERT INTO queues (id, branch_id, service_id, queue_date, max_capacity, is_active)
VALUES
  ('q-cfcu-hwt-loan', 'br-cfcu-hwt', 'svc-cfcu-loan', CURDATE(), 45, TRUE),
  ('q-cfcu-hwt-member', 'br-cfcu-hwt', 'svc-cfcu-member', CURDATE(), 35, TRUE),
  ('q-cfcu-hwt-support', 'br-cfcu-hwt', 'svc-cfcu-support', CURDATE(), 35, TRUE)
ON DUPLICATE KEY UPDATE queue_date = CURDATE(), max_capacity = VALUES(max_capacity), is_active = TRUE;

-- A live loan-review line for the customer → officer demo.
INSERT INTO queue_tickets
  (id, queue_id, user_id, ticket_number, verification_code, position, status,
   estimated_wait_minutes, channel, joined_at, readiness_shown_at, readiness_outcome)
VALUES
  ('t-cfcu-live-01', 'q-cfcu-hwt-loan', 'usr-demo-01', 'LDR-001', '410201', 1, 'waiting', 0, 'app', DATE_SUB(NOW(), INTERVAL 21 MINUTE), DATE_SUB(NOW(), INTERVAL 21 MINUTE), 'not_checked'),
  ('t-cfcu-live-02', 'q-cfcu-hwt-loan', 'usr-demo-02', 'LDR-002', '410202', 2, 'waiting', 12, 'app', DATE_SUB(NOW(), INTERVAL 16 MINUTE), DATE_SUB(NOW(), INTERVAL 16 MINUTE), 'not_checked'),
  ('t-cfcu-live-03', 'q-cfcu-hwt-loan', 'usr-demo-03', 'LDR-003', '410203', 3, 'waiting', 24, 'app', DATE_SUB(NOW(), INTERVAL 10 MINUTE), DATE_SUB(NOW(), INTERVAL 10 MINUTE), 'not_checked'),
  ('t-cfcu-live-04', 'q-cfcu-hwt-loan', 'usr-demo-04', 'LDR-004', '410204', 4, 'waiting', 36, 'app', DATE_SUB(NOW(), INTERVAL 5 MINUTE), DATE_SUB(NOW(), INTERVAL 5 MINUTE), 'not_checked')
ON DUPLICATE KEY UPDATE
  queue_id = VALUES(queue_id), user_id = VALUES(user_id), ticket_number = VALUES(ticket_number),
  position = VALUES(position), status = VALUES(status), estimated_wait_minutes = VALUES(estimated_wait_minutes),
  joined_at = VALUES(joined_at), readiness_shown_at = VALUES(readiness_shown_at), readiness_outcome = VALUES(readiness_outcome);

-- A live counter on the queue the demo LINE-STAFF account actually works.
--
-- staff-creditunion@test.com is assigned to Membership & Account Opening at
-- Half Way Tree, and until now that queue was seeded with nothing but `served`
-- history. So the one account you would sign into to demonstrate the counter —
-- Now Serving, Call Next, verify the code, complete the visit — opened onto an
-- empty line at every hour of the day. Not a closing-time artefact: this branch
-- runs to 23:59, so the sweep never touched it. The line was simply never
-- given anyone to serve.
--
-- One at the counter, one just called, four waiting: enough for the whole
-- call → verify → serve loop to be walked in front of somebody, and for the
-- position and ETA behind it to be worth looking at.
INSERT INTO queue_tickets
  (id, queue_id, user_id, ticket_number, verification_code, position, status,
   estimated_wait_minutes, channel, joined_at, called_at, call_timeout_seconds,
   call_expires_at, started_serving_at, served_by_staff_id, served_at_counter_id)
VALUES
  ('t-cfcu-mem-live-01', 'q-cfcu-hwt-member', NULL, 'MEM-001', '420301', 1, 'in_service', 0, 'walk_in',
   DATE_SUB(NOW(), INTERVAL 34 MINUTE), DATE_SUB(NOW(), INTERVAL 9 MINUTE), 120,
   DATE_ADD(NOW(), INTERVAL 111 SECOND), DATE_SUB(NOW(), INTERVAL 7 MINUTE),
   'stf-cfcu-member', 'ctr-cfcu-member-1'),
  ('t-cfcu-mem-live-02', 'q-cfcu-hwt-member', 'usr-demo-02', 'MEM-002', '420302', 2, 'called', 0, 'app',
   DATE_SUB(NOW(), INTERVAL 27 MINUTE), DATE_SUB(NOW(), INTERVAL 40 SECOND), 120,
   DATE_ADD(NOW(), INTERVAL 80 SECOND), NULL, NULL, NULL),
  ('t-cfcu-mem-live-03', 'q-cfcu-hwt-member', 'usr-demo-03', 'MEM-003', '420303', 3, 'waiting', 8, 'app',
   DATE_SUB(NOW(), INTERVAL 19 MINUTE), NULL, 120, NULL, NULL, NULL, NULL),
  ('t-cfcu-mem-live-04', 'q-cfcu-hwt-member', NULL, 'MEM-004', '420304', 4, 'waiting', 16, 'walk_in',
   DATE_SUB(NOW(), INTERVAL 14 MINUTE), NULL, 120, NULL, NULL, NULL, NULL),
  ('t-cfcu-mem-live-05', 'q-cfcu-hwt-member', 'usr-demo-04', 'MEM-005', '420305', 5, 'waiting', 24, 'app',
   DATE_SUB(NOW(), INTERVAL 8 MINUTE), NULL, 120, NULL, NULL, NULL, NULL),
  ('t-cfcu-mem-live-06', 'q-cfcu-hwt-member', NULL, 'MEM-006', '420306', 6, 'waiting', 32, 'walk_in',
   DATE_SUB(NOW(), INTERVAL 3 MINUTE), NULL, 120, NULL, NULL, NULL, NULL),
  -- And two on Loan & Repayment Support, so the third Half Way Tree desk is
  -- not the only one standing empty behind the demo.
  ('t-cfcu-sup-live-01', 'q-cfcu-hwt-support', 'usr-demo-01', 'LRS-001', '430301', 1, 'waiting', 5, 'app',
   DATE_SUB(NOW(), INTERVAL 11 MINUTE), NULL, 120, NULL, NULL, NULL, NULL),
  ('t-cfcu-sup-live-02', 'q-cfcu-hwt-support', NULL, 'LRS-002', '430302', 2, 'waiting', 10, 'walk_in',
   DATE_SUB(NOW(), INTERVAL 4 MINUTE), NULL, 120, NULL, NULL, NULL, NULL)
ON DUPLICATE KEY UPDATE
  queue_id = VALUES(queue_id), user_id = VALUES(user_id), ticket_number = VALUES(ticket_number),
  position = VALUES(position), status = VALUES(status), estimated_wait_minutes = VALUES(estimated_wait_minutes),
  joined_at = VALUES(joined_at), called_at = VALUES(called_at), call_expires_at = VALUES(call_expires_at),
  started_serving_at = VALUES(started_serving_at), served_by_staff_id = VALUES(served_by_staff_id),
  served_at_counter_id = VALUES(served_at_counter_id);

-- Ten assessed visits make the value visible on first launch: seven ready,
-- three incomplete with safe, actionable reasons.
INSERT INTO queue_tickets
  (id, queue_id, user_id, ticket_number, verification_code, position, status,
   estimated_wait_minutes, channel, joined_at, called_at, started_serving_at, completed_at,
   served_by_staff_id, served_at_counter_id, readiness_shown_at, readiness_outcome, readiness_note)
VALUES
  ('t-cfcu-done-01', 'q-cfcu-hwt-loan', NULL, 'LDR-P01', '510201', 101, 'served', 14, 'app', DATE_SUB(NOW(), INTERVAL 6 HOUR), DATE_SUB(NOW(), INTERVAL 340 MINUTE), DATE_SUB(NOW(), INTERVAL 338 MINUTE), DATE_SUB(NOW(), INTERVAL 315 MINUTE), 'stf-cfcu-loan', 'ctr-cfcu-loan-1', DATE_SUB(NOW(), INTERVAL 6 HOUR), 'ready', NULL),
  ('t-cfcu-done-02', 'q-cfcu-hwt-loan', NULL, 'LDR-P02', '510202', 102, 'served', 18, 'app', DATE_SUB(NOW(), INTERVAL 5 HOUR), DATE_SUB(NOW(), INTERVAL 278 MINUTE), DATE_SUB(NOW(), INTERVAL 276 MINUTE), DATE_SUB(NOW(), INTERVAL 250 MINUTE), 'stf-cfcu-loan', 'ctr-cfcu-loan-1', DATE_SUB(NOW(), INTERVAL 5 HOUR), 'incomplete', 'Proof of address was older than three months.'),
  ('t-cfcu-done-03', 'q-cfcu-hwt-loan', NULL, 'LDR-P03', '510203', 103, 'served', 12, 'app', DATE_SUB(NOW(), INTERVAL 4 HOUR), DATE_SUB(NOW(), INTERVAL 225 MINUTE), DATE_SUB(NOW(), INTERVAL 223 MINUTE), DATE_SUB(NOW(), INTERVAL 201 MINUTE), 'stf-cfcu-loan', 'ctr-cfcu-loan-1', DATE_SUB(NOW(), INTERVAL 4 HOUR), 'ready', NULL),
  ('t-cfcu-done-04', 'q-cfcu-hwt-loan', NULL, 'LDR-P04', '510204', 104, 'served', 16, 'app', DATE_SUB(NOW(), INTERVAL 3 HOUR), DATE_SUB(NOW(), INTERVAL 166 MINUTE), DATE_SUB(NOW(), INTERVAL 164 MINUTE), DATE_SUB(NOW(), INTERVAL 141 MINUTE), 'stf-cfcu-loan', 'ctr-cfcu-loan-2', DATE_SUB(NOW(), INTERVAL 3 HOUR), 'incomplete', 'Only one of the two required payslips was available.'),
  ('t-cfcu-done-05', 'q-cfcu-hwt-loan', NULL, 'LDR-P05', '510205', 105, 'served', 11, 'app', DATE_SUB(NOW(), INTERVAL 2 HOUR), DATE_SUB(NOW(), INTERVAL 105 MINUTE), DATE_SUB(NOW(), INTERVAL 103 MINUTE), DATE_SUB(NOW(), INTERVAL 82 MINUTE), 'stf-cfcu-loan', 'ctr-cfcu-loan-2', DATE_SUB(NOW(), INTERVAL 2 HOUR), 'ready', NULL),
  ('t-cfcu-done-06', 'q-cfcu-hwt-member', NULL, 'MEM-P01', '520201', 101, 'served', 8, 'kiosk', DATE_SUB(NOW(), INTERVAL 5 HOUR), DATE_SUB(NOW(), INTERVAL 287 MINUTE), DATE_SUB(NOW(), INTERVAL 285 MINUTE), DATE_SUB(NOW(), INTERVAL 266 MINUTE), 'stf-cfcu-member', 'ctr-cfcu-member-1', DATE_SUB(NOW(), INTERVAL 5 HOUR), 'ready', NULL),
  ('t-cfcu-done-07', 'q-cfcu-hwt-member', NULL, 'MEM-P02', '520202', 102, 'served', 10, 'app', DATE_SUB(NOW(), INTERVAL 4 HOUR), DATE_SUB(NOW(), INTERVAL 226 MINUTE), DATE_SUB(NOW(), INTERVAL 224 MINUTE), DATE_SUB(NOW(), INTERVAL 205 MINUTE), 'stf-cfcu-member', 'ctr-cfcu-member-1', DATE_SUB(NOW(), INTERVAL 4 HOUR), 'incomplete', 'Member did not have their TRN available.'),
  ('t-cfcu-done-08', 'q-cfcu-hwt-member', NULL, 'MEM-P03', '520203', 103, 'served', 7, 'app', DATE_SUB(NOW(), INTERVAL 3 HOUR), DATE_SUB(NOW(), INTERVAL 169 MINUTE), DATE_SUB(NOW(), INTERVAL 167 MINUTE), DATE_SUB(NOW(), INTERVAL 149 MINUTE), 'stf-cfcu-member', 'ctr-cfcu-member-1', DATE_SUB(NOW(), INTERVAL 3 HOUR), 'ready', NULL),
  ('t-cfcu-done-09', 'q-cfcu-hwt-support', NULL, 'LRS-P01', '530201', 101, 'served', 5, 'app', DATE_SUB(NOW(), INTERVAL 2 HOUR), DATE_SUB(NOW(), INTERVAL 111 MINUTE), DATE_SUB(NOW(), INTERVAL 109 MINUTE), DATE_SUB(NOW(), INTERVAL 95 MINUTE), 'stf-cfcu-loan', 'ctr-cfcu-support-1', DATE_SUB(NOW(), INTERVAL 2 HOUR), 'ready', NULL),
  ('t-cfcu-done-10', 'q-cfcu-hwt-support', NULL, 'LRS-P02', '530202', 102, 'served', 6, 'app', DATE_SUB(NOW(), INTERVAL 1 HOUR), DATE_SUB(NOW(), INTERVAL 50 MINUTE), DATE_SUB(NOW(), INTERVAL 48 MINUTE), DATE_SUB(NOW(), INTERVAL 34 MINUTE), 'stf-cfcu-loan', 'ctr-cfcu-support-1', DATE_SUB(NOW(), INTERVAL 1 HOUR), 'ready', NULL)
ON DUPLICATE KEY UPDATE
  status = VALUES(status), joined_at = VALUES(joined_at), called_at = VALUES(called_at),
  started_serving_at = VALUES(started_serving_at), completed_at = VALUES(completed_at),
  served_by_staff_id = VALUES(served_by_staff_id), served_at_counter_id = VALUES(served_at_counter_id),
  readiness_shown_at = VALUES(readiness_shown_at), readiness_outcome = VALUES(readiness_outcome),
  readiness_note = VALUES(readiness_note);

INSERT INTO saved_businesses (user_id, business_id)
SELECT id, 'biz-cfcu-001' FROM users WHERE id LIKE 'usr-demo-%' OR id = 'usr-test-mobile'
ON DUPLICATE KEY UPDATE saved_at = saved_at;


-- =============================================================
-- Multi-branch extension — added 2026-08-13
--
-- The single-branch story above proves readiness. It cannot prove the two
-- beats the go-to-market plan's seven-minute demo actually turns on:
--
--   • "a regional executive sees authorized cross-branch analytics"
--   • "a user from another tenant is denied access"
--
-- Both need more than one branch and a role above branch level. Everything
-- below is still fictional and synthetic.
-- =============================================================

-- Demo hours. The rest of the demo estate runs around the clock so an evening
-- investor call never opens on a dead app; this tenant was left on 07:00-20:00
-- and would have read "closed" while every other agency read "open".
UPDATE branches SET opening_time = '00:00:00', closing_time = '23:59:59', open_days = '0,1,2,3,4,5,6'
WHERE business_id = 'biz-cfcu-001';

INSERT INTO branches
  (id, business_id, name, address, city, parish, phone, latitude, longitude,
   opening_time, closing_time, open_days, is_main_branch, is_active)
VALUES
  ('br-cfcu-por', 'biz-cfcu-001', 'Portmore Member Centre',
   '5 Municipal Boulevard, Portmore', 'Portmore', 'St. Catherine', '876-555-0110',
   17.949800, -76.879500, '00:00:00', '23:59:59', '0,1,2,3,4,5,6', FALSE, TRUE),
  ('br-cfcu-mob', 'biz-cfcu-001', 'Montego Bay Member Centre',
   '18 Queens Drive, Montego Bay', 'Montego Bay', 'St. James', '876-555-0120',
   18.489100, -77.913800, '00:00:00', '23:59:59', '0,1,2,3,4,5,6', FALSE, TRUE)
ON DUPLICATE KEY UPDATE
  name = VALUES(name), address = VALUES(address), city = VALUES(city), parish = VALUES(parish),
  opening_time = VALUES(opening_time), closing_time = VALUES(closing_time),
  open_days = VALUES(open_days), is_active = TRUE;

INSERT INTO counters (id, branch_id, service_id, counter_number, label, is_active)
VALUES
  ('ctr-cfcu-por-loan', 'br-cfcu-por', 'svc-cfcu-loan', 1, 'Loan Desk 1', TRUE),
  ('ctr-cfcu-por-member', 'br-cfcu-por', 'svc-cfcu-member', 2, 'Member Services 1', TRUE),
  ('ctr-cfcu-mob-loan', 'br-cfcu-mob', 'svc-cfcu-loan', 1, 'Loan Desk 1', TRUE),
  ('ctr-cfcu-mob-member', 'br-cfcu-mob', 'svc-cfcu-member', 2, 'Member Services 1', TRUE)
ON DUPLICATE KEY UPDATE service_id = VALUES(service_id), label = VALUES(label), is_active = TRUE;

-- The role ladder the access-control beat depends on. The executive has NO
-- branch_id: that is what makes them company-wide, and the branch manager's
-- null-branch fail-closed rule is what keeps everyone else pinned.
INSERT INTO staff
  (id, business_id, branch_id, role_id, staff_code, full_name, email, assigned_service_id, is_active, availability_status)
VALUES
  ('stf-cfcu-exec', 'biz-cfcu-001', NULL, 'role-exec-001', 'CFCU-EX1', 'Marcia Bennett', 'marcia@communityfirst.demo', NULL, TRUE, 'active'),
  ('stf-cfcu-sup-hwt', 'biz-cfcu-001', 'br-cfcu-hwt', 'role-supervisor-001', 'CFCU-SV1', 'Damion Reid', 'damion@communityfirst.demo', NULL, TRUE, 'active'),
  ('stf-cfcu-por-mgr', 'biz-cfcu-001', 'br-cfcu-por', 'role-mgr-001', 'CFCU-BM2', 'Kerry-Ann Brown', 'kerryann@communityfirst.demo', NULL, TRUE, 'active'),
  ('stf-cfcu-por-loan', 'biz-cfcu-001', 'br-cfcu-por', 'role-staff-001', 'CFCU-L02', 'Shanice Clarke', 'shanice@communityfirst.demo', 'svc-cfcu-loan', TRUE, 'active'),
  ('stf-cfcu-mob-mgr', 'biz-cfcu-001', 'br-cfcu-mob', 'role-mgr-001', 'CFCU-BM3', 'Rohan Sinclair', 'rohan@communityfirst.demo', NULL, TRUE, 'active'),
  ('stf-cfcu-mob-loan', 'biz-cfcu-001', 'br-cfcu-mob', 'role-staff-001', 'CFCU-L03', 'Tarik Ellis', 'tarik@communityfirst.demo', 'svc-cfcu-loan', TRUE, 'active')
ON DUPLICATE KEY UPDATE
  business_id = VALUES(business_id), branch_id = VALUES(branch_id), role_id = VALUES(role_id),
  full_name = VALUES(full_name), assigned_service_id = VALUES(assigned_service_id),
  is_active = TRUE, availability_status = VALUES(availability_status);

INSERT INTO queues (id, branch_id, service_id, queue_date, max_capacity, is_active)
VALUES
  ('q-cfcu-por-loan', 'br-cfcu-por', 'svc-cfcu-loan', CURDATE(), 40, TRUE),
  ('q-cfcu-por-member', 'br-cfcu-por', 'svc-cfcu-member', CURDATE(), 30, TRUE),
  ('q-cfcu-mob-loan', 'br-cfcu-mob', 'svc-cfcu-loan', CURDATE(), 40, TRUE),
  ('q-cfcu-mob-member', 'br-cfcu-mob', 'svc-cfcu-member', CURDATE(), 30, TRUE)
ON DUPLICATE KEY UPDATE queue_date = CURDATE(), max_capacity = VALUES(max_capacity), is_active = TRUE;

-- Live lines at the other two branches. Deliberately UNEVEN: Portmore is
-- congested and Montego Bay is quiet. A cross-branch dashboard where every
-- branch looks the same proves nothing — the executive's question is "which
-- branch needs help today", and the data has to be able to answer it.
INSERT INTO queue_tickets
  (id, queue_id, user_id, ticket_number, verification_code, position, status,
   estimated_wait_minutes, channel, joined_at)
VALUES
  ('t-cfcu-por-01', 'q-cfcu-por-loan', NULL, 'LDR-201', '610201', 1, 'waiting', 0,  'walk_in', DATE_SUB(NOW(), INTERVAL 38 MINUTE)),
  ('t-cfcu-por-02', 'q-cfcu-por-loan', NULL, 'LDR-202', '610202', 2, 'waiting', 22, 'app',     DATE_SUB(NOW(), INTERVAL 31 MINUTE)),
  ('t-cfcu-por-03', 'q-cfcu-por-loan', NULL, 'LDR-203', '610203', 3, 'waiting', 44, 'app',     DATE_SUB(NOW(), INTERVAL 24 MINUTE)),
  ('t-cfcu-por-04', 'q-cfcu-por-loan', NULL, 'LDR-204', '610204', 4, 'waiting', 66, 'walk_in', DATE_SUB(NOW(), INTERVAL 17 MINUTE)),
  ('t-cfcu-por-05', 'q-cfcu-por-loan', NULL, 'LDR-205', '610205', 5, 'waiting', 88, 'app',     DATE_SUB(NOW(), INTERVAL 9 MINUTE)),
  ('t-cfcu-por-06', 'q-cfcu-por-member', NULL, 'MEM-201', '620201', 1, 'waiting', 0,  'app',   DATE_SUB(NOW(), INTERVAL 14 MINUTE)),
  ('t-cfcu-por-07', 'q-cfcu-por-member', NULL, 'MEM-202', '620202', 2, 'waiting', 20, 'app',   DATE_SUB(NOW(), INTERVAL 6 MINUTE)),
  ('t-cfcu-mob-01', 'q-cfcu-mob-loan', NULL, 'LDR-301', '710301', 1, 'waiting', 0,  'app',     DATE_SUB(NOW(), INTERVAL 11 MINUTE)),
  ('t-cfcu-mob-02', 'q-cfcu-mob-member', NULL, 'MEM-301', '720301', 1, 'waiting', 0, 'walk_in', DATE_SUB(NOW(), INTERVAL 4 MINUTE))
ON DUPLICATE KEY UPDATE
  queue_id = VALUES(queue_id), ticket_number = VALUES(ticket_number), position = VALUES(position),
  status = VALUES(status), estimated_wait_minutes = VALUES(estimated_wait_minutes),
  channel = VALUES(channel), joined_at = VALUES(joined_at);

-- Served history at the new branches so the executive view has something to
-- average rather than two live lines and no trend.
INSERT INTO queue_tickets
  (id, queue_id, user_id, ticket_number, verification_code, position, status,
   estimated_wait_minutes, channel, joined_at, called_at, started_serving_at, completed_at,
   served_by_staff_id, served_at_counter_id)
VALUES
  ('t-cfcu-por-h1', 'q-cfcu-por-loan', NULL, 'LDR-P21', '611201', 101, 'served', 41, 'app',     DATE_SUB(NOW(), INTERVAL 5 HOUR),   DATE_SUB(NOW(), INTERVAL 259 MINUTE), DATE_SUB(NOW(), INTERVAL 257 MINUTE), DATE_SUB(NOW(), INTERVAL 231 MINUTE), 'stf-cfcu-por-loan', 'ctr-cfcu-por-loan'),
  ('t-cfcu-por-h2', 'q-cfcu-por-loan', NULL, 'LDR-P22', '611202', 102, 'served', 38, 'walk_in', DATE_SUB(NOW(), INTERVAL 4 HOUR),   DATE_SUB(NOW(), INTERVAL 202 MINUTE), DATE_SUB(NOW(), INTERVAL 200 MINUTE), DATE_SUB(NOW(), INTERVAL 176 MINUTE), 'stf-cfcu-por-loan', 'ctr-cfcu-por-loan'),
  ('t-cfcu-por-h3', 'q-cfcu-por-member', NULL, 'MEM-P21', '621201', 101, 'served', 19, 'app',   DATE_SUB(NOW(), INTERVAL 3 HOUR),   DATE_SUB(NOW(), INTERVAL 161 MINUTE), DATE_SUB(NOW(), INTERVAL 159 MINUTE), DATE_SUB(NOW(), INTERVAL 141 MINUTE), 'stf-cfcu-por-loan', 'ctr-cfcu-por-member'),
  ('t-cfcu-por-h4', 'q-cfcu-por-loan', NULL, 'LDR-P23', '611203', 103, 'no_show', 45, 'app',    DATE_SUB(NOW(), INTERVAL 2 HOUR),   DATE_SUB(NOW(), INTERVAL 96 MINUTE),  NULL, NULL, NULL, NULL),
  ('t-cfcu-mob-h1', 'q-cfcu-mob-loan', NULL, 'LDR-P31', '711301', 101, 'served', 9,  'app',     DATE_SUB(NOW(), INTERVAL 5 HOUR),   DATE_SUB(NOW(), INTERVAL 291 MINUTE), DATE_SUB(NOW(), INTERVAL 289 MINUTE), DATE_SUB(NOW(), INTERVAL 271 MINUTE), 'stf-cfcu-mob-loan', 'ctr-cfcu-mob-loan'),
  ('t-cfcu-mob-h2', 'q-cfcu-mob-loan', NULL, 'LDR-P32', '711302', 102, 'served', 7,  'walk_in', DATE_SUB(NOW(), INTERVAL 3 HOUR),   DATE_SUB(NOW(), INTERVAL 172 MINUTE), DATE_SUB(NOW(), INTERVAL 170 MINUTE), DATE_SUB(NOW(), INTERVAL 156 MINUTE), 'stf-cfcu-mob-loan', 'ctr-cfcu-mob-loan'),
  ('t-cfcu-mob-h3', 'q-cfcu-mob-member', NULL, 'MEM-P31', '721301', 101, 'served', 11, 'app',   DATE_SUB(NOW(), INTERVAL 90 MINUTE), DATE_SUB(NOW(), INTERVAL 82 MINUTE),  DATE_SUB(NOW(), INTERVAL 80 MINUTE),  DATE_SUB(NOW(), INTERVAL 66 MINUTE),  'stf-cfcu-mob-loan', 'ctr-cfcu-mob-member')
ON DUPLICATE KEY UPDATE
  status = VALUES(status), joined_at = VALUES(joined_at), called_at = VALUES(called_at),
  started_serving_at = VALUES(started_serving_at), completed_at = VALUES(completed_at),
  served_by_staff_id = VALUES(served_by_staff_id), served_at_counter_id = VALUES(served_at_counter_id);

-- Targets, so the executive scorecard measures against something the customer
-- set rather than a number we invented. Set by the executive, per the rule that
-- targets are never hardcoded.
INSERT INTO business_targets
  (business_id, target_wait_minutes, target_completion_rate, target_no_show_rate, horizon_months, note, set_by_staff_id)
VALUES
  ('biz-cfcu-001', 15, 92.00, 6.00, 6, 'Pilot target: members seen inside 15 minutes at every member centre.', 'stf-cfcu-exec')
ON DUPLICATE KEY UPDATE
  target_wait_minutes = VALUES(target_wait_minutes), target_completion_rate = VALUES(target_completion_rate),
  target_no_show_rate = VALUES(target_no_show_rate), horizon_months = VALUES(horizon_months),
  note = VALUES(note), set_by_staff_id = VALUES(set_by_staff_id);

INSERT INTO branch_targets
  (branch_id, business_id, target_wait_minutes, target_completion_rate, target_no_show_rate, note, set_by_staff_id)
VALUES
  ('br-cfcu-hwt', 'biz-cfcu-001', 15, 92.00, 6.00, 'Flagship centre.', 'stf-cfcu-exec'),
  ('br-cfcu-por', 'biz-cfcu-001', 20, 88.00, 8.00, 'Highest volume; target eased while staffing is reviewed.', 'stf-cfcu-exec'),
  ('br-cfcu-mob', 'biz-cfcu-001', 15, 92.00, 6.00, 'Lower volume; expected to beat target.', 'stf-cfcu-exec')
ON DUPLICATE KEY UPDATE
  target_wait_minutes = VALUES(target_wait_minutes), target_completion_rate = VALUES(target_completion_rate),
  target_no_show_rate = VALUES(target_no_show_rate), note = VALUES(note), set_by_staff_id = VALUES(set_by_staff_id);
