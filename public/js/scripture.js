// 본문 장·절 인식, 책 갈래(장르), 주석 서가(파일 이름만으로 책 정보 만들기), 주제 확인(참고용), 구조 틀 추천.
// 성경 본문 글귀는 이 앱에 들어 있지 않다. 여기서는 장·절 표기와 설교자가 직접 적은 글만 다룬다.

// [번호, 이름, 줄임말들, 갈래] 갈래: law 율법, hist 역사, wis 시가·지혜, proph 예언, gospel 복음서, acts 사도행전, epi 서신, apoc 묵시
export const BOOKS = [
  [1, '창세기', ['창'], 'law'], [2, '출애굽기', ['출'], 'law'], [3, '레위기', ['레'], 'law'], [4, '민수기', ['민'], 'law'], [5, '신명기', ['신'], 'law'],
  [6, '여호수아', ['수'], 'hist'], [7, '사사기', ['삿'], 'hist'], [8, '룻기', ['룻'], 'hist'], [9, '사무엘상', ['삼상'], 'hist'], [10, '사무엘하', ['삼하'], 'hist'],
  [11, '열왕기상', ['왕상'], 'hist'], [12, '열왕기하', ['왕하'], 'hist'], [13, '역대상', ['대상'], 'hist'], [14, '역대하', ['대하'], 'hist'], [15, '에스라', ['스'], 'hist'],
  [16, '느헤미야', ['느'], 'hist'], [17, '에스더', ['에'], 'hist'], [18, '욥기', ['욥'], 'wis'], [19, '시편', ['시'], 'wis'], [20, '잠언', ['잠'], 'wis'],
  [21, '전도서', ['전'], 'wis'], [22, '아가', ['아'], 'wis'], [23, '이사야', ['사'], 'proph'], [24, '예레미야', ['렘'], 'proph'], [25, '예레미야애가', ['애'], 'wis'],
  [26, '에스겔', ['겔'], 'proph'], [27, '다니엘', ['단'], 'proph'], [28, '호세아', ['호'], 'proph'], [29, '요엘', ['욜'], 'proph'], [30, '아모스', ['암'], 'proph'],
  [31, '오바댜', ['옵'], 'proph'], [32, '요나', ['욘'], 'proph'], [33, '미가', ['미'], 'proph'], [34, '나훔', ['나'], 'proph'], [35, '하박국', ['합'], 'proph'],
  [36, '스바냐', ['습'], 'proph'], [37, '학개', ['학'], 'proph'], [38, '스가랴', ['슥'], 'proph'], [39, '말라기', ['말'], 'proph'],
  [40, '마태복음', ['마'], 'gospel'], [41, '마가복음', ['막'], 'gospel'], [42, '누가복음', ['눅'], 'gospel'], [43, '요한복음', ['요'], 'gospel'], [44, '사도행전', ['행'], 'acts'],
  [45, '로마서', ['롬'], 'epi'], [46, '고린도전서', ['고전'], 'epi'], [47, '고린도후서', ['고후'], 'epi'], [48, '갈라디아서', ['갈'], 'epi'], [49, '에베소서', ['엡'], 'epi'],
  [50, '빌립보서', ['빌'], 'epi'], [51, '골로새서', ['골'], 'epi'], [52, '데살로니가전서', ['살전'], 'epi'], [53, '데살로니가후서', ['살후'], 'epi'], [54, '디모데전서', ['딤전'], 'epi'],
  [55, '디모데후서', ['딤후'], 'epi'], [56, '디도서', ['딛'], 'epi'], [57, '빌레몬서', ['몬'], 'epi'], [58, '히브리서', ['히'], 'epi'], [59, '야고보서', ['약'], 'epi'],
  [60, '베드로전서', ['벧전'], 'epi'], [61, '베드로후서', ['벧후'], 'epi'], [62, '요한일서', ['요일'], 'epi'], [63, '요한이서', ['요이'], 'epi'], [64, '요한삼서', ['요삼'], 'epi'],
  [65, '유다서', ['유'], 'epi'], [66, '요한계시록', ['계'], 'apoc'],
];
const byId = new Map(BOOKS.map(b => [b[0], b]));
export const bookName = id => (byId.get(id) || [])[1] || '';
export const GENRES = { law: '율법', hist: '역사서', wis: '시가·지혜', proph: '예언서', gospel: '복음서', acts: '사도행전', epi: '서신', apoc: '묵시' };
export const genreOf = id => (byId.get(id) || [])[3] || '';

