# Web and app UX principles — from the reference clips

**Created:** 2026-08-21 · **Source:** `Web design and App Videos/` (6 TikToks + 4 stills)

Transcribed from the clips' burned-in captions (no audio model available, so the
scripts below are reconstructed from OCR at 2fps — the substance is right, the
exact wording is approximate). Two creators, two different jobs:

- **@synsation\_** — three teaching clips on *loading*, *spinners*, and
  *feedback patterns*. These are the ones with rules we can apply directly.
- **@jordankodes** — three review clips tearing apart viewer-submitted
  "vibe-coded" sites. These are a **checklist of what makes a site look
  AI-generated**, which matters to us because we are about to show this website
  to a procurement officer.

---

## 1 · Every screen owes four states — not one

> "And if you're not thinking about all four, your users will."
> — @synsation\_, clip 1

**Loading · Success · Error · Empty.** The clip walks the history — the Mac
wristwatch cursor with no animation, Windows 1985 with still no animation for
about twenty years, then progress bars (Windows 2000/Vista shipped *normal*,
*paused* and *error* states for the bar itself), the spinning rainbow "beach
ball of death", and finally **skeleton screens** — the grey placeholder outlines
Facebook was early to adopt around 2013.

Why skeletons work: **the browser is processing the layout before the data
arrives**, so the page can show its own shape immediately instead of a blank
rectangle. And the closing line is the standard to hold ourselves to:

> "Loaders should feel intuitive. Most of the time when they're there, you don't
> really even think or notice them."

**Three tools, not one:** skeleton (page/list shape), spinner (inside buttons
and small components), progress bar (long, measurable work).

---

## 2 · The psychology of spinners — match the tool to the duration

Clip 2 is the most immediately useful thing in the folder. Its rule is a ladder
keyed to **how long the wait actually is**:

| Wait | What to show |
|---|---|
| **Under 1 second** | **Nothing.** Just show the result. A spinner that flashes for 200ms makes a fast thing feel broken. |
| **Up to ~3 seconds** | A plain spinner. |
| **Up to ~10 seconds** | A spinner **with changing text** — "connecting to your account…", "working on it…", "almost there…". |
| **Longer than that** | A **progress bar**, or a step-by-step indicator (Step One… Step Two…). |

Two findings worth keeping:

- **Changing text buys you roughly one more second of patience** over static
  text, because it reads as progress rather than as a hang.
- **Fake progress still works.** "You're 41% there… 51%… 90%" holds attention
  *even if the number is invented* — because it feels like movement.

**But never let a bar stop.** A progress bar that sticks at 90% makes people
*more* frustrated than no bar at all:

> "and all of a sudden … just stop working. Don't do that."

And when it does fail, say so plainly — the clip's example is literally
`sorry that didn't work :(`.

---

## 3 · Toast vs modal vs inline — three different jobs

Clip 3. We currently use **none** of these on the website (see §6), so this is
the pattern to build to.

**Toast** — a notification that pops up at the top (or bottom) of the screen and
then leaves on its own. For things the user does **not** have to act on.
*Passive, dismissible, non-blocking.*

**Modal** — takes over the centre of the screen and **blocks until the user
responds**. Only when the user genuinely *has* to act, and it must carry a
button that does the thing:

> "Keep Your Subscription — Your latest payment couldn't be processed. Update
> your card to keep enjoying Better UX. **[Update your card]**"
> "You don't have access to this project. **[Request access]**"

A modal without an action is just a wall.

**Inline error** — shows up **right next to the thing that went wrong**, and this
is the line to remember:

> "The closer your error is to your issue, the better."

So: `Pick a username to get started` → `That username is already taken.` under
*that field*. And on a failed save, next to the button: `⚠ Couldn't save, try
again` — the clip is explicit that **it should say "try again"**, not just
report the failure. An error should tell you what to do next.

---

## 4 · How to not look AI-generated

The three @jordankodes review clips ("Your App = AI Slop 🤢") are a consistent
checklist. Every one of these is a tell:

1. **Em-dashes everywhere in the copy.** The single most-cited giveaway.
2. **Generic placeholder content** — `your.email@example.com`, "Automate Your
   Everything", stat boxes with round invented numbers (3,000 / 50,000+ / 60s),
   and badges like "EARLY ACCESS" or "Now in development" that nobody asked for.
3. **Not actually made mobile.** Fixed pixel widths, content cut off at the
   edge. He checks this on every single review.
