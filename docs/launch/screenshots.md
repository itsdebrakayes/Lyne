# Screenshots and store graphics

What each store requires, what to capture, and the one setting that decides
whether you owe Apple a second set.

---

## ⚠ Decide this first: does Lyne support iPad?

`apps/mobile/app.json` currently says:

```json
"ios": { "supportsTablet": true }
```

That has two consequences you have not chosen yet:

1. **App Store Connect will require a 13-inch iPad screenshot set** in addition
   to the iPhone one. There is no way to submit without it.
2. **App Review will test the app on an iPad.** Only five files in
   `apps/mobile/src` read the window size at all, and none of them lay out
   differently for a tablet — so what a reviewer sees is a phone layout stretched
   across a 13-inch screen. "The app's user interface was cramped, laid out
   poorly, or displayed incorrectly on iPad" is Guideline 4.0, and it is one of
   the most-cited rejections there is.

**Recommendation: turn it off for version 1.**

```json
"ios": { "supportsTablet": false }
```

The app still installs and runs on iPad in iPhone compatibility mode, you owe
Apple one screenshot set instead of two, and nobody reviews a tablet layout that
does not exist yet. Turn it back on when there is a real iPad layout worth
showing — that is a version 2 feature, not a checkbox.

The rest of this document assumes iPhone only.

---

## Apple — required

| Device class | Accepted sizes (portrait) | Count |
|---|---|---|
| **6.9-inch iPhone** | 1320 × 2868 · 1290 × 2796 · 1260 × 2736 | 1–10, use 5 |
| 6.5-inch iPhone | 1284 × 2778 · 1242 × 2688 | Alternative to 6.9 — one class is enough |
| 13-inch iPad | 2064 × 2752 · 2048 × 2732 | **Only if `supportsTablet` stays true** |

Capture on the iPhone 17 Pro Max simulator at 1320 × 2868 and Apple scales the
set down for smaller devices. No alpha channel, no rounded corners, no device
frame added by you.

## Google Play — required

| Asset | Size | Notes |
|---|---|---|
| App icon | 512 × 512 PNG | 32-bit, under 1 MB, no transparency |
| Feature graphic | 1024 × 500 PNG/JPEG | **Required.** Shown above your screenshots |
| Phone screenshots | 16:9 or 9:16, 320–3840 px per side | 2 minimum, 8 maximum — the same 5 work |

The 6.9-inch iPhone captures are 9:19.5, which Play accepts.

---

## The five screenshots, in order

Order matters more than polish: most people see the first two and decide. Lead
with the problem you solve, not with your sign-in screen.

| # | Screen | Caption |
|---|---|---|
| 1 | Home, showing live waits at several branches | **See the wait before you leave home** |
| 2 | Ticket screen — live position in the queue | **Hold your spot from anywhere** |
| 3 | Ticket screen — the departure reminder | **We tell you when to leave** |
| 4 | Service detail — required documents | **Know what to bring** |
| 5 | Best-time-to-visit for a branch | **Go when it is quiet** |

Rules that keep the set from looking amateur:

- **Real data, not lorem.** Believable Jamaican branch names, plausible waits.
- **Full battery, full signal, a sensible clock.** A 12% battery in the status
  bar is the first thing the eye finds.
- **One idea per image.** Caption at the top, screen below it.
- **Legible at thumbnail size** — that is how they are first seen in search.

---

## Capturing them

```bash
cd apps/mobile

# iOS — the simulator gives you exact pixel dimensions
npx expo run:ios --device "iPhone 17 Pro Max"
# then: Simulator → File → Save Screen  (or ⌘S)

# Android
npx expo run:android
adb exec-out screencap -p > shot-1.png
```

Keep the raw captures out of git — they are large and they are regenerated every
time the design moves. `outputs/` is already gitignored and is the natural home.

---

## App icon

`apps/mobile/assets/icon.png` is the source for the build. The store listings
need their own copies:

- **App Store:** taken from the binary. Nothing to upload.
- **Play:** upload a 512 × 512 PNG with **no transparency and no rounded
  corners** — Play applies its own mask, and a pre-rounded icon comes out with
  a visible double edge.
