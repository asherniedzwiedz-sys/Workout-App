// Apple Watch companion app, generated into the Xcode project by @bacons/apple-targets
// during `npx expo prebuild`. Not used by Expo Go.
/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = () => ({
  type: 'watch',
  name: 'IronLogWatch',
  displayName: 'IronLog',
  icon: '../../assets/icon.png',
  colors: { $accent: '#4C8DFF' },
  deploymentTarget: '10.0',
  frameworks: ['SwiftUI', 'WatchKit', 'WatchConnectivity'],
  // Watch app bundle ids must extend the iPhone app's bundle id.
  bundleIdentifier: '.watchkitapp',
});
