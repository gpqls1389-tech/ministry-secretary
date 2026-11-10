import { createStore, kstToday } from './store.js';

let store;
try { store = createStore(window.localStorage); }
catch { // 저장소를 쓸 수 없는 환경(사생활 보호 모드 등): 이번 방문 동안만 메모리에 보관
  const m = new Map(); store = createStore({ getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v) }); window.__memOnly = true;
}
const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const won = n => (Number(n) || 0).toLocaleString('ko-KR') + '원';
const pad = n => String(n).padStart(2, '0');
const today = () => kstToday();
const KIND = { child: '아동', youth: '청년', teacher: '교사', volunteer: '봉사자' };
const PST = { applied: '신청', attended: '참석', cancelled: '취소' };
const TST = { todo: '대기', doing: '진행', done: '완료' };
const UI = { dept: 'all', year: Number(today().slice(0, 4)), month: today().slice(0, 7), planTab: 'cal', peopleTab: 'att' };
try { UI.dept = localStorage.getItem('ms:dept') || 'all'; } catch { /* 저장소 사용 불가 */ }
const did = () => (UI.dept === 'all' ? null : Number(UI.dept));
const workDept = () => did() || store.depts()[0].id;
const deptTag = id => { const d = store.dept(id); return d ? `<span class="tag ${id === 1 ? 'kid' : 'yth'}">${esc(d.name)}</span>` : ''; };
const range = (a, b) => (a === b ? a : `${a} ~ ${b}`);
const dow = d => ['일', '월', '화', '수', '목', '금', '토'][new Date(d + 'T00:00:00Z').getUTCDay()];
const md = d => `${Number(d.slice(5, 7))}/${Number(d.slice(8))}(${dow(d)})`;

function toast(msg, bad) { const t = $('#toast'); t.textContent = msg; t.className = 'show' + (bad ? ' bad' : ''); clearTimeout(toast.t); toast.t = setTimeout(() => (t.className = ''), bad ? 4500 : 2200); }
function guard(fn, ok) { try { const r = fn(); if (ok) toast(ok); return r; } catch (e) { toast(e.message, true); return undefined; } }

// ----- 대화상자 -----
function modal(html) { const d = document.createElement('dialog'); d.innerHTML = html; document.body.appendChild(d); d.addEventListener('close', () => d.remove()); d.showModal(); return d; }
function fld(f, v) {
  const val = v ?? f.def ?? ''; const req = f.req ? ' required' : '';
  if (f.type === 'select') return `<label class="f">${esc(f.label)}<select name="${f.k}"${req}>${f.options.map(([a, b]) => `<option value="${esc(a)}"${String(a) === String(val) ? ' selected' : ''}>${esc(b)}</option>`).join('')}</select></label>`;
  if (f.type === 'textarea') return `<label class="f">${esc(f.label)}<textarea name="${f.k}">${esc(val)}</textarea></label>`;
  return `<label class="f">${esc(f.label)}${f.req ? ' *' : ''}<input name="${f.k}" type="${f.type || 'text'}" value="${esc(val)}"${req}${f.type === 'number' ? ' min="0" step="1" inputmode="numeric"' : ''}></label>`;
}
function form({ title, fields, values = {}, onSubmit, submit = '저장', intro = '' }) {
  const d = modal(`<form method="dialog"><h3>${esc(title)}</h3>${intro}${fields.map(f => fld(f, values[f.k])).join('')}<div class="err"></div><div class="dlg-foot"><button type="button" data-x>취소</button><button class="pri">${esc(submit)}</button></div></form>`);
  $('[data-x]', d).onclick = () => d.close();
  $('form', d).onsubmit = e => { e.preventDefault(); const o = {}; for (const f of fields) o[f.k] = d.querySelector(`[name="${f.k}"]`).value; try { onSubmit(o); d.close(); render(); } catch (err) { $('.err', d).textContent = err.message; } };
}
function ask(msg, label = '확인') { return new Promise(r => { const d = modal(`<div class="dlg"><p style="white-space:pre-wrap">${esc(msg)}</p><div class="dlg-foot"><button data-n>취소</button><button class="pri" data-y>${esc(label)}</button></div></div>`); $('[data-n]', d).onclick = () => { r(false); d.close(); }; $('[data-y]', d).onclick = () => { r(true); d.close(); }; d.addEventListener('cancel', () => r(false)); }); }
const deptOpts = () => store.depts().map(d => [d.id, d.name]);

// ----- 라우터 -----
const NAV = [['home', '🏠', '홈'], ['plan', '🗓️', '일정·계획'], ['events', '🎉', '행사'], ['services', '⛪', '예배'], ['people', '👥', '인원·출석'], ['money', '💰', '회계'], ['settings', '⚙️', '설정']];
function render() {
  const [view, id] = (location.hash || '#home').slice(1).split('/'); const base = view === 'event' ? 'events' : view === 'service' ? 'services' : view;
  $('#nav').innerHTML = NAV.map(([k, ico, l]) => `<a data-go="#${k}" class="${base === k ? 'on' : ''}"><span class="ico">${ico}</span>${l}</a>`).join('');
  $('#dept-box').innerHTML = [...store.depts().map(d => [String(d.id), d.name]), ['all', '전체']].map(([v, l]) => `<button data-dept="${v}" class="${UI.dept === v ? 'on' : ''}">${l}</button>`).join('');
  const bar = $('#demo-bar'); const demo = store.get().demo;
  bar.hidden = !demo && !window.__memOnly; bar.innerHTML = window.__memOnly ? '이 브라우저는 저장을 허용하지 않아 입력한 내용이 창을 닫으면 사라집니다.' : '가상 데이터로 체험 중입니다. 설정에서 ‘실제 데이터로 시작’을 누르면 비어 있는 상태로 시작합니다.';
  const V = { home: vHome, plan: vPlan, events: vEvents, event: vEvent, services: vServices, service: vService, people: vPeople, money: vMoney, settings: vSettings }[view] || vHome;
  $('#main').innerHTML = ''; V(id ? Number(id) : null); document.body.classList.remove('nav-open');
  $('#crumb').textContent = (NAV.find(n => n[0] === base) || NAV[0])[2] + (UI.dept === 'all' ? '' : ' · ' + (store.dept(did()) || {}).name);
}
window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });
const page = (ico, title, sub, body) => { $('#main').innerHTML = `<h1 class="title"><span class="ico">${ico}</span>${esc(title)}</h1><p class="sub">${sub}</p>${body}`; };
const barHtml = (spent, budget) => { const p = budget ? Math.min(100, Math.round(spent / budget * 100)) : 0; return `<div class="bar ${budget && spent > budget ? 'over' : p >= 85 ? 'warn' : ''}"><i style="width:${p}%"></i></div>`; };
const yearSel = () => `<select data-year>${[UI.year - 1, UI.year, UI.year + 1].map(y => `<option${y === UI.year ? ' selected' : ''} value="${y}">${y}년</option>`).join('')}</select>`;

