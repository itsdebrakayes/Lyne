-- The connection charset must be declared before any non-ASCII data, for the
-- same reason database/seed.sql declares it: an import that runs as latin1
-- re-encodes every em-dash one byte at a time.
SET NAMES utf8mb4;

-- =============================================================
-- LYNE — App review demonstration tenant
--
-- Production starts empty. A store reviewer who signs in and finds no agency
-- to queue for cannot review the app, and files Guideline 2.1 (App Store) or
-- the equivalent Play rejection. This file is the answer to that, and it is
-- the ONLY seed that may be applied to production.
--
--     mysql ... lyne < database/review_tenant_seed.sql
--
-- Why not database/demo_*.sql: those tenants are Tax Administration Jamaica,
-- PICA/Passport Office and the National Housing Trust. They exist for sales
-- demonstrations to those very agencies. Standing them up in production, where
-- a reviewer and later the public can see them, claims an affiliation with
-- three real government bodies that has not been granted — which is both an
-- impersonation rejection (App Store 5.2.1, Play Impersonation) and a problem
-- that does not end at the store. This tenant is fictional on purpose and says
-- so in its own name.
--
-- No queues and no tickets are created here, deliberately:
--   * queues are opened for the current date automatically, from counters, by
--     ensureQueuesForToday() in apps/backend/src/routes/queues.js and by the
--     join path in routes/tickets.js. Seeding them would go stale by morning;
--     letting the application make them means this tenant is still correct in
--     six months without anything scheduled.
--   * seeded 'waiting' tickets left overnight are exactly the state
--     utils/ticketSlot.js warns about — a fresh customer ranked ahead of
--     someone who has waited since yesterday — and expireStaleTickets would
--     be fighting them nightly.
-- A reviewer therefore joins at position 1 against a real, empty queue. That
-- is a working demonstration and an honest one.
--
-- Idempotent: every id is fixed and every insert upserts, so re-running it
-- repairs the tenant rather than duplicating it.
-- =============================================================

-- Reference rows this tenant depends on. Both are owned elsewhere
-- (subscription_tiers by migration 020, roles by schema.sql); INSERT IGNORE so
-- that running this before or after them makes no difference.
INSERT IGNORE INTO subscription_tiers
  (id, name, label, description, can_view_analytics, can_view_predictions, can_view_multi_branch, can_view_executive_reports, max_branches, max_staff)
VALUES
  ('tier-pred-001', 'predictions', 'Predictions', 'Advanced + AI-powered best-time predictions.', TRUE, TRUE, FALSE, FALSE, 5, 50);

INSERT IGNORE INTO roles (id, name, label, description) VALUES
  ('role-staff-001', 'line_staff', 'Line Staff', 'Assigned queue/counter/service operator'),
  ('role-mgr-001',   'manager',    'Manager',    'Branch manager for staff assignments and branch operations');


-- ── The business ────────────────────────────────────────────────────────────
-- The name carries "(Demonstration)" so that nobody — reviewer, pilot visitor,
-- or a customer who finds it by searching — can mistake it for a real office.
INSERT INTO businesses
  (id, name, slug, description, website_url, phone, email, subscription_tier_id, is_active)
VALUES
  ('biz-review-demo-0001', 'Blue Harbour Civic Centre (Demonstration)', 'blue-harbour-demo',
   'A fictional civic office used to demonstrate Lyne. It is not a real agency and offers no real services.',
   'https://uselyne.com', '+1-876-000-0000', 'customersupport@uselyne.com',
   'tier-pred-001', TRUE)
ON DUPLICATE KEY UPDATE
  name = VALUES(name), description = VALUES(description),
  subscription_tier_id = VALUES(subscription_tier_id), is_active = VALUES(is_active);


-- ── The branch ──────────────────────────────────────────────────────────────
-- Coordinates are central Kingston so that "near me" ranking has something
-- sensible to do on a reviewer's simulated location; the street address is
-- invented, to match the invented office.
INSERT INTO branches
  (id, business_id, name, address, city, parish, phone, latitude, longitude,
   opening_time, closing_time, open_days, is_main_branch, is_active)
VALUES
  ('brn-review-demo-0001', 'biz-review-demo-0001', 'Blue Harbour Main Office',
   '1 Demonstration Way', 'Kingston', 'Saint Andrew', '+1-876-000-0000',
   18.010000, -76.790000, '08:30:00', '16:30:00', '1,2,3,4,5', TRUE, TRUE)
