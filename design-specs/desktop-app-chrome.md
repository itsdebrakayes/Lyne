# Desktop App Chrome — the "this is a real application" layer

**Reference:** Docker Desktop (screenshot supplied 2026-08-12).
**Applies to:** `apps/admin-desktop`.
**Status:** spec only — implement AFTER the mobile work.

## The problem this solves

The admin app reads as a web page that happens to be maximised. Docker Desktop reads
as an application. The difference is not the charts or the tables — it is that Docker
commits to **four fixed chrome regions with visibly different surfaces**, and lets only
one of them scroll. Everything else stays nailed down, so the window feels like a frame
you are looking *through* rather than a document you are scrolling.

## The four regions

### 1. Title bar (full width, top)

The most saturated surface in the app — a deep brand blue-black band that is clearly
*not* content. Contents, left to right:

- macOS traffic lights, then the brand mark + wordmark, then a small plan chip (`PERSONAL`)
- a wide global search with a `⌘K` affordance — centre-right, the visual anchor of the bar
- a utility cluster hard right: help, notifications (with a count badge), extensions,
  settings, app-grid, account avatar

Takeaway: one band that owns identity, global search, and account. It never scrolls and
never changes between screens.

### 2. Sidebar (full height, left, fixed width)

- Its own surface value, separated from content by a hairline — not a shadow
- Icon + label rows, generous vertical rhythm
- The active row is a **filled pill** (Containers), not a coloured left-edge tick
- A gap + divider demotes secondary nav (Extensions) away from the primary group
- A pinned CTA sits at the very bottom (`Upgrade plan`) — anchored, not in the scroll flow

### 3. Status bar (full width, bottom, thin)

This is the single strongest "native app" signal and the piece we are missing entirely.
A slim strip, distinct surface, showing **live system truth**:

- far left: product mark + a status word with a state dot (`Engine running`)
- transport-ish controls (pause, kebab)
- live telemetry, comfortable and monospaced-feeling: `RAM 1.76 GB · CPU 1.70% · Disk …`
- far right: a terminal toggle (`>_`) and a background-activity indicator (`Preparing`)

### 4. Content (the only scrolling region)

Page title, an inline secondary link beside it (`Give feedback`), a stat row, a toolbar
(search / column picker / a filter toggle), then the dense table. Row actions live at the
right edge of each row and stay quiet until hover.

## Rules to implement

1. **Only the content region scrolls.** Header, sidebar and status bar are fixed. This is
   the whole effect — if the header scrolls away, none of the rest matters.
2. **Separate regions by surface value + hairline borders, never by drop shadow.** Docker
   uses four distinct flat surfaces. Shadows would read as "web card".
3. **The status bar must show real state**, not decoration: API reachable, DB connected,
   last analytics refresh, background jobs running. It is the honest-system indicator, and
   it is the thing that will make this feel like software people trust.
4. **Active nav = filled pill.** One unmistakable selected state.
5. **Global search belongs in the title bar**, not floating in the content area.
6. Keep our approved palette (one deep blue + neutrals, red reserved for problems) — we
   are borrowing Docker's *structure*, not its colour.

## Explicitly NOT borrowed

Docker's blue is theirs. We keep the QX system: single deep blue, neutrals, Title Case,
liquid glass, red only for genuine problems.
