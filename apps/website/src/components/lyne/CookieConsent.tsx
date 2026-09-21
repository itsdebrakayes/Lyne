/**
 * CookieConsent — the banner, and the "Cookie settings" control that reopens it.
 *
 * Three things about the design are deliberate and should survive a redesign:
 *
 * 1. **Refusing is one click, at the same size as accepting.** No "manage
 *    preferences" detour to say no, no pre-ticked boxes, no greyed-out reject
 *    button. Consent that is harder to refuse than to give is not consent, and
 *    the asymmetry is the specific thing regulators go looking for.
 *
 * 2. **It does not block the page.** No overlay, no scroll lock, no cookie
 *    wall. Nothing behind it is withheld from someone who ignores it, because
 *    nothing non-essential runs until they answer anyway.
 *
 * 3. **It renders before the page content in DOM order**, while sitting at the
 *    bottom of the screen visually. A keyboard user reaches it on the first
 *    Tab rather than after forty links, and a screen reader meets it as a
 *    labelled dialog rather than as stray text after the footer.
 *
 * "Necessary only" and "Reject non-essential" do exactly the same thing. Both
 * are shown because people look for different words, and making someone work
 * out that two labels mean the same refusal is its own small dark pattern.
 */
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Cookie, X } from "lucide-react";
import {
  acceptAll,
  clearConsent,
  getConsent,
  hasDecided,
  onConsentChange,
  rejectOptional,
} from "@/lib/consent";

/** Opens the banner again from anywhere. Listened for below. */
const REOPEN_EVENT = "lyne:consent-reopen";

export function openCookieSettings() {
  window.dispatchEvent(new Event(REOPEN_EVENT));
}

export function CookieConsent() {
  /* Start hidden and decide in an effect. Rendering the banner during the
     first paint and then removing it gives everyone who already answered a
     visible flash of a question they have settled. */
  const [visible, setVisible] = useState(false);
  const [decidedAt, setDecidedAt] = useState<string>("");

  useEffect(() => {
    const record = getConsent();
    setDecidedAt(record.decidedAt);
    if (!hasDecided()) setVisible(true);

    const stopReopen = () => {
      setDecidedAt(getConsent().decidedAt);
      setVisible(true);
    };
    window.addEventListener(REOPEN_EVENT, stopReopen);
    const unsubscribe = onConsentChange((next) => setDecidedAt(next.decidedAt));
    return () => {
      window.removeEventListener(REOPEN_EVENT, stopReopen);
      unsubscribe();
    };
  }, []);

  const choose = useCallback((fn: () => void) => {
    fn();
    setVisible(false);
  }, []);

  if (!visible) return null;

  return (
    <div
      role="dialog"
      /* Not aria-modal: the rest of the page stays available, and claiming
         modality to a screen reader while leaving the page navigable is a lie
         that strands people inside a region they can leave. */
      aria-labelledby="cookie-consent-title"
      aria-describedby="cookie-consent-body"
      className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4 sm:px-6 sm:pb-6"
    >
      <div className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-lyne-night/95 p-5 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)] backdrop-blur sm:p-6">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-lyne-purple/15 text-lyne-lavender"
          >
            <Cookie className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h2
              id="cookie-consent-title"
              className="text-sm font-semibold tracking-tight text-white"
            >
              Your choice about storage on this device
            </h2>
            <p
              id="cookie-consent-body"
              className="mt-1.5 text-[13px] leading-relaxed text-lyne-lavender/70"
            >
              This site sets <strong className="font-semibold text-white/90">no cookies</strong> and
              runs no analytics or advertising trackers. It stores two small items your account
              needs to work. You can allow optional storage for the future, or keep it to the
              essentials — refusing costs you nothing.{" "}
              <Link
                to="/cookies"
                className="font-medium text-lyne-lavender underline underline-offset-2 hover:text-white"
              >
                Read the Cookie Policy
              </Link>
              .
            </p>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={() => choose(acceptAll)}
                className="btn btn-primary min-h-[44px] flex-1 justify-center text-[13px] sm:flex-none"
              >
                Accept all
              </button>
              <button
                type="button"
                onClick={() => choose(rejectOptional)}
                className="btn btn-ghost min-h-[44px] flex-1 justify-center text-[13px] sm:flex-none"
              >
                Necessary only
              </button>
              <button
                type="button"
                onClick={() => choose(rejectOptional)}
                className="btn btn-ghost min-h-[44px] flex-1 justify-center text-[13px] sm:flex-none"
              >
                Reject non-essential
              </button>
            </div>

            {decidedAt && (
              <p className="mt-3 text-[11px] text-lyne-lavender/45">
                Your current choice was saved on{" "}
                {new Date(decidedAt).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
                .{" "}
                <button
                  type="button"
                  onClick={() => {
                    clearConsent();
                    setDecidedAt("");
                  }}
                  className="underline underline-offset-2 hover:text-white"
                >
                  Clear it
                </button>
              </p>
            )}
          </div>

          {/* Only offered once a choice exists to fall back on. Dismissing
              before answering would leave no record and re-ask on every page,
              which reads as nagging rather than as a closed question. */}
          {decidedAt && (
            <button
              type="button"
              onClick={() => setVisible(false)}
              aria-label="Close cookie settings"
              className="-m-1 grid h-9 w-9 shrink-0 place-items-center rounded-lg text-lyne-lavender/50 transition-colors hover:bg-white/5 hover:text-white"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Footer entry point. Reopens the banner with the current choice shown. */
export function CookieSettingsLink({ className }: { className?: string }) {
  return (
    <button type="button" onClick={openCookieSettings} className={className}>
      Cookie settings
    </button>
  );
}
