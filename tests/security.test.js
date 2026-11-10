// 보안 점검 테스트: 로그아웃 상태, 다른 계정, 권한 상승, 무차별 대입, 주입 공격, 헤더. (가상 데이터·테스트용 값만 사용)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { handle } from '../functions/_lib/handler.js';
import { createStore } from '../public/js/store.js';

function fakeD1() {
  const db = new DatabaseSync(':memory:'); db.exec('PRAGMA foreign_keys=ON'); db.exec(fs.readFileSync(new URL('../migrations/0001_init.sql', import.meta.url), 'utf8'));
  return { raw: db, prepare: sql => { const st = db.prepare(sql); return { bind: (...a) => ({ first: async () => st.get(...a) || null, all: async () => ({ results: st.all(...a) }), run: async () => ({ success: true, meta: { changes: Number(st.run(...a).changes) } }) }) }; } };
}
const mem = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; };
const mkState = (name = '가') => { const s = createStore(mem(), () => '2026-11-10'); s.startEmpty(); s.addPerson({ name, dept_id: 1 }); return s.exportJson(); };
const BASE = 'https://site.test'; const INVITE = 'secret-invite-code-2026'; const PW = 'correct-horse-9';
async function call(env, method, path, { body, cookie, headers = {}, ip = '1.1.1.1', now } = {}) {
  const h = { 'CF-Connecting-IP': ip, Origin: BASE, ...headers }; if (cookie) h.Cookie = cookie; if (body !== undefined) h['Content-Type'] = h['Content-Type'] || 'application/json';
  const res = await handle(new Request(BASE + path, { method, headers: h, body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)) }), env, now);
  const sc = res.headers.get('Set-Cookie'); const raw = await res.text(); return { status: res.status, json: JSON.parse(raw), cookie: sc ? sc.split(';')[0] : null, res, text: raw };
}
const newEnv = (extra = {}) => ({ DB: fakeD1(), INVITE_CODE: INVITE, ...extra });
async function signup(env, email, ip = '1.1.1.1') { const r = await call(env, 'POST', '/api/register', { body: { email, password: PW, invite: INVITE }, ip }); assert.equal(r.status, 201, JSON.stringify(r.json)); return r.cookie; }

test('[로그아웃 상태] 보호된 모든 기능은 401이고 아무 데이터도 반환·변경되지 않는다', async () => {
  const env = newEnv(); const a = await signup(env, 'a@church.kr'); await call(env, 'PUT', '/api/state', { cookie: a, body: { baseVersion: 0, state: mkState('비공개 아동') } });
  const probes = [['GET', '/api/state'], ['PUT', '/api/state', { baseVersion: 1, state: mkState('해킹') }], ['POST', '/api/password', { current: 'x', next: 'y-long-password-1' }], ['POST', '/api/delete-account', { password: PW }]];
  for (const [m, p, b] of probes) { const r = await call(env, m, p, { body: b }); assert.equal(r.status, 401, `${m} ${p}`); assert.ok(!r.text.includes('비공개 아동')); }
  assert.equal(env.DB.raw.prepare('SELECT COUNT(*) c FROM users').get().c, 1); // 삭제·변경 없음
  assert.ok(JSON.parse((await call(env, 'GET', '/api/state', { cookie: a })).json.state).people.some(p => p.name === '비공개 아동')); // 정상 사용자 데이터는 그대로
});

test('[다른 계정] A의 데이터를 B가 읽기·덮어쓰기·삭제할 수 없다 (토큰 변조·재사용 포함)', async () => {
  const env = newEnv(); const a = await signup(env, 'a@church.kr'); const b = await signup(env, 'b@church.kr', '2.2.2.2');
  await call(env, 'PUT', '/api/state', { cookie: a, body: { baseVersion: 0, state: mkState('A만의 아동') } });
  const gb = await call(env, 'GET', '/api/state', { cookie: b }); assert.equal(gb.json.state, null); assert.ok(!gb.text.includes('A만의'));
  await call(env, 'PUT', '/api/state', { cookie: b, body: { baseVersion: 0, state: mkState('B의 아동'), user_id: 'whatever', userId: 'whatever' } });
  const rowsBefore = env.DB.raw.prepare('SELECT user_id, version FROM user_state ORDER BY user_id').all(); assert.equal(rowsBefore.length, 2);
  assert.equal(JSON.parse((await call(env, 'GET', '/api/state', { cookie: a })).json.state).people[0].name, 'A만의 아동');
  const flipped = a.slice(0, -1) + (a.endsWith('A') ? 'B' : 'A'); assert.equal((await call(env, 'GET', '/api/state', { cookie: flipped })).status, 401); // 토큰 한 글자 변조
  assert.equal((await call(env, 'GET', '/api/state', { cookie: a.replace('__Host-ms_session', 'ms_session') })).status, 401); // 이름이 다른 쿠키는 무시
  assert.equal((await call(env, 'POST', '/api/delete-account', { cookie: b, body: { password: 'not-the-password-1' } })).status, 401);
  await call(env, 'POST', '/api/logout', { cookie: a, body: {} }); assert.equal((await call(env, 'GET', '/api/state', { cookie: a })).status, 401); // 로그아웃한 토큰 재사용 불가
  assert.equal(JSON.parse((await call(env, 'GET', '/api/state', { cookie: b })).json.state).people[0].name, 'B의 아동'); // B 데이터 무사
  const bUser = env.DB.raw.prepare("SELECT id FROM users WHERE email='b@church.kr'").get().id; await call(env, 'POST', '/api/delete-account', { cookie: b, body: { password: PW } });
  assert.equal(env.DB.raw.prepare('SELECT COUNT(*) c FROM user_state WHERE user_id=?').get(bUser).c, 0); assert.equal((await call(env, 'GET', '/api/state', { cookie: b })).status, 401); // 삭제 뒤 세션도 무효
});

