# Cowork prompt: production deploy of 13 October 2026

Copy everything inside the fence into Cowork as one message.

```
You are deploying the latest Lyne code to production: the API on the
DigitalOcean droplet and the website on GoDaddy. No app build and no store
submission is involved. The repository is ~/Developer/Lyne (GitHub:
itsdebrakayes/Lyne). Read README.md and CLAUDE.md in the repository first;
they are the rules for this system. Production runs the `production` branch.

What is being deployed (already merged into production):
- API: the App Review simulator (off unless REVIEW_SIMULATOR=true), the Line
  Helper "Release my place" fix, the wait-estimate fix, account-deletion fixes.
- Website: organisation pricing from the pricing matrix, the app shown as free,
  a new /get-the-app page linking to Google Play, "Buy a license" opening the
  quote estimator.

== RULES THAT DO NOT BEND ==
1. NEVER print a secret into the chat, a log, a commit or a screenshot.
2. Never commit .env, secrets/ or any key file. Do not commit anything at all.
3. Do not touch the demo branch or demo-api.uselyne.com.
4. Do not change application code. If something seems to need a code change,
   STOP and tell me what and why.
5. Before anything that writes to the production database, take a backup with
   deploy/backup-managed-db.sh and ask me. Migrations are never automatic.
6. If a step fails, STOP and report what you saw. Do not retry blindly.
7. Never type my passwords. When something needs one, stop and let me type it.

== STEP 1 — CODE ON THE SERVER ==
ssh lyne@<droplet-ip>
  cd /srv/lyne && git fetch origin && git status
  git checkout production && git pull --ff-only
  git log --oneline -1
The last line must be "96dd554 Merge branch 'staging' into production" or a
later commit. If not, STOP. Then confirm none of these exist on the server:
  ls database/demo_*.sql database/seed.sql docker-compose.demo.yml README.demo.md
(every one should say "No such file"). If any exists, STOP.

== STEP 2 — MIGRATIONS (skip any already applied; both are safe to re-run) ==
Back up with deploy/backup-managed-db.sh and tell me the backup file name.
Ask me, and on my yes apply in order, as doadmin, the way README.md
"Deploying a change to production" shows:
  database/migrations/035_enum_values_the_code_writes.sql
  database/migrations/036_live_activity_tokens.sql
Do NOT apply 037_iap_subscriptions.sql.

== STEP 3 — REVIEWER DATA (skip if already done) ==
Check first (read-only):
  select count(*) from businesses where id = 'biz-review-demo-0001';
  select count(*) from branches where business_id = 'biz-review-demo-0001'
     and is_active = 1;
If they are 1 and 4, skip this step. Otherwise ask me, take another backup,
then run in order:
  database/review_tenant_seed.sql
  database/review_tenant_history.sql
and report the two counts again.

== STEP 4 — SETTINGS ==
Edit /srv/lyne/.env without printing it. Make sure each of these appears once:
  REVIEW_SIMULATOR=true
  REVIEW_BUSINESS_ID=biz-review-demo-0001
  REVIEW_ACCOUNT_EMAIL=appreview@uselyne.com
Confirm by NAME only that APNS_KEY_ID, APNS_TEAM_ID, APNS_PRIVATE_KEY and
APNS_ENV are present. Confirm STAFF_TEST_VERIFICATION_CODE is NOT present.
Confirm deploy/docker-compose.prod.yml passes the three REVIEW_* variables
to the api service (grep REVIEW_ deploy/docker-compose.prod.yml). If any check
fails, STOP and tell me which.

== STEP 5 — DEPLOY THE API AND VERIFY ==
  bash deploy/deploy.sh && bash deploy/verify.sh
Then show me:
  docker logs <api-container> 2>&1 | grep -E "ReviewSimulator|LineHelper" | tail -5
It must include "[ReviewSimulator] ACTIVE for biz-review-demo-0001 /
appreview@uselyne.com". Then run the read-only readiness check and show me
its table:
  mysql ... lyne < database/checks/review_readiness.sql
Every row must read OK, except "037 NOT applied" (expected) and informational
rows. Then, a minute after the deploy:
  curl -s "https://api.uselyne.com/api/queues?branch_id=brn-review-demo-0001"
Each line should show a waiting_count of 4 or more. Report the numbers.

== STEP 6 — WEBSITE (GoDaddy) ==
uselyne.com is GoDaddy Node.js hosting built from this repository's
production branch (the root package.json build runs godaddy-build.mjs). In the
GoDaddy panel, redeploy or reinstall the app so it pulls production. Do not
add VITE_IOS_APP_URL yet: the App Store link stays "Coming soon" until the iOS
app is approved. Then check in the browser:
  a. https://uselyne.com/#pricing shows two cards: "Free" (Download the app
     for free) and "Business" (From US$1,095/mo, Buy a license). No Premium.
  b. "Buy a license" opens https://uselyne.com/join-us#estimate. With 3
     locations it shows Lyne Operations, US$2,795/month, US$29,950/year,
     implementation US$8,500.
  c. "Talk to us" opens the quote form on /join-us, not an email app.
  d. https://uselyne.com/get-the-app shows Google Play as a working link to
     https://play.google.com/store/apps/details?id=com.lyne.mobile and the App
     Store as "Coming soon".
  e. https://uselyne.com/auth/confirmed still says "We could not confirm this
     link" (correct with no token).
Take screenshots of a to d for me.

== WHEN YOU ARE DONE ==
Give me a checklist of every step: done / skipped (already done) / waiting on
me / failed, with what you saw. After Apple and Google approve the apps, I
will ask you to set REVIEW_SIMULATOR=false and redeploy.
```
