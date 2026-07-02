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

// JWT verification must use a publishable/anon key. Service-role keys are
// intentionally not accepted here because this middleware runs on every
// authenticated request, not narrow administrative jobs.
const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY
  || process.env.SUPABASE_ANON_KEY
  || '';
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

async function lookupActorBySupabaseUid(supabaseUid, db = pool) {
  const [staffRows] = await db.query(
    'SELECT s.*, r.name AS role_name FROM staff s JOIN roles r ON s.role_id = r.id WHERE s.supabase_uid = ? AND s.is_active = TRUE LIMIT 1',
    [supabaseUid]
  );
  if (staffRows.length > 0) {
    return { dbStaff: staffRows[0] };
  }

  const [userRows] = await db.query(
    'SELECT * FROM users WHERE supabase_uid = ? LIMIT 1',
    [supabaseUid]
  );
  if (userRows.length > 0) {
    return { dbUser: userRows[0] };
  }

  return {};
}

async function requireAuth(req, res, next) {
  if (!supabase) {
    return res.status(503).json({ error: 'Authentication service is not configured.' });
  }
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

  Object.assign(req, await lookupActorBySupabaseUid(user.id));

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

module.exports = { requireAuth, requireRole, lookupActorBySupabaseUid };
