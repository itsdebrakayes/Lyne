/**
 * saved.js — Saved (favourite) businesses for mobile app
 *
 * GET    /api/saved              — list saved businesses for current user
 * POST   /api/saved/:business_id — save a business
 * DELETE /api/saved/:business_id — unsave a business
 */

const router = require('express').Router();
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(403).json({ error: 'User account required.' });

    const [rows] = await pool.query(
      `SELECT b.*, sb.saved_at
       FROM saved_businesses sb
       JOIN businesses b ON sb.business_id = b.id
       WHERE sb.user_id = ? AND b.is_active = TRUE
       ORDER BY sb.saved_at DESC`,
      [userId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch saved businesses.' });
  }
});

router.post('/:business_id', requireAuth, async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(403).json({ error: 'User account required.' });

    await pool.query(
      `INSERT IGNORE INTO saved_businesses (user_id, business_id) VALUES (?, ?)`,
      [userId, req.params.business_id]
    );
    res.status(201).json({ message: 'Business saved.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save business.' });
  }
});

router.delete('/:business_id', requireAuth, async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(403).json({ error: 'User account required.' });

    await pool.query(
      'DELETE FROM saved_businesses WHERE user_id = ? AND business_id = ?',
      [userId, req.params.business_id]
    );
    res.json({ message: 'Business removed from saved.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to unsave business.' });
  }
});

module.exports = router;
