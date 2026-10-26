/** Native SwiftUI watchOS app (Phase 8/9), generated into the Xcode project by @bacons/apple-targets on prebuild. */
/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: 'watch',
  name: 'LiftlogWatch',
  displayName: 'Liftlog',
  icon: '../../assets/icon.png',
  deploymentTarget: '10.0',
  bundleIdentifier: '.watchkitapp',
  frameworks: ['WatchConnectivity', 'HealthKit', 'CoreMotion', 'CoreML'],
  // HKWorkoutSession keeps Core Motion running with the screen off.
  entitlements: { 'com.apple.developer.healthkit': true },
  colors: { $accent: '#3D8BFF' },
};
