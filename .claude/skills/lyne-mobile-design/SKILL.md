---
name: lyne-mobile-design
description: Design and refine screens in the Lyne React Native mobile app (apps/mobile) to iOS-quality visual craft. Use this whenever the work touches how a mobile screen looks or feels — building a new screen, restyling an existing one, adjusting spacing, type, colour, elevation, empty states, loading states, or animation — and also when the user says a screen looks "off", "cheap", "generic", "unfinished", "not premium", or asks to make the app look better, more polished, or more like a real iOS app. Applies even when they do not mention design tokens, styling, or React Native by name.
---

# Designing the Lyne mobile app

Lyne is a queue app used by people standing in a government office, a clinic, or
a bank in Jamaica — often on older phones, often on mobile data, often one-handed
while watching for their number to be called. That context is the whole design
brief. Everything below serves it.

The app already has a design system. Most screens that look wrong are not missing
a system; they are ignoring the one that exists, or applying it without judgement.
Start by reading it.

## Before changing anything, read the tokens

`apps/mobile/src/lib/theme.ts` is the source of truth. Read it first, every time.
Hardcoding a colour or a spacing value that already has a token is the single most
common way this app drifts, because the next person copies the hardcoded value
rather than the token.

What it gives you:

| Token | What it is |
|---|---|
| `colors` | Surfaces, ink, borders, glass materials, brand, status. Theme-aware — light and dark both defined. |
| `font` | Manrope 400 → 800. Five weights, no other family. |
| `space` | `xs 6 · s 10 · m 14 · l 20 · xl 32 · xxl 44`. The rhythm everything sits on. |
| `shadow` | `card · hero · floating · depth`. Four elevations, deliberately few. |
| `t` | Prebuilt styles — `t.root`, `t.content`, `t.card`, `t.listRow`, `t.h1`, `t.section`, `t.primaryBtn` and more. |

Use `t.*` before writing a new style. If a screen needs something `t` does not
have and another screen will need it too, add it to `t` rather than inlining it —
that is how the system stays real instead of decorative.

One inconsistency to know about: the file's header comment says Plus Jakarta Sans,
but the `font` tokens load Manrope. Manrope is what actually renders. Do not
"fix" this by changing the tokens to a font that is not installed.

## What makes this app feel expensive

Lyne is styled as a light fintech app: a soft grey canvas, white cards with
hairline borders, a forest-dark hero, one cyan accent. Its quality comes from
restraint, not decoration.

**One accent, used sparingly.** `colors.accent` (cyan) marks the single most
important action on a screen. Two cyan buttons competing in one viewport makes
neither read as primary. Status colours — green, amber, red — are semantic and
must never be used decoratively; a red pill has to mean "busy", or nobody
believes it when it does.

**Hairlines, not heavy borders.** `colors.border` is `#eceef1`. Cards separate
from the canvas by a whisper of edge plus `shadow.card`, not by a stroke you can
see across the room.

**Generous, consistent padding.** Cards pad with `space.l`. Sections get `space.xl`
above and `space.m` below their heading. Grouped items gap with `space.s` or
`space.m`. Cramped padding is the fastest way to make a real app look like a
prototype.

**Type does the hierarchy work, not colour.** Weight and size carry structure;
`colors.muted` is for genuinely secondary text, not for "this feels too loud".
Sentence case for anything that reads as a sentence — Title Case On A Full
Sentence reads as shouting and is measurably harder to scan.

**Motion that explains, not motion that performs.** A transition should tell the
user where something came from or where it went. Decorative animation on a screen
someone checks forty times while waiting becomes irritating fast.

## The failure modes this app has actually shipped

These are not hypotheticals. Each one was found in this codebase and fixed. They
recur, so check for them.

**A screen that renders a heading over nothing.** Four screens did this. Every
list needs four states, not two: loading (a skeleton that holds the layout's
shape), error (say the request failed, offer a retry), empty (say so plainly and
say what would fill it), and content. `components/Feedback.tsx` has `SkeletonRows`,
`SkeletonCard`, `ErrorCard` and `EmptyCard` — use them rather than writing new ones.

**A screen that lies when it has no data.** The home hero once read "Tap to join a
queue · No wait" above an empty list, on a card that was disabled, because a
helper fell back to default opening hours when there was no branch at all. Before
shipping a confident-sounding string, ask what it says when the data behind it is
missing. A component should render its assertive state only when it has something
to assert.

