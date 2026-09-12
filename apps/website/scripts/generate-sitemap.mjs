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
  /* Indexed: the person who needs it is an IT officer at a branch who was sent
     a link, lost it, and will search for "lyne admin download". */
  { path: '/download', priority: '0.6', changefreq: 'monthly' },
  { path: '/privacy',  priority: '0.3', changefreq: 'yearly'  },
  /* Indexed on purpose: Google Play requires this page to be reachable by
     somebody who has already uninstalled the app, and the first place they
     will look is a search engine. */
  { path: '/delete-account', priority: '0.3', changefreq: 'yearly' },
  { path: '/terms',    priority: '0.3', changefreq: 'yearly'  },
];

/* The production origin. It is a default rather than a required variable
   because .env is gitignored: a host that clones this repo and builds has no
   VITE_SITE_URL unless somebody remembered to set it in the host's build
   settings, and the failure is silent — a sitemap of urls that do not resolve,
   found weeks later. Being wrong on a preview host is the cheaper mistake, and
   setting VITE_SITE_URL fixes that one. */
const DEFAULT_ORIGIN = 'https://uselyne.com';

const raw = process.env.VITE_SITE_URL || process.env.SITE_URL || '';
const site = raw.trim().replace(/\/+$/, '');
const origin = site || DEFAULT_ORIGIN;

if (!site) {
  /* Not fatal, but say it: on a staging or preview deploy this is the line
     that explains why the built pages canonicalise to production. */
  console.warn(
    `\n  ⚠  VITE_SITE_URL is not set — using ${DEFAULT_ORIGIN}.\n` +
    '     Correct for a production build. For a staging or preview host, set it\n' +
    '     so the build does not claim to be production, e.g.\n' +
    '       VITE_SITE_URL=https://staging.uselyne.com npm run build\n');
}
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