test('[권한] 관리자 권한은 존재하지 않는다: 가입 시 role/is_admin 같은 값은 무시되고 관리용 경로도 없다', async () => {
  const env = newEnv(); const r = await call(env, 'POST', '/api/register', { body: { email: 'x@church.kr', password: PW, invite: INVITE, role: 'admin', is_admin: true, admin: 1, id: 'fixed-id' } });
  assert.equal(r.status, 201); const cols = env.DB.raw.prepare('PRAGMA table_info(users)').all().map(c => c.name); assert.deepEqual(cols.sort(), ['created_at', 'email', 'id', 'name', 'pw_hash']);
  assert.notEqual(env.DB.raw.prepare('SELECT id FROM users').get().id, 'fixed-id');
  for (const p of ['/api/admin', '/api/users', '/api/admin/users', '/api/debug', '/api/export']) assert.equal((await call(env, 'GET', p, { cookie: r.cookie })).status, 404, p);
  for (const m of ['DELETE', 'PATCH']) assert.ok([404, 415].includes((await call(env, m, '/api/state', { cookie: r.cookie, body: {} })).status), m);
});

test('[가입 통제] 초대 코드 필수·12자 미만이면 닫힘·전체 무차별 대입 잠금·최대 인원 제한·약한 비밀번호 거부', async () => {
  assert.equal((await call({ DB: fakeD1() }, 'POST', '/api/register', { body: { email: 'a@b.kr', password: PW, invite: 'x' } })).status, 403); // 코드 미설정 → 닫힘
  const short = { DB: fakeD1(), INVITE_CODE: 'short-code' }; const rs = await call(short, 'POST', '/api/register', { body: { email: 'a@b.kr', password: PW, invite: 'short-code' } }); assert.equal(rs.status, 403); // 올바른 코드여도 짧으면 거부
  assert.equal((await call(short, 'GET', '/api/me')).json.signup, false);
  const env = newEnv({ MAX_USERS: '1' }); await signup(env, 'one@church.kr'); const two = await call(env, 'POST', '/api/register', { body: { email: 'two@church.kr', password: PW, invite: INVITE }, ip: '5.5.5.5' }); assert.equal(two.status, 403); assert.equal(env.DB.raw.prepare('SELECT COUNT(*) c FROM users').get().c, 1);
  const atk = newEnv(); for (let i = 0; i < 30; i++) await call(atk, 'POST', '/api/register', { body: { email: `z${i}@x.kr`, password: PW, invite: `guess-${i}-guess` }, ip: `9.9.${i}.1` }); // 서로 다른 주소 30곳에서 추측
  const locked = await call(atk, 'POST', '/api/register', { body: { email: 'real@church.kr', password: PW, invite: INVITE }, ip: '7.7.7.7' }); assert.equal(locked.status, 429); assert.equal(atk.DB.raw.prepare('SELECT COUNT(*) c FROM users').get().c, 0);
  const env2 = newEnv(); for (const pw of ['short', '1234567890', 'aaaaaaaaaaaa', 'password123', 'newuser-secret-9']) { const r = await call(env2, 'POST', '/api/register', { body: { email: 'newuser@church.kr', password: pw, invite: INVITE }, ip: `3.3.3.${Math.floor(Math.random() * 200)}` }); assert.equal(r.status, 400, pw); } // 이메일 일부를 포함한 비밀번호도 거부
});

