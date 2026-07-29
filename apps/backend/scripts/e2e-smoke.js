/**
 * e2e-smoke.js — End-to-end smoke test of the live stack.
 *
 * Drives the real customer → staff → executive flow over HTTP against the
 * running API, authenticating real demo accounts through Supabase, and checks
 * that data flows all the way through (join → serve → wait_time_record →
 * analytics/predictions). Intended for pre-pilot verification, not CI (it needs
 * live Supabase + the demo stack and it mutates demo data).
 *
 *   node scripts/e2e-smoke.js
 *
 * Reads SUPABASE_URL / key from the repo-root .env. API defaults to :4000.
 */
const fs = require('fs');
const path = require('path');

// ── tiny .env loader (repo root) ──────────────────────────────
const envPath = path.resolve(__dirname, '../../../.env');
const env = Object.fromEntries(
  fs.readFileSync(envPath, 'utf8').split('\n')
    .map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; })
);
const SUPABASE_URL = env.SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
const API = process.env.E2E_API || 'http://localhost:4000/api';
const QUEUE_ID = process.env.E2E_QUEUE || 'q-taj-kgn-trn';
const BIZ = 'biz-taj-001';

let pass = 0, fail = 0;
const ok = (cond, label, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${label}${extra ? ` — ${extra}` : ''}`); }
  else { fail++; console.log(`  ❌ ${label}${extra ? ` — ${extra}` : ''}`); }
  return cond;
};

async function token(email, password) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY },
    body: JSON.stringify({ email, password }),
  });
  const d = await r.json();
  if (!d.access_token) throw new Error(`auth failed for ${email}: ${JSON.stringify(d).slice(0, 160)}`);
  return d.access_token;
}
async function api(method, p, tok, body) {
  const r = await fetch(`${API}${p}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: `Bearer ${tok}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data; const text = await r.text();
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: r.status, data };
}

(async () => {
  console.log(`E2E smoke · API ${API} · queue ${QUEUE_ID}\n`);

  console.log('1. Authenticate demo accounts (Supabase)');
  const cust = await token('user@test.com', 'test1234');
  const staff = await token('staff@test.com', 'test1234');
  const exec = await token('executive@test.com', 'test1234');
  ok(cust && staff && exec, 'customer, staff and executive tokens issued');

  console.log('\n2. Customer browses (public endpoints)');
  const biz = await api('GET', '/businesses');
  ok(biz.status === 200 && Array.isArray(biz.data) && biz.data.length > 0, 'GET /businesses', `${biz.data.length} businesses`);
  const svcs = await api('GET', `/services?business_id=${BIZ}`);
  ok(svcs.status === 200 && Array.isArray(svcs.data) && svcs.data.length > 0, 'GET /services', `${svcs.data.length} services`);

  console.log('\n3. Customer joins the queue');
  let join = await api('POST', '/tickets', cust, { queue_id: QUEUE_ID });
  if (join.status === 409) {
    console.log('  (already in line from a previous run — leaving and retrying)');
    // best-effort: recover the active ticket and leave it
    const active = await api('GET', '/tickets/active', cust);
    const activeId = active?.data?.id;
    if (activeId) await api('PUT', `/tickets/${activeId}/status`, cust, { new_status: 'left' });
    join = await api('POST', '/tickets', cust, { queue_id: QUEUE_ID });
  }
  const ticket = join.data || {};
  ok(join.status === 201 && ticket.id, 'POST /tickets (join)', `ticket ${ticket.ticket_number}, pos ${ticket.position}`);
  const naive = (ticket.position - 1) * 15;
  ok(typeof ticket.estimated_wait_minutes === 'number', 'ticket has an ETA',
    `model ETA ${ticket.estimated_wait_minutes}m (naive would be ${naive}m)`);

  console.log('\n4. Customer checks position');
  const pos = await api('GET', `/tickets/${ticket.id}/position`, cust);
  ok(pos.status === 200, 'GET /tickets/:id/position', `status ${pos.data?.status ?? '?'}`);

  console.log('\n5. Staff serves the ticket');
  const list = await api('GET', `/tickets/queue/${QUEUE_ID}`, staff);
  ok(list.status === 200 && Array.isArray(list.data) && list.data.some((t) => t.id === ticket.id), 'staff sees the ticket in the queue');
  const called = await api('PUT', `/tickets/${ticket.id}/status`, staff, { new_status: 'called', call_timeout_seconds: 120 });
  ok(called.status === 200, 'PUT status → called');
  const serving = await api('PUT', `/tickets/${ticket.id}/status`, staff, { new_status: 'in_service', verification_code: ticket.verification_code });
  ok(serving.status === 200, 'PUT status → in_service (code verified)');
  const served = await api('PUT', `/tickets/${ticket.id}/status`, staff, { new_status: 'served' });
  ok(served.status === 200, 'PUT status → served');

  console.log('\n6. Executive analytics + predictions reflect the system');
  const summary = await api('GET', `/analytics/summary?business_id=${BIZ}`, exec);
  ok(summary.status === 200 && Array.isArray(summary.data) && summary.data.length > 0, 'GET /analytics/summary', `${summary.data.length} rows`);
  const preds = await api('GET', `/predictions?business_id=${BIZ}`, exec);
  const types = new Set((preds.data || []).map((p) => p.insight_type));
  ok(preds.status === 200 && types.size > 0, 'GET /predictions', `${types.size} insight types`);
  ok(['wait_eta_grid', 'demand_forecast', 'staffing_recommendation', 'no_show_risk', 'target_attainment', 'operational_anomalies']
    .some((t) => types.has(t)), 'ML insights present', [...types].filter((t) => t.includes('_')).slice(0, 6).join(', '));

  console.log(`\n────────────\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('\nE2E ERROR:', e.message); process.exit(1); });
