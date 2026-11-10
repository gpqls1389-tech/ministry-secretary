// 목회 비서 데이터 로직. 브라우저(localStorage)와 Node 테스트 양쪽에서 동작하도록 저장소를 주입받는다.
import { makeSeed } from './seed.js';
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
export const RECEIPT_ID = /^[A-Za-z0-9_-]{1,64}$/; // 영수증 사진 번호(서버: 32자리 16진수, 이 브라우저: l로 시작)
export function validateState(j) {
  const bad = m => { throw new ValidationError(`이 앱의 백업 파일이 아니거나 내용이 손상되었습니다. (${m})`); };
  if (!j || typeof j !== 'object' || j.version !== 1) bad('버전');
  for (const k of ['depts', 'people', 'events', 'tasks', 'participants', 'services', 'attendance', 'budgets', 'transactions', 'seasons']) if (!Array.isArray(j[k])) bad(`${k} 목록 없음`);
  if (!j.plans || typeof j.plans !== 'object' || Array.isArray(j.plans)) bad('plans');
  if (j.supplies !== undefined && !Array.isArray(j.supplies)) bad('준비물');
  if (j.schedules !== undefined && !Array.isArray(j.schedules)) bad('일정');
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
  return j;
}

// 비어 있는 새 데이터(부서만 있음). 새 계정과 ‘실제 데이터로 시작’에서 사용
export function emptyState(todayStr = kstToday()) {
  const base = makeSeed(todayStr);
  return { version: 1, demo: false, nextId: 100, depts: base.depts, people: [], events: [], tasks: [], participants: [], services: [], attendance: [], budgets: [], transactions: [], plans: {}, seasons: [], supplies: [], schedules: [], visits: [], assets: [], links: [] };
}

