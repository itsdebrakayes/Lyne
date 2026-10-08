Pod::Spec.new do |s|
  s.name           = 'LiveActivity'
  s.version        = '1.0.0'
  s.summary        = "Lyne's ticket Live Activity"
  s.author         = 'Lyne'
  s.homepage       = 'https://uselyne.com'
  s.license        = 'UNLICENSED'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true
  s.swift_version  = '5.9'
  s.dependency 'ExpoModulesCore'
  s.weak_frameworks = 'ActivityKit'
  s.source_files   = '**/*.swift'
end
