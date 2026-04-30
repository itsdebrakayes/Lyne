# Q ME NOW — Admin Desktop App

A role-based admin desktop application built with **Electron + React + Vite + TypeScript**.
Packages into a Windows `.exe` installer via `electron-builder`.

---

## Roles & Dashboards

| Role | Dashboard | Access |
|---|---|---|
| `line_staff` | Staff Dashboard | Own queue only — call, complete, skip, no-show |
| `manager` | Manager Dashboard | All queues in branch, staff assignments, branch analytics |
| `executive` | Executive Dashboard | Cross-branch analytics, service trends, predictive insights |

---

## Prerequisites

- Node.js 18+
- pnpm (or npm/yarn)
- Running Q ME NOW backend API (`apps/backend`)
- Supabase project (Auth only)

---

## Development

```bash
cd apps/admin-desktop
cp .env.example .env
# Fill in VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_API_URL

pnpm install
pnpm dev
```

This starts both the Vite dev server (port 5174) and Electron simultaneously.

---

## Build Windows .exe

```powershell
# On Windows (or via GitHub Actions)
cd apps/admin-desktop
pnpm install
pnpm build:win
```

The installer will be output to `apps/admin-desktop/release/`.

### PowerShell one-liner (from repo root)

```powershell
Set-Location apps\admin-desktop
npm install
npm run build:win
Start-Process "release\Q ME NOW Admin Setup 1.0.0.exe"
```

---

## Architecture

```
apps/admin-desktop/
├── electron/
│   ├── main.js        # Electron main process
│   └── preload.js     # Context bridge (IPC)
├── src/
│   ├── App.tsx        # Role-based routing
│   ├── main.tsx       # React entry point
│   ├── hooks/
│   │   └── useAdminAuth.ts   # Supabase Auth + MySQL role check
│   ├── lib/
│   │   └── apiClient.ts      # JWT-authenticated fetch wrapper
│   └── pages/
│       ├── Login.tsx
│       ├── StaffDashboard.tsx
│       ├── ManagerDashboard.tsx
│       └── ExecutiveDashboard.tsx
├── package.json       # Electron-builder config
└── vite.config.ts
```

---

## Authentication Flow

1. Staff enters email + password → Supabase Auth issues JWT
2. `useAdminAuth` calls `GET /api/auth/me` with the JWT
3. Backend verifies the JWT, looks up the staff record in MySQL
4. Role is returned and used to route to the correct dashboard
5. All subsequent API calls carry the JWT in `Authorization: Bearer <token>`
