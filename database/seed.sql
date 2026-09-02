-- The connection charset must be declared before any non-ASCII data.
-- Without it, mysql's docker-entrypoint import runs as latin1, so every
-- em-dash and curly quote in this file is read one byte at a time and
-- re-encoded — 'Sitting — Camp Road' lands in a utf8mb4 column as
-- 'Sitting â€" Camp Road'. The columns were never wrong; the pipe was.
SET NAMES utf8mb4;

-- =============================================================
-- LYNE — Seed Data
-- 3 Demo Businesses + Staff + Sample Queue Activity
-- =============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- =============================================================
-- SUBSCRIPTION TIERS
-- =============================================================

-- INSERT IGNORE, matching migration 020, which owns these rows as reference
-- data. Both sides being idempotent means the order the two run in stops
-- mattering — which it did not used to: seed.sql was mounted at slot 20 and
-- happened to run first, so flipping to migrations-then-seeds broke the
-- build on a duplicate primary key.
INSERT IGNORE INTO subscription_tiers (id, name, label, description, can_view_analytics, can_view_predictions, can_view_multi_branch, can_view_executive_reports, max_branches, max_staff) VALUES
('tier-basic-001',      'basic',        'Basic',          'Live queue display only.',                                         FALSE, FALSE, FALSE, FALSE, 1,  5),
('tier-adv-001',        'advanced',     'Advanced',       'Live queues + historical analytics dashboards.',                   TRUE,  FALSE, FALSE, FALSE, 3,  20),
('tier-pred-001',       'predictions',  'Predictions',    'Advanced + AI-powered best-time predictions.',                     TRUE,  TRUE,  FALSE, FALSE, 5,  50),
('tier-multi-001',      'multi_branch', 'Multi-Branch',   'Predictions + cross-branch manager views.',                       TRUE,  TRUE,  TRUE,  FALSE, 20, 200),
('tier-exec-001',       'executive',    'Executive',      'Full platform: executive dashboards + scheduled reports.',         TRUE,  TRUE,  TRUE,  TRUE,  999,9999);


-- =============================================================
-- ROLES
-- =============================================================

INSERT IGNORE INTO roles (id, name, label, description) VALUES
('role-staff-001',   'line_staff', 'Line Staff',   'Handles a single service counter; calls and completes tickets.'),
('role-mgr-001',     'manager',    'Manager',      'Oversees all queues at a branch; assigns staff to counters.'),
('role-exec-001',    'executive',  'Executive',    'Cross-branch analytics and reporting for the whole organization.');


-- =============================================================
-- BUSINESS 1: TAX ADMINISTRATION JAMAICA (TAJ)
-- =============================================================

INSERT INTO businesses (id, name, slug, description, logo_url, subscription_tier_id, is_active) VALUES
('biz-taj-001', 'Tax Administration Jamaica', 'taj',
 'Jamaica''s national tax authority. Handles TRN registration, income tax, GCT, and property tax.',
 '/logos/taj.png', 'tier-exec-001', TRUE);

-- Branches
INSERT INTO branches (id, business_id, name, address, city, parish, phone, is_main_branch, is_active) VALUES
('br-taj-kgn', 'biz-taj-001', 'Kingston - Half Way Tree',  '1 Half Way Tree Road, Kingston 5',    'Kingston',   'Kingston',       '876-922-3470', TRUE,  TRUE),
('br-taj-mob', 'biz-taj-001', 'Montego Bay',               '31 Market Street, Montego Bay',           'Montego Bay','St. James',      '876-952-5002', FALSE, TRUE),
('br-taj-man', 'biz-taj-001', 'Mandeville',                '4 Ward Avenue, Mandeville',               'Mandeville', 'Manchester',     '876-962-2420', FALSE, TRUE),
('br-taj-por', 'biz-taj-001', 'Portmore',                  'Portmore Mall, Portmore',                 'Portmore',   'St. Catherine',  '876-988-1234', FALSE, TRUE);