// 파일 이름에서 책 이름을 찾기 위한 변형(띄어쓰기 제거 후 비교). 긴 이름부터 맞춰서 ‘예레미야애가’가 ‘예레미야’로 잘못 잡히지 않게 한다.
const ALT = [[62, ['요한1서', '요한일서']], [63, ['요한2서', '요한이서']], [64, ['요한3서', '요한삼서']], [46, ['고린도전서', '고린도1서']], [47, ['고린도후서', '고린도2서']], [52, ['데살로니가전서', '데살로니가1서']], [53, ['데살로니가후서', '데살로니가2서']], [54, ['디모데전서', '디모데1서']], [55, ['디모데후서', '디모데2서']], [60, ['베드로전서', '베드로1서']], [61, ['베드로후서', '베드로2서']], [9, ['사무엘상', '사무엘서상']], [10, ['사무엘하', '사무엘서하']], [11, ['열왕기상']], [12, ['열왕기하']], [13, ['역대상', '역대기상']], [14, ['역대하', '역대기하']], [19, ['시편']], [8, ['룻기']], [18, ['욥기']], [17, ['에스더']], [65, ['유다서']], [43, ['요한복음']], [66, ['요한계시록']]];
const NAMES = (() => { const m = new Map(); for (const b of BOOKS) m.set(b[1], b[0]); for (const [id, ns] of ALT) for (const n of ns) m.set(n, id); return [...m.entries()].sort((a, b) => b[0].length - a[0].length); })();
const ABBR = new Map(BOOKS.flatMap(b => b[2].map(a => [a, b[0]])));

// 문자열에서 성경 책 번호들을 찾는다(파일 이름·제목용). 이름이 겹치는 경우(요한복음/요한일서…)는 긴 이름 우선.
export function detectBooks(text) {
  const raw = String(text || ''); let s = raw.replace(/s+/g, ''); const found = [];
  for (const [n, id] of NAMES) {
    if (n.length <= 2) { if (new RegExp('(^|[^가-힣])' + n + '(?![가-힣])').test(raw) && !found.includes(id)) found.push(id); continue; } // 아가·미가·요나 같은 짧은 이름은 낱말 경계에서만
    if (s.includes(n)) { if (!found.includes(id)) found.push(id); s = s.split(n).join('·'); }
  }
  return found.sort((a, b) => a - b);
}

// ‘누가복음 2:1-7’, ‘눅 2:1~7’, ‘시 23’ 같은 표기 → { book, chapter, from, to } (못 읽으면 null)
export function parseRef(text) {
  const t = String(text || '').trim(); if (!t) return null;
  const m = t.match(/^([가-힣0-9]+(?:\s*[가-힣]+)?)\s*(\d{1,3})(?:\s*[:장.]\s*(\d{1,3})(?:\s*[-~–]\s*(\d{1,3}))?)?/);
  if (!m) return null; const name = m[1].replace(/\s+/g, '').replace(/\d+$/, '');
  let id = null; for (const [n, i] of NAMES) if (name === n) { id = i; break; } if (id == null) id = ABBR.get(name) ?? null; if (id == null) { const d = detectBooks(name); id = d.length === 1 ? d[0] : null; }
  if (id == null) return null;
  const chapter = Number(m[2]); const from = m[3] ? Number(m[3]) : null; const to = m[4] ? Number(m[4]) : from;
  if (!chapter || (from && to && to < from)) return null;
  return { book: id, chapter, from, to };
}
export const refText = r => (r ? `${bookName(r.book)} ${r.chapter}${r.from ? `:${r.from}${r.to && r.to !== r.from ? `-${r.to}` : ''}` : ''}` : '');

