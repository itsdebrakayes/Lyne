/**
 * display.js — "Now Serving" lobby screens (migration 052).
 *
 * Public, by link only (mounted in index.js BEFORE the general rate limiter,
 * with their own):
 *   GET /display/:token          the screen: one self-contained page
 *   GET /display/display.js      its script
 *   GET /api/display/:token      what it shows, as JSON (lib/lobbyDisplay.js)
 *
 * Managing screens (signed in; a manager for their own branch, an executive for
 * any branch of their organisation):
 *   GET    /api/displays?branch_id=    the branch's screens, with their links
 *   POST   /api/displays               { branch_id, name, service_id? }
 *   DELETE /api/displays/:id           switch a screen off; its link stops working
 *
 * The page may be framed by anyone: it exists to be put inside an
 * organisation's own signage software. That is safe ONLY because it shows no
 * personal data and has no controls; nothing else on this server may be framed.
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const { randomBytes, randomUUID } = require('crypto');
const { z } = require('zod');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { requireStaffRole, assertBusinessAccess, assertBranchAccess } = require('../middleware/tenantAccess');
const { displayPayload, forget, TOKEN_SHAPE } = require('../lib/lobbyDisplay');

const PAGE = fs.readFileSync(path.join(__dirname, '../display/display.html'));
const SCRIPT = fs.readFileSync(path.join(__dirname, '../display/display.js'));
const MAX_PER_BRANCH = 20;

/* Replaces helmet's defaults for these responses only. No inline script, no
   third-party anything; frame-ancestors * is the point of the page. */
function displayHeaders(res) {
  res.removeHeader('X-Frame-Options');
  res.set({
    'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors *",
    'Cross-Origin-Resource-Policy': 'cross-origin',
    'Referrer-Policy': 'no-referrer',
    'X-Robots-Tag': 'noindex, nofollow',
    'Cache-Control': 'no-cache',
  });
}

/* ── the public page ─────────────────────────────────────────────────────── */
const pages = express.Router();

pages.get('/display.js', (_req, res) => {
  displayHeaders(res);
  res.type('application/javascript').send(SCRIPT);
});

/* The page is the same for every link, valid or not: whether a link works is
   answered by the data feed, so this route never touches the database. */
pages.get('/:token', (req, res) => {
  displayHeaders(res);
  if (!TOKEN_SHAPE.test(req.params.token)) return res.status(404).type('text/plain').send('Not found.');
  return res.type('text/html').send(PAGE);
});

/* ── the public data feed ────────────────────────────────────────────────── */
const feed = express.Router();

