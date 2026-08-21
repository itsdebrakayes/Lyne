-- =============================================================
-- 026 — Two sectors 024 did not anticipate
--
-- 024 shipped four sector rows. Qualification research on 2026-07-30 found two
-- of the strongest prospects do not fit any of them.
--
-- MICROFINANCE. 024 has one financial row, financial_services, worded for a
-- credit union: Member, Member Number. Access Financial is not a credit union
-- and does not have members — it has customers with loans, seen by a loan
-- officer. Seeding Access under financial_services would put "Members Served"
-- on a microfinance branch manager's dashboard, which is the exact category of
-- error 024 was written to prevent. A credit union and a microfinance lender
-- are different organisations that happen to share an industry.
--
-- JUDICIARY. A court is not a shop and the retail register grates badly in a
-- justice setting — "Customers Served" on a traffic court dashboard would be
-- wrong in a way a Court Administrator would notice immediately. The words here
-- are the judiciary's own: the Parish Court's customer service charter calls
-- members of the public COURT USERS, and the Traffic Court DIVISION supplies
-- the word for a group of counters. A person queues about a MATTER, not a
-- service. The identifier is the ticket number, because that is the one thing
-- every motorist arriving at a public day is actually holding.
--
-- Both rows follow 024's conventions exactly, including that identifier_label
-- is only populated where the organisation genuinely asks for one at the desk.
-- =============================================================

INSERT IGNORE INTO sector_profiles
  (sector, label, visitor_singular, visitor_plural, location_singular, location_plural,
   service_singular, service_plural, server_singular, server_plural,
   identifier_label, identifier_hint, section_singular, section_plural)
VALUES
('microfinance', 'Microfinance Institution',
 'Customer', 'Customers', 'Branch', 'Branches', 'Service', 'Services',
 'Loan Officer', 'Loan Officers',
 'Customer Number', 'The number on your account or loan statement',
 'Section', 'Sections'),

('judiciary', 'Court',
 'Court User', 'Court Users', 'Court', 'Courts', 'Matter', 'Matters',
 'Court Clerk', 'Court Clerks',
 'Ticket Number', 'The number printed on your traffic ticket or summons',
 'Division', 'Divisions');
