# Sign-in hardening plan: two-factor and single sign-on

**Date:** 12 November 2026. **Status:** step 1 (two-factor) is BUILT on `staging` (migration 053), not yet on production. Step 2 (single sign-on) is an idea for later: the owner asked to leave it alone for now.

Staff sign in with an email and password through Supabase Auth. The server
checks every request's token, the role and the organisation, and (since 12
November) the admin app signs out a screen left unattended for 30 minutes. What
is missing is a second proof of who is signing in. A bank or ministry security
review asks for one, and usually asks the further question: "can our staff use
our own sign-in?"

## What a reviewer will ask, and the answer each option gives

| Question | Today | After step 1 | After step 2 |
|---|---|---|---|
| Is a stolen password enough to get in? | Yes | No, for executives, managers and supervisors | No, for everyone signing in through the organisation |
| Who removes a leaver's access? | The organisation's manager, in Lyne | The same | The organisation's own IT, in their directory |
| Does our password and lockout policy apply? | No (Lyne's: 8 characters minimum) | No | Yes |
| Can we see who signed in? | Activity log in Lyne | The same | Their directory's log, and Lyne's |

## Step 1: two-factor with an authenticator app (built 12 November 2026)

Built as described below. It is off by default and nobody switches it on for
themselves. An executive requires it for the whole organisation or for single
branches; a manager for their own branch only. A switch never reaches another
branch or another organisation (tested). Everyone covered sets up their
authenticator app on the sign-in screen at their next sign-in. Before
switching it on for a real organisation, test it end to end with one real
account: set it up, sign out, sign in with the code, have an executive reset it.

**What:** a six-digit code from an authenticator app (Microsoft Authenticator,
Google Authenticator, 1Password) after the password. Supabase Auth includes
this (TOTP) at no extra charge.

**Who:** organisation switch (executive): its executives, managers and
supervisors. Branch switch (that branch's manager, or an executive): that
branch's managers and supervisors. Not desk staff. Never kiosks (a shared screen with nobody's phone beside it) or for
members of the public using the app.

**How:**
1. Admin app: an enrolment screen (show the QR code, confirm one code), and a
   code prompt after the password for an enrolled account.
2. Server: `requireAuth` reads the token's assurance level. For the three
   roles, a token that is not `aal2` is refused with a message the app turns
   into "set up two-factor". This is the part that makes it real: hiding the
   dashboards in the app without the server check would be decoration.
3. Recovery: an executive can clear a manager's or supervisor's second factor
   (audit-logged), who then enrols again. An executive who loses their phone is
   reset by another executive, or by DKS Technologies after an identity check
   agreed in the contract. No SMS fallback: SIM swaps defeat it.
4. Roll-out switch per organisation (`businesses.require_2fa`, a migration), so
   a pilot can start without it and turn it on once everyone has enrolled, and
   so the demo logins are not locked out during App Review.

**Effort:** about two days, plus a test pass with real accounts.
**Risk:** people locked out on day one. The per-organisation switch and a
two-week "enrol by" banner handle that.

## In between: "Sign in with Microsoft" (built 12 November 2026, off until set up)

A button on the sign-in card, like "Sign in with Apple". Works for a Microsoft
work account once its owner has connected it to their Lyne login while signed
in. Setup and design: `MICROSOFT_SIGN_IN_SETUP.md`.

## Step 2: single sign-on with the organisation's own directory (idea, not scheduled)

**What:** staff type their work email, are sent to their organisation's own
sign-in (Microsoft Entra ID, Okta, Google Workspace), and come back signed in.
Their IT department's password rules, two-factor and leaver process apply
automatically. For a bank this usually ends the two-factor conversation: they
enforce their own.

**How:** Supabase Auth supports SAML 2.0 single sign-on on its paid plans
(confirm the plan and the per-user charge before quoting it).
1. Per organisation: register their identity provider with Supabase and record
   their verified email domain against the organisation in Lyne.
2. Sign-in screen: "Continue with your organisation" for an email on a
   registered domain.
3. Linking: Lyne links a sign-in to a staff record only by Supabase user id,
   deliberately (no claiming an account by email). For single sign-on, add ONE
   narrow rule: a first sign-in through an organisation's registered provider
   links to that organisation's pre-created staff record with the same email,
   and to nothing else. Staff are still created in Lyne by a manager; the
   directory proves who they are, Lyne decides what they may do.
4. Desktop app: the sign-in opens in the system browser and returns through
   the `lyne-admin://` link.

**Effort:** about a week for the first organisation, then a few hours of setup
for each one after. **Sell it as** part of the Executive and Government /
Enterprise plans, set up during implementation.

## Smaller things that help now

- **Password rules for staff:** raise the minimum from 8 to 12 characters and
  turn on Supabase's leaked-password check. A setting, not a build.
- **Sign-in alerts:** email an executive when their account signs in from a new
  device. Uses the session records already kept.
- **Restrict by network (optional, per branch):** desk and kiosk accounts only
  work from the branch's own internet address. Useful for banks; needs their
  addresses to be fixed.

## What not to say before these are built

"Single sign-on" stays off the website, the deck and the security sheet.
"Two-factor sign-in" may be claimed once it is on production and has passed
the real-account test above. What is true today: role-based access checked on
the server, organisation-level separation tested on every route, automatic
sign-out of unattended screens, session limits and revocation, and a readable
audit trail.
