// sw.js
importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js');
workbox.routing.registerRoute(
  /^https:\/\/storage\.yandexcloud\.net\/2chzzz\/.*\.(mp4|webm)$/,
  new workbox.strategies.CacheFirst({
    cacheName: 'video-cache',
    plugins: [
      new workbox.cacheableResponse.CacheableResponsePlugin({ statuses: [200] }),
      new workbox.rangeRequests.RangeRequestsPlugin(),
    ],
  })
);

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

// Алтари с yandex cloud (кросс-домен, но SW в области видимости страницы
// может их перехватывать и кешировать как opaque)
workbox.routing.registerRoute(
  /^https:\/\/storage\.yandexcloud\.net\/2chzzz\//,
  new workbox.strategies.CacheFirst({
    cacheName: 'altars-cache',
    plugins: [
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 120,
        maxAgeSeconds: 90 * 24 * 60 * 60,   // 90 дней
      }),
      new workbox.cacheableResponse.CacheableResponsePlugin({
        statuses: [0, 200],                  // 0 = opaque (кросс-домен)
      }),
    ],
  })
);

