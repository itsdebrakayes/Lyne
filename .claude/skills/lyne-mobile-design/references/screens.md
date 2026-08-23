# The screens, and what each one is under pressure to do

Read the entry for a screen before restyling it. A visual change that ignores what
the screen is *for* usually makes it prettier and worse.

## The queue path — this is the product

**HomeScreen** (`screens/main/HomeScreen.tsx`)
The first thing anyone sees. A dark hero card carries the shortest wait nearby and
is the primary way into a queue, followed by quick categories, top agencies, and
live branches near you. Its hardest state is *nothing nearby*: it must not imply a
queue exists when none does. Renders the hero only alongside a real branch — a
skeleton while loading, nothing on error, an honest stand-in when the answer is
genuinely none.

**SearchScreen** — Recents, then popular. On first use it shows a large
"Need anything?" prompt rather than an empty box, because an empty search screen
teaches nothing. Results carry a live wait per branch.

**BusinessScreen → BranchScreen → JoinQueueScreen**
The funnel. Each step narrows: agency, then branch, then service. JoinQueue is the
commitment point — it states plainly what you are joining and shows the live
count ahead and the estimated wait before you confirm. Nobody should be able to
join by accident.

**TicketScreen** — the screen people actually stare at
The one screen someone returns to every ninety seconds while standing in a room.
A 64pt ticket numeral, position, people ahead, estimated wait, a check-in code,
and leaving the queue.

Design pressure here is unusual and worth stating: this screen is read at a
glance, repeatedly, under stress, sometimes by someone who is anxious about
missing their turn. It has the most accessibility work in the app for that reason
— the number is spelled out character by character so VoiceOver does not say
"a-one", status is a live region so changes are announced without a swipe, and
the two stats are grouped so they read as "3 people ahead of you" rather than four
disconnected fragments. The wait says out loud that it is an estimate, because a
number that looks like a promise and is not will lose the user's trust the first
time it slips.

Leaving asks first. An hour of waiting should not end on one stray tap.

## Account and identity

**ProfileScreen** — Avatar, contact details, and document rows. The TRN and
national ID rows report "On this device", not "On file", because those numbers are
held in the device keychain and never sent to the server. Any redesign must keep
that distinction visible; it is the user-facing half of a privacy promise.

**DocumentCaptureScreen** — Photograph an ID so you can read the number off it
while typing. The photo is never uploaded or saved, and the screen says so. Do not
add language implying scanning, extraction, or automatic reading — an earlier
version claimed to scan and did not, which is the failure this screen was rewritten
to correct. If real extraction ever ships it must run on-device.

**PrivacySecurityScreen / LegalScreen / DeleteAccountScreen** — App Lock behind
Face ID, the policy and terms in full, and account deletion. Deletion requires
typing DELETE and lists what goes and what is retained. These screens are read by
App Review as well as by users; keep them plain and literal rather than styled
into vagueness.

## Supporting

**NotificationsScreen** — Queue calls and reminders. Notification copy is
deliberately vague on the lock screen (it never names the agency or service), so
this screen is where the detail actually lives. It has to be worth opening.

**HistoryScreen** — A day picker over a timeline of past visits. Status tone comes
from the semantic status colours.

**SavedScreen** — Saved agencies with their branches and best current wait.

**PlanVisitScreen** — The premium surface. Free users see the branch-level
headline and a locked preview; premium unlocks the per-service planner. The paywall
must be honest about what is and is not included, and about what a trial costs and
when it ends.

**PaymentMethodsScreen** — Saved cards. Card removal names the card by its last
four, because with several saved cards an unlabelled delete is a trap.

**HelpScreen / AgencyHelpScreen** — FAQ buckets and per-agency guidance.

## Auth and launch

**OnboardingScreen** — Welcome, the promise, and the way in. First impression;
worth more craft than its line count suggests.

**LoginScreen / SignupScreen** — Signup collects name, email, phone, date of birth
and password. It deliberately does *not* ask for a TRN: that was mandatory once,
stored server-side, and read by nobody.

**LaunchScreen** (`components/LaunchScreen.tsx`) — The splash. A rigged figure
walks across the screen for 2600ms. Read `components/WalkingFigure.tsx` before
touching it; the rig solves knee and hip angles by inverse kinematics from an
authored foot path, and the joints depend on `transformOrigin: '50% 0%'`.

## Shared components worth knowing

- `components/Feedback.tsx` — `SkeletonRows`, `SkeletonCard`, `ErrorCard`, `EmptyCard`. Use these; do not write new ones.
- `components/Glass.tsx` — `GlassView`, `Sheen`. The translucent material.
- `components/TabBar.tsx` — Dark floating pill, icon-only tabs, cyan centre action for the app's core verb.
- `components/OfflineBanner.tsx` — Sits above the navigator when the connection drops.
- `components/PremiumBadge.tsx`, `BestTimeCard.tsx`, `CalendarSheet.tsx`, `CardSheet.tsx`, `LockGate.tsx`, `Code39Barcode.tsx`, `FaqBucket.tsx`.
