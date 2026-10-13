/// <reference lib="webworker" />
// Service worker: offline app shell (as before) plus phone alerts (push notifications)
import { clientsClaim } from 'workbox-core'
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { NetworkOnly } from 'workbox-strategies'

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: (string | { url: string; revision: string | null })[] }

// ---- App shell: same behaviour as the previous generated worker ----------
// New deploys take over straight away (index.html reloads once on controllerchange)
self.skipWaiting()
clientsClaim()

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// Single-page app: every navigation is served the cached index.html
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html'), { denylist: [/^\/api/] }))

// Supabase is never cached: always live data
registerRoute(({ url }) => url.hostname.endsWith('supabase.co'), new NetworkOnly())

// ---- Phone alerts ----------------------------------------------------------
interface PushPayload {
  id?: string
  title?: string
  body?: string
  url?: string // in-app path (/quotes/…) or an https:// link
}

self.addEventListener('push', (event: PushEvent) => {
  let data: PushPayload = {}
  try {
    data = event.data ? (event.data.json() as PushPayload) : {}
  } catch {
    data = { body: event.data?.text() }
  }
  const title = data.title || 'Magma'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/pwa-192x192.png',
      tag: data.id || undefined, // the same message never shows twice
      data: { url: data.url || '/', id: data.id || null },
    })
  )
})

// The browser replaced this device's subscription: register the new one so alerts keep arriving
self.addEventListener('pushsubscriptionchange', ((event: ExtendableEvent & { oldSubscription?: PushSubscription | null }) => {
  event.waitUntil((async () => {
    const old = event.oldSubscription
    const key = old?.options?.applicationServerKey
    if (!key) return
    await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
    // The app re-saves it for the signed-in user next time it opens (resyncPush)
  })())
}) as EventListener)

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()
  const raw = (event.notification.data && event.notification.data.url) || '/'
  const target = new URL(raw, self.location.origin)
  const external = target.origin !== self.location.origin

  event.waitUntil((async () => {
    if (external) {
      // Instagram, website: open in the browser / Instagram app
      await self.clients.openWindow(target.href)
      return
    }
    // In-app page: if Magma is already open, hand the link to it (no reload, nothing lost)
    const all = await self.clients.matchAll({ type: 'window' })
    const existing = all.find(c => new URL(c.url).origin === self.location.origin) as WindowClient | undefined
    if (existing) {
      existing.postMessage({ type: 'magma-open', url: target.pathname + target.search })
      try { await existing.focus() } catch { /* focus can be refused: the page still navigates */ }
      return
    }
    await self.clients.openWindow(target.href)
  })())
})
