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


// ---------- 심방·일괄 이동·비품·월 결산·안내 문구 ----------
import { eventNotice, serviceNotice, weekNotice, fmtTimeKo, fmtDateKo } from '../public/js/templates.js';

test('[심방·돌봄] 기록 추가·수정·삭제, 마지막 심방·다음 연락 계산, 기록이 있는 사람은 삭제 불가', () => {
  const s = mk(); const p = s.addPerson({ name: '가', dept_id: 1 }); const q = s.addPerson({ name: '나', dept_id: 2 });
  const v = s.addVisit({ person_id: p, date: '2026-10-01', type: '전화', note: '안부 전화', follow_up: '2026-11-20' }); s.addVisit({ person_id: p, date: '2026-10-20', type: '이상한값', note: '문자' });
  assert.equal(s.visits({ personId: p })[0].type, '기타'); assert.equal(s.visits({ personId: p }).length, 2); assert.equal(s.visits({ deptId: 2 }).length, 0);
  const sum = s.visitSummary(1, '2026-11-10'); assert.equal(sum.length, 1); assert.equal(sum[0].last, '2026-10-20'); assert.equal(sum[0].days, 21); assert.equal(sum[0].next, '2026-11-20');
  assert.equal(s.visitSummary(2, '2026-11-10')[0].last, null); assert.equal(s.visitSummary(2, '2026-11-10')[0].days, null);
  assert.throws(() => s.addVisit({ person_id: 9999, date: '2026-10-01', note: 'x' }), /사람/); assert.throws(() => s.addVisit({ person_id: p, date: '2026-10-01', note: '  ' }), /내용/);
  assert.throws(() => s.addVisit({ person_id: p, date: '2026-10-01', note: 'a'.repeat(301) }), /300자/); assert.throws(() => s.addVisit({ person_id: p, date: '2026-13-01', note: 'x' }), /날짜/);
  s.addVisit({ id: v, person_id: p, date: '2026-10-02', type: '심방', note: '수정함' }); assert.equal(s.visit(v).note, '수정함');
  assert.throws(() => s.deletePerson(p), /심방/); s.deleteVisit(v); assert.equal(s.visits({ personId: p }).length, 1); assert.equal(s.deletePerson(q) === undefined, true);
  const s2 = createStore(mem(), () => '2026-11-10'); s2.importJson(s.exportJson()); assert.equal(s2.visits({ personId: p }).length, 1); // 백업·복원에 포함
});

test('[일괄 이동] 선택한 사람만 부서·반을 한 번에 바꾸고, 반을 비우면 그대로 둔다', () => {
  const s = mk(); const a = s.addPerson({ name: '가', dept_id: 1, class_name: '해님반' }), b = s.addPerson({ name: '나', dept_id: 1, class_name: '달님반' }), c = s.addPerson({ name: '다', dept_id: 1, class_name: '별님반' });
  assert.equal(s.movePeople([a, b], 2, '1조'), 2); assert.deepEqual([a, b, c].map(i => s.person(i).dept_id), [2, 2, 1]); assert.equal(s.person(a).class_name, '1조'); assert.equal(s.person(c).class_name, '별님반');
  assert.equal(s.movePeople([a], 1, ''), 1); assert.equal(s.person(a).class_name, '1조'); // 반 비움 → 그대로
  assert.throws(() => s.movePeople([a], 99, 'x'), /부서/); assert.throws(() => s.movePeople([], 1, 'x'), /선택/); assert.throws(() => s.movePeople([123456], 1, 'x'), /선택/);
  assert.equal(s.setPeopleStatus([a, b], 'graduated'), 2); assert.equal(s.people({ deptId: 2 }).length, 0); assert.throws(() => s.setPeopleStatus([a], 'weird'), /상태/);
});

