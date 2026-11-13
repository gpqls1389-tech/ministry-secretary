import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore, ValidationError, KEY } from '../public/js/store.js';
import { easterDate, adventStart, seasonTemplates, EVENT_TEMPLATES, GUIDE_STEPS, TIPS } from '../public/js/templates.js';
import { toCsv, csvCell } from '../public/js/csv.js';

const mem = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m }; };
const mk = () => createStore(mem(), () => '2026-11-10');

test('부활절·대림절 날짜 계산', () => {
  assert.equal(easterDate(2025), '2025-04-20'); assert.equal(easterDate(2026), '2026-04-05'); assert.equal(easterDate(2027), '2027-03-28');
  assert.equal(adventStart(2026), '2026-11-29'); assert.equal(adventStart(2025), '2025-11-30'); assert.equal(adventStart(2027), '2027-11-28'); // 2027-12-25는 토요일
  assert.equal(adventStart(2022), '2022-11-27'); // 12/25가 일요일 → 직전 주일은 12/18, 대림절은 11/27
  for (const y of [2025, 2026, 2027, 2028]) assert.equal(new Date(adventStart(y) + 'T00:00:00Z').getUTCDay(), 0, '대림절 시작은 주일');
});

test('절기 예시: 7개, 날짜 유효, 같은 연도에 다시 불러와도 중복 없음, 부서별 독립', () => {
  const s = mk(); s.startEmpty();
  const t = seasonTemplates(2026); assert.equal(t.length, 7); assert.ok(t.every(x => x.start <= x.end));
  assert.equal(t.find(x => x.name === '사순절').start, '2026-02-18'); // 부활절 4/5 − 46일
  assert.equal(t.find(x => x.name === '대림절').end, '2026-12-24');
  assert.equal(s.loadSeasonTemplate(1, 2026), 7); assert.equal(s.loadSeasonTemplate(1, 2026), 0); assert.equal(s.loadSeasonTemplate(2, 2026), 7);
  assert.equal(s.seasons(1, 2026).length, 7);
});

test('월별 주제 예시는 비어 있는 달만 채운다', () => {
  const s = mk(); s.startEmpty(); s.savePlan(1, 2026, '목표', { 1: '내가 쓴 주제' });
  assert.equal(s.loadMonthThemes(1, 2026), 11); const p = s.plan(1, 2026); assert.equal(p.themes[1], '내가 쓴 주제'); assert.equal(p.goal, '목표'); assert.equal(Object.keys(p.themes).length, 12);
  assert.equal(s.loadMonthThemes(1, 2026), 0);
});

test('행사 예시: 준비 업무 마감일은 시작일 기준, 중복 적용 없음, 준비물 추가', () => {
  const s = mk(); s.startEmpty(); const e = s.saveEvent({ dept_id: 1, title: '여름성경학교', start_date: '2026-07-24', end_date: '2026-07-26' });
  const r = s.applyEventTemplate(e, 'vbs'); assert.equal(r.tasks, EVENT_TEMPLATES.vbs.tasks.length); assert.ok(r.supplies > 0);
  const tasks = s.get().tasks.filter(t => t.event_id === e); const first = tasks.find(t => t.title.startsWith('주제·본문')); assert.equal(first.due, '2026-04-25'); // 7/24 − 90일
  assert.equal(tasks.find(t => t.title.startsWith('결산')).due, '2026-07-31'); // 7/24 + 7일
  assert.deepEqual(s.applyEventTemplate(e, 'vbs'), { tasks: 0, supplies: 0 }); assert.equal(s.supplies(e).length, r.supplies);
  assert.throws(() => s.applyEventTemplate(e, 'nope'), ValidationError);
  for (const [k, t] of Object.entries(EVENT_TEMPLATES)) assert.ok(t.tasks.every(x => Number.isInteger(x.offset) && x.title), k);
});

test('시작 체크리스트는 데이터에서 자동 계산', () => {
  const s = mk(); s.startEmpty(); assert.ok(Object.values(s.guideProgress()).every(v => v === false));
  assert.deepEqual(GUIDE_STEPS.map(x => x.key).sort(), Object.keys(s.guideProgress()).sort());
  s.addPerson({ name: '가', dept_id: 1 }); s.markExported(); const g = s.guideProgress(); assert.ok(g.people && g.backup && !g.event);
  assert.equal(s.daysSinceExport(), 0);
});

