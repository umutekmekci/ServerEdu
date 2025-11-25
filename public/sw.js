// The version of the cache.
const VERSION = "v1";

// The name of the cache
const CACHE_NAME = `edu-${VERSION}`;

// The static resources that the app needs to function.
const APP_STATIC_RESOURCES = [
  "/",
];


// On install, cache the static resources
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      cache.addAll(APP_STATIC_RESOURCES);
    })()
  );
});

// delete old caches on activate
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
      await clients.claim();
    })()
  );
});

  const putInCacheWithoutRedirect = async (request, response) => {
    const cache = await caches.open(CACHE_NAME);
    if(!request.url.includes("chrome-extension"))
    {
      await cache.put(request, new Response(response.body, {
        headers: response.headers,
        status: response.status,
        statusText: response.statusText,
      }));
    }
  };

// On fetch, intercept server requests
// and respond with cached responses instead of going to network
self.addEventListener("fetch", (event) => {

  
  console.log(event.request.url)
  // For all other requests, go to the cache first, and then the network.
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const Keys = await cache.keys()
      console.log(Keys)
      const cachedResponse = await cache.match(event.request);
      if (cachedResponse) {
        // Return the cached response if it's available.
        return cachedResponse;
      }
      
      try
      {
        const Response = await fetch(event.request.clone())
        if(Response.status === 200)
        {
          putInCacheWithoutRedirect(event.request.clone(), Response.clone())
          return Response
        }
        else
        {
          const cachedResponse = await cache.match("/")
          return cachedResponse
        }
      }
      catch(error)
      {
        const cachedResponse = await cache.match("/")
        return cachedResponse
      }

    })()
  );
});