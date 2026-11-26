// 예배 순서지(MB12.16): 블록(순서)과 파트(묶음 제목)를 끌어서 정리하고, 일반·절기·특별 예배로 나누며, 순서마다 메모를 남긴다.
// 이 파일은 화면 없이 쓰는 계산·검사 부분과, 끌어서 옮기기(마우스·터치 공용) 도우미만 담는다.
import { orderTimes } from './order.js';

export const SHEET_MAX = 200;
export const BLOCK_MAX = 80;
export const LIMITS = { title: 60, block: 40, who: 30, prep: 80, memo: 800, note: 600 };
export const SHEET_TYPES = { regular: '일반 예배', season: '절기 예배', special: '특별 예배' };
export const SEASONS = ['대림절', '성탄절', '송구영신', '신년', '주현절', '사순절', '고난주간', '부활절', '성령강림절', '추수감사절', '어린이주일', '기타'];

const clip = (v, n) => String(v ?? '').trim().slice(0, n);
const rid = () => Math.random().toString(36).slice(2, 8);
const isTime = s => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s || ''));

export function cleanBlocks(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  return list.slice(0, BLOCK_MAX).map(x => {
    if (!x || typeof x !== 'object') return null;
    const part = x.kind === 'part'; const title = clip(x.title, part ? LIMITS.title : LIMITS.block);
    if (!title) return null;
    let id = /^[a-z0-9]{3,12}$/.test(String(x.id || '')) ? x.id : rid(); while (seen.has(id)) id = rid(); seen.add(id);
    if (part) return { id, kind: 'part', title, memo: clip(x.memo, LIMITS.memo) };
    return { id, kind: 'item', title, who: clip(x.who, LIMITS.who), min: Math.max(0, Math.min(240, Math.round(Number(x.min) || 0))), prep: clip(x.prep, LIMITS.prep), memo: clip(x.memo, LIMITS.memo) };
  }).filter(Boolean);
}

// 저장 전 정리: 알 수 없는 값은 버리고 길이·종류를 맞춘다. 제목이 비어 있으면 오류.
export function cleanSheet(raw, fail = m => { throw new Error(m); }) {
  const r = raw || {};
  const title = clip(r.title, LIMITS.title); if (!title) fail('순서지 제목을 입력하세요.');
  const type = SHEET_TYPES[r.type] ? r.type : 'regular';
  return { title, type, season: type === 'season' ? clip(r.season, 20) : '', time: isTime(r.time) ? r.time : '', note: clip(r.note, LIMITS.note), blocks: cleanBlocks(r.blocks) };
}

// 시각 계산용: 파트는 0분으로 취급
const asOrder = blocks => blocks.map(b => ({ min: b.kind === 'part' ? 0 : b.min || 0 }));
export const blockTimes = (blocks, start) => orderTimes(asOrder(blocks), start);
export const totalMin = blocks => blocks.reduce((a, b) => a + (b.kind === 'part' ? 0 : b.min || 0), 0);
export const countItems = blocks => blocks.filter(b => b.kind === 'item').length;
export const itemNumbers = blocks => { let n = 0; return blocks.map(b => (b.kind === 'part' ? 0 : ++n)); };
// 파트별 소요(분)와 순서 개수. 첫 파트 앞의 순서는 title '' 으로 묶는다.
export function partSummary(blocks) {
  const out = []; let cur = null;
  for (const b of blocks) {
    if (b.kind === 'part') { cur = { title: b.title, min: 0, count: 0 }; out.push(cur); continue; }
    if (!cur) { cur = { title: '', min: 0, count: 0 }; out.push(cur); }
    cur.min += b.min || 0; cur.count++;
  }
  return out;
}
export function moveBlock(blocks, from, to) {
  if (from === to || from < 0 || to < 0 || from >= blocks.length || to >= blocks.length) return blocks;
  const a = blocks.slice(); const [x] = a.splice(from, 1); a.splice(to, 0, x); return a;
}
export const newBlock = (kind, title = '', min = 0) => (kind === 'part' ? { id: rid(), kind: 'part', title, memo: '' } : { id: rid(), kind: 'item', title, who: '', min, prep: '', memo: '' });

// 서비스(예배)에 붙이는 순서 목록으로 바꾸기(파트는 part:true 로 표시)
export const toServiceItems = blocks => blocks.map(b => (b.kind === 'part' ? { title: b.title, part: true, min: 0, who: '', prep: '', memo: b.memo || '' } : { title: b.title, who: b.who, min: b.min, prep: b.prep, memo: b.memo }));
export const fromServiceItems = items => (Array.isArray(items) ? items : []).map(x => (x.part ? newBlock('part', x.title) : { ...newBlock('item', x.title, x.min), who: x.who || '', prep: x.prep || '', memo: x.memo || '' }));

