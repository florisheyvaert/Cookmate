// Minimal service worker — exists so browsers treat Cookmate as an
// installable PWA. Every request passes through to the network; no caching,
// no offline support (yet). When we add offline mode, this is where it lands.

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', () => {
  // Intentional no-op: the browser handles the request normally.
})
