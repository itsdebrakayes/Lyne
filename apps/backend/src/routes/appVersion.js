/**
 * appVersion.js — which app version is current, and which is the oldest still supported.
 *
 * GET /api/app/version   public, no sign-in
 *
 * The app asks on launch. Older than latest: a bottom notice offers the update and
 * can be dismissed. Older than minimum: the notice stays, because that version no
 * longer works with the server. Set in .env per store, so a release needs no
 * code change:
 *   APP_IOS_LATEST, APP_IOS_MINIMUM, APP_IOS_URL
 *   APP_ANDROID_LATEST, APP_ANDROID_MINIMUM, APP_ANDROID_URL
 * and optionally APP_IOS_NOTES / APP_ANDROID_NOTES: one line on what the new
 * version brings, shown on the update card ("Faster sign-in and a new Account page").
 * A store with no URL yet (iOS before approval) gets no notice at all.
 */
const router = require('express').Router();

const store = (prefix) => {
  const url = (process.env[`${prefix}_URL`] || '').trim();
  if (!url) return null;
  return {
    latest: (process.env[`${prefix}_LATEST`] || '').trim() || null,
    minimum: (process.env[`${prefix}_MINIMUM`] || '').trim() || null,
    url,
    notes: (process.env[`${prefix}_NOTES`] || '').trim().slice(0, 200) || null,
  };
};

router.get('/version', (_req, res) => {
  /* Never cached: a phone holding an old answer would miss a required update. */
  res.set('Cache-Control', 'no-store');
  res.json({ ios: store('APP_IOS'), android: store('APP_ANDROID') });
});

module.exports = router;
