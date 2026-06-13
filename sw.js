// MyTracc Service Worker v2
const CACHE_NAME = 'mytracc-v2';
const ASSETS = [
  '/plan-hugo/index.html',
  '/plan-hugo/manifest.json'
];

// ── INSTALL: cachear assets ──
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// ── ACTIVATE: limpiar caches viejos ──
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── FETCH: servir desde cache si está disponible ──
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});

// ── TIMER: mensaje desde la app para programar notificación ──
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SCHEDULE_TIMER') {
    const { seconds, exerciseName } = e.data;
    setTimeout(() => {
      self.registration.showNotification('¡Descanso terminado! 💪', {
        body: exerciseName ? 'Siguiente serie: ' + exerciseName : 'A por la siguiente serie',
        vibrate: [200, 100, 200],
        tag: 'timer-end',
        renotify: true,
        requireInteraction: false,
        silent: false
      });
    }, seconds * 1000);
  }

  if (e.data && e.data.type === 'CANCEL_TIMER') {
    // No hay forma de cancelar un setTimeout desde SW directamente
  }
});

// ── NOTIFICATION CLICK: abrir la app ──
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes('plan-hugo') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/plan-hugo/index.html');
      }
    })
  );
});
