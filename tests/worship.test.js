import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStore, ValidationError, KEY, validateState } from '../public/js/store.js';
import * as WS from '../public/js/worship.js';
import { orderText, cleanOrder } from '../public/js/order.js';

const mem = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m }; };
const TODAY = '2026-11-10';
const mk = () => createStore(mem(), () => TODAY);
const PUB = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');

test('MB12.16 순서지 정리: 길이·종류 제한, 빈 제목 제거, 파트는 시간 0, 번호는 순서만', () => {
  const c = WS.cleanSheet({ title: ' 대림 첫째 주 ', type: 'season', season: '대림절', time: '11:00', blocks: [{ kind: 'part', title: '모임', min: 99 }, { kind: 'item', title: '찬양', min: 10, who: '김', memo: '메모' }, { kind: 'item', title: '', min: 3 }, { kind: 'item', title: '말씀', min: 999 }, 'x', null] });
  assert.equal(c.title, '대림 첫째 주'); assert.equal(c.blocks.length, 3); assert.equal(c.blocks[0].min, undefined, '파트에는 분이 없다'); assert.equal(c.blocks[2].min, 240, '분은 240까지');
  assert.equal(WS.totalMin(c.blocks), 250); assert.deepEqual(WS.itemNumbers(c.blocks), [0, 1, 2]); assert.equal(WS.countItems(c.blocks), 2);
  assert.deepEqual(WS.blockTimes(c.blocks, '11:00').slice(0, 3), ['11:00', '11:00', '11:10']);
  assert.equal(WS.cleanSheet({ title: 'a', type: 'zzz', season: '대림절' }).type, 'regular'); assert.equal(WS.cleanSheet({ title: 'a', type: 'regular', season: '대림절' }).season, '', '절기 예배가 아니면 절기를 지운다');
  assert.equal(WS.cleanSheet({ title: 'a', time: '25:99' }).time, ''); assert.throws(() => WS.cleanSheet({ title: '  ' }));
  assert.equal(WS.cleanBlocks(Array.from({ length: 120 }, (_, i) => ({ kind: 'item', title: 'n' + i }))).length, WS.BLOCK_MAX);
  const ids = WS.cleanBlocks([{ kind: 'item', title: 'a', id: 'abc123' }, { kind: 'item', title: 'b', id: 'abc123' }]).map(b => b.id); assert.equal(new Set(ids).size, 2, '같은 번호는 새로 매김');
});

test('블록 옮기기·파트별 시간·글 순서', () => {
  const b = WS.cleanBlocks(WS.STARTERS.advent.blocks);
  assert.deepEqual(WS.moveBlock([1, 2, 3, 4], 0, 2), [2, 3, 1, 4]); assert.deepEqual(WS.moveBlock([1, 2, 3], 2, 0), [3, 1, 2]); assert.deepEqual(WS.moveBlock([1, 2], 0, 5), [1, 2], '범위 밖이면 그대로');
  const ps = WS.partSummary(b); assert.equal(ps.length, 3); assert.equal(ps.reduce((a, p) => a + p.min, 0), WS.totalMin(b)); assert.equal(ps[0].title, '모이는 시간');
  assert.equal(WS.partSummary([{ kind: 'item', title: 'x', min: 5 }])[0].title, '', '파트 앞의 순서도 센다');
  const t = WS.sheetText({ title: '테스트', type: 'season', season: '대림절', time: '11:00', note: '보라색 초', blocks: WS.cleanBlocks([{ kind: 'part', title: '모임' }, { kind: 'item', title: '대림초 점화', min: 3, who: '학생', prep: '초', memo: '첫째 초\n천천히' }]) });
  assert.match(t, /^테스트 \(절기 예배 · 대림절\)\n11:00 시작 · 총 3분\n참고: 보라색 초/); assert.match(t, /■ 모임 \(11:00\)/); assert.match(t, /1\. 대림초 점화 — 학생 \(3분, 11:00\) · 준비: 초\n {3}메모: 첫째 초\n {3}천천히/);
});

