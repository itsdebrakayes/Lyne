# Accounts and purchases still outstanding

Apple Developer Program and Google Play Console are **done**, which takes the two
longest lead times off the schedule. What follows is what is left, in the order
that unblocks the most.

Costs are indicative and were checked in September 2026. Confirm on the vendor's
own page before paying — they move, and several depend on quotes you have not
asked for yet. The budget lives in
[../../research/Lyne_App_Only_Budget_2026-07-31.md](../../research/Lyne_App_Only_Budget_2026-07-31.md);
this is the blocker list.

---

## 1 · DigitalOcean — blocks everything

Nothing mobile can ship until the API has a public HTTPS address, because a
release build refuses to start without `EXPO_PUBLIC_API_URL`.

**Sign up:** <https://cloud.digitalocean.com/registrations/new> · card required,
usually a small temporary authorisation.

Then create two things, **in this order**, both in the same region — New York or
Toronto are the nearest to Jamaica; pick one and use it for both, because a
droplet and a database in different regions cannot share a private network.

### The droplet

| Field | Value |
|---|---|
| Image | Ubuntu 24.04 (LTS) x64 |
| Plan | Basic → Regular → **2 vCPU / 4 GB / 80 GB** — about $24/mo |
| Region | New York 3 (or Toronto 1) |
| VPC | the default for that region — note which one |
| Authentication | **SSH key.** Paste `~/.ssh/id_ed25519.pub`; if you have no key: `ssh-keygen -t ed25519` |
| Hostname | `lyne-prod-1` |
| Backups | Yes (+20%) — a whole-droplet snapshot is a different kind of insurance from the database dumps, and it is worth the few dollars |

### The managed database

| Field | Value |
|---|---|
| Engine | **MySQL 8** |
| Plan | Basic → **1 vCPU / 1 GB / 10 GB** — about $15/mo |
| Region and VPC | **the same as the droplet** |
| Name | `lyne-db-prod` |

After it is created: **Settings → Trusted sources → add the droplet.** Until you
do, every connection is refused and the error looks exactly like a wrong
password. Then **Connection details → Download CA certificate** — that file
becomes `secrets/mysql-ca.crt`, and without it the API cannot connect at all,
because a managed database refuses plaintext.

Running total: roughly **$44/month** with Spaces for off-box backups.

Everything after that is [`deploy/README.md`](../../deploy/README.md).

---

## 2 · Expo — free, needed for signed builds

**Sign up:** <https://expo.dev/signup>

Use an account that belongs to the business, not a personal one you will want to
move later — the account owns every build and every credential EAS manages for
you. Then `eas login` and `eas init` as in
[build-and-submit.md](build-and-submit.md#0--one-time-setup).

The free tier queues builds behind paid ones. That is an annoyance measured in
tens of minutes, not a blocker; a paid plan is worth considering only when you
are shipping several builds a day.

---

## 3 · Sentry — free, and worth doing before launch, not after

**Sign up:** <https://sentry.io/signup/> → create a **React Native** project →
copy the DSN.

```bash
eas secret:create --scope project --name EXPO_PUBLIC_SENTRY_DSN --value "https://…"
```

The code is already written and no-ops safely without a DSN. The argument for
doing it now rather than later is narrow and strong: crashes in the first week
come from real devices, real networks and real Jamaican carriers, on hardware you
do not own — and you only get to see them once.

---

## 4 · Windows EV code-signing certificate — start it, it has postal lead time

Blocks nothing in version 1 of the **mobile** app. It blocks the **admin desktop
app** being installable without Windows calling it unrecognised — which is the
first impression an agency's IT officer forms of your software.

Since June 2023 the private key must live on FIPS 140-2 hardware: a physical USB
token, or a cloud signing service. There is no downloadable certificate file any
more, and the token **ships physically**, which is the slow part.

| Type | Rough cost/yr | SmartScreen |
|---|---|---|
| OV | US$200–400 | Warns until download reputation accrues |
| **EV** | US$400–700 | Trusted immediately |

**EV.** You are selling to government departments; "reputation accrues" means
your first several agency installs each show a scary warning.

Issuers to quote: DigiCert, Sectigo, SSL.com, GlobalSign. Your existing D-U-N-S
supports the validation — certificate authorities use the same business
verification sources Apple and Google did.

---

## 5 · SMS provider — start the registration clock early

Blocks "Text Customers When Called", which is visibly disabled in the product
today. The full comparison is in
[../LAUNCH_PROCUREMENT.md](../LAUNCH_PROCUREMENT.md#11-sms-provider---unblocks-text-customers-when-called).

Short version: open a **Twilio** account to get the feature working, and start a
parallel conversation with **Digicel or Flow** for production volume and local
deliverability. Ask every vendor the same question, first:

> *What sender registration do you require for application-to-person SMS
> terminating on Digicel and Flow Jamaica, how long does approval take, and can
> we use an alphanumeric sender ID?*

Approval lead time, not price, is what will delay you. Note that the code side is
a genuine build — a provider adapter, queueing, retries, delivery receipts,
opt-out and a consent flag — not a config flip.

---

## 6 · Not yet

| | Why it can wait |
|---|---|
| **Jamaican payment processor** (WiPay / Amber Pay / PayPal card entry) | The pilot is free or agency-paid. No money can be collected until one is integrated, but nothing before a signed contract needs it. |
| **Kiosk hardware** | Buy **one** unit and prove the print path end to end before ordering per-branch quantities. [../KIOSK_HARDWARE.md](../KIOSK_HARDWARE.md) |
| **Apple / Google sign-in** | Version 2. They ship together — Guideline 4.8 makes Sign in with Apple mandatory the day you offer Google. Setup is written up in [../PROVIDER_SETUP.md](../PROVIDER_SETUP.md). |