-- Services
INSERT INTO services (id, business_id, name, description, ticket_prefix, base_avg_time_minutes, is_active) VALUES
('svc-taj-trn',  'biz-taj-001', 'TRN Registration',       'Apply for or update a Tax Registration Number.',            'TRN',  20, TRUE),
('svc-taj-inc',  'biz-taj-001', 'Income Tax Filing',      'File annual income tax returns.',                           'INC',  30, TRUE),
('svc-taj-gct',  'biz-taj-001', 'GCT Registration',       'General Consumption Tax registration and compliance.',      'GCT',  25, TRUE),
('svc-taj-pay',  'biz-taj-001', 'Tax Payments',           'Make tax payments and receive receipts.',                   'PAY',  10, TRUE),
('svc-taj-enq',  'biz-taj-001', 'General Enquiries',      'General tax information and account queries.',              'ENQ',  15, TRUE),
('svc-taj-prop', 'biz-taj-001', 'Property Tax',           'Property tax assessments and payments.',                    'PRP',  20, TRUE);

-- Counters (Kingston branch — 6 counters)
INSERT INTO counters (id, branch_id, service_id, counter_number, label, is_active) VALUES
('ctr-taj-kgn-1', 'br-taj-kgn', 'svc-taj-trn',  1, 'Window 1 - TRN',        TRUE),
('ctr-taj-kgn-2', 'br-taj-kgn', 'svc-taj-trn',  2, 'Window 2 - TRN',        TRUE),
('ctr-taj-kgn-3', 'br-taj-kgn', 'svc-taj-pay',  3, 'Window 3 - Payments',   TRUE),
('ctr-taj-kgn-4', 'br-taj-kgn', 'svc-taj-inc',  4, 'Window 4 - Income Tax', TRUE),
('ctr-taj-kgn-5', 'br-taj-kgn', 'svc-taj-gct',  5, 'Window 5 - GCT',        TRUE),
('ctr-taj-kgn-6', 'br-taj-kgn', 'svc-taj-enq',  6, 'Window 6 - Enquiries',  TRUE);

-- Staff
INSERT INTO staff (id, business_id, branch_id, role_id, staff_code, full_name, email, assigned_service_id, is_active) VALUES
('stf-taj-001', 'biz-taj-001', 'br-taj-kgn', 'role-staff-001', 'TAJ-0001', 'Marcia Brown',    'marcia.brown@taj.gov.jm',    'svc-taj-trn',  TRUE),
('stf-taj-002', 'biz-taj-001', 'br-taj-kgn', 'role-staff-001', 'TAJ-0002', 'Devon Clarke',    'devon.clarke@taj.gov.jm',    'svc-taj-trn',  TRUE),
('stf-taj-003', 'biz-taj-001', 'br-taj-kgn', 'role-staff-001', 'TAJ-0003', 'Sandra Williams', 'sandra.williams@taj.gov.jm', 'svc-taj-pay',  TRUE),
('stf-taj-004', 'biz-taj-001', 'br-taj-kgn', 'role-staff-001', 'TAJ-0004', 'Michael Reid',    'michael.reid@taj.gov.jm',    'svc-taj-inc',  TRUE),
('stf-taj-005', 'biz-taj-001', 'br-taj-kgn', 'role-mgr-001',   'TAJ-0005', 'Janet Thompson',  'janet.thompson@taj.gov.jm',  NULL,           TRUE),
('stf-taj-006', 'biz-taj-001', NULL,          'role-exec-001',  'TAJ-0006', 'Robert Francis',  'robert.francis@taj.gov.jm',  NULL,           TRUE);

-- Staff Assignments (today)
INSERT INTO staff_assignments (id, staff_id, counter_id, assignment_date, shift_start, shift_end, created_by) VALUES
('asgn-taj-001', 'stf-taj-001', 'ctr-taj-kgn-1', CURDATE(), '08:00:00', '16:00:00', 'stf-taj-005'),
('asgn-taj-002', 'stf-taj-002', 'ctr-taj-kgn-2', CURDATE(), '08:00:00', '16:00:00', 'stf-taj-005'),
('asgn-taj-003', 'stf-taj-003', 'ctr-taj-kgn-3', CURDATE(), '08:00:00', '16:00:00', 'stf-taj-005'),
('asgn-taj-004', 'stf-taj-004', 'ctr-taj-kgn-4', CURDATE(), '08:00:00', '16:00:00', 'stf-taj-005');


