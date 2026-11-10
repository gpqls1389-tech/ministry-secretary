import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore, ValidationError, KEY } from '../public/js/store.js';

const mem = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m }; };
const TODAY = '2026-11-10'; // 화요일
const mk = () => createStore(mem(), () => TODAY);

test('가상 데이터: 첫 실행에 이번 주 일정·준비 업무·예산이 보인다', () => {
  const s = mk(); const h = s.home(null, TODAY);
  assert.equal(h.from, '2026-11-09'); assert.equal(h.to, '2026-11-15');
  assert.ok(h.week.some(i => i.type === 'service'), '이번 주 예배'); assert.ok(h.week.some(i => i.type === 'event'), '이번 주 행사');
  assert.ok(h.tasks.length > 0 && h.tasks.some(t => t.overdue)); assert.equal(h.budget.length, 2);
  assert.ok(s.get().demo);
});

test('부서 필터', () => {
  const s = mk(); const kid = s.home(1, TODAY), yth = s.home(2, TODAY);
  assert.ok(kid.week.every(i => i.dept_id === 1)); assert.ok(yth.week.every(i => i.dept_id === 2)); assert.equal(kid.budget.length, 1);
});

test('회계: 행사 지출은 행사·부서 양쪽에 조회되고 부서 합계에 한 번만 포함, 예산 잔액과 수입·지출 차액은 별개', () => {
  const s = mk(); s.startEmpty(); s.saveBudget(1, 2026, '행사', 1_000_000);
  const e = s.saveEvent({ dept_id: 1, title: 'VBS', start_date: '2026-07-24', end_date: '2026-07-24', expected_budget: 1_000_000 });
  s.addTransaction({ dept_id: 1, date: '2026-07-24', kind: 'income', amount: 600_000, category: '행사', event_id: e });
  const t = s.addTransaction({ dept_id: 1, date: '2026-07-24', kind: 'expense', amount: 400_000, category: '행사', event_id: e });
  s.addTransaction({ dept_id: 1, date: '2026-03-01', kind: 'expense', amount: 50_000, category: '행사' });
  let d = s.deptSummary(1, 2026); assert.equal(d.expense, 450_000); assert.equal(d.budget_remaining, 550_000); assert.equal(d.net, 150_000); assert.equal(d.event_expense, 400_000);
  assert.equal(s.eventSummary(e).expense, 400_000); assert.equal(s.eventSummary(e).net, 200_000); assert.equal(s.eventSummary(e).budget_remaining, 600_000);
  s.voidTransaction(t); d = s.deptSummary(1, 2026); assert.equal(d.expense, 50_000); assert.equal(s.eventSummary(e).expense, 0);
});

test('검증: 금액·날짜·부서', () => {
  const s = mk();
  for (const bad of [0, -1, 1.5, NaN, 'x', 2 ** 60]) assert.throws(() => s.addTransaction({ dept_id: 1, date: '2026-01-01', kind: 'expense', amount: bad }), ValidationError);
  assert.throws(() => s.addTransaction({ dept_id: 1, date: '2026-02-30', kind: 'expense', amount: 10 }), ValidationError);
  assert.throws(() => s.addTransaction({ dept_id: 1, date: '2026-01-01', kind: 'x', amount: 10 }), ValidationError);
  assert.throws(() => s.saveEvent({ dept_id: 1, title: 'a', start_date: '2026-05-02', end_date: '2026-05-01' }), ValidationError);
  assert.throws(() => s.addTransaction({ dept_id: 2, date: '2026-01-01', kind: 'expense', amount: 10, event_id: 1 }), ValidationError); // 행사(아동부)와 부서 불일치
});

test('출석: 같은 회차 중복 집계 없음, 부서 이동·명단 제외 후에도 과거 기록 유지', () => {
  const s = mk(); s.startEmpty();
  const p = s.addPerson({ name: '민준', dept_id: 1, class_name: '별님반' }); const q = s.addPerson({ name: '서연', dept_id: 1, class_name: '별님반' });
  const a = s.saveService({ dept_id: 1, title: '주일', date: '2026-11-01' }); const b = s.cloneService(a, '2026-11-08');
  s.setAttendance(a, p, true); s.setAttendance(a, p, true); s.setAttendance(a, q, true); s.setAttendance(b, p, true); s.setAttendance(b, q, false);
  assert.deepEqual(s.attendanceCount(a), { present: 2, recorded: 2 }); assert.deepEqual(s.attendanceCount(b), { present: 1, recorded: 2 });
  assert.equal(s.attendanceCount(s.cloneService(b, '2026-11-15')).recorded, 0); // 복제는 출석 미포함
  s.movePerson(p, 2, '1조'); s.setPersonStatus(q, 'graduated');
  assert.equal(s.people({ deptId: 1 }).length, 0);
  const m = s.attendanceMatrix(1); const mp = m.rows.find(r => r.person.id === p);
  assert.ok(mp && mp.former && mp.present === 2); assert.deepEqual(m.totals.slice(0, 2), [2, 1]);
  assert.throws(() => s.deletePerson(p), ValidationError);
});

test('행사 참가 집계: 신청(취소 제외)과 실제 참석을 따로 집계, 한 사람 한 행', () => {
  const s = mk(); s.startEmpty(); const e = s.saveEvent({ dept_id: 1, title: 'E', start_date: '2026-08-01', end_date: '2026-08-01' });
  const [a, b, c] = ['가', '나', '다'].map(n => s.addPerson({ name: n, dept_id: 1 }));
  s.setParticipant(e, a, 'attended'); s.setParticipant(e, a, 'attended'); s.setParticipant(e, b, 'applied'); s.setParticipant(e, c, 'cancelled'); s.addNewcomer(e, '새친구');
  assert.deepEqual(s.eventSummary(e), { registered: 3, attended: 2, cancelled: 1, first_time: 1, income: 0, expense: 0, budget_remaining: 0, net: 0 });
  assert.equal(s.participants(e).length, 4);
});

test('저장·복원: 새로고침(재로드)해도 유지, 내보내기→빈 환경 가져오기, 잘못된 파일 거부', () => {
  const st = mem(); const s1 = createStore(st, () => TODAY); s1.startEmpty(); s1.addPerson({ name: '가', dept_id: 1 });
  const s2 = createStore(st, () => TODAY); assert.equal(s2.people().length, 1); assert.equal(s2.get().demo, false);
  const json = s2.exportJson(); const s3 = createStore(mem(), () => TODAY); s3.importJson(json); assert.equal(s3.people()[0].name, '가');
  assert.throws(() => s3.importJson('{"a":1}'), ValidationError); assert.throws(() => s3.importJson('not json'), ValidationError);
  const bad = mem(); bad.setItem(KEY, '{broken'); assert.ok(createStore(bad, () => TODAY).get().demo); // 손상된 저장값은 새로 시작
});

test('동명이인 구분 표시, 사람 삭제는 기록 없을 때만', () => {
  const s = mk(); const names = s.people({ deptId: 1 }).filter(p => p.name === '하늬'); assert.equal(names.length, 2); assert.notEqual(names[0].display, names[1].display);
  const x = s.addPerson({ name: '임시', dept_id: 1 }); s.deletePerson(x); assert.ok(!s.person(x));
});

test('작업 중인 데이터에는 보호자 연락처·알레르기 필드가 없다(웹앱 v1은 수집하지 않음)', () => {
  const s = mk(); for (const p of s.get().people) { assert.ok(!('guardian_phone' in p) && !('allergy_note' in p)); }
});
