/* The saved copy. The first visit keeps every file in BOOK_FILES on the
   device. After that the page opens from the saved copy first, so it works
   with no internet at all. */
importScripts('./files.js');

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(self.BOOK_VERSION).then(function (cache) {
      /* Ask the network for fresh files, not the device's short term memory. */
      return Promise.all(self.BOOK_FILES.map(function (file) {
        return fetch(new Request(file, { cache: 'reload' })).then(function (response) {
          if (!response.ok) throw new Error('Could not save ' + file);
          return cache.put(file, response);
        });
      }));
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(names.filter(function (name) {
        return name !== self.BOOK_VERSION;
      }).map(function (name) {
        return caches.delete(name);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then(function (saved) {
      return saved || fetch(event.request);
    })
  );
});