-- =============================================================
-- BUSINESS 2: NATIONAL HOUSING TRUST (NHT)
-- =============================================================

INSERT INTO businesses (id, name, slug, description, logo_url, subscription_tier_id, is_active) VALUES
('biz-nht-001', 'National Housing Trust', 'nht',
 'Government agency providing housing benefits and mortgage solutions for Jamaican workers.',
 '/logos/nht.png', 'tier-multi-001', TRUE);

-- Branches
INSERT INTO branches (id, business_id, name, address, city, parish, phone, is_main_branch, is_active) VALUES
('br-nht-kgn', 'biz-nht-001', 'Kingston - Head Office', '4 Park Boulevard, Kingston 5', 'Kingston',   'Kingston',  '876-929-6500', TRUE,  TRUE),
('br-nht-mob', 'biz-nht-001', 'Montego Bay',            '23 Barnett Street, Montego Bay','Montego Bay','St. James', '876-952-3800', FALSE, TRUE),
('br-nht-may', 'biz-nht-001', 'May Pen',                'Main Street, May Pen',          'May Pen',    'Clarendon', '876-986-2345', FALSE, TRUE);

-- Services
INSERT INTO services (id, business_id, name, description, ticket_prefix, base_avg_time_minutes, is_active) VALUES
('svc-nht-ben', 'biz-nht-001', 'Benefits Enquiry',     'Check NHT contribution balance and benefit eligibility.', 'BEN', 15, TRUE),
('svc-nht-app', 'biz-nht-001', 'Loan Application',     'Apply for an NHT housing loan.',                          'LAN', 45, TRUE),
('svc-nht-reg', 'biz-nht-001', 'Contributor Registration', 'Register as a new NHT contributor.',                  'REG', 20, TRUE),
('svc-nht-pay', 'biz-nht-001', 'Contribution Payment', 'Make or verify NHT contribution payments.',               'PAY', 10, TRUE);

-- Counters (Kingston branch — 4 counters)
INSERT INTO counters (id, branch_id, service_id, counter_number, label, is_active) VALUES
('ctr-nht-kgn-1', 'br-nht-kgn', 'svc-nht-ben', 1, 'Counter 1 - Benefits',      TRUE),
('ctr-nht-kgn-2', 'br-nht-kgn', 'svc-nht-app', 2, 'Counter 2 - Loans',         TRUE),
('ctr-nht-kgn-3', 'br-nht-kgn', 'svc-nht-reg', 3, 'Counter 3 - Registration',  TRUE),
('ctr-nht-kgn-4', 'br-nht-kgn', 'svc-nht-pay', 4, 'Counter 4 - Payments',      TRUE);

-- Staff
INSERT INTO staff (id, business_id, branch_id, role_id, staff_code, full_name, email, assigned_service_id, is_active) VALUES
('stf-nht-001', 'biz-nht-001', 'br-nht-kgn', 'role-staff-001', 'NHT-0001', 'Keisha Morgan',  'keisha.morgan@nht.gov.jm',  'svc-nht-ben', TRUE),
('stf-nht-002', 'biz-nht-001', 'br-nht-kgn', 'role-staff-001', 'NHT-0002', 'Andrew Grant',   'andrew.grant@nht.gov.jm',   'svc-nht-app', TRUE),
('stf-nht-003', 'biz-nht-001', 'br-nht-kgn', 'role-mgr-001',   'NHT-0003', 'Patricia Lewis', 'patricia.lewis@nht.gov.jm', NULL,          TRUE),
('stf-nht-004', 'biz-nht-001', NULL,          'role-exec-001',  'NHT-0004', 'Clive Hamilton', 'clive.hamilton@nht.gov.jm', NULL,          TRUE);


-- =============================================================
-- BUSINESS 3: PASSPORT, IMMIGRATION & CITIZENSHIP AGENCY (PICA)
-- =============================================================

