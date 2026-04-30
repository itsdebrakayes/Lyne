/**
 * history.js — User visit history
 *
 * GET /api/history  — get visit history for the authenticated user
 */

const router = require('express').Router();
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(403).json({ error: 'User account required.' });

    const [rows] = await pool.query(
      `SELECT vh.*, biz.logo_url
       FROM visit_history vh
       JOIN businesses biz ON vh.business_id = biz.id
       WHERE vh.user_id = ?
       ORDER BY vh.visit_date DESC, vh.created_at DESC
       LIMIT 100`,
      [userId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch visit history.' });
  }
});

module.exports = router;
