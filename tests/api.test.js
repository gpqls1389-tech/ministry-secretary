import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { handle, hashPassword, verifyPassword } from '../functions/_lib/handler.js';
import { createStore } from '../public/js/store.js';

// D1과 같은 인터페이스를 실제 SQLite(node:sqlite)로 구현 → 마이그레이션 SQL과 쿼리를 그대로 검증
export function fakeD1() {
  const db = new DatabaseSync(':memory:'); db.exec('PRAGMA foreign_keys=ON'); db.exec(fs.readFileSync(new URL('../migrations/0001_init.sql', import.meta.url), 'utf8'));
  return { raw: db, prepare: sql => { const st = db.prepare(sql); return { bind: (...a) => ({ first: async () => st.get(...a) || null, all: async () => ({ results: st.all(...a) }), run: async () => ({ success: true, meta: { changes: Number(st.run(...a).changes) } }) }) }; } };
}
const mem = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; };
const stateJson = () => { const s = createStore(mem(), () => '2026-11-10'); s.startEmpty(); s.addPerson({ name: '가', dept_id: 1 }); return s.exportJson(); };
const BASE = 'https://site.test';
async function call(env, method, path, { body, cookie, origin = BASE, ip = '1.1.1.1', ctype = 'application/json', now } = {}) {
  const headers = { 'CF-Connecting-IP': ip }; if (cookie) headers.Cookie = cookie; if (origin) headers.Origin = origin; if (body !== undefined && ctype) headers['Content-Type'] = ctype;
  const res = await handle(new Request(BASE + path, { method, headers, body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)) }), env, now);
  const sc = res.headers.get('Set-Cookie'); return { status: res.status, json: await res.json(), setCookie: sc, cookie: sc ? sc.split(';')[0] : null, res };
}
const envOf = (extra = {}) => ({ DB: fakeD1(), INVITE_CODE: 'invite-xyz', ...extra });
const PW = 'correct-horse-9';
async function signup(env, email = 'a@church.kr', ip) { const r = await call(env, 'POST', '/api/register', { body: { email, name: '관리자', password: PW, invite: 'invite-xyz' }, ip }); assert.equal(r.status, 201, JSON.stringify(r.json)); return r.cookie; }

test('서버 설정 전(D1 없음): /api/me는 configured:false, 나머지는 503', async () => {
  const r = await call({}, 'GET', '/api/me'); assert.equal(r.status, 200); assert.equal(r.json.configured, false); assert.equal(r.json.user, null);
  assert.equal((await call({}, 'GET', '/api/state')).status, 503);
});

test('비밀번호 해시: 원문 저장 없음, 검증 성공/실패', async () => {
  const h = await hashPassword('abc-123-long-pw'); assert.ok(h.startsWith('pbkdf2-sha256$100000$')); assert.ok(!h.includes('abc-123'));
  assert.ok(await verifyPassword('abc-123-long-pw', h)); assert.ok(!(await verifyPassword('abc-123-long-px', h)));
  assert.notEqual(h, await hashPassword('abc-123-long-pw')); // 소금(salt)이 달라 매번 다름
});

test('가입: 초대 코드 필수, 설정 안 했으면 가입 닫힘, 입력 검증, 중복 방지, 쿠키 속성', async () => {
  const closed = { DB: fakeD1() }; assert.equal((await call(closed, 'POST', '/api/register', { body: { email: 'a@b.kr', password: PW, invite: 'x' } })).status, 403);
  const env = envOf();
  assert.equal((await call(env, 'POST', '/api/register', { body: { email: 'a@b.kr', password: PW, invite: 'wrong' } })).status, 403);
  assert.equal((await call(env, 'POST', '/api/register', { body: { email: 'not-an-email', password: PW, invite: 'invite-xyz' } })).status, 400);
  assert.equal((await call(env, 'POST', '/api/register', { body: { email: 'a@b.kr', password: 'short', invite: 'invite-xyz' } })).status, 400);
  const ok = await call(env, 'POST', '/api/register', { body: { email: 'A@B.kr', name: '홍', password: PW, invite: 'invite-xyz' } });
  assert.equal(ok.status, 201); for (const a of ['HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/', '__Host-ms_session']) assert.ok(ok.setCookie.includes(a), a);
  assert.equal((await call(env, 'POST', '/api/register', { body: { email: 'a@b.kr', password: PW, invite: 'invite-xyz' } })).status, 409); // 이메일은 대소문자 무시
  const row = env.DB.raw.prepare('SELECT * FROM users').get(); assert.equal(row.email, 'a@b.kr'); assert.ok(!JSON.stringify(row).includes(PW));
  const sess = env.DB.raw.prepare('SELECT token_hash FROM sessions').get(); assert.ok(!ok.cookie.includes(sess.token_hash) && sess.token_hash.length === 64); // 토큰 원문이 아닌 해시만 저장
});

