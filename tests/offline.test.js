import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { offlineEnabled, setOfflineEnabled, saveCopy, readCopy, lastUser, clearOfflineData, offKey } from '../public/js/offline.js';
import { precacheList } from '../scripts/make-precache.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..'); const PUB = path.join(ROOT, 'public');
const text = p => fs.readFileSync(path.join(PUB, p), 'utf8').replace(/\r\n/g, '\n');
const fakeLs = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), key: i => [...m.keys()][i] ?? null, get length() { return m.size; }, m }; };

test('MB12.24 오프라인 복사본: 켠 사람만, 계정별, 끄거나 지우면 모두 삭제', () => {
  const ls = fakeLs(); assert.equal(offlineEnabled(ls), false); assert.equal(saveCopy(ls, { email: 'A@x.com', name: '가' }, '{"v":1}', 7, 111), true);
  assert.deepEqual(lastUser(ls), { email: 'A@x.com', name: '가' }); assert.deepEqual(readCopy(ls, 'a@X.com'), { state: '{"v":1}', version: 7, at: 111 }, '이메일 대소문자 무시'); assert.equal(readCopy(ls, 'b@x.com'), null);
  assert.equal(offKey(' A@x.com '), offKey('a@x.com')); assert.equal(saveCopy(ls, null, 's', 1), false);
  ls.setItem('other', '1'); setOfflineEnabled(ls, true); assert.equal(offlineEnabled(ls), true);
  saveCopy(ls, { email: 'b@x.com' }, 's2', 2); clearOfflineData(ls); assert.equal(lastUser(ls), null); assert.equal(readCopy(ls, 'a@x.com'), null); assert.equal(readCopy(ls, 'b@x.com'), null); assert.equal(ls.getItem('other'), '1', '다른 값은 건드리지 않는다'); assert.equal(offlineEnabled(ls), true, '로그아웃은 복사본만 지우고 설정은 유지');
  saveCopy(ls, { email: 'a@x.com' }, 's', 3); setOfflineEnabled(ls, false); assert.equal(offlineEnabled(ls), false); assert.equal(readCopy(ls, 'a@x.com'), null, '끄면 복사본도 지운다');
  ls.setItem(offKey('z@x.com'), '{깨짐'); assert.equal(readCopy(ls, 'z@x.com'), null, '손상된 복사본은 무시');
  const full = { getItem: () => null, setItem() { throw new Error('quota'); }, removeItem() {}, key: () => null, length: 0 }; assert.equal(saveCopy(full, { email: 'a@x.com' }, 's', 1), false, '용량 부족은 조용히 포기');
});

// 서비스 워커 동작을 가짜 환경에서 실행해 본다(캐시 저장소·fetch를 흉내)
async function loadSw({ online = true, files = {} } = {}) {
  const caches = new Map(); const handlers = {}; const calls = [];
  const cacheApi = { async open(n) { if (!caches.has(n)) caches.set(n, new Map()); const m = caches.get(n); const key = r => (typeof r === 'string' ? r : r.url || String(r)); return { async match(r) { return m.get(new URL(key(r), 'https://x.test/').pathname) || undefined; }, async put(r, res) { m.set(new URL(key(r), 'https://x.test/').pathname, res); }, async add(r) { const u = new URL(key(r), 'https://x.test/').pathname; if (!(u in files)) throw new Error('404'); m.set(u, { ok: true, type: 'basic', body: files[u], clone() { return this; } }); }, async keys() { return [...m.keys()]; } }; }, async keys() { return [...caches.keys()]; }, async delete(n) { return caches.delete(n); } };
  const self = { location: { origin: 'https://x.test' }, addEventListener: (t, f) => { handlers[t] = f; }, skipWaiting: async () => {}, clients: { claim: async () => {} } };
  class Request { constructor(u, o = {}) { this.url = new URL(u, 'https://x.test/').href; this.method = (o.method || 'GET'); this.mode = o.mode || 'cors'; } }
  const fetchFn = async (req) => { const u = new URL(typeof req === 'string' ? req : req.url, 'https://x.test/').pathname; calls.push(u); if (!online) throw new TypeError('network'); if (!(u in files)) return { ok: false, status: 404, type: 'basic', clone() { return this; } }; return { ok: true, type: 'basic', body: files[u], json: async () => files[u], clone() { return this; } }; };
  const ctx = vm.createContext({ self, caches: cacheApi, fetch: fetchFn, Request, URL, Promise, setTimeout, clearTimeout, console });
  vm.runInContext(fs.readFileSync(path.join(PUB, 'sw.js'), 'utf8'), ctx);
  const fire = async (url, mode = 'cors', method = 'GET') => { let p; handlers.fetch({ request: Object.assign(new Request(url, { mode, method }), { method }), respondWith: x => { p = x; } }); return p === undefined ? 'passthrough' : p; };
  return { handlers, caches, calls, fire, setOnline: v => { online = v; }, ctx };
}

