# Compliance notes — read before publishing the policies

**Date:** 2026-08-13
**Status:** drafts prepared, legal review outstanding

I've drafted a Privacy Policy and Terms of Service in this folder. Three things you need to know before you rely on them, because two of them are about what a document **can't** do for you.

---

## 0. Read this first — a sole trader has unlimited personal liability

**Updated 21 August 2026, after you told me DKS Technologies is a sole trader.**

You asked me to make the legalities so that you are "un-sueable". I have
strengthened the documents as far as wording legitimately can, and I have to be
straight with you about the rest, because believing you are covered when you are
not is the expensive outcome.

**No document makes anyone un-sueable.** Anyone can bring a claim. What good
terms do is (a) make a claim harder to win, (b) cap what it can cost you, and
(c) push risk onto the party that actually caused it. All three are now in the
Terms. What they cannot do is change *who* pays if a claim succeeds.

**As a sole trader, that is you personally.** There is no separate legal person
between the business and your own assets — your savings, your car, your home.
A limited company is the thing that creates that separation, and it is the only
one of these four measures that changes who is on the hook:

| Measure | What it does | Status |
|---|---|---|
| **Incorporate a limited company** | Puts a legal person between a claim and your personal assets. **This is the actual protection.** | Not done — sole trader |
| **Professional indemnity + cyber insurance** | Pays the claim and the defence costs. Cyber cover matters most: you hold TRNs and passport numbers, and a breach is the realistic claim. | Not in place as far as I know |
| **Liability caps and exclusions in the Terms** | Limits exposure per claim, time-bars stale claims, and excludes what organisations do | **Done — see §9, §9.1–9.3, §23A, §26** |
| **Actually doing what the policies say** | An accurate policy you follow is a defence; one you don't follow is evidence against you | Ongoing |

**Two things specific to your position:**

1. **You are heading into government procurement**, and public bodies routinely
   require a supplier to carry insurance and, often, to be incorporated. This is
   likely to become a commercial blocker before it becomes a legal one.
2. **You process sensitive personal data** — TRN, National ID, passport. The DPA
   carries criminal penalties for some breaches, and **criminal liability
   attaches to the individual regardless of business structure.** Incorporating
   protects your assets from civil claims; it does not protect you from that.
   Following the security commitments in §11 of the Privacy Policy is what does.

**My recommendation, in order:** get a quote for cyber and professional
indemnity cover this month; ask the attorney reviewing these documents what
incorporating would cost and whether to do it before the first public-sector
contract; and do not sign anything that makes you liable for a customer's own
data decisions — §18 and §23A are drafted to prevent exactly that.

## 1. I'm not a lawyer, and this specifically needs a Jamaican one

The drafts are thorough and specific to what this app actually does — I wrote them against the real schema, not from a template. But the Data Protection Act, 2020 carries **criminal penalties** for some breaches, and a data controller handling TRN, National ID and passport numbers is squarely in its strictest category.

Get a Jamaican attorney with data-protection experience to review both documents before launch. This is a few hundred dollars that protects the whole company. Budget it alongside the procurement licence.

## 2. "They agree to everything we might do in future" is not achievable — and asking for it creates risk

You asked for terms where agreeing once covers everything you may do later. I have to be straight with you: **that isn't how the DPA works**, and writing it that way would make things worse, not better.

Under the DPA (and GDPR, and every regime you'll meet expanding through the Caribbean), consent must be **specific, informed and freely given** for identified purposes. A clause saying "you consent to any future use we devise" is:

- **unenforceable** — a regulator or court disregards it,
- **a red flag** in any due-diligence or procurement review, and government procurement is exactly where you're heading,
- **grounds for an App Store rejection** under Apple's data-use rules.

What actually gives you the flexibility you're after, and is enforceable:

1. **Purposes drawn broadly but honestly** — the drafts describe *categories* of use ("operating and improving queue services, including forecasting and analytics") rather than an itemised list you'd outgrow in a month.
2. **A change mechanism** — material changes are notified in-app with a stated notice period, and continued use after that is acceptance. This is the standard and it holds up.
3. **Separated consents** — the things with stricter rules (document scanning, marketing, location) are opted into individually. Bundling them into one "I agree" is what actually gets challenged.

So: broad, honest, and updatable. Not blanket.

## 3. Your data is in Ohio, and the DPA has something to say about that

Your Supabase project is in **`us-east-2`** — US East (Ohio). The DPA restricts transferring personal data outside Jamaica unless a condition is met (adequate protection in the destination, the data subject's consent, contractual safeguards, or one of the other statutory grounds).

This is a real, current exposure and it is not fixed by a policy paragraph alone. Options, roughly in order of cost:

- **Disclose and consent** — the drafts already name the transfer and the jurisdiction, and consent is one of the statutory grounds. Cheapest, and probably sufficient to launch.
- **Contractual safeguards** — a data-processing agreement with Supabase.
- **Move the data to a closer or Jamaican-hosted region** — most robust, most disruptive.

Ask your attorney which is sufficient for a government client, because a procurement review **will** ask where the data lives.

---

## What you must do beyond the documents

- [ ] **Register as a data controller** with the Office of the Information Commissioner. This is a legal obligation under the DPA, not optional, and it has a fee and a renewal.
- [ ] **Appoint a Data Protection Officer** if you meet the threshold — check whether you do; the answer changes as you grow, and public-sector clients raise the stakes.
- [ ] **Data-processing agreements** with every processor: Supabase, your API host, Sentry, Stripe/Apple, Expo.
- [ ] **A breach-response plan.** The DPA requires notification to the Commissioner, on a clock. Deciding what to do during an incident is too late.
- [ ] **Retention periods.** The drafts state them; make sure the system actually enforces them — right now nothing expires old `ocr_results` automatically. That's a gap between what the policy promises and what the code does, and that gap is the thing regulators find.
- [ ] **Records of processing activities.**

## Where the documents go

- Hosted publicly on the marketing site (`/privacy`, `/terms`)
- Linked **on the signup screen, before the account is created** — this is one of the two rejections your friend hit
- Linked from Profile
- Privacy Policy URL entered in App Store Connect

## The honest summary

The drafts put you in a substantially better position than having nothing, and they're specific enough to be useful rather than boilerplate. They do not make you bulletproof, and no document would. The things that actually protect you are the attorney review, the OIC registration, and making the system behave the way the policy says it does — particularly retention.
