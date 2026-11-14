// sw.js
importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js');

workbox.routing.registerRoute(
  // Регулярное выражение для путей к аватаркам
  /\/avatars\/.*\.(?:png|jpg|jpeg|webp|gif|svg)$/,
  new workbox.strategies.CacheFirst({
    cacheName: 'avatars-cache',
    plugins: [
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 200, // Максимальное количество кешируемых аватарок
        maxAgeSeconds: 30 * 24 * 60 * 60, // Хранить 30 дней
      }),
      new workbox.cacheableResponse.CacheableResponsePlugin({
        statuses: [0, 200], // Кешировать только успешные ответы
      }),
    ],
  })
);