test('[비품] 저장·수정·수리 내역·삭제와 입력 검사', () => {
  const s = mk(); const id = s.saveAsset({ dept_id: 1, name: '스피커', category: '악기·음향', place: '교육관', qty: '2', status: '사용 중' });
  assert.equal(s.asset(id).qty, 2); assert.equal(s.asset(id).repairs.length, 0); s.saveAsset({ id, dept_id: 1, name: '스피커', status: '수리 중', category: '엉뚱한값', qty: 1 }); assert.equal(s.asset(id).status, '수리 중'); assert.equal(s.asset(id).category, '기타');
  s.addRepair(id, { date: '2026-11-01', note: '케이블 교체', cost: '15000' }); s.addRepair(id, { date: '2026-11-05', note: '점검', cost: '' }); assert.equal(s.asset(id).repairs.length, 2); assert.equal(s.asset(id).repairs[1].cost, 0);
  assert.throws(() => s.addRepair(id, { date: '2026-11-01', note: '', cost: 0 }), /수리 내용/); assert.throws(() => s.addRepair(id, { date: '2026-11-01', note: 'x', cost: -1 }), /수리비/); assert.throws(() => s.addRepair(999, { date: '2026-11-01', note: 'x' }), /찾을 수/);
  assert.throws(() => s.saveAsset({ dept_id: 1, name: 'x', qty: -1 }), /수량/); assert.throws(() => s.saveAsset({ dept_id: 1, name: ' ' }), /품목/); assert.throws(() => s.saveAsset({ dept_id: 9, name: 'x' }), /부서/);
  s.deleteRepair(id, s.asset(id).repairs[0].id); assert.equal(s.asset(id).repairs.length, 1); assert.equal(s.assets(2).length, 0); s.deleteAsset(id); assert.equal(s.assets().length, 0);
  const s2 = mk(); s2.saveAsset({ dept_id: 1, name: '의자' }); const s3 = createStore(mem(), () => '2026-11-10'); s3.importJson(s2.exportJson()); assert.equal(s3.assets().length, 1);
});

test('[월 결산] 이달·누계·예산 잔액·영수증 유무를 부서별/전체로 계산한다', () => {
  const s = mk(); s.saveBudget(1, 2026, '교육비', 100000); s.saveBudget(2, 2026, '교육비', 50000);
  s.addTransaction({ dept_id: 1, date: '2026-10-05', kind: 'expense', amount: 20000, category: '교육비', receipt: 'r1' });
  s.addTransaction({ dept_id: 1, date: '2026-11-03', kind: 'expense', amount: 30000, category: '교육비' }); s.addTransaction({ dept_id: 1, date: '2026-11-04', kind: 'expense', amount: 5000, category: '', receipt: 'r2' });
  s.addTransaction({ dept_id: 1, date: '2026-11-06', kind: 'income', amount: 70000, category: '후원' }); s.addTransaction({ dept_id: 2, date: '2026-11-07', kind: 'expense', amount: 10000, category: '교육비' });
  const v = s.addTransaction({ dept_id: 1, date: '2026-11-08', kind: 'expense', amount: 99999, category: '교육비' }); s.voidTransaction(v); // 취소된 거래는 제외
  const R = s.monthlyReport(1, 2026, 11); assert.equal(R.expense, 35000); assert.equal(R.income, 70000); assert.equal(R.net, 35000); assert.equal(R.ytdExpense, 55000);
  const edu = R.categories.find(c => c.category === '교육비'); assert.deepEqual([edu.budget, edu.month, edu.ytd, edu.remaining], [100000, 30000, 50000, 50000]); assert.ok(R.categories.some(c => c.category === '(항목 없음)'));
  assert.deepEqual(R.receipts, { with: 1, without: 1, withoutAmount: 30000 });
  const A = s.monthlyReport(null, 2026, 11); assert.equal(A.expense, 45000); assert.equal(A.categories.find(c => c.category === '교육비').budget, 150000); // 전체: 예산 합산
  assert.equal(s.monthlyReport(1, 2026, 3).expense, 0); assert.equal(s.monthlyReport(1, 2026, 3).rows.length, 0);
});

