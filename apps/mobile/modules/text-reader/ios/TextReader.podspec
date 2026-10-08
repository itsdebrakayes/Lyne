Pod::Spec.new do |s|
  s.name           = 'TextReader'
  s.version        = '1.0.0'
  s.summary        = 'On-device text recognition for images and PDFs'
  s.author         = 'Lyne'
  s.homepage       = 'https://uselyne.com'
  s.license        = 'UNLICENSED'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true
  s.swift_version  = '5.9'
  s.dependency 'ExpoModulesCore'
  s.frameworks     = 'Vision', 'PDFKit'
  s.source_files   = '**/*.swift'
end
