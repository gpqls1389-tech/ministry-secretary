// 새 기능 테스트: 교회력 자동 계산, 반복 입력, 일정(예배와 분리), 명단 일괄 등록, 영수증 사진(권한·검증). 가상 데이터만 사용.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { handle } from '../functions/_lib/handler.js';
import { createStore } from '../public/js/store.js';
import { churchInfo, churchLabel, churchYear, repeatDates } from '../public/js/templates.js';
import { parseTable } from '../public/js/csv.js';

const mem = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; };
const mk = () => { const s = createStore(mem(), () => '2026-11-10'); s.startEmpty(); return s; };

test('[교회력] 2026년 절기·주차가 자동으로 계산된다 (대림절 11/29 시작)', () => {
  const L = churchLabel;
  assert.equal(L('2026-11-29'), '대림절 제1주'); assert.equal(L('2026-12-06'), '대림절 제2주'); assert.equal(L('2026-12-20'), '대림절 제4주');
  assert.equal(L('2026-12-25'), '성탄절(성탄일)'); assert.equal(L('2026-12-27'), '성탄절 제2주'); assert.equal(L('2027-01-03'), '성탄절 제3주');
  assert.equal(L('2027-01-10'), '주현절 제1주');
  assert.equal(L('2026-02-22'), '사순절 제1주'); assert.equal(L('2026-03-29'), '종려주일(고난주간 시작)');
  assert.equal(L('2026-04-05'), '부활절(부활주일)'); assert.equal(L('2026-04-12'), '부활절 제2주');
  assert.equal(L('2026-05-24'), '성령강림절(성령강림주일)'); assert.equal(L('2026-05-31'), '성령강림 후 제1주 (삼위일체주일)');
  assert.equal(L('2026-11-22'), '왕이신 그리스도 주일'); assert.match(L('2026-05-03'), /어린이주일/); assert.match(L('2026-11-15'), /추수감사주일/);
  assert.equal(churchInfo('2026-11-29').color, '보라'); assert.equal(churchInfo('2026-12-25').color, '흰색');
  const yr = churchYear(2026); assert.equal(yr.find(x => x.name === '대림절').start, '2026-11-29'); assert.equal(yr.find(x => x.name === '사순절').start, '2026-02-18');
  for (let i = 0; i < 366; i++) { const d = new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10); assert.ok(churchLabel(d), d); } // 어떤 날짜도 비지 않는다
});

test('[반복] 매주·격주·매월(같은 날짜/같은 요일·주차) 날짜 계산, 상한과 없는 날짜 건너뛰기', () => {
  assert.deepEqual(repeatDates('2026-11-29', 'weekly', '2026-12-27'), ['2026-11-29', '2026-12-06', '2026-12-13', '2026-12-20', '2026-12-27']);
  assert.deepEqual(repeatDates('2026-11-29', 'biweekly', '2026-12-27'), ['2026-11-29', '2026-12-13', '2026-12-27']);
  assert.deepEqual(repeatDates('2026-11-10', 'monthly-nth', '2027-02-28'), ['2026-11-10', '2026-12-08', '2027-01-12', '2027-02-09']); // 매월 둘째 화요일
  assert.deepEqual(repeatDates('2026-01-31', 'monthly', '2026-06-30'), ['2026-01-31', '2026-03-31', '2026-05-31']); // 31일이 없는 달은 건너뜀
  assert.deepEqual(repeatDates('2026-11-29', 'none', '2027-12-31'), ['2026-11-29']);
  assert.equal(repeatDates('2026-01-04', 'weekly', '2030-12-31').length, 104); // 최대 104회
});

