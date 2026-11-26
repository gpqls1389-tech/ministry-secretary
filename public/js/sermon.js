// 설교 작업대(MB12.18): 본문 → 연구 → 핵심 → 구조(블록) → 점검 순서로 설교 준비를 붙잡아 주는 노트.
// 이 파일은 화면 없이 쓰는 정리·점검·글 만들기만 담는다. 성경 본문은 앱이 만들어 넣지 않는다(설교자가 개역개정을 확인해 직접 입력).
export const SERMON_MAX = 300;
export const BLOCK_MAX = 30;
export const REF_MAX = 20;
export const LIMITS = { passage: 3000, refTitle: 60, refSeries: 30, refPages: 30, refNote: 600, title: 80, scripture: 60, season: 20, study: 3000, core: 400, block: 40, memo: 4000, guide: 120, sources: 1500 };
export const AUDIENCES = { all: '세대통합', kid: '유치·유년', elem: '초등', teen: '중고등', youth: '청년', adult: '장년' };
export const SEASONS = ['', '대림절', '성탄절', '송구영신', '주현절', '사순절', '고난주간', '부활절', '성령강림절', '추수감사절', '어린이주일'];

const clip = (v, n) => String(v ?? '').trim().slice(0, n);
const rid = () => Math.random().toString(36).slice(2, 8);

// 직접 확인해야 하는 점검(자동으로 알 수 없는 것들)
export const MANUAL_CHECKS = [
  ['verse', '본문을 개역개정에서 직접 확인해 옮겼다(기억에 의존하지 않았다)'],
  ['context', '앞뒤 문맥에서 벗어나 본문을 끌어다 쓰지 않았다'],
  ['source', '예화·통계·인용마다 출처를 확인했다(없으면 쓰지 않았다)'],
  ['age', '듣는 연령에 맞는 낱말과 길이로 다듬었다'],
  ['wesley', '감리교(웨슬리안) 전통과 신앙고백에 어긋나지 않는지 살폈다'],
  ['debate', '신학적으로 논쟁이 있는 부분을 한쪽 입장으로만 단정하지 않았다'],
  ['privacy', '교인·학생의 사연은 익명으로 바꾸고 개인정보를 뺐다'],
  ['own', '다른 설교자의 원고나 책 문장을 그대로 옮기지 않았다'],
];
const MANUAL_KEYS = MANUAL_CHECKS.map(c => c[0]);

export const cleanBlocks = list => {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  return list.slice(0, BLOCK_MAX).map(x => {
    if (!x || typeof x !== 'object') return null; const title = clip(x.title, LIMITS.block); if (!title) return null;
    let id = /^[a-z0-9]{3,12}$/.test(String(x.id || '')) ? x.id : rid(); while (seen.has(id)) id = rid(); seen.add(id);
    return { id, title, min: Math.max(0, Math.min(120, Math.round(Number(x.min) || 0))), memo: String(x.memo ?? '').slice(0, LIMITS.memo), guide: clip(x.guide, LIMITS.guide) };
  }).filter(Boolean);
};
export const newBlock = (title = '', min = 0, guide = '') => ({ id: rid(), title, min, memo: '', guide });

export function cleanSermon(raw, fail = m => { throw new Error(m); }) {
  const r = raw || {}; const title = clip(r.title, LIMITS.title); if (!title) fail('설교 제목을 입력하세요.');
  const st = r.study || {}; const co = r.core || {}; const ck = r.checks || {};
  return {
    title, scripture: clip(r.scripture, LIMITS.scripture), audience: AUDIENCES[r.audience] ? r.audience : 'all',
    minutes: Math.max(0, Math.min(120, Math.round(Number(r.minutes) || 0))), season: SEASONS.includes(r.season) ? r.season : '',
    study: { context: String(st.context ?? '').slice(0, LIMITS.study), words: String(st.words ?? '').slice(0, LIMITS.study), background: String(st.background ?? '').slice(0, LIMITS.study), sources: String(st.sources ?? '').slice(0, LIMITS.sources) },
    core: { idea: String(co.idea ?? '').slice(0, LIMITS.core), apply: String(co.apply ?? '').slice(0, LIMITS.core), question: String(co.question ?? '').slice(0, LIMITS.core) },
    passage: String(r.passage ?? '').slice(0, LIMITS.passage),
    refs: (Array.isArray(r.refs) ? r.refs : []).slice(0, REF_MAX).map(x => ({ title: clip(x && x.title, LIMITS.refTitle), series: clip(x && x.series, LIMITS.refSeries), pages: clip(x && x.pages, LIMITS.refPages), note: String((x && x.note) ?? '').slice(0, LIMITS.refNote) })).filter(x => x.title),
    blocks: cleanBlocks(r.blocks), checks: Object.fromEntries(MANUAL_KEYS.filter(k => ck[k] === true).map(k => [k, true])),
  };
}