// ----- 주석 서가: 파일 이름만 읽는다(내용은 열지 않는다) -----
export const SHELF_MAX = 1500;
const DOC = /\.(pdf|epub|docx?|hwpx?|txt|mobi)$/i;
export function parseShelfPaths(paths) {
  const out = []; const seen = new Set();
  for (const p of paths || []) {
    const parts = String(p).split(/[\\/]/).filter(Boolean); const file = parts.pop() || ''; if (!DOC.test(file) || file.startsWith('.')) continue;
    const title = file.replace(DOC, '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60); if (!title) continue;
    const series = (parts.slice(0, 2).join(' / ') || '').slice(0, 30); const key = `${series}|${title}`; if (seen.has(key)) continue; seen.add(key);
    out.push({ title, series, books: detectBooks(`${title} ${parts.join(' ')}`) });
  }
  return out;
}
// 이 본문의 책을 다루는 서가 항목. 책이 하나도 감지되지 않은 항목(사전·지도 등)은 ‘일반’으로 따로 둔다.
export function shelfFor(shelf, bookId) {
  const hit = shelf.filter(x => x.books.includes(bookId)); const general = shelf.filter(x => !x.books.length);
  return { hit, general };
}

// ----- 주제 확인(참고용 · 낱말 겹침 정도만 본다. 신학적 판단은 설교자의 몫) -----
const JOSA = ['으로부터', '에게서', '으로써', '께서는', '에서는', '이라는', '라는', '하신다', '하셨다', '합니다', '입니다', '에서', '에게', '께서', '으로', '까지', '부터', '처럼', '보다', '이다', '하는', '하신', '하고', '하며', '은', '는', '이', '가', '을', '를', '의', '에', '와', '과', '도', '로', '만'];
export function keywords(text) {
  const toks = String(text || '').split(/[^가-힣A-Za-z0-9]+/).filter(Boolean); const out = [];
  for (let w of toks) { for (const j of JOSA) if (w.length - j.length >= 2 && w.endsWith(j)) { w = w.slice(0, -j.length); break; } if (w.length >= 2 && !out.includes(w)) out.push(w); }
  return out;
}
const hasWord = (hay, w) => hay.includes(w) || (w.length >= 3 && hay.includes(w.slice(0, -1)));
// idea(한 문장)의 낱말 중 본문 글귀·연구 메모에 나오는 것/안 나오는 것, 구조 블록 중 한 문장과 이어지는 낱말이 없는 것
export function themeCheck({ idea, passage, study, blocks }) {
  const kw = keywords(idea); const hay = `${passage || ''}\n${study || ''}`; const res = { keywords: kw, inText: [], notInText: [], hasPassage: !!String(passage || '').trim(), loose: [] };
  if (!kw.length) return res;
  for (const w of kw) (hasWord(hay, w) ? res.inText : res.notInText).push(w);
  for (const b of blocks || []) { const t = `${b.title} ${b.memo}`; if (String(b.memo || '').trim().length >= 20 && !kw.some(w => hasWord(t, w))) res.loose.push(b.title); }
  return res;
}

// ----- 구조 틀 추천 -----
export function recommendStructure({ book, audience, season, minutes }) {
  const g = genreOf(book); const reasons = [];
  if (/대림|성탄/.test(season || '')) return { key: 'advent', reason: `${season} 절기라서 대림·성탄 설교 틀을 추천해요.` };
  if (audience === 'kid' || audience === 'elem' || audience === 'teen' || (minutes && minutes <= 15)) return { key: 'short', reason: audience === 'adult' || audience === 'all' ? `목표 시간이 ${minutes}분이라 짧은 말씀 틀을 추천해요.` : '듣는 연령이 어려서 짧고 쉬운 짧은 말씀 틀을 추천해요.' };
  if (['gospel', 'acts', 'hist', 'law'].includes(g)) return { key: 'story', reason: `${GENRES[g]}는 이야기 흐름이 있어 이야기식 설교 틀이 잘 맞아요. 본문이 논증이면 세 대지 틀도 좋아요.` };
  if (['epi', 'wis', 'proph', 'apoc'].includes(g)) return { key: 'three', reason: `${GENRES[g]}는 주장과 근거가 이어져 세 대지 틀이 잘 맞아요.` };
  return { key: 'three', reason: reasons[0] || '본문을 인식하지 못해 기본인 정식 설교(세 대지) 틀을 추천해요.' };
}
