// 예배 순서 짜기: 순서마다 담당·시간(분)·준비물·메모. 시작 시각에서 차례로 시각을 계산하고, 글 순서(order_text)도 함께 만든다.
export const ORDER_MAX = 30;
export const ORDER_FIELDS = { title: 40, who: 30, prep: 80, memo: 200 };
export const ORDER_PRESETS = {
  kid: { name: '어린이 예배(약 45분)', items: [['입례·묵상 기도', 2], ['찬양', 10], ['대표 기도', 2], ['성경 봉독', 2], ['말씀', 12], ['공과·활동', 10], ['감사 헌금', 2], ['광고', 3], ['축도', 2]] },
  teen: { name: '중고등부 예배(약 60분)', items: [['찬양', 15], ['대표 기도', 3], ['성경 봉독', 2], ['말씀', 20], ['결단 기도', 3], ['헌금', 2], ['광고', 3], ['축도', 2], ['분반 모임', 10]] },
  youth: { name: '청년 예배(약 60분)', items: [['찬양', 15], ['대표 기도', 3], ['성경 봉독', 2], ['말씀', 25], ['결단 기도', 5], ['헌금', 2], ['광고·교제', 6], ['파송(축도)', 2]] },
  advent: { name: '대림절 예배(대림초 점화 포함)', items: [['입례', 2], ['대림초 점화와 기도', 3], ['찬양', 10], ['성경 봉독', 2], ['말씀', 15], ['기도·결단', 3], ['나눔 헌금', 2], ['축도', 2]] },
};
const clip = (v, n) => String(v ?? '').trim().slice(0, n);
export function cleanOrder(items) {
  if (!Array.isArray(items)) return [];
  return items.slice(0, ORDER_MAX).map(x => ({ title: clip(x.title, ORDER_FIELDS.title), who: clip(x.who, ORDER_FIELDS.who), min: Math.max(0, Math.min(240, Math.round(Number(x.min) || 0))), prep: clip(x.prep, ORDER_FIELDS.prep), memo: clip(x.memo, ORDER_FIELDS.memo) })).filter(x => x.title);
}
export const presetItems = key => (ORDER_PRESETS[key] || ORDER_PRESETS.kid).items.map(([title, min]) => ({ title, who: '', min, prep: '', memo: '' }));
// 'HH:MM' + 분 → 'HH:MM'
const addMin = (hm, m) => { const [h, mm] = String(hm).split(':').map(Number); if (!Number.isFinite(h) || !Number.isFinite(mm)) return ''; const t = (h * 60 + mm + m) % 1440; return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; };
export function orderTimes(items, start) { let acc = 0; return items.map(x => { const at = start ? addMin(start, acc) : ''; acc += x.min || 0; return at; }); }
export const orderTotal = items => items.reduce((a, x) => a + (x.min || 0), 0);
export function orderText(items, start = '') {
  const at = orderTimes(items, start);
  return items.map((x, i) => `${i + 1}. ${x.title}${x.who ? ' — ' + x.who : ''}${x.min ? ` (${x.min}분${at[i] ? ', ' + at[i] : ''})` : ''}${x.prep ? ' · 준비: ' + x.prep : ''}`).join('\n');
}
// 예전 글 순서('1. 찬양' 줄들)를 칸으로 바꾸기
export const parseOrderText = text => String(text || '').split('\n').map(l => l.replace(/^\s*\d+[.)]\s*/, '').trim()).filter(Boolean).slice(0, ORDER_MAX).map(title => ({ title: title.slice(0, ORDER_FIELDS.title), who: '', min: 0, prep: '', memo: '' }));