ON DUPLICATE KEY UPDATE
  name = VALUES(name), address = VALUES(address), city = VALUES(city),
  parish = VALUES(parish), latitude = VALUES(latitude), longitude = VALUES(longitude),
  opening_time = VALUES(opening_time), closing_time = VALUES(closing_time),
  open_days = VALUES(open_days), is_active = VALUES(is_active);


-- ── Services ────────────────────────────────────────────────────────────────
-- Generic counter services. Nothing here names a real government process, for
-- the same reason the business does not name a real agency.
INSERT INTO services
  (id, business_id, name, description, ticket_prefix, base_avg_time_minutes, is_active)
VALUES
  ('svc-review-demo-gen', 'biz-review-demo-0001', 'General Enquiries',
   'Ask a question or get directed to the right counter.', 'GEN', 10, TRUE),
  ('svc-review-demo-doc', 'biz-review-demo-0001', 'Document Collection',
   'Collect a document that is ready for pickup.', 'DOC', 8, TRUE),
  ('svc-review-demo-pay', 'biz-review-demo-0001', 'Payments and Receipts',
   'Make a payment at the counter and collect a receipt.', 'PAY', 6, TRUE)
ON DUPLICATE KEY UPDATE
  name = VALUES(name), description = VALUES(description),
  ticket_prefix = VALUES(ticket_prefix),
  base_avg_time_minutes = VALUES(base_avg_time_minutes), is_active = VALUES(is_active);


-- ── Counters ────────────────────────────────────────────────────────────────
-- Load-bearing, not decoration: a branch offers a service if it has a counter
-- for it, so this table is what ensureQueuesForToday() reads to decide which
-- queues to open each morning. Remove these and the tenant goes dark overnight.
INSERT INTO counters
  (id, branch_id, service_id, counter_number, label, is_active)
VALUES
  ('cnt-review-demo-0001', 'brn-review-demo-0001', 'svc-review-demo-gen', 1, 'Counter 1 — Enquiries', TRUE),
  ('cnt-review-demo-0002', 'brn-review-demo-0001', 'svc-review-demo-doc', 2, 'Counter 2 — Collections', TRUE),
  ('cnt-review-demo-0003', 'brn-review-demo-0001', 'svc-review-demo-pay', 3, 'Counter 3 — Payments', TRUE)
ON DUPLICATE KEY UPDATE
  service_id = VALUES(service_id), label = VALUES(label), is_active = VALUES(is_active);


-- ── Staff ───────────────────────────────────────────────────────────────────
-- supabase_uid is left NULL on purpose. These rows exist so the branch has an
-- operator side at all; linking them to real Supabase Auth accounts is a
-- separate, deliberate act, and a staff row that claims an auth identity it
-- does not have is worse than one that admits it has none.
INSERT INTO staff
  (id, business_id, branch_id, role_id, supabase_uid, staff_code, full_name, email,
   phone, assigned_service_id, availability_status, is_active)
VALUES
  ('stf-review-demo-mgr', 'biz-review-demo-0001', 'brn-review-demo-0001', 'role-mgr-001',
   NULL, 'DEMO-MGR-001', 'Demonstration Manager', 'demo.manager@uselyne.com',
   '+1-876-000-0000', NULL, 'active', TRUE),
  ('stf-review-demo-ln1', 'biz-review-demo-0001', 'brn-review-demo-0001', 'role-staff-001',
   NULL, 'DEMO-STAFF-001', 'Demonstration Officer', 'demo.officer@uselyne.com',
   '+1-876-000-0000', 'svc-review-demo-gen', 'active', TRUE)
ON DUPLICATE KEY UPDATE
  full_name = VALUES(full_name), role_id = VALUES(role_id),
  assigned_service_id = VALUES(assigned_service_id),
  availability_status = VALUES(availability_status), is_active = VALUES(is_active);


-- ── What this file deliberately does not do ─────────────────────────────────
-- It does not create the reviewer's own account. POST /api/auth/sync-user
-- creates the users row from the Supabase Auth identity the first time that
-- account signs in, so the reviewer account is made once in Supabase Auth and
-- then simply used. Writing a users row here with a guessed supabase_uid would
-- produce an account that exists in MySQL and cannot log in.
