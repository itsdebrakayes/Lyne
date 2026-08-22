-- ============================================================
-- 013_staff_requests.sql
--
-- Managers request staff; DKS Technologies approves.
--
-- The invite flow already generated a code the moment a manager asked for one,
-- which meant a branch manager could create working accounts inside their
-- business without anyone at DKS seeing it. For the pilot, DKS gatekeeps: a
-- manager's submission lands as `requested` and produces no usable code until
-- someone at DKS approves it.
--
-- Deliberately NOT added: any column for a manager-chosen password. A password
-- known to the person who requested the account destroys the audit trail that
-- tenant isolation depends on — every action by that staff member becomes
-- deniable. Staff still set their own password when they redeem the code.
-- ============================================================

ALTER TABLE staff_invites
  MODIFY COLUMN status ENUM('requested','pending','redeemed','revoked','expired','declined')
    NOT NULL DEFAULT 'requested';

ALTER TABLE staff_invites
  ADD COLUMN requested_note   VARCHAR(500) NULL AFTER role,
  ADD COLUMN approved_at      TIMESTAMP    NULL AFTER redeemed_by_staff_id,
  ADD COLUMN approved_by      VARCHAR(255) NULL AFTER approved_at,
  ADD COLUMN decline_reason   VARCHAR(500) NULL AFTER approved_by;

-- Existing rows were created under the old model, where 'pending' already meant
-- "code is live". Leave them usable.
