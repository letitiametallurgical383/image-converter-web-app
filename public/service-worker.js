const CACHE_VERSION = "imgconvert-v2";
const SHELL_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icon.svg",
  "/icon-192.png",
  "/icon-512.png",
];

function cleanResponse(response) {
  if (!response.redirected) return Promise.resolve(response);
  const cloned = response.clone();
  const bodyPromise = "body" in cloned
    ? Promise.resolve(cloned.body)
    : cloned.blob();
  return bodyPromise.then((body) =>
    new Response(body, {
      headers: cloned.headers,
      status: cloned.status,
      statusText: cloned.statusText,
    })
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) =>
        Promise.all(
          SHELL_ASSETS.map((url) =>
            fetch(url, { redirect: "follow" }).then((response) =>
              cleanResponse(response).then((clean) => cache.put(url, clean))
            )
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.protocol === "chrome-extension:") return;
  if (url.origin !== self.location.origin) return;

  const isNavigationRequest = request.mode === "navigate";
  const isStaticAsset =
    url.pathname.startsWith("/assets/") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".wasm") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".webp") ||
    url.pathname.endsWith(".json");

  if (isNavigationRequest) {
    event.respondWith(
      caches
        .match("/index.html")
        .then((cached) => {
          if (cached) return cleanResponse(cached);
          return fetch(request, { redirect: "follow" }).then((response) => {
            if (response.ok) {
              cleanResponse(response).then((clean) =>
                caches
                  .open(CACHE_VERSION)
                  .then((cache) => cache.put("/index.html", clean))
              );
            }
            return response;
          });
        })
    );
    return;
  }

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cleanResponse(cached);
        return fetch(request, { redirect: "follow" }).then((response) => {
          if (response.ok) {
            cleanResponse(response).then((clean) =>
              caches
                .open(CACHE_VERSION)
                .then((cache) => cache.put(request, clean))
            );
          }
          return response;
        });
      }),
    );
    return;
  }

  event.respondWith(
    fetch(request, { redirect: "follow" }).catch(() =>
      caches
        .match(request)
        .then((c) => (c ? cleanResponse(c) : Response.error()))
    ),
  );
});
