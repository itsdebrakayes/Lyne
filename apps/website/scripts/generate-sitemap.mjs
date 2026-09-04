/**
 * generate-sitemap.mjs — write sitemap.xml, and put the real domain into robots.txt.
 *
 * Runs after `vite build`, against dist/. Both files need an ABSOLUTE url, which
 * is the one thing a static file in public/ cannot know, so they are finished
 * here instead of being hand-maintained and quietly going stale.
 *
 * The route list below is the public surface of the site. It is deliberately a
 * literal rather than something parsed out of App.tsx: a sitemap is a promise
 * that every url in it returns real content, and /account (signed-in) and the
 * 404 catch-all break that promise. Add a page here when you add a public route.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');

/* Priority is a hint about relative importance WITHIN this site, not a ranking
   lever — search engines treat it as advisory. Home leads; the legal pages are
   here so they are indexed and trusted, not so they compete. */
const ROUTES = [
  { path: '/',         priority: '1.0', changefreq: 'weekly'  },
  { path: '/about',    priority: '0.8', changefreq: 'monthly' },
  { path: '/join-us',  priority: '0.8', changefreq: 'monthly' },
  { path: '/privacy',  priority: '0.3', changefreq: 'yearly'  },
  /* Indexed on purpose: Google Play requires this page to be reachable by
     somebody who has already uninstalled the app, and the first place they
     will look is a search engine. */
  { path: '/delete-account', priority: '0.3', changefreq: 'yearly' },
  { path: '/terms',    priority: '0.3', changefreq: 'yearly'  },
];

const raw = process.env.VITE_SITE_URL || process.env.SITE_URL || '';
const site = raw.trim().replace(/\/+$/, '');

if (!site) {
  /* Loud, but not fatal. A build that dies here would block a deploy over a
     value the deployer may be about to set; a build that says nothing ships a
     sitemap full of example.invalid and nobody finds out for a month. */
  console.warn(
    '\n  ⚠  VITE_SITE_URL is not set.\n' +
    '     sitemap.xml and robots.txt will point at https://example.invalid, and\n' +
    '     search engines will reject them. Set it to the live origin, e.g.\n' +
    '       VITE_SITE_URL=https://lyne.example npm run build\n');
}
const origin = site || 'https://example.invalid';
const today = new Date().toISOString().slice(0, 10);

const urls = ROUTES.map(({ path, priority, changefreq }) =>
  `  <url>\n` +
  `    <loc>${origin}${path}</loc>\n` +
  `    <lastmod>${today}</lastmod>\n` +
  `    <changefreq>${changefreq}</changefreq>\n` +
  `    <priority>${priority}</priority>\n` +
  `  </url>`).join('\n');

writeFileSync(join(dist, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);

/* robots.txt ships from public/ with a placeholder Sitemap line; rewrite it in
   the built copy so the source file stays domain-agnostic. */
const robots = join(dist, 'robots.txt');
if (existsSync(robots)) {
  writeFileSync(robots, readFileSync(robots, 'utf8')
    .replace(/^Sitemap: .*$/m, `Sitemap: ${origin}/sitemap.xml`));
}

/* The built index.html carries absolute canonical/og:url/JSON-LD values for the
   same reason. They are written with the placeholder origin and swapped here. */
const indexHtml = join(dist, 'index.html');
if (existsSync(indexHtml)) {
  writeFileSync(indexHtml,
    readFileSync(indexHtml, 'utf8').replaceAll('https://example.invalid', origin));
}

console.log(`  ✓ sitemap.xml — ${ROUTES.length} urls at ${origin}`);
