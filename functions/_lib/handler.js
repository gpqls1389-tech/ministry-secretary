// 로그인·사용자별 저장 API (Cloudflare Pages Functions + D1). 웹 표준 API만 사용하므로 Node 테스트에서도 그대로 실행된다.
import { validateState } from '../../public/js/store.js';
import { handleCommunity, communityPurge } from './community.js';
import { IMAGE_KINDS, IMAGE_SIZES, IMAGE_QUALITIES, PROMPT_MIN, PROMPT_MAX, imageConfig, emailAllowed, callOpenAI, rateKeys, DAY_MS } from './imagegen.js';

const ITER = 100000;                       // Workers WebCrypto의 PBKDF2 반복 횟수 상한(확인된 값)
const SESSION_MS = 14 * 24 * 3600e3;       // 세션 14일(공용 PC 위험을 줄이려고 짧게)
const MAX_STATE = 1_500_000;               // D1 한 줄 2MB 제한보다 작게
const LOCK_MS = 15 * 60e3;
const MIN_INVITE = 12;                     // 초대 코드가 이보다 짧으면 가입을 아예 닫는다(추측 쉬운 코드 방지)
const WEAK_PW = new Set(['1234567890', '0123456789', 'qwertyuiop', 'password12', 'password123', 'passw0rd123', '1q2w3e4r5t', 'abcdefghij', 'iloveyou123', 'admin12345', 'qwerty12345', '0000000000', '1111111111']);
const enc = new TextEncoder();

const b64 = u8 => btoa(String.fromCharCode(...u8));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const b64url = u8 => b64(u8).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export async function sha256Hex(s) { const d = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s))); return [...d].map(x => x.toString(16).padStart(2, '0')).join(''); }
function same(a, b) { // 상수 시간 비교(길이가 달라도 끝까지 비교)
  const x = typeof a === 'string' ? enc.encode(a) : a, y = typeof b === 'string' ? enc.encode(b) : b; let r = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) r |= (x[i] || 0) ^ (y[i] || 0); return r === 0;
}
async function pbkdf2(pw, salt, iter) {
  const k = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, k, 256));
}
export async function hashPassword(pw) { const salt = crypto.getRandomValues(new Uint8Array(16)); return `pbkdf2-sha256$${ITER}$${b64(salt)}$${b64(await pbkdf2(pw, salt, ITER))}`; }
export async function verifyPassword(pw, stored) {
  const [alg, it, salt, hash] = String(stored).split('$'); if (alg !== 'pbkdf2-sha256') return false;
  return same(b64(await pbkdf2(pw, unb64(salt), Number(it))), hash);
}
const DUMMY = 'pbkdf2-sha256$100000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

class HttpError extends Error { constructor(status, msg, extra = {}) { super(msg); this.status = status; this.extra = extra; } }
// Pages의 _headers 파일은 Functions 응답에 적용되지 않으므로(공식 문서) API 응답 헤더는 코드에서 직접 붙인다
const SEC_HEADERS = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer', 'Cross-Origin-Resource-Policy': 'same-origin', 'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'" };
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...SEC_HEADERS, ...headers } });

