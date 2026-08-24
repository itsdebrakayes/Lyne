-- =============================================================
-- 021 — Notifications addressed to STAFF, not just customers
--
-- notifications.user_id references users(id) and is NOT NULL, so every
-- notification in the system could only ever be addressed to a customer.
-- There was no way to tell a supervisor anything — which is why the manager's
-- "Assign A Counter" button had nowhere to send its request and did nothing.
--
-- A manager should not be reaching into a section and moving people themselves;
-- that is the supervisor's job. So the manager needs to be able to ASK, and the
-- ask has to land somewhere the supervisor will see it.
--
-- user_id becomes nullable and staff_id joins it. Exactly one is set: a
-- notification is either for a customer or for a member of staff.
-- =============================================================

ALTER TABLE notifications
  MODIFY COLUMN user_id CHAR(36) NULL,
  ADD COLUMN staff_id CHAR(36) NULL AFTER user_id,
  ADD COLUMN sent_by_staff_id CHAR(36) NULL AFTER staff_id;

ALTER TABLE notifications
  ADD CONSTRAINT fk_notifications_staff
    FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_notifications_sender
    FOREIGN KEY (sent_by_staff_id) REFERENCES staff(id) ON DELETE SET NULL;

-- Addressed to somebody. Without this a row with neither set is invisible to
-- every reader and silently lost.
ALTER TABLE notifications
  ADD CONSTRAINT chk_notifications_addressee
    CHECK (user_id IS NOT NULL OR staff_id IS NOT NULL);

-- The unread-badge query is "mine, newest first" for both kinds of recipient.
CREATE INDEX idx_notifications_staff_unread
  ON notifications (staff_id, is_read, sent_at);
