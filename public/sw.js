// Canviar la versió força que el SW s'actualitzi i buida la caché antiga
const CACHE_NAME = 'tenfe-v1'

// Recursos estàtics que es descarreguen i es guarden a la caché en el moment d'instal·lació
const STATIC_ASSETS = [
  '/',
  '/css/leaflet/leaflet.css',
  '/css/leaflet/markercluster.css',
  '/js/leaflet/leaflet.js',
  '/js/leaflet/markercluster.js',
  '/js/main.js',
  '/images/logos/tenfe_192.png',
]

// INSTALL ─────────────────────────────────────────────────────────────────────
// Es dispara la primera vegada que el navegador registra el SW (o quan el fitxer canvia).
// waitUntil() manté el SW en estat "installing" fins que la promesa es resol,
// evitant que s'activi abans que tots els recursos estàtics estiguin a la caché.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  )
  // skipWaiting() fa que el SW nou prengui el control immediatament,
  // sense esperar que es tanquin les pestanyes que usen el SW antic.
  self.skipWaiting()
})

// ACTIVATE ────────────────────────────────────────────────────────────────────
// Es dispara quan el SW pren el control de la pàgina.
// Aquí netegem les caches de versions anteriors (p. ex. 'tenfe-v0')
// perquè no ocupin espai indefinidament.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  )
  // clients.claim() fa que el SW prengui el control de les pestanyes ja obertes
  // sense necessitat de recarregar-les.
  self.clients.claim()
})

// FETCH ───────────────────────────────────────────────────────────────────────
// Intercepta TOTES les peticions de xarxa que fa la pàgina.
// Aquí decidim si servim de la caché o de la xarxa, i quan guardem a la caché.
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Ignorar peticions que no siguin GET (POST, etc.) i peticions cross-origin
  // (p. ex. tiles d'OpenStreetMap, que gestiona Leaflet pel seu compte)
  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  // Estratègia API: Network-first amb fallback a caché
  // ─ Intentem la xarxa per obtenir les dades més recents.
  // ─ Si funciona, guardem una còpia a la caché (sobrescriu l'anterior).
  // ─ Si no hi ha xarxa, retornem l'últim estat conegut de la caché.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
          return response
        })
        .catch(() => caches.match(request))
    )
    return
  }

  // Estratègia recursos estàtics: Cache-first amb fallback a xarxa
  // ─ Si el recurs ja és a la caché (posat allà durant l'install), el servim directament.
  // ─ Si no hi és (p. ex. un recurs nou), fem la petició i la guardem per a la propera vegada.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request).then((response) => {
        const copy = response.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
        return response
      })
    })
  )
})
