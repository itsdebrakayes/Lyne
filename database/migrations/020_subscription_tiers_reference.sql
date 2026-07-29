-- =============================================================
-- 020 — Subscription tiers as reference data
--
-- The five plans are part of the PRODUCT, not part of the demo. They were
-- only ever inserted by database/seed.sql, which production deliberately does
-- not mount ("demo seed data belongs on the demo branch only") — so a fresh
-- production database came up with an empty subscription_tiers table.
--
-- businesses.subscription_tier_id is NOT NULL with a foreign key onto this
-- table, and POST /businesses rejects a request without one. The practical
-- effect was that a brand-new install could not create its first business at
-- all: the very first thing a customer does was impossible.
--
-- INSERT IGNORE so this is safe to re-run and safe on a demo box that already
-- loaded seed.sql — the ids are the same rows, not duplicates.
-- =============================================================

INSERT IGNORE INTO subscription_tiers
  (id, name, label, description,
   can_view_analytics, can_view_predictions, can_view_multi_branch, can_view_executive_reports,
   max_branches, max_staff)
VALUES
('tier-basic-001', 'basic',        'Basic',        'Live queue display only.',
  FALSE, FALSE, FALSE, FALSE,   1,    5),
('tier-adv-001',   'advanced',     'Advanced',     'Live queues + historical analytics dashboards.',
  TRUE,  FALSE, FALSE, FALSE,   3,   20),
('tier-pred-001',  'predictions',  'Predictions',  'Advanced + AI-powered best-time predictions.',
  TRUE,  TRUE,  FALSE, FALSE,   5,   50),
('tier-multi-001', 'multi_branch', 'Multi-Branch', 'Predictions + cross-branch manager views.',
  TRUE,  TRUE,  TRUE,  FALSE,  20,  200),
('tier-exec-001',  'executive',    'Executive',    'Full platform: executive dashboards + scheduled reports.',
  TRUE,  TRUE,  TRUE,  TRUE,   999, 9999);
