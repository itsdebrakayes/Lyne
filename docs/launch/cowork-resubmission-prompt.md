# The Cowork resubmission prompt (Lyne 1.0, second submission)

Copy everything inside the fence into Cowork as one message. It is written for
an agent with a browser, a shell on Debra's Mac, and SSH to the droplet: the
same setup as `cowork-deploy-prompt.md`, which deployed production the first
time.

It covers everything for the resubmission that happens outside the code:
- pushing the code,
- production server changes,
- the Apple, Google and Supabase consoles,
- the iOS signing step EAS could not do unattended,
- submitting both builds to their testing tracks.

**Have these to hand before you send it:**

| Thing | Where |
|---|---|
| Your Apple ID password and phone (two-factor codes) | You |
| The reviewer account password | You type it into App Store Connect and Play Console yourself |
| Droplet IP and `doadmin` password | DigitalOcean, as before |

---

```
You are getting Lyne 1.0 ready for its second App Store and Google Play
submission. The code is finished and tested; what is left is outside the code.
Lyne 1.0 is FREE: it sells nothing, has no in-app purchases and no
subscriptions. Do not create any purchase products, agreements or keys.
The repository is ~/Developer/Lyne (GitHub: itsdebrakayes/Lyne). Production is
already deployed: read deploy/README.md and docs/launch/cowork-deploy-prompt.md
for how it was set up.

== RULES THAT DO NOT BEND ==

1. NEVER print a secret into the chat, a commit, a log or a screenshot. Keys
   go into ~/Developer/Lyne/secrets/ (gitignored) and into /srv/lyne/.env on
   the droplet, nowhere else. If you need a value from me, ask for it by name.
2. NEVER commit .env, secrets/, certs/ or any .p8 / .json key.
3. Do not touch the `demo` branch or demo-api.uselyne.com.
4. Do not change application code. If something seems to need a code change,
   STOP and tell me what and why.
5. Production data: take a backup before anything that writes to the
   production database, and ask me before each such step.
6. If a step fails, STOP and report what you saw. Do not retry blindly.
7. Never type my passwords for me. When a page needs my Apple ID, Google
   account or the reviewer password, stop and let me type it.

== STEP 1 — PUSH THE CODE ==

  cd ~/Developer/Lyne
  git fetch origin
  git merge-base --is-ancestor origin/main ux-and-security-hardening && echo FF-OK
  git push origin ux-and-security-hardening
  git push origin ux-and-security-hardening:main      # fast-forward only

If FF-OK does not print, STOP: main has moved and needs a real merge.

== STEP 2 — SUPABASE (browser: supabase.com → the production project) ==

a. Authentication → Email Templates → "Confirm signup":
   - Subject: Your Lyne code
   - Body: paste the full contents of supabase/templates/confirm-signup.html
     (it shows the 6-digit {{ .Token }} and the link).
b. Authentication → URL Configuration → Redirect URLs: add
   https://uselyne.com/auth/confirmed   (keep the existing entries).
c. Authentication → Providers → Email: "Confirm email" ON. Under the email
   OTP settings, length 6 and expiry 3600 seconds.
d. Clean up old sign-up data. Earlier app versions put the TRN into
   user_metadata. In the SQL editor, run this count first and show me the
   number:
     select count(*) from auth.users where raw_user_meta_data ? 'trn';
   Then ask me. Only on my yes, run:
     update auth.users set raw_user_meta_data = raw_user_meta_data - 'trn'
      where raw_user_meta_data ? 'trn';

== STEP 3 — APPLE (browser: developer.apple.com) ==

a. APNs key for Live Activities: do NOT create a new key. Reuse the existing
   "Expo Push Notifications Key", Key ID 6H44RYBAX3 (APNs, sandbox and
   production), Team ID UD8HYB75P4. Its .p8 is already in
   ~/Developer/Lyne/secrets/apns-6H44RYBAX3.p8. Just confirm in Certificates,
   IDs & Profiles → Keys that 6H44RYBAX3 still exists with APNs enabled.
   Key 549M7577B2 is the Sign in with Apple key and has NO push service; do
   not use it for APNs.
b. Identifiers: confirm both com.lyne.mobile and com.lyne.mobile.liveactivity
   exist (EAS registered the second one).

== STEP 4 — APP STORE CONNECT: PRIVACY AND REVIEW INFO ==

a. App Privacy: location is now used on the device only and never leaves it.
   Remove "Location" (Coarse/Precise) from the data the app collects. Make
   sure nothing under "Purchases" is declared. Show me the summary before
   saving and change nothing else without asking me.
b. App Review Information → Notes: paste the fenced block under "Paste into
   App Store Connect" in docs/app-review-notes.md, exactly (it is under
   3,900 characters). Sign-in required: yes. Username appreview@uselyne.com.
   Let ME type the password.
c. If an "In-App Purchases" section or any subscription was created for this
   app earlier, tell me what is there; do not attach any to the build.

== STEP 5 — GOOGLE (browser: Google Cloud console and Play Console) ==

a. Service account for Play submission. In the Google Cloud project linked to
   Play Console (Play Console → Setup → API access shows which one):
   - create a service account "lyne-play",
   - create a JSON key and save it as
     ~/Developer/Lyne/secrets/play-service-account.json (eas.json submits
     Android with that exact path),
   - in Play Console → Users and permissions, invite its email with access to
     Lyne and the permission "Release to testing tracks".
b. App content → Data safety: remove "Location" from collected data (it is
   used on the device only), and make sure no financial or purchase data is
   declared. Show me the summary before saving.
c. App content → App access: paste the fenced block under "Play Console →
   App access" in docs/app-review-notes.md. Let ME type the reviewer password.

== STEP 6 — PRODUCTION SERVER (shell: ssh lyne@<droplet-ip>) ==

a. cd /srv/lyne && git pull   (now at the main you pushed in step 1)
b. Back up the database (deploy/README.md shows how), then apply, in order,
   using the doadmin login exactly as deploy/README.md "Deploying a change
   later" shows:
     database/migrations/036_live_activity_tokens.sql
   Do NOT apply 037_iap_subscriptions.sql: payments are off in 1.0.
c. Add to /srv/lyne/.env (deploy/env.production.example documents them):
     APNS_KEY_ID=6H44RYBAX3
     APNS_TEAM_ID=UD8HYB75P4
     APNS_PRIVATE_KEY   the contents of secrets/apns-6H44RYBAX3.p8 on ONE
                        line, each newline written as \n, inside single quotes
     APNS_ENV=production
   Do NOT add any APPSTORE_* or GOOGLE_PLAY_SERVICE_ACCOUNT billing variable;
   the server does not need them. Copy the .p8 to the droplet over scp only and
   delete any temporary copy afterwards. Never print it.
d. bash deploy/deploy.sh, then bash deploy/verify.sh.
   Then run the READ-ONLY readiness check and show me its table:
     mysql ... lyne < database/checks/review_readiness.sql
   Every row must read OK before submitting, except the two informational
   ones (037 absent is expected; is_premium accounts are harmless).
e. Reviewer data. Ask me first, take another backup, then run, in order:
     database/review_tenant_seed.sql
     database/review_tenant_history.sql
   Report the counts the second one leaves:
     select count(*) from wait_time_records w
       join queue_tickets t on t.id = w.ticket_id
      where t.id like 't-rvh-%';
   Expect about 13,800. Then run database/checks/review_readiness.sql again;
   the Blue Harbour rows must now read OK. The reviewer rows need the
   reviewer account to have signed in once on a real device.

== STEP 7 — WEBSITE (GoDaddy) ==

uselyne.com is GoDaddy Node.js hosting built from this repository (the root
package.json's build runs godaddy-build.mjs). In the GoDaddy panel, redeploy
or reinstall the app so it picks up main. Then open
https://uselyne.com/auth/confirmed: it must say "We could not confirm this
link". That is correct with no token in the address.

== STEP 8 — BUILDS (shell, interactive for iOS) ==

The automatic build stopped because the new Live Activity extension
(com.lyne.mobile.liveactivity) needs its own provisioning profile, which EAS
can only create interactively.

  cd ~/Developer/Lyne/apps/mobile
  npx eas-cli@latest build --platform ios --profile production

Answer yes to letting EAS manage credentials. When it asks for my Apple ID,
STOP and let me sign in (two-factor). Let it create the provisioning profile
for the extension and reuse the existing distribution certificate. Report the
build URL.

Then build Android from the same code:
  npx eas-cli@latest build --platform android --profile production

Do NOT submit the earlier Android build (versionCode 6,
https://expo.dev/accounts/itsdebrakaye/projects/lyne/builds/c1c814c7-3994-4a42-a5e8-7b2b8cd0d404):
it predates the free release and still contains the paywall and the billing
library. Only submit builds made after step 1's push.

== STEP 9 — SUBMIT TO TESTING TRACKS (not to review) ==

When both new builds have finished, submit each by its build ID (not
--latest, so the old Android build cannot be picked up by mistake):
  npx eas-cli@latest submit --platform ios --profile production --id <ios-build-id>
  npx eas-cli@latest submit --platform android --profile production --id <android-build-id>
iOS goes to TestFlight. Android goes to the internal track as a DRAFT
(eas.json). Do NOT press "Submit for review" in either console. I will test
both on real phones first, and we still have screen recordings to make.

== WHEN YOU ARE DONE ==

Give me a checklist of every step: done / waiting on me / failed, with what
you saw. List anything you could not finish and exactly what it needs.
```
