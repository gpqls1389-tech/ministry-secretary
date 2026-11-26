import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStore } from '../public/js/store.js';

const PUB = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const text = p => fs.readFileSync(path.join(PUB, p), 'utf8').replace(/\r\n/g, '\n');
const mem = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; };

test('MB12.25 달력 날짜 팝업: 날짜 칸 클릭·키보드, 항목 클릭은 상세로, 그 날짜로 일정·예배·행사 추가', () => {
  const app = text('js/app.js'); const css = text('style.css');
  for (const k of ['data-day="${ds}" tabindex="0" role="button"', 'function openDay', "if ((el = t.closest('[data-day]'))) { openDay(el.dataset.day); return; }", '[data-day][tabindex]', "scheduleForm({ date: ds })", "serviceForm({ date: ds })", "eventForm({ start_date: ds, end_date: ds })", "{ services: true, lessons: false }"]) assert.ok(app.includes(k), k);
  assert.ok(app.indexOf("t.closest('[data-open]')") < app.indexOf("t.closest('[data-day]')"), '일정 항목을 누르면 팝업이 아니라 상세로 간다');
  for (const k of ['.cal .dayc', '.daypop', '.dayitem']) assert.ok(css.includes(k), k);
});

test('그날 일정 모으기: 일정·예배·행사가 날짜 범위에 걸치면 나오고 시간순, 부서 거르기', () => {
  const s = createStore(mem(), () => '2026-11-10'); s.startEmpty(); const [a, b] = [s.depts()[0].id, s.depts()[1].id];
  s.saveSchedule({ dept_id: a, title: '오전 회의', type: '교사 회의', date: '2026-12-06', time: '09:00' }); s.saveSchedule({ dept_id: b, title: '여러 날 연수', type: '교사 연수', date: '2026-12-05', end: '2026-12-07' });
  s.saveService({ dept_id: a, title: '주일예배', date: '2026-12-06', time: '11:00', kind: 'regular' }); s.saveEvent({ dept_id: a, title: '성탄 행사', start_date: '2026-12-05', end_date: '2026-12-07', expected_budget: 0 });
  const day = (d, dept) => s.calendar(dept, d, d, { services: true, lessons: false }).filter(i => i.date <= d && i.end >= d);
  const t = day('2026-12-06', null).map(i => i.title);
  assert.deepEqual([...t].sort(), ['성탄 행사', '여러 날 연수', '오전 회의', '주일예배'].sort(), '일정·행사·예배가 모두'); assert.equal(t.length, 4); assert.ok(t.indexOf('오전 회의') < t.indexOf('주일예배'), '시간 순서(09:00 → 11:00)');
  assert.equal(day('2026-12-05', null).length, 2, '여러 날 일정·행사는 시작일에도'); assert.equal(day('2026-12-07', null).length, 2, '끝나는 날에도'); assert.equal(day('2026-12-08', null).length, 0, '지난 날에는 없음');
  assert.deepEqual(day('2026-12-06', b).map(i => i.title), ['여러 날 연수'], '부서 거르기');
});