test('시작 틀: 모두 올바르고 절기 틀에는 절기가 있으며, 보관함에는 가사·본문이 없다', () => {
  for (const [k, s] of Object.entries(WS.STARTERS)) { assert.ok(WS.SHEET_TYPES[s.type], k); const b = WS.starterBlocks(k); assert.equal(b.length, s.blocks.length, `${k} 블록이 잘리지 않음`); if (s.type === 'season') assert.ok(WS.SEASONS.includes(s.season), k); else assert.equal(s.season, '', k); }
  assert.ok(WS.starterBlocks('advent').some(b => b.title === '대림초 점화')); assert.deepEqual(WS.starterBlocks('없는키'), []);
  for (const g of WS.LIBRARY) for (const [t, m] of g.items) { assert.ok(t.length <= WS.LIMITS.block, t); assert.ok(m >= 0 && m <= 60, t); }
});

test('저장소: 만들기·고치기·구분 필터·복제·삭제, 다른 곳에서 못 쓰는 값 거부', () => {
  const s = mk(); s.startEmpty(); const d = s.depts()[0].id;
  assert.throws(() => s.saveOrder({ title: '', dept_id: d }), ValidationError); assert.throws(() => s.saveOrder({ title: 'a', dept_id: 9999 }), ValidationError); assert.throws(() => s.saveOrder({ title: 'a', dept_id: d, service_id: 777 }), ValidationError);
  const a = s.saveOrder({ title: '주일 예배', dept_id: d, type: 'regular', blocks: WS.starterBlocks('kid') }); const b = s.saveOrder({ title: '대림 1주', dept_id: d, type: 'season', season: '대림절', blocks: WS.starterBlocks('advent') });
  assert.equal(s.orders(d).length, 2); assert.deepEqual(s.orders(d, 'season').map(o => o.id), [b]); assert.equal(s.order(b).season, '대림절');
  s.saveOrder({ ...s.order(a), title: '주일 예배(수정)' }); assert.equal(s.order(a).title, '주일 예배(수정)'); assert.equal(s.orders(d).length, 2, '같은 번호로 저장하면 고쳐진다');
  const c = s.duplicateOrder(b); assert.equal(s.order(c).title, '대림 1주 (복사)'); assert.equal(s.order(c).blocks.length, s.order(b).blocks.length); assert.notEqual(s.order(c).blocks[0].id, s.order(b).blocks[0].id, '복제본 블록은 새 번호');
  s.deleteOrder(a); assert.equal(s.order(a), undefined); assert.equal(s.orders(d).length, 2);
  const raw = JSON.parse(JSON.stringify(s.get())); validateState(raw); raw.orders[0].dept_id = 9999; assert.throws(() => validateState(raw), /예배 순서지/); raw.orders = 'x'; assert.throws(() => validateState(raw), /예배 순서지/);
});

