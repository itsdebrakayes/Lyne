/**
 * consent.ts — what the visitor allowed us to store, and the gate everything
 * non-essential has to pass through.
 *
 * Today this gate has almost nothing behind it: the site sets no cookies, runs
 * no analytics and embeds no third-party scripts. That is deliberate, and the
 * point of building the gate *before* there is anything to gate is that the
 * alternative never happens. A tag gets added in a hurry, it ships without a
 * control, and the banner that arrives three months later is retrofitted around
 * whatever is already firing.
 *
 * So the rule for anyone adding measurement later: it loads inside
 * `whenAllowed('analytics', ...)` or it does not load. There is no second path,
 * and `npm run build` will not stop you from writing one — this comment is the
 * only thing that will.
 *
 * Stored in localStorage rather than a cookie on purpose. A cookie is sent to
 * the server on every request, which would make the record of "I refused
 * tracking" itself a thing transmitted about the visitor. Local storage stays
 * on the device until this code reads it.
 */

/** Categories a visitor can decide about. `necessary` is not one of them. */
export type ConsentCategory = 'preferences' | 'analytics';

export interface ConsentRecord {
  /** Bumped when the categories change meaning, which invalidates old answers. */
  version: number;
  /** ISO timestamp of the decision — regulators ask when consent was given. */
  decidedAt: string;
  preferences: boolean;
  analytics: boolean;
}

const STORAGE_KEY = 'lyne.consent';

/**
 * Raise this when a NEW category is added or an existing one starts covering
 * something materially different. An old record with a lower version is treated
 * as no answer at all and the banner asks again — which is the honest handling,
 * because consent is specific to what was described at the time it was given.
 */
export const CONSENT_VERSION = 1;

/** How long an answer stands before we ask again. Stated in the Cookie Policy. */
const MAX_AGE_DAYS = 365;

/** The answer that applies before anyone has chosen, and if storage is unreadable. */
const DEFAULT_DENY: ConsentRecord = {
  version: CONSENT_VERSION,
  decidedAt: '',
  preferences: false,
  analytics: false,
};

/** Fired on the window whenever the decision changes, so gated code can react. */
export const CONSENT_EVENT = 'lyne:consent';

function isExpired(record: ConsentRecord): boolean {
  if (!record.decidedAt) return false;
  const age = Date.now() - new Date(record.decidedAt).getTime();
  if (Number.isNaN(age)) return true;
  return age > MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * Read the stored decision.
 *
 * Every failure mode — private browsing, storage disabled, corrupted JSON, a
 * record written by an older version — resolves to "denied". Defaulting the
 * other way would mean a visitor who cannot be asked is treated as having said
 * yes, which is the one answer we are never entitled to assume.
 */
export function getConsent(): ConsentRecord {
  if (typeof window === 'undefined') return DEFAULT_DENY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_DENY;
    const parsed = JSON.parse(raw) as Partial<ConsentRecord>;
    if (parsed?.version !== CONSENT_VERSION) return DEFAULT_DENY;
    const record: ConsentRecord = {
      version: CONSENT_VERSION,
      decidedAt: typeof parsed.decidedAt === 'string' ? parsed.decidedAt : '',
      preferences: parsed.preferences === true,
      analytics: parsed.analytics === true,
    };
    return isExpired(record) ? DEFAULT_DENY : record;
  } catch {
    return DEFAULT_DENY;
  }
}

/** True once the visitor has actually answered — drives whether the banner shows. */
export function hasDecided(): boolean {
  return getConsent().decidedAt !== '';
}

/** True if this category may be used right now. */
export function isAllowed(category: ConsentCategory): boolean {
  return getConsent()[category];
}

/**
 * Record a decision.
 *
 * Writing is allowed to fail silently: a visitor with storage blocked still
 * gets a working site, they are simply asked again next time. Throwing here
 * would break the page over a preference.
 */
export function setConsent(choice: Record<ConsentCategory, boolean>): ConsentRecord {
  const record: ConsentRecord = {
    version: CONSENT_VERSION,
    decidedAt: new Date().toISOString(),
    preferences: choice.preferences,
    analytics: choice.analytics,
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch { /* private mode — the site still works, we just ask again */ }
  try {
    window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: record }));
  } catch { /* older browsers without CustomEvent — nothing is gated yet anyway */ }
  return record;
}

/** Accept every optional category. */
export function acceptAll() {
  return setConsent({ preferences: true, analytics: true });
}

/** Strictly necessary only. What "Reject" and "Necessary only" both do. */
export function rejectOptional() {
  return setConsent({ preferences: false, analytics: false });
}

/**
 * Erase the decision so the banner asks again.
 *
 * Offered in Cookie settings because withdrawing has to be as easy as giving,
 * and because "change your mind" should not mean "clear your whole browser".
 */
export function clearConsent() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch { /* nothing stored means nothing to clear */ }
  try {
    window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: DEFAULT_DENY }));
  } catch { /* see setConsent */ }
}

/** Subscribe to decision changes. Returns an unsubscribe function. */
export function onConsentChange(handler: (record: ConsentRecord) => void): () => void {
  const listener = () => handler(getConsent());
  window.addEventListener(CONSENT_EVENT, listener);
  /* `storage` fires when another tab changes it, so a refusal in one tab is
     honoured in the others rather than only after a reload. */
  window.addEventListener('storage', listener);
  return () => {
    window.removeEventListener(CONSENT_EVENT, listener);
    window.removeEventListener('storage', listener);
  };
}

/**
 * Run `fn` only while `category` is allowed — now, or whenever it is granted.
 *
 * **This is the function any future analytics or embed must be wrapped in.**
 * It also handles the case the naive version gets wrong: consent withdrawn
 * later. `fn` may return a teardown function, which is called if the visitor
 * changes their mind, so a script that was loaded on "accept" is actually
 * stopped on "reject" rather than merely not loaded next time.
 *
 * Returns an unsubscribe function for the caller's own cleanup.
 */
export function whenAllowed(
  category: ConsentCategory,
  fn: () => void | (() => void),
): () => void {
  let teardown: void | (() => void);
  let running = false;

  const sync = () => {
    const allowed = isAllowed(category);
    if (allowed && !running) {
      running = true;
      teardown = fn();
    } else if (!allowed && running) {
      running = false;
      if (typeof teardown === 'function') teardown();
      teardown = undefined;
    }
  };

  sync();
  const unsubscribe = onConsentChange(sync);
  return () => {
    unsubscribe();
    if (typeof teardown === 'function') teardown();
  };
}