INSERT INTO businesses (id, name, slug, description, logo_url, subscription_tier_id, is_active) VALUES
('biz-pica-001', 'Passport, Immigration & Citizenship Agency', 'pica',
 'Issues Jamaican passports, manages immigration, and processes citizenship applications.',
 '/logos/pica.png', 'tier-pred-001', TRUE);

-- Branches
INSERT INTO branches (id, business_id, name, address, city, parish, phone, is_main_branch, is_active) VALUES
('br-pica-kgn', 'biz-pica-001', 'Kingston - Constant Spring', '25 Constant Spring Road, Kingston 10', 'Kingston', 'Kingston', '876-754-7422', TRUE, TRUE),
('br-pica-mob', 'biz-pica-001', 'Montego Bay',                '1 Sunset Boulevard, Montego Bay',       'Montego Bay','St. James','876-952-6789', FALSE, TRUE);

-- Services
INSERT INTO services (id, business_id, name, description, ticket_prefix, base_avg_time_minutes, is_active) VALUES
('svc-pica-new', 'biz-pica-001', 'New Passport Application',    'Apply for a first-time Jamaican passport.',            'NEW', 30, TRUE),
('svc-pica-ren', 'biz-pica-001', 'Passport Renewal',            'Renew an existing Jamaican passport.',                 'REN', 20, TRUE),
('svc-pica-vis', 'biz-pica-001', 'Visa Enquiry',                'Enquire about visa requirements and status.',          'VIS', 15, TRUE),
('svc-pica-cit', 'biz-pica-001', 'Citizenship Application',     'Apply for Jamaican citizenship.',                      'CIT', 45, TRUE),
('svc-pica-col', 'biz-pica-001', 'Passport Collection',         'Collect a completed passport.',                        'COL', 5,  TRUE);

-- Counters (Kingston branch — 5 counters)
INSERT INTO counters (id, branch_id, service_id, counter_number, label, is_active) VALUES
('ctr-pica-kgn-1', 'br-pica-kgn', 'svc-pica-new', 1, 'Counter 1 - New Applications', TRUE),
('ctr-pica-kgn-2', 'br-pica-kgn', 'svc-pica-ren', 2, 'Counter 2 - Renewals',         TRUE),
('ctr-pica-kgn-3', 'br-pica-kgn', 'svc-pica-vis', 3, 'Counter 3 - Visa Enquiries',   TRUE),
('ctr-pica-kgn-4', 'br-pica-kgn', 'svc-pica-cit', 4, 'Counter 4 - Citizenship',      TRUE),
('ctr-pica-kgn-5', 'br-pica-kgn', 'svc-pica-col', 5, 'Counter 5 - Collection',       TRUE);

-- Staff
INSERT INTO staff (id, business_id, branch_id, role_id, staff_code, full_name, email, assigned_service_id, is_active) VALUES
('stf-pica-001', 'biz-pica-001', 'br-pica-kgn', 'role-staff-001', 'PICA-0001', 'Nadine Campbell', 'nadine.campbell@pica.gov.jm', 'svc-pica-new', TRUE),
('stf-pica-002', 'biz-pica-001', 'br-pica-kgn', 'role-staff-001', 'PICA-0002', 'Omar Stewart',    'omar.stewart@pica.gov.jm',    'svc-pica-ren', TRUE),
('stf-pica-003', 'biz-pica-001', 'br-pica-kgn', 'role-staff-001', 'PICA-0003', 'Tanya Blake',     'tanya.blake@pica.gov.jm',     'svc-pica-col', TRUE),
('stf-pica-004', 'biz-pica-001', 'br-pica-kgn', 'role-mgr-001',   'PICA-0004', 'Errol Sinclair',  'errol.sinclair@pica.gov.jm',  NULL,           TRUE);


-- =============================================================
-- DEMO USERS (10 sample clients)
-- =============================================================

