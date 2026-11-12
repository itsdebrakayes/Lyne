/**
 * orgExport.js — an executive downloads everything their organisation owns.
 *
 *   GET  /api/export/organisation   what the export would contain (files, row counts)
 *   POST /api/export/organisation   the export itself: one .zip of CSV files
 *
 * Executive only, and ALWAYS the caller's own organisation: no business_id is
 * read from the request (a platform administrator may name one in the query).
 * Every download writes an audit_logs row first; if that row cannot be written
 * the export is refused, because a full copy of an organisation's records
 * leaving the system must never be unrecorded.
 *
 * One export per organisation at a time, and one a minute: it reads the whole
 * history, and a double-click must not run it twice.
 */
const express = require('express');
const { randomUUID } = require('crypto');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { requireStaffRole, isPlatformAdmin } = require('../middleware/tenantAccess');
const { exportSummary, writeExport } = require('../lib/organisationExport');
const { ZipWriter } = require('../utils/zip');

const router = express.Router();

const COOL_DOWN_MS = 60_000;
const running = new Set();
const lastRun = new Map();

function businessFor(req) {
  if (isPlatformAdmin(req) && typeof req.query.business_id === 'string' && req.query.business_id) return req.query.business_id;
  return req.dbStaff?.business_id || null;
}

router.get('/organisation', requireAuth, requireStaffRole('executive'), async (req, res) => {
  try {
    const businessId = businessFor(req);
    if (!businessId) return res.status(403).json({ error: 'Your account is not attached to an organisation.' });
    const files = await exportSummary(businessId);
    const [last] = await pool.query(
      `SELECT al.created_at, st.full_name
         FROM audit_logs al LEFT JOIN staff st ON st.id = al.actor_id
        WHERE al.business_id = ? AND al.action = 'organisation_export'
        ORDER BY al.created_at DESC LIMIT 1`,
      [businessId]
    );
    res.json({
      files,
      total_rows: files.reduce((n, f) => n + f.rows, 0),
      last_exported_at: last[0]?.created_at || null,
      last_exported_by: last[0]?.full_name || null,
    });
  } catch (err) {
    console.error('[OrgExport] summary:', err.message);
    res.status(500).json({ error: 'Could not prepare the export summary.' });
  }
});

router.post('/organisation', requireAuth, requireStaffRole('executive'), async (req, res) => {
  const businessId = businessFor(req);
  if (!businessId) return res.status(403).json({ error: 'Your account is not attached to an organisation.' });
  if (running.has(businessId)) return res.status(409).json({ error: 'An export is already being prepared. Wait for it to finish.' });
  const since = Date.now() - (lastRun.get(businessId) || 0);
  if (since < COOL_DOWN_MS) {
    res.set('Retry-After', String(Math.ceil((COOL_DOWN_MS - since) / 1000)));
    return res.status(429).json({ error: 'An export was just made. Try again in a minute.' });
  }

  running.add(businessId);
  try {
    const [biz] = await pool.query('SELECT name, slug FROM businesses WHERE id = ? LIMIT 1', [businessId]);
    if (!biz.length) return res.status(404).json({ error: 'Organisation not found.' });

    // Recorded first: no record, no export.
    await pool.query(
      `INSERT INTO audit_logs (id, actor_id, actor_type, business_id, action, resource_type, resource_id, ip_address, user_agent)
       VALUES (?, ?, 'staff', ?, 'organisation_export', 'business', ?, ?, ?)`,
      [randomUUID(), req.dbStaff.id, businessId, businessId, req.ip || null, req.headers['user-agent'] || null]
    );

    const at = new Date();
    // Compressed a page at a time: the compressed archive is all that is held.
    const zip = new ZipWriter(at);
    await writeExport(businessId, { organisationName: biz[0].name, requestedBy: req.dbStaff.full_name, at }, zip);
    const archive = zip.finish();
    lastRun.set(businessId, Date.now());

    const stamp = at.toISOString().slice(0, 10);
    const safeSlug = String(biz[0].slug || 'organisation').replace(/[^a-z0-9-]/gi, '-').slice(0, 60);
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="lyne-export-${safeSlug}-${stamp}.zip"`,
      'Content-Length': String(archive.length),
      'Cache-Control': 'no-store',
    });
    return res.end(archive);
  } catch (err) {
    console.error('[OrgExport] export:', err.message);
    return res.status(500).json({ error: 'The export could not be made. Nothing was downloaded.' });
  } finally {
    running.delete(businessId);
  }
});

module.exports = router;
module.exports._reset = () => { running.clear(); lastRun.clear(); };