test('[예배·일정] 반복 예배를 한 번에 만들고, 중복은 건너뛰고, 묶음으로 지울 수 있다. 일정은 예배와 따로다', () => {
  const s = mk();
  const first = s.saveService({ dept_id: 1, title: '주일예배', date: '2026-11-29', repeat: 'weekly', until: '2026-12-27' });
  assert.equal(s.services(1).length, 5); assert.deepEqual(s.lastSeries(), { made: 5, skipped: 0, capped: false });
  assert.throws(() => s.saveService({ dept_id: 1, title: '주일예배', date: '2026-11-29', repeat: 'weekly', until: '2026-12-13' }), /이미 있어요/);
  s.saveService({ dept_id: 1, title: '주일예배', date: '2026-12-20', repeat: 'weekly', until: '2027-01-10' }); assert.equal(s.lastSeries().skipped, 2); assert.equal(s.services(1).length, 7);
  assert.throws(() => s.saveService({ dept_id: 1, title: 'x', date: '2026-11-29', repeat: 'weekly' }), /종료일/);
  assert.throws(() => s.saveService({ dept_id: 1, title: 'x', date: '2026-11-29', repeat: 'weekly', until: '2026-11-01' }), /앞서/);
  const p = s.addPerson({ name: '가', dept_id: 1 }); s.setAttendance(first, p, true);
  assert.equal(s.seriesCount('service', first), 5); assert.equal(s.deleteSeries('service', first), 5); assert.equal(s.get().attendance.length, 0); assert.equal(s.services(1).length, 2); // 이 날짜부터만 삭제
  const sc = s.saveSchedule({ dept_id: 1, title: '교사 기도회', type: '교사 기도회', date: '2026-12-02', repeat: 'weekly', until: '2026-12-30' });
  assert.equal(s.schedules(1).length, 5); assert.equal(s.services(1).length, 2); // 일정과 예배는 서로 섞이지 않는다
  assert.equal(s.calendar(1, '2026-12-01', '2026-12-31', { services: false }).filter(i => i.type === 'service').length, 0);
  assert.ok(s.calendar(1, '2027-01-01', '2027-01-31').some(i => i.type === 'service')); // 기본은 예배도 포함(홈 화면)
  assert.equal(s.schedule(sc).type, '교사 기도회'); s.deleteSchedule(sc); assert.equal(s.schedules(1).length, 4);
  assert.equal(s.saveSchedule({ dept_id: 1, title: 'x', type: '이상한값', date: '2026-12-02' }) > 0, true); assert.equal(s.schedules(1).find(v => v.title === 'x').type, '기타');
  const s2 = createStore(mem(), () => '2026-11-10'); s2.importJson(s.exportJson()); assert.equal(s2.schedules(1).length, 5); // 백업·복원에 일정 포함
  const old = JSON.parse(s.exportJson()); delete old.schedules; const s3 = createStore(mem(), () => '2026-11-10'); s3.importJson(JSON.stringify(old)); assert.equal(s3.schedules().length, 0); // 예전 백업도 읽힘
});

test('[CSV 읽기] 따옴표·쉼표·탭·BOM·빈 줄을 처리한다', () => {
  assert.deepEqual(parseTable('﻿이름,구분\r\n"가,나",아동\r\n\r\n다온,"청""년"\r\n'), [['이름', '구분'], ['가,나', '아동'], ['다온', '청"년']]);
  assert.deepEqual(parseTable('이름\t구분\n가\t아동\n'), [['이름', '구분'], ['가', '아동']]);
});

test('[명단 일괄 등록] 검사(미리보기) 후 한 번에 저장: 중복·오류 줄은 건너뛰고 이유를 알려 준다', () => {
  const s = mk(); s.addPerson({ name: '가온', kind: 'child', dept_id: 1, class_name: '해님반', birth_year: 2018 });
  const rows = [{ name: '가온', kind: '아동', dept: '아동부', class_name: '해님반', birth_year: '2018' }, { name: '나래', kind: '아동', dept: '', class_name: '달님반', birth_year: '2016' }, { name: '청년 A', kind: '청년', dept: '청년부', class_name: '1조', birth_year: '2001' }, { name: '', kind: '아동' }, { name: '다온', kind: '어른' }, { name: '라온', dept: '없는부서' }, { name: '마루', birth_year: '1800' }, { name: '나래', kind: '아동', dept: '', class_name: '달님반', birth_year: '2016' }];
  const before = s.get().people.length; const plan = s.planPeopleImport(rows, 1);
  assert.equal(s.get().people.length, before); // 검사만 할 때는 아무것도 저장되지 않는다
  assert.equal(plan.ok.length, 2); assert.equal(plan.dup.length, 2); assert.equal(plan.errors.length, 4);
  assert.deepEqual(plan.errors.map(e => e.line), [5, 6, 7, 8]); assert.ok(plan.errors.every(e => e.msg));
  assert.deepEqual(s.planPeopleImport([{ line: 9, name: '' }], 1).errors.map(e => e.line), [9]); // 파일의 실제 줄 번호를 알려 줌
  assert.equal(s.addPeopleBulk(plan.ok), 2); assert.equal(s.get().people.length, before + 2);
  assert.equal(s.people({ deptId: 2 })[0].kind, 'youth'); assert.equal(s.people({ deptId: 1 }).find(p => p.name === '나래').dept_id, 1);
  assert.throws(() => s.planPeopleImport(Array.from({ length: 501 }, (_, i) => ({ name: 'n' + i })), 1), /500명/);
});