// ----- 홈 -----
function vHome() {
  const H = store.home(did()); const t = today();
  const items = H.week.map(i => `<tr class="link" data-open="${i.type}/${i.id}"><td style="width:92px">${md(i.date)}${i.end !== i.date ? '<br><span class="mute small">~ ' + md(i.end) + '</span>' : ''}</td><td>${i.type === 'service' ? '⛪' : '🎉'} ${esc(i.title)} <span class="mute small">${esc(i.time || '')}</span></td><td>${deptTag(i.dept_id)}</td></tr>`).join('');
  const tasks = H.tasks.slice(0, 10).map(k => `<div class="todo"><input type="checkbox" data-task="${k.id}" aria-label="완료"><span class="tt sp">${esc(k.title)}<br><span class="mute small">${esc(k.event.title)} · ${esc(k.assignee || '담당 미정')}</span></span><span class="tag ${k.overdue ? 'bad' : 'warn'}">${k.due ? (k.overdue ? '기한 지남 ' : '') + md(k.due) : '기한 없음'}</span></div>`).join('');
  const budget = H.budget.map(b => `<div class="card" style="margin-bottom:10px"><div class="row"><b>${esc(b.dept.name)}</b><span class="sp"></span><span class="mute small">${UI.year}년 예산 ${won(b.budget)}</span></div><div style="margin:8px 0">${barHtml(b.expense, b.budget)}</div><div class="cols3"><div class="stat"><div class="v">${won(b.expense)}</div><div class="l">지출</div></div><div class="stat"><div class="v">${won(b.budget_remaining)}</div><div class="l">예산 잔액</div></div><div class="stat"><div class="v" style="color:${b.net < 0 ? 'var(--red)' : 'var(--green)'}">${won(b.net)}</div><div class="l">수입·지출 차액</div></div></div></div>`).join('');
  page('🏠', '홈', `${H.today} (${dow(H.today)}) · 이번 주 ${md(H.from)} ~ ${md(H.to)}`, `
  <div class="cols"><div><h2 style="margin-top:0">이번 주 예배·행사</h2>${H.week.length ? `<table class="t"><tbody>${items}</tbody></table>` : '<p class="mute">이번 주 일정이 없습니다.</p>'}</div>
  <div><h2 style="margin-top:0">준비할 일 <span class="tag">${H.tasks.length}</span></h2>${tasks || '<p class="mute">남은 준비 업무가 없습니다. 🎉</p>'}${H.tasks.length > 10 ? `<p class="mute small">외 ${H.tasks.length - 10}건</p>` : ''}</div></div>
  <h2>예산 현황</h2>${budget}`);
  // 진한 남색 히어로(홈 첫 화면 한 곳에만): 제목 대신 이번 주 요약 + 빠른 실행
  const over = H.tasks.filter(k => k.overdue).length; const scope = UI.dept === 'all' ? '아동부·청년부' : (store.dept(did()) || {}).name;
  $('#main .title').outerHTML = `<section class="hero"><div class="eyebrow">🏠 홈 · ${H.today} (${dow(H.today)})</div><h1>이번 주 예배·행사 ${H.week.length}건,<br>준비할 일 ${H.tasks.length}건</h1><p>${esc(scope)} · ${md(H.from)} ~ ${md(H.to)}${over ? ` · 기한이 지난 준비 업무 ${over}건` : ''}</p><div class="row noprint"><button class="pri" data-act="newEvent">+ 행사 추가</button><button class="light" data-go="#services">출석 기록하러 가기</button><button class="light" data-act="newTx">지출 등록</button></div></section>`;
  $('#main .sub').remove();
}