test('로그인: 성공/실패, 같은 오류 메시지, 시도 횟수 제한(다른 계정은 영향 없음)', async () => {
  const env = envOf(); await signup(env, 'a@church.kr'); await signup(env, 'b@church.kr', '2.2.2.2');
  const bad1 = await call(env, 'POST', '/api/login', { body: { email: 'a@church.kr', password: 'wrong-wrong-1' } }); const bad2 = await call(env, 'POST', '/api/login', { body: { email: 'nobody@church.kr', password: 'wrong-wrong-1' } });
  assert.equal(bad1.status, 401); assert.equal(bad1.json.error, bad2.json.error); // 계정 존재 여부를 알려 주지 않음
  const ok = await call(env, 'POST', '/api/login', { body: { email: 'a@church.kr', password: PW } }); assert.equal(ok.status, 200); assert.ok(ok.cookie);
  for (let i = 0; i < 8; i++) await call(env, 'POST', '/api/login', { body: { email: 'a@church.kr', password: 'wrong-wrong-1' }, ip: '9.9.9.9' });
  const locked = await call(env, 'POST', '/api/login', { body: { email: 'a@church.kr', password: PW }, ip: '8.8.8.8' }); assert.equal(locked.status, 429); // 올바른 비밀번호여도 잠김
  assert.equal((await call(env, 'POST', '/api/login', { body: { email: 'b@church.kr', password: PW }, ip: '3.3.3.3' })).status, 200);
  const later = Date.now() + 16 * 60e3; assert.equal((await call(env, 'POST', '/api/login', { body: { email: 'a@church.kr', password: PW }, ip: '8.8.8.8', now: later })).status, 200); // 15분 뒤 해제
});

test('사용자별 분리: 각자 자기 데이터만 보고 저장, 다른 사람 것은 접근 불가', async () => {
  const env = envOf(); const a = await signup(env, 'a@church.kr'); const b = await signup(env, 'b@church.kr', '2.2.2.2');
  assert.equal((await call(env, 'GET', '/api/state')).status, 401); assert.equal((await call(env, 'GET', '/api/state', { cookie: '__Host-ms_session=forged' })).status, 401);
  assert.deepEqual((await call(env, 'GET', '/api/state', { cookie: a })).json, { ok: true, version: 0, state: null });
  const sa = stateJson(); const put = await call(env, 'PUT', '/api/state', { cookie: a, body: { baseVersion: 0, state: sa } }); assert.equal(put.status, 200); assert.equal(put.json.version, 1);
  const gb = await call(env, 'GET', '/api/state', { cookie: b }); assert.equal(gb.json.state, null); assert.equal(gb.json.version, 0); // B에게는 A의 데이터가 보이지 않음
  const sb = JSON.parse(stateJson()); sb.people[0].name = 'B의 사람'; await call(env, 'PUT', '/api/state', { cookie: b, body: { baseVersion: 0, state: JSON.stringify(sb) } });
  assert.equal(JSON.parse((await call(env, 'GET', '/api/state', { cookie: a })).json.state).people[0].name, '가'); assert.equal(JSON.parse((await call(env, 'GET', '/api/state', { cookie: b })).json.state).people[0].name, 'B의 사람');
  assert.equal(env.DB.raw.prepare('SELECT COUNT(*) c FROM user_state').get().c, 2);
  const withUid = await call(env, 'PUT', '/api/state', { cookie: a, body: { baseVersion: 1, state: sa, user_id: 'someone-else' } }); assert.equal(withUid.status, 200); assert.equal(env.DB.raw.prepare('SELECT COUNT(*) c FROM user_state').get().c, 2); // 요청에 user_id를 넣어도 무시
});

test('저장 충돌·검증: 오래된 버전은 409, force는 덮어쓰기, 손상·초과 데이터 거부', async () => {
  const env = envOf(); const a = await signup(env); const s = stateJson();
  assert.equal((await call(env, 'PUT', '/api/state', { cookie: a, body: { baseVersion: 0, state: s } })).json.version, 1);
  const stale = await call(env, 'PUT', '/api/state', { cookie: a, body: { baseVersion: 0, state: s } }); assert.equal(stale.status, 409); assert.equal(stale.json.version, 1);
  assert.equal((await call(env, 'PUT', '/api/state', { cookie: a, body: { baseVersion: 1, state: s } })).json.version, 2);
  assert.equal((await call(env, 'PUT', '/api/state', { cookie: a, body: { baseVersion: 1, state: s, force: true } })).json.version, 3);
  assert.equal((await call(env, 'PUT', '/api/state', { cookie: a, body: { baseVersion: 3, state: '{"version":1}' } })).status, 422);
  assert.equal((await call(env, 'PUT', '/api/state', { cookie: a, body: { baseVersion: 3, state: 'not json' } })).status, 422);
  assert.equal((await call(env, 'PUT', '/api/state', { cookie: a, body: { baseVersion: 3, state: 'x'.repeat(1_600_000) } })).status, 413);
  assert.equal((await call(env, 'GET', '/api/state', { cookie: a })).json.version, 3); // 거부된 요청은 저장된 데이터를 바꾸지 않음
});

