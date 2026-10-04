-- demo_open_now.sql — open the demo estate for a demo that is not in office hours.
--
-- The demo branches keep real Jamaican office hours (demo_active_seed.sql), so
-- outside them the app correctly reads Closed and joining is gated. That is the
-- product working. It is also, occasionally, the wrong thing to be looking at:
-- an investor call at 8pm, a rehearsal on a Sunday afternoon.
--
-- This widens every demo branch to around the clock for exactly that. It is a
-- separate file and not the default because the default should be the truth.
--
--     mysql ... lyne < database/demo_open_now.sql        # open it up
--     mysql ... lyne < database/demo_active_seed.sql     # put it back
--
-- Re-running the seed restores the real hours, which is why there is no undo
-- script here — the undo is the thing that was already correct.
--
-- ⚠ DEMO DATABASE ONLY. Nothing here belongs anywhere near production: real
-- tenants set their hours in the admin app, and a branch that never closes
-- stops the daily sweep from ever expiring a stale ticket.
--
-- Note what this does NOT fix: the 90-day history still only has records for
-- the hours and weekdays the branches really keep, so a Sunday evening will
-- show live queues with an empty Smart Timing. That is the better failure —
-- inventing Sunday history is what made "best time to visit" name a day the
-- office has never opened. If you need a weekend story, create a SCHEDULED
-- SESSION dated that weekend; that is a real feature and it demos properly.

UPDATE branches
   SET opening_time = '00:00:00',
       closing_time = '23:59:59',
       open_days    = '0,1,2,3,4,5,6';

SELECT CONCAT(
  'Demo estate opened around the clock for ', COUNT(*), ' branches. ',
  'Re-run demo_active_seed.sql to restore real office hours.'
) AS status
FROM branches;
