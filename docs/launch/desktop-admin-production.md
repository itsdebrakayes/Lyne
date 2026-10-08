# The packaged desktop admin, against production

What had to change to make `Lyne Admin.exe` / `Lyne Admin.dmg` work on a
machine that has nothing on it but the installer — and the one line that still
has to change on the server.

---

## The two faults

**1. It pointed at the machine it was built on.**

`apps/admin-desktop/.env` carries `VITE_API_URL=http://localhost:4000/api`,
which is correct for `npm run dev`. Vite compiles that value into the bundle,
so a production build made with that file present shipped an installer whose
every screen tried to reach `localhost:4000` on the user's own PC. The build
succeeded, the app launched, and nothing worked.

**2. It had no origin a server could trust.**

The packaged window was loaded with `win.loadFile()`, i.e. over `file://`. A
`file://` page has an opaque origin, and Chromium sends it as the literal
string `null`. Measured against the live API:

| Origin sent | Preflight | Request |
|---|---|---|
| `null` (what the packaged app sent) | **403** | **403** |
| `app://lyne-admin` (before the allowlist change) | **403** | **403** |
| `https://admin.uselyne.com` (the web admin) | 204 | 200 |

So the allowlist is working exactly as designed. `null` cannot simply be added
to it: every `file://` page on the machine shares that same origin, so allowing
it would let any downloaded HTML file in the Downloads folder call the API with
the operator's session attached.

---

## The fix

The renderer is now served over a custom scheme registered as `standard` and
`secure`, so the packaged app has a real origin of its own:

```
app://lyne-admin
```

Measured, not assumed — a page on that scheme reports `window.isSecureContext
=== true`, `location.origin === 'app://lyne-admin'`, and a server receiving its
`fetch` sees `Origin: app://lyne-admin` on both the preflight and the request.

`secure: true` matters beyond CORS: Supabase's auth client needs a secure
context for WebCrypto and for a session to persist in `localStorage`.

**What was deliberately not done**, since each of these removes the check
rather than satisfying it:

- allowing the `null` origin
- `webSecurity: false`
- rewriting the `Origin` header on the way out
- widening `ALLOWED_ORIGINS` to `*`

---

## The one server-side change

Add the desktop origin to `ALLOWED_ORIGINS` in `/srv/lyne/.env`:

```
ALLOWED_ORIGINS=https://admin.uselyne.com,https://uselyne.com,https://www.uselyne.com,app://lyne-admin
```

Keep the existing entries; append the new one. Then restart the API so it
re-reads the variable — the allowlist is parsed once at startup.

Checked, so it does not stop the deploy: `app://lyne-admin` contains no `*`,
no `localhost` and no `127.0.0.1`, so it passes the guards in `deploy.sh:88`
and `verify.sh:129` unchanged.

**Nothing else is needed.** Specifically:

- **No migration.** No schema is involved.
- **No Supabase change.** The admin app signs in with
  `supabase.auth.signInWithPassword` and uses no OAuth or magic-link flow, so
  there is no redirect URL to allowlist.
- **No other code reads the Origin header.** There is no CSRF check and no
  cookie with a `SameSite` constraint keyed to it; the session is a bearer
  token in the `Authorization` header.

Until that line is added, the packaged app will sign in (Supabase is a
different origin policy) and then fail on every API call with a 403. That is
the expected symptom, not a regression.

---

## Building the installers

```bash
cd apps/admin-desktop
npm run package:all      # macOS dmg + zip, and the Windows installer
npm run package:win      # Windows only
npm run package:mac      # macOS only
```

Each one runs `scripts/assert-production-bundle.mjs` between the Vite build and
electron-builder, and **packaging stops if it fails**. The check:

- finds every scheme-prefixed local URL in the bundle and fails on any that is
  not a known dependency constant (react-router and supabase-js both carry
  one, so a bare `grep localhost` could never pass);
- asserts the production API URL is actually *present*, because an empty
  `VITE_API_URL` leaves no localhost behind either and would sail past a
  negative-only check while shipping an app that requests paths against its own
  origin;
- asserts a Supabase project URL is present, or nobody can sign in;
- fails on an absolute asset path in `index.html`, which would not resolve over
  `app://`.

### Signing

Both platforms build **unsigned**, deliberately and loudly:

- macOS: `CSC_IDENTITY_AUTO_DISCOVERY=false` and `-c.mac.identity=null`.
  Gatekeeper will need right-click → Open on first launch.
- Windows: `WINDOWS_SIGNING=off`, which the signer hook reports per artifact.
  SmartScreen will show "Windows protected your PC" on first run.

See `desktop-signing.md` for what signing costs and why the certificate has to
live in a cloud HSM.

### Windows architecture

`build.win.target` names `x64` and `arm64` explicitly. It has to: electron-builder
defaults to the **host** architecture, so building on an Apple Silicon Mac
silently produced an arm64-only installer that will not run on an ordinary
Windows PC. The NSIS target packs both into one `.exe`.
