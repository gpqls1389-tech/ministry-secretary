// PDF에서 읽은 글자(줄 목록)에서 날짜가 있는 줄을 찾아 행사·일정·예배 후보로 만든다. (DOM·PDF 도구와 무관한 순수 함수라 Node 테스트에서도 실행된다)
// 규칙 기반이라 틀릴 수 있다 → 화면에서 사람이 확인·수정한 뒤에만 등록한다. 확실하지 않은 줄에는 경고(warn)를 붙인다.
import { isDate } from './store.js';

const pad = n => String(n).padStart(2, '0');
const WD = '일월화수목금토';
const wdOf = ds => WD[new Date(ds + 'T00:00:00Z').getUTCDay()];
const mk = (y, m, d) => { if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null; const s = `${y}-${pad(m)}-${pad(d)}`; return isDate(s) ? s : null; };

const FULL = /(20\d{2})\s*(?:[.\-/]|년\s*)\s*(\d{1,2})\s*(?:[.\-/]|월\s*)\s*(\d{1,2})\s*일?/;
const MD = /(?<![\d.])(\d{1,2})\s*(?:월\s*(\d{1,2})\s*일?|[./]\s*(\d{1,2}))(?![\d%배])/;
const DAY_ONLY = /^\s*(\d{1,2})\s*(?:일\s*)?[(（]\s*([월화수목금토일])\s*[)）]|^\s*(\d{1,2})\s*일(?![가-힣\d])/;
const WDLEAD = /^\s*[(（]\s*([월화수목금토일])\s*(?:요일)?\s*[)）]/;
const RANGE_TAIL = /^\s*(?:[~∼〜～]|[-–—])\s*(?:(20\d{2})\s*(?:[.\-/]|년\s*)\s*)?(?:(\d{1,2})\s*(?:[.\-/]|월\s*))?\s*(\d{1,2})\s*일?/;
const TIME = /(오전|오후)?\s*(\d{1,2})\s*(?::\s*(\d{2})|시(?:\s*(\d{1,2})\s*분)?)/;
const MONTH_HEAD = /^\s*(\d{1,2})\s*월\s*(?:[(（][^)）]{0,12}[)）])?\s*$/;
const BULLET = /^[\s\-–—•·*▶▷■□○●◆◇※:|,.]+|[\s\-–—•·*▶▷■□○●◆◇:|,]+$/g;

const EVENT_WORDS = /성경학교|수련회|발표회|소풍|캠프|바자회|세례|입교|전도|축제|운동회|잔치|행사|특별|연합|봉사|선교|공연|졸업|입학|수료/;
const SCHEDULE_WORDS = /회의|기도회|교사|연수|세미나|모임|심방|워크숍|워크샵|리더|임원|준비|교육|훈련|점검|총회/;
const SERVICE_WORDS = /예배|주일학교|찬양집회|미사/;
export function guessKind(title) {
  if (SERVICE_WORDS.test(title) && !EVENT_WORDS.test(title) && !SCHEDULE_WORDS.test(title)) return 'service';
  if (EVENT_WORDS.test(title)) return 'event';
  if (SCHEDULE_WORDS.test(title)) return 'schedule';
  return 'schedule';
}
export const guessScheduleType = t => (/기도회/.test(t) ? '교사 기도회' : /연수|세미나|워크숍|워크샵|훈련/.test(t) ? '교사 연수' : /심방/.test(t) ? '심방·돌봄' : /준비/.test(t) ? '준비 모임' : /임원|부서/.test(t) ? '부서 회의' : /회의|총회/.test(t) ? '교사 회의' : '기타');

function timeOf(s) {
  const m = TIME.exec(s); if (!m) return { time: '', rest: s };
  if (!m[1] && m[3] === undefined && !/시/.test(m[0])) return { time: '', rest: s };
  let h = Number(m[2]); const mi = m[3] !== undefined ? Number(m[3]) : m[4] ? Number(m[4]) : 0; if (h > 24 || mi > 59) return { time: '', rest: s };
  if (m[1] === '오후' && h < 12) h += 12; if (m[1] === '오전' && h === 12) h = 0;
  if (!m[1] && m[3] === undefined && m[4] === undefined && !/시/.test(m[0])) return { time: '', rest: s };
  return { time: `${pad(h)}:${pad(mi)}`, rest: s.replace(m[0], ' ') };
}

