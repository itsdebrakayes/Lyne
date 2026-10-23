-- =============================================================
-- 041 — Commercial banks
--
-- financial_services (024) is worded for a credit union: Member, Member Number.
-- microfinance (026) is worded for a lender: Loan Officer, Customer Number.
-- Neither fits a commercial bank, which is the conversation Lyne is now in.
--
-- The words are the banks' own. Scotiabank's group strategy speaks of "earning
-- primary CLIENT relationships", and Jamaican banks call the people at the desk
-- banking officers or representatives rather than "officers" in the
-- government sense. Services sit in departments (Teller Services, Personal
-- Banking, Business Banking).
--
-- identifier_label is NULL on purpose. A queue app has no business asking for
-- an account or card number, and a bank's security team would rightly stop a
-- pilot that did. The officer looks the client up at the desk, as today.
-- Contains no organisation data; safe on production.
-- =============================================================

INSERT IGNORE INTO sector_profiles
  (sector, label, visitor_singular, visitor_plural, location_singular, location_plural,
   service_singular, service_plural, server_singular, server_plural,
   identifier_label, identifier_hint, section_singular, section_plural)
VALUES
('banking', 'Commercial Bank',
 'Client', 'Clients', 'Branch', 'Branches', 'Service', 'Services',
 'Banking Officer', 'Banking Officers',
 NULL, NULL,
 'Department', 'Departments');
