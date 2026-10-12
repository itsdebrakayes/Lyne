# Parked: Lyne Premium purchases

Lyne 1.0 ships free. This folder keeps the purchase code so it can come back
in a later release. Nothing here is part of the build:

- `tsconfig.json` excludes `src/_parked/**`;
- nothing in `src/` or `App.tsx` imports these files, so Metro never bundles
  them;
- `expo-iap` is uninstalled and removed from `app.json` plugins, so the binary
  links neither StoreKit nor Google Play Billing.

| File | Was | What it did |
|---|---|---|
| `purchases.ts` | `src/lib/purchases.ts` | StoreKit / Play Billing via `expo-iap`: load products, buy, restore, manage |
| `PremiumScreen.tsx` | `src/screens/main/PremiumScreen.tsx` | Plans, Subscribe, Restore, renewal terms, Terms/Privacy links |
| `PremiumLock.tsx` | `src/components/PremiumLock.tsx` | The frosted panel with "Start 14-day free trial" and "See plans" |
| `PremiumBadge.tsx` | `src/components/PremiumBadge.tsx` | The blue JamAI-style "Premium" pill |
| `PremiumHero.tsx` | `src/components/PremiumHero.tsx` | Logo with gradient "Premium" for the Premium screen |

## Turning payments back on

1. Server: set `PAYMENTS_ENABLED = true` in
   `apps/backend/src/lib/premium.js`. That restores the paid gates and the
   `/api/auth/start-trial`, `/api/iap/*` and `/api/payments/*` routes.
   Apply `database/migrations/037_iap_subscriptions.sql`, and set
   `APPSTORE_*`, `GOOGLE_PLAY_SERVICE_ACCOUNT` and `PLAY_PACKAGE_NAME` (see
   `deploy/env.production.example`).
2. App: set `PAYMENTS_ENABLED = true` in `src/lib/features.ts`.
3. `cd apps/mobile && npx expo install expo-iap` and add `"expo-iap"` back to
   the `plugins` array in `app.json`.
4. Move these files back to their original paths (table above).
5. Re-add, behind `PAYMENTS_ENABLED`:
   - the `Premium` route in `src/navigation/AppNavigator.tsx` (and
     `Premium: undefined` in `RootStackParamList`);
   - the Lyne Premium card in Settings (`ProfileScreen.tsx`);
   - `PremiumLock` over the Busy times grid and the Week planner, and the
     "Line Helper is part of Premium" state in `LineHelperScreen.tsx`;
   - the Premium pill in the Plan your visit header (`InsightsHeader` `right`).
   The commit "feat(mobile): Lyne 1.0 is free" shows exactly what was removed.
6. Restore the Premium wording in `legal/`, `src/lib/legalContent.ts`,
   `src/lib/helpContent.ts`, `docs/app-review-notes.md` and the store
   listings, and the In-App Purchase steps in
   `docs/launch/cowork-resubmission-prompt.md`.
7. App Store Connect and Play Console: the paid apps agreement, banking and
   tax, and the two subscription products
   (`com.lyne.mobile.premium.monthly` / `.yearly`).
