// sw.js
importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js');

// Аватарки (локальные файлы)
workbox.routing.registerRoute(
  /\/avatars\/.*\.(?:png|jpg|jpeg|webp|gif|svg)$/,
  new workbox.strategies.CacheFirst({
    cacheName: 'avatars-cache',
    plugins: [
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 200,
        maxAgeSeconds: 30 * 24 * 60 * 60,
      }),
      new workbox.cacheableResponse.CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
);

// Алтари — только картинки, без видео
workbox.routing.registerRoute(
  /^https:\/\/storage\.yandexcloud\.net\/2chzzz\/.*\.(?:png|jpg|jpeg|webp|gif|svg)$/i,
  new workbox.strategies.CacheFirst({
    cacheName: 'altars-cache',
    plugins: [
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 120,
        maxAgeSeconds: 90 * 24 * 60 * 60,
      }),
      new workbox.cacheableResponse.CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
);