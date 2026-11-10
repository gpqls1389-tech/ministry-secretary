// PDF에서 읽은 글자(줄)를 화면별 후보로 바꾸는 규칙들(명단·예산·거래·비품·월별 주제·예배). DOM과 무관한 순수 함수라 Node 테스트에서도 실행된다.
// 모두 규칙 기반이라 틀릴 수 있다 → 사람이 확인·수정한 뒤에만 등록한다. 확실하지 않은 줄에는 경고(warn)를 붙인다.
import { parsePlanLines } from './planparse.js';

const clean = l => String(l || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
const BULLET = /^[\s\-–—•·*▶▷■□○●◆◇※:|,.]+|[\s\-–—•·*▶▷■□○●◆◇:|,]+$/g;
const cells = l => clean(l).split(/\s*\|\s*/).map(s => s.trim()).filter(Boolean);

// ---------- 금액 ----------
// 1,500,000 / 150만원 / 3천원 / 45000원 / 45000 (쉼표·단위가 없는 4자리 이상 숫자는 연도처럼 보이면 제외)
const AMT = /(\d{1,3}(?:,\d{3})+|\d+)\s*(만\s*원?|천\s*원?|원)?/g;
export function amountsOf(s) {
  const out = []; let m; AMT.lastIndex = 0;
  while ((m = AMT.exec(s))) {
    const raw = m[1]; const unit = m[2] ? m[2].replace(/\s/g, '')[0] : ''; const hasComma = raw.includes(','); const n = Number(raw.replace(/,/g, ''));
    if (!Number.isFinite(n)) continue;
    if (!hasComma && !unit && (n < 1000 || (n >= 1900 && n <= 2100))) continue; // 단위·쉼표가 없는 작은 숫자·연도는 금액으로 보지 않음
    const value = unit === '만' ? n * 10000 : unit === '천' ? n * 1000 : n; if (!Number.isSafeInteger(value) || value <= 0) continue;
    out.push({ value, index: m.index, len: m[0].length });
  }
  return out;
}
const stripAmounts = s => { const a = amountsOf(s).sort((x, y) => y.index - x.index); let t = s; for (const x of a) t = t.slice(0, x.index) + ' ' + t.slice(x.index + x.len); return t; };
const SUM_ROW = /합\s*계|총\s*계|소\s*계|^계$|이월|잔\s*액|차\s*액/;

// ---------- 예산(항목 + 금액) ----------
export function parseBudgetLines(lines) {
  const out = [];
  lines.forEach((raw, i) => {
    const line = clean(raw); if (!line) return; const amts = amountsOf(line); if (!amts.length) return;
    let category = stripAmounts(line).replace(/\s*\|\s*/g, ' ').replace(/^\s*\d{1,2}\s*[.)]\s+/, '').replace(BULLET, '').replace(/\s+/g, ' ').trim();
    if (category.length < 2 || SUM_ROW.test(category) || /^\d+$/.test(category)) return;
    const warn = []; if (category.length > 40) { category = category.slice(0, 40); warn.push('이름이 길어서 잘랐어요.'); }
    if (amts.length > 1) warn.push(`금액이 ${amts.length}개 있어요. 첫 번째(${amts[0].value.toLocaleString('ko-KR')}원)를 썼어요.`);
    out.push({ line: i + 1, category, amount: amts[0].value, warn });
  });
  return out;
}

// ---------- 거래(날짜 + 적요 + 금액) ----------
const INCOME_WORDS = /수입|후원|헌금|참가비|회비|지원금|환급|이자|찬조|입금/;
export function parseTxLines(lines, defaultYear) {
  const out = []; let year = defaultYear;
  lines.forEach((raw, i) => {
    const line = clean(raw); if (!line) return;
    const amts = amountsOf(line); if (!amts.length) return;
    const noAmt = stripAmounts(line); const p = parsePlanLines([noAmt], year)[0]; if (!p) return; year = Number(p.date.slice(0, 4));
    if (SUM_ROW.test(p.title)) return;
    const warn = [...p.warn.filter(w => !/다음 줄/.test(w))]; if (amts.length > 1) warn.push(`금액이 ${amts.length}개 있어요(수입·지출·잔액 칸일 수 있어요). 첫 번째를 썼어요.`);
    out.push({ line: i + 1, date: p.date, memo: p.title.slice(0, 80), amount: amts[0].value, kind: INCOME_WORDS.test(p.title) ? 'income' : 'expense', category: '', warn });
  });
  return out;
}

