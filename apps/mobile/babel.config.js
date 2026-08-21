/**
 * Reanimated 4 compiles its worklets through a Babel plugin, and without this
 * file Expo's default config runs without it — animations then fail at runtime
 * rather than at build time, which is a slow way to find out. In v4 the plugin
 * moved out of react-native-reanimated into react-native-worklets, so the old
 * 'react-native-reanimated/plugin' path no longer resolves.
 *
 * It must stay LAST in the plugin list.
 */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-worklets/plugin'],
  };
};
