# Cookie and Local Storage Policy

**Lyne**

**Last updated:** 21 September 2026

**Effective:** on first release

---

## 1. The short version

**This website sets no cookies at all.**

It does not use advertising cookies, analytics cookies, social media pixels, session-replay tools, fingerprinting, or cross-site tracking of any kind. There is no Google Analytics, no Meta Pixel, no Hotjar, no advertising network. Nothing on this site profiles you, and nothing follows you to another site.

What the site does use is a small amount of **browser storage** — two items, both of which exist only to make a signed-in account work. They are listed in full in section 3, because "we only use essential cookies" is a claim that should be checkable rather than taken on trust.

We are telling you this in a policy of its own, rather than a line buried in the Privacy Policy, because you are entitled to verify it. Open your browser's developer tools, look at Application → Storage, and compare it to the table below. It should match exactly. If it does not, that is a bug and we want to hear about it: **[PRIVACY EMAIL]**.

## 2. Cookies, local storage, and why the difference matters

A **cookie** is a small file a site stores in your browser and then sends back to the server with every request. That return trip is what makes cookies useful for tracking, and it is why the law treats them the way it does.

**Local storage** and **session storage** are also stored in your browser, but they are **never automatically sent to any server**. Code running on the page has to read them and choose to do something with them.

This distinction matters for honesty rather than for evasion. Some sites describe local storage as "not cookies, so no notice required." We take the opposite position: anything stored on your device is your business, whatever the technology is called, so everything is listed below and everything is covered by the controls in section 5.

## 3. Everything this website stores on your device

This is the complete list. There is nothing else.

| Name | Type | What it is for | Category | How long it lasts |
|---|---|---|---|---|
| `lyne.consent` | Local storage | Remembers the choice you made in the cookie banner, so you are not asked again on every page | Strictly necessary | 12 months, or until you clear it |
| `lyne.portal.unlocked` | Session storage | Records that you arrived at the account portal from a valid sign-in link, so the page does not send you back round the loop | Strictly necessary | Deleted when you close the tab |
| `sb-<project>-auth-token` | Local storage | Your sign-in session for the account portal — set by Supabase, our authentication provider. **Only created if you sign in.** | Strictly necessary | Until you sign out, or the session expires |

**If you never sign in, only the first item is ever created**, and only after you answer the banner.

### What is deliberately not here

- No advertising or retargeting identifiers
- No analytics or measurement identifiers
- No social media pixels or share-button trackers
- No session recording or heatmap tools
- No device fingerprinting
- No cross-site or cross-device identifiers
- No data broker or data enrichment tags

## 4. Third-party connections

Storage is not the only way a website can share data about you. Loading a file from another company's server tells that company your IP address, roughly where you are, and which page you were on. We therefore list those connections too.

| Connection | What it is | What it receives | Storage set |
|---|---|---|---|
| **Google Fonts** (`fonts.googleapis.com`, `fonts.gstatic.com`) | Serves the typefaces the site is set in | Your IP address and browser user-agent, when a page loads | None. Google states it sets no cookies on these domains |
| **Supabase** (`*.supabase.co`) | Authentication for the account portal | Your sign-in request, and your session token. **Only if you sign in** | The token in the table above |

We host nothing else from a third party: no ad networks, no tag managers, no content delivery network serving scripts, no embedded videos, no embedded maps, and no social media widgets.

> **A known limitation, stated plainly.** Google Fonts is loaded before you answer the banner, because text has to render. This means your IP address reaches Google on your first page view regardless of what you choose. This is a genuine third-party connection that your consent does not currently gate, and we would rather say so than let the banner imply a control it does not have. The fix is to serve the font files from our own servers, which removes the connection entirely; it is on our list. Until then, this paragraph is the disclosure.

## 5. Your choices, and what they actually control

The first time you visit, a banner offers three options:

- **Accept all** — allows the strictly necessary items above, plus optional analytics and preference storage if we ever add any.
- **Necessary only** — allows only the strictly necessary items. This is the same as rejecting the optional categories.
- **Reject non-essential** — identical in effect to "Necessary only". Both are offered because "reject" is the word many people look for, and hiding it behind a settings menu is the pattern this policy exists to avoid.

**Rejecting costs you nothing.** No feature is withheld, no content is hidden, and you are not asked again on the next page. Refusing is one click, exactly like accepting — no "manage preferences" maze, no pre-ticked boxes, no cookie wall.

**Today, all three choices produce nearly the same result**, because there is nothing non-essential to switch off. We are not pretending otherwise. The banner exists so that the control is already in your hands on the day we add something optional, rather than being introduced alongside it.

### Changing your mind

Select **Cookie settings** in the footer of any page. Your current choice is shown and can be changed at any time. Withdrawing is as easy as giving it.

You can also clear everything through your browser: in Chrome, Edge, Firefox or Safari, delete site data for this domain. That removes every item in section 3, including the record of your choice, and the banner will ask again on your next visit.

## 6. The mobile app

**The Lyne mobile app uses no cookies.** It is not a browser and has no cookie store.

It does keep data on your device, which is covered in full by the Privacy Policy rather than repeated here: your sign-in token and any identification number you save are held in the **device keychain**, not in ordinary app storage, and your app preferences are held in the app's own storage. None of it is advertising-related, and none of it is shared with an advertising network.

The app contains **no advertising SDK and no analytics SDK**. Crash reporting is available through Sentry but is disabled unless a reporting key is configured; when it is enabled it is configured not to send personal information, and it strips anything resembling an identification number before an error report leaves your device. See Privacy Policy section 7.2.

## 7. The administrator and kiosk applications

The administrator desktop application and the kiosk application are used by staff at organisations that run queues, not by the public.

They set **no cookies and no advertising or analytics identifiers**. They store the signed-in staff session and local application settings — window state, the completed-tour flag, and the branch the device is assigned to — on the device itself. This is necessary for the application to function and is not shared with anyone.

## 8. Do Not Track and Global Privacy Control

We do not track you, so there is nothing for these signals to switch off. We honour them by default in the only way that is meaningful: by not tracking anyone in the first place. If we ever add optional analytics, a Global Privacy Control signal will be treated as a rejection of the optional categories without needing the banner.

## 9. The law this is written against

Jamaica's **Data Protection Act, 2020** governs personal data generally. It does not contain a separate cookie-consent rule of the kind found in the European ePrivacy Directive, so strictly necessary storage of the sort listed in section 3 does not require consent under Jamaican law.

We are providing the banner and these controls anyway, for three reasons: the site is reachable from countries whose rules do require it, the standard is where regulation is heading across the Caribbean, and asking is the right default regardless of which rule applies.

Where the **UK or EU** rules do apply to a visitor, consent under them must be freely given, specific, informed and as easy to withdraw as to give. Section 5 is written to meet that standard.

## 10. Changes

If we add anything that stores or transmits data about you, this page is updated **before** it goes live, and the banner asks again rather than treating an old answer as covering something new. The date at the top is the last time anything changed.

## 11. Contact

**[REGISTERED COMPANY NAME]**
[ADDRESS]
[PRIVACY EMAIL]

**Office of the Information Commissioner (Jamaica)** — you may complain to them directly, and you do not have to come to us first. Their current contact details are published on their official website.
