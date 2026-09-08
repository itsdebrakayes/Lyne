# App Store Connect — every field, filled in

Copy-paste ready. Character limits are Apple's and are counted, not estimated.
Where a value needs a decision from you it says **DECIDE**; where it needs a
value only Apple can give you it says **FROM APPLE**.

Related: [play-store-listing.md](play-store-listing.md) ·
[screenshots.md](screenshots.md) · [checklist.md](checklist.md)

---

## 1 · Create the app record

App Store Connect → **Apps** → **+** → **New App**

| Field | Value |
|---|---|
| Platforms | iOS |
| Name | `Lyne: Skip the Wait` |
| Primary language | English (U.K.) |
| Bundle ID | `com.lyne.mobile` — **must already exist**; `eas build` creates it on the first iOS build, or create it by hand under Certificates, Identifiers & Profiles |
| SKU | `LYNE-IOS-001` |
| User Access | Full Access |

> The **Name** is 19 characters of the 30 allowed and is the single biggest ASO
> lever you have. "Lyne" alone is a made-up word nobody searches for; the
> suffix is what puts you in front of someone typing "skip the line".

Once created, App Store Connect shows the app's **Apple ID** — a 10-digit
number. That is the `ascAppId` in `apps/mobile/eas.json`. Your **Team ID** is in
the top right of the Apple Developer portal.

---

## 2 · App Information

| Field | Value |
|---|---|
| Subtitle (30) | `See the wait. Hold your spot.` |
| Category — primary | Productivity |
| Category — secondary | Utilities |
| Content rights | Does not contain, show, or access third-party content |
| Age rating | 4+ (no objectionable content — the questionnaire answers are all "None") |

> **Productivity over Business.** Business is where enterprise tools go to be
> found by nobody; the person standing in a queue at TAJ is not browsing the
> Business category. Lifestyle is the other defensible answer if Productivity
> proves too crowded — but change it once, not repeatedly, because category
> churn resets your ranking history.

---

## 3 · Pricing and Availability

| Field | Value |
|---|---|
| Price | Free |
| Availability | **DECIDE.** Jamaica only for the pilot, or worldwide? |

> **Recommendation: Jamaica only, at first.** Every agency in the app is
> Jamaican, so a user in Ohio downloads something with nothing in it — which is
> how you collect one-star reviews before you have any five-star ones to absorb
> them. Availability widens in a click when there is somewhere else to queue.

---

## 4 · Version information

### Promotional text (170 — changeable without a review)

```
Now live at select agencies across Kingston. See the wait before you leave home,
hold your spot from your phone, and arrive when it is actually your turn.
```

### Description (4000)

```
Stop standing in line.

Lyne shows you how long the wait really is at the agency or business you need to
visit, lets you hold your place from wherever you are, and tells you when to
leave so you arrive close to your turn — not two hours before it.

SEE THE WAIT BEFORE YOU GO
Live queue lengths and estimated waits, branch by branch. If the Kingston office
is three hours deep and the one down the road is forty minutes, you will know
before you spend the bus fare.

HOLD YOUR SPOT FROM YOUR PHONE
Join the line without being in the building. Your position updates live as the
queue moves, so you can wait somewhere you would rather be.

KNOW WHEN TO LEAVE
Lyne watches the line move and tells you when it is time to set off, based on
where you are and how fast the queue is actually going today — not on a guess.

ARRIVE PREPARED
Check what documents a service needs before you travel, so you are not sent home
for a form nobody mentioned. Keep your own copies to hand, stored on your device
and locked behind Face ID.

PICK A BETTER TIME
See which hours and days are quietest at each branch, and plan the visit around
your life instead of around the line.

BUILT FOR JAMAica
Lyne is built first for Jamaican government agencies and businesses, with the
services, documents and opening hours that actually apply here.

Free to download and free to use.
```

> **`JAMAica` above is a deliberate marker, not a typo you missed — fix it to
> `JAMAICA` when you paste.** It is there so this block cannot be pasted into
> App Store Connect without being read once.

### What's New in This Version (4000)

```
The first release of Lyne.

See live waits at participating agencies, hold your place in the queue from your
phone, and get told when to leave so you arrive close to your turn.
```

### Keywords (100, comma-separated, **no spaces after commas**)

