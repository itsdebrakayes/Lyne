# Why it reads as AI-made, and the one palette that fixes half of it

**Created:** 2026-08-21 · **Method:** ran all three surfaces and looked at them,
then compared against the queue-management category and against the Parcel app
Debra flagged as good.

---

## 0 · The headline finding

**It is not the colour.** The blue is fine. The typography is genuinely good.

What makes the mobile app read as AI-generated is a small number of **composition
patterns and copy formulas** that appear in roughly every AI-built app, and which
a designer would not have chosen. They are listed in §2, and they are all cheap
to fix.

The *palette* problem is real but it is a different problem: we are running
**three unrelated palettes across three surfaces**, which is a coherence failure
rather than a taste failure. §3 fixes that.

---

## 1 · What we are actually running today

| Surface | Primary | Ground | Family |
|---|---|---|---|
| **Marketing website** | `#7b5fff` purple → `#533483` gradient | `#1a1a2e` navy | **Purple** |
| **Admin desktop (QX)** | `#1B4B8F` deep blue | `#EFF2F7` light | **Deep blue** |
| **Mobile app** | `#2e6bff` electric blue | `#0c1826` near-black | **Electric blue** |

Three products, three hues. A customer who sees the website, then the app, then
the staff dashboard sees three companies. That alone reads as unfinished — before
any question of taste.

---

## 2 · The eight things that actually signal "AI made this"

Observed on the mobile onboarding and sign-in screens.

### 2.1 The tilted icon-tile mosaic — the biggest one

A grid of rounded squares at a jaunty angle, each holding an outline icon, some
filled with the accent colour, bleeding off the edges of the screen.

**This is the single most recognisable AI-generated app device.** It is the
mobile equivalent of the hero badge we just deleted from the website. It appears
on the onboarding screen, and again framing the sign-in screen top and bottom.

Why a designer would not do it: the tiles say nothing. Which is §2.2.

### 2.2 An icon grab-bag with no argument

The tiles currently show: a ticket, people, a storefront, a clock, an hourglass,
a double-check, a barcode, a location arrow, and **sparkles**.

Nine icons, no through-line. They are "app-ish things", chosen for texture rather
than meaning. Compare Parcel's splash, which shows **one** thing — a delivery
happening — because the app is about deliveries.

### 2.3 Sparkles, still

Top-right of the onboarding mosaic and bottom of the sign-in screen. We removed
the semantic ones; these decorative ones remain and they are the loudest.

### 2.4 The em-dash in the subhead

> "Skip the line, not your day **—** live waits, remote queueing, and perfectly
> timed arrivals."

The reference clip names this as the number-one giveaway. It is in our first
sentence to a new user.

### 2.5 The "X, not Y" copy formula

"Skip the line, **not your day**." This construction — negate-then-reframe — is
overwhelmingly associated with generated marketing copy. So is the rule of three
that follows it ("live waits, remote queueing, and perfectly timed arrivals").

Both in one sentence.

### 2.6 A form floating in dead space

The sign-in screen has the wordmark, two fields and a button hovering in the
vertical middle with large empty regions above and below, and decorative tiles
drifting behind.

**Compare Parcel**, which Debra picked out as good: illustration up top, then a
**white sheet that overlaps it and runs to the bottom of the screen**. The form
sits on ground. Ours sits in space. That single structural difference accounts
for most of the quality gap between the two screens.

### 2.7 No third-party sign-in

Parcel's login has Google and Apple, and a **"Quick Track as Guest →"** escape
hatch. Ours has email and password only. Beyond being a real gap (§ security),
its *absence* is itself a tell — every shipped consumer app has them.

### 2.8 Decoration doing the work of illustration

The tiles, the orbs and the gradients are all texture. There is no **subject**
anywhere in the app — no person, no place, no queue. Parcel has a character in
the first three seconds.

This is what the splash animation is for, and it is why it matters more than it
looks.

---

## 3 · The palette — one hue, three roles

**Decision: one blue family. Purple is retired.**

Purple is the odd surface out, it is the colour most associated with
AI-generated products (Lovable, v0 and most LLM tooling ship purple by default),
and it is the one the reference clip names. The blue is already on two of the
three surfaces and is the more credible colour for a court, a tax office and a
credit union.

### 3.1 The tokens

```
INK          #0C1826   near-black navy — app ground, dark surfaces
INK-RAISED   #16243A   raised dark surface (heroes, primary buttons on dark)

BLUE         #2E6BFF   the brand accent. CTAs, links, active states, the logo
BLUE-DEEP    #1B4B8F   dense-data ink: chart fills, table emphasis, admin chrome
BLUE-SOFT    #E6EDF8   tinted backgrounds, selected rows, quiet fills

PAPER        #F1F3F7   light app ground
SURFACE      #FFFFFF   cards
LINE         #E2E7F0   hairlines and dividers

WARN         #B4553F   a problem that is not yet a failure
BAD          #A62B25   a failure
```

Nothing else. No purple, no violet, no lavender, no green except where a status
genuinely requires it, and **no gradient between two different hues** — that
combination is the tell.

### 3.2 Why two blues and not one

They do different jobs and this is the one place a second value is earned:

- **`#2E6BFF`** is a consumer accent. It is bright enough to carry a CTA on a
  near-black ground and to read as "press me".
- **`#1B4B8F`** is a data ink. On a dense admin screen full of tables and charts,
  `#2E6BFF` at scale is exhausting; the deeper value holds up across a
  hundred rows.

Same hue family, two weights, assigned by density. This is already what the two
apps do accidentally — the change is making it deliberate and shared.

### 3.3 What this means per surface

| Surface | Change |
|---|---|
| **Website** | Replace `#7b5fff`/`#533483` with the blue family. The pink italic accent **stays** — it is a deliberate authored choice and it is the most characterful thing on the site. |
| **Admin** | Already compliant. `--c-primary: #1B4B8F` is exactly `BLUE-DEEP`. Add `#2E6BFF` for CTAs. |
| **Mobile** | Already compliant. `accent: #2e6bff` is exactly `BLUE`. Retire `accentDeep: #2f42e8`, which drifts toward indigo. |

The admin and mobile are already right. **Only the website moves.**

---

## 4 · What to keep

Worth stating, because a redesign that throws out the good parts is a worse
outcome than leaving it alone:

- **The typography.** The geometric sans on the mobile app is confident and
  well-set. Do not touch it.
- **The pink italic accent** on the website — authored, not generated.
- **The floating orbs and icon tiles on the website** — also authored. The
  *mobile* mosaic is a different thing and should go; the website's is used as
  ambient depth rather than as the main event.
- **The QX admin system.** One blue plus neutrals, red only for problems, no dead
  space. It is the most disciplined thing we have and should be the model the
  other two move toward, not the other way round.

---

## 5 · The fix list, in order of impact per hour

1. **Delete the mobile tile mosaic** from onboarding and auth. Replace with the
   splash character or with nothing. (Biggest single win.)
2. **Rewrite the onboarding and auth copy** — kill the em-dash, kill "X, not Y",
   kill the rule of three. Say what it does.
3. **Ground the auth form** — Parcel's sheet-over-illustration structure.
4. **Remove the last four sparkles.**
5. **Move the website to the blue family**, keep the pink accent.
6. **Add Google and Apple sign-in**, plus a guest path.
7. **Commission the splash character** — gives the app a subject.

1–4 are hours. 5 is a day. 6–7 are the real work, and 7 is what actually
differentiates it.