// ----- 일정·계획 -----
function vPlan() {
  const tabs = `<div class="tabs"><a data-ptab="cal" class="${UI.planTab === 'cal' ? 'on' : ''}">월 달력</a><a data-ptab="year" class="${UI.planTab === 'year' ? 'on' : ''}">연간·절기 계획</a></div>`;
  if (UI.planTab === 'cal') {
    const [y, m] = UI.month.split('-').map(Number); const dim = new Date(Date.UTC(y, m, 0)).getUTCDate(); const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
    const items = store.calendar(did(), `${UI.month}-01`, `${UI.month}-${pad(dim)}`); const cells = [];
    for (let i = 0; i < lead; i++) cells.push('<div class="out"></div>');
    for (let d = 1; d <= dim; d++) { const ds = `${UI.month}-${pad(d)}`; cells.push(`<div class="${ds === today() ? 'today' : ''}"><b>${d}</b>${items.filter(i => i.date <= ds && i.end >= ds).map(i => `<a class="d${i.dept_id}" data-open="${i.type}/${i.id}" title="${esc(i.title)}">${i.type === 'service' ? '⛪ ' : ''}${esc(i.title)}</a>`).join('')}</div>`); }
    const prev = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7), next = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);
    page('🗓️', '일정·계획', '예배와 행사를 누르면 상세 화면으로 이동합니다.', `${tabs}<div class="row" style="margin-bottom:10px"><button data-month="${prev}">◀</button><b>${y}년 ${m}월</b><button data-month="${next}">▶</button><button data-month="${today().slice(0, 7)}">오늘</button></div><div class="cal">${['월', '화', '수', '목', '금', '토', '일'].map(w => `<div class="h">${w}</div>`).join('')}${cells.join('')}</div>`);
  } else {
    const d = workDept(); const P = store.plan(d, UI.year); const seasons = store.seasons(d, UI.year);
    const evs = store.get().events.filter(e => e.dept_id === d && e.start_date.startsWith(String(UI.year))).sort((a, b) => a.start_date.localeCompare(b.start_date));
    page('🗓️', '일정·계획', `${deptTag(d)} ${UI.dept === 'all' ? '<span class="mute small">(전체 보기에서는 첫 부서를 표시합니다)</span>' : ''}`, `${tabs}<div class="row"><b>${store.dept(d).name}</b>${yearSel()}</div>
    <h2>사역 목표</h2><textarea id="goal" placeholder="올해 사역 목표">${esc(P.goal)}</textarea>
    <h2>월별 교육 주제</h2><div class="tablewrap"><table class="t"><tbody>${Array.from({ length: 12 }, (_, i) => `<tr><td style="width:60px">${i + 1}월</td><td><input class="cell-in" data-theme="${i + 1}" value="${esc(P.themes[i + 1] || '')}" placeholder="교육 주제"></td></tr>`).join('')}</tbody></table></div>
    <div class="row" style="margin-top:8px"><button class="pri" data-act="savePlan">목표·주제 저장</button></div>
    <h2>절기 계획 <button class="sm" data-act="editSeason">+ 추가</button></h2>
    <table class="t"><thead><tr><th>절기</th><th>기간</th><th>주제·본문</th><th>계획</th><th></th></tr></thead><tbody>${seasons.map(s => `<tr><td><b>${esc(s.name)}</b></td><td>${esc(s.start || '')}${s.end && s.end !== s.start ? ' ~ ' + esc(s.end) : ''}</td><td>${esc(s.theme)}<br><span class="mute small">${esc(s.scripture)}</span></td><td>${esc(s.plan)}</td><td><button class="sm" data-act="editSeason" data-id="${s.id}">수정</button> <button class="sm dng" data-act="delSeason" data-id="${s.id}">삭제</button></td></tr>`).join('') || '<tr><td colspan="5" class="mute">등록된 절기가 없습니다. 날짜는 해마다 직접 수정하세요.</td></tr>'}</tbody></table>
    <h2>올해 행사</h2><table class="t"><tbody>${evs.map(e => `<tr class="link" data-open="event/${e.id}"><td style="width:92px">${md(e.start_date)}</td><td>${esc(e.title)}</td><td class="num">${e.expected_budget ? won(e.expected_budget) : ''}</td></tr>`).join('') || '<tr><td class="mute">행사가 없습니다.</td></tr>'}</tbody></table>`);
  }
}

