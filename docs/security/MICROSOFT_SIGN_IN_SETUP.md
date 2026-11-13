# Turning on "Sign in with Microsoft"

**Date:** 12 November 2026. The code is built (`apps/admin-desktop/src/lib/microsoftSignIn.ts`,
the sandboxed sign-in window in `electron/main.js`). It stays hidden until the
steps below are done, because they need DKS Technologies' own Microsoft and
Supabase accounts. About 30 minutes.

## How it works

- The sign-in card shows **Sign in with Microsoft** under the password form, like
  "Sign in with Apple" or "Sign in with Google" elsewhere.
- A Microsoft account opens a Lyne login only after it has been **connected**: the
  person signs in once with their Lyne email and password, then Settings →
  Microsoft Account → Connect Microsoft. Lyne never matches a Microsoft sign-in to
  a staff record by email, because an email in a sign-in is a claim, not proof.
- A Microsoft account that was never connected is refused with a message saying
  how to connect it.
- Two-factor in Lyne still applies after Microsoft for anyone who set it up.
- On the desktop app Microsoft's page opens in its own window with no access to
  the app and nothing remembered afterwards (good on shared branch computers).

This is not per-organisation single sign-on (an organisation's IT department
registering its own directory with Lyne). That is still the parked step 2 in
`SIGN_IN_HARDENING_PLAN.md`; "Sign in with Microsoft" covers most of what a bank
asks for in the meantime: their staff use their work Microsoft account, with
their organisation's password rules and two-step sign-in.

## Steps (owner)

1. **Microsoft Entra admin centre → App registrations → New registration.**
   - Name: `Lyne`.
   - Supported account types: *Accounts in any organizational directory*
     (work and school accounts only, not personal Outlook accounts).
   - Redirect URI (Web): `https://<your-supabase-project>.supabase.co/auth/v1/callback`.
   - Then *Certificates & secrets → New client secret*; copy the value once.
   - *Token configuration → Add optional claim → ID → `xms_edov`* (lets Supabase
     tell whether Microsoft verified the email).
2. **Supabase → Authentication → Sign In / Providers → Azure:** enable; paste
   the Application (client) ID and the secret; Azure Tenant URL
   `https://login.microsoftonline.com/organizations`.
3. **Supabase → Authentication → Sign In / Providers:** turn on *Allow manual
   linking* (this is what "Connect Microsoft" uses).
4. **Supabase → Authentication → URL Configuration → Redirect URLs:** add
   `https://admin.uselyne.com/**`, `app://lyne-admin/**` and, for development,
   `http://localhost:5174/**`.
5. **Switch the button on:** add `VITE_MICROSOFT_SIGNIN=true` to
   `apps/admin-desktop/.env` on the server (for admin.uselyne.com) and to the
   environment the desktop installer is built in, then deploy / rebuild.
6. **Test with one real account:** sign in with the password, connect Microsoft
   in Settings, sign out, sign in with Microsoft. Then try a Microsoft account
   that was never connected: it must be refused.

The client secret expires (Microsoft's maximum is two years): put the date in
the calendar.