function cookieName(secure) { return secure ? '__Host-ms_session' : 'ms_session'; }
function readCookie(request, name) { const m = (request.headers.get('Cookie') || '').split(/;\s*/).find(c => c.startsWith(name + '=')); return m ? m.slice(name.length + 1) : null; }
const setCookie = (secure, value, maxAge) => `${cookieName(secure)}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;

async function body(request, limit = 4096) {
  const len = Number(request.headers.get('Content-Length') || 0); if (len > limit * 3) throw new HttpError(413, '요청이 너무 큽니다.'); // 한글은 글자당 최대 3바이트
  const text = await request.text(); if (enc.encode(text).length > limit * 3) throw new HttpError(413, '요청이 너무 큽니다.');
  try { const j = JSON.parse(text || '{}'); if (!j || typeof j !== 'object' || Array.isArray(j)) throw 0; return j; } catch { throw new HttpError(400, '요청 형식이 올바르지 않습니다.'); }
}

// ---- 시도 횟수 제한 ----
async function limited(db, key, max, now) { const r = await db.prepare('SELECT n, reset_at FROM rate WHERE key=?').bind(key).first(); return !!(r && r.reset_at > now && r.n >= max); }
async function fail(db, key, now, win = LOCK_MS) {
  await db.prepare('INSERT INTO rate(key,n,reset_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET n = CASE WHEN reset_at <= ? THEN 1 ELSE n+1 END, reset_at = CASE WHEN reset_at <= ? THEN ? ELSE reset_at END').bind(key, now + win, now, now, now + win).run();
}
const clear = (db, key) => db.prepare('DELETE FROM rate WHERE key=?').bind(key).run();

async function newSession(db, userId, now) {
  const token = b64url(crypto.getRandomValues(new Uint8Array(32)));
  await db.prepare('INSERT INTO sessions(token_hash,user_id,created_at,expires_at) VALUES(?,?,?,?)').bind(await sha256Hex(token), userId, now, now + SESSION_MS).run();
  await db.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(now).run(); // 만료된 세션 정리
  return token;
}
async function currentUser(db, request, secure, now) {
  const t = readCookie(request, cookieName(secure)); if (!t) return null;
  return db.prepare('SELECT u.id, u.email, u.name FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').bind(await sha256Hex(t), now).first();
}

const emailOk = e => typeof e === 'string' && e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
function pwCheck(p, email = '') {
  if (typeof p !== 'string' || p.length < 10) throw new HttpError(400, '비밀번호는 10자 이상이어야 합니다.'); if (p.length > 128) throw new HttpError(400, '비밀번호는 128자 이하여야 합니다.');
  const low = p.toLowerCase(); const local = String(email).split('@')[0];
  if (WEAK_PW.has(low) || /^(.)\1+$/.test(p) || (local.length >= 4 && low.includes(local))) throw new HttpError(400, '너무 추측하기 쉬운 비밀번호예요. 이메일과 다르게, 서로 다른 단어 여러 개를 이어 쓰는 것을 권해요.');
}
const inviteReady = env => typeof env.INVITE_CODE === 'string' && env.INVITE_CODE.length >= MIN_INVITE;

// ---- 영수증 사진: 계정마다 따로 저장(D1). 표는 처음 쓸 때 자동으로 만든다(관리자가 따로 SQL을 실행할 필요 없음). ----
const MAX_RECEIPT_BYTES = 400_000;         // 사진 한 장(브라우저가 줄여서 올린 JPEG)
const MAX_RECEIPTS = 300;                  // 계정당 장수
const MAX_RECEIPT_TOTAL = 60_000_000;      // 계정당 전체 용량(60MB)
const RECEIPT_URL = /^\/api\/receipts\/([a-f0-9]{32})$/;
const receiptReady = new WeakSet();
async function ensureReceipts(db) {
  if (receiptReady.has(db)) return;
  await db.prepare('CREATE TABLE IF NOT EXISTS receipts (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, size INTEGER NOT NULL, data TEXT NOT NULL, created_at INTEGER NOT NULL)').bind().run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_receipts_user ON receipts(user_id)').bind().run();
  receiptReady.add(db);
}
// ---- 간편 로그인(6자리 번호): 비밀번호로 로그인한 ‘이 기기’에서만 쓴다 ----
// 기기 비밀값(32바이트)은 HttpOnly 쿠키에만 있고 서버에는 SHA-256만 둔다. 번호는 기기 비밀값과 함께 PBKDF2로 저장해
// 데이터베이스가 새어도 번호를 맞혀 볼 수 없고, 다른 기기에서는 번호만으로 로그인할 수 없다. 5번 틀리면 그 기기의 간편 로그인을 지운다.
const DEVICE_MS = 180 * 24 * 3600e3;       // 쓰지 않으면 180일 뒤 만료(쓸 때마다 연장)
const PIN_FAILS = 5;
const MAX_DEVICES = 5;
function deviceCookieName(secure) { return secure ? '__Host-ms_device' : 'ms_device'; }
const setDeviceCookie = (secure, value, maxAge) => `${deviceCookieName(secure)}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
const WEAK_PIN = new Set(['000000', '111111', '123456', '654321', '123123', '121212', '112233', '123321', '111222', '696969', '159753', '147258', '258369', '102030', '100000', '999999', '012345', '987654', '543210', '456789']);
export function pinCheck(pin) {
  if (typeof pin !== 'string' || !/^\d{6}$/.test(pin)) throw new HttpError(400, '간편 로그인 번호는 숫자 6자리예요.');
  const d = [...pin].map(Number); const step = d.slice(1).map((x, i) => x - d[i]);
  if (WEAK_PIN.has(pin) || new Set(d).size <= 2 || step.every(x => x === 1) || step.every(x => x === -1)) throw new HttpError(400, '너무 쉬운 번호예요(같은 숫자 반복·연속 숫자 등). 다른 6자리를 골라 주세요.');
}
const deviceReady = new WeakSet();
async function ensureDevices(db) {
  if (deviceReady.has(db)) return;
  await db.prepare("CREATE TABLE IF NOT EXISTS devices (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, token_hash TEXT NOT NULL UNIQUE, pin_hash TEXT NOT NULL, fails INTEGER NOT NULL DEFAULT 0, label TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, last_used INTEGER NOT NULL, expires_at INTEGER NOT NULL)").bind().run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_devices_user ON devices(user_id)').bind().run();
  deviceReady.add(db);
}
async function currentDevice(db, request, secure, now) {
  const t = readCookie(request, deviceCookieName(secure)); if (!t || t.length > 100) return null; await ensureDevices(db);
  const d = await db.prepare('SELECT d.id, d.user_id, d.pin_hash, d.fails, d.expires_at, u.email, u.name FROM devices d JOIN users u ON u.id=d.user_id WHERE d.token_hash=?').bind(await sha256Hex(t)).first();
  if (!d) return null; if (d.expires_at <= now) { await db.prepare('DELETE FROM devices WHERE id=?').bind(d.id).run(); return null; }
  return { ...d, secret: t };
}
const maskEmail = e => { const [a, b] = String(e).split('@'); return `${a.slice(0, 2)}${'*'.repeat(Math.max(1, Math.min(6, a.length - 2)))}@${b}`; };
async function dropDevices(db, userId, exceptId = '') { await ensureDevices(db); await db.prepare('DELETE FROM devices WHERE user_id=? AND id<>?').bind(userId, exceptId).run(); }