export const totalMin = blocks => blocks.reduce((a, b) => a + (b.min || 0), 0);
export const manualDone = sm => MANUAL_KEYS.filter(k => sm.checks && sm.checks[k]).length;
export function blockTimes(blocks) { let acc = 0; return blocks.map(b => { const at = acc; acc += b.min || 0; return at; }); } // 시작 후 몇 분째

// 화면에서 바로 알 수 있는 점검. ok: true(됐음) / false(비어 있음) / null(참고)
export function autoChecks(sm) {
  const tot = totalMin(sm.blocks); const filled = sm.blocks.filter(b => String(b.memo || '').trim()).length; const out = [];
  out.push({ key: 'scripture', ok: !!sm.scripture, label: '본문(장·절)을 적었다', detail: sm.scripture || '본문 탭에서 입력하세요.' });
  out.push({ key: 'passage', ok: !!String(sm.passage || '').trim(), label: '본문 글귀를 직접 붙여 넣어 두었다', detail: String(sm.passage || '').trim() ? '' : '② 연구 탭에서 개역개정을 확인해 붙여 넣으면 주제 확인에 쓰여요.' });
  out.push({ key: 'refs', ok: (sm.refs || []).length > 0, label: '참고 주석을 한 권 이상 확인하고 기록했다', detail: (sm.refs || []).length ? `${sm.refs.length}권 기록` : '② 연구 탭의 ‘참고 주석 서가’에서 기록하세요.' });
  out.push({ key: 'idea', ok: !!String(sm.core.idea).trim(), label: '전하려는 한 문장이 있다', detail: sm.core.idea ? '' : '핵심 탭에서 한 문장으로 적어 보세요.' });
  out.push({ key: 'apply', ok: !!String(sm.core.apply).trim(), label: '적용이 한 가지로 정리돼 있다', detail: sm.core.apply ? '' : '핵심 탭의 ‘적용 한 가지’를 적어 보세요.' });
  out.push({ key: 'blocks', ok: sm.blocks.length >= 3, label: '구조 블록이 3개 이상이다', detail: `현재 ${sm.blocks.length}개` });
  out.push({ key: 'draft', ok: sm.blocks.length > 0 && filled === sm.blocks.length, label: '모든 블록에 내용(메모·원고)이 있다', detail: sm.blocks.length ? `${filled}/${sm.blocks.length}개 작성` : '' });
  if (sm.minutes) { const lo = sm.minutes * 0.8, hi = sm.minutes * 1.2; out.push({ key: 'time', ok: tot >= lo && tot <= hi, label: `시간이 목표(${sm.minutes}분) 안에 든다`, detail: `블록 합계 ${tot}분` }); }
  else out.push({ key: 'time', ok: null, label: '목표 시간을 정하지 않았다', detail: '본문 탭에서 목표 시간(분)을 정하면 점검해 드려요.' });
  const mentionsStory = sm.blocks.some(b => /예화|통계|인용|사례/.test(`${b.title} ${b.memo}`));
  out.push({ key: 'sources', ok: mentionsStory ? !!(String(sm.study.sources).trim() || (sm.refs || []).length) : null, label: '예화·인용이 있으면 출처 칸이 채워져 있다', detail: mentionsStory ? (String(sm.study.sources).trim() || (sm.refs || []).length ? '' : '연구 탭의 ‘참고 자료·출처’에 적어 두세요.') : '예화·인용 표시가 없어요.' });
  return out;
}

