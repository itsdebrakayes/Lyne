# Screenshots and store graphics

What each store requires, what to capture, and the one setting that decides
whether you owe Apple a second set.

---

## iPad support: settled — it stays on

`apps/mobile/app.json` says:

```json
"ios": { "supportsTablet": true }
```

This was an open question and is now closed, in the direction of keeping it.
The kiosk terminal is this same binary running on an iPad, so turning tablet
support off would render the lobby terminal as a scaled-up phone app — the one
thing the kiosk cannot be. The customer screens hold a centred 780pt reading
column on any window 700pt or wider (`apps/mobile/src/lib/stage.ts`), so an
iPad now sees a laid-out app rather than a stretched one, which is what makes
the claim defensible to a reviewer.

Two consequences, both of which the rest of this document assumes:

1. **App Store Connect requires a 13-inch iPad screenshot set** as well as the
   iPhone one. There is no way to submit without it.
2. **App Review will test on an iPad.** Check the tablet layout on a real iPad
   or the 13-inch simulator before submitting — Guideline 4.0 ("cramped, laid
   out poorly, or displayed incorrectly on iPad") is one of the most-cited
   rejections there is, and the defence against it is that the layout exists,
   not that the flag is set.

This section used to recommend the opposite, and did so before the tablet
layout existed. If you are reading an older copy, this is the current answer.

---

## Apple — required

| Device class | Accepted sizes (portrait) | Count |
|---|---|---|
| **6.9-inch iPhone** | 1320 × 2868 · 1290 × 2796 · 1260 × 2736 | 1–10, use 5 |
| 6.5-inch iPhone | 1284 × 2778 · 1242 × 2688 | Alternative to 6.9 — one class is enough |
| **13-inch iPad** | 2064 × 2752 · 2048 × 2732 | **Required** — `supportsTablet` is true |

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

# iOS, the iPad set App Store Connect also requires — same five screens
npx expo run:ios --device "iPad Pro 13-inch (M4)"

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
