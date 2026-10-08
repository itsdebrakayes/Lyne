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

```
1. WHAT THE APP DOES AND WHO IT IS FOR
Lyne lets members of the public in Jamaica see how long the line is at a
service counter (government offices, credit unions, clinics, universities)
before they leave home, join that line from their phone, and arrive when they
are nearly at the front. The audience is adults who need to visit an office
in person. Organisations that use Lyne run their counters from a separate
desktop app; this iOS app is the customer side (and, on iPad, an optional
lobby kiosk for people without a phone).

Lyne is an independent service. It is not affiliated with, endorsed by, or
operated on behalf of any government agency.

2. HOW TO REVIEW THE MAIN FEATURES WITH THE DEMO ACCOUNT
Sign in with the account provided above. It is attached to a fictional
demonstration organisation, "Blue Harbour Civic Centre", created for review.
 a. Home shows live waits. Open "Blue Harbour Civic Centre", then
    "Blue Harbour Main Office".
 b. Choose a service ("General Enquiries" is simplest), tap "See the line",
    then "Join this line". If the service lists required items, tick them,
    then hold the button to join. You get a ticket number, a six-character
    code, and your live position and estimated wait.
 c. While in line the ticket also appears on the Lock Screen and in the
    Dynamic Island (Live Activity), and updates as the line moves.
 d. "Leave queue" ends the visit. (Once a ticket is being served at the
    counter the options change to "Mark as incomplete".)
 e. Busy times, the week planner and Line Helper are Lyne Premium features.
    The demo account can start the free 14-day trial from any locked panel,
    or open Profile → Lyne Premium to see the subscription offered through
    In-App Purchase (use a Sandbox Apple ID to test a purchase). "Restore
    purchases" is on the same screen.
 f. Account deletion: Profile → scroll to "Delete account" → "Delete my
    account" → type DELETE to confirm. It deletes the account and its data on
    our servers and the sign-in record.

3. EXTERNAL SERVICES THE APP USES
 - Authentication: Supabase Auth (email and password, with a one-time code
   emailed to confirm a new account), Sign in with Apple, and Sign in with
   Google.
 - Our API and database: Lyne's own server, hosted on DigitalOcean (API on a
   DigitalOcean droplet, MySQL on DigitalOcean Managed Databases).
 - Payments: Apple In-App Purchase only, for the Lyne Premium subscription.
   Purchases are verified server-side with the App Store Server API. The app
   contains no card form and no link to buy outside the App Store.
 - Push notifications: Apple Push Notification service, delivered through
   Expo's push service; Live Activity updates are sent directly to APNs.
 - Maps: none embedded. "Directions" hands the branch address to Apple Maps
   (or another installed maps app).
 - OCR: on-device only (Apple Vision). An ID or TRN document the user chooses
   to scan is read on the phone; the image is not uploaded, and the number is
   stored in the device keychain.
 - Crash reporting: Sentry (crash and error reports, not linked to identity).
   There is no advertising, analytics or tracking SDK, and the app does not
   use App Tracking Transparency.
 - Location: used on-device to estimate travel time to a branch for the
   "time to leave" reminder. Optional; declining it leaves every other
   feature working.

4. REGIONAL DIFFERENCES
The app is the same in every storefront. The organisations listed are in
Jamaica, so the content is only useful there. Lyne Premium is sold through
In-App Purchase in every storefront at Apple's local price tier; there is no
regional pricing or feature difference set by us.

5. REGULATED ACTIVITY
None. Lyne does not provide financial, medical, legal or government services
itself; it shows queue information for organisations that do and lets a
person hold a place in their line. It does not handle money other than
through In-App Purchase, gives no medical or financial advice, and does not
verify identity on any organisation's behalf. Identity numbers a user chooses
to save stay on their own device.

6. ANYTHING ELSE
The demonstration organisation is fictional and its lines are real, live
lines on our production server, so you may be first in line. That is the
genuine behaviour of a quiet queue rather than a limitation of the demo.
```

---

## What has to be true before submitting

These are facts the notes above state. Each one depends on something outside
the code.

| Statement | Needs | Status |
|---|---|---|
| Demo account signs in and sees Blue Harbour | Reviewer account in Supabase Auth on the production project; `database/review_tenant_seed.sql` (and the extra branches/history) applied to production; one sign-in on a real device so the MySQL user row exists | **You** — see item 17 |
| "one-time code emailed to confirm a new account" | `supabase/templates/confirm-signup.html` pasted into Supabase → Email Templates → Confirm signup; `https://uselyne.com/auth/confirmed` added to Redirect URLs; website deployed | **You** |
| Live Activity updates while the app is closed | APNs key: `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_PRIVATE_KEY` on the production API; migration 036 applied | **You** (without it the Live Activity still updates while the app is open) |
| In-App Purchase, verified server-side | Paid Apps agreement, banking and tax in App Store Connect; subscription group "Lyne Premium" with `com.lyne.mobile.premium.monthly` and `com.lyne.mobile.premium.yearly`; In-App Purchase key as `APPSTORE_ISSUER_ID`, `APPSTORE_KEY_ID`, `APPSTORE_PRIVATE_KEY`; migration 037 applied | **You** |
| Google Play Billing | Same two product ids as subscriptions in Play Console; service account JSON as `GOOGLE_PLAY_SERVICE_ACCOUNT` with access to the app in Play Console | **You** |
| Deletion removes server data | Deployed backend (commit `7dc2310` restores the ID-scan and form deletion) | Code done |

## Play Console → App access → instructions

```
Sign in with the account provided. It belongs to a fictional demonstration
organisation, "Blue Harbour Civic Centre". Open it, open "Blue Harbour Main
Office", choose a service, tap "See the line" and then "Join this line". The
ticket shows a live position and estimated wait, and an ongoing notification
keeps it in the notification shade. "Leave queue" ends the visit.

Lyne is an independent service and is not affiliated with, endorsed by, or
operated on behalf of any government agency. Location, camera and photo access
are optional. ID images are read on the device and never uploaded. Lyne
Premium is sold only through Google Play Billing.
```