**An error rendered as an empty state.** "No branches available" on a *failed
fetch* is a false statement about the world. Distinguish the two, always.

**Icon-only controls that announce nothing.** 24 of them. Any `TouchableOpacity`
whose only child is an icon — or worse, a bare `View`, like the camera shutter —
is silent under VoiceOver. Give it `accessibilityRole` and an `accessibilityLabel`
that says what the tap will do and, for toggles, what state it is in now.

**Type that cannot reflow.** Capping Dynamic Type is usually wrong — text should
grow. Cap it only where the container physically cannot adapt: a glyph centred in
a fixed 58pt circle, a stat numeral in a fixed-height dark card. Never cap body
text or headlines. And never pair a growing `fontSize` with a fixed `lineHeight`;
the descenders get crushed.

## iOS craft that matters here

**Touch targets are 44×44pt minimum.** Someone is tapping this one-handed while
holding a folder of documents. Where the visual element is smaller, add `hitSlop`.

**Safe areas are not optional.** The app is wrapped in `SafeAreaProvider`. Respect
insets rather than guessing at padding, or content lands under the notch or the
home indicator.

**Confirm anything that cannot be undone.** Leaving a queue gives up a place a
person may have waited an hour for. It asks first, and so must anything of that
weight.

**Haptics mark moments, not interactions.** `lib/haptics.ts` exports exactly four:
joined, checked in, destructive, failed. Resist adding more — haptics everywhere
is the same failure as accent everywhere.

**Assume the network is bad.** `lib/network.ts` drives an offline banner and
pauses queries. A screen that spins forever on a dead connection is worse than one
that says the connection is gone.

## Animation

Use `react-native-reanimated` for anything continuous or gesture-driven, and RN's
`Animated` with `useNativeDriver: true` for simple entrances. The rule that matters:
**animate on the UI thread**. A layout animation that stutters while a queue
refreshes reads as a broken app, and this app refetches often.

Reach for motion when it earns its place:
- A number changing — the position in line, the wait estimate — should transition
  rather than snap, so the user sees that it moved and in which direction.
- A newly arrived list row should enter, not appear.
- A destructive confirmation should feel weightier than a neutral one.

`components/WalkingFigure.tsx` is worth reading before writing any rigged or
skeletal animation. It solves joint angles by two-bone inverse kinematics from an
authored foot path, because sine waves on both joints look like a marionette. Its
header explains why every segment sets `transformOrigin: '50% 0%'` — transforms
rotate about the element's centre by default, which visibly detaches limbs.

## Reviewing a screen

Work through this before calling a screen done. Read it as questions, not a
checklist to tick — the point is to look at the screen the way a stranger will.

1. What does it look like with no data? With failed data? With slow data?
2. What does it look like at the largest accessibility text size?
3. What does VoiceOver say when it reaches each control?
4. Is there exactly one primary action, and is it obvious?
5. Does every colour mean something, or is one of them just decoration?
6. Do the paddings come from `space`, and the elevations from `shadow`?
7. Is any sentence in Title Case?
8. Does anything claim something the data does not support?
9. Is every tappable thing at least 44pt, including its hit slop?
10. On a slow connection, what does the user see for the first two seconds?

## Verifying your work

`tsc --noEmit` from `apps/mobile` must be clean. There is no simulator in every
environment, so when you cannot see the screen, be explicit about that rather than
implying you checked it visually.

A useful scan for the accessibility gap, since it recurs — find touchables whose
only child is an icon and which carry no label:

```bash
cd apps/mobile/src && python3 - <<'PY'
import re, pathlib
for f in sorted(pathlib.Path('.').rglob('*.tsx')):
    src = f.read_text()
    for m in re.finditer(r'<TouchableOpacity[\s\S]*?</TouchableOpacity>', src):
        b = m.group(0)
        if '<Text' in b or 'accessibilityLabel' in b: continue
        if '<Ionicons' not in b and '<Image' not in b: continue
        print(f'{f}:{src[:m.start()].count(chr(10))+1}')
PY
```

## References

- `references/screens.md` — what each screen in the app is for, and the specific
  design pressure on it. Read it when working on a screen you have not touched
  before, so a change fits what the screen is actually doing.
