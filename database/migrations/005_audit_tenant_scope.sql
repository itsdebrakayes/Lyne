-- Attach audit records to the company context that produced them.
ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS business_id CHAR(36) NULL AFTER actor_type,
  ADD INDEX IF NOT EXISTS idx_audit_business_created (business_id, created_at);

