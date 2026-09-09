# Signing the desktop admin app

Two ways to build it, and the honest consequences of each.

---

## The short version

| | Signed | Unsigned |
|---|---|---|
| Command | `npm run build:win` | `npm run build:win:unsigned` |
| What a pilot user sees | Nothing. It installs. | "Windows protected your PC" — they click **More info → Run anyway** |
| Locked-down machines | Fine | **May refuse it outright** — see below |
| Needs | A cloud certificate | Nothing |

Unsigned is a legitimate choice for a pilot. It is not a legitimate choice for
general release, and there is one failure mode below that is worse than a
warning.

---

## Why there is no USB token

Since the 2023 CA/Browser Forum rules, every publicly-trusted code signing key
— OV as well as EV — must live on certified hardware. The CAs meet that with a
**cloud HSM** rather than a posted token: the key is generated inside the CA's
HSM and the build calls out to sign. Nothing is manufactured and nothing is
shipped, which is the only workable arrangement when the company is in Jamaica.

**Providers wired up** (`electron/sign-windows.js`):

- **SSL.com eSigner** — CodeSignTool, driven by username / password / TOTP.
- **DigiCert KeyLocker** — `smctl`, driven by an API key and a client certificate.

**Deliberately not wired up:** Azure Trusted Signing. It is cheaper than both,
but new subscriptions are limited to organisations in the US and Canada with
three years of verifiable history. DKS cannot use it.

### EV or OV

EV carries SmartScreen reputation from the first install. OV has to earn that
reputation over downloads, so early installs still show the warning — which is
the thing you are paying to avoid when a government IT officer is watching.
For handing an installer to a handful of agency IT people, EV is worth it.

Certificates now expire after **460 days** (from 1 March 2026), so this is a
roughly annual renewal.

---

## Signed builds

Set the variables for whichever provider you bought, then build normally.

**SSL.com eSigner**

```
SSL_COM_USERNAME       SSL_COM_PASSWORD       SSL_COM_CREDENTIAL_ID
SSL_COM_TOTP_SECRET    CODESIGNTOOL_PATH
```

**DigiCert KeyLocker**

```
SM_API_KEY   SM_CLIENT_CERT_FILE   SM_CLIENT_CERT_PASSWORD
SM_KEYPAIR_ALIAS   SMCTL_PATH
```

Keep them out of the repository — `.gitignore` already excludes `secrets/`.

### The build stops if signing is half-configured

If some of a provider's variables are set and others are not, the build
**fails** rather than producing an installer.

This is on purpose. A typo in a secret name is indistinguishable, at the end of
a build, from having meant to ship unsigned: you get an installer either way.
Shipping something you believe is signed and is not is worse than either honest
outcome.

---

## Unsigned builds, for a pilot

```bash
npm run build:win:unsigned
```

The build log says `UNSIGNED BUILD` in the output, so it is never a surprise.

### What the pilot user actually does

1. They run the installer.
2. Windows shows a blue box: **"Windows protected your PC"**.
3. They click **More info**, then **Run anyway**.
4. It installs and behaves normally from then on.

Tell them this in advance, in the same message as the download link. A warning
somebody was expecting reads as a known quantity; the same warning unannounced
reads as "this software is not safe", and you will not get a second attempt at
that impression with an IT department.

### The part that is not just a warning

On a managed corporate machine the warning may not be a warning at all:

- **SmartScreen can be policy-set to block with no override.** There is no
  "Run anyway" — the file simply will not run.
- **AppLocker or WDAC** can be configured to refuse any binary without a
  trusted publisher signature. Same outcome.

Neither is common in a small pilot, and both are usual in a bank or a ministry
with a mature IT function. If a pilot site is either of those, ask their IT
contact *before* sending the installer, because the answer decides whether the
pilot can start unsigned at all.

---

## macOS

The Mac build is a separate problem with the same shape.

`electron-builder` currently skips Mac signing because this machine reports
**zero valid signing identities** — four certificates are installed and none of
them validate (`CSSMERR_TP_NOT_TRUSTED` on all four, including Developer ID).
Usually a missing or expired Apple intermediate in the keychain.

Check with:

```bash
security find-identity -v -p codesigning
```

Until that reports at least one valid identity, the DMG is unsigned and
un-notarized, and Gatekeeper will refuse it on first open — the user has to
right-click the app and choose **Open** to get the override dialog.

This does **not** affect the iOS App Store build: EAS signs in the cloud with
credentials it manages, and never touches this keychain.