test('CSRF·형식: 다른 출처/비 JSON 요청 거부, 내부 오류 내용 비노출', async () => {
  const env = envOf(); const a = await signup(env);
  assert.equal((await call(env, 'POST', '/api/logout', { cookie: a, origin: 'https://evil.test', body: {} })).status, 403);
  assert.equal((await call(env, 'POST', '/api/logout', { cookie: a, body: 'x=1', ctype: 'application/x-www-form-urlencoded' })).status, 415);
  assert.equal((await call(env, 'POST', '/api/login', { body: '{broken' })).status, 400);
  const r = await call(env, 'GET', '/api/me', { cookie: a }); assert.equal(r.res.headers.get('Cache-Control'), 'no-store');
  const broken = { DB: { prepare: () => { throw new Error('SECRET-INTERNAL'); } } }; const e = await call(broken, 'GET', '/api/state', { cookie: '__Host-ms_session=abc' }); assert.equal(e.status, 500); assert.ok(!JSON.stringify(e.json).includes('SECRET'));
});

test('로그아웃·세션 만료·비밀번호 변경·계정 삭제', async () => {
  const env = envOf(); const a = await signup(env, 'a@church.kr'); const second = (await call(env, 'POST', '/api/login', { body: { email: 'a@church.kr', password: PW } })).cookie;
  assert.equal((await call(env, 'GET', '/api/me', { cookie: a })).json.user.email, 'a@church.kr');
  const far = Date.now() + 31 * 24 * 3600e3; assert.equal((await call(env, 'GET', '/api/me', { cookie: a, now: far })).json.user, null); // 30일 뒤 만료
  await call(env, 'POST', '/api/logout', { cookie: second, body: {} }); assert.equal((await call(env, 'GET', '/api/state', { cookie: second })).status, 401);
  assert.equal((await call(env, 'POST', '/api/password', { cookie: a, body: { current: 'bad-password-1', next: 'brand-new-pass-1' } })).status, 401);
  assert.equal((await call(env, 'POST', '/api/password', { cookie: a, body: { current: PW, next: 'short' } })).status, 400);
  const third = (await call(env, 'POST', '/api/login', { body: { email: 'a@church.kr', password: PW } })).cookie;
  assert.equal((await call(env, 'POST', '/api/password', { cookie: a, body: { current: PW, next: 'brand-new-pass-1' } })).status, 200);
  assert.equal((await call(env, 'GET', '/api/me', { cookie: third })).json.user, null); assert.equal((await call(env, 'GET', '/api/me', { cookie: a })).json.user.email, 'a@church.kr'); // 다른 기기는 로그아웃, 현재 기기는 유지
  assert.equal((await call(env, 'POST', '/api/login', { body: { email: 'a@church.kr', password: PW } })).status, 401); assert.equal((await call(env, 'POST', '/api/login', { body: { email: 'a@church.kr', password: 'brand-new-pass-1' } })).status, 200);
  await call(env, 'PUT', '/api/state', { cookie: a, body: { baseVersion: 0, state: stateJson() } });
  assert.equal((await call(env, 'POST', '/api/delete-account', { cookie: a, body: { password: 'wrong-wrong-1' } })).status, 401);
  assert.equal((await call(env, 'POST', '/api/delete-account', { cookie: a, body: { password: 'brand-new-pass-1' } })).status, 200);
  for (const t of ['users', 'sessions', 'user_state']) assert.equal(env.DB.raw.prepare(`SELECT COUNT(*) c FROM ${t}`).get().c, 0, t); // 데이터가 모두 삭제됨
  assert.equal((await call(env, 'POST', '/api/login', { body: { email: 'a@church.kr', password: 'brand-new-pass-1' } })).status, 401);
});

test('http 로컬 개발: Secure 없는 쿠키 이름 사용', async () => {
  const env = envOf(); const res = await handle(new Request('http://localhost:8788/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:8788' }, body: JSON.stringify({ email: 'a@b.kr', password: PW, invite: 'invite-xyz' }) }), env);
  const c = res.headers.get('Set-Cookie'); assert.ok(c.startsWith('ms_session=') && !c.includes('Secure') && c.includes('HttpOnly'));
});
