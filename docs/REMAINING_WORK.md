# Remaining work

The single list of what is still open. Rewritten on 13 October 2026 after the
version 1 launch, replacing the July list (that version is in git history at
tag `archive/pre-cleanup-2026-10-13`). When something ships, delete its line
here and add a short entry to [COMPLETED_WORK.md](COMPLETED_WORK.md).

## Shipped (for context)

API, web admin, managed database with verified nightly and off-site backups and
a rehearsed restore, Supabase auth with Resend SMTP, Android app live on Google
Play, iOS 1.0 in App Store review, website live, Sentry uptime monitoring.

## Operations — small

| Item | Notes |
|---|---|
| Turn the App Review simulator off after Apple approves | `REVIEW_SIMULATOR=false` in `/srv/lyne/.env`, then `bash deploy/deploy.sh` |
| Confirm `SENTRY_DSN` is set for the API and model worker | Mobile is reporting; server-side reporting needs the DSN in `.env` |
| Android submit track | `apps/mobile/eas.json` submits to `internal`; switch to `production` or keep promoting by hand |
| Re-run `database/review_tenant_history.sql` every few weeks | Keeps the review organisation's 90-day history current |
| Mark `docs/launch/checklist.md` | Its boxes were never ticked; most items are done |

## Product — customers will notice

| Item | Notes |
|---|---|
| A server error during session refresh signs the user out silently | Should keep the session and show "Can't reach Lyne right now" |
| "Leave now" reminder is never recalculated | Scheduled once at join; should move with the line |
| Google and Apple sign-in | Ship together (Guideline 4.8). Providers in Supabase first; see `docs/PROVIDER_SETUP.md` |

## Quality

| Item | Notes |
|---|---|
| End-to-end test of join → call → serve → notify through the real routes | Unit and wiring tests exist |
| Alert when the model worker stops refreshing | Insight cards go stale silently today |
| Business-persona walkthrough | Written, never run end to end |
| Accessibility and translation review | Not assessed |

## Before onboarding the first organisation

| Item | Notes |
|---|---|
| Platform-admin console | Organisations are created through the API today |
| First-run setup wizard for the desktop admin | |
| Onboarding tutorials (mobile and desktop) | |
| Windows code-signing certificate | Organisation validation is slow; start early (`docs/launch/desktop-signing.md`) |
| SMS sender registration | Approval lead time (`docs/LAUNCH_PROCUREMENT.md`) |
| One kiosk device to prove the print path | `docs/KIOSK_HARDWARE.md` |
| Mobile views for managers and executives | Needs design references |
| Chart legend toggles, multi-select on lists, report cover page | Waiting on reference images |

## Before a paid contract

| Item | Notes |
|---|---|
| Payments provider for Jamaica | WiPay, Amber Pay eLink or PayPal card entry; then apply migration 037 and switch `PAYMENTS_ENABLED` on |
| Data retention / erasure policy and encryption-at-rest confirmation | A government CIO will ask |
| Model hardening | Persisted model artifacts, drift monitoring, a longer forecast horizon |