// lines: 문자열 배열, defaultYear: 연도가 적혀 있지 않을 때 쓸 해
export function parsePlanLines(lines, defaultYear) {
  const out = []; let year = defaultYear; let month = null;
  const roll = mo => { if (month !== null && mo < month - 5) year++; }; // 12월 다음에 1월이 오면 해가 바뀐 것으로 본다
  const clean = lines.map(l => String(l || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim());
  for (let i = 0; i < Math.min(clean.length, 6); i++) { const y = /(20\d{2})\s*년/.exec(clean[i]); if (y && !FULL.test(clean[i])) { year = Number(y[1]); break; } } // 제목의 ‘2026년’
  for (let i = 0; i < clean.length; i++) {
    const line = clean[i]; if (!line) continue;
    const head = MONTH_HEAD.exec(line); if (head && Number(head[1]) >= 1 && Number(head[1]) <= 12) { roll(Number(head[1])); month = Number(head[1]); continue; } // ‘12월’만 있는 줄은 월 제목
    const warn = []; let date = null, idx = -1, len = 0, wd = null, explicitYear = false;
    let m = FULL.exec(line);
    if (m) { date = mk(Number(m[1]), Number(m[2]), Number(m[3])); idx = m.index; len = m[0].length; explicitYear = true; if (date) { year = Number(m[1]); month = Number(m[2]); } }
    else if ((m = MD.exec(line))) { const mo = Number(m[1]); if (mo >= 1 && mo <= 12) roll(mo); date = mk(year, mo, Number(m[2] || m[3])); idx = m.index; len = m[0].length; if (date) month = mo; }
    if (!date && !explicitYear && month) { const dm = DAY_ONLY.exec(line); if (dm) { date = mk(year, month, Number(dm[1] || dm[3])); idx = dm.index; len = dm[0].length; wd = dm[2] || null; } }
    if (!date) continue;
    // 날짜 바로 뒤의 (요일)·기간(~26일)·(요일)
    let end = null; let tail = line.slice(idx + len); let used = len;
    const w1 = WDLEAD.exec(tail); if (w1) { wd = wd || w1[1]; tail = tail.slice(w1[0].length); used += w1[0].length; }
    const rt = RANGE_TAIL.exec(tail);
    if (rt) { const e = mk(rt[1] ? Number(rt[1]) : Number(date.slice(0, 4)), rt[2] ? Number(rt[2]) : Number(date.slice(5, 7)), Number(rt[3])); if (e && e >= date) { end = e; tail = tail.slice(rt[0].length); used += rt[0].length; const w2 = WDLEAD.exec(tail); if (w2) used += w2[0].length; } else if (e) warn.push('기간의 끝 날짜가 시작보다 빨라요.'); }
    if (wd && !rt && wdOf(date) !== wd) warn.push(`요일이 맞지 않아요(${date}은 ${wdOf(date)}요일).`);
    const t = timeOf(line.slice(0, idx) + ' ' + line.slice(idx + used));
    let title = t.rest.replace(/\s*\|\s*/g, ' ').replace(BULLET, '').replace(/\s+/g, ' ').trim();
    if (!title) { const nx = clean[i + 1]; if (nx && !FULL.test(nx) && !MD.test(nx) && !MONTH_HEAD.test(nx)) { title = nx.replace(BULLET, '').trim(); i++; warn.push('이름을 다음 줄에서 가져왔어요.'); } }
    if (title.length < 2) continue;
    if (title.length > 60) { title = title.slice(0, 60); warn.push('이름이 길어서 잘랐어요.'); }
    if (!explicitYear && Number(date.slice(0, 4)) !== year) warn.push('연도를 확인하세요.');
    out.push({ line: i + 1, date, end: end || date, time: t.time, title, kind: guessKind(title), warn });
  }
  return out;
}