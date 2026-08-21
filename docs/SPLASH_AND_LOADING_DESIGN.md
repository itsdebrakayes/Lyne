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

The reason it works: **the camera is a character.** Each turn should take the
subject off-axis, and instead the world rotates to keep them centred.

It is also a **loop with no natural end**, so it can run as long as loading takes
without looking frozen.

**It does not need to hide that it is a loop.** Confirmed 2026-08-21: the target
is the kind of short looping animation people post on Twitter — obviously a cycle
through a fixed set of poses, obviously drawn, and good precisely because of
that. Nobody expects a splash screen to be a real person. So the bar is
*characterful*, not *seamless*, which also makes it far cheaper to commission.

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
              Lyne
```

**The cast.** The people in the line are not identical silhouettes — one has
hands on hips, one checks their watch, one shifts their weight. A small fixed set
of poses, cycled. That is what sells it as a queue rather than a progress bar
made of dots.

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
| **Under ~1s** | The person **steps into the line**, and the logo comes straight out over them. No idle, no exit — just arrival and mark. |
| **~1–3s** | Steps into the line, **one idle beat**, checks their watch, then the person at the **front** steps out and the logo sweeps. |
| **3s+** | The loop continues — another idle, another person served — until ready, then the same exit. |
| **Failed** | The line **stops**. It does not keep shuffling. The screen says what went wrong and offers Retry. |

Note the change from the general rule in the UX principles: a launch splash is
**not** the same as a spinner over an operation. A spinner that flashes for 300ms
is a stutter, but an app that opens with nothing has no moment of brand at all.
So the sub-second case shows the shortest possible complete beat rather than
being skipped. Debra's call, and it is the right one for a launch.

**First open of the day gets the full version.** The OS distinguishes a cold
start from a warm resume, and so should we: the first launch of the day plays the
whole thing, subsequent resumes do the sub-second beat or nothing. Charm on every
single app-switch stops being charm.

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

## 4a · Where the figures stand today, and the honest ceiling

**Updated 2026-08-21 after Debra's review: "it's a stick man, I want it to look
like a real person."** She is right, and the correction went in two stages.

The first attempt drew a circle on a rounded rectangle — a blob. The second drew
the `walk` icon, a circle on a stick, and translated it across the screen at a
constant rate. Neither had limbs that moved, so neither read as *walking*; they
read as a shape being moved, which is what they were.

`components/WalkingFigure.tsx` now articulates: head, tapered torso, two arms
rotating about the shoulders, two legs rotating about the hips, and a vertical
bob. Four moving joints is the minimum that reads as gait, and the cue the eye
actually uses is the **counter-swing** — right arm forward with the left leg —
not anatomical detail.

One thing worth recording, because it cost a pass: the first version drew the
arms on the centreline, where the torso covered them completely. A figure with
invisible arms is a pin figure no matter how well the joints are rigged.

**The ceiling is real.** This is a well-drawn pictogram in motion. It is not the
Parcel character, and no arrangement of SVG primitives will become one — that
needs commissioned artwork: a rigged character with proportions, clothing,
weight and follow-through, authored in Rive. What the current work buys is a
figure that unmistakably reads as a person walking, today, at no cost, and a
motion language the commissioned version would inherit rather than replace.

**To commission it, an animator needs:** the walk cycle, three or four idle
poses (hands on hips, checking a watch, weight shift), a "step out of frame"
exit, and a Rive state machine with one `ready` input. That is a small brief and
the sizes and timings in this document define it.

### Two traps worth writing down

**Reanimated does not reach react-native-svg.** Two attempts animated limb `<G>`
elements with `useAnimatedProps` — first a React Native `transform: [{rotate}]`
array, then the `rotation` prop react-native-svg documents. Neither applied.
Inspecting the rendered output showed `transform-origin` set and no rotation at
all. The figure is now built from plain Views with plain transforms, which
animate on native and on web. If a future version goes back to SVG, verify the
motion by sampling the transform twice — not by reading the code.

**`expo start --web` does not run Reanimated 4 animations.** Sampling every
transform on the page 500ms apart showed zero of twenty changing. So the web
preview can prove LAYOUT but never MOTION; motion has to be checked on a
simulator or device.

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
