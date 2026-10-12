# App Review notes — Lyne 1.0 (iOS) and Android

Paste-ready answers to the questions App Review sent with the Guideline 2.1
"information needed" message, plus the Play Console equivalents. Every
statement here was checked against the code on `ux-and-security-hardening`;
where something depends on a setting you control (a dashboard, a key), it says
so. **No credentials appear in this file.** The reviewer account's password
goes only into App Store Connect / Play Console.

Keep in agreement with: `docs/launch/reviewer-notes.md`, the store listings,
`apps/mobile/app.json` (privacy manifest), the App Privacy / Data safety
answers, and `apps/mobile/src/lib/legalContent.ts`.

---

## Paste into App Store Connect → App Review Information → Notes

3732 characters including spaces and line breaks (limit 4,000; kept under 3,900).

```
1. WHAT THE APP DOES AND WHO IT IS FOR
Lyne lets members of the public in Jamaica see how long the line is at a service counter (government offices, credit unions, clinics, universities) before they leave home, join that line from their phone, and arrive when they are nearly at the front. The audience is adults who need to visit an office in person. Organisations run their counters from a separate desktop app; this app is the customer side.

Lyne is an independent service. It is not affiliated with, endorsed by, or operated on behalf of any government agency.

2. HOW TO REVIEW WITH THE DEMO ACCOUNT
Sign in with the account provided. It belongs to a fictional demonstration organisation, "Blue Harbour Civic Centre", created for review.
a. Home shows live waits. Open "Blue Harbour Civic Centre", then "Blue Harbour Main Office".
b. Choose a service ("General Enquiries" is simplest), tap "See the line", then "Join this line". If the service lists required items, tick them first. You get a ticket number, a six-character code, and your live position and wait.
c. While in line the ticket also shows on the Lock Screen and in the Dynamic Island (Live Activity) and updates as the line moves.
d. "Leave queue" ends the visit and asks for an optional reason. Once a ticket is being served at the counter, the only option is "Mark as incomplete".
e. Plan your visit (Home > "Plan for later"): today's best hour, then "Busy times" (an hour-by-hour heatmap), the week planner (tap a "For you" row) and Line Helper ("Hold my place"), which joins the line for you at a time you agree. All are free and open to every user.
f. Account deletion: Settings (person icon, bottom right) > scroll to the bottom > "Delete account" > type DELETE > "Delete everything". This deletes the account, its data on our servers and the sign-in record.

3. EXTERNAL SERVICES
- Sign-in: Supabase Auth, email and password, with a 6-digit code emailed to confirm a new account.
- Our API and database: Lyne's own server on DigitalOcean (API droplet, MySQL on DigitalOcean Managed Databases).
- Payments: none. Lyne is free and sells nothing: no in-app purchases, subscriptions or paid features, and no link to buy anything elsewhere.
- Push notifications: Apple Push Notification service, through Expo's push service; Live Activity updates go directly to APNs.
- Maps: none embedded. "Get directions" hands the branch address to Apple Maps or another installed maps app.
- Text recognition: on-device only (Apple Vision). A TRN document the user chooses to scan is read on the phone; the image is not uploaded and the number is kept in the device keychain.
- Crash reporting: Sentry (errors only, not linked to identity). No advertising, analytics or tracking SDK; no App Tracking Transparency.
- Location: optional, used on the device only to estimate travel time for the "time to leave" reminder and to show the user's city. It is never sent to our servers.

4. REGIONAL DIFFERENCES
None. The app is the same in every storefront and is free everywhere. The organisations listed are in Jamaica, so the content is only useful there.

5. REGULATED ACTIVITY
None. Lyne does not provide financial, medical, legal or government services itself; it shows queue information for organisations that do and lets a person hold a place in their line. It handles no money, gives no medical or financial advice, and does not verify identity on any organisation's behalf. Identity numbers a user chooses to save stay on their own device.

6. ANYTHING ELSE
The demonstration organisation is fictional, but its lines are real, live lines on our production server, so you may be first in line. That is the genuine behaviour of a quiet queue, not a limitation of the demo.
```

---

## What has to be true before submitting

These are facts the notes above state. Each one depends on something outside
the code.

| Statement | Needs | Status |
|---|---|---|
| Demo account signs in and sees Blue Harbour | Reviewer account in Supabase Auth on the production project; `database/review_tenant_seed.sql` then `database/review_tenant_history.sql` applied to production (re-run the history file every few weeks to keep the 90-day window full); one sign-in on a real device so the MySQL user row exists | **You** — see item 17 |
| "one-time code emailed to confirm a new account" | `supabase/templates/confirm-signup.html` pasted into Supabase → Email Templates → Confirm signup; `https://uselyne.com/auth/confirmed` added to Redirect URLs; website deployed | **You** |
| Live Activity updates while the app is closed | The existing APNs key: `APNS_KEY_ID=6H44RYBAX3`, `APNS_TEAM_ID=UD8HYB75P4`, `APNS_PRIVATE_KEY` (from `secrets/apns-6H44RYBAX3.p8`) on the production API; migration 036 applied | **You** (without it the Live Activity still updates while the app is open) |
| "Lyne is free and sells nothing" | `PAYMENTS_ENABLED = false` in `apps/backend/src/lib/premium.js` and `apps/mobile/src/lib/features.ts`; `expo-iap` not installed. Migration 037 is **not** applied in 1.0 | Code done |
| Deletion removes server data | Deployed backend (commit `7dc2310` restores the ID-scan and form deletion) | Code done |

## Play Console → App access → instructions

```
Sign in with the account provided. It belongs to a fictional demonstration
organisation, "Blue Harbour Civic Centre". Open it, open "Blue Harbour Main
Office", choose a service, tap "See the line" and then "Join this line". The
ticket shows a live position and estimated wait, and an ongoing notification
keeps it in the notification shade. "Leave queue" ends the visit; once a ticket
is being served, the only option is "Mark as incomplete".

Plan your visit (Home > "Plan for later") shows the best time to go, Busy
times, the week planner and Line Helper. All are free for every user.

Account deletion: Settings (person icon, bottom right) > "Delete account" >
type DELETE > "Delete everything".

Lyne is free and sells nothing: no in-app purchases, subscriptions or paid
features. It is an independent service and is not affiliated with, endorsed
by, or operated on behalf of any government agency. Location, camera and
photo access are optional; location is used on the device only. ID images are
read on the device and never uploaded.
```
