/**
 * The Live Activity widget: Lyne's ticket on the lock screen and in the
 * Dynamic Island. Built into the iOS project at prebuild by
 * @bacons/apple-targets; the SwiftUI lives beside this file.
 * Design: design-specs/queue-notifications.html, in the current navy palette.
 *
 * @type {import('@bacons/apple-targets/app.plugin').ConfigFunction}
 */
module.exports = () => ({
  type: 'widget',
  name: 'LyneLiveActivity',
  bundleIdentifier: '.liveactivity',
  deploymentTarget: '16.2',
  frameworks: ['SwiftUI', 'WidgetKit', 'ActivityKit'],
});
