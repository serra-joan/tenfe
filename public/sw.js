// Service worker mínim — sense funcionament offline (per ara)
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', () => self.clients.claim())