test('[안내 문구] 날짜·시간 표기와 행사·예배·주간 안내 문구(개인정보 없음, 빈 항목은 줄 생략)', () => {
  assert.equal(fmtDateKo('2026-12-20'), '12월 20일(일)'); assert.equal(fmtTimeKo('14:00'), '오후 2시'); assert.equal(fmtTimeKo('11:30'), '오전 11시 30분'); assert.equal(fmtTimeKo('12:00'), '오후 12시'); assert.equal(fmtTimeKo('00:00'), '오전 12시'); assert.equal(fmtTimeKo(''), '');
  const e = eventNotice({ title: '성탄 발표회', start_date: '2026-12-20', end_date: '2026-12-20', place: '본당', owner: '', note: '' }, { supplies: ['의상', '대본'], church: '', dept: '아동부', contact: '' });
  assert.equal(e, '[성탄 발표회 안내]\n\n일시: 12월 20일(일)\n장소: 본당\n준비물: 의상, 대본\n\n궁금하신 점은 편하게 문의해 주세요.\n- 아동부 -'); assert.ok(!e.includes('담당'));
  const m = eventNotice({ title: '수련회', start_date: '2026-08-01', end_date: '2026-08-03', place: '', owner: '', note: '' }); assert.match(m, /8월 1일\(토\) ~ 8월 3일\(월\)/); assert.ok(!m.includes('undefined') && !m.includes('null'));
  const s = serviceNotice({ title: '어린이 주일예배', date: '2026-11-29', time: '11:00', place: '', scripture: '시편 23:1-6', sermon_title: '' }, { label: '대림절 제1주', church: '(예시)교회', dept: '아동부', contact: '문의처' });
  assert.match(s, /일시: 11월 29일\(일\) 오전 11시/); assert.match(s, /절기: 대림절 제1주/); assert.match(s, /문의: 문의처/); assert.match(s, /- \(예시\)교회 아동부 -/); assert.ok(!s.includes('장소')); assert.ok(!/\n\n\n/.test(s));
  assert.match(weekNotice([], {}), /예정된 일정이 없습니다/); assert.match(weekNotice([{ date: '2026-11-29', time: '11:00', title: '주일예배', place: '교육관' }], { dept: '아동부' }), /• 11월 29일\(일\) 오전 11시 주일예배 \(교육관\)/);
});

test('[서버 저장 검사] 심방·비품 구조가 어긋난 데이터는 422로 거부된다', async () => {
  const s = mk(); const p = s.addPerson({ name: '가', dept_id: 1 }); s.addVisit({ person_id: p, date: '2026-10-01', note: '안부' }); s.saveAsset({ dept_id: 1, name: '의자' });
  const env = newEnv(); const a = await signup(env, 'a@church.kr', '1.1.1.1'); const put = j => call(env, 'PUT', '/api/state', { cookie: a, body: { baseVersion: 0, state: JSON.stringify(j) } });
  const good = JSON.parse(s.exportJson()); const bad1 = JSON.parse(s.exportJson()); bad1.visits[0].person_id = 9999; const bad2 = JSON.parse(s.exportJson()); bad2.assets[0].dept_id = 77; const bad3 = JSON.parse(s.exportJson()); bad3.visits = 'x';
  for (const b of [bad1, bad2, bad3]) assert.equal((await put(b)).status, 422); assert.equal((await put(good)).status, 200);
});

