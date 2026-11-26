import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStore, ValidationError, validateState } from '../public/js/store.js';
import * as SM from '../public/js/sermon.js';

const mem = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m }; };
const mk = () => createStore(mem(), () => '2026-11-10');
const PUB = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const text = p => fs.readFileSync(path.join(PUB, p), 'utf8').replace(/\r\n/g, '\n');

test('MB12.18 설교 노트 정리: 제목 필수, 길이·종류 제한, 점검 키만 남김', () => {
  assert.throws(() => SM.cleanSermon({ title: ' ' }));
  const c = SM.cleanSermon({ title: ' 임마누엘 ', scripture: '마태복음 1:18-25', audience: 'zzz', minutes: 999, season: '없는절기', study: { context: 'a'.repeat(5000) }, core: { idea: '한 문장' }, checks: { verse: true, context: false, fake: true }, blocks: [{ title: '도입', min: 3, memo: '내용', guide: '질문' }, { title: '', min: 5 }, null] });
  assert.equal(c.title, '임마누엘'); assert.equal(c.audience, 'all'); assert.equal(c.minutes, 120); assert.equal(c.season, ''); assert.equal(c.study.context.length, SM.LIMITS.study);
  assert.deepEqual(c.checks, { verse: true }); assert.equal(c.blocks.length, 1); assert.equal(SM.cleanBlocks(Array.from({ length: 50 }, (_, i) => ({ title: 't' + i }))).length, SM.BLOCK_MAX);
});

test('자동 점검: 본문·핵심·적용·블록·시간·출처를 판정하고, 직접 확인 8개는 따로 센다', () => {
  const empty = SM.cleanSermon({ title: 'x' }); const a0 = Object.fromEntries(SM.autoChecks(empty).map(c => [c.key, c.ok]));
  assert.deepEqual([a0.scripture, a0.idea, a0.apply, a0.blocks, a0.draft, a0.time, a0.sources], [false, false, false, false, false, null, null]);
  const sm = SM.cleanSermon({ title: 'x', scripture: '눅 2:1-7', minutes: 20, core: { idea: '아', apply: '적' }, study: {}, blocks: [{ title: '도입', min: 5, memo: '예화: 이야기' }, { title: '본문', min: 8, memo: 'b' }, { title: '적용', min: 5, memo: 'c' }] });
  let a = Object.fromEntries(SM.autoChecks(sm).map(c => [c.key, c.ok])); assert.deepEqual([a.scripture, a.idea, a.apply, a.blocks, a.draft, a.time, a.sources], [true, true, true, true, true, true, false]);
  assert.equal(SM.totalMin(sm.blocks), 18);
});
test('시간 점검 경계와 원고 글: 목표의 80~120%, 본문 글귀 없이 장·절만', () => {
  const t = m => SM.autoChecks(SM.cleanSermon({ title: 'x', minutes: 20, blocks: [{ title: 'a', min: m }] })).find(c => c.key === 'time').ok;
  assert.deepEqual([t(15), t(16), t(24), t(25)], [false, true, true, false]);
  const sm = SM.cleanSermon({ title: '성탄 설교', scripture: '누가복음 2:1-7', audience: 'teen', season: '성탄절', minutes: 10, core: { idea: '하나님이 우리와 함께하신다', apply: '이웃 환대' }, study: { sources: '주석 A, 12쪽' }, blocks: [{ title: '도입', min: 3, memo: '질문으로 시작' }, { title: '본문', min: 7, memo: '' }] });
  const out = SM.sermonText(sm); assert.match(out, /^성탄 설교\n본문: 누가복음 2:1-7 · 대상: 중고등 · 성탄절 · 목표 10분/); assert.match(out, /\[전하려는 한 문장\] 하나님이 우리와 함께하신다/); assert.match(out, /1\. 도입 \(3분 · 0분째\)\n질문으로 시작/); assert.match(out, /2\. 본문 \(7분 · 3분째\)/); assert.match(out, /\[참고 자료·출처\]\n주석 A, 12쪽/);
  assert.equal(SM.manualDone(SM.cleanSermon({ title: 'x', checks: { verse: true, wesley: true } })), 2); assert.equal(SM.MANUAL_CHECKS.length, 8);
});

