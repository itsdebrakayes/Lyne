/**
 * auditLog.js — Audit logging for sensitive data access in LYNE
 *
 * Logs all sensitive reads and writes to the audit_logs table.
 * This middleware should be applied to any route that accesses or
 * modifies sensitive data: TRN, national ID, customer profiles,
 * OCR submissions, and staff records.
 *
 * Usage:
 *   const { auditLog } = require('../middleware/auditLog');
 *   router.get('/customers/:id', requireAuth, auditLog('read_customer'), handler);
 *
 * Log schema (audit_logs table):
 *   id, actor_id, actor_type, action, resource_type, resource_id,
 *   ip_address, user_agent, created_at
 */
const { randomUUID: uuidv4 } = require('crypto');
const pool = require('../db/pool');

/**
 * Create an audit log middleware for a specific action.
 *
 * @param {string} action - The action being performed (e.g., 'read_customer', 'update_staff')
 * @param {string} resourceType - The type of resource (e.g., 'customer', 'staff', 'ocr_submission')
 * @param {Function} [getResourceId] - Optional function(req) => string to extract resource ID
 * @param {{ anonymous?: boolean }} [options] - anonymous: record only that the action
 *   happened and when. Used for account deletion, where keeping the person's ID, IP
 *   address or device would defeat the deletion the record is proof of.
 * @returns {Function} Express middleware
 */
function auditLog(action, resourceType, getResourceId, { anonymous = false } = {}) {
  return async (req, _res, next) => {
    // Fire-and-forget — do not block the request
    setImmediate(async () => {
      try {
        const actorId   = anonymous ? null : (req.dbStaff?.id || req.dbUser?.id || null);
        const actorType = req.dbStaff ? 'staff' : (req.dbUser ? 'user' : 'anonymous');
        const businessId = req.dbStaff?.business_id || req.body?.business_id || req.query?.business_id || null;
        const resourceId = anonymous ? null : (getResourceId ? getResourceId(req) : (req.params.id || null));
        const ipAddress  = anonymous ? null : (req.ip || req.connection?.remoteAddress || null);
        const userAgent  = anonymous ? null : (req.headers['user-agent'] || null);

        await pool.query(
          `INSERT INTO audit_logs
             (id, actor_id, actor_type, business_id, action, resource_type, resource_id, ip_address, user_agent)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [uuidv4(), actorId, actorType, businessId, action, resourceType, resourceId, ipAddress, userAgent]
        );
      } catch (err) {
        // Never let audit logging break the main request
        console.error('[AuditLog] Failed to write audit log:', err.message);
      }
    });
    next();
  };
}

module.exports = { auditLog };
