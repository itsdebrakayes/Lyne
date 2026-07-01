const appJson = require('./app.json');

module.exports = () => ({
  ...appJson.expo,
  extra: {
    ...appJson.expo.extra,
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || appJson.expo.extra.supabaseUrl,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || appJson.expo.extra.supabaseAnonKey,
    apiUrl: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000/api',
  },
});