// ---- 저장 이력(되돌리기용, MB12.7): 덮어쓰기 직전의 상태를 일정 간격으로 보관한다 ----
// 표는 처음 쓸 때 자동으로 만든다. 계정마다 최근 30개만 남기고, 로그인한 본인 것만 볼 수 있다.
const HISTORY_KEEP = 30;
const HISTORY_GAP_MS = 30 * 60e3;          // 편집 중에는 30분에 한 번만 보관(저장마다 보관하지 않음)
const SHRINK_RATIO = 0.6;                  // 데이터가 갑자기 40% 넘게 줄어드는 저장은 사고일 수 있어 항상 보관
const HISTORY_ID = /^\/api\/history\/(\d{1,12})$/;
const historyReady = new WeakSet();
async function ensureHistory(db) {
  if (historyReady.has(db)) return;
  await db.prepare('CREATE TABLE IF NOT EXISTS state_history (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, version INTEGER NOT NULL, state TEXT NOT NULL, bytes INTEGER NOT NULL, people INTEGER NOT NULL DEFAULT 0, att INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL)').bind().run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_history_user ON state_history(user_id, id)').bind().run();
  historyReady.add(db);
}
// 지금 저장돼 있는 상태(user_state)를 이력에 복사한다. 큰 글을 자바스크립트로 읽지 않고 SQL 안에서 복사한다.
async function snapshot(db, userId, now) {
  await ensureHistory(db);
  try { await db.prepare("INSERT INTO state_history(user_id,version,state,bytes,people,att,created_at) SELECT user_id, version, state, LENGTH(state), COALESCE(json_array_length(state, '$.people'), 0), COALESCE(json_array_length(state, '$.attendance'), 0), ? FROM user_state WHERE user_id=?").bind(now, userId).run(); }
  catch { await db.prepare('INSERT INTO state_history(user_id,version,state,bytes,people,att,created_at) SELECT user_id, version, state, LENGTH(state), 0, 0, ? FROM user_state WHERE user_id=?').bind(now, userId).run(); } // JSON 함수를 못 쓰는 환경 대비
  await db.prepare('DELETE FROM state_history WHERE user_id=? AND id NOT IN (SELECT id FROM state_history WHERE user_id=? ORDER BY id DESC LIMIT ?)').bind(userId, userId, HISTORY_KEEP).run();
}
async function snapshotIfNeeded(db, userId, now, { force = false, newLen = 0 } = {}) {
  await ensureHistory(db);
  const last = await db.prepare('SELECT created_at FROM state_history WHERE user_id=? ORDER BY id DESC LIMIT 1').bind(userId).first();
  const cur = await db.prepare('SELECT LENGTH(state) AS n FROM user_state WHERE user_id=?').bind(userId).first();
  if (force || !last || now - last.created_at >= HISTORY_GAP_MS || (cur && newLen < cur.n * SHRINK_RATIO)) await snapshot(db, userId, now);
}

