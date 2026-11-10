// 목회 비서 데이터 로직. 브라우저(localStorage)와 Node 테스트 양쪽에서 동작하도록 저장소를 주입받는다.
import { makeSeed } from './seed.js';
import { EVENT_TEMPLATES, eventTaskDue, seasonTemplates, MONTH_THEMES } from './templates.js';

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
export function validateState(j) {
  const bad = m => { throw new ValidationError(`이 앱의 백업 파일이 아니거나 내용이 손상되었습니다. (${m})`); };
  if (!j || typeof j !== 'object' || j.version !== 1) bad('버전');
  for (const k of ['depts', 'people', 'events', 'tasks', 'participants', 'services', 'attendance', 'budgets', 'transactions', 'seasons']) if (!Array.isArray(j[k])) bad(`${k} 목록 없음`);
  if (!j.plans || typeof j.plans !== 'object' || Array.isArray(j.plans)) bad('plans');
  if (j.supplies !== undefined && !Array.isArray(j.supplies)) bad('준비물');
  if (!Number.isSafeInteger(j.nextId) || j.nextId < 1) bad('nextId');
  const dids = new Set(); for (const d of j.depts) { if (!isId(d.id) || typeof d.name !== 'string') bad('부서'); dids.add(d.id); }
  if (!dids.size) bad('부서 없음');
  const pids = new Set(); for (const p of j.people) { if (!isId(p.id) || typeof p.name !== 'string' || (p.dept_id != null && !dids.has(p.dept_id))) bad('인원'); pids.add(p.id); }
  const eids = new Set(); for (const e of j.events) { if (!isId(e.id) || typeof e.title !== 'string' || !dids.has(e.dept_id) || !isDate(e.start_date) || !isDate(e.end_date)) bad('행사'); eids.add(e.id); }
  const sids = new Set(); for (const s of j.services) { if (!isId(s.id) || typeof s.title !== 'string' || !dids.has(s.dept_id) || !isDate(s.date)) bad('예배'); sids.add(s.id); }
  for (const t of j.tasks) if (!isId(t.id) || !eids.has(t.event_id) || typeof t.title !== 'string') bad('준비 업무');
  for (const p of j.participants) if (!eids.has(p.event_id) || !pids.has(p.person_id) || !['applied', 'attended', 'cancelled'].includes(p.status)) bad('참가');
  for (const a of j.attendance) if (!sids.has(a.service_id) || !pids.has(a.person_id)) bad('출석');
  for (const b of j.budgets) if (!dids.has(b.dept_id) || !Number.isSafeInteger(b.amount) || b.amount < 0) bad('예산');
  for (const t of j.transactions) if (!isId(t.id) || !dids.has(t.dept_id) || !isDate(t.date) || !['income', 'expense'].includes(t.kind) || !Number.isSafeInteger(t.amount) || t.amount <= 0 || (t.event_id != null && !eids.has(t.event_id))) bad('거래');
  for (const s of j.seasons) if (!dids.has(s.dept_id) || typeof s.name !== 'string') bad('절기');
  return j;
}

// 비어 있는 새 데이터(부서만 있음). 새 계정과 ‘실제 데이터로 시작’에서 사용
export function emptyState(todayStr = kstToday()) {
  const base = makeSeed(todayStr);
  return { version: 1, demo: false, nextId: 100, depts: base.depts, people: [], events: [], tasks: [], participants: [], services: [], attendance: [], budgets: [], transactions: [], plans: {}, seasons: [], supplies: [] };
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
    try { raw = storage.getItem(KEY); if (raw) { const j = JSON.parse(raw); validateState(j); S = j; return S; } } catch {
      // 저장된 값이 손상된 경우: 가상 데이터로 덮어쓰기 전에 원본을 따로 남겨 둔다(복구 가능)
      if (raw) { try { storage.setItem(KEY + ':broken', raw); recovered = true; } catch { /* 무시 */ } }
    }
    S = makeSeed(today()); try { save(); } catch { /* 저장 불가 환경: 메모리만 사용 */ } return S;
  }
  load();
  const get = () => S;
  const dept = id => S.depts.find(d => d.id === id);
  const person = id => S.people.find(p => p.id === id);
  const ev = id => S.events.find(e => e.id === id);

  const api = {
    get, save, KEY, wasRecovered: () => recovered,
    resetDemo() { S = makeSeed(today()); save(); },
    startEmpty() { S = emptyState(today()); save(); },
    exportJson() { return JSON.stringify(S, null, 1); },
    // 가져오기: 구조가 하나라도 어긋나면 현재 데이터를 건드리지 않고 거부한다(일부만 반영되는 상황 방지)
    importJson(text) {
      let j; try { j = JSON.parse(text); } catch { throw new ValidationError('JSON 형식이 아닙니다.'); }
      validateState(j);
      const before = S; S = j;
      try { save(); } catch (e) { S = before; throw e; }
    },
    markExported() { S.lastExport = new Date().toISOString(); save(); },
    daysSinceExport() { return S.lastExport ? Math.floor((Date.now() - Date.parse(S.lastExport)) / 864e5) : null; },
    depts: () => S.depts, dept, person, ev,

    // ----- 일정·홈 -----
    calendar(deptId, from, to) {
      const out = [];
      for (const s of S.services) if ((!deptId || s.dept_id === deptId) && s.date >= from && s.date <= to) out.push({ type: 'service', id: s.id, date: s.date, end: s.date, title: s.title, time: s.time, dept_id: s.dept_id });
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
    movePerson(id, deptId, className) { const p = person(id); p.dept_id = deptId; p.class_name = className || ''; save(); },
    setPersonStatus(id, status) { person(id).status = status; save(); }, // 명단 제외 ≠ 기록 삭제
    people({ deptId, status = 'active', className } = {}) {
      const dup = {}; S.people.forEach(p => (dup[p.name] = (dup[p.name] || 0) + 1));
      return S.people.filter(p => (!deptId || p.dept_id === deptId) && (status === 'all' || p.status === status) && (!className || p.class_name === className))
        .map(p => ({ ...p, display: dup[p.name] > 1 ? `${p.name} (${[p.birth_year ? p.birth_year + '년생' : '', p.class_name].filter(Boolean).join('·') || '#' + p.id})` : p.name }))
        .sort((a, b) => a.class_name.localeCompare(b.class_name, 'ko') || a.name.localeCompare(b.name, 'ko'));
    },
    deletePerson(id) {
      if (S.attendance.some(a => a.person_id === id) || S.participants.some(a => a.person_id === id)) throw new ValidationError('출석·참가 기록이 있는 사람은 삭제할 수 없습니다. 명단에서 제외하세요.');
      S.people = S.people.filter(p => p.id !== id); save();
    },

    // ----- 예배·출석 -----
    saveService(s) {
      const rec = { dept_id: Number(s.dept_id), title: reqText(s.title, '예배명'), date: reqDate(s.date), time: s.time || '', place: s.place || '', scripture: s.scripture || '', sermon_title: s.sermon_title || '', leader: s.leader || '', order_text: s.order_text || '', kind: s.kind === 'special' ? 'special' : 'regular' };
      if (!dept(rec.dept_id)) throw new ValidationError('부서를 선택하세요.');
      if (s.id) { Object.assign(S.services.find(x => x.id === s.id), rec); save(); return s.id; }
      const id = nid(); S.services.push({ id, ...rec }); save(); return id;
    },
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
      const rec = { dept_id: Number(t.dept_id), date: reqDate(t.date), kind: t.kind, amount: reqMoney(t.amount), category: t.category || '', memo: t.memo || '', event_id: t.event_id ? Number(t.event_id) : null };
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
