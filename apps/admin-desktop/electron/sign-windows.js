/**
 * Windows signing, for a certificate that lives in a cloud HSM.
 *
 * Since the 2023 CA/Browser Forum rules every publicly-trusted code signing
 * key — OV as well as EV — has to sit on certified hardware. The CAs satisfy
 * that with a cloud HSM rather than a USB token, so nothing is manufactured
 * and nothing is posted: the key stays in the CA's HSM and the build calls out
 * to sign. That matters here because a token cannot be couriered to Kingston
 * on a useful timetable.
 *
 * Two providers are wired up, because they are the two that will sell to a
 * company outside the US and Canada:
 *
 *   SSL.com eSigner   CodeSignTool, driven by username / password / TOTP.
 *   DigiCert KeyLocker  smctl, driven by an API key and a client certificate.
 *
 * (Azure Trusted Signing is cheaper than both and is deliberately NOT here:
 * new subscriptions are limited to organisations in the US and Canada with
 * three years of history, so DKS cannot use it.)
 *
 * ── The three states, and why the middle one throws ──────────────────────
 *
 *   configured      sign, and fail the build if signing fails.
 *   nothing set     build UNSIGNED and say so loudly. This is the pilot path.
 *   half set        throw.
 *
 * The half-configured case is the dangerous one. A typo in a secret name is
 * indistinguishable, at the end of a build, from having meant to ship
 * unsigned — you get an installer either way. Shipping something you believe
 * is signed and is not is worse than either honest outcome, so it stops the
 * build instead.
 */
const { execFileSync } = require('node:child_process');

/** Provider definitions: the vars each one needs, and how to invoke it. */
const PROVIDERS = [
  {
    name: 'SSL.com eSigner',
    // Any of these present means "you intended to use this provider".
    marker: ['SSL_COM_USERNAME', 'SSL_COM_CREDENTIAL_ID', 'SSL_COM_TOTP_SECRET'],
    required: ['SSL_COM_USERNAME', 'SSL_COM_PASSWORD', 'SSL_COM_CREDENTIAL_ID', 'SSL_COM_TOTP_SECRET', 'CODESIGNTOOL_PATH'],
    run(file, env) {
      execFileSync(env.CODESIGNTOOL_PATH, [
        'sign',
        `-username=${env.SSL_COM_USERNAME}`,
        `-password=${env.SSL_COM_PASSWORD}`,
        `-credential_id=${env.SSL_COM_CREDENTIAL_ID}`,
        `-totp_secret=${env.SSL_COM_TOTP_SECRET}`,
        `-input_file_path=${file}`,
        '-override=true',
      ], { stdio: 'inherit' });
    },
  },
  {
    name: 'DigiCert KeyLocker',
    marker: ['SM_API_KEY', 'SM_KEYPAIR_ALIAS'],
    required: ['SM_API_KEY', 'SM_CLIENT_CERT_FILE', 'SM_CLIENT_CERT_PASSWORD', 'SM_KEYPAIR_ALIAS', 'SMCTL_PATH'],
    run(file, env) {
      execFileSync(env.SMCTL_PATH, [
        'sign',
        '--keypair-alias', env.SM_KEYPAIR_ALIAS,
        '--input', file,
      ], { stdio: 'inherit' });
    },
  },
];

const missing = (p, env) => p.required.filter((k) => !env[k] || !String(env[k]).trim());
const intended = (p, env) => p.marker.some((k) => env[k] && String(env[k]).trim());

exports.default = async function signWindows(configuration) {
  const env = process.env;
  const file = configuration.path;

  /* An explicit decision to ship unsigned — see docs/launch/desktop-signing.md.
     Kept separate from "nothing configured" so the build log records that
     somebody chose this rather than forgot. */
  if (String(env.WINDOWS_SIGNING || '').toLowerCase() === 'off') {
    console.log(`\n  ⚠  UNSIGNED BUILD (WINDOWS_SIGNING=off) — ${file}`);
    console.log('     Windows will show "Windows protected your PC" on first run.');
    console.log('     Deliberate. See docs/launch/desktop-signing.md.\n');
    return;
  }

  const chosen = PROVIDERS.find((p) => intended(p, env));

  if (!chosen) {
    console.log(`\n  ⚠  UNSIGNED BUILD — no signing credentials in the environment.`);
    console.log(`     ${file}`);
    console.log('     Windows will show "Windows protected your PC" on first run, and');
    console.log('     locked-down machines may refuse it outright. Fine for a pilot,');
    console.log('     not for general release. See docs/launch/desktop-signing.md.\n');
    return;
  }

  const gaps = missing(chosen, env);
  if (gaps.length) {
    throw new Error(
      `${chosen.name} is partly configured — missing ${gaps.join(', ')}. `
      + 'Refusing to continue: a half-configured signer produces an unsigned '
      + 'installer that looks exactly like a signed one at the end of a build. '
      + 'Set the missing variables, or set WINDOWS_SIGNING=off to ship unsigned on purpose.'
    );
  }

  console.log(`\n  ✎  Signing with ${chosen.name} — ${file}`);
  chosen.run(file, env);
  console.log('  ✓  Signed\n');
};
