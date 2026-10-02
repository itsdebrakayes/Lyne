# Reviewer notes

What to paste into each console's review-information field, and why it says what
it says. Both stores ask the same two questions in different words: *how do we
sign in*, and *what are we looking at*.

The account is `appreview@uselyne.com`, created in Supabase Auth. The MySQL user
row is created by `POST /api/auth/sync-user` the first time that account signs
in, so **sign in on a real device once before submitting** — the row will not
exist until somebody does, and a reviewer hitting that path first is not the
moment to discover a problem with it.

The tenant they will see is `database/review_tenant_seed.sql` — Blue Harbour
Civic Centre (Demonstration). Apply that to production before submitting, or a
reviewer signs in to an empty app and files Guideline 2.1.

---

## App Store Connect

**App Review Information → Sign-In Required:** yes.

| Field | Value |
|---|---|
| User name | `appreview@uselyne.com` |
| Password | the password set in Supabase Auth |

**Notes** — paste verbatim:

```
Lyne shows live queue waits at service counters and lets a customer hold a
place in line from their phone.

WHAT YOU WILL SEE
The account above is signed in to a demonstration tenant, "Blue Harbour Civic
Centre (Demonstration)". It is a fictional office created for this review. It
is not a real organisation and offers no real services.

Lyne is an independent service and is not affiliated with, endorsed by, or
operated on behalf of any government agency.

TO COMPLETE A FULL JOURNEY
1. Sign in with the account above.
2. On the home screen, open "Blue Harbour Civic Centre (Demonstration)".
3. Open the branch "Blue Harbour Main Office".
4. Choose a service - "General Enquiries" is the simplest.
5. Tap to join the queue. You are issued a ticket number and a six-character
   verification code, and the screen then shows your live position and an
   estimated wait.
6. The same screen carries the departure reminder, which is the core of the
   product: it tells you when to leave based on your position.
7. Leave the queue from that screen to end the journey.

The queue is genuinely empty, so you will be first in line. That is the real
behaviour of a new queue rather than a limitation of the demonstration.

PERMISSIONS, AND WHY EACH IS ASKED
- Location is optional and is used only to estimate how long it will take you
  to reach the branch, which feeds the departure reminder. Declining it leaves
  every other feature working.
- Notifications carry queue updates and the departure reminder.
- Camera and photo library are used only if you choose to save an ID document.
  Those images are held in the device keychain and are never uploaded; there is
  no server copy and nothing syncs to another device.
- Face ID protects that locally saved document, nothing else.

iPad: the app supports iPad and has its own tablet layout - the customer
screens hold a centred reading column rather than stretching. The same binary
runs as the lobby kiosk terminal, which is why tablet support is on.

Payments are not enabled in this version. No purchase can be made.
```

---

## Google Play Console

**App access → All or some functionality is restricted.** Add one instruction
set:

| Field | Value |
|---|---|
| Name | Customer account |
| User name | `appreview@uselyne.com` |
| Password | the password set in Supabase Auth |

**Any other instructions** — paste verbatim:

```
Sign in with the account above, open "Blue Harbour Civic Centre
(Demonstration)", open "Blue Harbour Main Office", choose "General Enquiries",
and join the queue. The screen then shows a live position, an estimated wait
and a departure reminder. Leave the queue from the same screen.

"Blue Harbour Civic Centre (Demonstration)" is a fictional office created for
this review. Lyne is an independent service and is not affiliated with,
endorsed by, or operated on behalf of any government agency.

Location, camera and photo access are all optional. ID images are held in the
device keychain and never uploaded. Payments are not enabled in this version.
```

---

## Keep these three in agreement

The reviewer notes, the store listings and the app's own About screen all state
the same disclaimer, and reviewers do compare them. If the wording changes in
one, change it in all three:

- this file
- `docs/launch/play-store-listing.md`
- the About screen in the app

The same applies to the permission explanations: they must match
`ios.privacyManifests` in `apps/mobile/app.json`, the App Privacy answers, Play's
Data safety answers, and `apps/mobile/src/lib/legalContent.ts`. Five places, one
set of facts.
