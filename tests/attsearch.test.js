import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { matchPerson, visiblePeople, inClass, scopeText } from '../public/js/attsearch.js';

const people = [
  { id: 1, display: '김가온(2018)', name: '김가온', class_name: '해님반' }, { id: 2, display: '김 나래', name: '김 나래', class_name: '해님반' },
  { id: 3, display: '이다온', name: '이다온', class_name: '달님반' }, { id: 4, display: 'Park Mina', name: 'Park Mina', class_name: '달님반' }, { id: 5, display: '박라온', name: '박라온', class_name: '' },
];
const ids = (q, cls = '') => visiblePeople(people, { cls, q }).map(p => p.id);

test('이름 검색: 부분 일치, 공백·대소문자 무시, 빈 검색은 전부', () => {
  assert.deepEqual(ids(''), [1, 2, 3, 4, 5]); assert.deepEqual(ids('   '), [1, 2, 3, 4, 5]); assert.deepEqual(ids('김'), [1, 2]); assert.deepEqual(ids('김나'), [2]); assert.deepEqual(ids('가온'), [1]);
  assert.deepEqual(ids('PARK mina'), [4]); assert.deepEqual(ids('2018'), [1]); assert.deepEqual(ids('없는이름'), []); assert.deepEqual(ids('%'), []);
  assert.ok(matchPerson({ display: '가', name: '가' }, '가'.normalize('NFD')), '낱자로 들어온 한글도 맞춘다');
});

test('반과 검색을 함께 적용하고 안내문이 범위를 알려 준다', () => {
  assert.deepEqual(inClass(people, '달님반').map(p => p.id), [3, 4]); assert.deepEqual(ids('이', '달님반'), [3]); assert.deepEqual(ids('박', '해님반'), []);
  assert.equal(scopeText(people, { cls: '', q: '' }), '전체 반 5명이 보입니다. 전원 출석은 이 5명에게 적용됩니다.');
  assert.equal(scopeText(people, { cls: '달님반', q: ' 이 ' }), '달님반 2명 중 ‘이’ 검색 1명이 보입니다. 전원 출석은 보이는 1명에게만 적용됩니다.');
});

test('화면 코드 점검: 검색칸, 전원 출석 범위, 숨김 규칙', () => {
  const app = fs.readFileSync(new URL('../public/js/app.js', import.meta.url), 'utf8'); const css = fs.readFileSync(new URL('../public/style.css', import.meta.url), 'utf8');
  assert.ok(app.includes("from './attsearch.js'") && app.includes('id="att-q"') && app.includes('data-attq'), '검색칸이 있다');
  assert.ok(/allPresent: d => \{[^}]*visiblePeople\(/.test(app), '전원 출석은 보이는 사람에게만 적용한다');
  assert.ok(/\[hidden\]\s*\{\s*display:\s*none\s*!important/.test(css), 'hidden 속성이 다른 display 규칙에 밀리지 않는다');
});
