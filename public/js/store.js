// 목회 비서 데이터 로직. 브라우저(localStorage)와 Node 테스트 양쪽에서 동작하도록 저장소를 주입받는다.
import { makeSeed } from './seed.js';
import { DEFAULT_CHECKS, MAX_CHECKS, NEWCOMER_STEPS, AWAY_REASONS, AWAY_EVERY, EXAM_TYPE, guessDeptKind } from './ministry.js';
import { LESSON_KEYS, FIELD_MAX, MAX_LESSONS, MAX_CURRICULA, CURRICULUM_PRESETS, PICK_PRESETS, blankLessons, cleanLesson, sundaysBetween, lessonLabel } from './curriculum.js';
import { EVENT_TEMPLATES, eventTaskDue, seasonTemplates, MONTH_THEMES, repeatDates, MAX_REPEAT, SCHEDULE_TYPES, VISIT_TYPES, ASSET_CATEGORIES, ASSET_STATUS } from './templates.js';

export const KEY = 'ministry-secretary:v1';
export class ValidationError extends Error {}

export const kstToday = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
export function isDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number); const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}
const reqDate = (s, l = '날짜') => { if (!isDate(s)) throw new ValidationError(`${l} 형식이 올바르지 않습니다(YYYY-MM-DD).`); return s; };
const reqText = (s, l) => { if (typeof s !== 'string' || !s.trim()) throw new ValidationError(`${l}을(를) 입력하세요.`); return s.trim(); };
export function reqMoney(n, l = '금액', allowZero = false) {
  if (typeof n === 'string' && /^\d+$/.test(n.trim())) n = Number(n);
  if (!Number.isSafeInteger(n) || n < 0 || (!allowZero && n === 0)) throw new ValidationError(`${l}은(는) ${allowZero ? '0 이상' : '1 이상'}의 정수(원)여야 합니다.`);
  return n;
}
const addDays = (d, n) => { const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };

const isId = n => Number.isSafeInteger(n) && n > 0;
// 외부 사이트 주소 검사: http/https만, 계정 정보(user:pass@)·javascript: 등은 거부한다.
export function safeUrl(u) {
  let x; try { x = new URL(String(u || '').trim()); } catch { throw new ValidationError('사이트 주소가 올바르지 않아요(https://로 시작하는 전체 주소).'); }
  if (!['https:', 'http:'].includes(x.protocol) || x.username || x.password || !x.hostname.includes('.') || x.href.length > 300) throw new ValidationError('사이트 주소가 올바르지 않아요(https://로 시작하는 전체 주소, 300자 이하).');
  return x.href;
}
export const TODO_TIME = /^([01]\d|2[0-3]):[0-5]\d$/; // 할 일 알림 시간(HH:MM)
export const RECEIPT_ID = /^[A-Za-z0-9_-]{1,64}$/; // 영수증 사진 번호(서버: 32자리 16진수, 이 브라우저: l로 시작)
export function validateState(j) {
  const bad = m => { throw new ValidationError(`이 앱의 백업 파일이 아니거나 내용이 손상되었습니다. (${m})`); };
  if (!j || typeof j !== 'object' || j.version !== 1) bad('버전');
  for (const k of ['depts', 'people', 'events', 'tasks', 'participants', 'services', 'attendance', 'budgets', 'transactions', 'seasons']) if (!Array.isArray(j[k])) bad(`${k} 목록 없음`);
  if (!j.plans || typeof j.plans !== 'object' || Array.isArray(j.plans)) bad('plans');
  if (j.supplies !== undefined && !Array.isArray(j.supplies)) bad('준비물');
  if (j.schedules !== undefined && !Array.isArray(j.schedules)) bad('일정');
  if (j.todos !== undefined && (!Array.isArray(j.todos) || j.todos.length > 2000)) bad('할 일');
  for (const t of (j.todos || [])) if (!isId(t.id) || typeof t.title !== 'string' || t.title.length > 200 || !isDate(t.date) || !(t.time === '' || TODO_TIME.test(String(t.time))) || typeof t.done !== 'boolean') bad('할 일');
  for (const k of ['visits', 'assets', 'links']) if (j[k] !== undefined && !Array.isArray(j[k])) bad(k === 'visits' ? '심방 기록' : k === 'links' ? '내 사이트' : '비품');
  if (!Number.isSafeInteger(j.nextId) || j.nextId < 1) bad('nextId');
  const dids = new Set(); for (const d of j.depts) { if (!isId(d.id) || typeof d.name !== 'string') bad('부서'); dids.add(d.id); }
  if (!dids.size) bad('부서 없음');
  const pids = new Set(); for (const p of j.people) { if (!isId(p.id) || typeof p.name !== 'string' || (p.dept_id != null && !dids.has(p.dept_id))) bad('인원'); pids.add(p.id); }
  const eids = new Set(); for (const e of j.events) { if (!isId(e.id) || typeof e.title !== 'string' || !dids.has(e.dept_id) || !isDate(e.start_date) || !isDate(e.end_date)) bad('행사'); eids.add(e.id); }
  const sids = new Set(); for (const s of j.services) { if (!isId(s.id) || typeof s.title !== 'string' || !dids.has(s.dept_id) || !isDate(s.date)) bad('예배'); sids.add(s.id); }
  for (const v of (j.visits || [])) if (!isId(v.id) || !pids.has(v.person_id) || !isDate(v.date) || typeof v.note !== 'string') bad('심방 기록');
  for (const l of (j.links || [])) if (!isId(l.id) || typeof l.name !== 'string' || typeof l.url !== 'string' || !/^https?:\/\//.test(l.url) || !(l.dept_id === 0 || dids.has(l.dept_id))) bad('내 사이트');
  for (const a of (j.assets || [])) if (!isId(a.id) || typeof a.name !== 'string' || !dids.has(a.dept_id) || (a.repairs !== undefined && !Array.isArray(a.repairs))) bad('비품');
  for (const s of (j.schedules || [])) if (!isId(s.id) || typeof s.title !== 'string' || !dids.has(s.dept_id) || !isDate(s.date)) bad('일정');
  for (const t of j.tasks) if (!isId(t.id) || !eids.has(t.event_id) || typeof t.title !== 'string') bad('준비 업무');
  for (const p of j.participants) if (!eids.has(p.event_id) || !pids.has(p.person_id) || !['applied', 'attended', 'cancelled'].includes(p.status)) bad('참가');
  for (const a of j.attendance) if (!sids.has(a.service_id) || !pids.has(a.person_id)) bad('출석');
  for (const b of j.budgets) if (!dids.has(b.dept_id) || !Number.isSafeInteger(b.amount) || b.amount < 0) bad('예산');
  for (const t of j.transactions) if (!isId(t.id) || !dids.has(t.dept_id) || !isDate(t.date) || !['income', 'expense'].includes(t.kind) || !Number.isSafeInteger(t.amount) || t.amount <= 0 || (t.event_id != null && !eids.has(t.event_id)) || (t.receipt != null && !RECEIPT_ID.test(String(t.receipt)))) bad('거래');
  for (const s of j.seasons) if (!dids.has(s.dept_id) || typeof s.name !== 'string') bad('절기');
  if (j.growth !== undefined && (!Array.isArray(j.growth) || j.growth.length > 50000)) bad('주간 체크');
  if (j.deptCfg !== undefined && (typeof j.deptCfg !== 'object' || Array.isArray(j.deptCfg) || j.deptCfg === null)) bad('부서 설정');
  if (j.curricula !== undefined && (!Array.isArray(j.curricula) || j.curricula.length > MAX_CURRICULA)) bad('교재');
  for (const c of (j.curricula || [])) if (!isId(c.id) || typeof c.name !== 'string' || !Number.isInteger(c.years) || c.years < 1 || c.years > 3 || !Array.isArray(c.lessons) || c.lessons.length > MAX_LESSONS || !(c.dept_id === 0 || dids.has(c.dept_id)) || c.lessons.some(l => !Number.isInteger(l.year) || !Number.isInteger(l.no) || LESSON_KEYS.some(k => typeof l[k] !== 'string' || l[k].length > FIELD_MAX[k]))) bad('교재');
  for (const s of j.services) if (s.lesson != null && (typeof s.lesson !== 'object' || LESSON_KEYS.some(k => typeof s.lesson[k] !== 'string' || s.lesson[k].length > FIELD_MAX[k]) || !Array.isArray(s.lesson.pick) || s.lesson.pick.some(k => !LESSON_KEYS.includes(k)))) bad('예배 공과');
  return j;
}

// 비어 있는 새 데이터(부서만 있음). 새 계정과 ‘실제 데이터로 시작’에서 사용
export function emptyState(todayStr = kstToday()) {
  const base = makeSeed(todayStr);
  return { version: 1, demo: false, nextId: 100, depts: base.depts, people: [], events: [], tasks: [], participants: [], services: [], attendance: [], budgets: [], transactions: [], plans: {}, seasons: [], supplies: [], schedules: [], visits: [], assets: [], links: [], todos: [], curricula: [] };
}

// 부서마다 종류(kid·teen·youth)를 붙이고, 중고등부가 없으면 아동부 다음에 만든다(MB12). 새 목록도 빈 배열로 채운다.
export function normalizeState(j) {
  for (const d of j.depts) if (!['kid', 'teen', 'youth'].includes(d.kind)) d.kind = guessDeptKind(d.name, d.id);
  if (!j.depts.some(d => d.kind === 'teen') && !j.teenAdded) {
    const id = Math.max(...j.depts.map(d => d.id)) + 1; const at = j.depts.findIndex(d => d.kind === 'kid');
    j.depts.splice(at >= 0 ? at + 1 : j.depts.length, 0, { id, name: '중고등부', kind: 'teen' });
  }
  j.teenAdded = true; // 사용자가 중고등부를 지운 뒤에 다시 생기지 않게
  for (const k of ['schedules', 'visits', 'assets', 'links', 'todos', 'curricula', 'growth']) j[k] = j[k] || [];
  j.deptCfg = j.deptCfg || {};
  return j;
}

export function createStore(storage, today = kstToday) {
  let S = null;
  const save = () => { // 저장이 막히거나 공간이 부족하면 조용히 넘어가지 않고 알린다
    try { storage.setItem(KEY, JSON.stringify(S)); }
    catch { throw new ValidationError('저장 공간이 부족하거나 브라우저가 저장을 막아 저장하지 못했습니다. 지금 설정에서 ‘내보내기’로 백업해 두세요.'); }
  };
  const nid = () => S.nextId++;
  // 공과를 배치할 때 ‘예배의 본문·설교 제목이 비어 있으면 채우기’를 골랐다면 채우고, 공과를 옮기거나 지울 때 채웠던 값만 되돌린다
  const fill = sv => { const l = sv.lesson; if (!l || !l.fill) return; l.filled = {};
    if (!sv.scripture && l.scripture && l.pick.includes('scripture')) { sv.scripture = l.scripture; l.filled.scripture = true; }
    if (!sv.sermon_title && l.title && l.pick.includes('title')) { sv.sermon_title = l.title; l.filled.title = true; } };
  const unfill = sv => { const l = sv.lesson; if (!l || !l.filled) return;
    if (l.filled.scripture && sv.scripture === l.scripture) sv.scripture = ''; if (l.filled.title && sv.sermon_title === l.title) sv.sermon_title = ''; delete l.filled; };
  let recovered = false;
  function load() {
    let raw = null;
    try { raw = storage.getItem(KEY); if (raw) { const j = JSON.parse(raw); validateState(j); S = normalizeState(j); return S; } } catch {
      // 저장된 값이 손상된 경우: 가상 데이터로 덮어쓰기 전에 원본을 따로 남겨 둔다(복구 가능)
      if (raw) { try { storage.setItem(KEY + ':broken', raw); recovered = true; } catch { /* 무시 */ } }
    }
    S = normalizeState(makeSeed(today())); try { save(); } catch { /* 저장 불가 환경: 메모리만 사용 */ } return S;
  }
  load();
  const get = () => S;
  let lastSeries = { made: 1, skipped: 0 };
  // 반복 규칙(s.repeat, s.until)대로 같은 내용을 여러 날짜에 만든다. 반복일 때만 같은 부서·이름·날짜가 이미 있으면 건너뛴다.
  const addSeries = (list, rec, s) => {
    const rule = s.repeat && s.repeat !== 'none' ? s.repeat : 'none';
    if (rule !== 'none') { if (!s.until) throw new ValidationError('반복할 때는 ‘반복 종료일’을 입력하세요.'); reqDate(s.until, '반복 종료일'); if (s.until < rec.date) throw new ValidationError('반복 종료일이 시작 날짜보다 앞서요.'); }
    const dates = repeatDates(rec.date, rule, s.until);
    const have = new Set(rule === 'none' ? [] : list.filter(x => x.dept_id === rec.dept_id && x.title === rec.title).map(x => x.date));
    const todo = dates.filter(d => !have.has(d)); if (!todo.length) throw new ValidationError('같은 이름의 항목이 그 날짜들에 이미 있어요.');
    const series = todo.length > 1 ? nid() : undefined; let first = null;
    for (const d of todo) { const id = nid(); list.push({ id, ...rec, date: d, ...(series ? { series } : {}) }); if (first === null) first = id; }
    lastSeries = { made: todo.length, skipped: dates.length - todo.length, capped: dates.length >= MAX_REPEAT && s.until > dates[dates.length - 1] };
    save(); return first;
  };  const dept = id => S.depts.find(d => d.id === id);
  const person = id => S.people.find(p => p.id === id);
  const ev = id => S.events.find(e => e.id === id);

  const api = {
    get, save, KEY, wasRecovered: () => recovered, lastSeries: () => lastSeries,
    resetDemo() { S = normalizeState(makeSeed(today())); save(); },
    startEmpty() { S = normalizeState(emptyState(today())); save(); },
    exportJson() { return JSON.stringify(S, null, 1); },
    // 가져오기: 구조가 하나라도 어긋나면 현재 데이터를 건드리지 않고 거부한다(일부만 반영되는 상황 방지)
    importJson(text) {
      let j; try { j = JSON.parse(text); } catch { throw new ValidationError('JSON 형식이 아닙니다.'); }
      validateState(j);
      normalizeState(j); const before = S; S = j;
      try { save(); } catch (e) { S = before; throw e; }
    },
    markExported() { S.lastExport = new Date().toISOString(); save(); },
    daysSinceExport() { return S.lastExport ? Math.floor((Date.now() - Date.parse(S.lastExport)) / 864e5) : null; },
    depts: () => S.depts, dept, person, ev,

    // ----- 일정·홈 -----
    // 공과: 예배를 함께 보면 예배 항목에 공과 이름(lesson)을 붙이고, 예배를 숨기면 공과만 따로 보여 준다(type 'lesson', id는 예배 id).
    calendar(deptId, from, to, { services = true, lessons = true } = {}) {
      const out = []; const les = s => (s.lesson ? lessonLabel(s.lesson) : s.lesson_hold ? '공과 쉼' : '');
      for (const s of (S.schedules || [])) if ((!deptId || s.dept_id === deptId) && (s.end || s.date) >= from && s.date <= to) out.push({ type: 'schedule', id: s.id, date: s.date, end: s.end || s.date, title: s.title, time: s.time, dept_id: s.dept_id, kind: s.type });
      if (services) for (const s of S.services) if ((!deptId || s.dept_id === deptId) && s.date >= from && s.date <= to) out.push({ type: 'service', id: s.id, date: s.date, end: s.date, title: s.title, time: s.time, dept_id: s.dept_id, lesson: lessons ? les(s) : '' });
      if (!services && lessons) for (const s of S.services) if ((!deptId || s.dept_id === deptId) && s.date >= from && s.date <= to && (s.lesson || s.lesson_hold)) out.push({ type: 'lesson', id: s.id, date: s.date, end: s.date, title: les(s), time: s.time, dept_id: s.dept_id, hold: !s.lesson, cname: s.lesson ? s.lesson.cname : '' });
      for (const e of S.events) if ((!deptId || e.dept_id === deptId) && e.end_date >= from && e.start_date <= to && e.status !== 'cancelled') out.push({ type: 'event', id: e.id, date: e.start_date, end: e.end_date, title: e.title, dept_id: e.dept_id });
      return out.sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''));
    },
    weekRange(t = today()) { const dow = new Date(t + 'T00:00:00Z').getUTCDay(); const mon = addDays(t, -((dow + 6) % 7)); return [mon, addDays(mon, 6)]; },
    home(deptId, t = today()) {
      const [from, to] = api.weekRange(t); const year = Number(t.slice(0, 4));
      const tasks = S.tasks.filter(k => k.status !== 'done').map(k => ({ ...k, event: ev(k.event_id) })).filter(k => k.event && k.event.status !== 'cancelled' && (!deptId || k.event.dept_id === deptId))
        .map(k => ({ ...k, overdue: !!k.due && k.due < t })).sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
      return { today: t, from, to, week: api.calendar(deptId, from, to), tasks, budget: S.depts.filter(d => !deptId || d.id === deptId).map(d => ({ dept: d, ...api.deptSummary(d.id, year) })) };
    },

    // 행사 한 건의 준비 진행: 남은 업무·기한 지남·담당자 미배정 수, 다음 할 일(기한이 가장 이른 미완료 업무), 시작일까지 남은 날
    eventProgress(eventId, t = today()) {
      const e = ev(eventId); if (!e) return null; const open = S.tasks.filter(k => k.event_id === eventId && k.status !== 'done').sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999') || a.id - b.id);
      return { open: open.length, overdue: open.filter(k => k.due && k.due < t).length, today: open.filter(k => k.due === t).length, unassigned: open.filter(k => !k.assignee).length, next: open[0] || null,
        days: Math.round((Date.parse(e.start_date + 'T00:00:00Z') - Date.parse(t + 'T00:00:00Z')) / 864e5) };
    },
    // 홈의 ‘이번 주 목회 브리핑’: 지금 챙길 일을 이유(날짜·상태)와 함께 우선순위 순으로 돌려준다. 완료·취소된 행사와 완료된 업무는 제외하고 부서 선택을 적용한다.
    briefing(deptId, t = today()) {
      const cards = []; const plus = n => new Date(Date.parse(t + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10); const wk = plus(7);
      for (const e of S.events) {
        if (e.status !== 'planned' || (deptId && e.dept_id !== deptId)) continue; const p = api.eventProgress(e.id, t); if (!p.open) continue;
        if (p.overdue) cards.push({ pri: 1, kind: 'event', id: e.id, title: e.title, reason: `기한 지난 업무 ${p.overdue}건`, detail: p.next ? `${p.next.title} · 기한 ${p.next.due}` : '', go: `event/${e.id}` });
        else if (p.today) cards.push({ pri: 2, kind: 'event', id: e.id, title: e.title, reason: `오늘 마감 업무 ${p.today}건`, detail: p.next ? p.next.title : '', go: `event/${e.id}` });
        else if (p.days >= 0 && p.days <= 14) cards.push({ pri: 3, kind: 'event', id: e.id, title: e.title, reason: `D-${p.days} · 남은 업무 ${p.open}건`, detail: p.next ? `다음: ${p.next.title}${p.next.due ? ' · ' + p.next.due : ''}` : '', go: `event/${e.id}` });
      }
      for (const s of S.services) if (s.date >= t && s.date <= wk && (!deptId || s.dept_id === deptId) && !String(s.order_text || '').trim()) cards.push({ pri: 3, kind: 'service', id: s.id, title: s.title, reason: `${s.date} 예배 순서 미입력`, detail: '', go: `service/${s.id}` });
      const care = (S.visits || []).filter(v => v.follow_up && v.follow_up >= t && v.follow_up <= wk && (!deptId || (person(v.person_id) || {}).dept_id === deptId)).length;
      if (care) cards.push({ pri: 4, kind: 'care', id: 0, title: '돌봄 연락 예정', reason: `이번 주 ${care}건`, detail: '', go: 'people' });
      // 시험 기간과 겹치는 행사(중고등부 등)
      for (const e of S.events) { if (e.status !== 'planned' || (deptId && e.dept_id !== deptId) || e.end_date < t) continue; const x = api.examOverlap(e.dept_id, e.start_date, e.end_date)[0]; if (x) cards.push({ pri: 3, kind: 'event', id: e.id, title: e.title, reason: `시험 기간 ‘${x.title}’(${x.date}~${x.end || x.date})과 겹쳐요`, detail: '시험 기간에는 참석이 어려울 수 있어요', go: `event/${e.id}` }); }
      // 장기 부재 연락, 새가족 다음 단계
      const away = api.awayList(deptId, t).filter(a => a.due); if (away.length) cards.push({ pri: 4, kind: 'care', id: 0, title: '장기 부재 연락', reason: `연락할 때가 된 사람 ${away.length}명`, detail: away.slice(0, 3).map(a => a.person.name).join(', '), go: 'ministry' });
      const nc = api.newcomers(deptId, t).filter(n => n.next && n.days >= 7); if (nc.length) cards.push({ pri: 4, kind: 'care', id: 0, title: '새가족 정착', reason: `다음 단계가 남은 새가족 ${nc.length}명`, detail: nc.slice(0, 3).map(n => `${n.person.name}(${n.next[1]})`).join(', '), go: 'ministry' });
      return cards.sort((a, b) => a.pri - b.pri || a.title.localeCompare(b.title, 'ko'));
    },

    // 행사 시작일을 바꿀 때 마감일이 있는 미완료 업무를 days일 만큼 옮긴다(완료된 업무는 그대로).
    shiftEventTasks(eventId, days) {
      if (!ev(eventId) || !Number.isInteger(days)) throw new ValidationError('행사를 찾을 수 없습니다.');
      let n = 0; for (const k of S.tasks) if (k.event_id === eventId && k.status !== 'done' && k.due) { k.due = addDays(k.due, days); n++; } save(); return n;
    },
    // 행사 마무리: 결산 확인 표시, 회고(잘된 점 / 바꿀 점 / 다음 담당자가 언제 무엇부터)
    setSettled(eventId, on) { const e = ev(eventId); if (!e) throw new ValidationError('행사를 찾을 수 없습니다.'); e.settled = !!on; save(); },
    saveRetro(eventId, r) {
      const e = ev(eventId); if (!e) throw new ValidationError('행사를 찾을 수 없습니다.'); const t = x => String((r && x) || '').trim().slice(0, 600);
      const rec = { good: t(r.good), change: t(r.change), next: t(r.next) }; if (!rec.good && !rec.change && !rec.next) throw new ValidationError('한 칸 이상 적어 주세요.'); e.retro = rec; save();
    },

    // ----- 행사 -----
    saveEvent(e) {
      const rec = { dept_id: Number(e.dept_id), title: reqText(e.title, '행사명'), type: e.type || '행사', start_date: reqDate(e.start_date, '시작일'), end_date: reqDate(e.end_date || e.start_date, '종료일'), place: e.place || '', owner: e.owner || '', target_count: Number(e.target_count || 0), expected_budget: reqMoney(Number(e.expected_budget || 0), '예상 예산', true), note: e.note || '', status: e.status || 'planned' };
      if (!dept(rec.dept_id)) throw new ValidationError('부서를 선택하세요.');
      if (rec.end_date < rec.start_date) throw new ValidationError('종료일이 시작일보다 앞섭니다.');
      if (e.id) { Object.assign(ev(e.id), rec); save(); return e.id; }
      const id = nid(); S.events.push({ id, ...rec }); save(); return id;
    },
    deleteEvent(id) {
      if (S.transactions.some(t => t.event_id === id) || S.participants.some(p => p.event_id === id)) throw new ValidationError('참가자나 거래가 연결된 행사는 삭제할 수 없습니다. 상태를 ‘취소’로 바꾸세요.');
      S.events = S.events.filter(e => e.id !== id); S.tasks = S.tasks.filter(t => t.event_id !== id); S.supplies = (S.supplies || []).filter(x => x.event_id !== id); save();
    },
    addTask(eventId, title, due, assignee = '') { if (due) reqDate(due, '마감일'); const id = nid(); S.tasks.push({ id, event_id: eventId, title: reqText(title, '업무'), due: due || null, assignee, status: 'todo' }); save(); return id; },
    setTaskStatus(id, status) { S.tasks.find(t => t.id === id).status = status; save(); },
    supplies: eventId => (S.supplies || []).filter(x => x.event_id === eventId),
    addSupply(eventId, name) { S.supplies = S.supplies || []; const id = nid(); S.supplies.push({ id, event_id: eventId, name: reqText(name, '준비물'), done: false }); save(); return id; },
    toggleSupply(id, done) { const x = (S.supplies || []).find(v => v.id === id); if (x) { x.done = !!done; save(); } },
    deleteSupply(id) { S.supplies = (S.supplies || []).filter(x => x.id !== id); save(); },
    deleteTask(id) { S.tasks = S.tasks.filter(t => t.id !== id); save(); },
    // 참가: 같은 행사에 한 사람은 한 행(중복 없음)
    setParticipant(eventId, personId, status) {
      if (!['applied', 'attended', 'cancelled'].includes(status)) throw new ValidationError('참가 상태 오류');
      const p = S.participants.find(x => x.event_id === eventId && x.person_id === personId);
      if (p) p.status = status; else S.participants.push({ event_id: eventId, person_id: personId, status, first_time: false }); save();
    },
    addNewcomer(eventId, name, kind = 'child', className = '') {
      const e = ev(eventId); const pid = api.addPerson({ name, kind, dept_id: e.dept_id, class_name: className });
      S.participants.push({ event_id: eventId, person_id: pid, status: 'attended', first_time: true }); save(); return pid;
    },
    removeParticipant(eventId, personId) { S.participants = S.participants.filter(x => !(x.event_id === eventId && x.person_id === personId)); save(); },
    participants: eventId => S.participants.filter(p => p.event_id === eventId).map(p => ({ ...p, person: person(p.person_id) })),
    eventSummary(id) {
      const e = ev(id); const ps = S.participants.filter(p => p.event_id === id); const tx = S.transactions.filter(t => t.event_id === id && !t.voided);
      const income = tx.filter(t => t.kind === 'income').reduce((a, t) => a + t.amount, 0), expense = tx.filter(t => t.kind === 'expense').reduce((a, t) => a + t.amount, 0);
      const cnt = s => ps.filter(p => p.status === s).length;
      return { registered: cnt('applied') + cnt('attended'), attended: cnt('attended'), cancelled: cnt('cancelled'), first_time: ps.filter(p => p.first_time && p.status !== 'cancelled').length, income, expense, budget_remaining: e.expected_budget - expense, net: income - expense };
    },

    // ----- 인원 -----
    addPerson(p) {
      const id = nid();
      S.people.push({ id, name: reqText(p.name, '이름'), kind: ['child', 'teen', 'youth', 'teacher', 'volunteer'].includes(p.kind) ? p.kind : 'child', dept_id: Number(p.dept_id) || null, class_name: p.class_name || '', birth_year: p.birth_year ? Number(p.birth_year) : null, status: 'active' }); save(); return id;
    },
    // 명단 한꺼번에 등록: 먼저 검사만 하고(planPeopleImport) 사용자가 확인한 뒤 한 번에 저장한다(addPeopleBulk).
    // rows: [{ name, kind, dept, class_name, birth_year }] (kind는 아동/청년/교사/봉사자, dept는 부서 이름. 비우면 기본값)
    planPeopleImport(rows, defaultDeptId) {
      if (rows.length > 500) throw new ValidationError('한 번에 500명까지 등록할 수 있어요. 파일을 나눠서 올려 주세요.');
      const KINDS = { 아동: 'child', 청소년: 'teen', 학생: 'teen', teen: 'teen', 청년: 'youth', 교사: 'teacher', 봉사자: 'volunteer', child: 'child', youth: 'youth', teacher: 'teacher', volunteer: 'volunteer' };
      const key = p => `${p.name}|${p.dept_id}|${p.birth_year || ''}|${p.class_name || ''}`; const have = new Set(S.people.filter(p => p.status !== 'inactive').map(key)); const seen = new Set();
      const ok = [], dup = [], errors = [];
      rows.forEach((r, i) => {
        const line = r.line || i + 2; const name = String(r.name || '').trim(); if (!name) { errors.push({ line, msg: '이름이 비어 있어요.' }); return; }
        if (name.length > 40) { errors.push({ line, msg: `이름이 너무 길어요(${name.slice(0, 8)}…).` }); return; }
        const kindTxt = String(r.kind || '').trim(); const kind = kindTxt ? KINDS[kindTxt] : (defaultDeptId === 2 ? 'youth' : 'child'); if (!kind) { errors.push({ line, msg: `‘${kindTxt}’은(는) 알 수 없는 구분이에요(아동/청년/교사/봉사자).` }); return; }
        const dtxt = String(r.dept || '').trim(); const d = dtxt ? S.depts.find(x => x.name === dtxt) : dept(defaultDeptId); if (!d) { errors.push({ line, msg: `‘${dtxt}’ 부서를 찾을 수 없어요(${S.depts.map(x => x.name).join('/')}).` }); return; }
        const byTxt = String(r.birth_year || '').trim(); const by = byTxt ? Number(byTxt) : null; if (byTxt && (!Number.isInteger(by) || by < 1900 || by > 2100)) { errors.push({ line, msg: `출생년도 ‘${byTxt}’이(가) 올바르지 않아요(예: 2016).` }); return; }
        const p = { name, kind, dept_id: d.id, class_name: String(r.class_name || '').trim().slice(0, 30), birth_year: by };
        if (have.has(key(p)) || seen.has(key(p))) { dup.push({ line, name }); return; } seen.add(key(p)); ok.push(p);
      });
      return { ok, dup, errors };
    },
    addPeopleBulk(list) { for (const p of list) S.people.push({ id: nid(), name: reqText(p.name, '이름'), kind: p.kind, dept_id: p.dept_id, class_name: p.class_name || '', birth_year: p.birth_year || null, status: 'active' }); save(); return list.length; },
    // 여러 명을 한 번에 이동(className이 비어 있으면 반·조는 그대로)·명단 제외/복귀
    movePeople(ids, deptId, className) {
      if (!dept(deptId)) throw new ValidationError('부서를 선택하세요.'); const set = new Set(ids); let n = 0;
      for (const p of S.people) if (set.has(p.id)) { p.dept_id = deptId; if (className) p.class_name = String(className).trim().slice(0, 30); n++; }
      if (!n) throw new ValidationError('선택한 사람이 없습니다.'); save(); return n;
    },
    setPeopleStatus(ids, status) { if (!['active', 'graduated', 'inactive', 'away'].includes(status)) throw new ValidationError('상태 오류'); const set = new Set(ids); let n = 0; for (const p of S.people) if (set.has(p.id)) { p.status = status; n++; } if (!n) throw new ValidationError('선택한 사람이 없습니다.'); save(); return n; },

    // ----- 심방·돌봄 기록 (민감 정보는 적지 않도록 화면에서 안내) -----
    addVisit(v) {
      if (!person(Number(v.person_id))) throw new ValidationError('사람을 찾을 수 없습니다.');
      const note = reqText(v.note, '내용'); if (note.length > 300) throw new ValidationError('내용은 300자 이하로 적어 주세요.');
      const rec = { person_id: Number(v.person_id), date: reqDate(v.date), type: VISIT_TYPES.includes(v.type) ? v.type : '기타', note, follow_up: v.follow_up ? reqDate(v.follow_up, '다음 연락일') : null };
      S.visits = S.visits || []; if (v.id) { const x = S.visits.find(a => a.id === v.id); if (!x) throw new ValidationError('기록을 찾을 수 없습니다.'); Object.assign(x, rec); save(); return v.id; }
      const id = nid(); S.visits.push({ id, ...rec }); save(); return id;
    },
    deleteVisit(id) { S.visits = (S.visits || []).filter(v => v.id !== id); save(); },
    visit: id => (S.visits || []).find(v => v.id === id),
    visits({ personId, deptId } = {}) {
      return (S.visits || []).filter(v => (!personId || v.person_id === personId) && (!deptId || (person(v.person_id) || {}).dept_id === deptId)).map(v => ({ ...v, person: person(v.person_id) })).sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
    },
    // 현재 명단의 사람별 마지막 심방일(없으면 null)과 다음 연락 예정일
    visitSummary(deptId, t = today()) {
      const last = new Map(), next = new Map(); for (const v of (S.visits || [])) { if (!last.has(v.person_id) || v.date > last.get(v.person_id)) last.set(v.person_id, v.date); if (v.follow_up && v.follow_up >= t && (!next.has(v.person_id) || v.follow_up < next.get(v.person_id))) next.set(v.person_id, v.follow_up); }
      return S.people.filter(p => p.status === 'active' && (!deptId || p.dept_id === deptId)).map(p => ({ person: p, last: last.get(p.id) || null, next: next.get(p.id) || null, days: last.has(p.id) ? Math.round((Date.parse(t + 'T00:00:00Z') - Date.parse(last.get(p.id) + 'T00:00:00Z')) / 864e5) : null }));
    },

    // ----- 오늘 할 일(개인 메모. 시간을 정하면 그 시간에 알림) -----
    // 날짜 없는 항목은 만들지 않고, 시간은 비우거나 HH:MM. 완료한 지 30일이 넘은 항목은 자리가 모자랄 때만 정리한다.
    todos() { return (S.todos || []).slice().sort((a, b) => a.date.localeCompare(b.date) || (a.time || '99:99').localeCompare(b.time || '99:99') || a.id - b.id); },
    saveTodo(t) {
      const title = reqText(t.title, '할 일').slice(0, 120); const date = t.date ? reqDate(t.date, '날짜') : today(); const time = String(t.time || '').trim();
      if (time && !TODO_TIME.test(time)) throw new ValidationError('시간은 시:분(예: 09:30)으로 입력하세요.');
      S.todos = S.todos || [];
      if (t.id) { const x = S.todos.find(v => v.id === t.id); if (!x) throw new ValidationError('할 일을 찾을 수 없습니다.'); Object.assign(x, { title, date, time }); save(); return t.id; }
      if (S.todos.length >= 500) { const cut = addDays(today(), -30); S.todos = S.todos.filter(v => !(v.done && v.date < cut)); }
      if (S.todos.length >= 500) throw new ValidationError('할 일이 너무 많아요(500개). 완료한 항목을 지워 주세요.');
      const id = nid(); S.todos.push({ id, title, date, time, done: false }); save(); return id;
    },
    setTodoDone(id, done) { const x = (S.todos || []).find(v => v.id === id); if (!x) throw new ValidationError('할 일을 찾을 수 없습니다.'); x.done = !!done; save(); },
    moveTodoToToday(id) { const x = (S.todos || []).find(v => v.id === id); if (!x) throw new ValidationError('할 일을 찾을 수 없습니다.'); x.date = today(); save(); },
    deleteTodo(id) { S.todos = (S.todos || []).filter(v => v.id !== id); save(); },

    // ----- 내가 추가한 사이트(자료실) -----
    saveLink(l) {
      const dept_id = Number(l.dept_id) || 0; if (dept_id && !dept(dept_id)) throw new ValidationError('부서를 선택하세요.');
      const rec = { dept_id, name: reqText(l.name, '사이트 이름').slice(0, 60), url: safeUrl(l.url), category: String(l.category || '내 사이트').slice(0, 20), note: String(l.note || '').slice(0, 120) };
      S.links = S.links || []; if (l.id) { const x = S.links.find(v => v.id === l.id); if (!x) throw new ValidationError('사이트를 찾을 수 없습니다.'); Object.assign(x, rec); save(); return l.id; }
      const id = nid(); S.links.push({ id, ...rec }); save(); return id;
    },
    link: id => (S.links || []).find(l => l.id === id),
    deleteLink(id) { S.links = (S.links || []).filter(l => l.id !== id); save(); },
    links(deptId) { return (S.links || []).filter(l => !deptId || l.dept_id === 0 || l.dept_id === deptId).sort((a, b) => a.category.localeCompare(b.category, 'ko') || a.name.localeCompare(b.name, 'ko')); },
    // ----- 비품 -----
    saveAsset(a) {
      const qty = a.qty === '' || a.qty == null ? 1 : Number(a.qty); if (!Number.isInteger(qty) || qty < 0 || qty > 99999) throw new ValidationError('수량은 0 이상의 정수여야 합니다.');
      const rec = { dept_id: Number(a.dept_id), name: reqText(a.name, '품목 이름'), category: ASSET_CATEGORIES.includes(a.category) ? a.category : '기타', place: a.place || '', qty, status: ASSET_STATUS.includes(a.status) ? a.status : '사용 중', note: a.note || '' };
      if (!dept(rec.dept_id)) throw new ValidationError('부서를 선택하세요.'); S.assets = S.assets || [];
      if (a.id) { const x = S.assets.find(v => v.id === a.id); if (!x) throw new ValidationError('비품을 찾을 수 없습니다.'); Object.assign(x, rec); save(); return a.id; }
      const id = nid(); S.assets.push({ id, ...rec, repairs: [] }); save(); return id;
    },
    asset: id => (S.assets || []).find(a => a.id === id),
    assets(deptId) { return (S.assets || []).filter(a => !deptId || a.dept_id === deptId).sort((a, b) => a.category.localeCompare(b.category, 'ko') || a.name.localeCompare(b.name, 'ko')); },
    deleteAsset(id) { S.assets = (S.assets || []).filter(a => a.id !== id); save(); },
    addRepair(assetId, r) {
      const a = (S.assets || []).find(v => v.id === assetId); if (!a) throw new ValidationError('비품을 찾을 수 없습니다.');
      a.repairs = a.repairs || []; a.repairs.push({ id: nid(), date: reqDate(r.date), note: reqText(r.note, '수리 내용'), cost: r.cost === '' || r.cost == null ? 0 : reqMoney(Number(r.cost), '수리비', true) }); save();
    },
    deleteRepair(assetId, repairId) { const a = (S.assets || []).find(v => v.id === assetId); if (a) { a.repairs = (a.repairs || []).filter(r => r.id !== repairId); save(); } },

    // ----- 월 결산 보고서 (부서 하나 또는 전체) -----
    monthlyReport(deptId, year, month) {
      const mm = String(month).padStart(2, '0'); const rows = api.transactions({ deptId, year, month });
      const upto = S.transactions.filter(t => !t.voided && (!deptId || t.dept_id === deptId) && t.date.startsWith(String(year)) && t.date.slice(5, 7) <= mm);
      const sum = (arr, k) => arr.filter(t => t.kind === k).reduce((a, t) => a + t.amount, 0);
      const cats = new Map(); const get = c => { if (!cats.has(c)) cats.set(c, { category: c, budget: 0, month: 0, ytd: 0 }); return cats.get(c); };
      for (const b of S.budgets) if (b.year === year && (!deptId || b.dept_id === deptId)) get(b.category).budget += b.amount;
      for (const t of rows) if (t.kind === 'expense') get(t.category || '(항목 없음)').month += t.amount;
      for (const t of upto) if (t.kind === 'expense') get(t.category || '(항목 없음)').ytd += t.amount;
      const exp = rows.filter(t => t.kind === 'expense'); const noRc = exp.filter(t => !t.receipt);
      return { year, month, deptId, rows, income: sum(rows, 'income'), expense: sum(rows, 'expense'), net: sum(rows, 'income') - sum(rows, 'expense'), ytdExpense: sum(upto, 'expense'),
        categories: [...cats.values()].map(c => ({ ...c, remaining: c.budget - c.ytd })).sort((a, b) => b.ytd - a.ytd || a.category.localeCompare(b.category, 'ko')),
        receipts: { with: exp.length - noRc.length, without: noRc.length, withoutAmount: noRc.reduce((a, t) => a + t.amount, 0) } };
    },
    movePerson(id, deptId, className) { const p = person(id); p.dept_id = deptId; p.class_name = className || ''; save(); },
    setPersonStatus(id, status) { person(id).status = status; save(); }, // 명단 제외 ≠ 기록 삭제
    people({ deptId, status = 'active', className } = {}) {
      const dup = {}; S.people.forEach(p => (dup[p.name] = (dup[p.name] || 0) + 1));
      return S.people.filter(p => (!deptId || p.dept_id === deptId) && (status === 'all' || p.status === status) && (!className || p.class_name === className))
        .map(p => ({ ...p, display: dup[p.name] > 1 ? `${p.name} (${[p.birth_year ? p.birth_year + '년생' : '', p.class_name].filter(Boolean).join('·') || '#' + p.id})` : p.name }))
        .sort((a, b) => a.class_name.localeCompare(b.class_name, 'ko') || a.name.localeCompare(b.name, 'ko'));
    },
    deletePerson(id) {
      if (S.attendance.some(a => a.person_id === id) || S.participants.some(a => a.person_id === id) || (S.visits || []).some(v => v.person_id === id)) throw new ValidationError('출석·참가·심방 기록이 있는 사람은 삭제할 수 없습니다. 명단에서 제외하세요.');
      S.people = S.people.filter(p => p.id !== id); S.growth = (S.growth || []).filter(g => g.person_id !== id); save();
    },

    // ----- 예배·출석 -----
    saveService(s) {
      const rec = { dept_id: Number(s.dept_id), title: reqText(s.title, '예배명'), date: reqDate(s.date), time: s.time || '', place: s.place || '', scripture: s.scripture || '', sermon_title: s.sermon_title || '', leader: s.leader || '', order_text: s.order_text || '', kind: s.kind === 'special' ? 'special' : 'regular' };
      if (!dept(rec.dept_id)) throw new ValidationError('부서를 선택하세요.');
      if (s.id) { Object.assign(S.services.find(x => x.id === s.id), rec); save(); return s.id; }
      return addSeries(S.services, rec, s);
    },
    // 반복해서 만든 예배·일정을 묶음(series)으로 지운다: fromDate 이후(포함)만. 출석 기록이 있어도 함께 지워지므로 화면에서 먼저 확인한다.
    seriesCount(kind, id) { const list = kind === 'service' ? S.services : S.schedules; const x = list.find(v => v.id === id); return x && x.series ? list.filter(v => v.series === x.series && v.date >= x.date).length : 1; },
    deleteSeries(kind, id) {
      const list = kind === 'service' ? S.services : S.schedules; const x = list.find(v => v.id === id); if (!x) return 0;
      const gone = new Set(list.filter(v => v.id === id || (x.series && v.series === x.series && v.date >= x.date)).map(v => v.id));
      if (kind === 'service') { S.attendance = S.attendance.filter(a => !gone.has(a.service_id)); S.services = S.services.filter(v => !gone.has(v.id)); } else S.schedules = S.schedules.filter(v => !gone.has(v.id));
      save(); return gone.size;
    },
    // ----- 일정(교사 기도회·회의 등. 예배·행사와 별도) -----
    saveSchedule(s) {
      const rec = { dept_id: Number(s.dept_id), title: reqText(s.title, '일정 이름'), type: SCHEDULE_TYPES.includes(s.type) ? s.type : '기타', date: reqDate(s.date), time: s.time || '', place: s.place || '', note: s.note || '', end: s.end ? reqDate(s.end, '끝나는 날') : '' };
      if (rec.end && rec.end < rec.date) throw new ValidationError('끝나는 날이 시작보다 앞서요.'); if (rec.end === rec.date) rec.end = '';
      if (!dept(rec.dept_id)) throw new ValidationError('부서를 선택하세요.');
      S.schedules = S.schedules || [];
      if (s.id) { Object.assign(S.schedules.find(x => x.id === s.id), rec); save(); return s.id; }
      return addSeries(S.schedules, rec, s);
    },
    // PDF 등에서 가져온 후보를 한 번에 등록한다. items: [{ kind: 'event'|'schedule'|'service', dept_id, title, date, end, time, type }]
    // 같은 부서·이름·날짜가 이미 있으면 건너뛰고, 하나라도 형식이 틀리면 아무것도 등록하지 않는다.
    importPlanItems(items) {
      if (!Array.isArray(items) || !items.length) throw new ValidationError('등록할 항목이 없어요.'); if (items.length > 300) throw new ValidationError('한 번에 300개까지 등록할 수 있어요.');
      const rows = items.map((it, i) => {
        const n = `${i + 1}번째 항목`; const kind = ['event', 'schedule', 'service'].includes(it.kind) ? it.kind : null; if (!kind) throw new ValidationError(`${n}: 구분을 고르세요.`);
        if (!dept(Number(it.dept_id))) throw new ValidationError(`${n}: 부서를 선택하세요.`);
        const title = reqText(it.title, `${n} 이름`); if (title.length > 80) throw new ValidationError(`${n}: 이름이 너무 길어요.`);
        const date = reqDate(it.date, `${n} 날짜`); const end = it.end ? reqDate(it.end, `${n} 끝 날짜`) : date; if (end < date) throw new ValidationError(`${n}: 끝 날짜가 시작보다 빨라요.`);
        return { kind, dept_id: Number(it.dept_id), title, date, end, time: /^\d{2}:\d{2}$/.test(it.time || '') ? it.time : '', type: SCHEDULE_TYPES.includes(it.type) ? it.type : '기타', scripture: String(it.scripture || '').slice(0, 60) };
      });
      S.schedules = S.schedules || []; const snap = JSON.stringify(S); const made = { event: 0, schedule: 0, service: 0 }; let skipped = 0;
      try {
        for (const r of rows) {
          const dup = r.kind === 'event' ? S.events.some(e => e.dept_id === r.dept_id && e.title === r.title && e.start_date === r.date) : r.kind === 'service' ? S.services.some(e => e.dept_id === r.dept_id && e.title === r.title && e.date === r.date) : S.schedules.some(e => e.dept_id === r.dept_id && e.title === r.title && e.date === r.date);
          if (dup) { skipped++; continue; }
          if (r.kind === 'event') S.events.push({ id: nid(), dept_id: r.dept_id, title: r.title, type: '행사', start_date: r.date, end_date: r.end, place: '', owner: '', target_count: 0, expected_budget: 0, note: '', status: 'planned' });
          else if (r.kind === 'service') S.services.push({ id: nid(), dept_id: r.dept_id, title: r.title, date: r.date, time: r.time, place: '', scripture: r.scripture, sermon_title: '', leader: '', order_text: '', kind: 'regular' });
          else S.schedules.push({ id: nid(), dept_id: r.dept_id, title: r.title, type: r.type, date: r.date, time: r.time, place: '', note: '' });
          made[r.kind]++;
        }
        save();
      } catch (e) { S = JSON.parse(snap); throw e; }
      return { made, skipped };
    },
    // ----- PDF 등에서 가져온 후보를 한 번에 등록하는 함수들(모두: 먼저 전부 검사 → 하나라도 틀리면 아무것도 저장하지 않음) -----
    importTransactions(deptId, rows) {
      if (!dept(Number(deptId))) throw new ValidationError('부서를 선택하세요.'); if (!Array.isArray(rows) || !rows.length) throw new ValidationError('등록할 거래가 없어요.'); if (rows.length > 500) throw new ValidationError('한 번에 500개까지 등록할 수 있어요.');
      const recs = rows.map((r, i) => { const n = `${i + 1}번째 거래`; if (!['income', 'expense'].includes(r.kind)) throw new ValidationError(`${n}: 수입/지출을 고르세요.`); return { dept_id: Number(deptId), date: reqDate(r.date, `${n} 날짜`), kind: r.kind, amount: reqMoney(Number(r.amount), `${n} 금액`), category: String(r.category || '').slice(0, 40), memo: String(r.memo || '').slice(0, 80), event_id: null, receipt: null, voided: false }; });
      const have = new Set(S.transactions.filter(t => !t.voided).map(t => `${t.dept_id}|${t.date}|${t.kind}|${t.amount}|${t.memo}`)); const snap = JSON.stringify(S); let made = 0, skipped = 0;
      try { for (const r of recs) { const k = `${r.dept_id}|${r.date}|${r.kind}|${r.amount}|${r.memo}`; if (have.has(k)) { skipped++; continue; } have.add(k); S.transactions.push({ id: nid(), ...r }); made++; } save(); } catch (e) { S = JSON.parse(snap); throw e; }
      return { made, skipped };
    },
    importBudgets(deptId, year, rows) {
      if (!dept(Number(deptId))) throw new ValidationError('부서를 선택하세요.'); if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new ValidationError('연도가 올바르지 않아요.'); if (!Array.isArray(rows) || !rows.length) throw new ValidationError('등록할 예산 항목이 없어요.');
      const recs = rows.map((r, i) => ({ category: reqText(r.category, `${i + 1}번째 항목 이름`).slice(0, 40), amount: reqMoney(Number(r.amount), `${i + 1}번째 예산액`, true) })); const snap = JSON.stringify(S); let added = 0, updated = 0;
      try { for (const r of recs) { const b = S.budgets.find(x => x.dept_id === Number(deptId) && x.year === year && x.category === r.category); if (b) { b.amount = r.amount; updated++; } else { S.budgets.push({ id: nid(), dept_id: Number(deptId), year, category: r.category, amount: r.amount }); added++; } } save(); } catch (e) { S = JSON.parse(snap); throw e; }
      return { added, updated };
    },
    importAssets(deptId, rows) {
      if (!dept(Number(deptId))) throw new ValidationError('부서를 선택하세요.'); if (!Array.isArray(rows) || !rows.length) throw new ValidationError('등록할 비품이 없어요.'); if (rows.length > 500) throw new ValidationError('한 번에 500개까지 등록할 수 있어요.');
      S.assets = S.assets || [];
      const recs = rows.map((a, i) => { const qty = a.qty === '' || a.qty == null ? 1 : Number(a.qty); if (!Number.isInteger(qty) || qty < 0 || qty > 99999) throw new ValidationError(`${i + 1}번째 수량은 0 이상의 정수여야 해요.`); return { dept_id: Number(deptId), name: reqText(a.name, `${i + 1}번째 품목 이름`).slice(0, 40), category: ASSET_CATEGORIES.includes(a.category) ? a.category : '기타', place: String(a.place || '').slice(0, 40), qty, status: '사용 중', note: '' }; });
      const have = new Set(S.assets.map(a => `${a.dept_id}|${a.name}|${a.place}`)); const snap = JSON.stringify(S); let made = 0, skipped = 0;
      try { for (const r of recs) { const k = `${r.dept_id}|${r.name}|${r.place}`; if (have.has(k)) { skipped++; continue; } have.add(k); S.assets.push({ id: nid(), ...r, repairs: [] }); made++; } save(); } catch (e) { S = JSON.parse(snap); throw e; }
      return { made, skipped };
    },
    importMonthThemes(deptId, year, themes) { // themes: { 1: '주제', ... } — 선택한 달의 주제를 덮어쓴다
      if (!dept(Number(deptId))) throw new ValidationError('부서를 선택하세요.'); const ks = Object.keys(themes || {}); if (!ks.length) throw new ValidationError('등록할 주제가 없어요.');
      const p = api.plan(Number(deptId), year); const next = { ...p.themes }; for (const k of ks) { const m = Number(k); if (!Number.isInteger(m) || m < 1 || m > 12) throw new ValidationError('달은 1~12여야 해요.'); next[m] = reqText(themes[k], `${m}월 주제`).slice(0, 60); }
      S.plans[`${Number(deptId)}-${year}`] = { ...p, goal: p.goal, themes: next }; save(); return ks.length;
    },    schedule: id => (S.schedules || []).find(s => s.id === id),
    schedules(deptId) { return (S.schedules || []).filter(s => !deptId || s.dept_id === deptId).sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || '')); },
    deleteSchedule(id) { S.schedules = (S.schedules || []).filter(s => s.id !== id); save(); },
    cloneService(id, newDate) { const s = S.services.find(x => x.id === id); return api.saveService({ ...s, id: undefined, date: newDate }); }, // 순서·담당만 복제, 출석은 복제 안 함
    service: id => S.services.find(s => s.id === id),
    services(deptId) { return S.services.filter(s => !deptId || s.dept_id === deptId).sort((a, b) => b.date.localeCompare(a.date)); },
    setAttendance(serviceId, personId, present) { // 한 회차에 한 사람은 한 행: 중복 집계 불가
      if (!api.service(serviceId) || !person(personId)) throw new ValidationError('예배 또는 사람을 찾을 수 없습니다.');
      const p = person(personId); const a = S.attendance.find(x => x.service_id === serviceId && x.person_id === personId);
      if (a) a.present = !!present; else S.attendance.push({ service_id: serviceId, person_id: personId, present: !!present, class_at: p.class_name, dept_at: p.dept_id }); save();
    },
    attendanceCount(serviceId) { const rows = S.attendance.filter(a => a.service_id === serviceId); return { present: rows.filter(a => a.present).length, recorded: rows.length }; },
    // 출석부: 행=사람, 열=최근 회차. 부서 이동·명단 제외 후에도 과거 기록이 있는 사람은 포함한다.
    attendanceMatrix(deptId, { last = 8 } = {}) {
      const svcs = S.services.filter(s => s.dept_id === deptId && s.kind === 'regular').sort((a, b) => b.date.localeCompare(a.date)).slice(0, last).reverse();
      const ids = new Set(svcs.map(s => s.id)); const involved = new Set(S.attendance.filter(a => ids.has(a.service_id)).map(a => a.person_id));
      const rows = S.people.filter(p => (p.dept_id === deptId && p.status === 'active') || involved.has(p.id)).map(p => {
        const cells = svcs.map(s => { const a = S.attendance.find(x => x.service_id === s.id && x.person_id === p.id); return a ? (a.present ? 1 : 0) : null; });
        const rec = cells.filter(c => c !== null); return { person: p, cells, present: rec.filter(c => c === 1).length, rate: rec.length ? Math.round(rec.filter(c => c === 1).length / rec.length * 100) : null, former: !(p.dept_id === deptId && p.status === 'active') };
      }).sort((a, b) => a.person.class_name.localeCompare(b.person.class_name, 'ko') || a.person.name.localeCompare(b.person.name, 'ko'));
      return { services: svcs, rows, totals: svcs.map(s => api.attendanceCount(s.id).present) };
    },

    // ----- 회계 -----
    saveBudget(deptId, year, category, amount) {
      reqMoney(amount, '예산액', true); const b = S.budgets.find(x => x.dept_id === deptId && x.year === year && x.category === category);
      if (b) b.amount = amount; else S.budgets.push({ id: nid(), dept_id: deptId, year, category: reqText(category, '항목'), amount }); save();
    },
    addTransaction(t) {
      const rec = { dept_id: Number(t.dept_id), date: reqDate(t.date), kind: t.kind, amount: reqMoney(t.amount), category: t.category || '', memo: t.memo || '', event_id: t.event_id ? Number(t.event_id) : null, receipt: t.receipt ? String(t.receipt) : null };
      if (rec.receipt && !RECEIPT_ID.test(rec.receipt)) throw new ValidationError('영수증 사진 번호가 올바르지 않습니다.');
      if (!['income', 'expense'].includes(rec.kind)) throw new ValidationError('수입/지출 구분이 필요합니다.');
      if (!dept(rec.dept_id)) throw new ValidationError('부서를 선택하세요.');
      if (rec.event_id) { const e = ev(rec.event_id); if (!e) throw new ValidationError('연결할 행사를 찾을 수 없습니다.'); if (e.dept_id !== rec.dept_id) throw new ValidationError('행사와 부서가 다릅니다.'); }
      const id = nid(); S.transactions.push({ id, ...rec, voided: false }); save(); return id;
    },
    voidTransaction(id) { S.transactions.find(t => t.id === id).voided = true; save(); },
    transactions({ deptId, year, month, eventId } = {}) {
      return S.transactions.filter(t => !t.voided && (!deptId || t.dept_id === deptId) && (!year || t.date.startsWith(String(year))) && (!month || t.date.slice(5, 7) === String(month).padStart(2, '0')) && (!eventId || t.event_id === eventId)).sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
    },
    // 부서 집계는 거래 한 행에서 계산 → 행사 지출이 부서 합계에 두 번 더해지지 않는다.
    deptSummary(deptId, year) {
      const tx = api.transactions({ deptId, year }); const sum = (k, f = () => true) => tx.filter(t => t.kind === k && f(t)).reduce((a, t) => a + t.amount, 0);
      const budgets = S.budgets.filter(b => b.dept_id === deptId && b.year === year); const budget = budgets.reduce((a, b) => a + b.amount, 0);
      const income = sum('income'), expense = sum('expense');
      return { budget, income, expense, budget_remaining: budget - expense, net: income - expense, event_expense: sum('expense', t => t.event_id), non_event_expense: sum('expense', t => !t.event_id),
        byCategory: budgets.map(b => { const spent = sum('expense', t => t.category === b.category); return { category: b.category, budget: b.amount, spent, remaining: b.amount - spent }; }) };
    },
    monthly(deptId, year) {
      return Array.from({ length: 12 }, (_, i) => { const tx = api.transactions({ deptId, year, month: i + 1 }); const income = tx.filter(t => t.kind === 'income').reduce((a, t) => a + t.amount, 0), expense = tx.filter(t => t.kind === 'expense').reduce((a, t) => a + t.amount, 0); return { month: i + 1, income, expense, net: income - expense }; });
    },

    // ----- 부서별 사역(MB12) -----
    deptKind: id => ((dept(id) || {}).kind) || guessDeptKind((dept(id) || {}).name, id),
    checks(deptId) { const c = (S.deptCfg[deptId] || {}).checks; return Array.isArray(c) ? c : (DEFAULT_CHECKS[api.deptKind(deptId)] || []); },
    saveChecks(deptId, list) {
      if (!dept(deptId)) throw new ValidationError('부서를 선택하세요.'); const seen = new Set();
      const out = (list || []).map(c => ({ key: String(c.key || '').replace(/[^a-z0-9]/gi, '').slice(0, 16) || 'c' + Math.random().toString(36).slice(2, 7), label: String(c.label || '').trim().slice(0, 20), points: Math.max(0, Math.min(100, Math.trunc(Number(c.points)) || 0)) })).filter(c => c.label && !seen.has(c.key) && seen.add(c.key));
      if (out.length > MAX_CHECKS) throw new ValidationError(`체크 항목은 ${MAX_CHECKS}개까지 둘 수 있어요.`);
      S.deptCfg[deptId] = { ...(S.deptCfg[deptId] || {}), checks: out }; save(); return out;
    },
    growthOf(serviceId) { const m = new Map(); for (const g of S.growth) if (g.service_id === serviceId) m.set(g.person_id, g.items); return m; },
    setGrowth(serviceId, personId, key, on) {
      const sv = api.service(serviceId); if (!sv || !person(personId)) throw new ValidationError('예배 또는 사람을 찾을 수 없습니다.');
      if (!api.checks(sv.dept_id).some(c => c.key === key)) throw new ValidationError('없는 체크 항목이에요.');
      let g = S.growth.find(x => x.service_id === serviceId && x.person_id === personId); if (!g) { g = { service_id: serviceId, person_id: personId, items: [] }; S.growth.push(g); }
      g.items = on ? [...new Set([...g.items, key])] : g.items.filter(k => k !== key); if (!g.items.length) S.growth = S.growth.filter(x => x !== g); save();
    },
    // 기간 동안 사람별 체크 횟수와 달란트 합계(가나다순. 순위를 매기지 않는다)
    growthTotals(deptId, from, to) {
      const checks = api.checks(deptId); const pts = Object.fromEntries(checks.map(c => [c.key, c.points])); const svc = new Map(S.services.filter(s => s.dept_id === deptId && s.date >= from && s.date <= to).map(s => [s.id, s]));
      const rows = new Map(); for (const g of S.growth) { if (!svc.has(g.service_id)) continue; const r = rows.get(g.person_id) || { person: person(g.person_id), counts: {}, points: 0 }; for (const k of g.items) { if (!(k in pts)) continue; r.counts[k] = (r.counts[k] || 0) + 1; r.points += pts[k]; } rows.set(g.person_id, r); }
      for (const p of S.people) if (p.dept_id === deptId && p.status === 'active' && !rows.has(p.id)) rows.set(p.id, { person: p, counts: {}, points: 0 });
      return { checks, services: svc.size, rows: [...rows.values()].filter(r => r.person).sort((a, b) => (a.person.class_name || '').localeCompare(b.person.class_name || '', 'ko') || a.person.name.localeCompare(b.person.name, 'ko')) };
    },
    examPeriods(deptId, from = '0000-01-01', to = '9999-12-31') { return (S.schedules || []).filter(s => s.type === EXAM_TYPE && (!deptId || s.dept_id === deptId) && (s.end || s.date) >= from && s.date <= to).sort((a, b) => a.date.localeCompare(b.date)); },
    examOverlap(deptId, from, to) { return api.examPeriods(deptId, from, to); },
    // 장기 부재: 사유·기간·연락 주기. 마지막 연락은 심방·돌봄 기록에서 찾는다.
    setAway(personId, a) {
      const p = person(personId); if (!p) throw new ValidationError('사람을 찾을 수 없습니다.'); const reason = AWAY_REASONS.includes(a.reason) ? a.reason : '기타';
      const start = reqDate(a.start || today(), '시작일'); const until = a.until ? reqDate(a.until, '돌아올 예정일') : ''; if (until && until < start) throw new ValidationError('돌아올 예정일이 시작보다 앞서요.');
      const every = Math.max(7, Math.min(180, Math.trunc(Number(a.every)) || AWAY_EVERY[reason]));
      p.away = { reason, start, until, every, note: String(a.note || '').slice(0, 120) }; p.status = 'away'; save();
    },
    returnFromAway(personId) { const p = person(personId); if (!p) return; p.status = 'active'; if (p.away) p.away.back = today(); save(); },
    awayList(deptId, t = today()) {
      const last = new Map(); for (const v of (S.visits || [])) if (!last.has(v.person_id) || v.date > last.get(v.person_id)) last.set(v.person_id, v.date);
      return S.people.filter(p => p.status === 'away' && p.away && (!deptId || p.dept_id === deptId)).map(p => { const l = last.get(p.id) && last.get(p.id) >= p.away.start ? last.get(p.id) : null; const base = l || p.away.start; const next = addDays(base, p.away.every);
        return { person: p, last: l, next, due: next <= t, back: p.away.until && p.away.until <= addDays(t, 30) }; }).sort((a, b) => a.next.localeCompare(b.next));
    },
    // 새가족 정착: 등록일과 단계별 완료일. 다음 단계와 등록 후 지난 날을 돌려준다.
    startNewcomer(personId, date = today()) { const p = person(personId); if (!p) throw new ValidationError('사람을 찾을 수 없습니다.'); p.newcomer = { reg: reqDate(date), steps: {} }; save(); },
    setNewcomerStep(personId, key, on) {
      const p = person(personId); if (!p || !p.newcomer) throw new ValidationError('새가족으로 등록된 사람이 아니에요.'); if (!NEWCOMER_STEPS.some(([k]) => k === key)) throw new ValidationError('없는 단계예요.');
      if (on) p.newcomer.steps[key] = today(); else delete p.newcomer.steps[key]; save();
    },
    endNewcomer(personId) { const p = person(personId); if (p && p.newcomer) { p.newcomer.done = today(); save(); } },
    newcomers(deptId, t = today()) {
      return S.people.filter(p => p.newcomer && !p.newcomer.done && p.status === 'active' && (!deptId || p.dept_id === deptId)).map(p => ({ person: p, next: NEWCOMER_STEPS.find(([k]) => !p.newcomer.steps[k]) || null, days: Math.round((Date.parse(t + 'T00:00:00Z') - Date.parse(p.newcomer.reg + 'T00:00:00Z')) / 864e5) })).sort((a, b) => a.person.newcomer.reg.localeCompare(b.person.newcomer.reg));
    },

    // ----- 교재(공과): 교재 틀 → 주일예배에 한 과씩 배치, 중간에 다른 예배가 들어오면 한 주씩 밀기 -----
    curricula() { return (S.curricula || []).slice().sort((a, b) => a.name.localeCompare(b.name, 'ko')); },
    curriculum: id => (S.curricula || []).find(c => c.id === id),
    saveCurriculum(c) {
      const years = Number(c.years); if (!Number.isInteger(years) || years < 1 || years > 3) throw new ValidationError('주기는 1~3년 중에서 고르세요.');
      const dept_id = Number(c.dept_id) || 0; if (dept_id && !dept(dept_id)) throw new ValidationError('부서를 선택하세요.');
      const lessons = (c.lessons || []).filter(l => Number(l.year) >= 1 && Number(l.year) <= years).map(l => ({ year: Number(l.year), no: Math.max(1, Math.min(200, Math.trunc(Number(l.no)) || 1)), ...cleanLesson(l) })).sort((a, b) => a.year - b.year || a.no - b.no);
      if (lessons.length > MAX_LESSONS) throw new ValidationError(`교재 하나에는 ${MAX_LESSONS}과까지 넣을 수 있어요.`);
      const rec = { name: reqText(c.name, '교재 이름').slice(0, 60), publisher: String(c.publisher || '').trim().slice(0, 60), dept_id, years, lessons, note: String(c.note || '').slice(0, 400), source: String(c.source || '').slice(0, 400) };
      S.curricula = S.curricula || [];
      if (c.id) { const x = S.curricula.find(v => v.id === c.id); if (!x) throw new ValidationError('교재를 찾을 수 없습니다.'); Object.assign(x, rec); save(); return c.id; }
      if (S.curricula.length >= MAX_CURRICULA) throw new ValidationError(`교재는 ${MAX_CURRICULA}개까지 만들 수 있어요.`);
      const id = nid(); S.curricula.push({ id, ...rec }); save(); return id;
    },
    // 교재 틀(출판사 구성)로 빈 교재를 만든다. 과 제목·본문은 비어 있다.
    curriculumFromPreset(key, o = {}) {
      const p = CURRICULUM_PRESETS.find(x => x.key === key); if (!p) throw new ValidationError('교재 틀을 찾을 수 없습니다.');
      const years = Number(o.years) || p.years, per = Number(o.perYear) || p.perYear;
      if (!Number.isInteger(per) || per < 1 || per > 60) throw new ValidationError('한 해 과 수는 1~60 사이로 적어 주세요.');
      return api.saveCurriculum({ name: o.name || p.name, publisher: p.publisher, dept_id: o.dept_id, years, lessons: blankLessons(years, per), note: p.note, source: p.source || '' });
    },
    // 목차 붙여 넣기 등: 한 해(year) 분량의 과를 통째로 바꾼다
    setCurriculumYear(id, year, rows) {
      const c = api.curriculum(id); if (!c) throw new ValidationError('교재를 찾을 수 없습니다.'); if (!rows.length) throw new ValidationError('넣을 과가 없어요.');
      return api.saveCurriculum({ ...c, lessons: [...c.lessons.filter(l => l.year !== year), ...rows.map(r => ({ ...r, year }))] });
    },
    // 교재 파일(JSON): 교회 안에서 교재 목차를 나눠 쓰기. 형식이 맞지 않으면 아무것도 바꾸지 않는다.
    importCurriculum(obj) {
      if (!obj || obj.type !== 'mokhoe-curriculum' || !Array.isArray(obj.lessons)) throw new ValidationError('목회 비서 교재 파일이 아니에요.');
      return api.saveCurriculum({ name: obj.name, publisher: obj.publisher, dept_id: 0, years: obj.years, lessons: obj.lessons, note: obj.note, source: obj.source });
    },
    exportCurriculum(id) { const c = api.curriculum(id); if (!c) throw new ValidationError('교재를 찾을 수 없습니다.'); return { type: 'mokhoe-curriculum', version: 1, name: c.name, publisher: c.publisher, years: c.years, note: c.note, source: c.source, lessons: c.lessons }; },
    deleteCurriculum(id) { S.curricula = (S.curricula || []).filter(c => c.id !== id); save(); }, // 이미 배치한 예배의 공과 내용은 그대로 남는다
    // 연간 배치: year(몇 년차)의 과를 start~until 주일예배에 차례로 넣는다.
    // 그 주일에 특별예배만 있으면 넘어가고(다음 주로 밀림), ‘공과 쉼’으로 표시한 주일도 넘어간다.
    applyCurriculum(o) {
      const c = api.curriculum(Number(o.cid)); if (!c) throw new ValidationError('교재를 찾을 수 없습니다.');
      const deptId = Number(o.dept_id); if (!dept(deptId)) throw new ValidationError('부서를 선택하세요.'); const year = Number(o.year) || 1;
      reqDate(o.start, '시작 주일'); reqDate(o.until, '마지막 날짜'); if (o.until < o.start) throw new ValidationError('마지막 날짜가 시작보다 앞서요.');
      const lessons = c.lessons.filter(l => l.year === year).sort((a, b) => a.no - b.no); if (!lessons.length) throw new ValidationError(`${year}년차에 과가 없어요. 교재에서 과를 먼저 만들어 주세요.`);
      const pick = (PICK_PRESETS[o.pick] || PICK_PRESETS.basic).pick; const dates = sundaysBetween(o.start, o.until); if (!dates.length) throw new ValidationError('그 기간에 주일이 없어요.');
      const tpl = S.services.filter(s => s.dept_id === deptId && s.kind === 'regular').sort((a, b) => b.date.localeCompare(a.date))[0] || {};
      const r = { assigned: 0, created: 0, special: 0, hold: 0, missing: 0, fifth: 0, leftover: 0, first: null, last: null }; let i = 0;
      for (const d of dates) {
        if (i >= lessons.length) break;
        if (o.skip5 === 'yes' && Number(d.slice(8)) > 28) { r.fifth++; continue; } // 매달 다섯째 주일은 복습·특별 프로그램으로 비운다
        let reg = S.services.find(s => s.dept_id === deptId && s.date === d && s.kind === 'regular');
        if (!reg) {
          if (S.services.some(s => s.dept_id === deptId && s.date === d)) { r.special++; continue; }
          if (o.create !== 'yes') { r.missing++; continue; }
          reg = { id: nid(), dept_id: deptId, title: tpl.title || '주일예배', date: d, time: tpl.time || '', place: tpl.place || '', scripture: '', sermon_title: '', leader: tpl.leader || '', order_text: tpl.order_text || '', kind: 'regular' }; S.services.push(reg); r.created++;
        }
        if (reg.lesson_hold) { r.hold++; continue; }
        unfill(reg); reg.lesson = { cid: c.id, cname: c.name, year, years: c.years, no: lessons[i].no, ...cleanLesson(lessons[i]), pick: pick.slice(), fill: o.fill === 'yes' };
        fill(reg); i++; r.assigned++; r.first = r.first || d; r.last = d;
      }
      r.leftover = lessons.length - i; save(); return r;
    },
    // 통째로 넣기: 교재 여러 개를 한 번에 만들고(같은 이름·출판사 교재가 있으면 과를 새 것으로 바꿈) 부서마다 연간 배치한다.
    // plan[i] = { dept_id(0이면 교재만 넣기), year, skip5 }. 하나라도 실패하면 아무것도 바꾸지 않는다.
    installCurricula(items, o = {}) {
      const plan = o.plan || []; const used = new Set();
      items.forEach((c, i) => { const p = plan[i] || {}; const dId = Number(p.dept_id) || 0; if (!dId || p.skip) return;
        if (!dept(dId)) throw new ValidationError('부서를 선택하세요.');
        if (used.has(dId)) throw new ValidationError(`‘${(dept(dId) || {}).name}’에 교재 두 개를 같은 기간에 배치할 수 없어요. 하나는 ‘배치 안 함’으로 바꾸세요.`); used.add(dId);
        if (Number(p.year) > Number(c.years)) throw new ValidationError(`‘${c.name}’에는 ${p.year}년차가 없어요.`); });
      const backup = JSON.stringify({ curricula: S.curricula || [], services: S.services });
      try {
        return items.map((c, i) => { const p = plan[i] || {}; if (p.skip) return null; const dId = Number(p.dept_id) || 0;
          const same = (S.curricula || []).find(x => x.name === String(c.name).trim().slice(0, 60) && x.publisher === String(c.publisher || '').trim().slice(0, 60));
          const id = api.saveCurriculum({ ...(same || {}), name: c.name, publisher: c.publisher, dept_id: dId || (same ? same.dept_id : 0), years: c.years, lessons: c.lessons, note: c.note, source: c.source });
          const out = { id, name: (api.curriculum(id) || {}).name, replaced: !!same, dept_id: dId, year: Number(p.year) || 1 };
          if (dId) Object.assign(out, api.applyCurriculum({ cid: id, dept_id: dId, year: out.year, start: o.start, until: o.until, pick: o.pick || 'basic', create: o.create || 'yes', fill: o.fill || 'yes', skip5: p.skip5 || 'no' }));
          return out; }).filter(Boolean);
      } catch (e) { const b = JSON.parse(backup); S.curricula = b.curricula; S.services = b.services; save(); throw e; }
    },
    // 이 주일에 다른 예배·행사가 들어와서 공과를 쉰다: 이 주일의 공과부터 뒤로 한 주씩 민다(교체하지 않음).
    // 밀리는 범위는 공과가 이어진 주일까지이고, 비어 있는 첫 주일(없으면 새로 만든 다음 주일)이 마지막 공과를 받는다.
    shiftLesson(serviceId) {
      const s = api.service(serviceId); if (!s || !s.lesson) throw new ValidationError('이 예배에 배치된 공과가 없어요.');
      const slots = S.services.filter(x => x.dept_id === s.dept_id && x.kind === 'regular' && x.date > s.date && !x.lesson_hold).sort((a, b) => a.date.localeCompare(b.date));
      const chain = []; let gap = null; for (const x of slots) { if (x.lesson) chain.push(x); else { gap = x; break; } }
      if (!gap) { // 마지막 공과를 받을 주일예배를 새로 만든다
        let d = addDays((chain[chain.length - 1] || s).date, 7); d = addDays(d, (7 - new Date(d + 'T00:00:00Z').getUTCDay()) % 7);
        while (S.services.some(x => x.dept_id === s.dept_id && x.date === d && x.kind === 'regular')) d = addDays(d, 7);
        gap = { id: nid(), dept_id: s.dept_id, title: s.title, date: d, time: s.time || '', place: s.place || '', scripture: '', sermon_title: '', leader: s.leader || '', order_text: s.order_text || '', kind: 'regular' }; S.services.push(gap);
      }
      const from = [s, ...chain], to = [...chain, gap]; const payloads = from.map(x => x.lesson);
      from.forEach(unfill); to.forEach(unfill); s.lesson = null; s.lesson_hold = true;
      to.forEach((x, k) => { x.lesson = payloads[k]; fill(x); }); save(); return { moved: payloads.length, until: gap.date };
    },
    // ‘공과 쉼’을 풀고 뒤의 공과를 한 주씩 당겨 온다(밀기의 반대)
    pullLesson(serviceId) {
      const s = api.service(serviceId); if (!s) throw new ValidationError('예배를 찾을 수 없습니다.'); if (s.lesson) throw new ValidationError('이미 공과가 있어요.');
      s.lesson_hold = false;
      const chain = []; for (const x of S.services.filter(x => x.dept_id === s.dept_id && x.kind === 'regular' && x.date > s.date && !x.lesson_hold).sort((a, b) => a.date.localeCompare(b.date))) { if (x.lesson) chain.push(x); else break; }
      if (chain.length) { const payloads = chain.map(x => x.lesson); const to = [s, ...chain.slice(0, -1)]; chain.forEach(unfill); to.forEach((x, k) => { x.lesson = payloads[k]; fill(x); }); chain[chain.length - 1].lesson = null; }
      save(); return chain.length;
    },
    // 주마다 필요한 항목만: 내용 고치기와 ‘이 주에 쓸 항목’ 고르기. 공과가 없던 주일에도 직접 넣을 수 있다.
    setServiceLesson(serviceId, l, pick) {
      const s = api.service(serviceId); if (!s) throw new ValidationError('예배를 찾을 수 없습니다.'); const p = (pick || []).filter(k => LESSON_KEYS.includes(k));
      const v = cleanLesson(l); if (!LESSON_KEYS.some(k => v[k])) throw new ValidationError('한 칸 이상 적어 주세요.');
      unfill(s); s.lesson = { cid: 0, cname: '직접 입력', year: 1, years: 1, no: 0, ...(s.lesson || {}), ...v, pick: p.length ? p : ['title'] }; s.lesson_hold = false; fill(s); save();
    },
    clearServiceLesson(serviceId) { const s = api.service(serviceId); if (!s) return; unfill(s); s.lesson = null; save(); },
    // 예배 목록에서 공과 배치 현황 보기
    lessonPlan(deptId, from, to) { return S.services.filter(s => s.dept_id === deptId && s.date >= from && s.date <= to && (s.lesson || s.lesson_hold)).sort((a, b) => a.date.localeCompare(b.date)); },

    // ----- 연말 부서 보고서: 한 부서의 한 해를 모은다(모두 입력된 기록에서 계산) -----
    annualReport(deptId, year, t = today()) {
      const d = dept(deptId); if (!d) throw new ValidationError('부서를 선택하세요.'); const Y = String(year);
      const inYear = s => String(s || '').startsWith(Y);
      // 출석: 정기예배 중 출석을 기록한 회차만 평균에 넣는다
      const regular = S.services.filter(s => s.dept_id === deptId && s.kind === 'regular' && inYear(s.date)).sort((a, b) => a.date.localeCompare(b.date));
      const special = S.services.filter(s => s.dept_id === deptId && s.kind !== 'regular' && inYear(s.date)).length;
      const rec = regular.map(s => ({ s, c: api.attendanceCount(s.id) })).filter(x => x.c.recorded > 0).map(x => ({ date: x.s.date, present: x.c.present }));
      const avg = arr => arr.length ? Math.round(arr.reduce((a, x) => a + x.present, 0) / arr.length * 10) / 10 : null;
      const months = Array.from({ length: 12 }, (_, i) => { const mm = String(i + 1).padStart(2, '0'); const r = rec.filter(x => x.date.slice(5, 7) === mm); return { month: i + 1, count: r.length, avg: avg(r) }; });
      const top = rec.reduce((m, x) => (!m || x.present > m.present ? x : m), null), low = rec.reduce((m, x) => (!m || x.present < m.present ? x : m), null);
      // 올해 처음 출석한 사람: 이 부서 예배에서 처음 ‘출석’으로 기록된 날이 올해인 사람
      const svcDate = new Map(S.services.filter(s => s.dept_id === deptId).map(s => [s.id, s.date])); const first = new Map();
      for (const a of S.attendance) { const dt = svcDate.get(a.service_id); if (!dt || !a.present) continue; if (!first.has(a.person_id) || dt < first.get(a.person_id)) first.set(a.person_id, dt); }
      const newcomers = [...first.entries()].filter(([, dt]) => inYear(dt)).length;
      const active = S.people.filter(p => p.dept_id === deptId && p.status === 'active'); const byKind = k => active.filter(p => p.kind === k).length;
      // 행사
      const events = S.events.filter(e => e.dept_id === deptId && inYear(e.start_date)).sort((a, b) => a.start_date.localeCompare(b.start_date)).map(e => ({ e, s: api.eventSummary(e.id) }));
      // 심방·돌봄
      const vis = (S.visits || []).filter(v => inYear(v.date) && (person(v.person_id) || {}).dept_id === deptId); const byType = {}; vis.forEach(v => (byType[v.type] = (byType[v.type] || 0) + 1));
      // 회계
      const money = api.deptSummary(deptId, year); const monthly = api.monthly(deptId, year);
      const spentBy = {}; api.transactions({ deptId, year }).filter(x => x.kind === 'expense').forEach(x => { const c = x.category || '(항목 없음)'; spentBy[c] = (spentBy[c] || 0) + x.amount; });
      // 내년 초안: 올해 한 행사는 52주 뒤 같은 요일로, 예산은 올해 지출(만 원 단위 올림)과 올해 예산 중 큰 값
      const next = String(year + 1); const shift = s => new Date(Date.parse(s + 'T00:00:00Z') + 364 * 864e5).toISOString().slice(0, 10);
      const draftEvents = events.filter(({ e }) => e.status !== 'cancelled').map(({ e }) => ({ title: e.title.replace(new RegExp(Y, 'g'), next), type: e.type, date: shift(e.start_date), change: (e.retro && e.retro.change) || '' }));
      const cats = new Set([...money.byCategory.map(c => c.category), ...Object.keys(spentBy)]);
      const draftBudget = [...cats].map(c => { const b = (money.byCategory.find(x => x.category === c) || {}).budget || 0; const sp = spentBy[c] || 0; return { category: c, budget: b, spent: sp, suggest: Math.max(b, Math.ceil(sp / 10000) * 10000) }; }).sort((a, b) => b.suggest - a.suggest);
      const p = api.plan(deptId, year);
      return { dept: d, year, asOf: t, partial: t < `${Y}-12-31`, goal: p.goal, review: p.review || '', themes: p.themes || {}, nextGoal: api.plan(deptId, year + 1).goal,
        attendance: { held: regular.length, recorded: rec.length, avg: avg(rec), top, low, months, special },
        people: { active: active.length, child: byKind('child'), teen: byKind('teen'), youth: byKind('youth'), teacher: byKind('teacher'), volunteer: byKind('volunteer'), newcomers },
        events, visits: { count: vis.length, people: new Set(vis.map(v => v.person_id)).size, byType },
        money, monthly, draft: { events: draftEvents, budget: draftBudget, total: draftBudget.reduce((a, x) => a + x.suggest, 0) } };
    },
    saveReview(deptId, year, text) { if (!dept(deptId)) throw new ValidationError('부서를 선택하세요.'); const k = `${deptId}-${year}`; const p = S.plans[k] || { goal: '', themes: {} }; S.plans[k] = { ...p, review: String(text || '').slice(0, 3000) }; save(); },
    // ----- 연간·절기 계획 -----
    plan(deptId, year) { const k = `${deptId}-${year}`; return S.plans[k] || { goal: '', themes: {} }; },
    savePlan(deptId, year, goal, themes) { const k = `${deptId}-${year}`; S.plans[k] = { ...(S.plans[k] || {}), goal: goal || '', themes: themes || {} }; save(); },
    seasons(deptId, year) { return S.seasons.filter(s => (!deptId || s.dept_id === deptId) && s.year === year).sort((a, b) => (a.start || '').localeCompare(b.start || '')); },
    saveSeason(s) {
      const rec = { dept_id: Number(s.dept_id), year: Number(s.year), name: reqText(s.name, '절기명'), start: s.start ? reqDate(s.start, '시작일') : null, end: s.end ? reqDate(s.end, '종료일') : null, theme: s.theme || '', scripture: s.scripture || '', plan: s.plan || '' };
      if (s.id) Object.assign(S.seasons.find(x => x.id === s.id), rec); else S.seasons.push({ id: nid(), ...rec }); save();
    },
    deleteSeason(id) { S.seasons = S.seasons.filter(s => s.id !== id); save(); },

    // ----- 수정·삭제 보강 -----
    updatePerson(id, p) {
      const x = person(id); if (!x) throw new ValidationError('사람을 찾을 수 없습니다.');
      x.name = reqText(p.name, '이름'); x.kind = ['child', 'teen', 'youth', 'teacher', 'volunteer'].includes(p.kind) ? p.kind : x.kind;
      x.birth_year = p.birth_year ? Number(p.birth_year) : null; x.class_name = p.class_name || ''; if (p.dept_id) x.dept_id = Number(p.dept_id); save();
    },
    deleteService(id) { S.attendance = S.attendance.filter(a => a.service_id !== id); S.growth = (S.growth || []).filter(g => g.service_id !== id); S.services = S.services.filter(s => s.id !== id); save(); },
    updateTransaction(id, t) {
      const x = S.transactions.find(v => v.id === id); if (!x || x.voided) throw new ValidationError('수정할 수 없는 거래입니다.');
      const old = { ...x }; const id0 = x.id;
      S.transactions = S.transactions.filter(v => v.id !== id); // 검증을 새 거래 추가 로직에 맡기고, 실패하면 원래대로 되돌린다
      try { const nid2 = api.addTransaction(t); const n = S.transactions.find(v => v.id === nid2); n.id = id0; S.nextId--; save(); }
      catch (e) { S.transactions.push(old); throw e; }
    },

    // ----- 예시(템플릿) -----
    // 행사 예시 적용: 준비 업무(마감일은 행사 시작일 기준)와 준비물을 추가. 같은 이름은 건너뛰어 중복되지 않는다.
    applyEventTemplate(eventId, key) {
      const tpl = EVENT_TEMPLATES[key]; const e = ev(eventId); if (!tpl || !e) throw new ValidationError('예시를 찾을 수 없습니다.');
      let tasks = 0, supplies = 0;
      for (const t of tpl.tasks) if (!S.tasks.some(x => x.event_id === eventId && x.title === t.title)) { S.tasks.push({ id: nid(), event_id: eventId, title: t.title, due: eventTaskDue(e.start_date, t.offset), assignee: t.assignee || '', status: 'todo' }); tasks++; }
      S.supplies = S.supplies || [];
      for (const n of tpl.supplies) if (!S.supplies.some(x => x.event_id === eventId && x.name === n)) { S.supplies.push({ id: nid(), event_id: eventId, name: n, done: false }); supplies++; }
      save(); return { tasks, supplies };
    },
    // 진행 가이드의 준비 일정을 준비 업무로 추가(같은 이름은 건너뜀). items: [{title, offset|null}]
    applyGuidePrep(eventId, items) {
      const e = ev(eventId); if (!e || !Array.isArray(items)) throw new ValidationError('행사를 찾을 수 없습니다.');
      let n = 0; for (const it of items.slice(0, 30)) { const title = String((it && it.title) || '').trim().slice(0, 120); if (!title || S.tasks.some(x => x.event_id === eventId && x.title === title)) continue;
        S.tasks.push({ id: nid(), event_id: eventId, title, due: Number.isInteger(it.offset) ? eventTaskDue(e.start_date, it.offset) : '', assignee: '', status: 'todo' }); n++; }
      save(); return n;
    },
    loadSeasonTemplate(deptId, year) {
      let n = 0; for (const s of seasonTemplates(year)) if (!S.seasons.some(x => x.dept_id === deptId && x.year === year && x.name === s.name)) { S.seasons.push({ id: nid(), dept_id: deptId, year, ...s }); n++; }
      save(); return n;
    },
    loadMonthThemes(deptId, year) { // 비어 있는 달만 채운다
      const p = api.plan(deptId, year); const themes = { ...p.themes }; let n = 0;
      MONTH_THEMES.forEach((t, i) => { if (!themes[i + 1]) { themes[i + 1] = t; n++; } });
      S.plans[`${deptId}-${year}`] = { ...p, goal: p.goal, themes }; save(); return n;
    },
    // 홈의 시작 체크리스트: 데이터에서 자동으로 완료 여부를 계산
    guideProgress() {
      const done = {
        people: S.people.length > 0, plan: Object.values(S.plans).some(p => p.goal || Object.keys(p.themes || {}).length), event: S.events.length > 0, service: S.services.length > 0,
        attendance: S.attendance.length > 0, budget: S.budgets.length > 0, backup: !!S.lastExport,
      };
      return done;
    },
  };
  return api;
}