test('[주입] SQL 주입 시도는 데이터를 건드리지 못하고 500도 만들지 않는다', async () => {
  const env = newEnv(); const a = await signup(env, 'victim@church.kr');
  const evil = ["' OR '1'='1", "victim@church.kr' --", "x'; DROP TABLE users; --@x.kr", 'a"b@x.kr'];
  for (const e of evil) { const r = await call(env, 'POST', '/api/login', { body: { email: e, password: "' OR '1'='1" }, ip: `4.4.4.${evil.indexOf(e)}` }); assert.ok([400, 401].includes(r.status), `${e} -> ${r.status}`); }
  const r2 = await call(env, 'POST', '/api/register', { body: { email: "a'--@x.co", password: PW, invite: INVITE }, ip: '6.6.6.6' }); assert.ok([201, 400].includes(r2.status));
  if (r2.status === 201) assert.equal(env.DB.raw.prepare("SELECT email FROM users WHERE email=?").get("a'--@x.co").email, "a'--@x.co"); // 문자 그대로 저장
  assert.equal(env.DB.raw.prepare("SELECT name FROM sqlite_master WHERE name='users'").get().name, 'users'); assert.equal(env.DB.raw.prepare("SELECT COUNT(*) c FROM users WHERE email='victim@church.kr'").get().c, 1);
  assert.equal((await call(env, 'GET', '/api/state', { cookie: a })).status, 200);
});

test('[응답] 비밀번호 해시·세션 토큰은 어떤 응답에도 나오지 않고, API 응답에 보안 헤더가 붙는다', async () => {
  const env = newEnv(); const a = await signup(env, 'a@church.kr'); await call(env, 'PUT', '/api/state', { cookie: a, body: { baseVersion: 0, state: mkState() } });
  const hash = env.DB.raw.prepare('SELECT pw_hash FROM users').get().pw_hash; const tokenHash = env.DB.raw.prepare('SELECT token_hash FROM sessions').get().token_hash; const token = a.split('=')[1];
  for (const [m, p, b] of [['GET', '/api/me'], ['GET', '/api/state'], ['POST', '/api/login', { email: 'a@church.kr', password: PW }]]) { const r = await call(env, m, p, { body: b, cookie: a }); assert.ok(!r.text.includes(hash) && !r.text.includes('pbkdf2') && !r.text.includes(tokenHash) && !r.text.includes(token), p); }
  const r = await call(env, 'GET', '/api/me', { cookie: a }); const h = r.res.headers;
  assert.equal(h.get('Cache-Control'), 'no-store'); assert.equal(h.get('X-Content-Type-Options'), 'nosniff'); assert.equal(h.get('X-Frame-Options'), 'DENY'); assert.equal(h.get('Cross-Origin-Resource-Policy'), 'same-origin'); assert.match(h.get('Content-Security-Policy'), /default-src 'none'/);
  const login = await handle(new Request(BASE + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: BASE, 'CF-Connecting-IP': '8.8.8.8' }, body: JSON.stringify({ email: 'a@church.kr', password: PW }) }), env);
  const sc = login.headers.get('Set-Cookie'); for (const f of ['HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/', '__Host-', 'Max-Age=1209600']) assert.ok(sc.includes(f), f); assert.ok(!sc.includes('Domain='));
});

test('[세션·요청] 14일 만료, 교차 사이트 요청과 비 JSON 요청 거부, 과대 요청 거부', async () => {
  const env = newEnv(); const a = await signup(env, 'a@church.kr');
  assert.equal((await call(env, 'GET', '/api/me', { cookie: a, now: Date.now() + 13 * 24 * 3600e3 })).json.user.email, 'a@church.kr'); assert.equal((await call(env, 'GET', '/api/me', { cookie: a, now: Date.now() + 15 * 24 * 3600e3 })).json.user, null);
  assert.equal((await call(env, 'POST', '/api/logout', { cookie: a, body: {}, headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 403); assert.equal((await call(env, 'POST', '/api/logout', { cookie: a, body: {}, headers: { 'Sec-Fetch-Site': 'same-site' } })).status, 403);
  assert.equal((await call(env, 'POST', '/api/logout', { cookie: a, body: {}, headers: { Origin: 'https://evil.test' } })).status, 403); assert.equal((await call(env, 'POST', '/api/logout', { cookie: a, body: 'x=1', headers: { 'Content-Type': 'text/plain' } })).status, 415);
  assert.equal((await call(env, 'GET', '/api/me', { cookie: a })).json.user.email, 'a@church.kr'); // 거부된 요청은 세션을 끊지 않음
  assert.equal((await call(env, 'POST', '/api/login', { body: 'x'.repeat(40000) })).status, 413);
});

test('[비밀번호] 변경 시 다른 기기 로그아웃, 잘못된 현재 비밀번호는 반복 시도 후 잠김', async () => {
  const env = newEnv(); const a = await signup(env, 'a@church.kr'); const other = (await call(env, 'POST', '/api/login', { body: { email: 'a@church.kr', password: PW }, ip: '2.2.2.2' })).cookie;
  for (let i = 0; i < 8; i++) assert.equal((await call(env, 'POST', '/api/password', { cookie: a, body: { current: 'wrong-wrong-1', next: 'brand-new-pass-77' } })).status, 401);
  assert.equal((await call(env, 'POST', '/api/password', { cookie: a, body: { current: PW, next: 'brand-new-pass-77' } })).status, 429); // 올바른 비밀번호여도 잠금 중
  assert.equal((await call(env, 'GET', '/api/me', { cookie: other })).json.user.email, 'a@church.kr');
});