// ---------- 영수증 사진 API ----------
function fakeD1() {
  const db = new DatabaseSync(':memory:'); db.exec('PRAGMA foreign_keys=ON'); db.exec(fs.readFileSync(new URL('../migrations/0001_init.sql', import.meta.url), 'utf8'));
  return { raw: db, prepare: sql => { const st = db.prepare(sql); return { bind: (...a) => ({ first: async () => st.get(...a) || null, all: async () => ({ results: st.all(...a) }), run: async () => ({ success: true, meta: { changes: Number(st.run(...a).changes) } }) }) }; } };
}
const BASE = 'https://site.test'; const INVITE = 'secret-invite-code-2026'; const PW = 'correct-horse-9';
async function call(env, method, path, { body, cookie, headers = {}, ip = '1.1.1.1', now, raw } = {}) {
  const h = { 'CF-Connecting-IP': ip, Origin: BASE, ...headers }; if (cookie) h.Cookie = cookie; if (body !== undefined) h['Content-Type'] = h['Content-Type'] || 'application/json';
  const res = await handle(new Request(BASE + path, { method, headers: h, body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)) }), env, now);
  const sc = res.headers.get('Set-Cookie'); if (raw) return { status: res.status, res, cookie: sc ? sc.split(';')[0] : null, bytes: new Uint8Array(await res.arrayBuffer()) };
  const text = await res.text(); let json = null; try { json = JSON.parse(text); } catch { /* 이미지 */ } return { status: res.status, json, text, res, cookie: sc ? sc.split(';')[0] : null };
}
const newEnv = () => ({ DB: fakeD1(), INVITE_CODE: INVITE });
async function signup(env, email, ip) { const r = await call(env, 'POST', '/api/register', { body: { email, password: PW, invite: INVITE }, ip }); assert.equal(r.status, 201, JSON.stringify(r.json)); return r.cookie; }
const jpegB64 = (n = 2000, magic = [0xFF, 0xD8, 0xFF, 0xE0]) => { const u = new Uint8Array(n); u.set(magic); for (let i = magic.length; i < n; i++) u[i] = (i * 7) % 256; return Buffer.from(u).toString('base64'); };
const dataUrl = (b64, mime = 'image/jpeg') => `data:${mime};base64,${b64}`;

