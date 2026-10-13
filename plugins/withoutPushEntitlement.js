// IronLog only schedules local notifications, which need no entitlement. expo-notifications
// always adds `aps-environment` (remote push), and a free Apple ID can't sign that, so a
// local Xcode build would fail. This removes it again.
//
// Must be listed FIRST in app.json "plugins": Expo applies entitlement mods in reverse
// registration order, so only the first plugin runs after expo-notifications.
const { withEntitlementsPlist } = require('expo/config-plugins');

module.exports = function withoutPushEntitlement(config) {
  return withEntitlementsPlist(config, (cfg) => {
    delete cfg.modResults['aps-environment'];
    return cfg;
  });
};
