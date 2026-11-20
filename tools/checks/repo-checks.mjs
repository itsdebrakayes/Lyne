#!/usr/bin/env node
/**
 * Repo checks: corrections the owner has made, turned into failures.
 * Each check prints what to do instead. Add a check here whenever a
 * correction cannot be expressed as a lint rule (see CLAUDE.md, "Corrections become checks").
 *
 * Run from anywhere:  node tools/checks/repo-checks.mjs
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20 });
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const tracked = git('ls-files', '-z').split('\0').filter(Boolean);
const hasBranch = (b) => { try { git('rev-parse', '--verify', '-q', `refs/heads/${b}`); return true; } catch { return !!process.env.GITHUB_REF_NAME && process.env.GITHUB_REF_NAME === b; } };
const BASELINE = JSON.parse(read('tools/checks/baseline.json'));

const failures = [];
const fail = (check, where, fix) => failures.push({ check, where, fix });

/* 1. Every variable the API reads reaches the production container. */
{
  const compose = read('deploy/docker-compose.prod.yml');
  const passed = new Set([...compose.matchAll(/^\s{6}([A-Z][A-Z0-9_]+):/gm)].map((m) => m[1]));
  const absent = BASELINE.envNotInProduction;
  for (const f of tracked.filter((p) => p.startsWith('apps/backend/src/') && p.endsWith('.js'))) {
    for (const m of read(f).matchAll(/process\.env(?:\.([A-Z][A-Z0-9_]*)|\[['"]([A-Z][A-Z0-9_]*)['"]\])/g)) {
      const name = m[1] || m[2];
      if (!passed.has(name) && !absent[name]) {
        fail('env-reaches-production', `${f}: process.env.${name}`,
          `Add ${name} to api.environment in deploy/docker-compose.prod.yml (and to deploy/env.production.example), or the container never sees it. If production must NOT have it, add it to envNotInProduction in tools/checks/baseline.json with the reason.`);
      }
    }
  }
}

/* 2. Demo-only files never enter production (CLAUDE.md rule 4). */
const DEMO_ONLY = [/^database\/demo_.*\.sql$/, /^database\/seed\.sql$/, /^docker-compose\.demo\.yml$/, /^scripts\/demo-.*\.sh$/, /^README\.demo\.md$/,
  /^apps\/backend\/scripts\/(sync-demo-test-accounts|seed-demo-healthcare|demo-switch|seed-demo-bank-history)\.js$/];
{
  const branch = process.env.GITHUB_REF_NAME;
  const files = branch === 'production' ? tracked
    : hasBranch('production') ? git('ls-tree', '-r', '--name-only', 'production').split('\n') : [];
  for (const f of files) if (DEMO_ONLY.some((r) => r.test(f))) {
    fail('demo-files-stay-off-production', `production: ${f}`,
      `Delete ${f} on production in a merge commit (git rm on the merge). It belongs on staging and demo only.`);
  }
}

/* 3. Secrets are never tracked (CLAUDE.md rule 5). */
for (const f of tracked) {
  if (/(^|\/)\.env(\.|$)/.test(f) && !/\.env\.example$|env\.production\.example$/.test(f) ||
      /\.(p8|p12|jks|keystore|pem)$/.test(f) || /^(secrets|backups)\//.test(f)) {
    fail('no-tracked-secrets', f, `git rm --cached ${f} and keep it out of git; secrets live in secrets/ or .env on the machine only.`);
  }
}

/* 4. umask 077 only inside a subshell (9 Nov 2026 outage: a global umask made 600 files the API could not read). */
for (const f of tracked.filter((p) => p.endsWith('.sh'))) {
  read(f).split('\n').forEach((line, i) => {
    if (/^\s*[^#]*\bumask\s+0?077\b/.test(line) && !/\(\s*umask\s+0?077\s*;/.test(line)) {
      fail('umask-in-a-subshell', `${f}:${i + 1}`, 'Scope it: ( umask 077; command ). A global umask 077 left deploy files unreadable to the API container and took production down.');
    }
  });
}

/* 5. Names and wording the owner has corrected. */
const WORDING = [
  { re: /qmenow\.com/i, id: 'not-our-domain', fix: 'qmenow.com is not ours. Use uselyne.com addresses.' },
  { re: /DKS Technologies,?\s+(Ltd|Limited|Inc|LLC|company)\b|\bDKS (Ltd|Limited)\b/i, id: 'dks-is-a-business-name',
    fix: "DKS Technologies is a registered business name (sole trader), not a company. Write 'DKS Technologies' with no Ltd/Inc/company." },
];
for (const f of tracked.filter((p) => /\.(tsx?|jsx?|mjs|html|json|sql)$/.test(p) && !p.startsWith('tools/checks/'))) {
  const text = read(f);
  for (const w of WORDING) if (w.re.test(text)) fail(w.id, f, w.fix);
}

/* 6. Real agencies stay on the demo branch (CLAUDE.md rule 6). Ratchet: the baseline may only shrink. */
{
  const re = /Tax Administration Jamaica|National Housing Trust|Passport, Immigration/g;
  const seen = {};
  for (const f of tracked.filter((p) => /^(apps\/[a-z-]+\/src|database)\//.test(p) && !DEMO_ONLY.some((r) => r.test(p)))) {
    const n = (read(f).match(re) || []).length;
    if (n) seen[f] = n;
  }
  for (const [f, n] of Object.entries(seen)) {
    const allowed = BASELINE.agencyNames[f] || 0;
    if (n > allowed) fail('no-real-agencies', `${f} (${n}, baseline ${allowed})`,
      'Use the fictional showcase organisations (Lignum Bank and friends in database/showcase/) or the organisation the screen is actually showing. Real agency data lives on the demo branch only.');
  }
  for (const [f, n] of Object.entries(BASELINE.agencyNames)) {
    if ((seen[f] || 0) < n) fail('baseline-shrinks', `tools/checks/baseline.json agencyNames["${f}"]`, `Lower it to ${seen[f] || 0}: you removed copies, so lock that in.`);
  }
}

/* 7. Comments are not where workarounds get excused. Ratchet like 6. */
{
  const excuse = /\b(real fix|proper fix|for now|workaround|belt and braces|a beat (after|on|before)|give (it|the \w+) a moment|wait(s)? a tick|hacky?\b(?!\s+pass))/i;
  const seen = {};
  for (const f of tracked.filter((p) => /^apps\/(admin-desktop|mobile|backend|website)\/(src|electron)\/.*\.(tsx?|jsx?)$/.test(p))) {
    const text = read(f);
    for (const m of text.matchAll(/\/\*[\s\S]*?\*\/|(?<![:'"`\w])\/\/[^\n]*/g)) {
      const hit = m[0].replace(/\s+/g, ' ').match(excuse);
      if (hit) {
        const line = text.slice(0, m.index).split('\n').length;
        (seen[f] ||= []).push(`${line}: …${m[0].replace(/\s+/g, ' ').slice(Math.max(0, hit.index - 50), hit.index + 40)}…`);
      }
    }
  }
  for (const [f, lines] of Object.entries(seen)) {
    const allowed = BASELINE.excuseComments[f] || 0;
    if (lines.length > allowed) fail('no-excuse-comments', `${f} (${lines.length}, baseline ${allowed})\n      ${lines.join('\n      ')}`,
      'A comment explaining why a patch is acceptable becomes permission for the next agent to copy it. Fix the root cause instead. If you truly cannot, say so to the owner and leave a task; never write the excuse into a comment.');
  }
  for (const [f, n] of Object.entries(BASELINE.excuseComments)) {
    if ((seen[f]?.length || 0) < n) fail('baseline-shrinks', `tools/checks/baseline.json excuseComments["${f}"]`, `Lower it to ${seen[f]?.length || 0}.`);
  }
}

/* 8. Sealed columns (apps/backend/src/lib/fieldCrypto.js) are never searched, compared or sorted in SQL:
      the stored value is ciphertext, different every time. */
{
  const COLS = 'full_name|guest_name|email|guest_email|guest_phone|date_of_birth|guest_dob';
  const compare = new RegExp(`\\b(WHERE|AND|OR|ON)\\s+(?:LOWER\\()?(?:\\w+\\.)?(${COLS})\\)?\\s*(=|<>|!=|LIKE|IN\\b)`, 'gi');
  const order = new RegExp(`ORDER BY(?:[^\`;()]|\\([^)]*\\))*?\\b(?:\\w+\\.)?(${COLS})\\b`, 'gi');
  for (const f of tracked.filter((p) => /^apps\/backend\/(src|scripts)\/.*\.(js|mjs)$/.test(p))) {
    const text = read(f);
    for (const re of [compare, order]) {
      for (const m of text.matchAll(re)) {
        const line = text.slice(0, m.index).split('\n').length;
        fail('sealed-columns-in-sql', `${f}:${line}: ${m[0].replace(/\s+/g, ' ').slice(0, 80)}`,
          'That column is stored sealed, so SQL cannot compare, search or sort it. Look up by its fingerprint column (email_hash, guest_name_hash = fingerprint(value)); sort with sortRows() from src/utils/sortRows.js; search in JavaScript after the query.');
      }
    }
  }
}

if (failures.length) {
  for (const x of failures) console.error(`\n✗ ${x.check}\n    ${x.where}\n    → ${x.fix}`);
  console.error(`\n${failures.length} repo check(s) failed.`);
  process.exit(1);
}
console.log('repo checks: all passed');
if (!existsSync(join(ROOT, 'tools/checks/node_modules'))) console.log('(lint not installed: npm --prefix tools/checks ci)');