// ----- 행사 -----
const EVT = ['행사', '여름성경학교', '겨울성경학교', '수련회', '절기행사', '봉사·선교', '기타'];
function eventForm(v = {}) {
  form({ title: v.id ? '행사 수정' : '행사 추가', values: { dept_id: workDept(), type: '행사', ...v }, fields: [{ k: 'dept_id', label: '부서', type: 'select', options: deptOpts() }, { k: 'title', label: '행사명', req: true }, { k: 'type', label: '유형', type: 'select', options: EVT.map(x => [x, x]) }, { k: 'start_date', label: '시작일', type: 'date', req: true }, { k: 'end_date', label: '종료일', type: 'date' }, { k: 'place', label: '장소' }, { k: 'owner', label: '담당자' }, { k: 'target_count', label: '목표 인원(명)', type: 'number' }, { k: 'expected_budget', label: '예상 예산(원)', type: 'number' }, { k: 'note', label: '메모', type: 'textarea' }],
    onSubmit: o => { const id = store.saveEvent({ ...v, ...o, dept_id: Number(o.dept_id) }); if (!v.id) location.hash = `#event/${id}`; } });
}
function vEvents() {
  const list = store.get().events.filter(e => (!did() || e.dept_id === did()) && e.start_date.startsWith(String(UI.year))).sort((a, b) => a.start_date.localeCompare(b.start_date));
  page('🎉', '행사', `${yearSel()} <span class="mute small">행사를 누르면 준비 업무·참가·결산을 볼 수 있습니다.</span>`, `<div class="row noprint" style="margin-bottom:12px"><button class="pri" data-act="newEvent">+ 새 행사</button></div>
  <div class="tablewrap"><table class="t"><thead><tr><th>일정</th><th>행사</th><th>부서</th><th class="num">목표</th><th class="num">신청</th><th class="num">참석</th><th class="num">지출</th><th>상태</th></tr></thead><tbody>${list.map(e => { const s = store.eventSummary(e.id); return `<tr class="link" data-open="event/${e.id}"><td>${esc(range(md(e.start_date), md(e.end_date)))}</td><td><b>${esc(e.title)}</b><br><span class="mute small">${esc(e.type)}</span></td><td>${deptTag(e.dept_id)}</td><td class="num">${e.target_count || '-'}</td><td class="num">${s.registered}</td><td class="num">${s.attended}</td><td class="num">${won(s.expense)}</td><td>${e.status === 'done' ? '<span class="tag ok">완료</span>' : e.status === 'cancelled' ? '<span class="tag bad">취소</span>' : '<span class="tag">예정</span>'}</td></tr>`; }).join('') || '<tr><td colspan="8" class="mute">행사가 없습니다.</td></tr>'}</tbody></table></div>`);
}
function vEvent(id) {
  const e = store.ev(id); if (!e) { page('🎉', '행사', '', '<div class="callout bad">행사를 찾을 수 없습니다.</div>'); return; }
  const s = store.eventSummary(id); const tasks = store.get().tasks.filter(t => t.event_id === id); const parts = store.participants(id).sort((a, b) => (a.person.class_name || '').localeCompare(b.person.class_name || '', 'ko')); const tx = store.transactions({ eventId: id });
  page('🎉', e.title, `${deptTag(e.dept_id)} ${esc(e.type)}`, `<div class="row noprint"><button data-go="#events">◀ 목록</button><button data-act="editEvent" data-id="${id}">수정</button><select data-evstatus="${id}">${[['planned', '예정'], ['done', '완료'], ['cancelled', '취소']].map(([v, l]) => `<option value="${v}"${e.status === v ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
  <dl class="props" style="margin-top:14px"><dt>일정</dt><dd>${esc(range(e.start_date, e.end_date))}</dd><dt>장소</dt><dd>${esc(e.place) || '-'}</dd><dt>담당자</dt><dd>${esc(e.owner) || '-'}</dd><dt>목표 인원</dt><dd>${e.target_count || '-'}명</dd><dt>예상 예산</dt><dd>${won(e.expected_budget)}</dd>${e.note ? `<dt>메모</dt><dd>${esc(e.note)}</dd>` : ''}</dl>
  <h2>준비할 일 <button class="sm" data-act="newTask" data-id="${id}">+ 추가</button></h2>${tasks.map(k => `<div class="todo ${k.status === 'done' ? 'done' : ''}"><input type="checkbox" data-task="${k.id}" ${k.status === 'done' ? 'checked' : ''} aria-label="완료"><span class="tt sp">${esc(k.title)} <span class="mute small">${esc(k.assignee)}</span></span>${k.due ? `<span class="tag ${k.status !== 'done' && k.due < today() ? 'bad' : ''}">${md(k.due)}</span>` : ''}<button class="sm ghost" data-act="delTask" data-id="${k.id}" aria-label="삭제">✕</button></div>`).join('') || '<p class="mute">준비 업무를 추가하세요.</p>'}
  <h2>참가 현황</h2><div class="cols3" style="margin-bottom:12px"><div class="card stat"><div class="v">${s.registered}<span class="mute small"> / 목표 ${e.target_count || '-'}</span></div><div class="l">신청 (취소 제외)</div></div><div class="card stat"><div class="v">${s.attended}</div><div class="l">실제 참석</div></div><div class="card stat"><div class="v">${s.first_time}</div><div class="l">처음 온 사람 · 취소 ${s.cancelled}</div></div></div>
  <div class="row noprint" style="margin-bottom:8px"><button data-act="addPart" data-id="${id}">+ 부서원 등록</button><button data-act="addNew" data-id="${id}">+ 처음 온 사람</button></div>
  <div class="tablewrap"><table class="t"><thead><tr><th>이름</th><th>반</th><th>구분</th><th>상태</th><th></th></tr></thead><tbody>${parts.map(p => `<tr><td>${esc(p.person.name)}${p.person.birth_year ? ` <span class="mute small">${p.person.birth_year}년생</span>` : ''}</td><td>${esc(p.person.class_name)}</td><td>${p.first_time ? '<span class="tag warn">처음</span>' : ''}</td><td><select data-pstat="${id}/${p.person_id}">${Object.entries(PST).map(([v, l]) => `<option value="${v}"${p.status === v ? ' selected' : ''}>${l}</option>`).join('')}</select></td><td><button class="sm ghost" data-act="delPart" data-id="${id}/${p.person_id}">제외</button></td></tr>`).join('') || '<tr><td colspan="5" class="mute">참가자를 등록하세요.</td></tr>'}</tbody></table></div>
  <h2>결산 <button class="sm" data-act="newTx" data-ev="${id}">+ 지출·수입</button></h2><div class="cols3" style="margin-bottom:12px"><div class="card stat"><div class="v">${won(s.expense)}</div><div class="l">지출 (예상 예산 ${won(e.expected_budget)})</div></div><div class="card stat"><div class="v">${won(s.budget_remaining)}</div><div class="l">예산 잔액 (예산−지출)</div></div><div class="card stat"><div class="v" style="color:${s.net < 0 ? 'var(--red)' : 'var(--green)'}">${won(s.net)}</div><div class="l">수입·지출 차액 (수입 ${won(s.income)})</div></div></div>${txTable(tx)}`);
}

// ----- 예배 -----
function serviceForm(v = {}) {
  form({ title: v.id ? '예배 수정' : '예배 추가', values: { dept_id: workDept(), date: today(), kind: 'regular', ...v }, fields: [{ k: 'dept_id', label: '부서', type: 'select', options: deptOpts() }, { k: 'title', label: '예배명', req: true }, { k: 'kind', label: '구분', type: 'select', options: [['regular', '정기예배'], ['special', '특별예배']] }, { k: 'date', label: '날짜', type: 'date', req: true }, { k: 'time', label: '시간', type: 'time' }, { k: 'place', label: '장소' }, { k: 'scripture', label: '성경 본문 (개역개정, 장·절)' }, { k: 'sermon_title', label: '설교 제목' }, { k: 'leader', label: '담당자' }, { k: 'order_text', label: '예배 순서', type: 'textarea' }],
    onSubmit: o => { const id = store.saveService({ ...v, ...o, dept_id: Number(o.dept_id) }); if (!v.id) location.hash = `#service/${id}`; } });
}
function vServices() {
  const list = store.services(did()).filter(s => s.date.startsWith(String(UI.year)));
  page('⛪', '예배', `${yearSel()}`, `<div class="row noprint" style="margin-bottom:12px"><button class="pri" data-act="newService">+ 새 예배</button></div><div class="tablewrap"><table class="t"><thead><tr><th>날짜</th><th>예배</th><th>부서</th><th>설교 제목</th><th class="num">출석</th></tr></thead><tbody>${list.map(s => { const c = store.attendanceCount(s.id); return `<tr class="link" data-open="service/${s.id}"><td>${md(s.date)} <span class="mute small">${esc(s.time)}</span></td><td><b>${esc(s.title)}</b> ${s.kind === 'special' ? '<span class="tag warn">특별</span>' : ''}</td><td>${deptTag(s.dept_id)}</td><td>${esc(s.sermon_title)}</td><td class="num">${c.recorded ? c.present + '명' : '<span class="mute">미기록</span>'}</td></tr>`; }).join('') || '<tr><td colspan="5" class="mute">예배가 없습니다.</td></tr>'}</tbody></table></div>`);
}
const AT = { cls: '' };
function vService(id) {
  const s = store.service(id); if (!s) { page('⛪', '예배', '', '<div class="callout bad">예배를 찾을 수 없습니다.</div>'); return; }
  const people = store.people({ deptId: s.dept_id }); const classes = [...new Set(people.map(p => p.class_name).filter(Boolean))]; const att = new Map(store.get().attendance.filter(a => a.service_id === id).map(a => [a.person_id, a.present]));
  const shown = people.filter(p => !AT.cls || p.class_name === AT.cls); const c = store.attendanceCount(id);
  page('⛪', s.title, `${deptTag(s.dept_id)} ${md(s.date)} ${esc(s.time)} ${esc(s.place)}`, `<div class="row noprint"><button data-go="#services">◀ 목록</button><button data-act="editService" data-id="${id}">수정</button><button data-act="cloneService" data-id="${id}">다음 예배로 복제</button><button data-act="print">인쇄</button></div>
  <dl class="props" style="margin-top:14px"><dt>성경 본문</dt><dd>${esc(s.scripture) || '-'}</dd><dt>설교 제목</dt><dd>${esc(s.sermon_title) || '-'}</dd><dt>담당</dt><dd>${esc(s.leader) || '-'}</dd><dt>순서</dt><dd style="white-space:pre-wrap">${esc(s.order_text) || '-'}</dd></dl>
  <h2>출석 체크 <span class="tag ok">출석 ${c.present}명</span> <span class="tag">기록 ${c.recorded}명</span></h2><p class="mute small noprint">이름을 누르면 바로 저장됩니다. 같은 회차에서 한 사람은 한 번만 집계되고, 복제한 예배의 출석은 비어 있습니다.</p>
  <div class="row noprint" style="margin-bottom:10px"><button data-cls="" class="${!AT.cls ? 'pri' : ''}">전체</button>${classes.map(x => `<button data-cls="${esc(x)}" class="${AT.cls === x ? 'pri' : ''}">${esc(x)}</button>`).join('')}<span class="sp"></span><button data-act="allPresent" data-id="${id}">보이는 인원 전원 출석</button><button data-act="newPersonHere" data-id="${id}">+ 새 사람</button></div>
  <div class="roster">${shown.map(p => `<label class="${att.get(p.id) ? 'on' : ''}"><input type="checkbox" data-att="${id}/${p.id}" ${att.get(p.id) ? 'checked' : ''}><span>${esc(p.display)} <span class="mute small">${esc(p.class_name)}</span></span></label>`).join('') || '<p class="mute">명단이 없습니다. 인원·출석에서 등록하세요.</p>'}</div>`);
}

// ----- 인원·출석 -----
function vPeople() {
  const tabs = `<div class="tabs"><a data-pptab="att" class="${UI.peopleTab === 'att' ? 'on' : ''}">출석부</a><a data-pptab="roster" class="${UI.peopleTab === 'roster' ? 'on' : ''}">명단</a></div>`;
  if (UI.peopleTab === 'att') {
    const d = workDept(); const M = store.attendanceMatrix(d, { last: 8 });
    page('👥', '인원·출석', `${deptTag(d)} 최근 정기예배 ${M.services.length}회 · ○ 출석 · × 결석 · 빈칸 미기록 ${UI.dept === 'all' ? '<span class="mute small">(전체 보기에서는 첫 부서)</span>' : ''}`, `${tabs}<div class="row noprint" style="margin-bottom:10px"><button data-act="print">인쇄</button></div><div class="tablewrap"><table class="t att"><thead><tr><th>이름 (반)</th>${M.services.map(s => `<th title="${esc(s.title)}"><a data-open="service/${s.id}" style="cursor:pointer">${Number(s.date.slice(5, 7))}/${Number(s.date.slice(8))}</a></th>`).join('')}<th>출석</th><th>출석률</th></tr></thead><tbody>${M.rows.map(r => `<tr class="${r.former ? 'former' : ''}"><td>${esc(r.person.name)}${r.person.birth_year && M.rows.filter(x => x.person.name === r.person.name).length > 1 ? ` <span class="mute small">${r.person.birth_year}년생</span>` : ''} <span class="mute small">${esc(r.person.class_name)}${r.former ? ' · 이전 부서원' : ''}</span></td>${r.cells.map(c => `<td class="${c === 1 ? 'p' : c === 0 ? 'a' : 'n'}">${c === 1 ? '○' : c === 0 ? '×' : '·'}</td>`).join('')}<td>${r.present}</td><td class="rate ${r.rate !== null && r.rate < 50 ? 'lo' : ''}">${r.rate === null ? '-' : r.rate + '%'}</td></tr>`).join('') || `<tr><td colspan="${M.services.length + 3}" class="mute">정기예배 기록이 없습니다.</td></tr>`}</tbody><tfoot><tr><td>합계(출석 인원)</td>${M.totals.map(n => `<td class="c">${n}</td>`).join('')}<td colspan="2"></td></tr></tfoot></table></div><p class="mute small">출석률이 50% 미만이면 빨간색으로 표시됩니다. 보호자 연락처·알레르기 같은 민감 정보는 이 앱이 수집하지 않습니다.</p>`);
  } else {
    const st = UI.pstatus || 'active'; const list = store.people({ deptId: did(), status: st });
    page('👥', '인원·출석', `${list.length}명`, `${tabs}<div class="row noprint" style="margin-bottom:10px"><button class="pri" data-act="newPerson">+ 인원 등록</button><select data-pstatus><option value="active"${st === 'active' ? ' selected' : ''}>현재 명단</option><option value="graduated"${st === 'graduated' ? ' selected' : ''}>졸업·이동</option><option value="inactive"${st === 'inactive' ? ' selected' : ''}>비활성</option><option value="all"${st === 'all' ? ' selected' : ''}>전체</option></select></div><div class="tablewrap"><table class="t"><thead><tr><th>이름</th><th>구분</th><th>부서</th><th>반·조</th><th>상태</th><th></th></tr></thead><tbody>${list.map(p => `<tr><td><b>${esc(p.display)}</b></td><td>${KIND[p.kind]}</td><td>${deptTag(p.dept_id)}</td><td>${esc(p.class_name)}</td><td>${p.status === 'active' ? '' : '<span class="tag">' + (p.status === 'graduated' ? '졸업·이동' : '비활성') + '</span>'}</td><td><button class="sm" data-act="movePerson" data-id="${p.id}">이동</button> ${p.status === 'active' ? `<button class="sm" data-act="retire" data-id="${p.id}">명단 제외</button>` : `<button class="sm" data-act="reactivate" data-id="${p.id}">복귀</button>`}</td></tr>`).join('') || '<tr><td colspan="6" class="mute">명단이 없습니다.</td></tr>'}</tbody></table></div><p class="mute small">‘명단 제외’는 현재 명단에서만 빼며 과거 출석·행사 기록은 그대로 남습니다.</p>`);
  }
}

// ----- 회계 -----
function txTable(rows) {
  const inc = rows.filter(t => t.kind === 'income').reduce((a, t) => a + t.amount, 0), exp = rows.filter(t => t.kind === 'expense').reduce((a, t) => a + t.amount, 0);
  return `<div class="tablewrap"><table class="t"><thead><tr><th>날짜</th><th>구분</th><th>항목</th><th>적요</th><th>행사</th><th class="num">금액</th><th></th></tr></thead><tbody>${rows.map(t => `<tr><td>${md(t.date)}</td><td><span class="tag ${t.kind === 'income' ? 'in' : 'out'}">${t.kind === 'income' ? '수입' : '지출'}</span></td><td>${esc(t.category)}</td><td>${esc(t.memo)}</td><td class="mute small">${esc((store.ev(t.event_id) || {}).title || '')}</td><td class="num" style="color:${t.kind === 'income' ? 'var(--green)' : 'var(--ink)'}">${t.kind === 'income' ? '+' : '−'}${won(t.amount)}</td><td><button class="sm ghost dng" data-act="voidTx" data-id="${t.id}">취소</button></td></tr>`).join('') || '<tr><td colspan="7" class="mute">거래가 없습니다.</td></tr>'}</tbody><tfoot><tr><td colspan="5">합계 (수입 ${won(inc)} · 지출 ${won(exp)})</td><td class="num">${inc - exp < 0 ? '−' : '+'}${won(Math.abs(inc - exp))}</td><td></td></tr></tfoot></table></div>`;
}
function vMoney() {
  const ids = did() ? [did()] : store.depts().map(d => d.id); const sums = ids.map(i => ({ d: store.dept(i), s: store.deptSummary(i, UI.year) }));
  const tot = sums.reduce((a, { s }) => ({ b: a.b + s.budget, i: a.i + s.income, e: a.e + s.expense }), { b: 0, i: 0, e: 0 });
  const wd = workDept(); const mo = store.monthly(wd, UI.year); const month = UI.mmonth || '';
  page('💰', '회계', `${yearSel()} <span class="mute small">행사 지출은 부서 합계에 한 번만 포함됩니다.</span>`, `<div class="cols3" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr))"><div class="card stat"><div class="v">${won(tot.b)}</div><div class="l">예산</div></div><div class="card stat"><div class="v">${won(tot.i)}</div><div class="l">수입</div></div><div class="card stat"><div class="v">${won(tot.e)}</div><div class="l">지출</div></div><div class="card stat"><div class="v">${won(tot.b - tot.e)}</div><div class="l">예산 잔액 (예산−지출)</div></div><div class="card stat"><div class="v" style="color:${tot.i - tot.e < 0 ? 'var(--red)' : 'var(--green)'}">${won(tot.i - tot.e)}</div><div class="l">수입·지출 차액 (수입−지출)</div></div></div>
  <h2>예산 대비 집행 <button class="sm noprint" data-act="editBudget">+ 예산 항목</button></h2>${sums.map(({ d, s }) => `<h3 style="margin-top:14px">${deptTag(d.id)} <span class="mute small">행사 지출 ${won(s.event_expense)} · 행사 외 ${won(s.non_event_expense)}</span></h3><div class="tablewrap"><table class="t"><thead><tr><th>항목</th><th class="num">예산</th><th class="num">지출</th><th class="num">예산 잔액</th><th style="width:22%">집행률</th></tr></thead><tbody>${s.byCategory.map(c => `<tr><td>${esc(c.category)}</td><td class="num">${won(c.budget)}</td><td class="num">${won(c.spent)}</td><td class="num" style="color:${c.remaining < 0 ? 'var(--red)' : 'inherit'}">${won(c.remaining)}</td><td>${barHtml(c.spent, c.budget)}</td></tr>`).join('') || '<tr><td colspan="5" class="mute">예산 항목이 없습니다.</td></tr>'}</tbody><tfoot><tr><td>합계</td><td class="num">${won(s.budget)}</td><td class="num">${won(s.expense)}</td><td class="num">${won(s.budget_remaining)}</td><td>${barHtml(s.expense, s.budget)}</td></tr></tfoot></table></div>`).join('')}
  <h2>월별 수입·지출 <span class="mute small">${esc(store.dept(wd).name)}</span></h2><div class="tablewrap"><table class="t"><thead><tr><th>월</th><th class="num">수입</th><th class="num">지출</th><th class="num">차액</th></tr></thead><tbody>${mo.map(m => `<tr><td>${m.month}월</td><td class="num">${m.income ? won(m.income) : '-'}</td><td class="num">${m.expense ? won(m.expense) : '-'}</td><td class="num" style="color:${m.net < 0 ? 'var(--red)' : 'inherit'}">${m.income || m.expense ? won(m.net) : '-'}</td></tr>`).join('')}</tbody><tfoot><tr><td>합계</td><td class="num">${won(mo.reduce((a, m) => a + m.income, 0))}</td><td class="num">${won(mo.reduce((a, m) => a + m.expense, 0))}</td><td class="num">${won(mo.reduce((a, m) => a + m.net, 0))}</td></tr></tfoot></table></div>
  <h2>거래 내역 <button class="sm noprint pri" data-act="newTx">+ 지출·수입 등록</button> <select class="noprint" data-mmonth><option value="">전체 월</option>${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}"${String(month) === String(i + 1) ? ' selected' : ''}>${i + 1}월</option>`).join('')}</select></h2>${txTable(store.transactions({ deptId: did(), year: UI.year, month: month || undefined }))}`);
}
function txForm(v = {}) {
  const wd = Number(v.dept_id || workDept()); const evs = store.get().events.filter(e => e.dept_id === wd);
  form({ title: '지출·수입 등록', values: { kind: 'expense', date: today(), dept_id: wd, event_id: '', ...v }, fields: [{ k: 'kind', label: '구분', type: 'select', options: [['expense', '지출'], ['income', '수입']] }, { k: 'dept_id', label: '부서', type: 'select', options: deptOpts() }, { k: 'date', label: '날짜', type: 'date', req: true }, { k: 'amount', label: '금액 (원, 정수)', type: 'number', req: true }, { k: 'category', label: '항목' }, { k: 'event_id', label: '연결 행사 (선택)', type: 'select', options: [['', '(행사와 무관한 부서 지출)'], ...evs.map(e => [e.id, `${e.start_date} ${e.title}`])] }, { k: 'memo', label: '적요' }],
    onSubmit: o => { store.addTransaction({ ...o, dept_id: Number(o.dept_id), amount: o.amount === '' ? NaN : Number(o.amount) }); toast('저장했습니다.'); } });
}

// ----- 설정 -----
function vSettings() {
  const S = store.get();
  page('⚙️', '설정', '데이터 관리와 배포 정보', `
  <h2 style="margin-top:0">데이터</h2><div class="callout ${S.demo ? 'warn' : ''}"><span>${S.demo ? '🧪' : '📒'}</span><div>현재 <b>${S.demo ? '가상 데이터' : '실제 데이터'}</b>를 사용 중입니다. 데이터는 <b>이 브라우저(이 기기)</b>에만 저장되며 서버로 전송되지 않습니다. 다른 기기와 자동으로 공유되지 않으므로 아래 ‘내보내기’로 백업하세요.</div></div>
  <div class="row" style="margin:12px 0"><button data-act="resetDemo">가상 데이터로 초기화</button><button class="pri" data-act="startEmpty">실제 데이터로 시작 (비움)</button></div>
  <h2>백업·복원 (JSON 파일)</h2><div class="row"><button data-act="export">내보내기(.json 다운로드)</button><button data-act="import">파일에서 가져오기</button><input type="file" id="file" accept="application/json,.json" hidden></div>
  <p class="mute small">내보낸 파일에는 이름 등 개인정보가 들어 있을 수 있으니 안전한 곳에만 보관하세요. 가져오면 현재 데이터가 파일 내용으로 바뀝니다(바꾸기 전에 확인합니다).</p>
  <h2>개인정보 안내</h2><ul class="small"><li>이 앱은 보호자 연락처·알레르기·계좌·주민번호를 입력받지 않습니다.</li><li>사이트 주소를 아는 사람은 누구나 앱을 열 수 있지만, 입력한 데이터는 각자의 브라우저에만 있어 서로 보이지 않습니다.</li><li>공용 PC에서는 사용 후 ‘실제 데이터로 시작’이 아닌 브라우저 데이터 삭제로 정리하세요.</li></ul>
  <h2>정보</h2><dl class="props"><dt>버전</dt><dd>0.1.0</dd><dt>저장 방식</dt><dd>localStorage (${window.__memOnly ? '사용 불가 → 임시 메모리' : '사용 중'})</dd><dt>통화·시간대</dt><dd>원화(정수) · Asia/Seoul</dd></dl>`);
}

// ----- 이벤트 -----
const ACT = {
  newEvent: () => eventForm(), editEvent: d => eventForm(store.ev(Number(d.id))), newService: () => serviceForm(), editService: d => serviceForm(store.service(Number(d.id))), newTx: d => txForm(d.ev ? { event_id: d.ev, dept_id: store.ev(Number(d.ev)).dept_id } : {}),
  voidTx: async d => { if (await ask('이 거래를 취소할까요? 집계에서 제외됩니다.', '거래 취소')) { store.voidTransaction(Number(d.id)); render(); toast('취소했습니다.'); } },
  newTask: d => form({ title: '준비 업무', fields: [{ k: 'title', label: '업무', req: true }, { k: 'due', label: '마감일', type: 'date' }, { k: 'assignee', label: '담당자' }], onSubmit: o => store.addTask(Number(d.id), o.title, o.due || null, o.assignee) }),
  delTask: d => { store.deleteTask(Number(d.id)); render(); },
  addPart: d => { const have = new Set(store.participants(Number(d.id)).map(p => p.person_id)); const ppl = store.people({}).filter(p => !have.has(p.id)); form({ title: '부서원 등록', fields: [{ k: 'pid', label: '사람', type: 'select', options: ppl.map(p => [p.id, `${p.display} (${store.dept(p.dept_id)?.name || '-'} ${p.class_name})`]) }, { k: 'st', label: '상태', type: 'select', options: Object.entries(PST) }], onSubmit: o => store.setParticipant(Number(d.id), Number(o.pid), o.st) }); },
  addNew: d => form({ title: '처음 온 사람 등록', intro: '<p class="mute small">인원 명단에도 함께 등록됩니다.</p>', fields: [{ k: 'name', label: '이름', req: true }, { k: 'kind', label: '구분', type: 'select', options: Object.entries(KIND) }, { k: 'cls', label: '반' }], onSubmit: o => store.addNewcomer(Number(d.id), o.name, o.kind, o.cls) }),
  delPart: async d => { const [e, p] = d.id.split('/').map(Number); if (await ask('참가 명단에서 제외할까요? (인원 명단은 그대로입니다)')) { store.removeParticipant(e, p); render(); } },
  cloneService: d => form({ title: '예배 복제', intro: '<p class="mute small">순서·담당 정보만 복제합니다. 출석은 새 회차에서 따로 기록합니다.</p>', fields: [{ k: 'date', label: '새 날짜', type: 'date', req: true }], onSubmit: o => { const id = store.cloneService(Number(d.id), o.date); location.hash = `#service/${id}`; } }),
  allPresent: d => { const id = Number(d.id); const s = store.service(id); store.people({ deptId: s.dept_id }).filter(p => !AT.cls || p.class_name === AT.cls).forEach(p => store.setAttendance(id, p.id, true)); render(); },
  newPersonHere: d => { const s = store.service(Number(d.id)); form({ title: '새 사람 추가', fields: [{ k: 'name', label: '이름', req: true }, { k: 'kind', label: '구분', type: 'select', options: Object.entries(KIND) }, { k: 'cls', label: '반' }, { k: 'by', label: '출생년도(동명이인 구분)', type: 'number' }], onSubmit: o => { const pid = store.addPerson({ name: o.name, kind: o.kind, dept_id: s.dept_id, class_name: o.cls, birth_year: o.by }); store.setAttendance(s.id, pid, true); } }); },
  newPerson: () => form({ title: '인원 등록', fields: [{ k: 'name', label: '이름', req: true }, { k: 'kind', label: '구분', type: 'select', options: Object.entries(KIND) }, { k: 'dept_id', label: '부서', type: 'select', options: deptOpts(), def: workDept() }, { k: 'cls', label: '반·조' }, { k: 'by', label: '출생년도', type: 'number' }], values: { dept_id: workDept() }, onSubmit: o => store.addPerson({ name: o.name, kind: o.kind, dept_id: Number(o.dept_id), class_name: o.cls, birth_year: o.by }) }),
  movePerson: d => { const p = store.person(Number(d.id)); form({ title: `${p.name} 이동`, intro: '<p class="mute small">이동 후에도 과거 출석 기록은 남습니다.</p>', values: { dept_id: p.dept_id, cls: p.class_name }, fields: [{ k: 'dept_id', label: '새 부서', type: 'select', options: deptOpts() }, { k: 'cls', label: '새 반·조' }], onSubmit: o => store.movePerson(p.id, Number(o.dept_id), o.cls) }); },
  retire: async d => { if (await ask('현재 명단에서 제외합니다. 과거 출석·참가 기록은 그대로 남습니다.', '명단 제외')) { store.setPersonStatus(Number(d.id), 'graduated'); render(); } },
  reactivate: d => { store.setPersonStatus(Number(d.id), 'active'); render(); },
  savePlan: () => { const d = workDept(); const th = {}; $$('[data-theme]').forEach(i => { if (i.value.trim()) th[i.dataset.theme] = i.value.trim(); }); store.savePlan(d, UI.year, $('#goal').value, th); toast('저장했습니다.'); },
  editSeason: d => { const s = d.id ? store.get().seasons.find(x => x.id === Number(d.id)) : { dept_id: workDept(), year: UI.year }; form({ title: '절기 계획', values: s, fields: [{ k: 'name', label: '절기명', req: true }, { k: 'start', label: '시작일', type: 'date' }, { k: 'end', label: '종료일', type: 'date' }, { k: 'theme', label: '주제' }, { k: 'scripture', label: '성경 본문 (개역개정 · 인용 전 확인)' }, { k: 'plan', label: '예배·교육·행사 계획', type: 'textarea' }], onSubmit: o => store.saveSeason({ ...s, ...o, start: o.start || null, end: o.end || null }) }); },
  delSeason: async d => { if (await ask('이 절기 계획을 삭제할까요?', '삭제')) { store.deleteSeason(Number(d.id)); render(); } },
  editBudget: () => form({ title: '예산 항목', intro: `<p class="mute small">${UI.year}년 · ${esc(store.dept(workDept()).name)} · 같은 항목명이면 금액이 수정됩니다.</p>`, fields: [{ k: 'category', label: '항목', req: true }, { k: 'amount', label: '예산액 (원)', type: 'number', req: true }], onSubmit: o => store.saveBudget(workDept(), UI.year, o.category.trim(), Number(o.amount)) }),
  resetDemo: async () => { if (await ask('가상 데이터로 되돌립니다. 지금 입력한 내용은 사라집니다.', '초기화')) { store.resetDemo(); render(); toast('가상 데이터로 초기화했습니다.'); } },
  startEmpty: async () => { if (await ask('비어 있는 실제 데이터로 시작합니다. 현재(가상) 데이터는 사라집니다. 먼저 ‘내보내기’로 백업할 수 있습니다.', '비우고 시작')) { store.startEmpty(); location.hash = '#home'; render(); toast('실제 데이터로 시작합니다.'); } },
  export: () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([store.exportJson()], { type: 'application/json' })); a.download = `목회비서_백업_${today()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); },
  import: () => $('#file').click(),
  print: () => window.print(),
};
document.addEventListener('click', e => {
  const t = e.target; let el;
  if ((el = t.closest('[data-act]')) && ACT[el.dataset.act]) { e.preventDefault(); Promise.resolve(ACT[el.dataset.act](el.dataset)).catch(err => toast(err.message, true)); return; }
  if ((el = t.closest('[data-open]'))) { const [ty, id] = el.dataset.open.split('/'); location.hash = `#${ty}/${id}`; return; }
  if ((el = t.closest('[data-go]'))) { location.hash = el.dataset.go; render(); return; }
  if ((el = t.closest('[data-dept]'))) { UI.dept = el.dataset.dept; try { localStorage.setItem('ms:dept', UI.dept); } catch { /* 무시 */ } render(); return; }
  if ((el = t.closest('[data-ptab]'))) { UI.planTab = el.dataset.ptab; render(); return; }
  if ((el = t.closest('[data-pptab]'))) { UI.peopleTab = el.dataset.pptab; render(); return; }
  if ((el = t.closest('[data-month]'))) { UI.month = el.dataset.month; render(); return; }
  if ((el = t.closest('[data-cls]'))) { AT.cls = el.dataset.cls; render(); return; }
  if (t.closest('#menu-btn') || t.closest('#scrim')) document.body.classList.toggle('nav-open');
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.matches('[data-year]')) { UI.year = Number(t.value); render(); }
  else if (t.matches('[data-task]')) { guard(() => store.setTaskStatus(Number(t.dataset.task), t.checked ? 'done' : 'todo')); render(); }
  else if (t.matches('[data-evstatus]')) { const ev = store.ev(Number(t.dataset.evstatus)); guard(() => store.saveEvent({ ...ev, status: t.value }), '저장했습니다.'); render(); }
  else if (t.matches('[data-pstat]')) { const [a, b] = t.dataset.pstat.split('/').map(Number); guard(() => store.setParticipant(a, b, t.value)); render(); }
  else if (t.matches('[data-att]')) { const [a, b] = t.dataset.att.split('/').map(Number); guard(() => store.setAttendance(a, b, t.checked)); t.closest('label').classList.toggle('on', t.checked); const c = store.attendanceCount(a); const h = $('#main h2 .tag.ok'); if (h) { h.textContent = `출석 ${c.present}명`; h.nextElementSibling.textContent = `기록 ${c.recorded}명`; } }
  else if (t.matches('[data-pstatus]')) { UI.pstatus = t.value; render(); }
  else if (t.matches('[data-mmonth]')) { UI.mmonth = t.value; render(); }
  else if (t.id === 'file') { const f = t.files[0]; if (!f) return; f.text().then(async txt => { if (await ask('현재 데이터를 이 파일의 내용으로 바꿉니다. 계속할까요?', '가져오기')) { guard(() => { store.importJson(txt); render(); }, '가져왔습니다.'); } t.value = ''; }); }
});
render();
