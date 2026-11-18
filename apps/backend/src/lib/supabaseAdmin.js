/**
 * The one Supabase service-role client. The key is SUPABASE_SERVICE_KEY, the
 * name deploy/docker-compose.prod.yml passes to the container. Returns null when
 * it is not configured, so each caller answers 503 instead of the API failing at boot.
 */
const { createClient } = require('@supabase/supabase-js');

let client;

function supabaseAdmin() {
  if (client === undefined) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;
    client = url && key
      ? createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
      : null;
  }
  return client;
}

module.exports = { supabaseAdmin };