test('가져오기 검증: 구조가 깨진 파일은 거부하고 현재 데이터는 그대로', () => {
  const s = mk(); const good = JSON.parse(s.exportJson()); const before = s.exportJson();
  const bads = [
    { ...good, transactions: [{ id: 1, dept_id: 1, date: '2026-01-01', kind: 'expense', amount: -5 }] },
    { ...good, events: [{ id: 1, dept_id: 99, title: 'x', start_date: '2026-01-01', end_date: '2026-01-01' }] },
    { ...good, attendance: [{ service_id: 9999, person_id: 1 }] },
    { ...good, nextId: 'x' }, { ...good, plans: [] }, { ...good, supplies: 'x' }, { version: 1 },
  ];
  for (const b of bads) assert.throws(() => s.importJson(JSON.stringify(b)), ValidationError);
  assert.equal(s.exportJson(), before);
  s.importJson(JSON.stringify(good)); assert.equal(s.people().length, good.people.filter(p => p.status === 'active').length);
});

test('손상된 저장값은 가상 데이터로 덮어쓰기 전에 원본을 따로 보관', () => {
  const st = mem(); st.setItem(KEY, '{"version":1,"depts":"oops"}'); const s = createStore(st, () => '2026-11-10');
  assert.ok(s.wasRecovered()); assert.equal(st.getItem(KEY + ':broken'), '{"version":1,"depts":"oops"}'); assert.ok(s.get().demo);
});

test('저장 실패는 조용히 넘어가지 않고 알린다', () => {
  const st = mem(); const s = createStore(st, () => '2026-11-10'); st.setItem = () => { throw new Error('quota'); };
  assert.throws(() => s.addPerson({ name: '가', dept_id: 1 }), /저장하지 못했습니다/);
});

test('수정·삭제 보강: 인원 수정, 거래 수정(검증 포함), 예배·행사 삭제', () => {
  const s = mk(); s.startEmpty(); const p = s.addPerson({ name: '가', dept_id: 1, class_name: 'A' }); s.updatePerson(p, { name: '나', kind: 'youth', birth_year: 2001, class_name: 'B' });
  assert.deepEqual([s.person(p).name, s.person(p).kind, s.person(p).class_name, s.person(p).birth_year], ['나', 'youth', 'B', 2001]); assert.throws(() => s.updatePerson(p, { name: ' ' }), ValidationError);
  const t = s.addTransaction({ dept_id: 1, date: '2026-05-01', kind: 'expense', amount: 1000 }); const before = s.get().nextId;
  s.updateTransaction(t, { dept_id: 1, date: '2026-05-02', kind: 'expense', amount: 2500, memo: '수정' });
  const row = s.get().transactions.find(x => x.id === t); assert.equal(row.amount, 2500); assert.equal(s.get().transactions.length, 1); assert.equal(s.get().nextId, before);
  assert.throws(() => s.updateTransaction(t, { dept_id: 1, date: '2026-05-02', kind: 'expense', amount: 0 }), ValidationError); assert.equal(s.get().transactions.find(x => x.id === t).amount, 2500); // 실패 시 원래대로
  const sv = s.saveService({ dept_id: 1, title: '주일', date: '2026-11-01' }); s.setAttendance(sv, p, true); s.deleteService(sv); assert.equal(s.get().attendance.length, 0); assert.equal(s.services().length, 0);
  const e = s.saveEvent({ dept_id: 1, title: 'E', start_date: '2026-08-01', end_date: '2026-08-01' }); s.addSupply(e, '이름표'); s.addTask(e, '일', null); s.deleteEvent(e); assert.equal(s.get().supplies.length, 0); assert.equal(s.get().tasks.length, 0);
});

test('CSV: BOM, 따옴표·줄바꿈 처리, 수식 주입 방지, 숫자는 그대로', () => {
  assert.ok(toCsv([['a']]).startsWith('﻿')); assert.equal(csvCell('a,b'), '"a,b"'); assert.equal(csvCell('He said "hi"'), '"He said ""hi"""'); assert.equal(csvCell('줄\n바꿈'), '"줄\n바꿈"');
  assert.equal(csvCell('=1+1'), "'=1+1"); assert.equal(csvCell('+cmd'), "'+cmd"); assert.equal(csvCell('@x'), "'@x"); assert.equal(csvCell(-1202345), '-1202345'); assert.equal(csvCell(null), '');
});

test('도움말 내용이 모든 화면에 있다', () => { for (const k of ['home', 'plan', 'events', 'event', 'services', 'service', 'people', 'money', 'settings']) assert.ok(TIPS[k] && TIPS[k][0] && TIPS[k][1], k); });