test('[영수증 API] 올리기·보기·지우기는 내 계정 것만: 로그아웃·다른 계정·번호 추측은 모두 막힌다', async () => {
  const env = newEnv(); const a = await signup(env, 'a@church.kr', '1.1.1.1'); const b = await signup(env, 'b@church.kr', '2.2.2.2');
  assert.equal((await call(env, 'POST', '/api/receipts', { body: { data: dataUrl(jpegB64()) } })).status, 401); // 로그아웃 상태
  const up = await call(env, 'POST', '/api/receipts', { cookie: a, body: { data: dataUrl(jpegB64()) } }); assert.equal(up.status, 201); assert.match(up.json.id, /^[a-f0-9]{32}$/);
  assert.equal((await call(env, 'GET', `/api/receipts/${up.json.id}`)).status, 401);
  const mine = await call(env, 'GET', `/api/receipts/${up.json.id}`, { cookie: a, raw: true }); assert.equal(mine.status, 200); assert.equal(mine.res.headers.get('Content-Type'), 'image/jpeg');
  assert.deepEqual([...mine.bytes.slice(0, 4)], [0xFF, 0xD8, 0xFF, 0xE0]); assert.equal(mine.bytes.length, 2000);
  assert.equal(mine.res.headers.get('X-Content-Type-Options'), 'nosniff'); assert.equal(mine.res.headers.get('Cache-Control'), 'private, no-store'); assert.match(mine.res.headers.get('Content-Security-Policy'), /sandbox/); assert.equal(mine.res.headers.get('Cross-Origin-Resource-Policy'), 'same-origin');
  assert.equal((await call(env, 'GET', `/api/receipts/${up.json.id}`, { cookie: b })).status, 404); // 다른 계정은 못 봄
  assert.equal((await call(env, 'DELETE', `/api/receipts/${up.json.id}`, { cookie: b, body: {} })).status, 404); // 다른 계정은 못 지움
  assert.equal((await call(env, 'GET', `/api/receipts/${up.json.id}`, { cookie: a })).status, 200); // 그대로 남아 있음
  for (const bad of ['../x', '..%2Fapi%2Fstate', 'A'.repeat(32), up.json.id + 'x', '%00']) assert.ok([404].includes((await call(env, 'GET', `/api/receipts/${bad}`, { cookie: a })).status), bad); // 잘못된 번호
  assert.equal((await call(env, 'DELETE', `/api/receipts/${up.json.id}`, { cookie: a, body: {}, headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 403); // 다른 사이트에서 온 삭제 요청
  assert.equal((await call(env, 'DELETE', `/api/receipts/${up.json.id}`, { cookie: a, body: {} })).status, 200);
  assert.equal((await call(env, 'GET', `/api/receipts/${up.json.id}`, { cookie: a })).status, 404);
});

test('[영수증 API] JPEG만, 크기·장수·횟수 제한, 계정 삭제 시 사진도 함께 삭제', async () => {
  const env = newEnv(); const a = await signup(env, 'a@church.kr', '1.1.1.1');
  const post = data => call(env, 'POST', '/api/receipts', { cookie: a, body: { data } });
  assert.equal((await post(dataUrl(jpegB64(), 'image/png'))).status, 400); // PNG 거부
  assert.equal((await post(dataUrl(jpegB64(100, [0x89, 0x50, 0x4E, 0x47])))).status, 400); // 이름만 JPEG, 내용은 PNG
  assert.equal((await post('data:image/svg+xml;base64,' + Buffer.from('<svg onload="alert(1)"/>').toString('base64'))).status, 400); // SVG(스크립트) 거부
  assert.equal((await post('not-a-data-url')).status, 400); assert.equal((await post(undefined)).status, 400); assert.equal((await post(dataUrl('!!!'))).status, 400);
  assert.equal((await post(dataUrl(jpegB64(400_001)))).status, 413); // 한 장 400KB 초과
  assert.equal((await call(env, 'POST', '/api/receipts', { cookie: a, body: 'x'.repeat(2_000_000) })).status, 413); // 과대 요청
  assert.equal((await call(env, 'POST', '/api/receipts', { cookie: a, body: { data: dataUrl(jpegB64()) }, headers: { 'Content-Type': 'text/plain' } })).status, 415);
  const ok = await post(dataUrl(jpegB64(400_000))); assert.equal(ok.status, 201);
  const uid = env.DB.raw.prepare('SELECT id FROM users').get().id;
  env.DB.raw.prepare('DELETE FROM rate').run(); // 횟수 표 초기화
  for (let i = 0; i < 299; i++) env.DB.raw.prepare('INSERT INTO receipts(id,user_id,size,data,created_at) VALUES(?,?,?,?,?)').run(String(i).padStart(32, '0'), uid, 10, 'AAAA', 1);
  assert.equal((await post(dataUrl(jpegB64()))).status, 413); // 계정당 300장 한도
  env.DB.raw.prepare('DELETE FROM rate').run(); env.DB.raw.prepare('DELETE FROM receipts WHERE id<>?').run(ok.json.id);
  env.DB.raw.prepare('UPDATE receipts SET size=59999500').run(); assert.equal((await post(dataUrl(jpegB64()))).status, 413); // 계정당 60MB 한도
  env.DB.raw.prepare('UPDATE receipts SET size=1000').run();
  env.DB.raw.prepare('INSERT OR REPLACE INTO rate(key,n,reset_at) VALUES(?,?,?)').run(`rc:${uid}`, 60, Date.now() + 3600e3); assert.equal((await post(dataUrl(jpegB64()))).status, 429); // 1시간 60회 한도
  env.DB.raw.prepare('DELETE FROM rate').run();
  assert.equal((await call(env, 'POST', '/api/delete-account', { cookie: a, body: { password: PW } })).status, 200);
  assert.equal(env.DB.raw.prepare('SELECT COUNT(*) c FROM receipts').get().c, 0); // 계정과 함께 삭제
});

test('[영수증·상태] 거래의 영수증 번호는 안전한 문자만 허용하고, 서버 저장 검사도 같은 규칙을 쓴다', async () => {
  const s = mk(); const id = s.addTransaction({ dept_id: 1, date: '2026-11-10', kind: 'expense', amount: 5000, receipt: 'a'.repeat(32) }); assert.equal(s.get().transactions.find(t => t.id === id).receipt, 'a'.repeat(32));
  for (const bad of ['../etc', 'a b', '<img>', 'x'.repeat(65)]) assert.throws(() => s.addTransaction({ dept_id: 1, date: '2026-11-10', kind: 'expense', amount: 5000, receipt: bad }), /영수증/);
  const evil = JSON.parse(s.exportJson()); evil.transactions[0].receipt = '"><script>'; const env = newEnv(); const a = await signup(env, 'a@church.kr', '1.1.1.1');
  assert.equal((await call(env, 'PUT', '/api/state', { cookie: a, body: { baseVersion: 0, state: JSON.stringify(evil) } })).status, 422);
  evil.transactions[0].receipt = 'a'.repeat(32); assert.equal((await call(env, 'PUT', '/api/state', { cookie: a, body: { baseVersion: 0, state: JSON.stringify(evil) } })).status, 200);
});
