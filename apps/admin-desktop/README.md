# LYNE — Admin Desktop App

A role-based admin desktop application built with **Electron + React + Vite + TypeScript**.
Packages for **macOS, Windows and Linux** via `electron-builder`.

Staff do not choose their hardware — an agency may issue a MacBook — so the app
targets all three desktop platforms rather than assuming Windows.

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
- Running LYNE backend API (`apps/backend`)
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

## Building

Each platform must be built **on** that platform (or in CI on a matching runner):
`electron-builder` cannot produce a signed, notarized macOS app from Windows, and
Windows installers need Windows tooling.

```bash
cd apps/admin-desktop
npm install

npm run build:mac      # .dmg + .zip, arm64 (Apple Silicon) and x64 (Intel)
npm run build:win      # NSIS .exe installer
npm run build:linux    # AppImage + .deb
npm run build:all      # all three, only works where all three toolchains exist
```

Output lands in `apps/admin-desktop/release/` (gitignored).

### macOS notes

- Builds **universal**: separate arm64 and x64 artifacts, so both Apple Silicon
  and Intel Macs are covered. Minimum macOS 12.0.
- The window uses `titleBarStyle: 'hiddenInset'` on macOS. `hidden` — which
  Windows uses — leaves the traffic-light buttons floating over the app's own
  chrome, because nothing in the UI reserves space for them.
- The Hardened Runtime is enabled with `build/entitlements.mac.plist`.
  Notarization **requires** the Hardened Runtime, and the Hardened Runtime blocks
  the JIT that Electron's V8 needs — so the three entitlements in that file are
  what stop a correctly signed app from refusing to launch.
- To build unsigned for local testing:
  `CSC_IDENTITY_AUTO_DISCOVERY=false npm run build:mac`
- For distribution you need a **Developer ID Application** certificate and
  notarization. See [../../docs/PROVIDER_SETUP.md](../../docs/PROVIDER_SETUP.md).

### Known gap: no application icon

`src/assets/icon.ico` is **16×16**, which is too small for any platform's
installer — macOS wants up to 1024×1024 (`.icns`), Windows wants 256×256, Linux
wants a `.png` set. The macOS build currently falls back to the default Electron
icon, and the Windows installer is using a 16px source.

This needs real brand artwork before release. Once a high-resolution master
exists, `electron-builder` can generate every size from a single 1024×1024 PNG
placed at `build/icon.png`.

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