export function sheetText(sh) {
  const at = blockTimes(sh.blocks, sh.time); const no = itemNumbers(sh.blocks);
  const head = `${sh.title} (${SHEET_TYPES[sh.type] || ''}${sh.season ? ' · ' + sh.season : ''})`;
  const meta = `${sh.time ? `${sh.time} 시작 · ` : ''}총 ${totalMin(sh.blocks)}분`;
  const lines = sh.blocks.map((b, i) => {
    if (b.kind === 'part') return `\n■ ${b.title}${at[i] && sh.time ? ` (${at[i]})` : ''}${b.memo ? `\n   메모: ${b.memo}` : ''}`;
    return `${no[i]}. ${b.title}${b.who ? ' — ' + b.who : ''}${b.min ? ` (${b.min}분${at[i] ? ', ' + at[i] : ''})` : ''}${b.prep ? ' · 준비: ' + b.prep : ''}${b.memo ? `\n   메모: ${b.memo.replace(/\n/g, '\n   ')}` : ''}`;
  });
  return [head, meta, ...(sh.note ? [`참고: ${sh.note}`] : []), ...lines].join('\n').replace(/\n{3,}/g, '\n\n');
}

// ----- 블록 보관함(제목과 표준 시간만. 찬양·캐롤 가사나 성경 본문은 넣지 않는다) -----
export const LIBRARY = [
  { name: '모임', items: [['예배로 부름', 2], ['묵상 기도', 2], ['찬양', 10], ['사도신경', 1], ['신앙 고백', 1], ['주기도문', 1]] },
  { name: '말씀', items: [['대표 기도', 2], ['성경 봉독', 2], ['암송 말씀', 3], ['말씀', 15], ['영상 시청', 5], ['공과·활동', 10], ['분반 모임', 10]] },
  { name: '응답·파송', items: [['결단 기도', 3], ['결단 찬양', 3], ['헌금(봉헌)', 2], ['나눔 헌금 소개', 2], ['광고', 3], ['교제·나눔', 5], ['축도', 2], ['파송(송영)', 1]] },
  { name: '대림절', items: [['대림초 점화', 3], ['대림절 기도', 2], ['대림 묵상 나눔', 5], ['마라나타 고백', 1]] },
  { name: '성탄절', items: [['성탄 이야기 낭독', 5], ['임마누엘 선포', 1], ['성탄 발표(성극·찬양)', 15], ['이웃 나눔 소개', 3], ['성탄 인사 나눔', 3]] },
  { name: '사순·부활', items: [['사순절 묵상', 5], ['십자가 앞 기도', 3], ['부활 선포', 1], ['부활 감사 나눔', 5]] },
  { name: '감사·특별', items: [['감사 고백 나눔', 5], ['감사 예물 드림', 2], ['세례·입교 예식', 10], ['임명·위촉', 5], ['졸업·진급 축하', 5]] },
];
export const PART_NAMES = ['모이는 시간', '말씀의 시간', '응답과 봉헌', '파송'];

