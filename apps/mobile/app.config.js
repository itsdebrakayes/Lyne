const appJson = require('./app.json');

/**
 * app.config.js — app.json, plus the values that differ per build profile.
 *
 * Everything static lives in app.json. This file exists only to let eas.json's
 * per-profile `env` reach `extra`, which is what apiClient.ts reads.
 *
 * Because this config is dynamic, `eas init` CANNOT write to it — it prints the
 * project id and stops with "Cannot automatically write to dynamic config".
 * That id therefore lives in app.json under extra.eas.projectId and arrives
 * here through the spread below. Keep the spread first: dropping it silently
 * unlinks the project, which surfaces later as builds that will not start and
 * push tokens that are never issued.
 */
module.exports = () => ({
  ...appJson.expo,
  extra: {
    ...appJson.expo.extra,
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || appJson.expo.extra.supabaseUrl,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || appJson.expo.extra.supabaseAnonKey,
    apiUrl: process.env.EXPO_PUBLIC_API_URL || appJson.expo.extra.apiUrl || '',
    // Stripe publishable key — safe to expose to the client; used only to
    // tokenize cards directly with Stripe (card data never hits our server).
    stripePublishableKey: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || appJson.expo.extra.stripePublishableKey || '',
  },
});
