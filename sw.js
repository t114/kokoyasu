// 🛒 KokoYasu (ココ安) PWA Service Worker
const CACHE_NAME = "kokoyasu-cache-v1";

// Core static assets to cache immediately upon installation
const PRECACHE_ASSETS = [
  "/",
  "/index.html",
  "/favicon.svg",
  "/icons.svg",
  "/manifest.json"
];

// Install Event: Pre-cache core shell resources
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[Service Worker] Pre-caching app shell assets...");
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => {
      // Force the waiting service worker to become the active service worker immediately
      return self.skipWaiting();
    })
  );
});

// Activate Event: Clean up outdated caches from previous versions
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log(`[Service Worker] Deleting obsolete cache: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Force all open tab clients to be controlled by this service worker immediately
      return self.clients.claim();
    })
  );
});

// Fetch Event: Robust Stale-While-Revalidate Caching Strategy
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // 1. Skip caching for non-GET requests (e.g. database syncing POSTs, form submissions)
  if (request.method !== "GET") {
    return;
  }

  // 2. Skip caching for development web sockets (Vite HMR websocket) and chrome extensions
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return;
  }

  // 3. Skip caching for local development devtools/hot updates (avoiding cached HMR glitches)
  if (url.pathname.includes("@vite") || url.pathname.includes("@react-refresh") || url.pathname.includes("index.css?t=")) {
    return;
  }

  // 4. Stale-While-Revalidate for all valid GET requests
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(request).then((cachedResponse) => {
        // Fetch fresh content from the network in the background
        const networkFetch = fetch(request)
          .then((networkResponse) => {
            // Validate response before caching (only cache successful HTTP responses)
            if (networkResponse.status === 200) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch((err) => {
            // Return cached response if offline/network fails, else propagate error
            console.log(`[Service Worker] Network request failed for ${url.pathname}:`, err);
          });

        // Return the cached response immediately if available, otherwise wait for the network
        return cachedResponse || networkFetch;
      });
    })
  );
});
