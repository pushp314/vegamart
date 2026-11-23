const CACHE_NAME = "vegamart-v5";
const PRECACHE_URLS = [
  "/manifest.webmanifest",
  "/favicon.ico",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-192.png",
  "/icons/maskable-512.png",
  "/icons/apple-touch-icon.png",
  "/offline",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  // In dev (localhost) never intercept: Vite serves un-versioned module URLs, so
  // cache-first responses go stale and cause SSR hydration mismatches. Network-only.
  if (self.location.hostname === "localhost") return;

  const url = new URL(request.url);

  // NEVER intercept API endpoints or WebSocket requests — let browser network handle them directly
  if (
    url.pathname.startsWith("/api") ||
    url.pathname.includes("/api/") ||
    url.hostname.startsWith("api.") ||
    url.pathname.startsWith("/ws")
  ) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("/", copy));
          return response;
        })
        .catch(() =>
          caches
            .match(request)
            .then((cached) => cached || caches.match("/offline") || caches.match("/")),
        ),
    );
    return;
  }

  // ── Cache Map Tiles (OpenStreetMap / CartoDB / Satellite) for Offline Navigation Resilience ──
  const isMapTile =
    url.hostname.includes("tile.openstreetmap.de") ||
    url.hostname.includes("tile.openstreetmap.org") ||
    url.hostname.includes("basemaps.cartocdn.com") ||
    url.hostname.includes("arcgisonline.com") ||
    (url.pathname.endsWith(".png") && (url.pathname.includes("/tile/") || url.pathname.includes("/osm/")));

  if (isMapTile) {
    const MAP_CACHE_NAME = "vegamart-map-tiles-v1";
    event.respondWith(
      caches.open(MAP_CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) {
          // Stale-While-Revalidate: serve cached tile immediately, update in background if online
          fetch(request)
            .then((networkRes) => {
              if (networkRes.status === 200) {
                cache.put(request, networkRes.clone());
              }
            })
            .catch(() => {});
          return cached;
        }

        try {
          const networkRes = await fetch(request);
          if (networkRes.status === 200) {
            cache.put(request, networkRes.clone());
          }
          return networkRes;
        } catch {
          // If network failed and tile not in cache, fallback gracefully without broken image
          return new Response("", { status: 200, headers: { "Content-Type": "image/png" } });
        }
      })
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  if (
    request.destination === "image" ||
    request.destination === "font" ||
    request.destination === "script" ||
    request.destination === "style"
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return response;
          }).catch(() => {
            // Return a fallback or just let it fail gracefully without unhandled rejection
            return new Response("", { status: 503, statusText: "Service Unavailable" });
          }),
      ),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok && url.pathname !== "/api/") {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        }).catch(() => {
          return new Response("", { status: 503, statusText: "Service Unavailable" });
        }),
    ),
  );
});
