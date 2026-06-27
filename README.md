# Q ME NOW

Intelligent queue management and predictive analytics for multi-branch organizations.

Q ME NOW has five production surfaces:

- `apps/website` — public marketing website for product information, quote/contact requests, and app-store links only.
- `apps/mobile` — Expo mobile app for customers on phones and tablets.
- `apps/admin-desktop` — Electron admin dashboards for line staff, managers, and executives.
- `apps/backend` — Express API with MySQL application data and Supabase Auth verification.
- `apps/model` — Python/Jupyter analytics worker that exports live data, runs predictions, and imports insights back into the API.

## Production Data Rule

`main` is production-oriented and should start empty for a new company deployment. Demo businesses, demo accounts, and synthetic queue history belong on the `demo` branch only.

Each contracted company should run on its own deployment/database. The backend also enforces `business_id`, branch, queue, and ticket access checks as an additional isolation layer.

## Architecture

```text
Public Website (marketing only)

Mobile / Admin Desktop
        |
        | Supabase Auth JWT
        v
Express API
        |
        | tenant-scoped reads/writes
        v
MySQL operational data
        |
        | scheduled export
        v
Jupyter/Python model worker
        |
        | secured import
        v
MySQL predictive_results and dashboard APIs
```

Supabase is used for authentication. Queue, staff, analytics, notifications, and business data live in MySQL.

## Quick Start

1. Configure environment variables:

```bash
cp .env.example .env
```

Fill in MySQL credentials, Supabase URL, Supabase publishable key, allowed frontend/admin origins, and pipeline worker credentials.

2. Start the production stack locally:

```bash
docker compose up -d
```

This starts MySQL, the backend API, and the analytics worker. The API health check is:

```text
http://localhost:4000/health
```

3. Start the website:

```bash
cd apps/website
cp .env.example .env
npm install
npm run dev
```

4. Start the admin desktop app:

```bash
cd apps/admin-desktop
cp .env.example .env
npm install
npm run dev
```

5. Start the mobile app:

```bash
cd apps/mobile
npm install
npx expo start
```

## Admin Roles

| Role | Scope |
|---|---|
| `line_staff` | Assigned queue/counter/service operations only |
| `manager` | Own branch operations, assignments, and branch analytics |
| `executive` | Own business across branches, analytics, and manual pipeline triggers |
| `platform_admin` | Q ME NOW internal onboarding/support only |

## Analytics Pipeline

Production analytics are bidirectional:

```text
MySQL operational data -> CSV export -> notebook/model run -> JSON/CSV outputs -> secured backend import -> dashboard APIs
```

Live queue counts and active ticket status come directly from operational tables. Heavier predictions and insights refresh through the worker, with freshness metadata shown in dashboards.

## Security Baseline

- No production demo seed data on `main`.
- No checked-in local `.env` files.
- Protected API routes require Supabase JWTs.
- Staff/admin routes enforce role and tenant access in the backend.
- Public prediction APIs expose only public-safe insight types.
- Sensitive ticket verification data is not exposed in queue list or public stream responses.
- Audit logging includes tenant context.
- CORS is allowlisted for browser origins while still allowing native mobile requests without browser `Origin`.

## Launch Notes

Before selling or installing for a real customer, configure:

- Real Supabase Auth project and first staff/admin accounts.
- Production MySQL credentials and backups.
- Per-company deployment/database.
- Production allowed origins and HTTPS.
- Expo/EAS push notification credentials.
- Apple/Windows code signing for desktop packages.
- Live smoke tests with real devices and a real deployed API.