export async function handle(request, env, now = Date.now()) {
  const url = new URL(request.url); const path = url.pathname.replace(/\/+$/, '') || '/'; const secure = url.protocol === 'https:'; const method = request.method.toUpperCase();
  try {
    if (!path.startsWith('/api/')) throw new HttpError(404, '찾을 수 없습니다.');
    if (path === '/api/me' && method === 'GET' && !env.DB) return json({ ok: true, configured: false, signup: false, user: null }); // 서버 설정 전: 화면이 로컬 모드로 동작
    if (!env.DB) throw new HttpError(503, '서버 설정이 끝나지 않았습니다(D1 연결 필요).');
    const db = env.DB;
    if (method !== 'GET') { // CSRF 방어: 같은 출처 + JSON 요청만 허용(쿠키는 SameSite=Strict)
      const origin = request.headers.get('Origin'); if (origin && origin !== url.origin) throw new HttpError(403, '허용되지 않은 요청입니다.');
      const sfs = request.headers.get('Sec-Fetch-Site'); if (sfs && sfs !== 'same-origin' && sfs !== 'none') throw new HttpError(403, '허용되지 않은 요청입니다.');
      if (!(request.headers.get('Content-Type') || '').includes('application/json')) throw new HttpError(415, 'JSON 요청만 받을 수 있습니다.');
    }
    const ip = request.headers.get('CF-Connecting-IP') || 'local';

    if (path === '/api/me' && method === 'GET') { const user = await currentUser(db, request, secure, now); const dev = user ? null : await currentDevice(db, request, secure, now); return json({ ok: true, configured: true, signup: inviteReady(env), user: user ? { email: user.email, name: user.name } : null, quick: dev ? { email: maskEmail(dev.email) } : null }); }

    if (path === '/api/pin/login' && method === 'POST') {
      if (await limited(db, `pi:${ip}`, 30, now)) throw new HttpError(429, '시도가 너무 많습니다. 15분 뒤에 다시 해 주세요.');
      const b = await body(request); const dev = await currentDevice(db, request, secure, now);
      if (!dev) throw new HttpError(401, '이 기기에는 간편 로그인이 설정되어 있지 않아요. 비밀번호로 로그인하세요.', { code: 'no-device' });
      const ok = /^\d{6}$/.test(String(b.pin || '')) && await verifyPassword(dev.secret + ':' + b.pin, dev.pin_hash);
      if (!ok) {
        await fail(db, `pi:${ip}`, now); const left = PIN_FAILS - dev.fails - 1;
        if (left <= 0) { await db.prepare('DELETE FROM devices WHERE id=?').bind(dev.id).run(); return json({ ok: false, error: `번호를 ${PIN_FAILS}번 틀려 이 기기의 간편 로그인을 해제했어요. 비밀번호로 로그인한 뒤 설정에서 다시 만드세요.`, code: 'no-device' }, 401, { 'Set-Cookie': setDeviceCookie(secure, '', 0) }); }
        await db.prepare('UPDATE devices SET fails=fails+1 WHERE id=?').bind(dev.id).run(); throw new HttpError(401, `번호가 맞지 않아요. ${left}번 더 틀리면 간편 로그인이 해제돼요.`);
      }
      await db.prepare('UPDATE devices SET fails=0, last_used=?, expires_at=? WHERE id=?').bind(now, now + DEVICE_MS, dev.id).run();
      const token = await newSession(db, dev.user_id, now);
      return json({ ok: true, user: { email: dev.email, name: dev.name } }, 200, { 'Set-Cookie': setCookie(secure, token, SESSION_MS / 1000) });
    }
    if (path === '/api/pin/forget' && method === 'POST') { // 로그인 화면의 ‘이 기기에서 간편 로그인 지우기’(로그인 없이 가능: 자기 기기 쿠키만 지움)
      const dev = await currentDevice(db, request, secure, now); if (dev) await db.prepare('DELETE FROM devices WHERE id=?').bind(dev.id).run();
      return json({ ok: true }, 200, { 'Set-Cookie': setDeviceCookie(secure, '', 0) });
    }

    if (path === '/api/register' && method === 'POST') {
      if (!env.INVITE_CODE) throw new HttpError(403, '지금은 가입을 받지 않습니다(관리자가 초대 코드를 설정하지 않았습니다).');
      if (!inviteReady(env)) throw new HttpError(403, `초대 코드가 너무 짧아 가입을 받지 않습니다(관리자: ${MIN_INVITE}자 이상으로 설정).`);
      if (await limited(db, `reg:${ip}`, 10, now)) throw new HttpError(429, '시도가 너무 많습니다. 잠시 후 다시 해 주세요.');
      if (await limited(db, 'inv:all', 30, now)) throw new HttpError(429, '잘못된 초대 코드 입력이 많아 가입이 1시간 동안 잠겼습니다.'); // 여러 주소에서 코드를 추측하는 공격 대비
      const b = await body(request); const email = String(b.email || '').trim().toLowerCase(); const name = String(b.name || '').trim().slice(0, 40);
      await fail(db, `reg:${ip}`, now, 3600e3); // 가입 시도도 횟수에 포함(성공해도 1시간에 10번까지)
      if (!same(String(b.invite || ''), env.INVITE_CODE)) { await fail(db, 'inv:all', now, 3600e3); throw new HttpError(403, '초대 코드가 맞지 않습니다.'); }
      if (!emailOk(email)) throw new HttpError(400, '이메일 형식이 올바르지 않습니다.'); pwCheck(b.password, email);
      const maxUsers = Number(env.MAX_USERS); // 선택: 가입 가능한 최대 인원(혼자 쓰면 1로 설정)
      if (Number.isInteger(maxUsers) && maxUsers > 0 && (await db.prepare('SELECT COUNT(*) c FROM users').bind().first()).c >= maxUsers) throw new HttpError(403, '가입 가능한 인원이 모두 찼습니다.');
      if (await db.prepare('SELECT 1 x FROM users WHERE email=?').bind(email).first()) throw new HttpError(409, '이미 가입된 이메일입니다.');
      const id = crypto.randomUUID(); await db.prepare('INSERT INTO users(id,email,name,pw_hash,created_at) VALUES(?,?,?,?,?)').bind(id, email, name, await hashPassword(b.password), now).run();
      const token = await newSession(db, id, now);
      return json({ ok: true, user: { email, name } }, 201, { 'Set-Cookie': setCookie(secure, token, SESSION_MS / 1000) });
    }

    if (path === '/api/login' && method === 'POST') {
      const b = await body(request); const email = String(b.email || '').trim().toLowerCase().slice(0, 254);
      if (await limited(db, `le:${email}`, 8, now) || await limited(db, `li:${ip}`, 30, now)) throw new HttpError(429, '로그인 시도가 너무 많습니다. 15분 뒤에 다시 해 주세요.');
      const u = emailOk(email) ? await db.prepare('SELECT id, email, name, pw_hash FROM users WHERE email=?').bind(email).first() : null;
      const ok = await verifyPassword(String(b.password || ''), u ? u.pw_hash : DUMMY); // 없는 계정도 같은 계산을 해서 응답 시간 차이를 줄임
      if (!u || !ok) { await fail(db, `le:${email}`, now); await fail(db, `li:${ip}`, now); throw new HttpError(401, '이메일 또는 비밀번호가 맞지 않습니다.'); }
      await clear(db, `le:${email}`); const token = await newSession(db, u.id, now);
      return json({ ok: true, user: { email: u.email, name: u.name } }, 200, { 'Set-Cookie': setCookie(secure, token, SESSION_MS / 1000) });
    }

    const user = await currentUser(db, request, secure, now);
    if (path === '/api/logout' && method === 'POST') {
      const t = readCookie(request, cookieName(secure)); if (t) await db.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await sha256Hex(t)).run();
      return json({ ok: true }, 200, { 'Set-Cookie': setCookie(secure, '', 0) });
    }
    if (!user) throw new HttpError(401, '로그인이 필요합니다.', { code: 'login' });

    if (path === '/api/logout-all' && method === 'POST') { // 모든 기기에서 로그아웃: 내 세션과 간편 로그인을 전부 지운다(이 기기 포함)
      await db.prepare('DELETE FROM sessions WHERE user_id=?').bind(user.id).run(); await dropDevices(db, user.id);
      return json({ ok: true }, 200, { 'Set-Cookie': setCookie(secure, '', 0) });
    }
    if (path === '/api/pin' && method === 'GET') {
      await ensureDevices(db); const mine = await currentDevice(db, request, secure, now);
      const list = (await db.prepare('SELECT id, label, created_at, last_used FROM devices WHERE user_id=? AND expires_at>? ORDER BY last_used DESC').bind(user.id, now).all()).results;
      return json({ ok: true, here: !!(mine && mine.user_id === user.id), devices: list.map(d => ({ label: d.label, created_at: d.created_at, last_used: d.last_used, here: !!(mine && mine.id === d.id) })) });
    }
    if (path === '/api/pin' && method === 'POST') { // 이 기기에 간편 로그인 만들기(또는 번호 바꾸기): 비밀번호를 다시 확인한다
      const b = await body(request); if (await limited(db, `pw:${user.id}`, 8, now)) throw new HttpError(429, '시도가 너무 많습니다. 잠시 후 다시 해 주세요.');
      const u = await db.prepare('SELECT pw_hash FROM users WHERE id=?').bind(user.id).first();
      if (!(await verifyPassword(String(b.password || ''), u.pw_hash))) { await fail(db, `pw:${user.id}`, now); throw new HttpError(401, '비밀번호가 맞지 않습니다.'); }
      pinCheck(b.pin); await ensureDevices(db); const label = String(b.label || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 40) || '이 기기';
      const old = await currentDevice(db, request, secure, now); if (old) await db.prepare('DELETE FROM devices WHERE id=?').bind(old.id).run();
      const n = (await db.prepare('SELECT COUNT(*) c FROM devices WHERE user_id=?').bind(user.id).first()).c;
      if (n >= MAX_DEVICES) throw new HttpError(409, `간편 로그인은 기기 ${MAX_DEVICES}대까지 쓸 수 있어요. ‘모든 기기 해제’를 누른 뒤 다시 해 주세요.`);
      const secret = b64url(crypto.getRandomValues(new Uint8Array(32)));
      await db.prepare('INSERT INTO devices(id,user_id,token_hash,pin_hash,fails,label,created_at,last_used,expires_at) VALUES(?,?,?,?,0,?,?,?,?)').bind(crypto.randomUUID(), user.id, await sha256Hex(secret), await hashPassword(secret + ':' + b.pin), label, now, now, now + DEVICE_MS).run();
      await clear(db, `pw:${user.id}`);
      return json({ ok: true }, 200, { 'Set-Cookie': setDeviceCookie(secure, secret, DEVICE_MS / 1000) });
    }
    if (path === '/api/pin/remove' && method === 'POST') { // 기본은 이 기기만, all이면 내 모든 기기
      const b = await body(request);
      if (b.all) { await dropDevices(db, user.id); return json({ ok: true }, 200, { 'Set-Cookie': setDeviceCookie(secure, '', 0) }); }
      const mine = await currentDevice(db, request, secure, now); if (mine && mine.user_id === user.id) await db.prepare('DELETE FROM devices WHERE id=?').bind(mine.id).run();
      return json({ ok: true }, 200, { 'Set-Cookie': setDeviceCookie(secure, '', 0) });
    }
    // ---- 커뮤니티(게시판): 로그인한 계정끼리 글·댓글·좋아요 ----
    if (path.startsWith('/api/community')) { const res = await handleCommunity({ db, env, user, request, path, method, now, body, json, HttpError, limited, fail }); if (res) return res; throw new HttpError(404, '찾을 수 없습니다.'); }

    // ---- 저장 이력: 목록 · 한 건 내려받기 · 되돌리기 (항상 '내' 이력만: user_id는 세션에서만 얻는다) ----
    if (path === '/api/history' && method === 'GET') {
      await ensureHistory(db);
      const rows = (await db.prepare('SELECT id, version, bytes, people, att, created_at FROM state_history WHERE user_id=? ORDER BY id DESC LIMIT ?').bind(user.id, HISTORY_KEEP).all()).results;
      return json({ ok: true, keep: HISTORY_KEEP, items: rows.map(r => ({ id: r.id, version: r.version, bytes: r.bytes, people: r.people, att: r.att, at: r.created_at })) });
    }
    const hm = HISTORY_ID.exec(path);
    if (hm && method === 'GET') {
      await ensureHistory(db); const row = await db.prepare('SELECT state, created_at FROM state_history WHERE id=? AND user_id=?').bind(Number(hm[1]), user.id).first();
      if (!row) throw new HttpError(404, '저장본을 찾을 수 없습니다.'); return json({ ok: true, at: row.created_at, state: row.state });
    }
    if (path === '/api/history/restore' && method === 'POST') {
      const b = await body(request); const id = Number(b.id); if (!Number.isSafeInteger(id) || id < 1) throw new HttpError(400, '저장본을 골라 주세요.');
      await ensureHistory(db); const row = await db.prepare('SELECT state FROM state_history WHERE id=? AND user_id=?').bind(id, user.id).first();
      if (!row) throw new HttpError(404, '저장본을 찾을 수 없습니다.');
      let parsed; try { parsed = JSON.parse(row.state); validateState(parsed); } catch { throw new HttpError(422, '이 저장본은 지금 버전에서 열 수 없어요. 내려받아서 확인하세요.'); }
      if (!(await db.prepare('SELECT 1 x FROM user_state WHERE user_id=?').bind(user.id).first())) throw new HttpError(404, '저장된 데이터가 없습니다.');
      await snapshot(db, user.id, now); // 되돌리기 직전 상태도 이력에 남겨 다시 되돌릴 수 있게
      await db.prepare('UPDATE user_state SET version=version+1, state=?, updated_at=? WHERE user_id=?').bind(row.state, now, user.id).run();
      const v = await db.prepare('SELECT version FROM user_state WHERE user_id=?').bind(user.id).first(); return json({ ok: true, version: v.version });
    }
    if (path === '/api/state' && method === 'GET') { // 항상 '내' 줄만 조회: user_id는 세션에서만 얻는다
      const r = await db.prepare('SELECT version, state FROM user_state WHERE user_id=?').bind(user.id).first();
      return json({ ok: true, version: r ? r.version : 0, state: r ? r.state : null });
    }
    if (path === '/api/state' && method === 'PUT') {
      const b = await body(request, MAX_STATE + 2000); if (typeof b.state !== 'string') throw new HttpError(400, '저장할 데이터가 없습니다.');
      if (enc.encode(b.state).length > MAX_STATE) throw new HttpError(413, '데이터가 너무 커서 저장할 수 없습니다. 오래된 기록을 내보낸 뒤 정리하세요.');
      let parsed; try { parsed = JSON.parse(b.state); } catch { throw new HttpError(422, '데이터 형식이 올바르지 않습니다.'); }
      try { validateState(parsed); } catch (e) { throw new HttpError(422, e.message); }
      const cur = await db.prepare('SELECT version FROM user_state WHERE user_id=?').bind(user.id).first();
      const base = Number(b.baseVersion || 0);
      if (!cur) { const r = await db.prepare('INSERT INTO user_state(user_id,version,state,updated_at) VALUES(?,1,?,?) ON CONFLICT(user_id) DO NOTHING').bind(user.id, b.state, now).run(); if (r.meta.changes === 1) return json({ ok: true, version: 1 }); }
      const latest = await db.prepare('SELECT version FROM user_state WHERE user_id=?').bind(user.id).first();
      if (!b.force && latest.version !== base) throw new HttpError(409, '다른 기기에서 먼저 저장했습니다.', { version: latest.version });
      await snapshotIfNeeded(db, user.id, now, { force: b.force === true || b.snap === true, newLen: b.state.length }); // 덮어쓰기 직전 상태를 이력에 남긴다
      const r = await db.prepare('UPDATE user_state SET version=version+1, state=?, updated_at=? WHERE user_id=? AND version=?').bind(b.state, now, user.id, latest.version).run();
      if (r.meta.changes !== 1) throw new HttpError(409, '다른 기기에서 먼저 저장했습니다.', { version: latest.version });
      return json({ ok: true, version: latest.version + 1 });
    }
    if (path === '/api/password' && method === 'POST') {
      const b = await body(request); pwCheck(b.next, user.email); const u = await db.prepare('SELECT pw_hash FROM users WHERE id=?').bind(user.id).first();
      if (await limited(db, `pw:${user.id}`, 8, now)) throw new HttpError(429, '시도가 너무 많습니다. 잠시 후 다시 해 주세요.');
      if (!(await verifyPassword(String(b.current || ''), u.pw_hash))) { await fail(db, `pw:${user.id}`, now); throw new HttpError(401, '현재 비밀번호가 맞지 않습니다.'); }
      await db.prepare('UPDATE users SET pw_hash=? WHERE id=?').bind(await hashPassword(b.next), user.id).run();
      const keep = await sha256Hex(readCookie(request, cookieName(secure)) || ''); await db.prepare('DELETE FROM sessions WHERE user_id=? AND token_hash<>?').bind(user.id, keep).run(); // 다른 기기는 로그아웃
      const mine = await currentDevice(db, request, secure, now); await dropDevices(db, user.id, mine && mine.user_id === user.id ? mine.id : ''); // 다른 기기의 간편 로그인도 해제
      return json({ ok: true });
    }
    if (path === '/api/delete-account' && method === 'POST') {
      const b = await body(request); const u = await db.prepare('SELECT pw_hash FROM users WHERE id=?').bind(user.id).first();
      if (await limited(db, `pw:${user.id}`, 8, now)) throw new HttpError(429, '시도가 너무 많습니다. 잠시 후 다시 해 주세요.');
      if (!(await verifyPassword(String(b.password || ''), u.pw_hash))) { await fail(db, `pw:${user.id}`, now); throw new HttpError(401, '비밀번호가 맞지 않습니다.'); }
      await ensureReceipts(db); await db.prepare('DELETE FROM receipts WHERE user_id=?').bind(user.id).run(); await dropDevices(db, user.id); await ensureHistory(db); await db.prepare('DELETE FROM state_history WHERE user_id=?').bind(user.id).run(); await communityPurge(db, user.id); await db.prepare('DELETE FROM user_state WHERE user_id=?').bind(user.id).run(); await db.prepare('DELETE FROM sessions WHERE user_id=?').bind(user.id).run(); await db.prepare('DELETE FROM users WHERE id=?').bind(user.id).run();
      return json({ ok: true }, 200, { 'Set-Cookie': setCookie(secure, '', 0) });
    }
    // ---- 영수증 사진 (항상 '내' 사진만: user_id는 세션에서만 얻는다) ----
    if (path === '/api/receipts' && method === 'POST') {
      await ensureReceipts(db);
      if (await limited(db, `rc:${user.id}`, 60, now)) throw new HttpError(429, '사진을 너무 많이 올렸어요. 1시간 뒤에 다시 해 주세요.');
      const b = await body(request, 600_000); const m = typeof b.data === 'string' ? b.data.match(/^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/) : null;
      if (!m) throw new HttpError(400, '사진 형식이 올바르지 않습니다(JPEG만 받을 수 있어요).');
      let bytes; try { bytes = unb64(m[1]); } catch { throw new HttpError(400, '사진 형식이 올바르지 않습니다.'); }
      if (bytes.length > MAX_RECEIPT_BYTES) throw new HttpError(413, '사진이 너무 커요. 더 작게 줄여서 올려 주세요.');
      if (bytes.length < 4 || bytes[0] !== 0xFF || bytes[1] !== 0xD8 || bytes[2] !== 0xFF) throw new HttpError(400, 'JPEG 사진이 아닙니다.');
      const used = await db.prepare('SELECT COUNT(*) c, COALESCE(SUM(size),0) s FROM receipts WHERE user_id=?').bind(user.id).first();
      if (used.c >= MAX_RECEIPTS || used.s + bytes.length > MAX_RECEIPT_TOTAL) throw new HttpError(413, '영수증 사진을 더 올릴 수 없어요(장수·용량 한도). 오래된 사진을 지워 주세요.');
      await fail(db, `rc:${user.id}`, now, 3600e3);
      const id = [...crypto.getRandomValues(new Uint8Array(16))].map(x => x.toString(16).padStart(2, '0')).join('');
      await db.prepare('INSERT INTO receipts(id,user_id,size,data,created_at) VALUES(?,?,?,?,?)').bind(id, user.id, bytes.length, m[1], now).run();
      return json({ ok: true, id }, 201);
    }
    const rm = path.match(RECEIPT_URL);
    if (rm && method === 'GET') {
      await ensureReceipts(db); const r = await db.prepare('SELECT data FROM receipts WHERE id=? AND user_id=?').bind(rm[1], user.id).first();
      if (!r) throw new HttpError(404, '사진을 찾을 수 없습니다.');
      return new Response(unb64(r.data), { status: 200, headers: { 'Content-Type': 'image/jpeg', ...SEC_HEADERS, 'Cache-Control': 'private, no-store', 'Content-Security-Policy': "default-src 'none'; sandbox" } });
    }
    if (rm && method === 'DELETE') {
      await ensureReceipts(db); const r = await db.prepare('DELETE FROM receipts WHERE id=? AND user_id=?').bind(rm[1], user.id).run();
      if (!r.meta.changes) throw new HttpError(404, '사진을 찾을 수 없습니다.');
      return json({ ok: true });
    }
    // ---- AI 이미지 만들기 (로그인 필요 · 하루 한도 · 서버에 저장하지 않음) ----
    if (path === '/api/image/status' && method === 'GET') {
      const cfg = imageConfig(env); const k = rateKeys(user.id); const r = await db.prepare('SELECT n, reset_at FROM rate WHERE key=?').bind(k.user).first(); const used = r && r.reset_at > now ? r.n : 0;
      return json({ ok: true, enabled: !!env.OPENAI_API_KEY, allowed: emailAllowed(cfg, user.email), limit: cfg.limit, left: Math.max(0, cfg.limit - used), kinds: Object.fromEntries(Object.entries(IMAGE_KINDS).map(([a, v]) => [a, { label: v.label, size: v.size }])) });
    }
    if (path === '/api/image/generate' && method === 'POST') {
      if (!env.OPENAI_API_KEY) throw new HttpError(503, '이미지 만들기가 아직 켜져 있지 않아요. 관리자가 OPENAI_API_KEY를 설정해야 해요.');
      const cfg = imageConfig(env); if (!emailAllowed(cfg, user.email)) throw new HttpError(403, '이 계정은 이미지 만들기를 쓸 수 없어요(관리자가 허용한 계정만 가능).');
      const b = await body(request, 2000);
      const prompt = typeof b.prompt === 'string' ? b.prompt.trim() : ''; if (prompt.length < PROMPT_MIN || prompt.length > PROMPT_MAX) throw new HttpError(400, `설명은 ${PROMPT_MIN}자 이상 ${PROMPT_MAX}자 이하로 적어 주세요.`);
      const kind = IMAGE_KINDS[b.kind] ? b.kind : 'free'; const size = IMAGE_KINDS[kind].size || (IMAGE_SIZES.includes(b.size) ? b.size : '1024x1024'); const quality = IMAGE_QUALITIES.includes(b.quality) ? b.quality : 'medium';
      const k = rateKeys(user.id);
      if (await limited(db, k.user, cfg.limit, now)) throw new HttpError(429, `오늘 만들 수 있는 이미지(${cfg.limit}장)를 모두 썼어요. 내일 다시 해 주세요.`);
      if (await limited(db, k.all, cfg.total, now)) throw new HttpError(429, '오늘 이 사이트에서 만들 수 있는 이미지 수를 모두 썼어요. 내일 다시 해 주세요.');
      await fail(db, k.user, now, DAY_MS); await fail(db, k.all, now, DAY_MS); // 호출하기 전에 센다(실패해도 한도에 포함 → 비용 폭주 방지)
      const safetyId = (await sha256Hex(`mb-user:${user.id}`)).slice(0, 32); // 사용자 식별 정보 대신 해시만 보낸다
      let out; try { out = await callOpenAI({ env, cfg, prompt, size, quality, safetyId, fetchFn: env.OPENAI_FETCH || fetch }); } catch (e) { throw new HttpError(e.status || 502, e.message); }
      const r = await db.prepare('SELECT n FROM rate WHERE key=?').bind(k.user).first();
      return json({ ok: true, image: out.image, mime: out.mime, kind, size, left: Math.max(0, cfg.limit - ((r && r.n) || 0)) });
    }
    throw new HttpError(404, '찾을 수 없습니다.');
  } catch (e) {
    if (e instanceof HttpError) return json({ ok: false, error: e.message, ...e.extra }, e.status);
    return json({ ok: false, error: '서버 오류가 발생했습니다.' }, 500); // 내부 오류 내용은 응답에 싣지 않는다
  }
}
