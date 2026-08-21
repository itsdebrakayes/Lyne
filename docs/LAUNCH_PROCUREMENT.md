# Launch procurement — what has to be bought, and what each thing unblocks

**Created:** 2026-08-18
**Purpose:** every item below is a feature that is *blocked on a purchase or an
account*, not on code. Where the code side is already written, that is stated, so
you can see exactly what your money turns on.

Costs are **indicative planning figures only** — they move, and several depend on
volume and on quotes you have not yet asked for. Confirm on the vendor's own page
before committing. Detailed budgeting lives in
[QMeNow_App_Only_Budget](../research/QMeNow_App_Only_Budget_2026-07-31.md) and
[Monitoring and Running Costs](../research/Monitoring_and_Running_Costs_2026-08-13.md);
this document is the *blocker list*, not a second budget.

---

## Priority 1 — blocks a feature that is visibly disabled in the product today

### 1.1 SMS provider  → unblocks "Text Customers When Called"

**Yes, you need an API key.** SMS cannot be sent from our own servers; a licensed
carrier or aggregator has to inject the message into the mobile network. That
means an account, a sender identity, and per-message billing.

**What already exists in code:** nothing beyond a comment. The notification
pipeline is push-only (`notifications.channel` defaults to `push`). This is a
genuine build, not a config flip — see "What I still have to build" below.

**Options, in the order I would evaluate them:**

| Option | Why consider it | Watch out for |
|---|---|---|
| **Twilio** | Best-documented, first-class Node SDK, works to +1876. Fastest to a working prototype. | Priced in USD per segment; needs a sender identity approved for the region. |
| **Vonage** | Similar shape to Twilio, sometimes better international rates. | Smaller community, fewer worked examples. |
| **AWS SNS** | Cheapest per message if you are already on AWS. | Deliverability to Caribbean networks is the least predictable of the three; no delivery receipts on some routes. |
| **Digicel / Flow business SMS** | Local termination, usually the best rate *and* the best deliverability to Jamaican numbers. A government client may also prefer a local supplier. | Often no self-serve REST API — expect a sales conversation, a contract, and possibly a fixed monthly minimum. Integration may be bespoke. |

**Recommendation:** start on **Twilio** for the pilot because it gets the feature
working in days, and open a parallel conversation with **Digicel or Flow** for
production volume. The code should sit behind one interface so swapping the
provider is a config change, not a rewrite — I will build it that way.

**A Jamaica-specific thing to ask every vendor.** +1876 sits inside the North
American Numbering Plan, so application-to-person traffic is subject to carrier
registration rules (in the US this is 10DLC; regionally it varies). Ask
explicitly: *"What sender registration do you require for application-to-person
SMS terminating on Digicel and Flow Jamaica, how long does approval take, and can
we use an alphanumeric sender ID?"* Approval lead time, not price, is the thing
most likely to delay you.

**What you buy:** an account, a sender identity (long code, short code, or
alphanumeric sender ID), and per-message credit.
**Rough shape:** small monthly number rental + a few US cents per message. At
pilot volumes this is a very small line item; at 50,000 messages/month it is not.

**What I still have to build** (once a key exists): a provider adapter, queueing
and retry, delivery-receipt handling, opt-out handling, and a per-customer
consent flag. Budget real development time for this, not an afternoon.

---

### 1.2 Kiosk hardware → unblocks a real self-service kiosk with printed tickets

This is covered in full in [KIOSK_HARDWARE.md](KIOSK_HARDWARE.md), because it is
a design decision as much as a purchase. Summary of what to buy:

| | Recommended | Why |
|---|---|---|
| **Device** | All-in-one Android kiosk with integrated thermal printer — Sunmi, Telpo or iMin class | One device, one power cable, printer guaranteed compatible, vendor-supplied print SDK |
| **Quantity for a pilot** | 1 per branch lobby, plus 1 spare | A dead kiosk in a lobby is worse than no kiosk |
| **Consumables** | 57mm or 80mm thermal paper rolls | Ongoing; cheap; nobody remembers to order them until it runs out |
| **Mounting** | Floor stand or counter mount | Must be reachable from a wheelchair |

**Also needed per kiosk:** mains power at the mounting point, and network —
prefer wired Ethernet, fall back to branch Wi-Fi.

---

## Priority 2 — blocks release, not a feature

### 2.1 Apple Developer Program → iOS TestFlight, App Store, and push
Annual fee. Without it there is no way to put the app on a real iPhone for
anyone but you, and no APNs credentials, so **iOS push notifications cannot
work**. This gates the "on-device bug sweep" that is still open in §C of
REMAINING_WORK.

### 2.2 Google Play Developer → Android release and FCM push
One-off registration fee. Same story on Android.

### 2.3 Hosting — DigitalOcean droplet
Blocks everything leaving your laptop. Sizing and hardening are in the budget
doc. Until this exists there is no URL to show a prospect that is not your
machine.

---

## Priority 3 — blocks a paid contract, not a pilot

### 3.1 Jamaican payment processor
Stripe does not operate in Jamaica, so the payment flow is stubbed. Candidates
already researched: **WiPay**, **Amber Pay eLink**, **PayPal card entry**. The
pilot is free/agency-paid, so this is not urgent — but no money can be collected
until one is chosen and integrated.

### 3.2 Public procurement licence
Already in progress and being paid for. This is what makes **PICA and NHT**
addressable, which is why they remain in the demo. Not a technology purchase, but
it belongs on this list because it gates two named prospects.

---

## Free, but still "to acquire"

| Item | Unblocks | Note |
|---|---|---|
| **Sentry account + DSN** | Crash reporting | Free tier is enough. Code is written and no-ops safely without a DSN. |
| **Supabase** | Auth | Already in use. |

---

## The order I would actually buy in

1. **Apple Developer + Google Play** — longest lead time (review, enrolment
   verification), and they gate every on-device test.
2. **Hosting** — you need somewhere to point a prospect.
3. **One kiosk device** — buy a single unit first and prove the print path end to
   end before ordering per-branch quantities.
4. **SMS account** — start the sender-registration clock early even if the code
   is not ready, because approval is the slow part.
5. **Payment processor** — only when a contract is actually close.