export function createStore(storage, today = kstToday) {
  let S = null;
  const save = () => { // 저장이 막히거나 공간이 부족하면 조용히 넘어가지 않고 알린다
    try { storage.setItem(KEY, JSON.stringify(S)); }
    catch { throw new ValidationError('저장 공간이 부족하거나 브라우저가 저장을 막아 저장하지 못했습니다. 지금 설정에서 ‘내보내기’로 백업해 두세요.'); }
  };
  const nid = () => S.nextId++;
  let recovered = false;
  function load() {
    let raw = null;
    try { raw = storage.getItem(KEY); if (raw) { const j = JSON.parse(raw); validateState(j); j.schedules = j.schedules || []; j.visits = j.visits || []; j.assets = j.assets || []; j.links = j.links || []; S = j; return S; } } catch {
      // 저장된 값이 손상된 경우: 가상 데이터로 덮어쓰기 전에 원본을 따로 남겨 둔다(복구 가능)
      if (raw) { try { storage.setItem(KEY + ':broken', raw); recovered = true; } catch { /* 무시 */ } }
    }
    S = makeSeed(today()); try { save(); } catch { /* 저장 불가 환경: 메모리만 사용 */ } return S;
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
    resetDemo() { S = makeSeed(today()); save(); },
    startEmpty() { S = emptyState(today()); save(); },
    exportJson() { return JSON.stringify(S, null, 1); },
    // 가져오기: 구조가 하나라도 어긋나면 현재 데이터를 건드리지 않고 거부한다(일부만 반영되는 상황 방지)
    importJson(text) {
      let j; try { j = JSON.parse(text); } catch { throw new ValidationError('JSON 형식이 아닙니다.'); }
      validateState(j);
      j.schedules = j.schedules || []; j.visits = j.visits || []; j.assets = j.assets || []; j.links = j.links || []; const before = S; S = j;
      try { save(); } catch (e) { S = before; throw e; }
    },
    markExported() { S.lastExport = new Date().toISOString(); save(); },
    daysSinceExport() { return S.lastExport ? Math.floor((Date.now() - Date.parse(S.lastExport)) / 864e5) : null; },
    depts: () => S.depts, dept, person, ev,

    // ----- 일정·홈 -----
    calendar(deptId, from, to, { services = true } = {}) {
      const out = [];
      for (const s of (S.schedules || [])) if ((!deptId || s.dept_id === deptId) && s.date >= from && s.date <= to) out.push({ type: 'schedule', id: s.id, date: s.date, end: s.date, title: s.title, time: s.time, dept_id: s.dept_id, kind: s.type });
      if (services) for (const s of S.services) if ((!deptId || s.dept_id === deptId) && s.date >= from && s.date <= to) out.push({ type: 'service', id: s.id, date: s.date, end: s.date, title: s.title, time: s.time, dept_id: s.dept_id });
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
      S.people.push({ id, name: reqText(p.name, '이름'), kind: ['child', 'youth', 'teacher', 'volunteer'].includes(p.kind) ? p.kind : 'child', dept_id: Number(p.dept_id) || null, class_name: p.class_name || '', birth_year: p.birth_year ? Number(p.birth_year) : null, status: 'active' }); save(); return id;
    },
    // 명단 한꺼번에 등록: 먼저 검사만 하고(planPeopleImport) 사용자가 확인한 뒤 한 번에 저장한다(addPeopleBulk).
    // rows: [{ name, kind, dept, class_name, birth_year }] (kind는 아동/청년/교사/봉사자, dept는 부서 이름. 비우면 기본값)
    planPeopleImport(rows, defaultDeptId) {
      if (rows.length > 500) throw new ValidationError('한 번에 500명까지 등록할 수 있어요. 파일을 나눠서 올려 주세요.');
      const KINDS = { 아동: 'child', 청년: 'youth', 교사: 'teacher', 봉사자: 'volunteer', child: 'child', youth: 'youth', teacher: 'teacher', volunteer: 'volunteer' };
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
    setPeopleStatus(ids, status) { if (!['active', 'graduated', 'inactive'].includes(status)) throw new ValidationError('상태 오류'); const set = new Set(ids); let n = 0; for (const p of S.people) if (set.has(p.id)) { p.status = status; n++; } if (!n) throw new ValidationError('선택한 사람이 없습니다.'); save(); return n; },

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
      S.people = S.people.filter(p => p.id !== id); save();
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
      const rec = { dept_id: Number(s.dept_id), title: reqText(s.title, '일정 이름'), type: SCHEDULE_TYPES.includes(s.type) ? s.type : '기타', date: reqDate(s.date), time: s.time || '', place: s.place || '', note: s.note || '' };
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
      S.plans[`${Number(deptId)}-${year}`] = { goal: p.goal, themes: next }; save(); return ks.length;
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

    // ----- 연간·절기 계획 -----
    plan(deptId, year) { const k = `${deptId}-${year}`; return S.plans[k] || { goal: '', themes: {} }; },
    savePlan(deptId, year, goal, themes) { S.plans[`${deptId}-${year}`] = { goal: goal || '', themes: themes || {} }; save(); },
    seasons(deptId, year) { return S.seasons.filter(s => (!deptId || s.dept_id === deptId) && s.year === year).sort((a, b) => (a.start || '').localeCompare(b.start || '')); },
    saveSeason(s) {
      const rec = { dept_id: Number(s.dept_id), year: Number(s.year), name: reqText(s.name, '절기명'), start: s.start ? reqDate(s.start, '시작일') : null, end: s.end ? reqDate(s.end, '종료일') : null, theme: s.theme || '', scripture: s.scripture || '', plan: s.plan || '' };
      if (s.id) Object.assign(S.seasons.find(x => x.id === s.id), rec); else S.seasons.push({ id: nid(), ...rec }); save();
    },
    deleteSeason(id) { S.seasons = S.seasons.filter(s => s.id !== id); save(); },

    // ----- 수정·삭제 보강 -----
    updatePerson(id, p) {
      const x = person(id); if (!x) throw new ValidationError('사람을 찾을 수 없습니다.');
      x.name = reqText(p.name, '이름'); x.kind = ['child', 'youth', 'teacher', 'volunteer'].includes(p.kind) ? p.kind : x.kind;
      x.birth_year = p.birth_year ? Number(p.birth_year) : null; x.class_name = p.class_name || ''; if (p.dept_id) x.dept_id = Number(p.dept_id); save();
    },
    deleteService(id) { S.attendance = S.attendance.filter(a => a.service_id !== id); S.services = S.services.filter(s => s.id !== id); save(); },
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
    loadSeasonTemplate(deptId, year) {
      let n = 0; for (const s of seasonTemplates(year)) if (!S.seasons.some(x => x.dept_id === deptId && x.year === year && x.name === s.name)) { S.seasons.push({ id: nid(), dept_id: deptId, year, ...s }); n++; }
      save(); return n;
    },
    loadMonthThemes(deptId, year) { // 비어 있는 달만 채운다
      const p = api.plan(deptId, year); const themes = { ...p.themes }; let n = 0;
      MONTH_THEMES.forEach((t, i) => { if (!themes[i + 1]) { themes[i + 1] = t; n++; } });
      S.plans[`${deptId}-${year}`] = { goal: p.goal, themes }; save(); return n;
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
