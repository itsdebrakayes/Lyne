/**
 * businesses.js
 *
 * GET  /api/businesses           — list all active businesses (public)
 * GET  /api/businesses/:slug     — get one business by slug (public)
 * POST /api/businesses           — create (executive only)
 * PUT  /api/businesses/:id       — update (executive only)
 */

const router = require('express').Router();
const { randomUUID: uuidv4 } = require('crypto');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');
const { requireStaffRole, assertBusinessAccess } = require('../middleware/tenantAccess');
const { SECTOR_JOIN, SECTOR_COLUMNS, withTerms } = require('../utils/sectorTerms');

// List all active businesses — public
router.get('/', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT b.*, t.name AS tier_name, t.label AS tier_label,
              t.can_view_analytics, t.can_view_predictions,
              t.can_view_multi_branch, t.can_view_executive_reports,
              ${SECTOR_COLUMNS}
       FROM businesses b
       JOIN subscription_tiers t ON b.subscription_tier_id = t.id
       ${SECTOR_JOIN}
       WHERE b.is_active = TRUE
       ORDER BY b.name`
    );
    res.json(rows.map(withTerms));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch businesses.' });
  }
});

// Get one business by slug — public
router.get('/:slug', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT b.*, t.name AS tier_name, t.label AS tier_label,
              t.can_view_analytics, t.can_view_predictions,
              t.can_view_multi_branch, t.can_view_executive_reports,
              ${SECTOR_COLUMNS}
       FROM businesses b
       JOIN subscription_tiers t ON b.subscription_tier_id = t.id
       ${SECTOR_JOIN}
       WHERE b.slug = ? AND b.is_active = TRUE`,
      [req.params.slug]
    );
    if (!rows.length) return res.status(404).json({ error: 'Business not found.' });
    res.json(withTerms(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch business.' });
  }
});

// Create business — executive only
router.post('/', requireAuth, requireStaffRole('platform_admin'), validate(schemas.createBusiness), async (req, res) => {
  try {
    const { name, slug, description, logo_url, website_url, phone, email, subscription_tier_id } = req.body;
    if (!name || !slug || !subscription_tier_id) {
      return res.status(400).json({ error: 'name, slug, and subscription_tier_id are required.' });
    }
    const id = uuidv4();
    await pool.query(
      `INSERT INTO businesses (id, name, slug, description, logo_url, website_url, phone, email, subscription_tier_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, name, slug, description || null, logo_url || null, website_url || null, phone || null, email || null, subscription_tier_id]
    );
    const [created] = await pool.query('SELECT * FROM businesses WHERE id = ?', [id]);
    res.status(201).json(created[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create business.' });
  }
});

// Update business — executive only
router.put('/:id', requireAuth, requireStaffRole('executive', 'platform_admin'), validate(schemas.updateBusiness), async (req, res) => {
  try {
    const { name, description, logo_url, website_url, phone, email, subscription_tier_id, is_active } = req.body;
    if (!assertBusinessAccess(req, req.params.id)) {
      return res.status(403).json({ error: 'You do not have access to this business.' });
    }
    await pool.query(
      `UPDATE businesses SET
         name                 = COALESCE(?, name),
         description          = COALESCE(?, description),
         logo_url             = COALESCE(?, logo_url),
         website_url          = COALESCE(?, website_url),
         phone                = COALESCE(?, phone),
         email                = COALESCE(?, email),
         subscription_tier_id = COALESCE(?, subscription_tier_id),
         is_active            = COALESCE(?, is_active),
         updated_at           = NOW()
       WHERE id = ?`,
      [name, description, logo_url, website_url, phone, email, subscription_tier_id, is_active, req.params.id]
    );
    const [updated] = await pool.query('SELECT * FROM businesses WHERE id = ?', [req.params.id]);
    res.json(updated[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update business.' });
  }
});

module.exports = router;
