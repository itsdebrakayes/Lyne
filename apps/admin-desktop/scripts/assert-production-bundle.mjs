/**
 * Refuse to package an admin build that points at the machine it was built on.
 *
 * The failure this exists to prevent is silent and total. `.env` carries
 * `VITE_API_URL=http://localhost:4000/api` because that is correct for
 * `npm run dev`; Vite compiles whatever it finds into the bundle; and the
 * resulting installer looks perfect until someone opens it on a machine that
 * has nothing but the installer, where every screen fails to load. Nothing in
 * the build output says anything is wrong.
 *
 * ── Why this is not just `grep localhost dist` ───────────────────────────────
 *
 * A bare grep can never pass. Three of our dependencies carry localhost
 * defaults of their own:
 *
 *   react-router      `http://localhost` — a base for parsing relative URLs
 *   @supabase/supabase-js  `http://localhost:9999` — the stock GoTrue URL,
 *                      unused because we always construct the client with ours
 *   @supabase/supabase-js  bare `localhost` — a WebAuthn RP-ID comparison
 *
 * So the check is: find every scheme-prefixed local URL in the bundle, and fail
 * on any that is not one of those known library constants. A new local URL from
 * our own code is a new entry in the list of findings, not noise. Bare
 * `localhost` with no scheme is not matched at all — it cannot be an endpoint.
 *
 * And it asserts the positive as well, which is the half that actually proves
 * the build is configured: the production API URL has to BE in the bundle. An
 * empty VITE_API_URL leaves no localhost behind either, and would sail past a
 * negative-only check while shipping an app that requests paths against its own
 * origin.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');

/** Exact literals we have identified in dependencies and accept. */
const ALLOWED_LIBRARY_LOCALS = new Map([
  ['http://localhost', 'react-router — base URL for parsing relative paths'],
  ['http://localhost:9999', '@supabase/supabase-js — stock GoTrue URL, overridden by createClient'],
]);

const LOCAL_URL = /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(?::\d+)?(?:\/[A-Za-z0-9._~\-/]*)?/g;

const problems = [];
const notes = [];

if (!existsSync(join(DIST, 'index.html'))) {
  problems.push('dist/index.html is missing — run the Vite build before this check.');
}

const assetDir = join(DIST, 'assets');
const files = existsSync(assetDir)
  ? readdirSync(assetDir).filter((f) => f.endsWith('.js') || f.endsWith('.css')).map((f) => join(assetDir, f))
  : [];

if (!files.length) problems.push('dist/assets contains no JavaScript — the build produced nothing to check.');

let bundleText = '';
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  bundleText += text;

  const seen = new Map();
  for (const match of text.matchAll(LOCAL_URL)) {
    if (ALLOWED_LIBRARY_LOCALS.has(match[0])) continue;
    seen.set(match[0], (seen.get(match[0]) || 0) + 1);
  }
  for (const [url, count] of seen) {
    problems.push(`${file.slice(ROOT.length + 1)} contains ${url}${count > 1 ? ` (${count}x)` : ''}`);
  }
}

/* The positive half. Read the URL the build was actually configured with out of
   the same committed source the build reads, so the two cannot drift. */
const viteConfig = readFileSync(join(ROOT, 'vite.config.ts'), 'utf8');
const expected = viteConfig.match(/const PRODUCTION_API_URL = '([^']+)'/)?.[1];

if (!expected) {
  problems.push('Could not read PRODUCTION_API_URL out of vite.config.ts — this check needs updating.');
} else if (!bundleText.includes(expected)) {
  problems.push(
    `The bundle does not contain ${expected}. The API URL did not reach the build, `
    + 'so the packaged app would request paths against its own app:// origin and every screen would fail.'
  );
} else {
  notes.push(`API  ${expected}`);
}

const supabaseUrl = bundleText.match(/https:\/\/[a-z0-9]+\.supabase\.co/)?.[0];
if (!supabaseUrl) {
  problems.push('No Supabase project URL in the bundle — VITE_SUPABASE_URL did not reach the build, so nobody can sign in.');
} else {
  notes.push(`Auth ${supabaseUrl}`);
}

/* The renderer is loaded over app:// in a packaged build, and absolute asset
   paths resolve against the scheme root. Vite's electron plugin emits relative
   ones; if that ever changes the window comes up blank, which is worth catching
   here rather than in an installer. */
const html = existsSync(join(DIST, 'index.html')) ? readFileSync(join(DIST, 'index.html'), 'utf8') : '';
for (const m of html.matchAll(/(?:src|href)="(\/[^/][^"]*)"/g)) {
  problems.push(`dist/index.html references ${m[1]} by absolute path — it will not resolve over app://. Vite needs base: './'.`);
}

if (problems.length) {
  console.error('\n  ✗  This bundle is not fit to package:\n');
  for (const p of problems) console.error(`     · ${p}`);
  console.error('\n     Nothing was packaged.\n');
  process.exit(1);
}

console.log('\n  ✓  Bundle checked — no local URLs from our own code');
for (const n of notes) console.log(`     ${n}`);
console.log('');
