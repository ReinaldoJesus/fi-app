/* Clarifi service worker: offline pages + Web Push. Plain JS, served from /sw.js. */
const VERSION = "v1"
const PAGES = `clarifi-pages-${VERSION}`
const ASSETS = `clarifi-assets-${VERSION}`
const OFFLINE_URL = "/offline"
const PRECACHE = [OFFLINE_URL, "/icon-192.png", "/manifest.json"]

self.addEventListener("install", event => {
  event.waitUntil(caches.open(ASSETS).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()))
})

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith("clarifi-") && k !== PAGES && k !== ASSETS).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

const isStaticAsset = url =>
  url.pathname.startsWith("/_next/static/") || /\.(png|svg|ico|woff2?)$/.test(url.pathname) || url.pathname === "/manifest.json"

self.addEventListener("fetch", event => {
  const req = event.request
  if (req.method !== "GET") return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  // API data and auth are always live; never served from cache.
  if (url.pathname.startsWith("/api/")) return

  if (isStaticAsset(url)) {
    // Hashed build files never change: cache-first.
    event.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        if (res.ok) caches.open(ASSETS).then(c => c.put(req, res.clone()))
        return res
      })),
    )
    return
  }

  if (req.mode === "navigate") {
    // Pages: always try the network; keep the latest copy of app screens for offline use.
    event.respondWith(
      fetch(req)
        .then(res => {
          if (res.ok && !res.redirected && url.pathname.startsWith("/dashboard")) {
            const copy = res.clone()
            caches.open(PAGES).then(c => c.put(url.pathname + url.search, copy))
          }
          return res
        })
        .catch(async () => {
          const pages = await caches.open(PAGES)
          return (await pages.match(url.pathname + url.search))
            || (await pages.match(url.pathname))
            || (await caches.match(OFFLINE_URL))
            || Response.error()
        }),
    )
  }
})

self.addEventListener("message", event => {
  // Sent on the login screen: a signed-out device must not keep financial pages.
  if (event.data?.type === "clear-pages") event.waitUntil(caches.delete(PAGES))
})

// ── Web Push ────────────────────────────────────────────────────────────────
self.addEventListener("push", event => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = { body: event.data?.text() } }
  event.waitUntil(
    self.registration.showNotification(data.title || "Clarifi", {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.tag,
      data: { url: data.url || "/dashboard" },
    }),
  )
})

self.addEventListener("notificationclick", event => {
  event.notification.close()
  const target = new URL(event.notification.data?.url || "/dashboard", self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
      const open = list.find(c => c.url.startsWith(self.location.origin))
      if (open) return open.focus().then(c => c.navigate(target))
      return self.clients.openWindow(target)
    }),
  )
})
