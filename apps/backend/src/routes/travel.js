/**
 * POST /api/travel/drive-time  { branch_id, lat, lng }   signed in
 *
 * POST so the person's position stays out of URLs and access logs.
 *
 * The drive from where the person is to a branch, with live traffic when
 * MAPBOX_TOKEN is set (src/lib/driveTime.js). The app uses it to time the
 * "Time to head out" reminder. Takes a branch, not a destination, so the
 * route cannot be used as a free directions service for anywhere else.
 */
const router = require('express').Router();
const { z } = require('zod');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { driveTime } = require('../lib/driveTime');

const query = z.object({
  branch_id: z.string().min(1).max(64),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

router.post('/drive-time', requireAuth, async (req, res, next) => {
  try {
    const parsed = query.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: 'Send branch_id, lat and lng.' });
    const { branch_id: branchId, lat, lng } = parsed.data;

    const [[branch]] = await pool.query(
      'SELECT latitude, longitude FROM branches WHERE id = ? AND is_active = TRUE', [branchId]);
    if (!branch) return res.status(404).json({ error: 'Branch not found.' });
    if (branch.latitude == null || branch.longitude == null) {
      return res.status(409).json({ error: 'This branch has no location set.' });
    }

    const result = await driveTime({ lat, lng }, { lat: Number(branch.latitude), lng: Number(branch.longitude) });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
