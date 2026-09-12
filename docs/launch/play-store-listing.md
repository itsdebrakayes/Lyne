# Google Play Console — every field, filled in

Your Play account is registered as an **organization**, which matters more than
it sounds: the "12 testers, opted in continuously for 14 days" closed-testing
requirement applies to **personal** accounts created after 13 November 2023.
Organizations are exempt. You can go to production review directly, and you have
saved two weeks off the calendar.

Related: [app-store-listing.md](app-store-listing.md) ·
[screenshots.md](screenshots.md) · [checklist.md](checklist.md)

---

## 1 · Create the app

Play Console → **All apps** → **Create app**

| Field | Value |
|---|---|
| App name (30) | `Lyne: Skip the Wait` |
| Default language | English (United Kingdom) |
| App or game | App |
| Free or paid | Free — **this cannot be changed to paid later** |
| Declarations | Developer Programme Policies: agree · US export laws: agree |

Package name `com.lyne.mobile` is fixed by the first upload and can never be
changed for the life of the listing.

---

## 2 · Store listing

### Short description (80)

```
See the wait, hold your spot from your phone, and arrive when it is your turn.
```

### Full description (4000)

```
Stop standing in line.

Lyne shows you how long the wait really is at the agency or business you need to
visit, lets you hold your place from wherever you are, and tells you when to
leave so you arrive close to your turn — not two hours before it.

SEE THE WAIT BEFORE YOU GO
Live queue lengths and estimated waits, branch by branch. If one office is three
hours deep and another is forty minutes, you will know before you spend the bus
fare.

HOLD YOUR SPOT FROM YOUR PHONE
Join the line without being in the building. Your position updates live as the
queue moves, so you can wait somewhere you would rather be.

KNOW WHEN TO LEAVE
Lyne watches the line move and tells you when to set off, based on where you are
and how fast the queue is actually going today.

ARRIVE PREPARED
Check what documents a service needs before you travel, so you are not sent home
for a form nobody mentioned. Keep your own copies to hand, stored on your device
and locked behind your fingerprint or face.

PICK A BETTER TIME
See which hours and days are quietest at each branch, and plan the visit around
your life instead of around the line.

BUILT FOR JAMAICA
Lyne is built first for Jamaican government agencies and businesses, with the
services, documents and opening hours that actually apply here.

Free to download and free to use.

Lyne is an independent service. It is not affiliated with, endorsed by, or
operated by any government agency. Agencies appear in Lyne because they use it
to run their own queues.
```

> **That last paragraph is not optional garnish.** Play's Impersonation policy
> treats an app that displays government agency names and logos as an
> impersonation risk unless it disclaims affiliation plainly. This is a common
> suspension cause for exactly this category of app, and the fix costs four
> lines. Keep the same disclaimer in the app's About screen.

### Graphics

| Asset | Requirement |
|---|---|
| App icon | 512 × 512 PNG, 32-bit, under 1 MB |
| Feature graphic | 1024 × 500 PNG or JPEG — **required**, and shown before your screenshots |
| Phone screenshots | 2–8, see [screenshots.md](screenshots.md) |
| Tablet screenshots | Optional, but the listing is demoted in tablet search without them |

---

## 3 · App content — the declarations that block release

Every one of these must be answered before Play will let you submit.

| Section | Answer |
|---|---|
| Privacy policy | `https://uselyne.com/privacy` |
| App access | **Restricted — credentials required.** Give the reviewer account and the exact steps (see below) |
| Ads | No ads |
| Content rating | Complete the IARC questionnaire — all "No" for this app; expect PEGI 3 / Everyone |
| Target audience | 18+ (or 13+). **Do not include under-13**, which triggers the Families policy and a design review you do not want |
| News app | No |
| COVID-19 contact tracing | No |
| Data safety | Section 4 below |
| Government apps | **DECIDE** — declare "No" (you are not a government entity), and rely on the disclaimer above |
| Financial features | None — payments are stubbed and no financial feature ships |
| Health apps | No |

### App access — instructions for the reviewer

```
All functionality requires a signed-in account.

Username: (the reviewer account)
Password: (the reviewer account)

To review the core flow:
1. Sign in with the account above.
2. On Home, choose any agency, then a branch.
3. Tap Join the line and choose a service. A ticket is issued with a live
   position in the queue.
4. The Ticket screen shows that position updating and an estimated time to leave.
5. Leave the line from that screen to end the test.

Location permission is optional and used only to estimate travel time. Camera and
photo access are used only if the user chooses to store a copy of an identity
document; those images remain on the device and are never uploaded.
```

**The same empty-production problem applies here as on the App Store — see the
warning in [app-store-listing.md](app-store-listing.md#-the-demo-account-problem--read-this-before-you-submit).
A reviewer who signs in and finds no agencies cannot complete step 2.**

---

## 4 · Data safety

Play asks a different question from Apple: Apple asks what you *collect*, Play
asks what you *collect and share*, and it wants encryption and deletion answers
too. Keep it consistent with `ios.privacyManifests` and the privacy policy —
Google does compare the form against the policy you linked.

**Does your app collect or share any of the required user data types?** → Yes
**Is all data encrypted in transit?** → Yes (HTTPS/TLS everywhere)
**Do you provide a way for users to request that their data is deleted?** → Yes
→ `https://uselyne.com/delete-account`

| Data type | Collected | Shared | Required | Purpose |
|---|---|---|---|---|
| Name | Yes | No | Required | App functionality, Account management |
| Email address | Yes | No | Required | App functionality, Account management |
| Phone number | Yes | No | Optional | App functionality |
| User IDs | Yes | No | Required | App functionality, Account management |
| Approximate location | Yes | No | Optional | App functionality |
| App interactions | Yes | No | Required | App functionality, Analytics |
| Crash logs | Yes | No | Optional | App functionality |
| Device or other IDs | Yes | No | Required | App functionality (push notifications) |

**Not declared:** precise location, financial info, photos or videos, files or
documents. Identity document images are held in the device keychain and never
transmitted, which under Play's definition is not collection — the same position
taken in the Apple answers and in the privacy policy.

---

## 5 · Release

| Field | Value |
|---|---|
| Track for the first submission | Internal testing → then Production. **Not straight to Production**: the bundle points at `api.uselyne.com`, which does not resolve yet |
| App signing | **Let Google manage the signing key** (Play App Signing). Accept the default |
| Countries | **DECIDE** — Jamaica only for the pilot; widen later in a click |
| Release name | `1.0.0 (2)` — match the version code EAS actually assigned |

### Release notes

Play caps this at 500 characters per language. Paste as-is into **en-US**:

```
The first release of Lyne.

See how long the line is before you leave home, hold your place from your
phone, and get told when to set off so you arrive close to your turn.

Your ticket, your position and your wait stay live on screen.
```

> Say nothing about agencies by name. The listing is read against what the
> reviewer can actually open, and naming a partner the build cannot show is the
> fastest way to be asked to prove the relationship.

> **Take Play App Signing.** It is the default, it means a lost upload key is a
> support ticket rather than an app you can never update again, and it is the
> reason the Google sign-in setup later needs *two* SHA-1 fingerprints — the
> upload key and Play's own signing key. Missing the second one is the classic
> "sign-in works in testing, fails for real users" bug.
