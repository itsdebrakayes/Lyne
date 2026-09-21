/**
 * SkipToContent — the first thing in the tab order, and invisible until it isn't.
 *
 * Every page on this site opens with the same navigation. Without this, someone
 * driving the page from the keyboard tabs through the whole header on every
 * single route before reaching anything they came for, and someone using a
 * screen reader hears it read out again each time. WCAG 2.4.1 ("Bypass Blocks")
 * is the formal name for the problem; the practical name is that the site is
 * tiring to use.
 *
 * It is positioned off-screen rather than `display: none` or `visibility:
 * hidden`, because both of those remove an element from the tab order entirely
 * — which would make a skip link that cannot be reached, the classic way this
 * gets implemented and silently does nothing.
 *
 * The target is `#main`, which every page's <main> carries.
 */
export function SkipToContent() {
  return (
    <a
      href="#main"
      className="
        sr-only
        focus:not-sr-only
        focus:fixed focus:left-4 focus:top-4 focus:z-[100]
        focus:inline-flex focus:min-h-[44px] focus:items-center
        focus:rounded-xl focus:border focus:border-white/20
        focus:bg-lyne-night focus:px-5 focus:py-3
        focus:text-sm focus:font-semibold focus:text-white
        focus:outline-none focus:ring-2 focus:ring-lyne-lavender focus:ring-offset-2 focus:ring-offset-lyne-night
      "
    >
      Skip to main content
    </a>
  );
}