test('[모든 기기 로그아웃] 내 세션만 모두 끊기고, 다른 사람 세션과 데이터는 그대로이며, 로그아웃 상태·다른 사이트 요청은 거부된다', async () => {
  const env = newEnv(); const a1 = await signup(env, 'a@church.kr', '1.1.1.1'); const b = await signup(env, 'b@church.kr', '2.2.2.2');
  const a2 = (await call(env, 'POST', '/api/login', { body: { email: 'a@church.kr', password: PW }, ip: '3.3.3.3' })).cookie; const a3 = (await call(env, 'POST', '/api/login', { body: { email: 'a@church.kr', password: PW }, ip: '4.4.4.4' })).cookie;
  const uid = env.DB.raw.prepare("SELECT id FROM users WHERE email='a@church.kr'").get().id; assert.equal(env.DB.raw.prepare('SELECT COUNT(*) c FROM sessions WHERE user_id=?').get(uid).c, 3);
  assert.equal((await call(env, 'POST', '/api/logout-all', { body: {} })).status, 401); // 로그아웃 상태
  assert.equal((await call(env, 'POST', '/api/logout-all', { cookie: a1, body: {}, headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 403); // 다른 사이트에서 온 요청
  assert.equal((await call(env, 'GET', '/api/me', { cookie: a2 })).json.user.email, 'a@church.kr'); // 거부된 요청은 세션을 끊지 않음
  const r = await call(env, 'POST', '/api/logout-all', { cookie: a1, body: {} }); assert.equal(r.status, 200); assert.match(r.res.headers.get('Set-Cookie'), /Max-Age=0/);
  for (const c of [a1, a2, a3]) assert.equal((await call(env, 'GET', '/api/me', { cookie: c })).json.user, null); // 세 기기 모두 로그아웃
  assert.equal(env.DB.raw.prepare('SELECT COUNT(*) c FROM sessions WHERE user_id=?').get(uid).c, 0);
  assert.equal((await call(env, 'GET', '/api/me', { cookie: b })).json.user.email, 'b@church.kr'); // 다른 사람은 그대로
  assert.equal((await call(env, 'POST', '/api/login', { body: { email: 'a@church.kr', password: PW }, ip: '5.5.5.5' })).status, 200); // 다시 로그인 가능
});

// ---------- PDF에서 계획·일정 가져오기 ----------
import { parsePlanLines, guessKind, guessScheduleType } from '../public/js/planparse.js';
import { itemsToLines } from '../public/js/pdfimport.js';

test('[PDF 읽기 규칙] 날짜 모양(월/일, 점, 한글, 기간, 요일, 시간)을 찾고, 날짜가 아닌 숫자는 무시하고, 의심스러운 줄엔 경고를 붙인다', () => {
  const r = parsePlanLines(['2026년 아동부 교육계획', '12월', '6(일) 대림절 제2주 어린이 예배 11:00', '20일(일) 성탄 발표회 오후 2시', '2026.12.24 성탄 전야 기도회 | 교사', '7/24~26 여름성경학교', '교사회의 12월 8일(화) 오후 8시', '배율 1.5배 설명', '시간 10:30 만 있는 줄', '1월', '3일(일) 신년 감사예배', '10(수) 요일 틀린 모임'], 2025);
  const by = t => r.find(x => x.title.includes(t));
  assert.deepEqual([by('대림절').date, by('대림절').time, by('대림절').kind], ['2026-12-06', '11:00', 'service']); // 제목의 2026년이 기본 연도
  assert.deepEqual([by('성탄 발표회').date, by('성탄 발표회').time, by('성탄 발표회').kind], ['2026-12-20', '14:00', 'event']);
  assert.equal(by('전야').date, '2026-12-24'); assert.equal(by('전야').title, '성탄 전야 기도회 교사');
  assert.deepEqual([by('여름성경학교').date, by('여름성경학교').end], ['2026-07-24', '2026-07-26']);
  assert.deepEqual([by('교사회의').date, by('교사회의').time, by('교사회의').kind], ['2026-12-08', '20:00', 'schedule']);
  assert.equal(r.length, 7); // 1.5배, 10:30만 있는 줄은 날짜가 아니다
  assert.equal(by('신년').date, '2027-01-03'); assert.deepEqual(by('신년').warn, []); // 12월 다음 1월 → 해가 바뀜(2027-01-03은 일요일)
  assert.match(by('요일 틀린').warn.join(' '), /요일이 맞지 않아요/);
  const w = parsePlanLines(['2027.1.5 ~ 2027.1.7 겨울성경학교', '2026년 12월 31일 송구영신 예배', '2/30 없는 날짜 행사', '8월 2일 ~ 8월 4일 수련회'], 2026);
  assert.deepEqual(w.map(x => [x.date, x.end]), [['2027-01-05', '2027-01-07'], ['2026-12-31', '2026-12-31'], ['2027-08-02', '2027-08-04']]); // 없는 날짜(2/30)는 건너뜀, 명시한 연도 뒤에는 그 연도 유지
  assert.deepEqual(parsePlanLines(['12월 25일'], 2026), []); // 이름이 없으면 후보로 만들지 않음
  assert.match(parsePlanLines(['12월 25일', '성탄절 예배'], 2026)[0].warn.join(' '), /다음 줄/);
  assert.ok(parsePlanLines(['12/25 ' + '가'.repeat(100)], 2026)[0].title.length <= 60);
  assert.equal(guessKind('주일학교 예배'), 'service'); assert.equal(guessKind('성탄 발표회'), 'event'); assert.equal(guessKind('교사 기도회'), 'schedule'); assert.equal(guessKind('알 수 없음'), 'schedule');
  assert.equal(guessScheduleType('교사 기도회'), '교사 기도회'); assert.equal(guessScheduleType('교사 연수'), '교사 연수'); assert.equal(guessScheduleType('임원 회의'), '부서 회의'); assert.equal(guessScheduleType('그냥'), '기타');
  assert.deepEqual(parsePlanLines(['<script>alert(1)</script> 12/25 성탄 <b>예배</b>'], 2026)[0].title, '<script>alert(1)</script> 성탄 <b>예배</b>'); // 글자는 그대로(화면에서 이스케이프)
});

test('[PDF 줄 만들기] 같은 높이의 글자를 한 줄로 묶고 표 칸 사이는 | 로 구분한다', () => {
  const it = (s, x, y, w = 40) => ({ str: s, transform: [10, 0, 0, 10, x, y], width: w });
  const lines = itemsToLines([it('성탄', 100, 700), it('발표회', 142, 700), it('12/20', 20, 700), it('두번째 줄', 20, 650), it('', 5, 5), { str: 'x' }, it('칸1', 20, 600), it('칸2', 220, 600)]);
  assert.deepEqual(lines, ['12/20 | 성탄 발표회', '두번째 줄', '칸1 | 칸2']);
});

test('[PDF 일괄 등록] 한 번에 등록하고, 중복은 건너뛰고, 하나라도 틀리면 아무것도 등록하지 않는다', () => {
  const s = mk(); const items = [{ kind: 'event', dept_id: 1, title: '성탄 발표회', date: '2026-12-20', end: '2026-12-20' }, { kind: 'service', dept_id: 1, title: '성탄절 예배', date: '2026-12-25', time: '11:00' }, { kind: 'schedule', dept_id: 1, title: '교사회의', date: '2026-12-08', time: '20:00', type: '교사 회의' }];
  const r = s.importPlanItems(items); assert.deepEqual(r, { made: { event: 1, service: 1, schedule: 1 }, skipped: 0 });
  assert.equal(s.get().events.length, 1); assert.equal(s.get().events[0].status, 'planned'); assert.equal(s.services(1)[0].time, '11:00'); assert.equal(s.schedules(1)[0].type, '교사 회의');
  assert.deepEqual(s.importPlanItems(items), { made: { event: 0, service: 0, schedule: 0 }, skipped: 3 }); assert.equal(s.get().events.length, 1);
  const before = s.exportJson();
  for (const bad of [[{ kind: 'x', dept_id: 1, title: 'a', date: '2026-12-01' }], [{ kind: 'event', dept_id: 9, title: 'a', date: '2026-12-01' }], [{ kind: 'event', dept_id: 1, title: ' ', date: '2026-12-01' }], [{ kind: 'event', dept_id: 1, title: 'a', date: '2026-02-31' }], [{ kind: 'event', dept_id: 1, title: 'a', date: '2026-12-05', end: '2026-12-01' }], [{ kind: 'event', dept_id: 1, title: 'a'.repeat(81), date: '2026-12-01' }], [], null]) assert.throws(() => s.importPlanItems(bad));
  assert.throws(() => s.importPlanItems([{ kind: 'event', dept_id: 1, title: '정상', date: '2026-12-01' }, { kind: 'event', dept_id: 1, title: '틀림', date: 'zzz' }]), /날짜/); assert.equal(s.exportJson(), before); // 일부만 등록되지 않음
  assert.throws(() => s.importPlanItems(Array.from({ length: 301 }, (_, i) => ({ kind: 'event', dept_id: 1, title: 't' + i, date: '2026-12-01' }))), /300개/);
});

test('[PDF 도구·보안 설정] 도구 파일은 있고 라이선스 고지가 함께 있으며, 스크립트 제한은 풀지 않고 작업자는 같은 사이트 것만 허용한다', () => {
  const root = new URL('../public/', import.meta.url); const exists = p => fs.existsSync(new URL(p, root));
  for (const f of ['vendor/pdfjs/pdf.min.mjs', 'vendor/pdfjs/pdf.worker.min.mjs', 'vendor/pdfjs/LICENSE.txt', 'vendor/pdfjs/README.txt', 'vendor/pdfjs/cmaps/UniKS-UTF16-H.bcmap']) assert.ok(exists(f), f);
  assert.match(fs.readFileSync(new URL('vendor/pdfjs/LICENSE.txt', root), 'utf8'), /Apache License/);
  const csp = /Content-Security-Policy: (.*)/.exec(fs.readFileSync(new URL('_headers', root), 'utf8'))[1]; const dir = n => (new RegExp(`(?:^|; )${n} ([^;]*)`).exec(csp) || [])[1];
  assert.equal(dir('script-src'), "'self'"); assert.equal(dir('worker-src'), "'self'"); assert.equal(dir('connect-src'), "'self'"); assert.equal(dir('object-src'), "'none'"); assert.ok(!/unsafe-eval|wasm-unsafe-eval|https?:|\*/.test(csp), csp);
  assert.ok(/\/vendor\/\*\s+Cache-Control: public, max-age=31536000, immutable/.test(fs.readFileSync(new URL('_headers', root), 'utf8')));
  assert.ok(!/fetch\(['"]https?:/.test(fs.readFileSync(new URL('js/pdfimport.js', root), 'utf8'))); // PDF 읽기 코드는 외부로 요청하지 않는다
});

// ---------- 화면별 PDF 읽기 규칙(명단·예산·거래·비품·월별 주제·예배)과 일괄 등록 ----------
import { amountsOf, parseBudgetLines, parseTxLines, parseThemeLines, parsePeopleLines, parseAssetLines, parseServiceLines, guessAssetCategory } from '../public/js/pdfparsers.js';

test('[PDF·금액] 쉼표·원·만원·천원을 읽고, 작은 숫자와 연도는 금액으로 보지 않는다', () => {
  assert.deepEqual(amountsOf('간식 45,000원 3천원 150만원').map(a => a.value), [45000, 3000, 1500000]); assert.deepEqual(amountsOf('45000').map(a => a.value), [45000]);
  assert.deepEqual(amountsOf('2026년 12 3 999 2100'), []); assert.deepEqual(amountsOf('0원'), []);
});

test('[PDF·예산] 항목과 금액을 읽고 합계 줄·금액 없는 줄은 제외, 금액이 여러 개면 경고', () => {
  const r = parseBudgetLines(['2026년 아동부 예산', '1. 교육비 | 800,000', '여름성경학교 1,500,000원 1,200,000원', '행사비 150만원', '합계 | 3,500,000', '간식 12', '기타 2026', '소계 100,000']);
  assert.deepEqual(r.map(x => [x.category, x.amount]), [['교육비', 800000], ['여름성경학교', 1500000], ['행사비', 1500000]]); assert.equal(r[1].warn.length, 1); assert.equal(r[0].warn.length, 0);
});

test('[PDF·거래] 날짜+적요+금액 줄을 읽고 수입 단어로 구분, 표 머리글·합계 줄 제외, 금액이 여러 개면 경고', () => {
  const r = parseTxLines(['날짜 | 적요 | 수입 | 지출', '2026.11.03 간식 구입 | 45,000', '11/10 참가비 입금 100,000원', '11월 합계 500,000', '2026-11-12 | 재료비 | 30,000 | 1,200,000', '2026-11-13 금액 없는 줄'], 2026);
  assert.deepEqual(r.map(x => [x.date, x.memo, x.amount, x.kind]), [['2026-11-03', '간식 구입', 45000, 'expense'], ['2026-11-10', '참가비 입금', 100000, 'income'], ['2026-11-12', '재료비', 30000, 'expense']]); assert.equal(r[2].warn.length, 1);
});

test('[PDF·월별 주제·명단·비품·예배] 각 모양을 읽는다', () => {
  assert.deepEqual(parseThemeLines(['1월 새해와 새 마음', '3월 | 고난과 부활', '5월: 가정과 어린이', '12월 25일 성탄 예배', '- 7월 여름성경학교', '13월 오류']).map(x => [x.month, x.theme]), [[1, '새해와 새 마음'], [3, '고난과 부활'], [5, '가정과 어린이'], [7, '여름성경학교']]);
  assert.equal(parseThemeLines(['3월 가나다', '3월 라마바']).at(-1).warn.length, 1);
  const p = parsePeopleLines(['이름 | 반 | 출생년도', '1 | 가온 | 해님반 | 2018', '나래 달님반 2016년생', '다온 | 별님반 | 16년생', '김교사 교사 해님반', '이 줄은 아주 긴 문장이라서 명단 줄이 아닙니다 정말로 그렇습니다 하하', '라온']);
  assert.deepEqual(p.map(x => [x.name, x.class_name, x.birth_year, x.kind]), [['가온', '해님반', '2018', ''], ['나래', '달님반', '2016', ''], ['다온', '별님반', '2016', ''], ['김교사', '해님반', '', 'teacher'], ['라온', '', '', '']]); assert.equal(p[4].warn.length, 1);
  const a = parseAssetLines(['품목 | 수량 | 장소', '이동식 스피커 | 1 | 교육관', '어린이 의자 30개 교육관 창고', '프로젝터 1대', '합계 | 32', '색연필']);
  assert.deepEqual(a.map(x => [x.name, x.qty, x.place, x.category]), [['이동식 스피커', 1, '교육관', '악기·음향'], ['어린이 의자', 30, '교육관 창고', '비품·가구'], ['프로젝터', 1, '', '영상·전자기기'], ['색연필', 1, '', '교구·교재']]); assert.equal(a[3].warn.length, 1); assert.equal(guessAssetCategory('아무거나'), '기타');
  const s = parseServiceLines(['2026년 어린이 예배', '11월', '1일(일) 선한 목자 요한복음 10:11-18', '8일(일) 작은 것의 소중함 마태복음 13:31-32 예배', '15일(일) 시편 23편 감사', '22일(일) 로마서 8장 말씀'], 2026);
  assert.deepEqual(s.map(x => [x.date, x.title, x.scripture, x.time]), [['2026-11-01', '선한 목자', '요한복음 10:11-18', ''], ['2026-11-08', '작은 것의 소중함 예배', '마태복음 13:31-32', ''], ['2026-11-15', '감사', '시편 23편', ''], ['2026-11-22', '말씀', '로마서 8장', '']]); // 본문 10:11이 시각으로 읽히지 않는다
});

test('[PDF 일괄 등록] 거래·예산·비품·월별 주제: 중복 건너뛰기, 하나라도 틀리면 전체 취소', () => {
  const s = mk(); const tx = [{ date: '2026-11-03', kind: 'expense', memo: '간식', amount: 45000, category: '간식·다과' }, { date: '2026-11-10', kind: 'income', memo: '참가비', amount: 100000 }];
  assert.deepEqual(s.importTransactions(1, tx), { made: 2, skipped: 0 }); assert.deepEqual(s.importTransactions(1, tx), { made: 0, skipped: 2 }); assert.equal(s.transactions({ deptId: 1 }).length, 2); assert.equal(s.deptSummary(1, 2026).expense, 45000);
  const before = s.exportJson(); for (const bad of [[{ date: 'zzz', kind: 'expense', amount: 1 }], [{ date: '2026-11-03', kind: 'x', amount: 1 }], [{ date: '2026-11-03', kind: 'expense', amount: 0 }], [], [{ date: '2026-11-04', kind: 'expense', amount: 5 }, { date: '2026-11-05', kind: 'expense', amount: -5 }]]) assert.throws(() => s.importTransactions(1, bad)); assert.equal(s.exportJson(), before); assert.throws(() => s.importTransactions(9, tx), /부서/);
  assert.deepEqual(s.importBudgets(1, 2026, [{ category: '교육비', amount: 800000 }, { category: '행사비', amount: 1500000 }]), { added: 2, updated: 0 }); assert.deepEqual(s.importBudgets(1, 2026, [{ category: '교육비', amount: 900000 }]), { added: 0, updated: 1 }); assert.equal(s.deptSummary(1, 2026).budget, 2400000);
  assert.throws(() => s.importBudgets(1, 1999, [{ category: 'a', amount: 1 }]), /연도/); assert.throws(() => s.importBudgets(1, 2026, [{ category: ' ', amount: 1 }]), /항목/); assert.throws(() => s.importBudgets(1, 2026, [{ category: 'a', amount: -1 }]), /예산액/);
  assert.deepEqual(s.importAssets(1, [{ name: '스피커', qty: 1, place: '교육관', category: '악기·음향' }, { name: '의자', qty: '30', place: '창고', category: '엉뚱' }]), { made: 2, skipped: 0 }); assert.deepEqual(s.importAssets(1, [{ name: '스피커', qty: 1, place: '교육관' }]), { made: 0, skipped: 1 }); assert.equal(s.assets(1).find(a => a.name === '의자').category, '기타'); assert.throws(() => s.importAssets(1, [{ name: 'x', qty: -2 }]), /수량/);
  assert.equal(s.importMonthThemes(1, 2026, { 1: '새해', 3: '고난과 부활' }), 2); assert.equal(s.plan(1, 2026).themes[3], '고난과 부활'); s.savePlan(1, 2026, '목표', { 3: '기존' }); s.importMonthThemes(1, 2026, { 5: '가정' }); assert.equal(s.plan(1, 2026).goal, '목표'); assert.equal(s.plan(1, 2026).themes[3], '기존'); // 목표·다른 달은 그대로
  assert.throws(() => s.importMonthThemes(1, 2026, { 13: 'x' }), /1~12/); assert.throws(() => s.importMonthThemes(1, 2026, {}), /주제/);
  const sv = s.importPlanItems([{ kind: 'service', dept_id: 1, title: '주일예배', date: '2026-11-29', time: '11:00', scripture: '요한복음 10:11-18' }]); assert.equal(sv.made.service, 1); assert.equal(s.services(1)[0].scripture, '요한복음 10:11-18');
  const s2 = createStore(mem(), () => '2026-11-10'); s2.importJson(s.exportJson()); assert.equal(s2.transactions({ deptId: 1 }).length, 2); // 백업·복원 호환
});