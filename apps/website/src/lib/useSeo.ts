import { useEffect } from 'react';

/**
 * useSeo — give each route its own title, description and canonical.
 *
 * Every page on this site shipped the same title and the same description,
 * because a Vite SPA has one index.html. Four of the five public pages were
 * therefore competing with the home page using its words: /about and /join-us
 * had nothing of their own for a search engine to match a query against, and a
 * shared link to any of them previewed as the home page.
 *
 * No dependency for this — react-helmet is a lot of machinery for four tags,
 * and it does not solve the real limitation anyway. Which is worth stating
 * plainly: this runs in the browser, so it reaches Google (which renders JS)
 * and misses crawlers that do not. The static markup in index.html — canonical,
 * Open Graph, JSON-LD — is what those see, and it stays the floor. This raises
 * the ceiling for the engines that render. Prerendering the five routes to real
 * HTML is the fix that serves both; see the note in scripts/generate-sitemap.mjs
 * for where the route list lives.
 */
export function useSeo({
  title,
  description,
  path,
}: {
  /** Page title. " · Lyne" is appended unless the title already ends in it. */
  title: string;
  description: string;
  /** Route path, e.g. "/about". Used for the canonical url. */
  path: string;
}) {
  useEffect(() => {
    const full = /(^|\s)Lyne$/.test(title) ? title : `${title} · Lyne`;
    document.title = full;

    const meta = (selector: string, attr: 'name' | 'property', key: string, value: string) => {
      let el = document.head.querySelector<HTMLMetaElement>(selector);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute('content', value);
    };

    meta('meta[name="description"]', 'name', 'description', description);
    meta('meta[property="og:title"]', 'property', 'og:title', full);
    meta('meta[property="og:description"]', 'property', 'og:description', description);
    meta('meta[name="twitter:title"]', 'name', 'twitter:title', full);
    meta('meta[name="twitter:description"]', 'name', 'twitter:description', description);

    /* Canonical and og:url are absolute and origin-dependent. Read the origin
       from the live document rather than an env var, so a preview deploy
       canonicalises to itself instead of claiming to be production. */
    const url = `${window.location.origin}${path}`;
    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', url);
    meta('meta[property="og:url"]', 'property', 'og:url', url);
  }, [title, description, path]);
}

export default useSeo;
