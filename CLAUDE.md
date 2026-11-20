# Instructions for AI coding agents working on Lyne

Read `README.md` first: it is the handbook for the whole system. The rules below
are the ones that must hold on **every** commit, push, merge and deploy.

## Branches

| Branch | Purpose |
|---|---|
| `production` | What runs at api.uselyne.com / admin.uselyne.com. GitHub default branch. No demo data or demo tooling. |
| `staging` | Where all work is done and tested. |
| `demo` | `staging` plus the sales sandbox seeds. Runs demo-api.uselyne.com. |

There is no `main` and no `ux-and-security-hardening` any more; they were renamed
to `production` and `staging` on 13 October 2026. Old branches are kept only as
`archive/<name>` tags.

## Rules for every commit

1. **Commit to `staging`.** Never commit directly to `production` or `demo`.
   If you are on another branch, switch to `staging` (or branch from it) first.
2. **Promote by merging `staging`**, never by cherry-picking or committing on the
   target: `git checkout production && git pull --ff-only && git merge --no-edit staging && git push`,
   then the same for `demo` when the sandbox should get the change. Return to `staging` afterwards.
3. **Only promote what has been tested** on `staging` (tests pass; mobile changes checked on a device).
4. **Demo-only files never enter `production`:** `database/demo_*.sql`, `database/seed.sql`,
   `docker-compose.demo.yml`, `scripts/demo-*.sh`, `README.demo.md`,
   `apps/backend/scripts/sync-demo-test-accounts.js`, `apps/backend/scripts/seed-demo-healthcare.js`, `apps/backend/scripts/demo-switch.js`, `apps/backend/scripts/seed-demo-bank-history.js`. They live on `staging` and `demo`.
   If a merge into `production` brings one in (for example as a modify/delete
   conflict), delete it in the merge commit.
   `database/showcase/*.sql` is different: production-safe example organisations
   (fictional, labelled, no logins or people), loaded on the owner's say-so. So is
   `apps/backend/scripts/seed-showcase-history.js`: Lignum's invented visits,
   login-less staff and login-less invented clients (`.example` addresses), also on the owner's say-so.
5. **Never commit secrets:** `.env*` (except `.env.example`), `secrets/`, `*.p8`, `*.p12`,
   keystores, `backups/`. Never print a secret in a commit message, log or chat.
6. **Never create real-agency data in anything public.** The demo agencies (TAJ, PICA,
   NHT) stay on the demo branch and demo server only.
7. Keep `README.md` true: if a change alters how something works, runs or deploys,
   update the README in the same commit.
8. If `production` ever gets an emergency fix first, merge it back into `staging` the same day.

## Corrections become checks

When the owner corrects you, or you catch a mistake an agent could repeat, do not
answer with a sentence here. Put the fix as high on this list as it will go:

1. **The code.** Change the design so the mistake cannot be written: one shared
   module instead of copies, one source of truth for a piece of state, a helper
   whose only shape is the right one.
2. **A check that fails.** A lint rule in `tools/checks/eslint.config.mjs` or a
   repo check in `tools/checks/repo-checks.mjs`, with an error message written to
   the next agent saying what to do instead. Then remove the existing copies, or
   list them in `tools/checks/baseline.json` (counts only go down) and say so.
3. **Verification.** A row in `docs/FEATURE_MAP.md`, walked in the running app,
   with a screenshot or recording as the proof.
4. **Only then** a line in this file.

Before every commit run `npm --prefix tools/checks run check` and the tests of each
app you touched. A failing check is fixed at its cause. Never silence it: no
`eslint-disable`, no raising a baseline number, no new entry in `envNotInProduction`
without the owner agreeing.

Comments: write one only for a reason the code cannot show. Never write a comment
that excuses a workaround ("for now", "the real fix would be", "a beat after
mount"). The next agent reads it as permission. Fix it, or tell the owner and
leave a task.

## Rules for production

- The server (`/srv/lyne`) runs the `production` branch only. Deploy with `bash deploy/deploy.sh`,
  then `bash deploy/verify.sh`.
- **Migrations are never automatic.** Take a backup with `deploy/backup-managed-db.sh`
  (not `scripts/backup-database.sh`, which is for local Docker), get the owner's
  approval, then apply as `doadmin`. Migration 037 stays unapplied while payments are off.
- Ask the owner before any write to the production database and before changing
  application behaviour to make a deploy work.
- A new variable the API needs must be added to `deploy/docker-compose.prod.yml`
  (`api.environment`) as well as to `.env`, or the container never sees it.
