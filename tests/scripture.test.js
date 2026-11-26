import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStore, validateState } from '../public/js/store.js';
import * as SC from '../public/js/scripture.js';
import * as SM from '../public/js/sermon.js';

const mem = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m }; };
const mk = () => createStore(mem(), () => '2026-11-10');
const PUB = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const text = p => fs.readFileSync(path.join(PUB, p), 'utf8').replace(/\r\n/g, '\n');

test('MB12.19 본문 표기: 66권 이름·줄임말, 장·절 범위, 읽지 못하는 표기는 null', () => {
  assert.equal(SC.BOOKS.length, 66); assert.equal(new Set(SC.BOOKS.map(b => b[0])).size, 66);
  const t = (s, book, ch, from, to) => { const r = SC.parseRef(s); assert.ok(r, s); assert.deepEqual([r.book, r.chapter, r.from, r.to], [book, ch, from, to], s); };
  t('누가복음 2:1-7', 42, 2, 1, 7); t('눅 2:1~7', 42, 2, 1, 7); t('마태복음 1:18-25', 40, 1, 18, 25); t('시 23', 19, 23, null, null); t('요일 4:7-12', 62, 4, 7, 12); t('요한복음 1:14', 43, 1, 14, 14); t('롬 8:28', 45, 8, 28, 28); t('이사야 9:6-7', 23, 9, 6, 7);
  for (const bad of ['', '엉뚱 3:1', '누가복음', '누가복음 2:7-1', '2:1']) assert.equal(SC.parseRef(bad), null, bad);
  assert.equal(SC.refText(SC.parseRef('눅 2:1~7')), '누가복음 2:1-7'); assert.equal(SC.genreOf(42), 'gospel'); assert.equal(SC.genreOf(45), 'epi'); assert.equal(SC.bookName(1), '창세기');
});

test('파일 이름에서 성경 책 찾기: 긴 이름 우선, 짧은 이름은 낱말 경계에서만, 내용은 보지 않는다', () => {
  const d = s => SC.detectBooks(s).map(SC.bookName).join(',');
  assert.equal(d('01 창세기 1-15_고든 웬함 WBC.pdf'), '창세기'); assert.equal(d('예레미야애가'), '예레미야애가', '예레미야로 잘못 잡히지 않는다'); assert.equal(d('요한1서 주석'), '요한일서'); assert.equal(d('고린도전서 강해'), '고린도전서');
  assert.equal(d('아가페 사랑'), '', '아가페는 아가가 아니다'); assert.equal(d('시편 1-41'), '시편'); assert.equal(d('성경사전'), ''); assert.equal(d('요한복음과 요한계시록'), '요한복음,요한계시록');
  const items = SC.parseShelfPaths(['WBC 주석/01 창세기 1-15_고든 웬함 WBC.pdf', '100주년기념성서주석/신약/누가복음.pdf', 'x/.DS_Store', '사전/성경사전.pdf', 'WBC 주석/01 창세기 1-15_고든 웬함 WBC.pdf', 'a/readme.zip']);
  assert.equal(items.length, 3, '문서 파일만, 중복 제외'); assert.deepEqual(items[1], { title: '누가복음', series: '100주년기념성서주석 / 신약', books: [42] }); assert.equal(SC.shelfFor(items, 42).hit.length, 1); assert.equal(SC.shelfFor(items, 42).general.length, 1);
});

test('주제 확인(참고용)과 구조 틀 추천', () => {
  const t = SC.themeCheck({ idea: '하나님이 구유에 오신 아기로 우리와 함께하신다', passage: '그들이 있을 때에 해산할 날이 차서 구유에 뉘었으니', study: '', blocks: [{ title: '적용', memo: '이웃을 환대하는 삶을 구체적으로 이야기합니다 충분히 길게' }] });
  assert.ok(t.inText.includes('구유')); assert.ok(t.notInText.includes('하나님')); assert.equal(t.hasPassage, true); assert.deepEqual(t.loose, ['적용']);
  assert.deepEqual(SC.themeCheck({ idea: '', passage: 'x' }).keywords, []);
  assert.equal(SC.recommendStructure({ book: 42, audience: 'all', season: '대림절' }).key, 'advent'); assert.equal(SC.recommendStructure({ book: 42, audience: 'kid', season: '' }).key, 'short');
  assert.equal(SC.recommendStructure({ book: 42, audience: 'adult', season: '', minutes: 12 }).key, 'short'); assert.equal(SC.recommendStructure({ book: 42, audience: 'adult', season: '', minutes: 25 }).key, 'story'); assert.equal(SC.recommendStructure({ book: 45, audience: 'adult', season: '', minutes: 25 }).key, 'three'); assert.equal(SC.recommendStructure({ book: 0, audience: 'adult', season: '' }).key, 'three');
});

test('서가 저장소: 이름만 보관·중복 건너뜀·검사, 설교 노트의 주석 기록이 출처와 점검에 반영', () => {
  const s = mk(); s.startEmpty(); const r1 = s.addShelf([{ title: '누가복음', series: 'WBC', books: [42, 999, 'x'] }, { title: '', series: 'x' }, { title: '성경사전', series: '사전', books: [] }]); assert.deepEqual([r1.added, r1.skipped, r1.total], [2, 0, 2]); assert.deepEqual(s.shelf()[0].books, [42]);
  assert.equal(s.addShelf([{ title: '누가복음', series: 'WBC' }]).skipped, 1); validateState(JSON.parse(JSON.stringify(s.get())));
  const raw = JSON.parse(JSON.stringify(s.get())); raw.shelf[0].books = 'x'; assert.throws(() => validateState(raw), /주석 서가/);
  s.deleteShelf(s.shelf()[0].id); assert.equal(s.shelf().length, 1); s.clearShelf(); assert.equal(s.shelf().length, 0);
  const d = s.depts()[0].id; const id = s.saveSermon({ title: 'x', dept_id: d, passage: '본문', refs: [{ title: 'WBC 누가', series: 'WBC', pages: '10', note: '요약' }, { title: '' }], blocks: [{ title: '도입', min: 3, memo: '예화: 이야기' }] });
  const sm = s.sermon(id); assert.equal(sm.refs.length, 1); const a = Object.fromEntries(SM.autoChecks(sm).map(c => [c.key, c.ok])); assert.deepEqual([a.passage, a.refs, a.sources], [true, true, true]);
  assert.match(SM.sermonText(sm), /\[참고 자료·출처\]\n- WBC 누가 \(WBC\) 10쪽 — 요약/);
  assert.equal(SM.cleanSermon({ title: 'x', refs: Array.from({ length: 40 }, (_, i) => ({ title: 't' + i })) }).refs.length, SM.REF_MAX);
});

test('화면 연결: 서가 화면은 파일 이름·폴더 이름만 읽고 내용은 읽지 않는다', () => {
  const app = text('js/app.js'); const sc = text('js/scripture.js');
  for (const k of ["import * as SC from './scripture.js'", 'shelf: vShelf', 'webkitdirectory', 'webkitRelativePath', 'data-shelf-add', 'paintSTheme', 'recStruct', 'shelfConfirm']) assert.ok(app.includes(k), k);
  assert.ok(!/FileReader|\.text\(\)|arrayBuffer|readAs/.test(app.slice(app.indexOf('function vShelf'), app.indexOf('// ----- 설교 작업대(MB12.18)'))), '서가 가져오기는 파일 내용을 읽지 않는다');
  assert.ok(!/fetch\(|XMLHttpRequest/.test(sc), '서버로 보내지 않는다');
});
