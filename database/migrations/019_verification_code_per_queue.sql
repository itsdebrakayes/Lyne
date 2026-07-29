-- Scope ticket verification codes to their queue.
--
-- The code is a six-digit number a customer reads off their phone, or off a
-- printed kiosk ticket, and a clerk types at the counter. Six digits is 900,000
-- values — plenty for one service on one day, nowhere near enough to stay
-- unique across every ticket a branch will ever issue.
--
-- The old index was UNIQUE across the whole table, which forced codes to be
-- globally distinct forever and would have started failing inserts once a busy
-- branch had been running for a while. A code only ever has to be unambiguous
-- among the tickets it could be confused with: same queue, which means the same
-- service on the same day. Scoping the constraint lets codes recycle safely.

ALTER TABLE queue_tickets DROP INDEX idx_tickets_verification_code;

ALTER TABLE queue_tickets
  ADD UNIQUE INDEX idx_tickets_queue_verification (queue_id, verification_code);

-- Lookups by code are always inside a queue, so this index serves them too.
