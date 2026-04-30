importScripts(
  'https://storage.googleapis.com/workbox-cdn/releases/7.3.0/workbox-sw.js'
)

const { registerRoute } = workbox.routing
const { CacheFirst, StaleWhileRevalidate, NetworkFirst } =
  workbox.strategies
const { ExpirationPlugin } = workbox.expiration
const { CacheableResponsePlugin } = workbox.cacheableResponse

// ── Static assets (CSS, JS, fonts, images) ──────────────────
registerRoute(
  ({ request }) =>
    ['style', 'script', 'font', 'image'].includes(request.destination),
  new CacheFirst({
    cacheName: 'static-assets',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 200,
        maxAgeSeconds: 30 * 24 * 60 * 60,
      }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
)

// ── Fan library API (GET only) ──────────────────────────────
registerRoute(
  ({ url, request }) =>
    request.method === 'GET' && url.pathname.startsWith('/api/library'),
  new StaleWhileRevalidate({
    cacheName: 'api-library',
    plugins: [
      new ExpirationPlugin({ maxAgeSeconds: 7 * 24 * 60 * 60 }),
    ],
  })
)

// ── Artist profiles (navigation to /slug) ───────────────────
registerRoute(
  ({ request, url }) =>
    request.mode === 'navigate' &&
    !url.pathname.startsWith('/auth') &&
    /^\/[a-z0-9][a-z0-9-]*$/.test(url.pathname),
  new StaleWhileRevalidate({
    cacheName: 'artist-profiles',
    plugins: [
      new ExpirationPlugin({ maxAgeSeconds: 7 * 24 * 60 * 60 }),
    ],
  })
)

// ── General API calls (GET only — POST/DELETE must never be cached) ──
registerRoute(
  ({ url, request }) =>
    request.method === 'GET' &&
    url.pathname.startsWith('/api/') &&
    !url.pathname.startsWith('/api/library') &&
    !url.pathname.startsWith('/api/auth'),
  new NetworkFirst({
    cacheName: 'api-general',
    networkTimeoutSeconds: 3,
    plugins: [
      new ExpirationPlugin({ maxAgeSeconds: 24 * 60 * 60 }),
    ],
  })
)

// ── Purchased audio blobs (Supabase Storage) ────────────────
registerRoute(
  ({ url }) =>
    url.hostname.includes('supabase.co') &&
    url.pathname.includes('/storage/') &&
    url.pathname.includes('/masters/'),
  async ({ request }) => {
    const cache = await caches.open('audio-cache')

    // Stable cache key: strip query params (signed URL signature changes)
    const stableUrl = new URL(request.url)
    stableUrl.search = ''
    const cacheKey = new Request(stableUrl.href)

    const cached = await cache.match(cacheKey)
    if (cached) return cached

    const response = await fetch(request)
    if (response.ok) {
      await cache.put(cacheKey, response.clone())
    }
    return response
  }
)

// ── Push notifications ──────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return

  const data = event.data.json()
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: data.url || '/' },
      tag: data.tag || undefined,
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        const existing = clients.find(
          (c) => new URL(c.url).pathname === url
        )
        if (existing) return existing.focus()
        return self.clients.openWindow(url)
      })
  )
})

// ── Launch queue (PWA cold-start deep links) ───────────────
if ('launchQueue' in self) {
  self.launchQueue.setConsumer((launchParams) => {
    if (launchParams.targetURL) {
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        if (clients.length > 0) {
          clients[0].navigate(launchParams.targetURL)
          clients[0].focus()
        } else {
          self.clients.openWindow(launchParams.targetURL)
        }
      })
    }
  })
}

// ── Lifecycle ───────────────────────────────────────────────
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})
