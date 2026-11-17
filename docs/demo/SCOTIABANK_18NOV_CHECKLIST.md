# Scotiabank demo, Wed 18 Nov 2026, 10:30 to 11:15 (Jamaica)

Lignum Bank (`biz-lgb-001`) live on production. Demo window: **10:15 to 11:45**.

**Everything that changes the system happens the night before (17 Nov), with final checks then.
Nothing is deployed, restarted or edited on the morning of the demo.** The morning checklist only
looks. The window starts by itself at 10:15.

Admin app for the demo: **Lyne Admin** built on 17 Nov from the exact commit production runs,
pointed at `https://api.uselyne.com`. Everyone signs in with their own login; no passwords are
built into the app.

Presenter logins: `lignum.*@uselyne.com` (passwords in `secrets/staff-logins.txt`).
The demo.* logins stay on Blue Harbour.

## 9:45 checklist (5 minutes, look only)

1. **API is up.** In a browser, open `https://api.uselyne.com/health`. It should answer.
2. **Window is armed.**
   ```bash
   ssh lyne@64.225.48.161 'docker logs lyne_api 2>&1 | grep ReviewSimulator | tail -2'
   ```
   You should see `Demo window for biz-lgb-001: 2026-11-18T15:15:00.000Z to 2026-11-18T16:45:00.000Z`.
   The ACTIVE line should not list `biz-lgb-001`.
3. **Admin sign-in.** Open **Lyne Admin** (the installed one, not "Demo"). Sign in as
   `lignum.officer`, then sign out and sign in as `lignum.executive`. The executive should see
   three branches. The Overview forecast and Branch Comparison should have data up to 16 Nov.
4. **Phone.** On your own phone, open the store Lyne app, find **Lignum Bank → Half Way Tree**,
   and check that it shows as open. Don't join until 10:15.
5. **Screens.** Second display or screen share is ready. Do Not Disturb is on. Mac is charging.

**At 10:15–10:20**, Half Way Tree should fill with made-up walk-ins. Sign in as
`lignum.officer` and sit at Teller 1. Join from your own phone once to see the whole route.

## If the window doesn't start by 10:20

Check step 2 again. If the line is missing, or the window shows wrong times:

**A. Only if you decide production must change (about 3 minutes, you run it).** This breaks
the "no changes in the morning" rule, so use B first unless the audience must join on their phones. Put Lignum back on the review
simulator. Its lines will then move and serve people by themselves, so you won't be the
one calling them:
```bash
ssh lyne@64.225.48.161 'cd /srv/lyne && sed -i "s|^REVIEW_SHOWCASE_IDS=.*|REVIEW_SHOWCASE_IDS=biz-lgb-001|" .env && bash deploy/deploy.sh < /dev/null | tail -3'
```
Afterwards, set it back to empty with the same command (`REVIEW_SHOWCASE_IDS=`).

**B. Local Docker demo (you present alone).** The audience's store apps talk to production,
so they **cannot** join this one. You demo it from your Mac only:
```bash
docker compose -f docker-compose.yml -f docker-compose.demo.yml up -d
```
```bash
bash scripts/demo-switch.sh bank
```
Then open **Lyne Admin Demo** and sign in with the `demo.*` logins (local personas). Show the
customer side in the simulator or on your phone pointed at the local server.

**C. If the API is down:** don't fix it in the room. Switch to B and look at the logs after:
`docker logs --tail 50 lyne_api`.

## After the demo

- The window closes at 11:45 by itself and clears the made-up walk-ins.
- Later, clear `DEMO_SHOWCASE_IDS`, `DEMO_FROM` and `DEMO_UNTIL` in the server `.env`.
  Decide whether Lignum goes back into `REVIEW_SHOWCASE_IDS` before the next App Store review.
