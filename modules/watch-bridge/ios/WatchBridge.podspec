Pod::Spec.new do |s|
  s.name           = 'WatchBridge'
  s.version        = '1.0.0'
  s.summary        = 'WatchConnectivity bridge for IronLog'
  s.description    = 'Sends the active workout to the IronLog Apple Watch app and relays actions back to JavaScript.'
  s.author         = ''
  s.homepage       = 'https://github.com/asherniedzwiedz-sys/workout-app'
  s.platforms      = {
    :ios => '15.1'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'WatchConnectivity'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
