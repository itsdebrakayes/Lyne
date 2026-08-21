# The splash, and every loading state under it

**Created:** 2026-08-21 · **Status:** spec, not yet built
**Source:** Debra's description of the Parcel app splash, plus the loading rules in
[WEB_AND_APP_UX_PRINCIPLES](WEB_AND_APP_UX_PRINCIPLES.md).

---

## 1 · What Parcel does, and why it works

Described from the clip:

1. A delivery driver rides up **from the bottom of the screen**.
2. He **turns right** — and the camera re-frames so that the road he turned onto
   is now a straight vertical line again.
3. He **turns left** — camera re-frames again, same trick.
4. The whole thing plays inside a **circular spotlight** sitting under the
   wordmark.

The reason it reads as expensive rather than decorative: **the camera is a
character.** Each turn should take the subject off-axis, and instead the world
rotates to keep them centred. That is a deliberate, hand-authored choice — it is
the opposite of a stock spinner, and it is why it does not look generated.

It is also a **loop with no natural end**, so it can run for as long as loading
takes without ever looking like it has frozen.

---

## 2 · What we do instead — the same idea, our subject

A delivery app shows a delivery. A queue app should show **a queue**.

```
        ╭───────────────╮
        │   ·  ·  ·  ·  │   circular spotlight, vignetted edge
        │  🚶 →  🚪     │   1. a person walks up and opens the branch door
        │   ▯ ▯ ▯ ▯     │   2. they join the back of a line
        │   ▯ ▯ ▯ →     │   3. the front of the line steps forward, then out
        ╰───────────────╯
              QMe Now
```

**The cast.** The people in the line are not identical silhouettes — one has
hands on hips, one checks their watch, one shifts their weight. That is what
sells it as a queue rather than a progress bar made of dots, and it is the
detail that is hardest to fake.

**The loop.** Front of line steps forward → steps out of frame → everyone
shuffles up → repeat. Each cycle is one "person served".

**The exit.** As the last person steps out, the **logo sweeps across and covers
the spotlight**, and the app is underneath.

---

## 3 · The part that matters: it is driven by readiness, not by a timer

This is where most splash screens go wrong, and it is where §2 of the UX
principles applies directly.

| Actual load | What the animation does |
|---|---|
| **Under ~1s** | **Do not show it at all.** Straight to the app. A splash that flashes for 300ms is worse than no splash — it reads as a stutter. |
| **~1–3s** | **One** person steps out, then the logo sweep. Nobody sees a loop. |
| **3s+** | The loop continues — a second person, a third — until the app is ready, then the logo sweep. |
| **Failed** | The line does **not** keep shuffling forever. It stops, and the screen says what went wrong and offers Retry. |

So the animation has to expose a **"wrap up now" signal**, not a fixed duration.
The loop runs; when readiness fires, it finishes the person currently mid-step
and plays the exit. That is the whole trick, and a fixed-length video cannot do
it.

**The failure row is not optional.** An infinite queue animation with no error
path is precisely the "spinner that never resolves" the reviewer clips mock.

---

## 4 · How to build it — and no, this is not a reason to move to Flutter

Parcel being a Flutter app has nothing to do with why its splash looks good. The
technique above is framework-independent, and we already have `Appear` and
`motion` primitives in the mobile app.

**Recommended: [Rive](https://rive.app).**

- It is **state-machine based**, which is exactly what §3 needs — the app can
  send a `ready` input mid-loop and the animation transitions out gracefully.
  Lottie plays a fixed timeline and would have to be cut off mid-frame.
- Runtime is small and it renders as vectors, so one file covers every screen
  density.
- `rive-react-native` is maintained and works under Expo with a dev build.

**Fallback: Lottie**, if the animation ends up being commissioned from someone
who only works in After Effects. It is workable — play the loop segment, then
jump to the exit segment — but the seam is visible and the "finish the current
step first" nicety is lost.

**Not recommended: hand-coding it in Reanimated.** Possible, but a
seven-character scene with staggered idle behaviour is animation work, not
engineering work, and it will look engineered.

---

## 5 · What this needs before it can be built

1. **A character set** — one walker plus three or four idle poses (hands on hips,
   checking watch, weight shift). This is the commissionable piece.
2. **A decision on the spotlight**: hard circular mask like Parcel, or a soft
   vignette. Parcel's hard edge is part of why it reads as a "stage".
3. **The logo sweep direction** — Parcel wipes; we could also have the logo drop
   into the spotlight as the last person clears it.
4. **Readiness wiring**: the splash must be told when auth has resolved, the
   session is restored, and the first screen's data has landed — not merely when
   the JS bundle has parsed. Otherwise it exits into a skeleton, which defeats it.

---

## 6 · Everything below the splash

The same ladder governs every other wait in the product, and the splash is just
its most visible instance:

| Wait | Pattern |
|---|---|
| < 1s | Nothing |
| 1–3s | Skeleton of the screen's own shape (not a spinner) |
| 3–10s | Skeleton plus changing text — "checking the line…", "almost there…" |
| > 10s | Progress or step indicator, and it must never stall |
| Failed | Inline, next to what failed, saying what to do next |

Related: [WEB_AND_APP_UX_PRINCIPLES §2](WEB_AND_APP_UX_PRINCIPLES.md).