```
queue,line,wait,waiting,appointment,jamaica,government,agency,ticket,booking,virtual,visit,skip
```

> Do not repeat words already in the app name or subtitle — Apple indexes those
> separately and a repeat wastes characters you cannot get back.

### URLs

| Field | Value |
|---|---|
| Support URL | `https://uselyne.com/account` |
| Marketing URL | `https://uselyne.com` |
| Privacy Policy URL | `https://uselyne.com/privacy` |

---

## 5 · App Review Information

| Field | Value |
|---|---|
| Sign-in required | **Yes** |
| Demo account | **See the warning below — this needs work before you submit** |
| Contact | your name, `customersupport@uselyne.com`, and a phone number that will actually be answered |

### Notes to the reviewer

```
Lyne lets members of the public join a queue at a Jamaican government agency or
business from their phone and watch their position update live.

To review the core flow:
1. Sign in with the account above.
2. On Home, choose any agency, then a branch.
3. Tap Join the line and pick a service. A ticket is issued with a live position.
4. The Ticket screen shows the position updating and a "time to leave" estimate.
5. Leave the line from that screen to end the test.

Location is used only to estimate travel time for the departure reminder; the app
is fully usable if permission is declined.

Camera and photo library are used only if the user chooses to store a copy of an
identity document. Those images stay in the device keychain and are never
uploaded — no route on our server accepts them.

Payments are not enabled in this version.
```

---

## ⚠ The demo account problem — read this before you submit

**Production starts empty.** That is by design (`main` ships a sellable, empty
build), and it is also a rejection waiting to happen: a reviewer signs in, sees
no agencies, cannot join a queue, and files Guideline 2.1 or 4.2 — *we were
unable to review the app's core functionality*. It is one of the most common
first-submission rejections there is, and appealing it costs a week.

You have three ways out, in order of preference:

1. **Seed one real pilot agency into production before submitting.** Best
   answer, because it is also the answer to "what do I show a prospect".
2. **Create a clearly-labelled demonstration tenant in the production database**
   — one business, two or three branches, a handful of services — and give the
   reviewer an account scoped to it. Honest, visible, and it doubles as your
   sales demo.
3. **Point the review build at the demo environment.** Works, but the binary the
   reviewer approves is then not the binary your users run, which is a bad
   habit to start.

Whichever you pick, the reviewer account must be able to complete
join → position updates → leave. Test it on a real device, signed in as that
account, against the exact build you are submitting.

---

## 6 · App Privacy

Answer these to match `apps/mobile/app.json` → `ios.privacyManifests` and
[../SDK_PRIVACY_AUDIT.md](../SDK_PRIVACY_AUDIT.md). A reviewer compares them.

**Do you or your third-party partners collect data from this app?** → **Yes**

| Data type | Collected | Linked to identity | Used for tracking | Purpose |
|---|---|---|---|---|
| Name | Yes | Yes | No | App Functionality |
| Email Address | Yes | Yes | No | App Functionality |
| Phone Number | Yes | Yes | No | App Functionality |
| User ID | Yes | Yes | No | App Functionality |
| Coarse Location | Yes | Yes | No | App Functionality |
| Device ID | Yes | Yes | No | App Functionality |
| Product Interaction | Yes | Yes | No | App Functionality |
| Crash Data | Yes | **No** | No | App Functionality |

**Not declared, deliberately:**

- **Precise Location** — the app requests when-in-use location but only to
  estimate travel time. Declare Coarse; if you later use the exact coordinate
  for anything, this changes.
- **Payment Info** — payments are stubbed. Goes back in the day a processor is
  wired, in all three places at once.
- **TRN / National ID** — held in the device keychain, never transmitted. Under
  Apple's definition (data sent off the device) it is not collected. The server
  no longer accepts either field on any route.

**App Tracking Transparency:** not requested, and must not be. There are no
tracking domains.

---

## 7 · Sign in with Apple

Not in version 1 — the app is email and password only, which is allowed.

The rule that matters for version 2: **App Store Guideline 4.8** makes Sign in
with Apple mandatory the moment you offer Google sign-in. They ship the same day
or not at all. Setup for both is in [../PROVIDER_SETUP.md](../PROVIDER_SETUP.md).