// ---------- 월별 교육 주제 ----------
export function parseThemeLines(lines) {
  const out = []; const seen = new Set();
  lines.forEach((raw, i) => {
    const line = clean(raw); const m = /^(?:[-•·*▶▷■□○●◆◇\s]*)(\d{1,2})\s*월\s*(?:[:：\-–—|]|\s)\s*(.+)$/.exec(line); if (!m) return;
    const month = Number(m[1]); if (month < 1 || month > 12) return;
    const theme = m[2].replace(/\s*\|\s*/g, ' · ').replace(BULLET, '').trim(); if (theme.length < 2 || /^\d{1,2}\s*일/.test(theme)) return; // ‘12월 25일 …’ 같은 날짜 줄은 제외
    const warn = []; if (seen.has(month)) warn.push('같은 달이 여러 번 나와요. 마지막 줄을 쓰세요.'); seen.add(month);
    out.push({ line: i + 1, month, theme: theme.slice(0, 60), warn });
  });
  return out;
}

// ---------- 명단 ----------
const NAME = /^[가-힣]{2,4}$/;
const NOT_NAME = new Set(['이름', '성명', '번호', '구분', '학년', '생년', '출생', '비고', '연락', '주소', '출석', '담임', '교사', '부서', '아동부', '청년부', '합계', '총원', '인원', '명단', '출생년도', '생년월일', '연락처', '성별', '학교', '해님반', '달님반', '별님반', '새친구', '반별', '조별', '학생', '아동', '청년']);
const CLASS = /^[가-힣0-9]{1,8}(?:반|조|팀|학년)$/;
export function parsePeopleLines(lines) {
  const out = [];
  lines.forEach((raw, i) => {
    const line = clean(raw); if (!line) return; const toks = cells(line).flatMap(c => c.split(' ')); if (toks.some(t => t === '이름' || t === '성명')) return; // 표 머리글 줄
    const nameTok = toks.find(t => NAME.test(t) && !NOT_NAME.has(t) && !CLASS.test(t) && !/(반|조|부|팀)$/.test(t)); if (!nameTok) return;
    if (toks.length > 8) return; // 긴 문장은 명단 줄이 아님
    const by = toks.map(t => /^(?:(19[89]\d|20[0-2]\d)년?생?|(\d{2})년생)$/.exec(t)).find(Boolean); let birth = '';
    if (by) birth = by[1] || (Number(by[2]) <= 30 ? '20' + by[2] : '19' + by[2]);
    const cls = toks.find(t => CLASS.test(t) && t !== nameTok) || ''; const teacher = toks.some(t => /^(교사|선생님|담임)$/.test(t));
    const warn = []; if (!birth && !cls && toks.length === 1) warn.push('이름만 있는 줄이에요. 줄 전체가 이름인지 확인하세요.');
    const rest = toks.filter(t => t !== nameTok && t !== cls && !(by && by[0] === t) && !/^\d{1,3}$/.test(t) && !/^(교사|선생님|담임|아동|청년|봉사자)$/.test(t) && !NOT_NAME.has(t));
    if (rest.length) warn.push(`읽지 못한 글자가 있어요: ${rest.slice(0, 3).join(' ')}`);
    out.push({ line: i + 1, name: nameTok, kind: teacher ? 'teacher' : '', class_name: cls, birth_year: birth, warn });
  });
  return out;
}