INSERT INTO users (id, email, full_name, phone, national_id, trn, date_of_birth) VALUES
('usr-001', 'john.smith@email.com',    'John Smith',    '876-555-0101', 'JM-1234567', '123-456-789', '1985-03-14'),
('usr-002', 'mary.jones@email.com',    'Mary Jones',    '876-555-0102', 'JM-2345678', '234-567-890', '1990-07-22'),
('usr-003', 'paul.brown@email.com',    'Paul Brown',    '876-555-0103', 'JM-3456789', '345-678-901', '1978-11-05'),
('usr-004', 'grace.white@email.com',   'Grace White',   '876-555-0104', 'JM-4567890', '456-789-012', '1995-01-30'),
('usr-005', 'david.green@email.com',   'David Green',   '876-555-0105', 'JM-5678901', '567-890-123', '1982-09-18'),
('usr-006', 'lisa.black@email.com',    'Lisa Black',    '876-555-0106', 'JM-6789012', '678-901-234', '1998-04-12'),
('usr-007', 'kevin.hall@email.com',    'Kevin Hall',    '876-555-0107', 'JM-7890123', '789-012-345', '1975-12-25'),
('usr-008', 'angela.king@email.com',   'Angela King',   '876-555-0108', 'JM-8901234', '890-123-456', '1988-06-08'),
('usr-009', 'mark.scott@email.com',    'Mark Scott',    '876-555-0109', 'JM-9012345', '901-234-567', '1993-02-17'),
('usr-010', 'denise.allen@email.com',  'Denise Allen',  '876-555-0110', 'JM-0123456', '012-345-678', '1970-08-03');


-- =============================================================
-- SAVED BUSINESSES (Mobile app favorites)
-- =============================================================

INSERT INTO saved_businesses (user_id, business_id) VALUES
('usr-001', 'biz-taj-001'),
('usr-001', 'biz-nht-001'),
('usr-002', 'biz-pica-001'),
('usr-003', 'biz-taj-001'),
('usr-004', 'biz-nht-001'),
('usr-005', 'biz-pica-001'),
('usr-005', 'biz-taj-001');


