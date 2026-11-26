import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PUB = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const text = p => fs.readFileSync(path.join(PUB, p), 'utf8').replace(/\r\n/g, '\n');

test('MB12.20 출석 명단: 선생님(반)별 묶음, 한 화면 맞춤, 검색·토글 연동', () => {
  const app = text('js/app.js'); const css = text('style.css');
  for (const k of ['function attGroups', 'function attBoard', 'function fitAtt', 'function paintGroupCounts', 'function vAtt', 'att: vAtt', 'data-go="#att/${id}"', "classList.toggle('attmode', view === 'att')", 'paintGroupCounts(); const c = store.attendanceCount(a)', "$$('.att-board label[data-pid]')"]) assert.ok(app.includes(k), k);
  assert.ok(!app.includes('class="att-list"'), '예전 2열 목록은 묶음으로 대체');
  assert.ok(/staff.*선생님|' 선생님'/.test(app), '담임 선생님 이름을 머리글에 쓴다');
  for (const k of ['.att-board', '.att-group', '--rowh', '#main.attmode .pagehead .sub']) assert.ok(css.includes(k), k);
});

test('묶음 규칙(같은 로직을 꺼내 확인): 같은 반 교사가 선생님, 교사→봉사자→아이 순, 반 없는 묶음은 맨 뒤', () => {
  const src = text('js/app.js'); const a = src.indexOf('function attGroups'); const b = src.indexOf('function attBoard');
  const attGroups = new Function(`${src.slice(a, b)}; return attGroups;`)();
  const P = (id, name, kind, class_name) => ({ id, name, kind, class_name });
  const g = attGroups([P(1, '아이1', 'child', '해님반'), P(2, '김선생', 'teacher', '해님반'), P(3, '무소속', 'child', ''), P(4, '봉사', 'volunteer', '해님반'), P(5, '아이2', 'child', '달님반'), P(6, '이선생', 'teacher', '달님반'), P(7, '박선생', 'teacher', '달님반')]);
  assert.deepEqual(g.map(x => x.cls), ['해님반', '달님반', '']); assert.deepEqual(g[0].all.map(p => p.name), ['김선생', '봉사', '아이1']); assert.deepEqual(g[0].staff.map(p => p.name), ['김선생']);
  assert.deepEqual(g[1].staff.map(p => p.name), ['이선생', '박선생'], '한 반에 선생님이 여럿이면 모두'); assert.equal(g[2].staff.length, 0);
  assert.equal(attGroups([]).length, 0);
});