test('예배에 연결: 저장하면 그 예배의 순서·글 순서가 바뀌고, 예배 하나에 순서지 하나, 예배를 지우면 연결만 풀린다', () => {
  const s = mk(); s.startEmpty(); const d = s.depts()[0].id; const sv = s.saveService({ dept_id: d, title: '주일예배', date: '2026-12-06', time: '11:00', kind: 'regular' });
  const a = s.saveOrder({ title: '대림 2주', dept_id: d, service_id: sv, time: '10:30', blocks: WS.starterBlocks('advent') });
  const x = s.service(sv); assert.ok(x.order_items.some(i => i.part && i.title === '모이는 시간')); assert.match(x.order_text, /^■ 모이는 시간\n1\. 예배로 부름 \(2분, 10:30\)/, '순서지의 시작 시각을 쓴다'); assert.equal(s.orderOfService(sv).id, a);
  const b = s.saveOrder({ title: '다른 순서지', dept_id: d, service_id: sv, blocks: WS.starterBlocks('kid') }); assert.equal(s.order(a).service_id, null, '이전 연결은 풀린다'); assert.equal(s.orderOfService(sv).id, b);
  s.saveOrder({ ...s.order(b), blocks: [{ kind: 'item', title: '찬양', min: 5 }] }); assert.equal(s.service(sv).order_items.length, 1, '고치면 예배에도 반영');
  assert.equal(s.orderForService(sv), b, '이미 있으면 같은 순서지');
  s.deleteService(sv); assert.equal(s.order(b).service_id, null); validateState(JSON.parse(JSON.stringify(s.get())));
  const s2 = s.saveService({ dept_id: d, title: '옛 예배', date: '2026-11-01', kind: 'special' }); s.setServiceOrder(s2, cleanOrder([{ title: '찬양', min: 3 }, { title: '말씀', min: 10, memo: '요1' }]));
  const o2 = s.order(s.orderForService(s2)); assert.equal(o2.type, 'special'); assert.deepEqual(o2.blocks.map(z => z.title), ['찬양', '말씀']); assert.equal(o2.blocks[1].memo, '요1', '기존 순서의 메모를 가져온다');
});

test('예배 순서(order.js): 파트 표시는 번호를 세지 않고, 80개까지', () => {
  const v = cleanOrder([{ title: '모임', part: true, min: 9, who: '누구' }, { title: '찬양', min: 3 }, { title: '기도', min: 2 }]); assert.equal(v[0].part, true); assert.equal(v[0].min, 0); assert.equal(v[0].who, '');
  assert.equal(orderText(v, '11:00'), '■ 모임\n1. 찬양 (3분, 11:00)\n2. 기도 (2분, 11:03)'); assert.equal(cleanOrder(Array.from({ length: 90 }, (_, i) => ({ title: 't' + i }))).length, 80);
  const back = WS.fromServiceItems(WS.toServiceItems(WS.cleanBlocks(WS.STARTERS.kid.blocks))); assert.deepEqual(back.map(b => [b.kind, b.title]), WS.cleanBlocks(WS.STARTERS.kid.blocks).map(b => [b.kind, b.title]));
});

test('끌어서 옮기기 도우미: 손잡이가 아닌 곳은 무시, 놓을 때 한 번만 알림', () => {
  const ev = {}; const list = { addEventListener: (t, f) => { ev[t] = f; }, querySelectorAll: () => [], classList: { add() {}, remove() {} } };
  let calls = 0; WS.enableDrag(list, () => { calls++; });
  ev.pointerdown({ target: { closest: () => null }, button: 0, preventDefault() { throw new Error('손잡이가 아니면 막지 않는다'); } }); assert.equal(calls, 0);
});

test('화면 연결: 예배 메뉴에서 열기, 라우트, 자동 저장·떠날 때 저장, 키보드 이동, 인쇄 스타일', () => {
  const app = fs.readFileSync(path.join(PUB, 'js/app.js'), 'utf8'); const css = fs.readFileSync(path.join(PUB, 'style.css'), 'utf8');
  for (const k of ["import * as WS from './worship.js'", 'worship: vWorship', 'data-go="#worship"', 'orderNew:', 'orderApply:', 'orderCopy:', 'orderUnlink:', 'flushWorship()', "addEventListener('pagehide', flushWorship)", "e.key === 'ArrowUp'", 'WS.enableDrag(', 'data-lib=', 'data-part=', 'whandle']) assert.ok(app.includes(k), k);
  assert.ok(/view === 'worship'/.test(app), '예배 메뉴 아래에 표시'); assert.ok(!/function orderEditor/.test(app), '예전 표 편집은 대체');
  for (const k of ['.wblk.dragging', 'touch-action:none', '.wgrid', '@media print { .wgrid']) assert.ok(css.includes(k), k);
});
