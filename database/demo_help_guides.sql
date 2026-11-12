-- demo_help_guides.sql — DEMO ONLY. Never on production (CLAUDE.md rule 4).
--
-- The short names and Help-centre guides for the demo organisations. Until
-- migration 040 these were written into the mobile app itself (ORG_ACRONYM in
-- mobileData.ts, AGENCY_GUIDES in helpContent.ts), which shipped three real
-- government bodies' details in every public build. They now live here, on the
-- demo database only; a real client's are entered when it is onboarded.
--
-- Updates only, so it is safe to run again at any time and after any seed.
-- Needs migration 040. On the demo server:
--   docker exec -i lyne_demo_db sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" lyne' < database/demo_help_guides.sql

-- Short names (the tile acronym)
UPDATE businesses SET short_name = 'TAJ' WHERE id = 'biz-taj-001'; -- Tax Administration Jamaica
UPDATE businesses SET short_name = 'PICA' WHERE id = 'biz-pica-001'; -- Passport Office of Jamaica
UPDATE businesses SET short_name = 'NHT' WHERE id = 'biz-nht-001'; -- National Housing Trust
UPDATE businesses SET short_name = 'CFC' WHERE id = 'biz-cfcu-001'; -- Community First Credit Union
UPDATE businesses SET short_name = 'FHC' WHERE id = 'biz-fhc-001'; -- First Heritage Co-operative Credit Union
UPDATE businesses SET short_name = 'UTECH' WHERE id = 'biz-utech-001'; -- University of Technology, Jamaica
UPDATE businesses SET short_name = 'UWI' WHERE id = 'biz-uwi-001'; -- The University of the West Indies, Mona
UPDATE businesses SET short_name = 'TCJ' WHERE id = 'biz-court-001'; -- Traffic Court of Jamaica

-- Help-centre guides
UPDATE businesses SET help_guide = '{
  "hours": "Monday – Friday, 8:30 AM – 4:00 PM",
  "hoursNote": "Some locations stay open to 5:00 PM. Closed weekends and public holidays.",
  "general": "Many services, including payments and some registrations, can be done online at jamaicatax.gov.jm. However, TRN cards and certain registrations must be collected in person.",
  "services": [
    {
      "name": "TRN registration",
      "documents": [
        "A valid photo ID: passport, driver’s licence, national ID, or voter’s ID",
        "A completed TRN application form",
        "For a minor: the child’s birth certificate"
      ],
      "jp": "If you’re applying on behalf of someone else (or a minor), the application form and ID copies must be certified by a Justice of the Peace.",
      "jpRequired": true
    },
    {
      "name": "Driver’s licence & motor vehicle",
      "documents": [
        "Your TRN",
        "A valid photo ID",
        "The relevant vehicle or licence documents (title, fitness, etc.)"
      ],
      "jp": "No JP certification needed for standard renewals.",
      "jpRequired": false
    },
    {
      "name": "Tax payments",
      "documents": [
        "Your TRN",
        "Your assessment or reference number",
        "Payment: cash, card, or manager’s cheque"
      ],
      "jp": "No JP certification required.",
      "jpRequired": false
    }
  ]
}'
WHERE id = 'biz-taj-001';

UPDATE businesses SET help_guide = '{
  "hours": "Monday – Friday, 8:00 AM – 4:00 PM",
  "hoursNote": "Closed weekends and public holidays. Arrive early on Mondays and month-end.",
  "general": "Where possible, book and pay for passport services online before visiting. Always bring the originals plus one photocopy of each document.",
  "services": [
    {
      "name": "New or renewal passport",
      "documents": [
        "Your birth certificate",
        "A valid photo ID",
        "Two passport-sized photographs",
        "A completed application form",
        "For a first passport: proof of Jamaican citizenship"
      ],
      "jp": "Your photographs and application form must be signed and certified by a Justice of the Peace or other authorized person.",
      "jpRequired": true
    },
    {
      "name": "Citizenship & immigration",
      "documents": [
        "Supporting civil documents (birth / marriage certificates)",
        "A valid photo ID",
        "Any relevant status or residency documents"
      ],
      "jp": "Copies of your supporting documents usually need to be certified by a JP.",
      "jpRequired": true
    }
  ]
}'
WHERE id = 'biz-pica-001';

UPDATE businesses SET help_guide = '{
  "hours": "Monday – Friday, 8:00 AM – 4:00 PM",
  "hoursNote": "Closed weekends and public holidays.",
  "general": "Check your contributions and refund eligibility online before visiting. Refunds are typically claimable after a set number of years of contributions.",
  "services": [
    {
      "name": "Contributions refund",
      "documents": [
        "Your TRN",
        "A valid photo ID",
        "Your NHT number, if you have it"
      ],
      "jp": "No JP certification required for a standard refund.",
      "jpRequired": false
    },
    {
      "name": "Mortgage / loan application",
      "documents": [
        "Your TRN",
        "A valid photo ID",
        "Proof of income: job letter and recent payslips",
        "Proof of your NHT contributions"
      ],
      "jp": "Some supporting documents, such as a statutory declaration, may need to be signed before a JP.",
      "jpRequired": true
    }
  ]
}'
WHERE id = 'biz-nht-001';