-- =============================================================
-- LIVE QUEUE DATA (Today's queues — for demo/testing)
-- =============================================================

-- TAJ Kingston — TRN Queue (today)
INSERT INTO queues (id, branch_id, service_id, queue_date, max_capacity, is_active) VALUES
('q-taj-trn-today', 'br-taj-kgn', 'svc-taj-trn', CURDATE(), 50, TRUE),
('q-taj-pay-today', 'br-taj-kgn', 'svc-taj-pay', CURDATE(), 30, TRUE),
('q-pica-new-today','br-pica-kgn','svc-pica-new', CURDATE(), 40, TRUE),
('q-pica-ren-today','br-pica-kgn','svc-pica-ren', CURDATE(), 40, TRUE),
('q-nht-ben-today', 'br-nht-kgn', 'svc-nht-ben', CURDATE(), 30, TRUE);

-- Intake forms
INSERT INTO intake_forms (id, service_id, user_id, form_data) VALUES
('iform-001', 'svc-taj-trn', 'usr-001', '{"purpose":"new_trn","national_id":"JM-1234567","dob":"1985-03-14"}'),
('iform-002', 'svc-taj-trn', 'usr-002', '{"purpose":"update_trn","national_id":"JM-2345678","dob":"1990-07-22"}'),
('iform-003', 'svc-taj-pay', 'usr-003', '{"payment_type":"income_tax","amount":15000}'),
('iform-004', 'svc-pica-new','usr-004', '{"application_type":"first_time","national_id":"JM-4567890"}'),
('iform-005', 'svc-pica-ren','usr-005', '{"passport_number":"A1234567","expiry_date":"2024-01-15"}'),
('iform-006', 'svc-nht-ben', 'usr-006', '{"enquiry_type":"balance_check","trn":"678-901-234"}');

-- Active tickets
INSERT INTO queue_tickets (id, queue_id, user_id, intake_form_id, ticket_number, verification_code, position, status, estimated_wait_minutes, joined_at, called_at, started_serving_at) VALUES
('tkt-001', 'q-taj-trn-today', 'usr-001', 'iform-001', 'TRN-A001', 'TRNA001', 1, 'in_service', 0,  DATE_SUB(NOW(), INTERVAL 45 MINUTE), DATE_SUB(NOW(), INTERVAL 5 MINUTE), DATE_SUB(NOW(), INTERVAL 4 MINUTE)),
('tkt-002', 'q-taj-trn-today', 'usr-002', 'iform-002', 'TRN-A002', 'TRNA002', 2, 'waiting',    20, DATE_SUB(NOW(), INTERVAL 30 MINUTE), NULL, NULL),
('tkt-003', 'q-taj-trn-today', 'usr-003', NULL,        'TRN-A003', 'TRNA003', 3, 'waiting',    40, DATE_SUB(NOW(), INTERVAL 20 MINUTE), NULL, NULL),
('tkt-004', 'q-taj-trn-today', 'usr-004', NULL,        'TRN-A004', 'TRNA004', 4, 'waiting',    60, DATE_SUB(NOW(), INTERVAL 10 MINUTE), NULL, NULL),
('tkt-005', 'q-taj-pay-today', 'usr-005', 'iform-003', 'PAY-A001', 'PAYA001', 1, 'in_service', 0,  DATE_SUB(NOW(), INTERVAL 8 MINUTE),  DATE_SUB(NOW(), INTERVAL 3 MINUTE), DATE_SUB(NOW(), INTERVAL 2 MINUTE)),
('tkt-006', 'q-pica-new-today','usr-006', 'iform-004', 'NEW-A001', 'NEWA001', 1, 'in_service', 0,  DATE_SUB(NOW(), INTERVAL 25 MINUTE), DATE_SUB(NOW(), INTERVAL 6 MINUTE), DATE_SUB(NOW(), INTERVAL 5 MINUTE)),
('tkt-007', 'q-pica-ren-today','usr-007', 'iform-005', 'REN-A001', 'RENA001', 1, 'waiting',    20, DATE_SUB(NOW(), INTERVAL 15 MINUTE), NULL, NULL),
('tkt-008', 'q-nht-ben-today', 'usr-008', 'iform-006', 'BEN-A001', 'BENA001', 1, 'in_service', 0,  DATE_SUB(NOW(), INTERVAL 12 MINUTE), DATE_SUB(NOW(), INTERVAL 4 MINUTE), DATE_SUB(NOW(), INTERVAL 3 MINUTE));

-- Queue events for active tickets
INSERT INTO queue_events (id, ticket_id, previous_status, new_status, triggered_by_staff_id) VALUES
('evt-001', 'tkt-001', 'waiting',  'in_service', 'stf-taj-001'),
('evt-002', 'tkt-005', 'waiting',  'in_service', 'stf-taj-003'),
('evt-003', 'tkt-006', 'waiting',  'in_service', 'stf-pica-001'),
('evt-004', 'tkt-008', 'waiting',  'in_service', 'stf-nht-001');


-- =============================================================
-- HISTORICAL WAIT-TIME RECORDS
-- 90 days of sample data for the predictive model.
-- Pattern: Mon-Fri, 8am-4pm, realistic peaks at 9am and 1pm.
-- =============================================================

-- This procedure generates 90 days of realistic wait-time records.
DELIMITER $$

CREATE PROCEDURE generate_historical_data()
BEGIN
    DECLARE i INT DEFAULT 0;
    DECLARE visit_date DATE;
    DECLARE dow TINYINT;
    DECLARE hour_val TINYINT;
    DECLARE wait_min DECIMAL(10,2);
    DECLARE svc_min DECIMAL(10,2);
    DECLARE queue_len INT;
    DECLARE staff_cnt INT;
    DECLARE ticket_status VARCHAR(50);
    DECLARE rec_id CHAR(36);
    DECLARE fake_ticket_id CHAR(36);

    WHILE i < 1500 DO
        -- Random date in last 90 days
        SET visit_date = DATE_SUB(CURDATE(), INTERVAL FLOOR(RAND() * 90) DAY);
        SET dow = DAYOFWEEK(visit_date) - 1; -- 0=Sunday

        -- Skip weekends (TAJ is Mon-Fri)
        IF dow BETWEEN 1 AND 5 THEN
            -- Weighted hour: peak 9am and 1pm
            SET hour_val = CASE
                WHEN RAND() < 0.15 THEN 8
                WHEN RAND() < 0.35 THEN 9
                WHEN RAND() < 0.50 THEN 10
                WHEN RAND() < 0.60 THEN 11
                WHEN RAND() < 0.70 THEN 12
                WHEN RAND() < 0.85 THEN 13
                WHEN RAND() < 0.92 THEN 14
                ELSE 15
            END;

            -- Wait time increases at peak hours
            SET wait_min = CASE
                WHEN hour_val IN (9, 13) THEN 15 + RAND() * 30
                WHEN hour_val IN (8, 14) THEN 5  + RAND() * 15
                ELSE 8 + RAND() * 20
            END;

            SET svc_min    = 10 + RAND() * 25;
            SET queue_len  = FLOOR(wait_min / 5) + FLOOR(RAND() * 5);
            SET staff_cnt  = CASE WHEN hour_val IN (9,13) THEN 4 ELSE 2 + FLOOR(RAND() * 2) END;

            -- 85% completed, 10% cancelled, 5% no-show
            SET ticket_status = CASE
                WHEN RAND() < 0.85 THEN 'completed'
                WHEN RAND() < 0.95 THEN 'cancelled'
                ELSE 'no_show'
            END;

            SET rec_id          = UUID();
            SET fake_ticket_id  = UUID();

            -- Alternate between TAJ and PICA records
            IF i MOD 2 = 0 THEN
                INSERT INTO wait_time_records
                    (id, ticket_id, business_id, branch_id, service_id, visit_date, day_of_week, hour_of_day, month_of_year, wait_time_minutes, service_time_minutes, status, staff_count_at_time, queue_length_at_time, active_counters_at_time)
                VALUES
                    (rec_id, fake_ticket_id, 'biz-taj-001', 'br-taj-kgn', 'svc-taj-trn', visit_date, dow, hour_val, MONTH(visit_date), wait_min, svc_min, ticket_status, staff_cnt, queue_len, staff_cnt);
            ELSE
                INSERT INTO wait_time_records
                    (id, ticket_id, business_id, branch_id, service_id, visit_date, day_of_week, hour_of_day, month_of_year, wait_time_minutes, service_time_minutes, status, staff_count_at_time, queue_length_at_time, active_counters_at_time)
                VALUES
                    (rec_id, fake_ticket_id, 'biz-pica-001', 'br-pica-kgn', 'svc-pica-new', visit_date, dow, hour_val, MONTH(visit_date), wait_min, svc_min, ticket_status, staff_cnt, queue_len, staff_cnt);
            END IF;
        END IF;

        SET i = i + 1;
    END WHILE;
END$$

DELIMITER ;

CALL generate_historical_data();
DROP PROCEDURE generate_historical_data;


-- =============================================================
-- ANALYTICS SUMMARIES (Last 7 days — pre-calculated)
-- =============================================================

INSERT INTO analytics_summaries
    (id, business_id, branch_id, service_id, summary_date, total_visitors, completed_count, cancelled_count, no_show_count, avg_wait_time_minutes, avg_service_time_minutes, peak_hour)
SELECT
    UUID(),
    business_id,
    branch_id,
    service_id,
    visit_date,
    COUNT(*),
    SUM(status = 'completed'),
    SUM(status = 'cancelled'),
    SUM(status = 'no_show'),
    ROUND(AVG(wait_time_minutes), 2),
    ROUND(AVG(service_time_minutes), 2),
    (SELECT hour_of_day FROM wait_time_records w2
     WHERE w2.business_id = w1.business_id AND w2.visit_date = w1.visit_date
     GROUP BY hour_of_day ORDER BY COUNT(*) DESC LIMIT 1)
FROM wait_time_records w1
WHERE visit_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
GROUP BY business_id, branch_id, service_id, visit_date;


-- =============================================================
-- SAMPLE PREDICTIVE RESULTS (Jupyter model output)
-- =============================================================

INSERT INTO predictive_results (id, business_id, branch_id, insight_type, insight_data, model_version) VALUES
('pred-taj-001', 'biz-taj-001', 'br-taj-kgn', 'best_time_to_visit',
 JSON_OBJECT(
    'generated_at', NOW(),
    'recommended_slots', JSON_ARRAY(
        JSON_OBJECT('day', 2, 'day_name', 'Tuesday',   'hour', 10, 'score', 92, 'reason', 'low traffic + short wait'),
        JSON_OBJECT('day', 3, 'day_name', 'Wednesday', 'hour', 14, 'score', 88, 'reason', 'low traffic + short wait'),
        JSON_OBJECT('day', 4, 'day_name', 'Thursday',  'hour', 8,  'score', 85, 'reason', 'early morning, minimal queue')
    ),
    'summary', 'Best time to visit TAJ Kingston is Tuesday at 10:00 AM. Average wait is under 12 minutes.'
 ),
 'v1.0'),

('pred-pica-001', 'biz-pica-001', 'br-pica-kgn', 'best_time_to_visit',
 JSON_OBJECT(
    'generated_at', NOW(),
    'recommended_slots', JSON_ARRAY(
        JSON_OBJECT('day', 4, 'day_name', 'Thursday', 'hour', 8,  'score', 94, 'reason', 'early morning, minimal queue'),
        JSON_OBJECT('day', 2, 'day_name', 'Tuesday',  'hour', 14, 'score', 87, 'reason', 'post-lunch lull')
    ),
    'summary', 'Best time to visit PICA Kingston is Thursday at 8:00 AM. Average wait is under 10 minutes.'
 ),
 'v1.0');


-- =============================================================
-- VISIT HISTORY (Denormalized, for user-facing history feed)
-- =============================================================

INSERT INTO visit_history (id, user_id, ticket_id, business_id, branch_id, service_id, business_name, branch_name, service_name, ticket_number, visit_date, wait_time_minutes, service_time_minutes, status) VALUES
('vh-001', 'usr-001', 'tkt-001', 'biz-taj-001',  'br-taj-kgn',  'svc-taj-trn',  'Tax Administration Jamaica', 'Kingston - Half Way Tree', 'TRN Registration', 'TRN-A001', CURDATE(), NULL, NULL, 'serving'),
('vh-002', 'usr-003', UUID(),    'biz-taj-001',  'br-taj-kgn',  'svc-taj-pay',  'Tax Administration Jamaica', 'Kingston - Half Way Tree', 'Tax Payments',     'PAY-Z099', DATE_SUB(CURDATE(), INTERVAL 7 DAY), 8, 12, 'completed'),
('vh-003', 'usr-004', UUID(),    'biz-pica-001', 'br-pica-kgn', 'svc-pica-ren', 'PICA',                       'Kingston - Constant Spring','Passport Renewal', 'REN-B014', DATE_SUB(CURDATE(), INTERVAL 14 DAY), 22, 18, 'completed'),
('vh-004', 'usr-005', UUID(),    'biz-nht-001',  'br-nht-kgn',  'svc-nht-ben',  'National Housing Trust',     'Kingston - Head Office',   'Benefits Enquiry', 'BEN-C007', DATE_SUB(CURDATE(), INTERVAL 21 DAY), 15, 14, 'completed'),
('vh-005', 'usr-001', UUID(),    'biz-taj-001',  'br-taj-kgn',  'svc-taj-inc',  'Tax Administration Jamaica', 'Kingston - Half Way Tree', 'Income Tax Filing', 'INC-A033', DATE_SUB(CURDATE(), INTERVAL 30 DAY), 35, 28, 'completed');


-- =============================================================
-- SAMPLE NOTIFICATIONS
-- =============================================================

INSERT INTO notifications (id, user_id, ticket_id, notification_type, channel, message, is_read) VALUES
('notif-001', 'usr-001', 'tkt-001', 'called',        'push', 'You are being called! Please proceed to Window 1.', FALSE),
('notif-002', 'usr-002', 'tkt-002', 'next_in_line',  'push', 'You are next in line for TRN Registration. Get ready!', FALSE),
('notif-003', 'usr-003', 'tkt-003', 'position_update','push','Your position is now #2. Estimated wait: 20 minutes.', TRUE),
('notif-004', 'usr-007', 'tkt-007', 'delay',         'push', 'Wait time has increased to 35 minutes due to high demand.', FALSE);

SET FOREIGN_KEY_CHECKS = 1;
