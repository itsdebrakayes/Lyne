# Mobile UX sweep — native conventions & Norman's two gulfs

_Swept 21 Jul 2026, against the customer app (`apps/mobile`, 20 screens)._

Two questions were asked of every screen:

- **Gulf of execution** — can the user tell *how to do* the thing they want? Is the
  control there, obvious, and does it do what its label promises?
- **Gulf of evaluation** — after acting, can the user tell *what happened* and what
  state the system is now in?

Plus: does it behave the way a 2026 iOS/Android app is expected to behave?

---

## Fixed in this sweep

### 1. The branch's open state was decorative — **gulf of execution**
Home and the Branch header showed Open / About-to-open / Closed, but nothing
downstream honoured it. A closed branch still offered a full-strength
"Join this queue · ~15m" button, which led to a Join screen reading
"0 ahead · 0m est. wait" — an *invitation* — that failed on tap with a raw error.
The user was told the door was locked and simultaneously invited to walk through it.

Fixed: both screens gate on the same helper, the CTA disables and says *why*
("Closed right now" / "Opening soon"), and counts render "—" when there is no line
to join. Both screens tick every 30s so they open themselves when the branch does,
rather than stranding the user on a stale screen.

### 2. Closed was styled as an error — **gulf of evaluation**
A closed branch rendered in danger red, the same treatment as a failed request.
A branch being shut at 6pm is a normal state, not a fault. Now an informational
amber notice with a matching icon (moon / clock / walking figure).

### 3. Leaving a queue had no confirmation — **native convention**
The single irreversible action in the app — releasing your place in line — fired
immediately on one tap. Every native app confirms this. Now a bottom sheet that
names the actual consequence ("you'll give up place 6 … you'll start again at the
back of the line") rather than a bare "Are you sure?", with the safe option
present and the destructive one marked as destructive.

### 4. Walk-ins could be leapfrogged — **fairness, and it shows in the room**
Someone tapping "join" from home the second the doors opened could take the first
slot ahead of a person who had travelled and was standing at the counter. Remote
joining now opens 5 minutes after the branch does, enforced server-side (not just
a disabled button), and the app explains the hold rather than silently failing.

---

## Found, not yet fixed

| # | Finding | Why it matters |
|---|---------|----------------|
| 38 | Est. wait contradicts itself: Branch says "~15m", Join says "150m" for the same service, one tap apart | Gulf of evaluation. The app disagrees with itself by 10×; a CIO will catch this |
| 39 | No haptics anywhere (`expo-haptics` unused) | Consequential moments — joined, called forward — land with no tactile confirmation |
| 40 | `react-native-safe-area-context` installed but used in **zero** files; 8 screens hardcode `paddingTop: 58` | Polish, not breakage — nothing clips, but layout doesn't adapt across devices |
| 41 | Pull-to-refresh on 5 screens but not on Ticket / Branch / Business / Service | The ticket screen is exactly where a waiting customer will instinctively pull |

---

## Verified as already correct

- **Skeletons, not spinners**, on 8 screens while data loads.
- **Optimistic UI** on the save/bookmark toggle, with rollback on failure — the
  bookmark fills instantly like a like button.
- **Live polling** on the ticket screen (5s), so position updates without action.
- **Empty states** carry an icon, an explanation and a way forward, rather than
  rendering a blank list.
- **Error states** offer a retry rather than dead-ending.
- **Wait figures never advertise 0 minutes** — a live average of zero falls back to
  the service's base estimate.
