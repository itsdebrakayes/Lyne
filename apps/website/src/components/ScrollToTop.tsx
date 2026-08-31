import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/**
 * Put a new page at the top of itself.
 *
 * React Router does not reset scroll on navigation — the browser only restores
 * position on a real page load, and a client-side route change is not one. So
 * following a footer link from the bottom of a long page lands you at the
 * bottom of the next one, which reads as a broken link rather than a scroll
 * position: the heading is off-screen and the first thing visible is a footer
 * identical to the one just clicked.
 *
 * Two deliberate exceptions:
 *
 * A hash is an instruction. "/#pricing" means go to pricing, so jumping to the
 * top would actively undo what the link asked for. Those are left alone and the
 * browser's own anchor handling takes them.
 *
 * POP is Back or Forward. Returning to a page you have already read should put
 * you where you were, not at the top — the one case where the browser's own
 * restoration is the behaviour people expect.
 */
export function ScrollToTop() {
  const { pathname, hash } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if (hash) return;
    if (navigationType === "POP") return;

    /* Deferred past paint, deliberately.
       Scrolling synchronously in the effect runs while the OUTGOING page is
       still laid out; the incoming route then mounts and settles the document
       at whatever offset the old height implied — measured at 141px rather
       than 0. Two frames is what it takes: one for React to commit the new
       route, one for the browser to lay it out.

       "instant" rather than smooth, because a new page should already be at
       the top when it appears, not scroll there while the reader watches. */
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname, hash, navigationType]);

  return null;
}

export default ScrollToTop;
