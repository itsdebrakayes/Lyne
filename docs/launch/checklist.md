# Launch checklist

Ordered by what blocks what, not by how hard each item is. Everything with a
name against it needs a person; everything else is in
[`deploy/`](../../deploy/) or [build-and-submit.md](build-and-submit.md).

---

## Blockers — nothing ships until these are true

- [ ] **A pilot agency, or a demonstration tenant, exists in the production
      database.** Production starts empty by design. A store reviewer who signs
      in and finds nothing to queue for cannot review the app, and files
      Guideline 2.1 / 4.2. This is the single most likely cause of a first
      rejection. See the warning in
      [app-store-listing.md](app-store-listing.md#-the-demo-account-problem--read-this-before-you-submit).
- [ ] **A reviewer account that can complete join → position → leave**, tested
      on a real device against the exact build being submitted.
- [x] **`supportsTablet` decided — staying `true`.** The kiosk terminal is this
      same binary running on an iPad, so turning tablet support off would render
      the lobby terminal as a scaled-up phone app. The customer screens now hold
      a centred 780pt reading column on any window 700pt or wider
      (`apps/mobile/src/lib/stage.ts`), so the iPad sees a laid-out app rather
      than a stretched one. A 13-inch iPad screenshot set is therefore required.
- [ ] **The API is live on HTTPS** at `api.uselyne.com` and `EXPO_PUBLIC_API_URL`
      in `eas.json` points at it. A release build refuses to start without it —
      deliberately.

## Infrastructure

- [ ] DigitalOcean droplet created (Ubuntu 24.04, 2 vCPU / 4 GB)
- [ ] Managed MySQL created, **same region and VPC** as the droplet
- [ ] DNS: `api.uselyne.com` and `admin.uselyne.com` → the droplet's IP,
      **before** the first deploy (Caddy's certificate request needs them to
      resolve)
- [ ] Droplet added to the database's **Trusted sources**
- [ ] `bash deploy/provision.sh` run, and `ssh lyne@…` confirmed working before
      the root session was closed
- [ ] `.env` filled in from `deploy/env.production.example`; `PORTAL_HANDOFF_SECRET`
      generated fresh on the droplet
- [ ] `secrets/mysql-ca.crt` in place
- [ ] `bash deploy/init-managed-db.sh` run — schema, migrations, and grants
- [ ] `bash deploy/deploy.sh` run and the public `/health` answering
- [ ] `bash deploy/verify.sh` passing with zero failures
- [ ] Backup cron installed **and one restore actually rehearsed**, while the
      data is still invented

## Mobile release

- [ ] `eas init` run; `projectId` no longer empty in `app.json`
- [ ] `ascAppId` and `appleTeamId` filled into `eas.json`
- [ ] Bundle ID `com.lyne.mobile` confirmed everywhere — it is permanent
- [ ] `EXPO_PUBLIC_SENTRY_DSN` set as an EAS secret
- [ ] iOS production build made and installed from TestFlight
- [ ] **The on-device bug sweep done** — the one item in
      [REMAINING_WORK](../REMAINING_WORK.md) §C that has always needed your
      phone: haptics, real push notifications, Face ID, camera, safe areas on a
      notched device
- [ ] Android production build made and uploaded to the internal track
- [ ] Both SHA-1 fingerprints recorded — upload key **and** Play's app-signing
      key
- [ ] **Push credentials wired.** iOS APNs is created by EAS during the build;
      **Android FCM V1 is not** — a Firebase project, `google-services.json`, and
      the FCM V1 service account uploaded via `eas credentials`. Without it every
      Android notification silently goes nowhere.
      [build-and-submit.md](build-and-submit.md#push-notifications--the-step-that-is-easy-to-miss)
- [ ] A push notification received on a real device of each platform
- [x] **Supabase decided — production shares the demo project for the pilot.**
      Demo test accounts therefore live in the same auth directory as real
      users. Accepted knowingly while there is one pilot agency; revisit before
      the second tenant, because migrating real users to a new project later is
      the painful version of this decision.

## Store listings

- [ ] App Store Connect app record created
- [ ] App Store listing filled from [app-store-listing.md](app-store-listing.md)
      (and `JAMAica` fixed to `JAMAICA` when pasting the description)
- [ ] App Privacy answers match `ios.privacyManifests` and the privacy policy
- [ ] Play listing filled from [play-store-listing.md](play-store-listing.md)
- [ ] Play **Data safety** answers match the same three sources
- [ ] The "not affiliated with any government agency" disclaimer is in the Play
      description **and** in the app's About screen
- [ ] Content rating questionnaire completed; target audience set to 13+ or 18+,
      **never under 13**
- [ ] Five screenshots per store, plus Play's 1024 × 500 feature graphic
- [ ] Reviewer credentials and step-by-step notes entered in both consoles

## Legal and policy — live URLs, reachable without signing in

- [ ] `https://uselyne.com/privacy`
- [ ] `https://uselyne.com/terms`
- [ ] `https://uselyne.com/delete-account` — Play requires a web deletion route
      that works without the app installed
- [ ] The in-app policy (`apps/mobile/src/lib/legalContent.ts`) says the same
      thing as the website. A reviewer does compare them.

## Not blocking version 1, but start the clock

- [ ] **Code-signing certificate** for the Windows admin app. There is no USB
      token to post — the CAs meet the hardware-key rule with a cloud HSM, so
      nothing ships to Jamaica. SSL.com eSigner or DigiCert KeyLocker; Azure
      Trusted Signing is unavailable to a Jamaican company. The slow part is
      organisation validation, not delivery, so start it early. The build works
      unsigned in the meantime — `npm run build:win:unsigned` — which is fine
      for a pilot unless the site enforces SmartScreen or WDAC.
      See [desktop-signing.md](desktop-signing.md).
- [ ] **SMS provider** sender registration — approval lead time, not price, is
      what delays it. [../LAUNCH_PROCUREMENT.md](../LAUNCH_PROCUREMENT.md#11-sms-provider---unblocks-text-customers-when-called)
- [ ] **Sentry account** and DSN — free tier, and the code already no-ops
      without it
- [ ] **One kiosk device**, to prove the print path before ordering per branch
- [ ] Google and Apple sign-in — they ship together or not at all (Guideline 4.8)

---

## After the first submission

Review times move, so treat these as shape rather than promise: App Store review
is typically a day or two, Play's first review of a new app can be several days
and is slower for a brand-new listing than for an update. Both can come back
with questions rather than a rejection — answer in the console, do not resubmit
a new build unless they ask for one.
