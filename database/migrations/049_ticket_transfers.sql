-- 049_ticket_transfers.sql — moving a person from one line to another.
--
-- A hospital sends a patient from triage to radiology; a tax office sends a
-- customer from the assessment desk to the cashier. Rejoining at the back of the
-- next line would punish them for something the branch decided, so staff
-- transfer them instead (POST /api/tickets/:id/transfer).
--
-- A transfer closes the ticket in the old line (status 'served', closed_reason
-- 'transferred' — the desk was occupied and that service time is real) and opens
-- a NEW ticket in the new line, with that line's own prefix (RAD-004, not
-- TRI-012), so the board and the line stay consistent. The two are linked both
-- ways so either side can find the other: the patient's phone follows the link
-- forward, and the next desk sees where the person came from.
--
-- journey_started_at is when the person first arrived, carried across every
-- hop. The new line places them by it, as if they had joined that line when
-- they walked in — never at the back, never ahead of someone who was there first.
--
-- transfer_note is the optional handover for the next desk ("chest X-ray, left
-- side"). Staff-only: it is never sent to the patient and never appears in
-- reports.
ALTER TABLE queue_tickets
  ADD COLUMN transferred_from_ticket_id CHAR(36)     NULL,
  ADD COLUMN transferred_to_ticket_id   CHAR(36)     NULL,
  ADD COLUMN transfer_note              VARCHAR(200) NULL,
  ADD COLUMN journey_started_at         DATETIME     NULL,
  ADD INDEX idx_tickets_transferred_from (transferred_from_ticket_id);
