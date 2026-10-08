// 푸시 알림 서비스 워커 (추가 기능) — 홈을 닫아 둬도 알림을 받아 띄운다.
// /push 페이지에서 「이 기기에서 알림 받기」를 누르면 등록된다.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { title: '새 알림', body: e.data ? e.data.text() : '' }; }
  const title = d.title || '새 알림';
  e.waitUntil(self.registration.showNotification(title, {
    body: d.body || '',
    tag: d.tag || undefined,      // 같은 방의 알림은 하나로 갈아 끼운다
    renotify: !!d.tag,
    icon: d.icon || '/favicon.ico',
    data: { href: d.href || '/' },
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL(e.notification.data?.href || '/', self.location.origin).href;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) {
      if (new URL(w.url).origin === self.location.origin) {
        await w.focus();
        if ('navigate' in w) { try { await w.navigate(url); } catch { /* 무시 */ } }
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
