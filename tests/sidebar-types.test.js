import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStore, ValidationError, validateState } from '../public/js/store.js';

const mem = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m }; };
const mk = () => createStore(mem(), () => '2026-11-10');
const PUB = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const text = p => fs.readFileSync(path.join(PUB, p), 'utf8').replace(/\r\n/g, '\n');

test('MB12.22 일정 구분: 내 단어로 추가·저장, 기본 구분은 그대로, 지워도 이미 쓴 일정은 유지', () => {
  const s = mk(); s.startEmpty(); const d = s.depts()[0].id;
  assert.equal(s.scheduleTypes().at(-1), '기타'); assert.ok(s.scheduleTypes().includes('교사 기도회'));
  assert.equal(s.addScheduleType('  교사   말씀 나눔 '), '교사 말씀 나눔'); assert.equal(s.addScheduleType('교사 말씀 나눔'), '교사 말씀 나눔', '같은 이름은 한 번만'); assert.equal(s.addScheduleType('교사 회의'), '교사 회의', '기본 구분과 같으면 추가하지 않는다');
  assert.deepEqual(s.customScheduleTypes(), ['교사 말씀 나눔']); assert.equal(s.scheduleTypes().at(-2), '교사 말씀 나눔', '기타 앞에 들어간다');
  assert.throws(() => s.addScheduleType(' '), ValidationError); assert.throws(() => s.addScheduleType('가'.repeat(21)), ValidationError);
  const id = s.saveSchedule({ dept_id: d, title: '목요 나눔', type: '교사 말씀 나눔', date: '2026-12-03' }); assert.equal(s.schedule(id).type, '교사 말씀 나눔');
  assert.equal(s.schedule(s.saveSchedule({ dept_id: d, title: 'x', type: '없는 구분', date: '2026-12-03' })).type, '기타', '목록에 없는 값은 기타');
  s.removeScheduleType('교사 말씀 나눔'); assert.deepEqual(s.customScheduleTypes(), []); assert.equal(s.schedule(id).type, '교사 말씀 나눔', '지워도 이미 만든 일정은 그대로');
  s.saveSchedule({ id, dept_id: d, title: '목요 나눔(수정)', type: '교사 말씀 나눔', date: '2026-12-03' }); assert.equal(s.schedule(id).type, '교사 말씀 나눔', '고칠 때 지금 구분은 유지');
  for (let i = 0; i < 30; i++) s.addScheduleType('구분' + i); assert.throws(() => s.addScheduleType('초과'), /30개/);
  const raw = JSON.parse(JSON.stringify(s.get())); validateState(raw); raw.scheduleTypes = ['a', 3]; assert.throws(() => validateState(raw), /일정 구분/); raw.scheduleTypes = 'x'; assert.throws(() => validateState(raw), /일정 구분/);
});

test('MB12.22 화면 연결: 일정 구분 ‘내 단어로 추가’ 입력칸과 지우기 칩, 왼쪽 메뉴 한 화면 맞춤 CSS', () => {
  const app = text('js/app.js'); const css = text('style.css');
  for (const k of ["['__new__', '＋ 내 단어로 추가…']", "k: 'newtype'", 'store.addScheduleType(o.newtype)', 'tychips', 'store.removeScheduleType']) assert.ok(app.includes(k), k);
  for (const k of ['#side #nav a { flex:1 1 0;', 'scrollbar-width:none', '--barh', '#demo-bar { position:sticky']) assert.ok(css.includes(k), k);
  assert.ok(/@media \(min-width:861px\) \{ #side \{ top:var\(--barh,0px\)/.test(css), '좁은 화면의 서랍 메뉴는 건드리지 않는다');
});
