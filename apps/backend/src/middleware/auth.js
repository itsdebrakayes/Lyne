/**
 * auth.js — Supabase Auth verification middleware
 *
 * Every protected route sends the Supabase JWT in the Authorization header.
 * This middleware verifies it with the Supabase client and attaches the
 * decoded user to req.supabaseUser.  It also looks up the matching MySQL
 * record (users or staff) and attaches it as req.dbUser / req.dbStaff.
 */

const { createClient } = require('@supabase/supabase-js');
const pool = require('../db/pool');
const { sessionLimiter } = require('./sessionLimiter');

// Support both env var naming conventions
// Accept either naming convention (docker-compose uses SUPABASE_SERVICE_KEY)
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  || process.env.SUPABASE_SERVICE_KEY
  || 'placeholder-key';
const supabase = createClient(
  process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
  supabaseKey
);

async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header.' });
  }

  const token = authHeader.split(' ')[1];

  // Verify JWT with Supabase
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }

  req.supabaseUser = user;

  // Look up MySQL user record
  const [rows] = await pool.query(
    'SELECT * FROM users WHERE supabase_uid = ? LIMIT 1',
    [user.id]
  );

  if (rows.length > 0) {
    req.dbUser = rows[0];
  } else {
    // Check if this is a staff account
    const [staffRows] = await pool.query(
      'SELECT s.*, r.name AS role_name FROM staff s JOIN roles r ON s.role_id = r.id WHERE s.supabase_uid = ? LIMIT 1',
      [user.id]
    );
    if (staffRows.length > 0) {
      req.dbStaff = staffRows[0];
    }
  }

  return sessionLimiter(req, res, next);
}

/**
 * requireRole — restrict to specific staff roles.
 * Usage: router.get('/path', requireAuth, requireRole('manager', 'executive'), handler)
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.dbStaff) {
      return res.status(403).json({ error: 'Staff account required.' });
    }
    if (!roles.includes(req.dbStaff.role_name)) {
      return res.status(403).json({ error: `Requires one of: ${roles.join(', ')}.` });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