4. **A footer full of links to pages that do not exist** — Terms of Service,
   Privacy, Security, Help Center, all pointing nowhere. He calls this out
   *last, every time*, as the thing that gives it away.
5. **Sign-up that accepts a disposable email address** — he registers with
   `gkfrpyssgwnyzhnuyh@jbsze.net` and gets straight in. (Clerk and similar have
   a "block disposable email domains" toggle; nobody turns it on.)
6. **Placeholder text left in production** and spinners that never resolve.

He also praises the same things repeatedly: **real onboarding that asks a
question and adapts** ("How do you want to work? Remote only / Hybrid / Onsite
is fine"), and copy that sounds like a person wrote it.

---

## 5 · The delivery-app stills (IMG_9463–9466)

A Flutter "Parcel" app, four frames of one flow. Worth keeping for the shape:

- **Login** — illustration up top, a white sheet card overlapping it, "Welcome
  Back", email + password, *Keep me signed in* and *Forgot Password?* on one
  line, one big high-contrast primary button, then "Or Continue With"
  Google/Apple. Note the escape hatch at the bottom: **"Quick Track as Guest →"**
  — exactly the pattern our session portal needs, and for the same reason.
- **Loading** — the whole form dims and a themed illustration (a truck) appears
  with **"Signing you in…"**. Not a bare spinner: a branded, captioned state.
  This is §2's ladder done properly.
- **Home** — greeting with avatar + bell, one search field, a promo card, a
  balance card with three actions, then a row of large icon shortcuts, then a
  bottom tab bar. Everything is a card; nothing is a wall of text.

---

## 6 · What this says about *our* website, specifically

Audited `apps/website` against the above. These are real, not hypothetical.

### The footer is the exact thing clip 4 mocks

`src/components/lyne/Marketing.tsx:130` —

```tsx
<Link to="/about">Terms</Link>
<Link to="/about">Privacy</Link>
<Link to="/about">Security</Link>
```

**Three legal links, all pointing at the About page.** The footer advertises 13
destinations; the app has 4 routes (`/`, `/about`, `/join-us`, 404). "Mobile
App" goes to `/#pricing`, "Desktop App" to `/#partners`, "Help center" to
`/join-us`.

For us this is worse than an aesthetic tell. We are pursuing a **public
procurement licence** and selling to a **court** and to **credit unions** — a
Privacy link that silently lands on a marketing page is the kind of thing that
ends a compliance review. Either write the pages or remove the links.

### Five state components exist and not one is used

`SkeletonLoaders.tsx`, `EmptyState.tsx`, `LoadBar.tsx`, `CircularProgress.tsx`,
`StatusChip.tsx` — **zero imports across the whole site.** They were built and
never wired up. Clip 1's entire point, sitting unused in the repo.

### The quote form declares success before anything happens

`src/pages/JoinUs.tsx:66` —

```tsx
setSubmitted(true);
window.location.href = `mailto:customersupport@uselyne.com?...`;
```

It shows **"Thanks. Your email client should open…"** *and then* tries to open
the mail client. On a machine with no mail client configured, nothing opens and
the page still says thanks. There is **no error state on the only conversion
point on the site** — the form a prospect uses to contact us.

Per clip 3, the fix is an inline message next to the button that says what to do
next, plus a visible fallback: show the address as selectable text so someone
can copy it.

### There is no feedback layer at all

`<Toaster />` is mounted in `App.tsx:19` and `toast(...)` is called **zero**
times. So of the three patterns in clip 3, we use none.

### Copy

45 em-dashes across the site's source, and `your.email@example.com` as a
placeholder. Both are on the tell-list. (Em-dashes in *code comments* are fine
and not counted against us here — this is about visible copy.)

---

## 7 · The rules we are adopting

1. **Under a second, show nothing.** No spinner for a fast response.
2. **Past ~3 seconds, the spinner gets changing text.** Past ~10, a progress bar
   or step indicator. Never a bar that stalls.
3. **Every screen ships four states** — loading, success, error, empty — or it
   is not finished. This is already the admin standard; the website is not
   holding it.
4. **Errors sit next to what failed and say what to do next.** Not "Error 500".
5. **Toast for information, modal only when the user must act (and it carries
   the button), inline for anything attached to a field.**
6. **No link to a page that does not exist.** Especially not Privacy, Terms or
   Security.
7. **Never claim success before it happened.**
8. **Check it on a phone before calling it done.**

Related: [QA_UX_Review_2026-08-14](QA_UX_Review_2026-08-14.md) — the admin
surfaces already enforce most of rules 3–7. The website is the surface that
does not.