// ---------- 비품 ----------
export const guessAssetCategory = n => (/스피커|마이크|앰프|피아노|기타|드럼|건반|악기|믹서|음향/.test(n) ? '악기·음향' : /프로젝터|TV|티비|모니터|노트북|카메라|컴퓨터|태블릿|스크린|전자/.test(n) ? '영상·전자기기' : /의자|책상|테이블|선반|사물함|캐비닛|매트|칠판|가구/.test(n) ? '비품·가구' : /교재|교구|색연필|가위|풀|도화지|블록|퍼즐|책/.test(n) ? '교구·교재' : /의상|소품|풍선|텐트|현수막/.test(n) ? '행사 물품' : '기타');
export function parseAssetLines(lines) {
  const out = [];
  lines.forEach((raw, i) => {
    const line = clean(raw); if (!line) return; if (/^(품목|물품|비품|이름|번호|구분)(?=\s|\||$)/.test(line) && !/\d/.test(line.replace(/^\S+/, ''))) return; // 표 머리글 줄
    const toks = cells(line);
    let name = '', qty = null, place = '';
    const q = /(?:^|\s)(\d{1,4})\s*(개|대|세트|set|EA|ea|벌|조|권|장|개입)?(?=\s|$)/; const qm = q.exec(line.replace(/^\s*\d{1,2}\s*[.)]\s+/, ''));
    if (toks.length >= 2) { name = toks.find(t => /[가-힣A-Za-z]/.test(t) && !/^\d+\s*(개|대|세트)?$/.test(t)) || ''; const rest = toks.filter(t => t !== name); const qc = rest.find(t => /^\d{1,4}\s*(개|대|세트|set|EA|ea|벌|조|권|장)?$/.test(t)); if (qc) qty = Number(/\d+/.exec(qc)[0]); place = rest.find(t => t !== qc && /[가-힣A-Za-z]/.test(t)) || ''; }
    else if (qm) { const before = line.slice(0, line.indexOf(qm[0])).replace(/^\s*\d{1,2}\s*[.)]\s+/, '').replace(BULLET, '').trim(); name = before; qty = Number(qm[1]); place = line.slice(line.indexOf(qm[0]) + qm[0].length).replace(BULLET, '').trim(); }
    else name = line.replace(/^\s*\d{1,2}\s*[.)]\s+/, '').replace(BULLET, '').trim();
    name = name.replace(/^\d{1,3}\s+/, '').trim(); if (name.length < 2 || /^\d+$/.test(name) || SUM_ROW.test(name)) return;
    const warn = []; if (qty === null) { qty = 1; warn.push('수량을 찾지 못해 1로 넣었어요.'); }
    if (name.length > 40) { name = name.slice(0, 40); warn.push('이름이 길어서 잘랐어요.'); }
    out.push({ line: i + 1, name, qty, place: place.slice(0, 40), category: guessAssetCategory(name), warn });
  });
  return out;
}

// ---------- 예배(날짜 + 이름 + 성경 본문) ----------
const BOOKS = '창세기|출애굽기|레위기|민수기|신명기|여호수아|사사기|룻기|사무엘상|사무엘하|열왕기상|열왕기하|역대상|역대하|에스라|느헤미야|에스더|욥기|시편|잠언|전도서|아가|이사야|예레미야애가|예레미야|에스겔|다니엘|호세아|요엘|아모스|오바댜|요나|미가|나훔|하박국|스바냐|학개|스가랴|말라기|마태복음|마가복음|누가복음|요한복음|사도행전|로마서|고린도전서|고린도후서|갈라디아서|에베소서|빌립보서|골로새서|데살로니가전서|데살로니가후서|디모데전서|디모데후서|디도서|빌레몬서|히브리서|야고보서|베드로전서|베드로후서|요한일서|요한이서|요한삼서|유다서|요한계시록';
const SCRIPTURE = new RegExp(`(${BOOKS})\\s*(\\d{1,3})(?:\\s*[:장]\\s*(\\d{1,3})(?:\\s*절)?(?:\\s*[-~–]\\s*(\\d{1,3})(?:\\s*절)?)?|\\s*[편장])?`);
export function parseServiceLines(lines, defaultYear) {
  // 성경 본문(예: 요한복음 10:11-18)은 시각(10:11)으로 잘못 읽히지 않도록 먼저 떼어 낸다. 본문은 PDF에 적힌 장·절 표기만 옮기며 개역개정 본문은 사용자가 확인해야 한다.
  const sc = []; const stripped = lines.map((l, i) => { const m = SCRIPTURE.exec(String(l || '')); if (!m) return l; sc[i] = m[3] ? `${m[1]} ${m[2]}:${m[3]}${m[4] ? '-' + m[4] : ''}` : (m[1] === '시편' ? `${m[1]} ${m[2]}편` : `${m[1]} ${m[2]}장`); return String(l).replace(m[0], ' '); });
  return parsePlanLines(stripped, defaultYear).map(c => ({ ...c, kind: 'service', scripture: sc[c.line - 1] || '' }));
}