// 인쇄·복사용 원고. 본문 글귀는 넣지 않고 장·절만 적는다.
export function sermonText(sm, audienceLabel = AUDIENCES[sm.audience]) {
  const at = blockTimes(sm.blocks); const L = [];
  L.push(sm.title, `본문: ${sm.scripture || '(미정)'} · 대상: ${audienceLabel}${sm.season ? ' · ' + sm.season : ''}${sm.minutes ? ` · 목표 ${sm.minutes}분` : ''}`);
  if (String(sm.core.idea).trim()) L.push('', `[전하려는 한 문장] ${sm.core.idea.trim()}`);
  if (String(sm.core.apply).trim()) L.push(`[적용 한 가지] ${sm.core.apply.trim()}`);
  if (String(sm.core.question).trim()) L.push(`[청중의 질문] ${sm.core.question.trim()}`);
  sm.blocks.forEach((b, i) => { L.push('', `${i + 1}. ${b.title}${b.min ? ` (${b.min}분 · ${at[i]}분째)` : ''}`); if (String(b.memo).trim()) L.push(b.memo.trim()); });
  if (String(sm.study.sources).trim() || (sm.refs || []).length) { L.push('', '[참고 자료·출처]'); if (String(sm.study.sources).trim()) L.push(sm.study.sources.trim()); for (const r of sm.refs || []) L.push(`- ${r.title}${r.series ? ` (${r.series})` : ''}${r.pages ? ` ${r.pages}쪽` : ''}${r.note ? ` — ${r.note.replace(/\n/g, ' ')}` : ''}`); }
  return L.join('\n');
}

// ----- 시작 틀(질문 카드 guide 는 칸의 안내 글로만 쓴다) -----
const B = (title, min, guide) => ({ title, min, guide });
export const STRUCTURES = {
  blank: { name: '빈 노트', blocks: [] },
  three: { name: '정식 설교(세 대지)', blocks: [B('도입', 3, '듣는 이의 삶에서 본문으로 들어가는 질문이나 장면은?'), B('본문 읽기와 배경', 4, '본문의 앞뒤 문맥과 기록된 상황은?'), B('첫째 대지', 6, '본문이 먼저 말하는 것은? 근거 절은?'), B('둘째 대지', 6, '본문이 이어서 말하는 것은?'), B('셋째 대지', 6, '본문이 가리키는 복음(그리스도)은?'), B('적용', 4, '이번 주에 할 수 있는 한 가지 삶의 응답은?'), B('결단과 기도', 3, '무엇을 구하며 기도로 맺을까?')] },
  story: { name: '이야기식 설교', blocks: [B('시작 이야기', 4, '어떤 장면으로 시작할까? (실제 사연은 익명으로)'), B('본문 속으로', 8, '본문 인물의 처지와 마음은?'), B('긴장과 전환', 5, '이야기가 바뀌는 지점은?'), B('복음의 응답', 6, '하나님이 하신 일은 무엇인가?'), B('삶으로', 4, '오늘 우리의 자리에서는?'), B('기도', 3, '어떤 말로 기도하며 끝낼까?')] },
  short: { name: '짧은 말씀(어린이·청소년)', blocks: [B('시작 질문', 2, '아이들이 대답할 수 있는 쉬운 질문은?'), B('본문 이야기', 5, '쉬운 낱말로 다시 들려주면?'), B('한 가지 핵심', 3, '기억했으면 하는 한 문장은?'), B('활동 연결', 3, '공과·활동과 어떻게 이어질까?'), B('기도', 2, '따라 할 수 있는 짧은 기도는?')] },
  advent: { name: '대림·성탄 설교', blocks: [B('기다림의 자리', 4, '오늘 우리는 무엇을 기다리는가?'), B('본문 풀이', 8, '본문이 약속하고 선포하는 것은?'), B('임마누엘의 의미', 6, '하나님이 사람이 되어 우리와 함께하심은 무엇을 뜻하나?'), B('이웃에게', 4, '환대와 나눔으로 어떻게 응답할까?'), B('기도', 3, '대림·성탄의 소망을 담은 기도는?')] },
};
export const starterBlocks = key => cleanBlocks((STRUCTURES[key] || STRUCTURES.blank).blocks);
