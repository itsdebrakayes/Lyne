const appJson = require('./app.json');

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