test('서비스 워커: 인터넷이 되면 최신을 받아 저장하고, 끊기면 저장해 둔 것을 쓰며, /api는 건드리지 않는다', async () => {
  const files = { '/precache.json': ['index.html', 'js/app.js', 'missing-file.js'], '/index.html': 'INDEX', '/js/app.js': 'APP-v1', '/style.css': 'CSS', '/fonts/a.woff2': 'FONT' };
  const sw = await loadSw({ files }); const events = []; const waits = []; await sw.handlers.install({ waitUntil: p => waits.push(p) }); await Promise.all(waits); assert.ok([...sw.caches.get('ms-shell-v1').keys()].includes('/index.html'), '설치할 때 미리 저장(없는 파일이 있어도 설치는 계속)');
  assert.equal(await sw.fire('/api/state'), 'passthrough', '/api 통과'); assert.equal(await sw.fire('/x', 'cors', 'POST'), 'passthrough', 'POST 통과'); assert.equal(await sw.fire('/sw.js'), 'passthrough');
  assert.equal((await sw.fire('/js/app.js')).body, 'APP-v1', '온라인: 네트워크에서');
  files['/js/app.js'] = 'APP-v2'; assert.equal((await sw.fire('/js/app.js')).body, 'APP-v2', '온라인이면 항상 최신');
  await sw.fire('/fonts/a.woff2'); // 글꼴은 쓸 때 한 번 저장
  sw.setOnline(false); assert.equal((await sw.fire('/js/app.js')).body, 'APP-v2', '오프라인: 마지막으로 받은 최신을 사용');
  assert.equal((await sw.fire('/anything/deep', 'navigate')).body, 'INDEX', '오프라인에서 어떤 주소로 열어도 앱 화면');
  assert.equal((await sw.fire('/fonts/a.woff2')).body, 'FONT', '글꼴은 저장본 우선'); await assert.rejects(sw.fire('/js/never-cached.js'), /network/, '저장된 적 없는 파일은 오류(앱이 처리)');
  sw.setOnline(true); const n = sw.calls.length; await sw.fire('/fonts/a.woff2'); assert.equal(sw.calls.length, n, '글꼴은 저장본이 있으면 네트워크를 쓰지 않는다');
  const url404 = await sw.fire('/missing.css'); assert.equal(url404.ok, false, '404는 그대로 전달하고 저장하지 않는다'); sw.setOnline(false); await assert.rejects(sw.fire('/missing.css'), /network/);
});

test('서비스 워커 설치: 미리 저장 목록이 모든 화면 파일을 덮고 파일이 실제로 있다, 헤더·등록 코드', () => {
  const list = JSON.parse(text('precache.json')); assert.deepEqual(list, precacheList(), 'precache.json이 최신이 아니에요: node scripts/make-precache.js 를 실행하세요');
  for (const f of list) assert.ok(fs.existsSync(path.join(PUB, f)), f); for (const f of fs.readdirSync(path.join(PUB, 'js'))) assert.ok(list.includes(`js/${f}`), `js/${f} 누락`);
  assert.ok(list.includes('index.html') && list.includes('style.css') && !list.some(f => f.startsWith('fonts/kr/')) && !list.some(f => f.startsWith('vendor/pdfjs/')), '큰 파일은 쓸 때 저장');
  const h = text('_headers'); assert.ok(/\/sw\.js\n\s+Cache-Control: no-cache/.test(h) && /\/precache\.json\n\s+Cache-Control: no-cache/.test(h), '서비스 워커 파일은 항상 새로 확인');
  const app = text('js/app.js'); assert.ok(app.includes("navigator.serviceWorker.register('sw.js')") && app.includes("document.readyState === 'complete'"), 'load 이후에도 등록');
});

test('오프라인 계정 시작·표시·로그아웃 정리: 코드 연결', () => {
  const au = text('js/auth.js'); const app = text('js/app.js');
  for (const k of ['function offlineStart', 'if (e.offline) { const off = offlineStart(); if (off) return off; }', "AUTH.status = 'offline'", 'makeAdapter(usePend ? pend.state : copy.state, copy.state, usePend)', "if (e.offline) { set('offline'", 'AUTH.clearOffline', 'AUTH.mirrorNow', 'makeAdapter(initial, st.state)']) assert.ok(au.includes(k), k);
  for (const k of ['data-offline', 'offline: [\'◌ 오프라인 · 연결되면 저장\'', 'offlineOn() || navigator.onLine === false', 'A.clearOffline(); await accountApi.logout()', 'A.clearOffline(); await accountApi.logoutAll()', '(A.clearOffline(), accountApi.deleteAccount(o.pw))', 'function paintBar', "bar.dataset.kind = off ? 'offline'"]) assert.ok(app.includes(k), k);
  assert.ok(!/makeAdapter\(initial\);/.test(au), '서버 내용(st.state)을 넘기지 않으면 되살린 변경이 올라가지 않는다(MB12.23 오류)');
});
