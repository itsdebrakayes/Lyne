-- 051_public_insights.sql — the organisation decides how much timing detail the
-- public sees. (11 November 2026)
--
-- Raised by Robert Lawrence after the 10 Nov demo: if "tax office, two-hour wait,
-- best time Wednesday" reaches the press before management has seen it, that is
-- the organisation's exposure, not Lyne's. The organisation must decide.
--
--   'full'    — what everyone sees today while Lyne is free: best times, the
--               hour-by-hour heatmap, the week planner, the busiest hour and
--               personal recommendations. The default, so nothing changes for
--               any organisation until its executive chooses otherwise.
--   'limited' — what the public saw before Lyne 1.0 opened every premium gate:
--               the headline best time for the branch and for each service,
--               and today's shape, and nothing deeper. No heatmap, no week
--               planner, no busiest hour, no personal recommendations, and the
--               public predictions feed serves only best_time_to_visit.
--
-- Live queue lengths and current waits are not affected: they are what a person
-- needs to decide whether to join, and they describe now, not a pattern.
--
-- Changed only by an executive, through PUT /api/settings/public-insights,
-- which writes an audit_logs row naming the new level.
--
-- Additive and safe to apply before or after the code that reads it (the code
-- treats a missing column as 'full'). PRODUCTION: backup first, owner's approval.

ALTER TABLE businesses
  ADD COLUMN public_insights ENUM('full', 'limited') NOT NULL DEFAULT 'full';