// ----- 시작 틀 -----
const mk = groups => groups.flatMap(([p, items]) => [{ kind: 'part', title: p }, ...items.map(([title, min]) => ({ kind: 'item', title, min }))]);
export const STARTERS = {
  blank: { name: '빈 순서지', type: 'regular', season: '', blocks: [] },
  kid: { name: '어린이 예배(약 45분)', type: 'regular', season: '', blocks: mk([['모이는 시간', [['입례·묵상 기도', 2], ['찬양', 10], ['대표 기도', 2]]], ['말씀의 시간', [['성경 봉독', 2], ['말씀', 12], ['공과·활동', 10]]], ['응답과 파송', [['헌금(봉헌)', 2], ['광고', 3], ['축도', 2]]]]) },
  teen: { name: '중고등부 예배(약 60분)', type: 'regular', season: '', blocks: mk([['모이는 시간', [['찬양', 15], ['대표 기도', 3]]], ['말씀의 시간', [['성경 봉독', 2], ['말씀', 20], ['결단 기도', 3]]], ['응답과 파송', [['헌금(봉헌)', 2], ['광고', 3], ['축도', 2], ['분반 모임', 10]]]]) },
  youth: { name: '청년 예배(약 60분)', type: 'regular', season: '', blocks: mk([['모이는 시간', [['찬양', 15], ['대표 기도', 3]]], ['말씀의 시간', [['성경 봉독', 2], ['말씀', 25], ['결단 기도', 5]]], ['응답과 파송', [['헌금(봉헌)', 2], ['광고·교제', 6], ['파송(축도)', 2]]]]) },
  advent: { name: '대림절 예배(대림초 점화 포함)', type: 'season', season: '대림절', blocks: mk([['모이는 시간', [['예배로 부름', 2], ['대림초 점화', 3], ['찬양', 10]]], ['말씀의 시간', [['성경 봉독', 2], ['말씀', 15], ['대림 묵상 나눔', 5]]], ['응답과 파송', [['결단 기도', 3], ['나눔 헌금 소개', 2], ['축도', 2]]]]) },
  christmas: { name: '성탄 축하 예배', type: 'season', season: '성탄절', blocks: mk([['모이는 시간', [['예배로 부름', 2], ['찬양', 8], ['대표 기도', 2]]], ['성탄을 맞이하는 시간', [['성탄 이야기 낭독', 5], ['성탄 발표(성극·찬양)', 15], ['말씀', 12]]], ['응답과 파송', [['임마누엘 선포', 1], ['이웃 나눔 소개', 3], ['헌금(봉헌)', 2], ['축도', 2]]]]) },
  lent: { name: '사순절 예배', type: 'season', season: '사순절', blocks: mk([['모이는 시간', [['예배로 부름', 2], ['사순절 묵상', 5], ['찬양', 8]]], ['말씀의 시간', [['성경 봉독', 2], ['말씀', 15], ['십자가 앞 기도', 3]]], ['응답과 파송', [['헌금(봉헌)', 2], ['축도', 2]]]]) },
  easter: { name: '부활절 예배', type: 'season', season: '부활절', blocks: mk([['모이는 시간', [['부활 선포', 1], ['찬양', 10], ['대표 기도', 2]]], ['말씀의 시간', [['성경 봉독', 2], ['말씀', 15], ['부활 감사 나눔', 5]]], ['응답과 파송', [['헌금(봉헌)', 2], ['광고', 3], ['축도', 2]]]]) },
  thanks: { name: '추수감사 예배', type: 'season', season: '추수감사절', blocks: mk([['모이는 시간', [['예배로 부름', 2], ['찬양', 10], ['대표 기도', 2]]], ['말씀의 시간', [['성경 봉독', 2], ['말씀', 15], ['감사 고백 나눔', 5]]], ['응답과 파송', [['감사 예물 드림', 3], ['광고', 3], ['축도', 2]]]]) },
  special: { name: '특별 예배(세례·임명 등)', type: 'special', season: '', blocks: mk([['모이는 시간', [['예배로 부름', 2], ['찬양', 8]]], ['예식', [['세례·입교 예식', 10], ['임명·위촉', 5]]], ['말씀과 파송', [['말씀', 15], ['헌금(봉헌)', 2], ['축도', 2]]]]) },
};
export const starterBlocks = key => cleanBlocks((STARTERS[key] || STARTERS.blank).blocks);

// ----- 끌어서 옮기기(마우스·터치·펜 공용). 손잡이(.whandle)를 잡고 끌면 같은 목록 안에서 자리가 바뀐다 -----
// onDone(from, to): 놓았을 때 한 번 호출. 글자 입력칸을 잡은 경우에는 끌기가 시작되지 않는다.
export function enableDrag(list, onDone) {
  let st = null;
  const items = () => [...list.querySelectorAll(':scope > .wblk')];
  const move = e => {
    if (!st || e.pointerId !== st.pid) return;
    const y = e.clientY; if (y < 70) window.scrollBy(0, -14); else if (y > window.innerHeight - 70) window.scrollBy(0, 14);
    for (const o of items()) { if (o === st.el) continue; const r = o.getBoundingClientRect(); if (y >= r.top && y <= r.bottom) { if (y > r.top + r.height / 2) o.after(st.el); else o.before(st.el); break; } }
  };
  const up = e => {
    if (!st || e.pointerId !== st.pid) return;
    const el = st.el; const to = items().indexOf(el); const from = st.from; st = null;
    window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
    el.classList.remove('dragging'); list.classList.remove('sorting');
    if (to !== from) onDone(from, to);
  };
  // 자리를 바꾸면 요소가 문서에서 빠졌다 들어가 포인터 캡처가 풀리므로, 창 전체에서 움직임을 듣는다
  list.addEventListener('pointerdown', e => {
    const h = e.target.closest('.whandle'); if (!h || (e.button !== undefined && e.button !== 0)) return;
    const el = h.closest('.wblk'); if (!el) return; e.preventDefault();
    st = { el, from: items().indexOf(el), pid: e.pointerId }; el.classList.add('dragging'); list.classList.add('sorting');
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  });
}
