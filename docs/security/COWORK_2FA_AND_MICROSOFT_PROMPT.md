# Prompt for Cowork: finish two-factor sign-in and "Sign in with Microsoft"

Paste everything below the line into Cowork.

---

You are helping me (the owner of Lyne, a queue-management product run by DKS
Technologies) finish switching on two sign-in features. The code is already
written and tested. What is left is account set-up in Microsoft and Supabase
dashboards, done in my browser. Work through the parts in order and stop for me
at every point marked **ASK ME**.

Ground rules:
- Never type, copy into chat, or save to any file a password, client secret,
  API key or one-time code. When a secret has to move from one page to another,
  **ASK ME** to copy and paste it myself.
- Do not create, delete or change any user account in Supabase, and do not touch
  these logins at all: anything starting `demo.` (Apple is reviewing the app
  with them), and the Wrenfield Health and Lignum demo logins (live demos on
  16 and 18 November).
- Do not change any Supabase setting that is not named below. If a page looks
  different from what I describe, take a screenshot and **ASK ME** instead of
  guessing.
- Do not connect to the Lyne server or database. Claude Code does the deploy.
- At the end, give me a short report: each step, done or not, and anything odd.

## Part 1: confirm authenticator-app codes are on in Supabase (5 minutes)

Lyne's two-factor uses authenticator apps only (Microsoft Authenticator, Google
Authenticator, 1Password), never text messages or email codes.

1. Open the Supabase dashboard and the **Lyne** project. **ASK ME** which project
   if there is more than one.
2. Go to **Authentication → Multi-Factor** (it may be under *Configuration*).
3. Check that **Authenticator app (TOTP)** is enabled for enrolling and verifying.
   If it is off, **ASK ME** before turning it on.
4. Leave **Phone / SMS** multi-factor OFF. Do not change it.
5. Screenshot the page for my records.

## Part 2: register Lyne with Microsoft (15 minutes)

1. Open the **Microsoft Entra admin centre** (entra.microsoft.com) and sign in.
   **ASK ME** to sign in myself if a sign-in page appears.
2. **App registrations → New registration.**
   - Name: `Lyne`
   - Supported account types: **Accounts in any organizational directory
     (Any Microsoft Entra ID tenant - Multitenant)**. Not the option that adds
     personal Microsoft accounts.
   - Redirect URI: platform **Web**, value
     `https://<the Lyne Supabase project>.supabase.co/auth/v1/callback`. Take the
     exact address from Supabase → Authentication → Sign In / Providers → Azure,
     where it is shown as the *Callback URL*.
   - Register.
3. On the new app's **Overview**, note the **Application (client) ID**. It is not
   a secret, so you can write it in your report.
4. **Certificates & secrets → New client secret.** Description `Supabase`,
   expiry 24 months. **ASK ME** to copy the secret *Value* myself (it is shown once).
5. **Token configuration → Add optional claim →** token type **ID** → tick
   `xms_edov` → Add. If it asks to add the Microsoft Graph email permission,
   accept.
6. **API permissions:** check that Microsoft Graph `User.Read` is there. Also add
   `email`, `openid` and `profile` if they are missing. Do not grant admin
   consent for any other permission.
7. Put a calendar reminder for me, 23 months from today: "Renew the Lyne
   Microsoft client secret". **ASK ME** before creating the event.

## Part 3: connect Microsoft to Supabase (5 minutes)

1. Supabase → **Authentication → Sign In / Providers → Azure**: enable it.
   - Client ID: the Application (client) ID from Part 2.
   - Secret: **ASK ME** to paste it myself.
   - Azure Tenant URL: `https://login.microsoftonline.com/organizations`
   - Save.
2. On the same Sign In / Providers page, turn on **Allow manual linking**.
   That is what lets a staff member connect their Microsoft account to their
   own Lyne login.
3. **Authentication → URL Configuration → Redirect URLs**: add these three,
   keeping every address already there:
   - `https://admin.uselyne.com/**`
   - `app://lyne-admin/**`
   - `http://localhost:5174/**`
4. Screenshot each page after saving.

## Part 4: hand back to Claude Code

Tell me, in one message I can paste to Claude Code:
- Parts 1–3 are done (or which steps are not, and why).
- The Application (client) ID (not the secret).

Claude Code will then, with my approval:
- back up the production database;
- apply migration 053, which adds the two-factor switches, all OFF by default;
- deploy;
- show the "Sign in with Microsoft" button on admin.uselyne.com.

## Part 5: the real test, after the deploy and after the 18 November demo

Use a test staff login that I name. **ASK ME** which one. Never a `demo.`,
Wrenfield or Lignum login. I do the typing of passwords and codes myself.
Guide me through these and record pass or fail for each:

1. **Branch switch:** as the test branch's manager, Settings → *Two-Factor For
   Your Branch* → Require Two-Factor. The sign-in card should show the QR code
   straight away. Scan it with Microsoft Authenticator, enter the code, press
   *Finish Set-Up*. The dashboard should open.
2. **Sign out and back in:** password, then the six-digit code from the app.
   Check that nothing from the dashboard appears before the code is accepted.
3. **Scope:** a manager at a different branch, and a login from a different
   organisation, should NOT be asked for a code.
4. **Reset:** an executive of the same organisation opens Settings →
   *Two-Factor For Your Organisation* and presses Reset on the test manager. The
   test manager should be asked to set up again at their next sign-in.
5. **Switch off:** the manager presses Stop Requiring. Next sign-in should be
   password only.
6. **Microsoft:** while signed in as the test login, Settings → *Microsoft
   Account* → Connect Microsoft, using a work Microsoft account. Sign out. On the
   sign-in card press *Sign in with Microsoft*: it should open the dashboard.
   Then try a Microsoft account that was never connected: it must be refused
   with a message about connecting it first.
7. Check Settings → **Activity Log** shows each switch, reset and change.

Report the results as a table: step, pass or fail, notes, screenshots.
