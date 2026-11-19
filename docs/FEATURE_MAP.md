# Feature map

What Lyne does, from the user's side: how a person reaches each feature, and
what proves it works. An agent that changes a feature walks its row in the
running app (see "How to check" at the end) and brings back the proof: a
screenshot, a short recording, or the network response. A passing build or
typecheck is not proof. A row is "done" only when the proof column is true
on screen.

When you add a feature, add its row. When a fix touches a row, re-walk it.

## Customer mobile app (`apps/mobile`, iOS + Android, "Lyne: Skip the Wait")

| Feature | How a user reaches it | Proof it works |
|---|---|---|
| Sign up / sign in | First launch → Get started → email + code, or Sign in | Lands on Home with the person's first name; a wrong code says so in words, no spinner left running |
| Onboarding | After first sign-up: city, then sectors | Each step fades in fully readable; Finish lands on Home; never a washed-out or blank step |
| Find an organisation | Home → search, or a sector tile | Typing "lignum" finds Lignum Bank; tiles show real organisations, never TAJ/PICA/NHT on production |
| Branch and service | Organisation → branch → service | Branch shows Open/Closed matching its hours; service shows people waiting and estimated wait |
| What to bring | Service screen, before joining | The service's checklist set by the manager (Readiness) appears before the Join button |
| Join a line remotely | Service → Join | A ticket with number, place in line and estimated wait; the same ticket appears in the admin Live line within 30 s |
| Live ticket | Ticket screen, and the Live Activity on iPhone | Place and wait change when staff call the person ahead, without touching the phone |
| Time to leave | Ticket screen with location allowed | "Leave now" when wait minus drive time is under the buffer; directions open in Apple/Google Maps |
| Leave the line | Ticket → Leave | Ticket disappears here and from the admin Live line; reason recorded |
| Plan your visit / busy times | Branch → Busy times, Plan your visit (premium) | Hour-by-hour bars for the chosen day; free and premium are visibly different |
| Sessions and bookings | Organisation with a session → Register / Check in | Access code issued; check-in turns it into a ticket in the right line |
| Line helper | Account → Line helper | A helper can hold a place for someone; the hold shows on both phones |
| Notifications | Account → Notifications | Called / almost-your-turn alerts arrive; the opt-in switches persist after relaunch |
| Offline banner | Turn off Wi-Fi and data | Banner appears; it clears within ~5 s of the connection returning |
| Account deletion | Account → Privacy & Security → Delete | Account and sign-in removed; signing in again is refused (App Store 5.1.1(v)) |
| Update notice | Older app version than API's `APP_*_MINIMUM` | Required update blocks the app; optional one hides itself |

## Kiosk (tablet in the branch: `apps/mobile` kiosk mode, and `apps/admin-desktop` kiosk window)

| Feature | How a user reaches it | Proof it works |
|---|---|---|
| Walk-in ticket | Tap → choose service → type name → Join | A printed-style ticket with number and place; the same ticket appears in the admin Live line alongside app joiners (one line, not two) |
| Kiosk header | Always visible | Lyne mark and a live clock ticking each second; no organisation name until the kiosk reads its branch from the API |
| Reset for next person | Ticket screen countdown | Returns to the start screen once at zero, exactly once |

## Admin desktop (`apps/admin-desktop`, Electron, Mac universal + Windows)

Sign in with a staff login from `secrets/staff-logins.txt` (never print the passwords).
Common to every role:

| Feature | How a user reaches it | Proof it works |
|---|---|---|
| Sign in | Launch → email + password (+ authenticator code for managers and up) | Lands on the role's dashboard; an expired saved session signs out quietly, never "invalid token" |
| First load | Any dashboard right after sign-in | Skeletons, never a black or blank screen; "Your Figures Did Not Load" + Try Again on failure |
| Freshness | Top bar | "Updated …" ages on its own; turns stale when a refresh fails |
| Move the window | Drag the top bar | Window moves on Mac and Windows; buttons in the bar still click |
| One copy | Open the app twice | The second launch focuses the first window |
| Idle sign-out | Leave it untouched | Warning with countdown, then signed out |
| Tour | First sign-in for a role, or Help & Support → replay | Spotlight points at real parts of the loaded screen, never at a skeleton |

### Line staff (officer at a counter)

| Feature | How | Proof |
|---|---|---|
| Live line | Live line tab | Waiting people in order; Call next moves the first one to "called" and starts the timer at 0:00 |
| Confirm the ticket | Live line → type the 4-character code | Correct code starts service; wrong code says so |
| Finish a visit | Served / No-show / Couldn't finish + reason | Ticket leaves the line; reason appears in History and in manager reports |
| Transfer | Live line → Transfer | Ticket appears in the other service's line at its arrival-time place; confirmation clears after 8 s |
| Bookings & check-in | Bookings & Check-In tab | Today's appointments; check-in puts the person into the line |
| Load the day's list | Sessions → Load Today's List → paste, or Choose A File (.csv/.tsv/.txt) | "Read N entries" matches the file's rows (a heading row is not counted) before Load |

### Supervisor

| Feature | How | Proof |
|---|---|---|
| Section board | Section Board tab | Each counter, who is at it, and its line, live |
| Desk assignment | Desk Assignment tab | Moving an officer changes the counter they call from and the wait estimate |
| Customer cases | Customer Cases tab, 7 or 30 days | People with repeated unresolved visits, flags visible (Lignum: Beverley Walters flagged) |

### Branch manager

| Feature | How | Proof |
|---|---|---|
| Overview | Overview tab | Waits, served, counters open, services behind target, "Do this next" |
| Targets | Targets tab | Saving shows "Saved" for ~3 s and every branch figure is measured against it |
| Readiness | Readiness tab | Publishing a checklist shows it in the mobile service screen |
| Reports | Reports tab | Preview builds; card lifts only once the document is visible; Download gives a .doc/.pdf |

### Executive

| Feature | How | Proof |
|---|---|---|
| Overview across branches | Overview, Branches, Managers | Every branch against its target; demand heatmap by branch |
| Company report | Reports tab | Changing sections or branches rebuilds the preview immediately (no fake loading) |

## Public API and server

| Feature | Proof |
|---|---|
| Health | `curl https://api.uselyne.com/health` → 200 |
| App version gate | `GET /api/app/version` → the `APP_*` values from `.env` |
| Deploy | `bash deploy/verify.sh` ends with all checks passed |
| Field encryption | A walk-in's phone and date of birth read `enc:v1:…` in the database and plain in the admin line; `npm run test:db` (field-encryption) passes |

## How to check

- Admin window in a browser: `preview_start` with `admin` (from `.claude/launch.json`), then sign in.
  The packaged app: `npm --prefix apps/admin-desktop run package:mac`, open the .dmg from `release/`.
- Mobile: iOS Simulator (see memory "mobile testing setup"), or `mobile-web` for layout only.
  Mobile changes are checked on a device before promotion (CLAUDE.md rule 3).
- Bring back a screenshot or recording of the proof column, not a description of it.