test('시작 틀: 모두 올바르고 질문 카드가 있으며, 틀 시간 합계가 현실적이다', () => {
  for (const [k, s] of Object.entries(SM.STRUCTURES)) { const b = SM.starterBlocks(k); assert.equal(b.length, s.blocks.length, k); if (k !== 'blank') { assert.ok(b.every(x => x.guide && x.min > 0), k); assert.ok(SM.totalMin(b) >= 10 && SM.totalMin(b) <= 45, k); } }
  assert.ok(SM.starterBlocks('advent').some(b => /임마누엘/.test(b.title)));
});

test('저장소: 만들기·고치기·복제·삭제·검사, 예배 연결은 비어 있는 본문·제목만 채우고 예배당 노트 하나', () => {
  const s = mk(); s.startEmpty(); const d = s.depts()[0].id;
  assert.throws(() => s.saveSermon({ title: '', dept_id: d }), ValidationError); assert.throws(() => s.saveSermon({ title: 'a', dept_id: 9999 }), ValidationError); assert.throws(() => s.saveSermon({ title: 'a', dept_id: d, service_id: 777 }), ValidationError);
  const sv = s.saveService({ dept_id: d, title: '주일예배', date: '2026-12-06', kind: 'regular' });
  const a = s.saveSermon({ title: '임마누엘', scripture: '마태복음 1:18-25', dept_id: d, service_id: sv, blocks: SM.starterBlocks('advent') });
  assert.equal(s.service(sv).scripture, '마태복음 1:18-25'); assert.equal(s.service(sv).sermon_title, '임마누엘'); assert.equal(s.sermonOfService(sv).id, a);
  s.saveService({ ...s.service(sv), scripture: '직접 적은 본문' }); s.saveSermon({ ...s.sermon(a), scripture: '다른 본문' }); assert.equal(s.service(sv).scripture, '직접 적은 본문', '이미 있는 본문은 덮어쓰지 않는다');
  const b = s.saveSermon({ title: '다른 노트', dept_id: d, service_id: sv }); assert.equal(s.sermon(a).service_id, null); assert.equal(s.sermonOfService(sv).id, b);
  const c = s.duplicateSermon(a); assert.equal(s.sermon(c).title, '임마누엘 (복사)'); assert.equal(s.sermon(c).service_id, null); assert.deepEqual(s.sermon(c).checks, {}); assert.notEqual(s.sermon(c).blocks[0].id, s.sermon(a).blocks[0].id);
  assert.equal(s.sermonForService(sv), b, '이미 있으면 같은 노트'); s.deleteService(sv); assert.equal(s.sermon(b).service_id, null);
  const raw = JSON.parse(JSON.stringify(s.get())); validateState(raw); raw.sermons[0].dept_id = 9999; assert.throws(() => validateState(raw), /설교 노트/);
  s.deleteSermon(a); assert.equal(s.sermon(a), undefined);
});

test('화면 연결: 예배 메뉴·예배 상세 버튼, 5단계 탭, 자동 저장·떠날 때 저장, 점검표, 인쇄 스타일', () => {
  const app = text('js/app.js'); const css = text('style.css');
  for (const k of ["import * as SMN from './sermon.js'", 'sermon: vSermon', 'data-go="#sermon"', 'sermonForService', 'flushSermon()', "addEventListener('pagehide', flushSermon)", 'data-tab=', 'paintSCheck', 'data-ck=', 'SMN.sermonText', 'sermonNew:']) assert.ok(app.includes(k), k);
  assert.ok(/view === 'sermon'/.test(app)); for (const k of ['.stabs', '.spanel.on', '.chk .ok', '.stabs { display:none; }']) assert.ok(css.includes(k), k);
});