feed.get('/:token', async (req, res) => {
  res.set({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' });
  try {
    const payload = await displayPayload(req.params.token);
    if (!payload) return res.status(404).json({ error: 'This screen is not set up.' });
    return res.json(payload);
  } catch (err) {
    if (err && err.code === 'ER_NO_SUCH_TABLE') return res.status(503).json({ error: 'Lobby screens are not available yet.' });
    console.error('[Display] feed:', err.message);
    return res.status(500).json({ error: 'Could not load the screen.' });
  }
});

/* ── managing screens ────────────────────────────────────────────────────── */
const manage = express.Router();
const createSchema = z.object({
  // Optional for a manager: it is their own branch. An executive names one.
  branch_id: z.string().trim().min(1).max(36).optional(),
  name: z.string().trim().min(1, 'Give the screen a name.').max(80),
  service_id: z.string().trim().min(1).max(36).nullable().optional(),
}).strict();

const shape = (row) => ({
  id: row.id,
  branch_id: row.branch_id,
  service_id: row.service_id,
  service_name: row.service_name || null,
  name: row.name,
  path: `/display/${row.token}`,
  created_at: row.created_at,
  created_by: row.created_by || null,
  last_seen_at: row.last_seen_at,
});

async function branchAllowed(req, branchId) {
  const [rows] = await pool.query('SELECT business_id FROM branches WHERE id = ? AND is_active = TRUE LIMIT 1', [branchId]);
  if (!rows.length) return null;
  if (!assertBusinessAccess(req, rows[0].business_id) || !assertBranchAccess(req, branchId)) return null;
  return rows[0].business_id;
}

manage.get('/', requireAuth, requireStaffRole('manager', 'executive'), async (req, res) => {
  try {
    const branchId = String(req.query.branch_id || req.dbStaff.branch_id || '');
    if (!branchId) return res.status(400).json({ error: 'branch_id is required.' });
    if (!await branchAllowed(req, branchId)) return res.status(403).json({ error: 'You do not have access to this branch.' });
    const [rows] = await pool.query(
      `SELECT d.*, s.name AS service_name, st.full_name AS created_by
         FROM lobby_displays d
         LEFT JOIN services s ON s.id = d.service_id
         LEFT JOIN staff st ON st.id = d.created_by_staff_id
        WHERE d.branch_id = ? AND d.revoked_at IS NULL
        ORDER BY d.created_at`,
      [branchId]
    );
    return res.json({ displays: rows.map(shape) });
  } catch (err) {
    console.error('[Display] list:', err.message);
    return res.status(500).json({ error: 'Could not load the lobby screens.' });
  }
});

manage.post('/', requireAuth, requireStaffRole('manager', 'executive'), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Check the details.' });
  const { name, service_id: serviceId } = parsed.data;
  const branchId = parsed.data.branch_id || req.dbStaff.branch_id;
  if (!branchId) return res.status(400).json({ error: 'Choose a branch for this screen.' });
  try {
    const businessId = await branchAllowed(req, branchId);
    if (!businessId) return res.status(403).json({ error: 'You do not have access to this branch.' });
    if (serviceId) {
      const [svc] = await pool.query('SELECT 1 FROM services WHERE id = ? AND business_id = ? LIMIT 1', [serviceId, businessId]);
      if (!svc.length) return res.status(400).json({ error: 'That service does not belong to this organisation.' });
    }
    const [count] = await pool.query('SELECT COUNT(*) AS n FROM lobby_displays WHERE branch_id = ? AND revoked_at IS NULL', [branchId]);
    if (Number(count[0].n) >= MAX_PER_BRANCH) {
      return res.status(409).json({ error: `A branch can have ${MAX_PER_BRANCH} screens. Switch one off first.` });
    }

    const id = randomUUID();
    const token = randomBytes(32).toString('base64url');   // 43 characters, 256 bits
    await pool.query(
      'INSERT INTO lobby_displays (id, business_id, branch_id, service_id, name, token, created_by_staff_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, businessId, branchId, serviceId || null, name, token, req.dbStaff.id]
    );
    await pool.query(
      `INSERT INTO audit_logs (id, actor_id, actor_type, business_id, action, resource_type, resource_id, ip_address, user_agent)
       VALUES (?, ?, 'staff', ?, 'lobby_display_created', 'lobby_display', ?, ?, ?)`,
      [randomUUID(), req.dbStaff.id, businessId, id, req.ip || null, req.headers['user-agent'] || null]
    );
    const [rows] = await pool.query(
      'SELECT d.*, s.name AS service_name FROM lobby_displays d LEFT JOIN services s ON s.id = d.service_id WHERE d.id = ?', [id]
    );
    return res.status(201).json(shape({ ...rows[0], created_by: req.dbStaff.full_name }));
  } catch (err) {
    console.error('[Display] create:', err.message);
    return res.status(500).json({ error: 'Could not create the screen.' });
  }
});

manage.delete('/:id', requireAuth, requireStaffRole('manager', 'executive'), async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, business_id, branch_id, token FROM lobby_displays WHERE id = ? AND revoked_at IS NULL LIMIT 1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Screen not found.' });
    if (!assertBusinessAccess(req, rows[0].business_id) || !assertBranchAccess(req, rows[0].branch_id)) {
      return res.status(403).json({ error: 'You do not have access to this screen.' });
    }
    await pool.query('UPDATE lobby_displays SET revoked_at = NOW() WHERE id = ?', [rows[0].id]);
    forget(rows[0].token);
    await pool.query(
      `INSERT INTO audit_logs (id, actor_id, actor_type, business_id, action, resource_type, resource_id, ip_address, user_agent)
       VALUES (?, ?, 'staff', ?, 'lobby_display_revoked', 'lobby_display', ?, ?, ?)`,
      [randomUUID(), req.dbStaff.id, rows[0].business_id, rows[0].id, req.ip || null, req.headers['user-agent'] || null]
    );
    return res.json({ revoked: true });
  } catch (err) {
    console.error('[Display] revoke:', err.message);
    return res.status(500).json({ error: 'Could not switch the screen off.' });
  }
});

module.exports = { pages, feed, manage };
