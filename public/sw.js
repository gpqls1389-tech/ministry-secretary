// 목회 비서 서비스 워커(MB12.24): 인터넷이 없어도 앱 화면을 열 수 있게 파일을 이 기기에 저장해 둔다.
// - 화면 파일(html·js·css 등): 인터넷이 되면 항상 최신을 받고(받은 것을 저장), 안 되면 저장해 둔 것을 쓴다 → 새 버전이 나오면 연결될 때 자동으로 바뀐다.
// - 글꼴·외부 라이브러리(fonts·vendor): 한 번 받으면 저장해 둔 것을 쓴다(파일이 바뀌지 않는 이름).
// - /api/ 는 절대 저장하지 않는다(로그인·데이터는 서버/앱이 따로 처리).
const CACHE = 'ms-shell-v1';
const TIMEOUT = 6000; // 연결이 느려도 6초 뒤에는 저장해 둔 화면으로 연다

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    try { const list = await (await fetch('precache.json', { cache: 'reload' })).json(); await Promise.all(list.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {}))); } catch { /* 목록을 못 받아도 설치는 진행(실행하면서 저장) */ }
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', e => { e.waitUntil((async () => { for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k); await self.clients.claim(); })()); });

const withTimeout = (p, ms) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error('timeout')), ms))]);
async function networkFirst(req, fallbackKey) {
  const c = await caches.open(CACHE);
  try {
    const res = await withTimeout(fetch(req, { cache: 'no-cache' }), TIMEOUT);
    if (res && res.ok && res.type === 'basic') c.put(fallbackKey || req, res.clone());
    return res;
  } catch (err) {
    const hit = await c.match(fallbackKey || req, { ignoreSearch: true }); if (hit) return hit;
    throw err;
  }
}
async function cacheFirst(req) {
  const c = await caches.open(CACHE); const hit = await c.match(req); if (hit) return hit;
  const res = await fetch(req); if (res && res.ok && res.type === 'basic') c.put(req, res.clone()); return res;
}
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url); if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return; // 서버 호출은 그대로 통과
  if (url.pathname === '/sw.js' || url.pathname === '/precache.json') return;
  if (url.pathname.startsWith('/fonts/') || url.pathname.startsWith('/vendor/')) { e.respondWith(cacheFirst(req)); return; }
  if (req.mode === 'navigate') { e.respondWith(networkFirst(req, new Request('index.html'))); return; } // 어느 주소로 열어도 같은 앱 화면
  e.respondWith(networkFirst(req));
});
