import { createStore, kstToday } from './store.js';
import { EVENT_TEMPLATES, SERVICE_TEMPLATES, BUDGET_SUGGESTIONS, GUIDE_STEPS, TIPS, GLOSSARY, FAQ, churchInfo, churchLabel, churchYear, REPEAT_RULES, SCHEDULE_TYPES, VISIT_TYPES, ASSET_CATEGORIES, ASSET_STATUS, eventNotice, serviceNotice, weekNotice } from './templates.js';
import { toCsv, parseTable, decodeText } from './csv.js';
const lsGet = k => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* 저장소 사용 불가 */ } };

import { initAuth, accountApi, openLoginPreview, receiptApi, imageApi } from './auth.js';
import { makeReceiptStore, compressImage } from './receipts.js';
import { parsePlanLines, guessScheduleType } from './planparse.js';
import { RESOURCES, RESOURCE_CATEGORIES, RESOURCES_CHECKED } from './resources.js';
import { parsePeopleLines, parseBudgetLines, parseTxLines, parseAssetLines, parseThemeLines, parseServiceLines } from './pdfparsers.js';
import { imgSrc, emptyImgFor, bannerFor } from './images.js';
import { GUIDES, GUIDE_CHECKED, guideKeyFor, guideTasks } from './guides.js';
import { VERSION, CHANGELOG, DESKTOP } from './version.js';
import { DEPT_KINDS, NEWCOMER_STEPS, AWAY_REASONS, AWAY_EVERY, EXAM_TYPE, MAX_CHECKS } from './ministry.js';
import { CURRICULUM_PRESETS, PICK_PRESETS, LESSON_FIELDS, parseLessonText, lessonLabel } from './curriculum.js';
import { enhanceDates, ganttChart, lineChart, escapeHtml } from './ui.js';
import { isStandalone, canPromptInstall, promptInstall, fetchLatestVersion, watchUpdates, desktopVersion, cmpSemver } from './install.js';
import { kstNow, startReminders, snoozeTodo, notifyPermission, askNotifyPermission, desktopNotify } from './reminders.js';
// 오래 켜 둔 창이 옛 버전에 머물지 않게, 새 버전이 올라오면 알려 준다.
function showUpdateBar(v) { if (document.getElementById('update-bar')) return; const b = document.createElement('div'); b.id = 'update-bar'; b.className = 'update-bar noprint'; b.setAttribute('role', 'status'); b.innerHTML = `새 버전 <b>${esc(v)}</b>이 나왔어요. <button class="sm pri" id="update-go">새로 고침</button> <button class="sm ghost" id="update-x" aria-label="닫기">✕</button>`; document.body.appendChild(b); b.querySelector('#update-go').onclick = () => location.reload(); b.querySelector('#update-x').onclick = () => b.remove(); }
const A = await initAuth(); { const lg = document.getElementById('logo'); if (lg && imgSrc('logo')) lg.src = imgSrc('logo'); } // 로그인 서버가 있으면 로그인 후 '내' 데이터를 불러오고, 없으면 이 브라우저(localStorage)에 저장
let store;
try { store = createStore(A.storage); }
catch { // 저장소를 쓸 수 없는 환경(사생활 보호 모드 등): 이번 방문 동안만 메모리에 보관
  const m = new Map(); store = createStore({ getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v) }); window.__memOnly = true;
}
const RCP = makeReceiptStore({ account: A.mode === 'account', api: receiptApi }); // 영수증 사진 저장소(로그인: 서버 / 아니면 이 브라우저)
const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const won = n => (Number(n) || 0).toLocaleString('ko-KR') + '원';
const pad = n => String(n).padStart(2, '0');
const today = () => kstToday();
const KIND = { child: '아동', teen: '청소년', youth: '청년', teacher: '교사', volunteer: '봉사자' };
const DK_CLASS = { kid: 'kid', teen: 'teen', youth: 'yth' }; const dk = id => store.deptKind(id); const allScope = () => store.depts().map(d => d.name).join('·');
const PST = { applied: '신청', attended: '참석', cancelled: '취소' };
const TST = { todo: '대기', doing: '진행', done: '완료' };
const UI = { dept: 'all', year: Number(today().slice(0, 4)), month: today().slice(0, 7), planTab: 'cal', peopleTab: 'att', calSvc: false, resCat: '', psel: new Set(), asset: { place: '', status: '' }, rep: { month: today().slice(0, 7), rc: false } };
try { UI.dept = localStorage.getItem('ms:dept') || 'all'; } catch { /* 저장소 사용 불가 */ }
const did = () => (UI.dept === 'all' ? null : Number(UI.dept));
const workDept = () => did() || store.depts()[0].id;
const deptTag = id => { const d = store.dept(id); return d ? `<span class="tag ${DK_CLASS[dk(id)] || ''}">${esc(d.name)}</span>` : ''; };
const typeIco = i => (i.type === 'service' ? '⛪' : i.type === 'schedule' ? (i.kind === '교사 기도회' ? '🙏' : '📋') : '🎉');
const range = (a, b) => (a === b ? a : `${a} ~ ${b}`);
const dow = d => ['일', '월', '화', '수', '목', '금', '토'][new Date(d + 'T00:00:00Z').getUTCDay()];
const md = d => `${Number(d.slice(5, 7))}/${Number(d.slice(8))}(${dow(d)})`;

function toast(msg, bad) { const t = $('#toast'); t.textContent = msg; t.className = 'show' + (bad ? ' bad' : ''); clearTimeout(toast.t); toast.t = setTimeout(() => (t.className = ''), bad ? 4500 : 2200); }
function guard(fn, ok) { try { const r = fn(); if (ok) toast(ok); return r; } catch (e) { toast(e.message, true); return undefined; } }

// ----- 대화상자 -----
function modal(html) { const d = document.createElement('dialog'); d.innerHTML = html; document.body.appendChild(d); d.addEventListener('close', () => d.remove()); const close = d.close.bind(d); d.close = (...a) => { close(...a); d.remove(); }; d.showModal(); return d; } // 닫으면 화면에서 바로 지운다(닫힌 대화상자가 쌓이지 않게)
function fld(f, v) {
  const val = v ?? f.def ?? ''; const req = f.req ? ' required' : '';
  const hint = f.hint ? `<span class="hint">${esc(f.hint)}</span>` : '';
  if (f.type === 'select') return `<label class="f">${esc(f.label)}<select name="${f.k}"${req}>${f.options.map(([a, b]) => `<option value="${esc(a)}"${String(a) === String(val) ? ' selected' : ''}>${esc(b)}</option>`).join('')}</select>${hint}</label>`;
  if (f.type === 'textarea') return `<label class="f">${esc(f.label)}<textarea name="${f.k}" placeholder="${esc(f.ph || '')}">${esc(val)}</textarea>${hint}</label>`;
  if (f.type === 'file') return `<label class="f">${esc(f.label)}<input name="${f.k}" type="file" accept="${esc(f.accept || '')}"${f.capture ? ' capture="environment"' : ''}>${hint}</label>`;
  const dl = f.list ? `<datalist id="dl-${f.k}">${f.list.map(x => `<option value="${esc(x)}">`).join('')}</datalist>` : '';
  return `<label class="f">${esc(f.label)}${f.req ? ' *' : ''}<input name="${f.k}" type="${f.type || 'text'}" value="${esc(val)}" placeholder="${esc(f.ph || '')}"${f.list ? ` list="dl-${f.k}"` : ''}${req}${f.type === 'number' ? ' min="0" step="1" inputmode="numeric"' : ''}>${dl}${hint}</label>`;
}
function form({ title, fields, values = {}, onSubmit, submit = '저장', intro = '', onOpen }) {
  const d = modal(`<form method="dialog"><h3>${esc(title)}</h3>${intro}${fields.map(f => fld(f, values[f.k])).join('')}<div class="err"></div><div class="dlg-foot"><button type="button" data-x>취소</button><button class="pri">${esc(submit)}</button></div></form>`);
  $('[data-x]', d).onclick = () => d.close();
  $('form', d).onsubmit = async e => { e.preventDefault(); const o = {}; for (const f of fields) { const el = d.querySelector(`[name="${f.k}"]`); o[f.k] = f.type === 'file' ? ((el.files && el.files[0]) || null) : el.value; } const btn = $('.pri', d); btn.disabled = true; try { await onSubmit(o); d.close(); render(); } catch (err) { btn.disabled = false; $('.err', d).textContent = err.message; } };
  if (onOpen) onOpen(d);
  enhanceDates(d);
  return d;
}
function ask(msg, label = '확인') { return new Promise(r => { const d = modal(`<div class="dlg"><p style="white-space:pre-wrap">${esc(msg)}</p><div class="dlg-foot"><button data-n>취소</button><button class="pri" data-y>${esc(label)}</button></div></div>`); $('[data-n]', d).onclick = () => { r(false); d.close(); }; $('[data-y]', d).onclick = () => { r(true); d.close(); }; d.addEventListener('cancel', () => r(false)); }); }
const deptOpts = () => store.depts().map(d => [d.id, d.name]);

// ----- 계정·저장 상태 표시 -----
const AUTH_BUSY = () => A.mode === 'account' && A.status === 'saving';
const SAVE_TXT = { saved: ['● 저장됨', 'ok'], saving: ['◌ 저장 중…', ''], failed: ['▲ 저장 안 됨', 'bad'] };
function paintAcct() {
  const el = $('#acct'); if (!el) return;
  if (A.mode !== 'account') { el.innerHTML = `<div class="acct-l mute small">이 브라우저에만 저장됨${A.reason === 'not-configured' ? '<br>로그인 서버 설정 전' : ''}</div>`; return; }
  const [t, c] = SAVE_TXT[A.status] || SAVE_TXT.saved;
  el.innerHTML = `<div class="acct-box"><div class="acct-u" title="${esc(A.user.email)}">👤 ${esc(A.user.name || A.user.email)}</div><div class="row" style="margin-top:6px"><span class="tag ${c}" id="save-chip" title="${esc(A.message)}">${t}</span><span class="sp"></span><button class="sm" data-act="logout">로그아웃</button></div></div>`;
}
A.onStatus = (s, m) => { paintAcct(); if (s === 'failed' && m) toast(m, true); };
A.onConflict = serverVersion => {
  const d = modal(`<div class="dlg"><h3>다른 기기에서 먼저 저장했어요</h3><p>같은 계정으로 다른 기기(또는 다른 창)에서 데이터를 바꿨습니다. 어느 쪽을 쓸지 고르세요.</p><p class="mute small">‘서버 데이터 불러오기’는 이 화면에서 한 변경을 버립니다. ‘내 변경으로 덮어쓰기’는 다른 기기에서 한 변경을 덮어씁니다.</p><div class="dlg-foot"><button data-a>서버 데이터 불러오기</button><button class="pri" data-b>내 변경으로 덮어쓰기</button></div></div>`);
  d.addEventListener('cancel', e => e.preventDefault());
  $('[data-a]', d).onclick = () => location.reload();
  $('[data-b]', d).onclick = async () => { d.close(); await A.forceSave(serverVersion); toast('내 변경으로 저장했어요.'); };
};

// 공용 PC 대비: 로그인 모드에서 30분 동안 아무 조작이 없으면 자동 로그아웃(저장 중이거나 저장 실패 상태면 보류)
if (A.mode === 'account') {
  let last = Date.now(); const touch = () => { last = Date.now(); };
  ['click', 'keydown', 'pointerdown', 'touchstart', 'scroll'].forEach(ev => window.addEventListener(ev, touch, { passive: true }));
  setInterval(async () => { if (Date.now() - last < 30 * 60e3 || A.status !== 'saved') return; await accountApi.logout().catch(() => {}); location.reload(); }, 30e3);
}

// ----- 도움 장치: 화면별 사용법, 빈 화면 안내, 도움말 창, 파일 내려받기 -----
function tipHtml() {
  const key = (location.hash || '#home').slice(1).split('/')[0]; let t = TIPS[key]; if (!t) return '';
  if (key === 'settings' && A.mode === 'account') t = ['설정 사용법', '데이터는 내 계정의 서버 저장소에 자동으로 저장돼요(왼쪽 아래 ‘저장됨’ 표시). 다른 기기에서도 같은 계정으로 로그인하면 같은 데이터를 볼 수 있어요. 그래도 가끔 ‘내보내기’로 백업 파일을 받아 두세요.'];
  if (lsGet('ms:tip:' + key) === '1') return `<div class="tip-min noprint"><button class="sm ghost" data-act="tipShow" data-k="${key}">💡 이 화면 사용법</button></div>`;
  return `<aside class="tip noprint"><div class="tip-h"><b>💡 ${esc(t[0])}</b><span class="sp"></span><button class="sm ghost" data-act="tipHide" data-k="${key}">닫기</button></div><p>${esc(t[1])}</p><button class="sm" data-act="help">도움말 전체 보기</button></aside>`;
}
const emptyState = (title, desc, buttons = '') => `<div class="empty">${emptyImgFor(title) ? `<img class="empty-img" src="${emptyImgFor(title)}" alt="">` : ''}<div class="empty-t">${esc(title)}</div><p>${desc}</p><div class="row" style="justify-content:center">${buttons}</div></div>`;
function download(name, text, mime = 'text/csv;charset=utf-8') { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: mime })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
function openHelp(tab = 'start') {
  const prog = store.guideProgress(); const done = GUIDE_STEPS.filter(s => prog[s.key]).length;
  const body = {
    start: `<p class="mute small">차례대로 따라 하면 처음 설정이 끝납니다. (${done}/${GUIDE_STEPS.length} 완료)</p><ol class="steps">${GUIDE_STEPS.map(s => `<li class="${prog[s.key] ? 'done' : ''}"><b>${esc(s.title)}</b> ${prog[s.key] ? '<span class="tag ok">완료</span>' : ''}<br><span class="mute small">${esc(s.hint)}</span><br><button class="sm" data-go-close="${s.go}">${esc(s.btn)}</button></li>`).join('')}</ol>`,
    terms: `<dl class="gl">${GLOSSARY.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`,
    faq: [...(A.mode === 'account' ? [['로그인하면 데이터는 어떻게 되나요?', '계정마다 따로 서버에 저장돼요. 같은 사이트를 써도 다른 사람의 데이터는 보이지 않고, 다른 기기에서 같은 계정으로 로그인하면 이어서 쓸 수 있어요. 비밀번호를 잊으면 관리자에게 문의하세요(자동 재설정은 아직 없어요).']] : []), ...FAQ.map(([q, a], i) => (i < 2 && A.mode === 'account' ? [q, i === 0 ? '내 계정의 서버 저장소에 저장돼요(왼쪽 아래 ‘저장됨’ 표시). 그래도 설정의 ‘내보내기’로 백업 파일을 받아 두면 더 안전해요.' : '로그인하면 기기를 바꿔도 같은 계정으로 이어서 쓸 수 있어요. 다만 내보내기로 백업해 두면 계정을 삭제하거나 서버에 문제가 생겨도 복구할 수 있어요.'] : [q, a]))].map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join(''),
  }[tab];
  const d = modal(`<div class="dlg"><div class="row"><h3 style="margin:0">도움말</h3><span class="sp"></span><button class="sm" data-c>닫기</button></div><div class="tabs">${[['start', '처음 시작하기'], ['terms', '용어 설명'], ['faq', '자주 묻는 질문']].map(([k, l]) => `<a data-htab="${k}" class="${k === tab ? 'on' : ''}">${l}</a>`).join('')}</div>${body}</div>`);
  $('[data-c]', d).onclick = () => d.close();
  $$('[data-htab]', d).forEach(a => (a.onclick = () => { d.close(); openHelp(a.dataset.htab); }));
  $$('[data-go-close]', d).forEach(b => (b.onclick = () => { d.close(); location.hash = b.dataset.goClose; render(); }));
}

// ----- 라우터 -----
const NAV = [['home', '🏠', '홈'], ['plan', '🗓️', '일정·계획'], ['events', '🎉', '행사'], ['services', '⛪', '예배'], ['people', '👥', '인원·출석'], ['ministry', '🌱', '부서 사역'], ['money', '💰', '회계'], ['assets', '🧰', '비품'], ['resources', '📚', '자료실'], ['settings', '⚙️', '설정']];
// 왼쪽 메뉴 위 ‘오늘의 교회력’ 띠: 절기 이름과 전례 색(흰색 절기는 금색으로 표시)
const LITU_HEX = { 보라: '#7d5bc0', 흰색: '#d4a72c', 초록: '#3f9d5f', 빨강: '#d4513f' };
function paintSeason() {
  const el = $('#season'); if (!el) return; const t = today(); const i = churchInfo(t);
  const hex = LITU_HEX[i.color] || '#3f9d5f'; document.body.style.setProperty('--litu', hex);
  el.innerHTML = `<span class="sdot" aria-hidden="true"></span><span class="stxt"><b>${esc(i.label)}</b><small>${esc(i.special ? i.special + ' · ' : '')}전례 색 ${esc(i.color)}</small></span>`;
  el.title = `오늘(${t})의 교회력 · 감리회 성서일과 기준 자동 계산`;
}
function render() {
  const [view, id] = (location.hash || '#home').slice(1).split('/'); const base = view === 'event' || view === 'guides' || view === 'season' ? 'events' : view === 'service' || view === 'curricula' || view === 'curriculum' ? 'services' : view === 'schedule' || view === 'annual' ? 'plan' : view === 'asset' ? 'assets' : view === 'report' ? 'money' : view;
  $('#nav').innerHTML = NAV.map(([k, ico, l]) => `<a data-go="#${k}" class="${base === k ? 'on' : ''}"><span class="ico">${ico}</span>${l}</a>`).join('');
  $('#dept-box').innerHTML = [...store.depts().map(d => [String(d.id), d.name, 'dk-' + dk(d.id)]), ['all', '전체', 'dk-all']].map(([v, l, c]) => `<button data-dept="${v}" class="${c}${UI.dept === v ? ' on' : ''}">${esc(l)}</button>`).join('');
  paintAcct();
  paintSeason();
  document.body.dataset.theme = UI.dept === 'all' ? 'all' : ({ kid: 'kid', teen: 'teen', youth: 'youth' }[dk(did())] || 'all'); // 아동부 노랑 · 중고등부 빨강 · 청년부 파랑 · 전체 초록
  const bar = $('#demo-bar'); const demo = store.get().demo;
  bar.hidden = !demo && !window.__memOnly; bar.innerHTML = window.__memOnly ? '이 브라우저는 저장을 허용하지 않아 입력한 내용이 창을 닫으면 사라집니다.' : '가상 데이터로 체험 중입니다. 설정에서 ‘실제 데이터로 시작’을 누르면 비어 있는 상태로 시작합니다.';
  const V = { home: vHome, plan: vPlan, events: vEvents, event: vEvent, services: vServices, service: vService, schedule: vSchedule, assets: vAssets, asset: vAsset, report: vReport, annual: vAnnual, ministry: vMinistry, curricula: vCurricula, curriculum: vCurriculum, resources: vResources, guides: vGuides, season: vSeason, people: vPeople, money: vMoney, settings: vSettings, 'login-preview': vLoginPreview }[view] || vHome;
  $('#main').innerHTML = ''; V(id ? Number(id) : null); document.body.classList.remove('nav-open');
  $('#crumb').textContent = (NAV.find(n => n[0] === base) || NAV[0])[2] + (UI.dept === 'all' ? '' : ' · ' + (store.dept(did()) || {}).name);
}
window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });
watchUpdates(VERSION, showUpdateBar);
// ----- 할 일 시간 알림(팝업) -----
const reminderQueue = []; let reminderOpen = false;
function showReminder(todo) { reminderQueue.push(todo); nextReminder(); }
function nextReminder() {
  if (reminderOpen || !reminderQueue.length) return; const todo = reminderQueue.shift(); reminderOpen = true;
  if (document.visibilityState !== 'visible') desktopNotify(todo); // 창이 가려져 있을 때만 바탕화면 알림(보일 때는 팝업으로 충분)
  const d = modal(`<div class="dlg" role="alertdialog" aria-label="할 일 알림"><h3 style="margin:0 0 8px">⏰ 할 일 시간이에요</h3><p style="font-size:1.1rem;margin:0 0 4px"><b>${esc(todo.time)}</b></p><p style="white-space:pre-wrap;margin:0 0 12px">${esc(todo.title)}</p><div class="dlg-foot"><button data-close>닫기</button><button data-snooze>10분 뒤 다시</button><button class="pri" data-done>완료</button></div></div>`);
  const end = () => { reminderOpen = false; setTimeout(nextReminder, 200); };
  d.addEventListener('close', end, { once: true });
  d.querySelector('[data-close]').onclick = () => d.close();
  d.querySelector('[data-snooze]').onclick = () => { snoozeTodo(todo, 10); toast('10분 뒤에 다시 알려 드릴게요.'); d.close(); };
  d.querySelector('[data-done]').onclick = () => { guard(() => store.setTodoDone(todo.id, true), '완료했어요.'); d.close(); render(); };
}
startReminders({ getTodos: () => store.get().todos || [], onDue: showReminder });
document.addEventListener('submit', e => { const f = e.target.closest && e.target.closest('[data-todoform]'); if (!f) return; e.preventDefault(); const title = f.elements.title.value, time = f.elements.time.value; const ok = guard(() => { store.saveTodo({ title, time, date: today() }); return true; }); if (ok) { render(); const inp = document.querySelector('[data-todoform] [name=title]'); if (inp) inp.focus(); } });
document.addEventListener('change', async e => { const t = e.target; if (!t.matches) return;
  if (t.matches('[data-growth]')) { const [sid, pid, key] = t.dataset.growth.split('/'); guard(() => store.setGrowth(Number(sid), Number(pid), key, t.checked)); render(); return; }
  if (t.matches('[data-ncstep]')) { const [pid, key] = t.dataset.ncstep.split('/'); guard(() => store.setNewcomerStep(Number(pid), key, t.checked)); render(); return; }
  if (t.matches('[data-currfile]') && t.files && t.files[0]) { const file = t.files[0]; t.value = ''; if (file.size > 2e6) { toast('파일이 너무 커요(2MB 이하).', true); return; }
    try { const id = store.importCurriculum(JSON.parse(await file.text())); toast('교재를 가져왔어요. 과를 확인하고 ‘연간 배치’를 누르세요.'); location.hash = `#curriculum/${id}`; } catch (err) { toast(err instanceof SyntaxError ? '교재 파일(JSON)을 읽지 못했어요.' : err.message, true); } return; }
});
document.addEventListener('change', e => { const t = e.target; if (t.matches && t.matches('[data-todo]')) { guard(() => store.setTodoDone(Number(t.dataset.todo), t.checked)); render(); } });
const page = (ico, title, sub, body, actions = '') => { $('#main').innerHTML = `<div class="pagehead"><div><h1 class="title"><span class="ico">${ico}</span>${esc(title)}</h1><p class="sub">${sub}</p></div>${actions ? `<div class="actions noprint">${actions}</div>` : ''}</div>${tipHtml()}${body}`; };
const barHtml = (spent, budget) => { const p = budget ? Math.min(100, Math.round(spent / budget * 100)) : 0; return `<div class="bar ${budget && spent > budget ? 'over' : p >= 85 ? 'warn' : ''}"><i style="width:${p}%"></i></div>`; };
const yearSel = () => `<select data-year>${[UI.year - 1, UI.year, UI.year + 1].map(y => `<option${y === UI.year ? ' selected' : ''} value="${y}">${y}년</option>`).join('')}</select>`;

// 로그인 화면 모양 확인용(서버 없이): 홈 위에 로그인 화면을 겹쳐 보여 주고, 닫으면 홈으로 돌아간다
function vLoginPreview() { vHome(); openLoginPreview().then(() => { location.hash = '#home'; }); }

// ----- 홈 -----
function vHome() {
  const H = store.home(did()); const t = today();
  const prog = store.guideProgress(); const pending = GUIDE_STEPS.filter(s => !prog[s.key]); const doneN = GUIDE_STEPS.length - pending.length;
  const guide = pending.length ? `<section class="card guide noprint"><div class="row"><h3 style="margin:0">처음 시작하기</h3><span class="tag">${doneN}/${GUIDE_STEPS.length}</span><span class="sp"></span><button class="sm" data-act="help">도움말 열기</button></div><div class="bar" style="margin:12px 0 6px"><i style="width:${Math.round(doneN / GUIDE_STEPS.length * 100)}%"></i></div>${pending.slice(0, 3).map(s => `<div class="gstep"><div class="sp"><b>${esc(s.title)}</b><br><span class="mute small">${esc(s.hint)}</span></div><button class="sm" data-go="${s.go}">${esc(s.btn)}</button></div>`).join('')}${pending.length > 3 ? `<p class="mute small" style="margin:8px 0 0">남은 단계 ${pending.length - 3}개는 도움말에서 볼 수 있어요.</p>` : ''}</section>` : '';
  const sinceExport = store.daysSinceExport(); const S0 = store.get();
  const backupNote = !S0.demo && (S0.people.length + S0.events.length + S0.transactions.length > 0) && (sinceExport === null || sinceExport >= 30) ? `<div class="callout warn noprint" style="margin-bottom:16px"><span>🛟</span><div class="sp">${sinceExport === null ? '아직 백업 파일을 받은 적이 없어요.' : `마지막 백업 파일이 ${sinceExport}일 전이에요.`} ${A.mode === 'account' ? '데이터는 서버에 자동 저장되지만, 설정에서 ‘내보내기’로 파일을 받아 두면 더 안전해요.' : '데이터는 이 브라우저에만 저장되므로 설정에서 ‘내보내기’로 파일을 받아 두세요.'}</div><button class="sm" data-go="#settings">설정 열기</button></div>` : '';
  const dday = d => { const n = Math.round((Date.parse(d + 'T00:00:00Z') - Date.parse(t + 'T00:00:00Z')) / 864e5); return n < 0 ? ['bad', `${-n}일 지남`] : n === 0 ? ['bad', '오늘'] : n <= 3 ? ['warn', `D-${n}`] : ['', `D-${n}`]; };
  const scope = UI.dept === 'all' ? allScope() : (store.dept(did()) || {}).name; const month = Number(t.slice(5, 7));
  const todayN = H.week.filter(i => i.date <= t && i.end >= t).length; const overN = H.tasks.filter(k => k.overdue).length;
  const totB = H.budget.reduce((a, b) => a + b.budget, 0), totE = H.budget.reduce((a, b) => a + b.expense, 0);
  const monthExp = store.transactions({ deptId: did(), year: UI.year, month }).filter(x => x.kind === 'expense').reduce((a, x) => a + x.amount, 0);
  const items = H.week.map(i => { const isToday = i.date <= t && i.end >= t; return `<div class="sched" data-open="${i.type}/${i.id}"><div class="datebox ${isToday ? 'today' : ''}"><small>${dow(i.date)}</small><b>${Number(i.date.slice(8))}</b></div><div class="what"><b>${typeIco(i)} ${esc(i.title)}</b><span>${i.end !== i.date ? esc(range(md(i.date), md(i.end))) : [i.time ? esc(i.time) : '', i.type === 'service' ? esc(churchLabel(i.date)) : i.type === 'schedule' ? esc(i.kind || '일정') : '행사'].filter(Boolean).join(' · ')}${isToday ? ' · 오늘' : ''}</span></div>${deptTag(i.dept_id)}</div>`; }).join('');
  const tasks = H.tasks.slice(0, 8).map(k => { const [c, l] = k.due ? dday(k.due) : ['', '기한 없음']; return `<div class="todo"><input type="checkbox" data-task="${k.id}" aria-label="완료"><div class="sp"><div class="tt">${esc(k.title)}</div><div class="mute small">${esc(k.event.title)}${k.assignee ? ' · ' + esc(k.assignee) : ''}</div></div><span class="tag ${c}">${l}</span></div>`; }).join('');
  const budget = H.budget.map(b => { const pct = b.budget ? Math.round(b.expense / b.budget * 100) : 0; return `<div class="pad"><div class="row"><b>${esc(b.dept.name)}</b><span class="sp"></span>${b.budget && b.expense > b.budget ? '<span class="tag bad">예산 초과</span>' : `<span class="tag blue">${b.budget ? pct + '% 사용' : '예산 없음'}</span>`}</div><div style="margin:10px 0 14px">${barHtml(b.expense, b.budget)}</div><div class="dl"><div><div class="k">예산</div><div class="v">${won(b.budget)}</div></div><div><div class="k">지출</div><div class="v">${won(b.expense)}</div></div><div><div class="k">예산 잔액</div><div class="v" style="color:${b.budget_remaining < 0 ? 'var(--orange)' : 'var(--primary-dk)'}">${won(b.budget_remaining)}</div></div><div><div class="k">수입·지출 차액</div><div class="v" style="color:${b.net < 0 ? 'var(--orange)' : 'var(--good)'}">${won(b.net)}</div></div></div></div>`; }).join('<div style="border-top:1px solid var(--line)"></div>');
  // 대림절 안내: 대림절이 한 달 안에 시작하거나 대림절·성탄절기 중이면 홈에 카드로, 아니면 버튼으로
  const addDays = (s, n) => new Date(Date.parse(s + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
  const nowInfo = churchInfo(t); let advStart = null; for (let i = 0; i <= 40; i++) { const d = addDays(t, i); if (churchInfo(d).season === '대림절') { advStart = { d, n: i }; break; } }
  const seasonOn = nowInfo.season === '대림절' || (nowInfo.season === '성탄절' && t <= `${t.slice(0, 4)}-12-25`);
  const seasonCard = seasonOn || advStart ? `<section class="seasoncard noprint"><span class="sdot" aria-hidden="true"></span><div class="sp"><b>${seasonOn ? `지금은 ${esc(nowInfo.label)}이에요` : advStart.n === 0 ? '오늘부터 대림절이에요' : `대림절이 ${advStart.n}일 뒤(${md(advStart.d)}) 시작해요`}</b><span>주일 공과·예배·성탄 행사 준비를 한곳에서 볼 수 있어요.</span></div><button data-go="#season">대림절·성탄절 보기</button></section>` : '';
  const actions = `<button class="pri" data-act="newEvent">+ 행사</button><button data-act="newService">+ 예배</button><button data-act="newSchedule">+ 일정</button><button data-act="newTx">+ 지출 등록</button><button data-go="#services">출석 기록</button><button data-act="notice" data-kind="week">이번 주 안내 문구</button>`;
  const nowK = kstNow(); const allTodos = store.todos(); const todayTodos = allTodos.filter(x => x.date === t); const pastTodos = allTodos.filter(x => x.date < t && !x.done); const openN = todayTodos.filter(x => !x.done).length; const np = notifyPermission();
  const todoRow = (x, past) => `<div class="todo ${x.done ? 'done' : ''}"><input type="checkbox" data-todo="${x.id}" ${x.done ? 'checked' : ''} aria-label="완료"><span class="tt sp">${esc(x.title)}</span>${x.time ? `<span class="tag ${!x.done && !past && x.time <= nowK.time ? 'warn' : ''}">⏰ ${esc(x.time)}</span>` : ''}${past ? `<span class="tag">${md(x.date)}</span><button class="sm" data-act="moveTodo" data-id="${x.id}">오늘로</button>` : ''}<button class="sm ghost noprint" data-act="editTodo" data-id="${x.id}" aria-label="수정">수정</button><button class="sm ghost noprint" data-act="delTodo" data-id="${x.id}" aria-label="삭제">✕</button></div>`;
  const notifLine = np === 'granted' ? '✅ 바탕화면 알림이 켜져 있어요.' : np === 'denied' ? '바탕화면 알림이 꺼져 있어요(브라우저·앱 설정에서 허용하면 켜져요). 지금은 화면 팝업으로만 알려요.' : np === 'unsupported' ? '이 환경에서는 바탕화면 알림을 쓸 수 없어요. 화면 팝업으로 알려요.' : '<button class="sm" data-act="enableNotif">🔔 바탕화면 알림 켜기</button>';
  const todoHtml = `<section class="box" id="todo-box" style="margin-bottom:16px"><div class="cardh"><h3>오늘 할 일</h3><span class="tag">${openN}/${todayTodos.length}</span><span class="sub">${md(t)}</span></div><div class="cardb">
    <form data-todoform class="todoadd noprint"><input name="title" placeholder="오늘 할 일을 적으세요" maxlength="120" required aria-label="할 일"><input type="time" name="time" aria-label="알림 시간(선택)" title="시간을 정하면 그 시간에 알려 줘요"><button class="pri">추가</button></form>
    ${todayTodos.map(x => todoRow(x, false)).join('') || emptyState('오늘 할 일이 없어요', '위에 적고 ‘추가’를 누르세요. 시간을 함께 정하면 그 시간에 팝업으로 알려 줘요.', '')}
    ${pastTodos.length ? `<details class="small" style="margin:8px 12px"><summary>지난 할 일 ${pastTodos.length}건 (아직 안 끝남)</summary>${pastTodos.map(x => todoRow(x, true)).join('')}</details>` : ''}
    <p class="mute small noprint" style="margin:8px 12px">⏰ 시간을 정한 할 일은 <b>이 앱·사이트를 열어 둔 동안</b> 그 시간에 팝업으로 알려요(창을 닫으면 알림이 오지 않아요). ${notifLine}</p></div></section>`;
  const brief = store.briefing(did(), t); const kindIco = { event: '🎉', service: '⛪', care: '💛' };
  const briefHtml = `<section class="box" style="margin-bottom:16px"><div class="cardh"><h3>이번 주 목회 브리핑</h3><span class="tag">${brief.length}</span><span class="sub">지금 챙길 일을 급한 순서로 보여 줘요</span></div><div class="cardb">${brief.slice(0, 5).map(c => `<a class="sched" href="#${c.go}" style="text-decoration:none;color:inherit"><div class="datebox"><b>${kindIco[c.kind]}</b></div><div class="what"><b>${esc(c.title)}</b><span>${esc(c.reason)}${c.detail ? ' · ' + esc(c.detail) : ''}</span></div>${c.pri === 1 ? '<span class="tag bad">급함</span>' : c.pri === 2 ? '<span class="tag warn">오늘</span>' : ''}</a>`).join('') || emptyState('지금 급하게 챙길 일이 없어요', '기한이 지난 업무, 오늘 마감 업무, 2주 안에 다가오는 행사, 순서가 비어 있는 이번 주 예배가 여기에 나타나요.', '')}${brief.length > 5 ? `<p class="mute small" style="margin:8px 12px">외 ${brief.length - 5}건 · <a href="#events">행사에서 모두 보기</a></p>` : ''}</div></section>`;
  const mast = `<h1 class="title"><span class="vh">홈 · </span>${Number(t.slice(5, 7))}월 ${Number(t.slice(8))}일 ${dow(t)}요일</h1><p class="sub"><span class="lcdot" style="background:${LITU_HEX[nowInfo.color] || '#3f9d5f'}"></span>${esc(churchLabel(t))} · ${esc(scope)}</p><p class="today-line">${openN ? `오늘 할 일 <b>${openN}건</b>` : '오늘 할 일 없음'} · 이번 주 일정 <b>${H.week.length}건</b>${overN ? ` · <b class="late">기한 지난 업무 ${overN}건</b>` : ''}</p>`;
  page('🏠', '홈', '', `${seasonCard}${backupNote}<div class="homegrid">${todoHtml}${briefHtml}</div>
  <div class="strip" role="group" aria-label="이번 주 요약">
    <div><div class="k">이번 주 일정</div><div class="v">${H.week.length}건</div><div class="s">오늘 ${todayN}건 · ${md(H.from)} ~ ${md(H.to)}</div></div>
    <div class="${overN ? 'warn' : ''}"><div class="k">준비할 일</div><div class="v">${H.tasks.length}건</div><div class="s">${overN ? `<span class="tag bad">기한 지남 ${overN}건</span>` : '기한 지난 업무 없음'}</div></div>
    <div><div class="k">${month}월 지출</div><div class="v">${won(monthExp)}</div><div class="s">${UI.year}년 누계 ${won(totE)}</div></div>
    <div class="key"><div class="k">예산 잔액</div><div class="v">${won(totB - totE)}</div><div class="s">${totB ? `예산 ${won(totB)} 중 ${Math.round(totE / totB * 100)}% 사용` : '예산 항목을 입력하세요'}</div></div>
  </div>
  <div class="cols">
    <section class="box"><div class="cardh"><h3>이번 주 일정</h3><span class="sub">${md(H.from)} ~ ${md(H.to)}</span><span class="sp"></span><button class="sm" data-go="#plan">달력 보기</button></div><div class="cardb">${items || emptyState('이번 주 일정이 없어요', '예배나 행사를 등록하면 여기에 모입니다.', '<button class="sm" data-act="newService">+ 예배</button><button class="sm" data-act="newEvent">+ 행사</button>')}</div></section>
    <section class="box"><div class="cardh"><h3>준비할 일</h3><span class="tag">${H.tasks.length}</span><span class="sp"></span><button class="sm" data-go="#events">행사 보기</button></div><div class="cardb">${tasks || emptyState('남은 준비 업무가 없어요', store.get().events.length ? '모든 준비를 마쳤어요. 🎉' : '행사를 만들 때 ‘예시로 시작’을 고르면 준비 업무와 마감일이 자동으로 만들어져요.', store.get().events.length ? '' : '<button class="sm" data-act="newEvent">+ 행사 만들기</button>')}${H.tasks.length > 8 ? `<p class="mute small" style="margin:8px 12px">외 ${H.tasks.length - 8}건은 각 행사에서 볼 수 있어요.</p>` : ''}</div></section>
  </div>
  <section class="box" style="margin-top:20px"><div class="cardh"><h3>예산 현황</h3><span class="sub">${UI.year}년</span><span class="sp"></span><button class="sm" data-go="#money">회계 보기</button></div>${budget}</section>
  ${guide}`, actions);
  $('#main .pagehead').classList.add('home-head'); $('#main .pagehead > div:first-child').innerHTML = mast; // 홈은 제목 자리에 ‘오늘’ 머리글(날짜·교회력·오늘 요약)을 넣는다
}

// ----- 일정·계획 -----
function vPlan() {
  const tabs = `<div class="tabs"><a data-ptab="cal" class="${UI.planTab === 'cal' ? 'on' : ''}">월 달력</a><a data-ptab="list" class="${UI.planTab === 'list' ? 'on' : ''}">일정 목록</a><a data-ptab="year" class="${UI.planTab === 'year' ? 'on' : ''}">연간·절기 계획</a></div>`;
  if (UI.planTab === 'cal') {
    const [y, m] = UI.month.split('-').map(Number); const dim = new Date(Date.UTC(y, m, 0)).getUTCDate(); const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
    const items = store.calendar(did(), `${UI.month}-01`, `${UI.month}-${pad(dim)}`, { services: UI.calSvc }); const cells = [];
    for (let i = 0; i < lead; i++) cells.push('<div class="out"></div>');
    for (let d = 1; d <= dim; d++) { const ds = `${UI.month}-${pad(d)}`; cells.push(`<div class="${[ds === today() ? 'today' : '', dow(ds) === '일' ? 'sun' : ''].filter(Boolean).join(' ')}"><b>${d}</b>${dow(ds) === '일' ? `<small class="cs" title="교회력(자동 계산)"><i style="background:${churchInfo(ds).colorHex}"></i>${esc(churchInfo(ds).special || churchInfo(ds).label)}</small>` : ''}${items.filter(i => i.date <= ds && i.end >= ds).map(i => `<a class="dk-${dk(i.dept_id)}" data-open="${i.type}/${i.id}" title="${esc(i.title)}">${typeIco(i)} ${esc(i.title)}</a>`).join('')}</div>`); }
    const prev = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7), next = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);
    page('🗓️', '일정·계획', '교사 기도회·회의와 행사를 모아 보는 달력이에요. 주일예배는 ‘예배’ 메뉴에서 관리해요.', `${tabs}<div class="monthbar"><div class="mnav"><button data-month="${prev}" aria-label="이전 달">◀</button><h2 class="mtitle">${y}년 ${m}월</h2><button data-month="${next}" aria-label="다음 달">▶</button><button class="sm" data-month="${today().slice(0, 7)}">오늘</button></div><span class="sp"></span><label class="small noprint"><input type="checkbox" data-calsvc${UI.calSvc ? ' checked' : ''}> 예배도 함께 보기</label><button class="sm noprint" data-act="pdfImport">PDF에서 가져오기</button><button class="pri noprint" data-act="newSchedule">+ 일정</button></div><div class="cal">${['월', '화', '수', '목', '금', '토', '일'].map(w => `<div class="h${w === '일' ? ' sun' : ''}">${w}</div>`).join('')}${cells.join('')}</div><p class="callegend small mute noprint"><span class="lg dk-kid"></span>아동부 <span class="lg dk-teen"></span>중고등부 <span class="lg dk-youth"></span>청년부 <span class="lcdot"></span>주일 칸의 점은 그날의 전례 색(자동 계산)</p>`);
  } else {
    if (UI.planTab === 'list') return vScheduleList(tabs);
    const d = workDept(); const P = store.plan(d, UI.year); const autoSeasons = !store.seasons(d, UI.year).length ? guard(() => store.loadSeasonTemplate(d, UI.year)) : 0; const seasons = store.seasons(d, UI.year);
    const evs = store.get().events.filter(e => e.dept_id === d && e.start_date.startsWith(String(UI.year))).sort((a, b) => a.start_date.localeCompare(b.start_date));
    page('🗓️', '일정·계획', `${deptTag(d)} ${UI.dept === 'all' ? '<span class="mute small">(전체 보기에서는 첫 부서를 표시합니다)</span>' : ''}`, `${tabs}<div class="row"><b>${store.dept(d).name}</b>${yearSel()}<span class="sp"></span><button class="pri noprint" data-go="#annual">📑 ${UI.year}년 연말 보고서</button></div>
    <h2>교회력 <span class="mute small">${UI.year}년 · 자동 계산</span></h2><div class="tablewrap"><table class="t"><thead><tr><th>절기</th><th>전례 색</th><th>기간</th><th>설명</th></tr></thead><tbody>${churchYear(UI.year).map(s => `<tr><td><b>${esc(s.name)}</b></td><td><span class="lcdot" style="background:${LITU_HEX[s.color] || '#2f8f4e'}"></span>${esc(s.color)}</td><td>${esc(s.start)} ~ ${esc(s.end)}</td><td class="mute small">${esc(s.note)}</td></tr>`).join('')}</tbody></table></div><p class="mute small">서방 교회력의 일반 규칙으로 계산한 값이에요. 교단·교회마다 절기 이름과 주차 세는 방법이 조금 다를 수 있으니 확인해서 쓰세요. 달력과 예배 목록에는 이 계산 결과가 자동으로 표시돼요.${autoSeasons ? ` 아래 ‘절기 계획’에는 ${UI.year}년 기본 절기 ${autoSeasons}개를 자동으로 넣었어요.` : ''}</p>
    <h2>사역 목표</h2><textarea id="goal" placeholder="올해 사역 목표">${esc(P.goal)}</textarea>
    <h2>월별 교육 주제 <button class="sm noprint" data-act="themeTpl">예시 넣기</button> <button class="sm noprint" data-act="pdfThemes">PDF에서 가져오기</button></h2><p class="mute small noprint" style="margin:-6px 0 10px">비어 있는 달만 예시로 채웁니다. 이미 적은 달은 바뀌지 않아요. 채운 뒤 우리 교회에 맞게 고쳐 쓰세요.</p><div class="tablewrap"><table class="t"><tbody>${Array.from({ length: 12 }, (_, i) => `<tr><td style="width:60px">${i + 1}월</td><td><input class="cell-in" data-theme="${i + 1}" value="${esc(P.themes[i + 1] || '')}" placeholder="교육 주제"></td></tr>`).join('')}</tbody></table></div>
    <div class="row" style="margin-top:8px"><button class="pri" data-act="savePlan">목표·주제 저장</button></div>
    <h2>절기 계획 <button class="sm noprint" data-act="editSeason">+ 추가</button> <button class="sm noprint" data-act="seasonTpl">절기 예시 넣기</button></h2><p class="mute small noprint" style="margin:-6px 0 10px">사순절·부활절·어린이주일·성령강림절·추수감사절·대림절·성탄절을 ${UI.year}년 날짜로 계산해 넣습니다. 교회마다 날짜가 다른 절기는 꼭 확인해 수정하세요.</p>
    <table class="t"><thead><tr><th>절기</th><th>기간</th><th>주제·본문</th><th>계획</th><th></th></tr></thead><tbody>${seasons.map(s => `<tr><td><b>${esc(s.name)}</b></td><td>${esc(s.start || '')}${s.end && s.end !== s.start ? ' ~ ' + esc(s.end) : ''}</td><td>${esc(s.theme)}<br><span class="mute small">${esc(s.scripture)}</span></td><td>${esc(s.plan)}</td><td><button class="sm" data-act="editSeason" data-id="${s.id}">수정</button> <button class="sm dng" data-act="delSeason" data-id="${s.id}">삭제</button></td></tr>`).join('') || `<tr><td colspan="5">${emptyState('등록된 절기가 없어요', '‘절기 예시 넣기’를 누르면 올해 날짜로 한 번에 채워져요. 날짜는 해마다 달라지니 확인 후 수정하세요.', '<button class="sm" data-act="seasonTpl">절기 예시 넣기</button>')}</td></tr>`}</tbody></table>
    <h2>올해 행사</h2><table class="t"><tbody>${evs.map(e => `<tr class="link" data-open="event/${e.id}"><td style="width:92px">${md(e.start_date)}</td><td>${esc(e.title)}</td><td class="num">${e.expected_budget ? won(e.expected_budget) : ''}</td></tr>`).join('') || '<tr><td class="mute">행사가 없습니다.</td></tr>'}</tbody></table>`);
  }
}

// ----- 행사 -----
const EVT = ['행사', '여름성경학교', '겨울성경학교', '수련회', '절기행사', '봉사·선교', '기타'];
// 행사 시작일을 바꾸면, 마감일이 있는 미완료 업무를 같은 만큼 옮길지 미리 보여 주고 묻는다.
const shiftStr = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
function offerShift(id, oldStart, newStart) {
  const delta = Math.round((Date.parse(newStart + 'T00:00:00Z') - Date.parse(oldStart + 'T00:00:00Z')) / 864e5); const list = store.get().tasks.filter(k => k.event_id === id && k.status !== 'done' && k.due);
  if (!delta || !list.length) return;
  const sample = list.slice(0, 4).map(k => `${md(k.due)} → ${md(shiftStr(k.due, delta))}  ${k.title}`).join('\n');
  (async () => { if (await ask(`행사 시작일을 ${delta > 0 ? delta + '일 뒤로' : -delta + '일 앞으로'} 바꿨어요. 마감일이 있는 미완료 업무 ${list.length}개도 같은 만큼 옮길까요?\n\n${sample}${list.length > 4 ? `\n…외 ${list.length - 4}개` : ''}\n\n직접 정해 둔 마감일도 함께 움직여요. ‘취소’하면 그대로 둬요.`, '함께 옮기기')) { guard(() => store.shiftEventTasks(id, delta), '마감일을 옮겼어요.'); render(); } })();
}
function eventForm(v = {}) {
  const isNew = !v.id;
  const fields = [...(isNew ? [{ k: 'tpl', label: '예시로 시작 (선택)', type: 'select', options: [['', '직접 입력'], ...Object.entries(EVENT_TEMPLATES).map(([k, t]) => [k, t.name])], hint: '고르면 유형·목적이 채워지고, 저장할 때 준비 업무와 준비물이 마감일과 함께 자동으로 만들어져요.' }] : []),
    { k: 'dept_id', label: '부서', type: 'select', options: deptOpts() }, { k: 'title', label: '행사명', req: true, ph: '예: 2027 여름성경학교' }, { k: 'type', label: '유형', type: 'select', options: EVT.map(x => [x, x]) },
    { k: 'start_date', label: '시작일', type: 'date', req: true, hint: '준비 업무의 마감일은 이 날짜를 기준으로 계산돼요.' }, { k: 'end_date', label: '종료일', type: 'date', hint: '하루 행사면 비워 두세요.' }, { k: 'place', label: '장소' }, { k: 'owner', label: '담당자' },
    { k: 'target_count', label: '목표 인원(명)', type: 'number', hint: '아직 모르면 비워 두세요.' }, { k: 'expected_budget', label: '예상 예산(원)', type: 'number', hint: '아직 모르면 0. 나중에 수정할 수 있어요.' }, { k: 'purpose', label: '목적', type: 'textarea' }, { k: 'note', label: '메모', type: 'textarea' }];
  form({ title: v.id ? '행사 수정' : '행사 추가', values: { dept_id: workDept(), type: '행사', ...v }, fields, wide: true,
    onOpen: d => { const sel = d.querySelector('[name=tpl]'); if (!sel) return; const note = document.createElement('div'); note.className = 'tplnote'; note.hidden = true; sel.closest('label').after(note);
      sel.onchange = () => { const t = EVENT_TEMPLATES[sel.value]; note.hidden = !t; if (!t) return;
        const set = (k, val, force) => { const el = d.querySelector(`[name=${k}]`); if (el && val && (force || !el.value || el.dataset.auto === '1')) { el.value = val; el.dataset.auto = '1'; } };
        set('type', t.type, true); set('purpose', t.purpose); set('place', t.place); set('target', t.target);
        const st = d.querySelector('[name=start_date]'), en = d.querySelector('[name=end_date]'); if (st.value && !en.value && t.days > 1) { const x = new Date(st.value + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + t.days - 1); en.value = x.toISOString().slice(0, 10); }
        const ti = d.querySelector('[name=title]'); if (!ti.value) ti.value = t.name;
        note.innerHTML = `<b>자동으로 만들어지는 준비 업무 ${t.tasks.length}개</b> (시작일 기준)<ul>${t.tasks.slice(0, 5).map(x => `<li>${x.offset < 0 ? Math.abs(x.offset) + '일 전' : x.offset + '일 후'} · ${esc(x.title)}</li>`).join('')}</ul>${t.tasks.length > 5 ? `<span class="mute">…외 ${t.tasks.length - 5}개</span>` : ''}<br><span class="mute">이 목록은 예시예요. 만든 뒤 우리 교회에 맞게 고치고 지우세요.</span>`; }; },
    onSubmit: o => { const key = o.tpl; const oldStart = v.start_date; const id = store.saveEvent({ ...v, ...o, dept_id: Number(o.dept_id) }); if (!isNew && oldStart && o.start_date && o.start_date !== oldStart) offerShift(id, oldStart, o.start_date); if (isNew && key) { const r = store.applyEventTemplate(id, key); toast(`준비 업무 ${r.tasks}개, 준비물 ${r.supplies}개를 만들었어요.`); } if (isNew) location.hash = `#event/${id}`; const ex = store.examOverlap(Number(o.dept_id), o.start_date, o.end_date || o.start_date)[0]; if (ex) setTimeout(() => toast(`이 행사는 ${ex.title}(${md(ex.date)}~${md(ex.end || ex.date)})과 겹쳐요. 학생 참석을 확인하세요.`, true), 400); } });
}
// ----- AI 이미지 만들기(설정 화면, 로그인한 계정에서만) -----
// [자리 이름(=img/ 파일 이름), 화면 표시, 서버에 보내는 종류]. 종류에 따라 크기가 정해진다(가로/정사각).
const IMG_SLOTS = [['free', '자유(크기 직접 선택)', 'free'], ['login-hero', '로그인 큰 그림', 'hero'], ['logo', '로고', 'avatar'], ['banner-vbs', '행사 배너 · 성경학교', 'banner'], ['banner-retreat', '행사 배너 · 수련회', 'banner'], ['banner-christmas', '행사 배너 · 성탄', 'banner'], ['banner-outing', '행사 배너 · 소풍', 'banner'], ['banner-general', '행사 배너 · 일반', 'banner'],
  ['season-advent', '절기 · 대림절', 'season'], ['season-christmas', '절기 · 성탄절', 'season'], ['season-lent', '절기 · 사순절', 'season'], ['season-easter', '절기 · 부활절', 'season'], ['season-thanksgiving', '절기 · 추수감사', 'season'],
  ['empty-schedule', '빈 화면 · 일정', 'empty'], ['empty-tasks', '빈 화면 · 업무', 'empty'], ['empty-people', '빈 화면 · 인원', 'empty'], ['empty-attendance', '빈 화면 · 출석', 'empty'], ['empty-money', '빈 화면 · 회계', 'empty'], ['empty-events', '빈 화면 · 행사', 'empty'],
  ['avatar-child', '아바타 · 아동', 'avatar'], ['avatar-teacher', '아바타 · 교사', 'avatar'], ['avatar-volunteer', '아바타 · 봉사자', 'avatar'], ['avatar-youth', '아바타 · 청년', 'avatar'], ['error-404', '오류 화면', 'empty']];
async function initImageBox() {
  const box = document.getElementById('imgbox'); if (!box) return; const $i = id => document.getElementById(id); const status = $i('imgstatus');
  let st; try { st = await imageApi.status(); } catch (e) { status.textContent = '이미지 만들기 상태를 확인하지 못했어요.'; return; }
  if (!st.enabled) { status.textContent = '이미지 만들기가 아직 켜져 있지 않아요. 관리자가 Cloudflare 비밀 변수 OPENAI_API_KEY를 설정하면 쓸 수 있어요(README 참고).'; return; }
  if (!st.allowed) { status.textContent = '이 계정은 이미지 만들기를 쓸 수 없어요(관리자가 허용한 계정만 가능).'; return; }
  status.textContent = `하루 ${st.limit}장까지 만들 수 있어요. 비용이 드는 기능이니 꼭 필요한 그림만 만드세요.`; $i('imgform').hidden = false; const left = $i('imgleft'); const setLeft = n => { left.textContent = `오늘 남은 횟수 ${n}/${st.limit}`; }; setLeft(st.left);
  const slot = $i('imgslot'); slot.onchange = () => { $i('imgsizewrap').hidden = slot.value !== 'free'; }; slot.onchange();
  $i('imggo').onclick = async () => {
    const go = $i('imggo'); const out = $i('imgresult'); const prompt = $i('imgprompt').value.trim(); const sl = IMG_SLOTS.find(x => x[0] === slot.value) || IMG_SLOTS[0];
    if (prompt.length < 5) { out.innerHTML = '<p class="err">그림 설명을 5자 이상 적어 주세요.</p>'; return; }
    go.disabled = true; out.innerHTML = '<p class="mute">만드는 중이에요… (보통 20초~1분, 최대 1~2분)</p>';
    try {
      const r = await imageApi.generate({ prompt, kind: sl[2], size: $i('imgsize').value, quality: $i('imgq').value }); setLeft(r.left);
      const ext = r.mime === 'image/jpeg' ? 'jpg' : r.mime === 'image/webp' ? 'webp' : 'png'; const name = `${sl[0] === 'free' ? 'image' : sl[0]}.${ext}`;
      out.innerHTML = `<img src="${r.image}" alt="만들어진 그림 미리보기" style="max-width:100%;border-radius:var(--radius-md);border:1px solid var(--line)"><div class="row" style="margin-top:8px"><a class="btnlike pri" id="imgdl" download="${esc(name)}" href="${r.image}">내려받기 (${esc(name)})</a></div>
        <div class="callout"><span>📝</span><div class="sp"><b>확인하세요</b><ul class="small"><li>그림 속 글자·손가락·얼굴 모양이 어색하지 않은지, 우리 교회의 표현 기준(성경 인물·예수님)에 맞는지 확인하세요.</li><li>실제 캐릭터·특정 작품과 닮은 그림은 쓰지 마세요. 사용 조건은 OpenAI 약관에서 확인하세요.</li><li>사이트의 그림을 바꾸려면 내려받은 파일을 알려 주세요(자리: ${esc(sl[1])}).</li></ul></div></div>`;
    } catch (e) { out.innerHTML = `<p class="err">${esc(e.message || '그림을 만들지 못했어요.')}</p>`; } finally { go.disabled = false; }
  };
}

// ----- 행사 진행 가이드 -----
const gList = a => a && a.length ? `<ul>${a.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '';
function guideHtml(key, evId) {
  const g = GUIDES[key] || GUIDES.general; const refs = g.refs.map(u => RESOURCES.find(r => r.url === u)).filter(Boolean);
  const sec = (t, body) => body ? `<h3>${t}</h3>${body}` : '';
  return `<div class="guidebody">${evId ? `<label class="f noprint">다른 가이드 보기 <select data-guidesel="${evId}">${Object.entries(GUIDES).map(([k, x]) => `<option value="${k}"${k === key ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>` : ''}${evId ? `<div class="row noprint" style="margin:8px 0"><button class="sm pri" data-act="guidePrep" data-id="${evId}" data-key="${esc(key)}">준비 일정을 준비 업무로 추가</button><button class="sm" data-act="guideFlow" data-id="${evId}" data-key="${esc(key)}">진행 순서를 행사 메모에 넣기</button><button class="sm" data-guidepick="${esc(key)}">인쇄용으로 보기</button></div><p class="mute small noprint" style="margin:0 0 8px">마감일은 행사 시작일 기준으로 계산되고, 같은 이름은 건너뛰어요.</p>` : ''}
  <p>${esc(g.summary)}</p>${sec('준비 일정(예시)', gList(g.prep))}
  ${sec('진행 순서(예시)', `<table class="t"><tbody>${g.flow.map(([t, w]) => `<tr><td style="white-space:nowrap">${esc(t)}</td><td>${esc(w)}</td></tr>`).join('')}</tbody></table>`)}
  ${sec('역할 분담', gList(g.roles))}${sec('진행 팁', gList(g.tips))}${sec('안전·개인정보', gList(g.safety))}${sec('가정 연계', gList(g.family))}${sec('성경·신학 메모', gList(g.theology))}${sec('끝난 뒤 평가 질문', gList(g.review))}
  ${refs.length ? `<h3>참고 사이트(자료실에서 확인한 곳)</h3><ul>${refs.map(r => `<li><a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.name)}</a></li>`).join('')}</ul>` : ''}
  <div class="callout">${sec('교사가 사용 전에 확인할 점', gList(g.teacherCheck))}<p class="mute small">이 가이드는 일반 원칙을 정리한 예시입니다(확인일 ${GUIDE_CHECKED}). 시간·인원 기준은 우리 교회 상황에 맞게 고치고, 성경 본문은 개역개정으로 직접 확인하세요.</p></div></div>`;
}
function vGuides() {
  const key = GUIDES[UI.guide] ? UI.guide : 'christmas';
  page('🧭', '행사 진행 가이드', '행사 종류마다 준비·진행·안전·가정 연계·평가를 참고하세요.', `<div class="row noprint" style="margin-bottom:12px">${Object.entries(GUIDES).map(([k, x]) => `<button class="${k === key ? 'pri' : ''}" data-guidepick="${k}">${x.ico} ${esc(x.name)}</button>`).join('')}<span class="sp"></span><button data-act="printPage">🖨️ 인쇄</button></div>${guideHtml(key, false)}`);
}
// 대림절 첫 주일부터 성탄절(12/25)까지 한 화면에 모아 본다.
function vSeason() {
  const y = UI.year; let start = `${y}-11-27`; for (let i = 0; i < 8; i++) { const d = new Date(Date.UTC(y, 10, 27 + i)).toISOString().slice(0, 10); if (churchLabel(d).includes('대림절 제1주')) { start = d; break; } }
  const end = `${y}-12-25`; const addD = (s, n) => new Date(Date.parse(s + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
  const items = store.calendar(did(), start, end); const t = today();
  const weeks = [0, 1, 2, 3].map(i => { const from = addD(start, i * 7), to = i === 3 ? end : addD(from, 6); return { from, to, label: churchLabel(from), items: items.filter(x => x.date <= to && x.end >= from) }; });
  const evs = store.get().events.filter(e => e.status !== 'cancelled' && (!did() || e.dept_id === did()) && e.start_date <= end && e.end_date >= start);
  const open = store.get().tasks.filter(k => k.status !== 'done' && evs.some(e => e.id === k.event_id)); const late = open.filter(k => k.due && k.due < t).length;
  const dd = Math.round((Date.parse(end + 'T00:00:00Z') - Date.parse(t + 'T00:00:00Z')) / 864e5);
  page('🕯️', `${y} 대림절·성탄절`, `${md(start)} ~ ${md(end)} · ${dd > 0 ? `성탄절까지 ${dd}일` : dd === 0 ? '오늘이 성탄절' : '성탄절이 지났어요'}`, `<div class="row noprint" style="margin-bottom:12px">${yearSel()}<button class="pri" data-act="newEvent">+ 행사</button><button data-act="newService">+ 예배</button><button data-guidepick="advent">대림절 가이드</button><button data-guidepick="christmas">성탄 발표회 가이드</button><button data-guidepick="outreach">나눔 가이드</button></div>
  <div class="statrow"><div class="card sc"><div class="k">기간 내 행사</div><div class="v">${evs.length}건</div></div><div class="card sc"><div class="k">남은 준비 업무</div><div class="v">${open.length}건</div><div class="s">${late ? `<span class="tag bad">기한 지남 ${late}건</span>` : '기한 지난 업무 없음'}</div></div><div class="card sc"><div class="k">일정·예배</div><div class="v">${items.length}건</div></div></div>
  ${weeks.map(w => `<section class="box" style="margin-top:16px"><div class="cardh"><h3>${esc(w.label)}</h3><span class="sub">${md(w.from)} ~ ${md(w.to)}</span></div><div class="cardb">${w.items.map(i => `<div class="sched" data-open="${i.type}/${i.id}"><div class="datebox"><small>${dow(i.date)}</small><b>${Number(i.date.slice(8))}</b></div><div class="what"><b>${typeIco(i)} ${esc(i.title)}</b><span>${i.end !== i.date ? esc(range(md(i.date), md(i.end))) : esc(i.time || '')}</span></div>${deptTag(i.dept_id)}</div>`).join('') || '<p class="mute small" style="margin:8px 12px">등록된 일정이 없어요.</p>'}</div></section>`).join('')}
  <div class="callout" style="margin-top:16px"><div class="sp"><b>교사가 확인할 점</b><ul><li>대림절·성탄 주일 이름은 감리회 성서일과로 계산한 값입니다. 교회·지방회 지침과 다르면 우리 교회 기준을 따르세요.</li><li>성탄 본문은 누가복음 1~2장, 마태복음 1~2장 등을 개역개정으로 직접 확인하세요.</li><li>행사별 시간·인원·안전 기준은 가이드의 예시를 고쳐 쓰세요.</li></ul></div></div>`);
}
function vEvents() {
  const all = store.get().events.filter(e => (!did() || e.dept_id === did()) && e.start_date.startsWith(String(UI.year))).sort((a, b) => a.start_date.localeCompare(b.start_date));
  const prog = e => store.eventProgress(e.id, today()); const flt = ['upcoming', 'check'].includes(UI.evFilter) ? UI.evFilter : '';
  const list = flt === 'upcoming' ? all.filter(e => e.status === 'planned' && e.start_date >= today()) : flt === 'check' ? all.filter(e => { const p = prog(e); return e.status === 'planned' && p.open && (p.overdue || p.unassigned); }) : all;
  const others = store.get().events.filter(e => !did() || e.dept_id === did()).length - all.length;
  const dtag = e => { if (e.status !== 'planned') return ''; const p = prog(e); const parts = []; if (p.days >= 0 && p.days <= 60) parts.push(`<span class="tag ${p.days <= 7 ? 'warn' : ''}">${p.days === 0 ? '오늘' : 'D-' + p.days}</span>`); if (p.open) parts.push(`<span class="mute small">남은 업무 ${p.open}건</span>`); if (p.overdue) parts.push(`<span class="tag bad">기한 지남 ${p.overdue}건</span>`); if (p.open && p.unassigned) parts.push(`<span class="mute small">담당 미정 ${p.unassigned}건</span>`); return parts.length ? `<br>${parts.join(' ')}` : ''; };
  page('🎉', '행사', `${yearSel()} <span class="mute small">행사를 누르면 준비 업무·참가·결산을 볼 수 있습니다.</span>`, `${(() => { const nx = store.get().events.filter(e => (!did() || e.dept_id === did()) && e.status === 'planned' && e.end_date >= today()).sort((a, b) => a.start_date.localeCompare(b.start_date))[0]; if (!nx) return ''; const p = prog(nx); const ds = p.days > 0 ? 'D-' + p.days : p.days === 0 ? '오늘' : '진행 중'; return `<a class="nextev noprint" href="#event/${nx.id}"><span class="dd">${ds}</span><span class="sp"><b>${esc(nx.title)}</b><span>${esc(range(md(nx.start_date), md(nx.end_date)))} · ${esc(nx.type)}${p.open ? ` · 남은 업무 ${p.open}건` : ' · 준비 업무 완료'}${p.overdue ? ` · 기한 지남 ${p.overdue}건` : ''}</span></span><span class="go">준비 보기</span></a>`; })()}<div class="row noprint evbar"><button class="pri" data-act="newEvent">+ 새 행사</button><button class="ghost" data-act="pdfEvents">PDF에서 가져오기</button><button class="ghost" data-go="#guides">🧭 진행 가이드</button><button class="ghost" data-go="#season">🕯️ 대림절·성탄절</button><span class="sp"></span><span class="seg" role="group" aria-label="행사 거르기">${[['', '전체'], ['upcoming', '다가오는 행사'], ['check', '준비 확인 필요']].map(([v, l]) => `<button class="sm ${flt === v ? 'on' : ''}" data-evflt="${v}" aria-pressed="${flt === v}">${l}</button>`).join('')}</span><button class="sm" data-evview="${UI.evView === 'tl' ? 'list' : 'tl'}" aria-pressed="${UI.evView === 'tl'}">📊 타임라인 ${UI.evView === 'tl' ? '닫기' : '보기'}</button></div>${UI.evView === 'tl' ? '<section class="box ganttbox" aria-label="행사 타임라인"><div id="evgantt"></div></section>' : ''}
  <div class="tablewrap"><table class="t"><thead><tr><th>일정</th><th>행사</th><th class="hide-sm">부서</th><th class="num hide-sm">목표</th><th class="num hide-sm">신청</th><th class="num hide-sm">참석</th><th class="num hide-sm">지출</th><th>상태</th></tr></thead><tbody>${list.map(e => { const s = store.eventSummary(e.id); return `<tr class="link" data-open="event/${e.id}"><td>${esc(range(md(e.start_date), md(e.end_date)))}</td><td><a href="#event/${e.id}"><b>${esc(e.title)}</b></a><br><span class="mute small">${esc(e.type)}</span>${dtag(e)}</td><td class="hide-sm">${deptTag(e.dept_id)}</td><td class="num hide-sm">${e.target_count || '-'}</td><td class="num hide-sm">${s.registered}</td><td class="num hide-sm">${s.attended}</td><td class="num hide-sm">${won(s.expense)}</td><td>${e.status === 'done' ? '<span class="tag ok">완료</span>' : e.status === 'cancelled' ? '<span class="tag bad">취소</span>' : '<span class="tag">예정</span>'}</td></tr>`; }).join('') || `<tr><td colspan="8">${flt && all.length ? emptyState(flt === 'check' ? '준비 확인이 필요한 행사가 없어요' : '다가오는 행사가 없어요', '위의 ‘전체’를 눌러 모든 행사를 볼 수 있어요.', '<button class="sm" data-evflt="">전체 보기</button>') : emptyState(others > 0 ? '이 해에는 행사가 없어요' : '아직 행사가 없어요', others > 0 ? `다른 해에 행사가 ${others}개 있어요. 위에서 연도를 바꿔 보세요.` : '예: 여름성경학교, 수련회, 성탄 발표회. ‘새 행사’에서 <b>예시로 시작</b>을 고르면 준비 업무와 마감일이 자동으로 만들어져요.', '<button class="sm pri" data-act="newEvent">+ 새 행사</button>')}</td></tr>`}</tbody></table></div>`);
  if (UI.evView === 'tl') ganttChart(document.getElementById('evgantt'), list.map(e => ({ id: 'e' + e.id, name: e.title, start: e.start_date, end: e.end_date, cls: 'g-' + (e.status || 'planned'), note: ((store.dept(e.dept_id) || {}).name || '') + ' · ' + e.type })), { mode: 'Week' });
}
function vEvent(id) {
  const e = store.ev(id); if (!e) { page('🎉', '행사', '', '<div class="callout bad">행사를 찾을 수 없습니다.</div>'); return; }
  const s = store.eventSummary(id); const tasks = store.get().tasks.filter(t => t.event_id === id); const parts = store.participants(id).sort((a, b) => (a.person.class_name || '').localeCompare(b.person.class_name || '', 'ko')); const tx = store.transactions({ eventId: id });
  page('🎉', e.title, `${deptTag(e.dept_id)} ${esc(e.type)}`, `${(() => { const b = bannerFor(e.type, e.title, e.dept_id); return `<div class="banner${b.src ? ' has-img' : ''}" style="--bn1:${b.c1};--bn2:${b.c2}">${b.src ? `<img src="${b.src}" alt="">` : ''}<span class="em">${b.em}</span><div><b>${esc(e.title)}</b><span class="t">${esc(range(e.start_date, e.end_date))}</span></div></div>`; })()}<div class="row noprint"><button data-go="#events">◀ 목록</button><button data-act="editEvent" data-id="${id}">수정</button><button data-act="applyTpl" data-id="${id}">예시 준비 업무 추가</button><button data-act="notice" data-kind="event" data-id="${id}">안내 문구</button><select data-evstatus="${id}">${[['planned', '예정'], ['done', '완료'], ['cancelled', '취소']].map(([v, l]) => `<option value="${v}"${e.status === v ? ' selected' : ''}>${l}</option>`).join('')}</select><span class="sp"></span><button class="dng" data-act="delEvent" data-id="${id}">삭제</button></div>
  ${(() => { const p = store.eventProgress(id, today()); const ds = e.status !== 'planned' ? (e.status === 'done' ? '완료' : '취소') : p.days > 0 ? 'D-' + p.days : p.days === 0 ? '오늘' : (e.end_date >= today() ? '진행 중' : '끝남'); const over = e.expected_budget && s.expense > e.expected_budget;
    return `<div class="strip" role="group" aria-label="행사 요약"><div class="key"><div class="k">행사까지</div><div class="v">${ds}</div><div class="s">${esc(range(md(e.start_date), md(e.end_date)))}</div></div><div><div class="k">신청</div><div class="v">${s.registered}명</div><div class="s">목표 ${e.target_count ? e.target_count + '명' : '-'} · 참석 ${s.attended}명</div></div><div class="${p.overdue ? 'warn' : ''}"><div class="k">남은 준비 업무</div><div class="v">${p.open}건</div><div class="s">${p.overdue ? `<span class="tag bad">기한 지남 ${p.overdue}건</span>` : '기한 지난 업무 없음'}</div></div><div class="${over ? 'warn' : ''}"><div class="k">지출</div><div class="v">${won(s.expense)}</div><div class="s">예상 예산 ${won(e.expected_budget)}${over ? ' · 초과' : ''}</div></div></div>`; })()}
  ${(() => { const p = store.eventProgress(id, today()); if (e.status !== 'planned') return ''; if (!p.open) return `<div class="callout" style="margin-top:14px"><span>✅</span><div class="sp">남은 준비 업무가 없어요.${p.days < 0 ? ' 행사가 끝났다면 아래에서 참석과 결산을 확인하세요.' : ''}</div></div>`; const n = p.next; const dl = n.due ? (n.due < today() ? `<span class="tag bad">${md(n.due)} · 기한 지남</span>` : n.due === today() ? '<span class="tag warn">오늘 마감</span>' : `<span class="tag">${md(n.due)}</span>`) : '<span class="tag">기한 없음</span>'; return `<div class="callout ${p.overdue ? 'warn' : ''}" style="margin-top:14px"><span>👉</span><div class="sp"><b>다음 할 일</b> · ${esc(n.title)} ${dl}<br><span class="mute small">${p.days >= 0 ? (p.days === 0 ? '행사 당일' : `행사까지 D-${p.days}`) + ' · ' : ''}남은 업무 ${p.open}건${p.overdue ? ` · 기한 지남 ${p.overdue}건` : ''}${p.unassigned ? ` · 담당 미정 ${p.unassigned}건` : ''}</span></div><button class="sm" data-act="gotoTask" data-id="${n.id}">업무로 이동</button></div>`; })()}
  ${(() => { const past = e.status === 'planned' && e.end_date < today(); if (!past && !e.retro) return ''; const applied = parts.filter(p => p.status === 'applied').length; const st1 = applied === 0, st2 = !!e.settled, st3 = !!e.retro; const mk = (ok, t, body) => `<div class="todo"><span aria-hidden="true">${ok ? '✅' : '⬜'}</span><div class="sp"><b>${t}</b> <span class="tag ${ok ? 'ok' : ''}">${ok ? '완료' : '확인 필요'}</span><div class="mute small">${body}</div></div></div>`;
    const retro = e.retro ? `<div class="pad"><b>회고</b> <button class="sm ghost noprint" data-act="retro" data-id="${id}">수정</button><dl class="props"><dt>잘된 점</dt><dd>${esc(e.retro.good) || '-'}</dd><dt>바꿀 점</dt><dd>${esc(e.retro.change) || '-'}</dd><dt>다음 담당자가 언제 무엇부터</dt><dd>${esc(e.retro.next) || '-'}</dd></dl></div>` : '';
    return `<section class="box" style="margin-top:14px"><div class="cardh"><h3>${past ? '행사 마무리' : '회고'}</h3>${past ? '<span class="sub">끝난 행사를 정리하는 순서예요. 각 단계는 따로 확인할 수 있어요.</span>' : ''}</div><div class="cardb">${past ? mk(st1, '1. 참석 확정', st1 ? '신청 상태로 남은 사람이 없어요.' : `아래 ‘참가 현황’에서 신청 상태 ${applied}명을 참석 또는 취소로 바꿔 주세요.`) + mk(st2, '2. 결산 확인', `${tx.length}건의 거래가 연결돼 있어요. 영수증이 필요한 지출은 회계에서 연결하세요. <button class="sm noprint" data-act="settle" data-id="${id}" data-on="${st2 ? '0' : '1'}">${st2 ? '확인 취소' : '결산 확인했어요'}</button>`) + mk(st3, '3. 회고 작성', st3 ? '아래에 저장돼 있어요.' : `<button class="sm noprint" data-act="retro" data-id="${id}">회고 쓰기</button> 잘된 점 / 바꿀 점 / 다음 담당자가 언제 무엇부터 할지`) + (st1 && st2 && st3 ? `<div class="row noprint" style="margin:10px 12px"><button class="pri" data-act="finishEvent" data-id="${id}">행사 완료로 표시</button></div>` : '') : ''}${retro}</div></section>`; })()}
  <dl class="props" style="margin-top:14px"><dt>일정</dt><dd>${esc(range(e.start_date, e.end_date))}</dd><dt>장소</dt><dd>${esc(e.place) || '-'}</dd><dt>담당자</dt><dd>${esc(e.owner) || '-'}</dd><dt>목표 인원</dt><dd>${e.target_count || '-'}명</dd><dt>예상 예산</dt><dd>${won(e.expected_budget)}</dd>${e.note ? `<dt>메모</dt><dd>${esc(e.note)}</dd>` : ''}</dl>
  ${(() => { const mine = UI.evGuide && UI.evGuide.id === id; const gk = mine ? UI.evGuide.key : guideKeyFor(e); return `<h2>진행 가이드 <span class="mute small">이 행사를 어떻게 진행하면 좋을지 참고하세요</span></h2><details class="guide" ${mine ? 'open' : ''}><summary>${esc(GUIDES[gk].ico)} ${esc(GUIDES[gk].name)} 가이드 펼치기</summary>${guideHtml(gk, id)}</details>`; })()}
  <h2>준비 일정 타임라인 <button class="sm noprint" data-evtl="${id}" aria-pressed="${UI.evTl === id}">${UI.evTl === id ? '닫기' : '막대로 보기'}</button></h2>${UI.evTl === id ? '<section class="box ganttbox" aria-label="준비 일정 타임라인"><div id="tlgantt"></div><p class="mute small" style="margin:6px 10px">업무는 마감일 하루를 표시해요. 막대를 누르면 내용이 보여요.</p></section>' : ''}
  <h2>준비할 일 <button class="sm" data-act="newTask" data-id="${id}">+ 추가</button></h2>${tasks.map(k => `<div id="task-${k.id}" class="todo ${k.status === 'done' ? 'done' : ''}"><input type="checkbox" data-task="${k.id}" ${k.status === 'done' ? 'checked' : ''} aria-label="완료"><span class="tt sp">${esc(k.title)} <span class="mute small">${esc(k.assignee)}</span></span>${k.due ? `<span class="tag ${k.status !== 'done' && k.due < today() ? 'bad' : ''}">${md(k.due)}</span>` : ''}<button class="sm ghost" data-act="delTask" data-id="${k.id}" aria-label="삭제">✕</button></div>`).join('') || emptyState('준비 업무가 없어요', '‘+ 추가’로 직접 적거나, 위의 ‘예시 준비 업무 추가’로 이 행사에 맞는 예시를 불러오세요.', '')}
  <h2>준비물 <button class="sm" data-act="newSupply" data-id="${id}">+ 추가</button></h2>${store.supplies(id).map(x => `<div class="todo ${x.done ? 'done' : ''}"><input type="checkbox" data-supply="${x.id}" ${x.done ? 'checked' : ''} aria-label="준비 완료"><span class="tt sp">${esc(x.name)}</span><button class="sm ghost" data-act="delSupply" data-id="${x.id}" aria-label="삭제">✕</button></div>`).join('') || '<p class="mute small">준비물이 없어요. ‘+ 추가’로 적거나 행사 예시를 적용하면 채워져요.</p>'}
  <h2>참가 현황</h2><div class="cols3" style="margin-bottom:12px"><div class="card stat"><div class="v">${s.registered}<span class="mute small"> / 목표 ${e.target_count || '-'}</span></div><div class="l">신청 (취소 제외)</div></div><div class="card stat"><div class="v">${s.attended}</div><div class="l">실제 참석</div></div><div class="card stat"><div class="v">${s.first_time}</div><div class="l">처음 온 사람 · 취소 ${s.cancelled}</div></div></div>
  <div class="row noprint" style="margin-bottom:8px"><button data-act="addPart" data-id="${id}">+ 부서원 등록</button><button data-act="addNew" data-id="${id}">+ 처음 온 사람</button></div>
  <div class="tablewrap"><table class="t"><thead><tr><th>이름</th><th>반</th><th>구분</th><th>상태</th><th></th></tr></thead><tbody>${parts.map(p => `<tr><td>${esc(p.person.name)}${p.person.birth_year ? ` <span class="mute small">${p.person.birth_year}년생</span>` : ''}</td><td>${esc(p.person.class_name)}</td><td>${p.first_time ? '<span class="tag warn">처음</span>' : ''}</td><td><select data-pstat="${id}/${p.person_id}">${Object.entries(PST).map(([v, l]) => `<option value="${v}"${p.status === v ? ' selected' : ''}>${l}</option>`).join('')}</select></td><td><button class="sm ghost" data-act="delPart" data-id="${id}/${p.person_id}">제외</button></td></tr>`).join('') || '<tr><td colspan="5" class="mute">참가자를 등록하세요.</td></tr>'}</tbody></table></div>
  <h2>결산 <button class="sm" data-act="newTx" data-ev="${id}">+ 지출·수입</button></h2><div class="cols3" style="margin-bottom:12px"><div class="card stat"><div class="v">${won(s.expense)}</div><div class="l">지출 (예상 예산 ${won(e.expected_budget)})</div></div><div class="card stat"><div class="v">${won(s.budget_remaining)}</div><div class="l">예산 잔액 (예산−지출)</div></div><div class="card stat"><div class="v" style="color:${s.net < 0 ? 'var(--red)' : 'var(--green)'}">${won(s.net)}</div><div class="l">수입·지출 차액 (수입 ${won(s.income)})</div></div></div>${txTable(tx)}`);
  if (UI.evTl === id) ganttChart(document.getElementById('tlgantt'), [{ id: 'ev', name: e.title, start: e.start_date, end: e.end_date, cls: 'g-event', note: '행사 기간' }, ...tasks.filter(k => k.due).map(k => ({ id: 't' + k.id, name: k.title, start: k.due, end: k.due, cls: k.status === 'done' ? 'g-done' : (k.due < today() ? 'g-late' : 'g-task'), note: (k.status === 'done' ? '완료' : '미완료') + (k.assignee ? ' · ' + k.assignee : '') }))], { mode: 'Day' });
}

// ----- 예배 -----
// 반복 입력: 같은 내용을 여러 날짜에 한 번에 만든다(예배·일정 공통)
const REPEAT_FIELDS = [{ k: 'repeat', label: '반복', type: 'select', options: REPEAT_RULES, hint: '‘매주’를 고르면 위 날짜부터 ‘반복 종료일’까지 같은 요일마다 한 번에 만들어져요(최대 104회). 이미 같은 이름·날짜가 있으면 건너뛰어요.' }, { k: 'until', label: '반복 종료일', type: 'date', hint: '반복할 때만 입력하세요. 예: 올해 마지막 주일.' }];
function seriesToast() { const s = store.lastSeries(); toast(s.made > 1 ? `${s.made}개를 한 번에 만들었어요.${s.skipped ? ` (이미 있는 ${s.skipped}개는 건너뜀)` : ''}${s.capped ? ' (한 번에 만들 수 있는 최대 104회까지만 만들었어요)' : ''}` : '저장했습니다.'); }
// 날짜 칸 아래에 그 날짜의 교회력(절기·주차)을 자동으로 보여 준다
function churchHint(d) {
  const inp = d.querySelector('[name=date]'); if (!inp) return; const note = document.createElement('div'); note.className = 'tplnote'; inp.closest('label').after(note);
  const show = () => { note.hidden = !/^\d{4}-\d{2}-\d{2}$/.test(inp.value); if (!note.hidden) { const i = churchInfo(inp.value); note.innerHTML = `<span class="lcdot" style="background:${i.colorHex}"></span><b>${esc(churchLabel(inp.value))}</b> <span class="mute">(교회력 자동 계산 · 전례 색 ${esc(i.color)})</span>`; } };
  inp.addEventListener('input', show); inp.addEventListener('change', show); show();
}
function serviceForm(v = {}) {
  const fields = [...(!v.id ? [{ k: 'tpl', label: '예배 순서 예시 (선택)', type: 'select', options: [['', '직접 입력'], ...Object.entries(SERVICE_TEMPLATES).map(([k, t]) => [k, t.name])], hint: '고르면 아래 ‘예배 순서’ 칸이 채워져요. 우리 교회에 맞게 고쳐 쓰세요.' }] : []),
    { k: 'dept_id', label: '부서', type: 'select', options: deptOpts() }, { k: 'title', label: '예배명', req: true, ph: '예: 어린이 주일예배' }, { k: 'kind', label: '구분', type: 'select', options: [['regular', '정기예배'], ['special', '특별예배']], hint: '출석부에는 정기예배만 나와요.' }, { k: 'date', label: '날짜', type: 'date', req: true }, { k: 'end', label: '끝나는 날 (여러 날이면)', type: 'date', hint: '시험 기간처럼 며칠 이어지면 적으세요. 행사가 겹치면 알려 줘요.' }, { k: 'time', label: '시간', type: 'time' }, { k: 'place', label: '장소' }, ...(!v.id ? REPEAT_FIELDS : []),
    { k: 'scripture', label: '성경 본문 (개역개정, 장·절)', ph: '예: 시편 23:1-6', hint: '직접 입력하는 칸이에요. 개역개정 본문을 확인하세요.' }, { k: 'sermon_title', label: '설교 제목' }, { k: 'leader', label: '담당자' }, { k: 'order_text', label: '예배 순서', type: 'textarea', ph: '줄마다 한 순서씩' }];
  form({ title: v.id ? '예배 수정' : '예배 추가', values: { dept_id: workDept(), date: today(), kind: 'regular', repeat: 'none', ...v }, fields,
    onOpen: d => { churchHint(d); const sel = d.querySelector('[name=tpl]'); if (!sel) return; sel.onchange = () => { const t = SERVICE_TEMPLATES[sel.value]; if (!t) return; const o = d.querySelector('[name=order_text]'); if (!o.value.trim() || o.dataset.auto === '1') { o.value = t.order; o.dataset.auto = '1'; } if (sel.value === 'special') d.querySelector('[name=kind]').value = 'special'; }; },
    onSubmit: o => { const id = store.saveService({ ...v, ...o, dept_id: Number(o.dept_id) }); if (!v.id) { const ls = store.lastSeries(); seriesToast(); location.hash = ls.made > 1 ? '#services' : `#service/${id}`; }
      // 공과가 배치된 주일에 다른(특별) 예배를 넣으면: 바꾸지 않고 한 주씩 밀지 묻는다
      if (!v.id && o.kind === 'special') { const reg = store.services(Number(o.dept_id)).find(x => x.date === o.date && x.kind === 'regular' && x.lesson); if (reg) setTimeout(async () => { if (await ask(`${md(o.date)}에는 공과 ‘${lessonLabel(reg.lesson)}’가 배치돼 있어요.\n이 주는 공과를 쉬고, 뒤의 공과를 한 주씩 밀까요? (‘취소’하면 그대로 둬요)`, '한 주씩 밀기')) { const r = store.shiftLesson(reg.id); toast(`공과 ${r.moved}개를 한 주씩 밀었어요. 마지막 공과는 ${md(r.until)}에 들어갔어요.`); render(); } }, 300); } } });
}
function vServices() {
  const list = store.services(did()).filter(s => s.date.startsWith(String(UI.year)));
  const others = store.services(did()).length - list.length;
  const att = list.filter(s => s.kind === 'regular').map(s => ({ date: s.date, c: store.attendanceCount(s.id) })).filter(x => x.c.recorded).reduce((m, x) => { m.set(x.date, (m.get(x.date) || 0) + x.c.present); return m; }, new Map()); // 같은 날 예배가 여러 개(부서 전체 보기)면 합계로 그린다
  const attPts = [...att].map(([date, value]) => ({ date, value })).sort((a, b) => a.date.localeCompare(b.date)).slice(-12);
  const nextSv = store.services(did()).filter(s => s.date >= today()).sort((a, b) => a.date.localeCompare(b.date) || String(a.time).localeCompare(String(b.time)))[0];
  const nextSvHtml = nextSv ? (() => { const ci = churchInfo(nextSv.date); const n = Math.round((Date.parse(nextSv.date + 'T00:00:00Z') - Date.parse(today() + 'T00:00:00Z')) / 864e5); const miss = [!nextSv.scripture ? '성경 본문' : '', !nextSv.sermon_title ? '설교 제목' : '', !String(nextSv.order_text || '').trim() ? '순서' : ''].filter(Boolean);
    return `<a class="nextsv noprint" href="#service/${nextSv.id}" style="--lc:${LITU_HEX[ci.color] || '#3f9d5f'}"><span class="dd">${n === 0 ? '오늘' : 'D-' + n}</span><span class="sp"><b>${esc(nextSv.title)}</b><span>${esc(md(nextSv.date))} ${esc(nextSv.time || '')} · ${esc(churchLabel(nextSv.date))}${nextSv.sermon_title ? ' · ' + esc(nextSv.sermon_title) : ''}</span>${miss.length ? `<span class="miss">비어 있는 항목: ${miss.join(', ')}</span>` : ''}</span><span class="go">예배 열기</span></a>`; })() : '';
  page('⛪', '예배', `${yearSel()}`, `${nextSvHtml}<div class="row noprint" style="margin-bottom:12px"><button class="pri" data-act="newService">+ 새 예배</button><button data-go="#curricula">📚 교재·공과 연간 배치</button><button class="ghost" data-act="pdfServices">PDF에서 가져오기</button></div>${attPts.length >= 2 ? '<section class="box" style="margin-bottom:16px"><div class="cardh"><h3>출석 추이</h3><span class="sub">출석을 기록한 정기예배 최근 ' + attPts.length + '회' + (UI.dept === 'all' ? ' · 같은 날 예배는 합계' : '') + '</span></div><div class="cardb"><div id="attchart"></div><details class="noprint" style="margin-top:8px"><summary class="small">표로 보기</summary><table class="t"><thead><tr><th>날짜</th><th class="num">출석(명)</th></tr></thead><tbody>' + attPts.map(p => '<tr><td>' + md(p.date) + '</td><td class="num">' + p.value + '</td></tr>').join('') + '</tbody></table></details></div></section>' : ''}<div class="tablewrap"><table class="t"><thead><tr><th>날짜</th><th>예배</th><th>교회력</th><th>부서</th><th>설교 제목</th><th class="hide-sm">공과</th><th class="num">출석</th></tr></thead><tbody>${list.map(s => { const c = store.attendanceCount(s.id); return `<tr class="link" data-open="service/${s.id}"><td>${md(s.date)} <span class="mute small">${esc(s.time)}</span></td><td><b>${esc(s.title)}</b> ${s.kind === 'special' ? '<span class="tag warn">특별</span>' : ''}</td><td><span class="lcdot" style="background:${churchInfo(s.date).colorHex}"></span>${esc(churchLabel(s.date))}</td><td>${deptTag(s.dept_id)}</td><td>${esc(s.sermon_title)}</td><td class="hide-sm small">${s.lesson ? esc(lessonLabel(s.lesson)) : s.lesson_hold ? '<span class="tag warn">공과 쉼</span>' : ''}</td><td class="num">${c.recorded ? c.present + '명' : '<span class="mute">미기록</span>'}</td></tr>`; }).join('') || `<tr><td colspan="7">${emptyState(others > 0 ? '이 해에는 예배가 없어요' : '아직 예배가 없어요', others > 0 ? `다른 해에 예배가 ${others}개 있어요. 위에서 연도를 바꿔 보세요.` : '예배를 만들고 눌러서 출석을 체크해요. ‘예시로 시작’을 고르면 예배 순서가 채워지고, ‘반복’을 매주로 하면 한 해 주일예배를 한 번에 만들 수 있어요.', '<button class="sm pri" data-act="newService">+ 예배 만들기</button>')}</td></tr>`}</tbody></table></div>`);
  if (attPts.length >= 2) lineChart(document.getElementById('attchart'), attPts, { label: '출석', color: getComputedStyle(document.body).getPropertyValue('--primary').trim() || '#2f7d4f' });
}
const AT = { cls: '' };
function vService(id) {
  const s = store.service(id); if (!s) { page('⛪', '예배', '', '<div class="callout bad">예배를 찾을 수 없습니다.</div>'); return; }
  const people = store.people({ deptId: s.dept_id }); const classes = [...new Set(people.map(p => p.class_name).filter(Boolean))]; const att = new Map(store.get().attendance.filter(a => a.service_id === id).map(a => [a.person_id, a.present]));
  const shown = people.filter(p => !AT.cls || p.class_name === AT.cls); const c = store.attendanceCount(id);
  page('⛪', s.title, `${deptTag(s.dept_id)} ${md(s.date)} ${esc(s.time)} ${esc(s.place)} · ${esc(churchLabel(s.date))}`, `<div class="row noprint"><button data-go="#services">◀ 목록</button><button data-act="editService" data-id="${id}">수정</button><button data-act="cloneService" data-id="${id}">다음 예배로 복제</button>${store.seriesCount('service', id) > 1 ? `<button data-act="delSeries" data-kind="service" data-id="${id}">이 날짜부터 반복 ${store.seriesCount('service', id)}개 삭제</button>` : ''}<button data-act="print">인쇄</button><button data-act="notice" data-kind="service" data-id="${id}">안내 문구</button><span class="sp"></span><button class="dng" data-act="delService" data-id="${id}">삭제</button></div>
  <section class="svhero" style="--lc:${LITU_HEX[churchInfo(s.date).color] || '#3f9d5f'}"><div class="lc"><span class="lcdot" style="background:var(--lc)"></span>${esc(churchLabel(s.date))} <span class="mute small">(자동 계산 · 전례 색 ${esc(churchInfo(s.date).color)})</span></div><div class="sv-main"><div><div class="k">성경 본문</div><div class="v">${esc(s.scripture) || '<span class="mute">미정</span>'}</div></div><div><div class="k">설교 제목</div><div class="v">${esc(s.sermon_title) || '<span class="mute">미정</span>'}</div></div></div></section>
  ${lessonBlock(s)}
  ${growthBlock(s)}
  <dl class="props" style="margin-top:14px"><dt>담당</dt><dd>${esc(s.leader) || '-'}</dd><dt>순서</dt><dd style="white-space:pre-wrap">${esc(s.order_text) || '-'}</dd></dl>
  <h2>출석 체크 <span class="tag ok">출석 ${c.present}명</span> <span class="tag">기록 ${c.recorded}명</span></h2><p class="mute small noprint">이름을 누르면 바로 저장됩니다. 같은 회차에서 한 사람은 한 번만 집계되고, 복제한 예배의 출석은 비어 있습니다.</p>
  <div class="row noprint" style="margin-bottom:10px"><span class="seg" role="group" aria-label="반 거르기"><button class="sm ${!AT.cls ? 'on' : ''}" data-cls="" aria-pressed="${!AT.cls}">전체</button>${classes.map(x => `<button class="sm ${AT.cls === x ? 'on' : ''}" data-cls="${esc(x)}" aria-pressed="${AT.cls === x}">${esc(x)}</button>`).join('')}</span><span class="sp"></span><button data-act="allPresent" data-id="${id}">보이는 인원 전원 출석</button><button data-act="newPersonHere" data-id="${id}">+ 새 사람</button></div>
  <div class="att-list">${shown.map(p => `<label class="att-row ${att.get(p.id) ? 'on' : ''}"><span class="who"><span class="avatar dk-${dk(s.dept_id)}">${esc(p.name.slice(0, 1))}</span><span style="min-width:0"><b>${esc(p.display)}</b><span class="mute small">${esc(p.class_name)}${p.kind === 'teacher' ? ' · 교사' : ''}</span></span></span><span class="chk"><input type="checkbox" data-att="${id}/${p.id}" ${att.get(p.id) ? 'checked' : ''} aria-label="${esc(p.name)} 출석"><i><span class="y">✓ 출석</span><span class="n">출석 체크</span></i></span></label>`).join('') || emptyState('명단이 없어요', '인원·출석에서 이 부서의 인원을 먼저 등록하세요.', '<button class="sm pri" data-go="#people">인원 등록하러 가기</button>')}</div>`);
}

// ----- 부서 사역(MB12): 주간 체크·달란트, 가정 안내문, 시험 기간, 새가족 정착, 장기 부재 -----
function growthBlock(s) {
  const checks = store.checks(s.dept_id); if (!checks.length) return '';
  const people = store.people({ deptId: s.dept_id }).filter(p => !AT.cls || p.class_name === AT.cls); if (!people.length) return '';
  const g = store.growthOf(s.id); const pts = checks.some(c => c.points);
  return `<h2>주간 체크 <span class="mute small">${checks.map(c => esc(c.label) + (c.points ? ` ${c.points}점` : '')).join(' · ')}</span> <button class="sm noprint" data-go="#ministry">항목·합계 보기</button></h2>
  <div class="tablewrap"><table class="t growth"><thead><tr><th>이름 (반)</th>${checks.map(c => `<th class="c">${esc(c.label)}</th>`).join('')}${pts ? '<th class="num">이번 주</th>' : ''}</tr></thead><tbody>${people.map(p => { const items = g.get(p.id) || []; const sum = checks.filter(c => items.includes(c.key)).reduce((a, c) => a + c.points, 0);
    return `<tr><td><b>${esc(p.display)}</b> <span class="mute small">${esc(p.class_name)}</span></td>${checks.map(c => `<td class="c"><input type="checkbox" data-growth="${s.id}/${p.id}/${c.key}"${items.includes(c.key) ? ' checked' : ''} aria-label="${esc(p.name)} ${esc(c.label)}"></td>`).join('')}${pts ? `<td class="num">${sum ? sum + '점' : '-'}</td>` : ''}</tr>`; }).join('')}</tbody></table></div>`;
}
function homeNoteText(deptId) {
  const t = today(); const sv = store.services(deptId).filter(s => s.date >= t && s.kind === 'regular' && s.lesson).sort((a, b) => a.date.localeCompare(b.date))[0];
  if (!sv) return null; const l = sv.lesson; const has = k => l.pick.includes(k) && l[k];
  return [`[${(store.dept(deptId) || {}).name} 가정 안내] ${md(sv.date)} ${churchLabel(sv.date)}`, '', `이번 주에 함께 배울 말씀이에요.`, has('title') ? `· 공과: ${l.title}` : '', has('scripture') ? `· 성경 본문: ${l.scripture}` : '', has('memory') ? `· 암송 말씀: ${l.memory}` : '', has('activity') ? `· 활동: ${l.activity}` : '', has('supplies') ? `· 준비물: ${l.supplies}` : '', '', '가정에서 이렇게 함께해 주세요.', '· 위 본문을 아이와 함께 소리 내어 읽어 주세요.', l.memory ? '· 암송 말씀을 하루 한 번 같이 말해 보세요.' : '· 오늘 배운 이야기를 아이에게 들려 달라고 해 주세요.', '· 이번 주 기도 제목을 하나씩 나누고 함께 기도해 주세요.', '', '(본문은 개역개정 성경으로 확인해 주세요)'].filter((x, i, a) => x !== '' || a[i - 1] !== '').join('\n');
}
function vMinistry() {
  const d = workDept(); const kind = dk(d); const t = today(); const y = t.slice(0, 4); const T = store.growthTotals(d, `${y}-01-01`, `${y}-12-31`); const pts = T.checks.some(c => c.points);
  const deptTabs = `<div class="tabs">${store.depts().map(x => `<a data-dept="${x.id}" class="${x.id === d ? 'on' : ''}">${esc(x.name)}</a>`).join('')}</div>`;
  const checkSec = `<section class="box" style="margin-bottom:16px"><div class="cardh"><h3>주간 체크${pts ? '·달란트' : ''}</h3><span class="sub">${y}년 · 예배 ${T.services}회</span><span class="sp"></span><button class="sm" data-act="editChecks" data-id="${d}">체크 항목 설정</button></div><div class="cardb">
    ${T.checks.length ? `<div class="tablewrap" style="border:0"><table class="t"><thead><tr><th>이름 (반)</th>${T.checks.map(c => `<th class="num">${esc(c.label)}</th>`).join('')}${pts ? '<th class="num">달란트</th>' : ''}</tr></thead><tbody>${T.rows.map(r => `<tr><td><b>${esc(r.person.name)}</b> <span class="mute small">${esc(r.person.class_name || '')}</span></td>${T.checks.map(c => `<td class="num">${r.counts[c.key] || '-'}</td>`).join('')}${pts ? `<td class="num"><b>${r.points}</b></td>` : ''}</tr>`).join('') || `<tr><td colspan="${T.checks.length + 2}" class="mute">명단을 먼저 등록하세요.</td></tr>`}</tbody></table></div>` : '<p class="mute small">체크 항목이 없어요. ‘체크 항목 설정’에서 추가하세요.</p>'}
    <p class="mute small" style="margin:8px 12px">체크는 예배 화면의 ‘주간 체크’에서 사람마다 해요. 이름(반) 순서로 보여 주고 순위는 매기지 않아요.${pts ? ' 달란트 잔치 때 이 합계를 쓰세요.' : ''}</p></div></section>`;
  const nc = store.newcomers(d, t); const ncSec = `<section class="box" style="margin-bottom:16px"><div class="cardh"><h3>${kind === 'youth' ? '새가족 정착' : '새친구 정착'}</h3><span class="tag">${nc.length}</span><span class="sp"></span><button class="sm pri" data-act="ncStart" data-id="${d}">+ ${kind === 'youth' ? '새가족' : '새친구'} 등록</button></div><div class="cardb">
    ${nc.length ? `<div class="tablewrap" style="border:0"><table class="t"><thead><tr><th>이름</th><th>등록</th>${NEWCOMER_STEPS.map(([, l]) => `<th class="c">${l}</th>`).join('')}<th></th></tr></thead><tbody>${nc.map(n => `<tr><td><b>${esc(n.person.name)}</b></td><td>${md(n.person.newcomer.reg)} <span class="mute small">${n.days}일째</span></td>${NEWCOMER_STEPS.map(([k]) => `<td class="c"><input type="checkbox" data-ncstep="${n.person.id}/${k}"${n.person.newcomer.steps[k] ? ' checked' : ''} aria-label="${esc(n.person.name)} ${k}">${n.person.newcomer.steps[k] ? `<br><span class="mute small">${md(n.person.newcomer.steps[k])}</span>` : ''}</td>`).join('')}<td><button class="sm" data-act="ncEnd" data-id="${n.person.id}">정착 완료</button></td></tr>`).join('')}</tbody></table></div>` : emptyState('정착 중인 사람이 없어요', '처음 온 사람을 등록하면 환영 연락 → 새가족 교육 → 소그룹 → 봉사 순서로 챙길 수 있어요. 등록 후 1주가 지나도 다음 단계가 남아 있으면 홈 브리핑에 나와요.', '')}</div></section>`;
  const away = store.awayList(d, t); const awaySec = `<section class="box" style="margin-bottom:16px"><div class="cardh"><h3>장기 부재 (군 복무·유학 등)</h3><span class="tag">${away.length}</span><span class="sp"></span><button class="sm" data-act="goRosterAway">명단에서 등록</button></div><div class="cardb">
    ${away.length ? `<div class="tablewrap" style="border:0"><table class="t"><thead><tr><th>이름</th><th>사유</th><th>기간</th><th>마지막 연락</th><th>다음 연락</th><th></th></tr></thead><tbody>${away.map(a => `<tr><td><b>${esc(a.person.name)}</b></td><td>${esc(a.person.away.reason)}</td><td class="small">${md(a.person.away.start)} ~ ${a.person.away.until ? md(a.person.away.until) : '미정'}${a.back ? ' <span class="tag ok">곧 돌아옴</span>' : ''}</td><td>${a.last ? md(a.last) : '<span class="mute">없음</span>'}</td><td>${a.due ? `<span class="tag bad">${md(a.next)} · 연락할 때</span>` : md(a.next)}</td><td><button class="sm" data-act="personVisits" data-id="${a.person.id}">연락 기록</button> <button class="sm ghost" data-act="backPerson" data-id="${a.person.id}">돌아왔어요</button></td></tr>`).join('')}</tbody></table></div>` : emptyState('장기 부재 중인 사람이 없어요', '인원·출석 → 명단에서 ‘장기 부재’를 누르면 사유·기간·연락 주기를 정할 수 있어요. 출석부에서는 빠지고, 연락할 때가 되면 홈 브리핑에 나와요.', '')}
    <p class="mute small" style="margin:8px 12px">연락은 ‘연락 기록’(심방·돌봄)에 남기면 다음 연락일이 다시 계산돼요. 군 복무 중인 청년에게는 부모님과 함께 파송 기도를 하고, 정기적으로 안부·위문을 보내는 교회가 많아요.</p></div></section>`;
  const exams = store.examPeriods(d, `${y}-01-01`, `${Number(y) + 1}-12-31`); const examSec = `<section class="box" style="margin-bottom:16px"><div class="cardh"><h3>학교 시험 기간</h3><span class="tag">${exams.length}</span><span class="sp"></span><button class="sm pri" data-act="newExam" data-id="${d}">+ 시험 기간</button></div><div class="cardb">
    ${exams.length ? exams.map(x => { const clash = store.get().events.filter(e => e.dept_id === d && e.status === 'planned' && e.end_date >= x.date && e.start_date <= (x.end || x.date)); return `<div class="sched" data-open="schedule/${x.id}"><div class="datebox"><small>${dow(x.date)}</small><b>${Number(x.date.slice(8))}</b></div><div class="what"><b>${esc(x.title)}</b><span>${md(x.date)} ~ ${md(x.end || x.date)}${clash.length ? ` · 겹치는 행사: ${clash.map(e => esc(e.title)).join(', ')}` : ''}</span></div>${clash.length ? '<span class="tag bad">행사 겹침</span>' : ''}</div>`; }).join('') : emptyState('등록한 시험 기간이 없어요', '학교 중간·기말고사 기간을 넣어 두면 달력에 표시되고, 행사가 겹치면 저장할 때와 홈 브리핑에서 알려 줘요.', '')}</div></section>`;
  const homeSec = `<section class="box" style="margin-bottom:16px"><div class="cardh"><h3>가정 연계 안내문</h3><span class="sub">다가오는 주일 공과로 만들어요</span><span class="sp"></span><button class="sm pri" data-act="homeNote" data-id="${d}">안내문 만들기</button></div><div class="pad"><p class="mute small" style="margin:0">공과 제목·본문·암송 말씀과 가정에서 함께할 일을 복사해서 부모님께 보내요(이름·연락처는 넣지 않아요). 공과는 ‘예배 → 교재·공과 연간 배치’로 넣어요.</p></div></section>`;
  const order = { kid: [checkSec, homeSec, ncSec], teen: [checkSec, examSec, homeSec, ncSec, awaySec], youth: [checkSec, ncSec, awaySec] }[kind] || [checkSec, ncSec];
  page('🌱', '부서 사역', `${deptTag(d)} ${esc(DEPT_KINDS[kind] || '')}에 맞춘 도구예요. 부서를 바꾸려면 아래 탭을 누르세요.`, `${deptTabs}${order.join('')}
  <details class="guide"><summary>참고한 자료</summary><div class="guidebody small"><ul>
    <li>아동부 주간 체크·달란트·가정 미션: 히즈쇼 바이블랜드 교육계획안(말씀 암송, 달란트 잔치, 가정미션), <a href="https://www.awana.org/2014/09/06/12-ways-to-encourage-scripture-memory-and-earn-points/" target="_blank" rel="noopener noreferrer">Awana 암송 격려 방법</a>. 경쟁보다 격려가 되도록 순위는 보여 주지 않아요(<a href="https://christianitytoday.com/2017/09/no-child-left-behind-comes-to-awana" target="_blank" rel="noopener noreferrer">Christianity Today 기사</a> 참고).</li>
    <li>중고등부 큐티·소그룹 나눔·수련회: 히즈쇼 하이틴즈 교육계획안. 소그룹 리더 돌봄: <a href="https://thinkorange.com/blog/13-ways-to-prevent-sgl-burnout-in-your-student-ministry/" target="_blank" rel="noopener noreferrer">Orange</a>.</li>
    <li>새가족 정착 단계(환영 → 교육 → 소그룹 → 봉사): <a href="https://outreachmagazine.com/features/4626-guiding-guests-to-greater-involvement.html" target="_blank" rel="noopener noreferrer">Outreach Magazine</a>, <a href="https://www.ministry127.com/the-assimilation-process" target="_blank" rel="noopener noreferrer">Ministry127</a>.</li>
    <li>입대 청년 돌봄(파송 기도·정기 위문): <a href="https://www.christiantoday.co.kr/news/289740" target="_blank" rel="noopener noreferrer">크리스천투데이</a>. 군 생활 고충 상담은 국방헬프콜 1303(<a href="https://www.korea.kr/news/reporterView.do?newsId=148968598" target="_blank" rel="noopener noreferrer">정책브리핑</a>).</li>
  </ul></div></details>`);
}

// ----- 교재(공과): 교재 틀 → 주일예배에 한 과씩 연간 배치 -----
const lessonShown = l => LESSON_FIELDS.filter(([k]) => l.pick.includes(k) && l[k]);
function lessonBlock(s) {
  if (s.lesson_hold && !s.lesson) return `<section class="lessonbox hold"><div class="row"><b>📚 이번 주는 공과 쉼</b><span class="tag warn">한 주씩 밀림</span><span class="sp"></span><button class="sm noprint" data-act="lessonPull" data-id="${s.id}">공과 다시 넣기(뒤 공과 당기기)</button></div><p class="mute small" style="margin:6px 0 0">이 주일에 다른 예배가 들어와서, 이 주에 하려던 공과부터 한 주씩 뒤로 밀었어요.</p></section>`;
  if (!s.lesson) return s.kind === 'regular' ? `<section class="lessonbox empty noprint"><div class="row"><b>📚 공과</b><span class="mute small">배치된 공과가 없어요.</span><span class="sp"></span><button class="sm" data-act="lessonEdit" data-id="${s.id}">공과 직접 넣기</button><button class="sm" data-go="#curricula">교재 연간 배치</button></div></section>` : '';
  const l = s.lesson; const shown = lessonShown(l);
  return `<section class="lessonbox"><div class="row"><b>📚 ${esc(l.cname)}</b><span class="tag">${esc(lessonLabel(l).split(' · ')[0])}</span><span class="sp"></span><button class="sm noprint" data-act="lessonEdit" data-id="${s.id}">항목 고르기·수정</button><button class="sm noprint" data-act="lessonShift" data-id="${s.id}">이 주 쉬고 한 주씩 밀기</button><button class="sm ghost noprint" data-act="lessonClear" data-id="${s.id}">공과 빼기</button></div>
    <dl class="props lessonprops">${shown.map(([k, lab]) => `<dt>${lab}</dt><dd style="white-space:pre-wrap">${esc(l[k])}</dd>`).join('') || '<dt>공과</dt><dd class="mute">고른 항목에 적힌 내용이 없어요. ‘항목 고르기·수정’에서 적어 주세요.</dd>'}</dl></section>`;
}
function lessonEditor(id) {
  const s = store.service(id); if (!s) return; const l = s.lesson || { pick: ['title', 'scripture'], ...Object.fromEntries(LESSON_FIELDS.map(([k]) => [k, ''])) };
  const d = modal(`<form method="dialog" class="dlg"><h3>${md(s.date)} 공과 항목</h3><p class="mute small">이 주에 필요한 항목만 체크하세요. 체크한 항목만 예배 화면·목록·인쇄에 보여요. 내용도 이 주에 맞게 고칠 수 있어요(교재 원본은 바뀌지 않아요).</p>
    ${LESSON_FIELDS.map(([k, lab]) => `<div class="lessonfield"><label class="chk"><input type="checkbox" name="pick" value="${k}"${l.pick.includes(k) ? ' checked' : ''}> ${lab}</label>${k === 'activity' || k === 'supplies' || k === 'note' ? `<textarea name="${k}" rows="2" maxlength="200">${esc(l[k])}</textarea>` : `<input name="${k}" value="${esc(l[k])}" maxlength="160">`}</div>`).join('')}
    <div class="err"></div><div class="dlg-foot"><button type="button" data-x>취소</button><button class="pri">저장</button></div></form>`);
  $('[data-x]', d).onclick = () => d.close();
  $('form', d).onsubmit = e => { e.preventDefault(); const f = e.target; const v = Object.fromEntries(LESSON_FIELDS.map(([k]) => [k, f.elements[k].value])); const pick = [...f.querySelectorAll('[name=pick]:checked')].map(x => x.value);
    try { store.setServiceLesson(id, v, pick); d.close(); toast('공과 항목을 저장했어요.'); render(); } catch (err) { $('.err', d).textContent = err.message; } };
}
function curriculumForm(v = {}) {
  const isNew = !v.id;
  form({ title: isNew ? '새 교재 만들기' : '교재 정보 수정', values: { dept_id: v.dept_id ?? workDept(), preset: 'custom', years: v.years || '', perYear: '', ...v },
    intro: isNew ? '<p class="mute small">교재 ‘틀’을 고르면 몇 년 주기·과 수가 채워진 빈 교재가 만들어져요. 과 제목·본문은 가지고 있는 교재 목차를 보고 적거나 붙여 넣으세요(출판사 교재 내용은 저작권 때문에 앱에 넣어 두지 않았어요).</p>' : '',
    fields: [...(isNew ? [{ k: 'preset', label: '교재 틀', type: 'select', options: CURRICULUM_PRESETS.map(p => [p.key, p.name]) }] : []), { k: 'name', label: isNew ? '교재 이름 (비우면 틀 이름)' : '교재 이름', req: !isNew, ph: '예: 2027 유치부 공과' }, { k: 'dept_id', label: '부서', type: 'select', options: [[0, '모든 부서'], ...deptOpts()] },
      { k: 'years', label: '주기(년)', type: 'select', options: [['', isNew ? '틀에 맞춤' : String(v.years)], [1, '1년'], [2, '2년'], [3, '3년']], hint: '2~3년 교재도 배치할 때 ‘몇 년차’를 골라 한 해씩 끊어 쓸 수 있어요.' }, ...(isNew ? [{ k: 'perYear', label: '한 해 과 수 (비우면 틀에 맞춤)', type: 'number', hint: '교재 목차의 과 수에 맞춰 주세요. 예: 24, 26, 52' }] : [])],
    onOpen: d => { const sel = d.querySelector('[name=preset]'); if (!sel) return; const note = document.createElement('div'); note.className = 'tplnote'; sel.closest('label').after(note); const show = () => { const p = CURRICULUM_PRESETS.find(x => x.key === sel.value); note.innerHTML = `${esc(p.note)}<br><span class="mute">기본 ${p.years}년 · 한 해 ${p.perYear}과${p.source ? ` · <a href="${esc(p.source)}" target="_blank" rel="noopener noreferrer">출처</a>` : ''}</span>`; }; sel.onchange = show; show(); },
    onSubmit: o => { if (isNew) { const id = store.curriculumFromPreset(o.preset, { name: o.name.trim(), dept_id: Number(o.dept_id), years: Number(o.years) || 0, perYear: Number(o.perYear) || 0 }); toast('교재를 만들었어요. 과 제목·본문을 채워 주세요.'); location.hash = `#curriculum/${id}`; }
      else { store.saveCurriculum({ ...v, name: o.name, dept_id: Number(o.dept_id), years: Number(o.years) || v.years }); toast('저장했어요.'); render(); } } });
}
function applyForm(cid) {
  const c = store.curriculum(cid); if (!c) return; const t = today(); const y0 = Number(t.slice(5, 7)) >= 11 ? Number(t.slice(0, 4)) + 1 : Number(t.slice(0, 4)); const start = y0 > Number(t.slice(0, 4)) ? `${y0}-01-01` : t;
  form({ title: `‘${c.name}’ 연간 배치`, submit: '배치하기', values: { dept_id: c.dept_id || workDept(), year: 1, start, until: `${y0}-12-31`, pick: 'basic', create: 'yes', fill: 'yes', skip5: c.publisher === '히즈쇼' ? 'yes' : 'no' },
    intro: '<p class="mute small">고른 해의 과를 시작 주일부터 주일예배마다 한 과씩 넣어요. 그 주일에 <b>특별예배만</b> 있거나 ‘공과 쉼’으로 표시한 주일은 건너뛰고 다음 주로 밀어요. 이미 공과가 있던 주일은 새 공과로 바뀌어요.</p>',
    fields: [{ k: 'dept_id', label: '부서', type: 'select', options: deptOpts() }, { k: 'year', label: '몇 년차를 쓸까요', type: 'select', options: Array.from({ length: c.years }, (_, i) => [i + 1, `${i + 1}년차 (${c.lessons.filter(l => l.year === i + 1).length}과)`]), hint: c.years > 1 ? `${c.years}년 주기 교재예요. 올해 쓸 한 해만 골라 끊어 배치해요.` : '' },
      { k: 'start', label: '시작 (이 날짜 이후 첫 주일부터)', type: 'date', req: true }, { k: 'until', label: '마지막 날짜', type: 'date', req: true }, { k: 'pick', label: '주마다 넣을 항목', type: 'select', options: Object.entries(PICK_PRESETS).map(([k, p]) => [k, p.label]), hint: '배치한 뒤 예배마다 ‘항목 고르기’로 필요한 것만 다시 고를 수 있어요.' },
      { k: 'skip5', label: '매달 다섯째 주일', type: 'select', options: [['no', '공과 넣기'], ['yes', '비우기(복습·특별 프로그램)']], hint: '히즈쇼처럼 한 달 4과로 짠 교재는 ‘비우기’를 고르면 달과 호가 맞아요.' }, { k: 'create', label: '주일예배가 없는 주일', type: 'select', options: [['yes', '주일예배를 새로 만들어 넣기'], ['no', '건너뛰기(이미 있는 예배에만 넣기)']] }, { k: 'fill', label: '예배의 성경 본문·설교 제목 칸', type: 'select', options: [['yes', '비어 있으면 공과 본문·제목으로 채우기'], ['no', '그대로 두기']] }],
    onSubmit: o => { const r = store.applyCurriculum({ ...o, cid }); toast(`${r.assigned}주에 배치했어요${r.first ? ` (${md(r.first)}~${md(r.last)})` : ''}.${r.created ? ` 주일예배 ${r.created}개를 새로 만들었어요.` : ''}${r.special ? ` 특별예배 주일 ${r.special}번은 건너뛰었어요.` : ''}${r.fifth ? ` 다섯째 주일 ${r.fifth}번은 비웠어요.` : ''}${r.leftover ? ` 남은 과 ${r.leftover}개는 기간이 모자라 넣지 못했어요.` : ''}`); location.hash = '#curricula'; render(); } });
}
function vCurricula() {
  const list = store.curricula().filter(c => !did() || !c.dept_id || c.dept_id === did()); const t = today(); const d = workDept();
  const plan = store.lessonPlan(d, t, `${Number(t.slice(0, 4)) + 1}-12-31`).slice(0, 16);
  page('📚', '교재·공과', '교재 틀을 만들고 한 해 분량을 주일예배에 자동으로 배치해요.', `<div class="row noprint" style="margin-bottom:12px"><button data-go="#services">◀ 예배</button><button class="pri" data-act="newCurr">+ 새 교재</button><label class="btnlike">📂 교재 파일 가져오기<input type="file" accept=".json,application/json" data-currfile hidden></label></div>
  <div class="res-grid">${list.map(c => { const filled = c.lessons.filter(l => l.title).length; return `<div class="res-card"><a class="res-name" href="#curriculum/${c.id}">${esc(c.name)}</a><p class="res-host mute small">${esc(c.publisher || '직접 만든 교재')} · ${c.years}년 주기 · ${c.lessons.length}과 ${c.dept_id ? '· ' + esc((store.dept(c.dept_id) || {}).name || '') : ''}</p><p class="res-desc small">제목을 적은 과 ${filled}/${c.lessons.length}</p><div class="row"><button class="sm" data-go="#curriculum/${c.id}">과 편집</button><button class="sm pri" data-act="applyCurr" data-id="${c.id}">연간 배치</button></div></div>`; }).join('') || emptyState('아직 교재가 없어요', '‘+ 새 교재’에서 파이디온·히즈쇼·감리회·통합 공과 틀이나 직접 만들기를 고르세요. 과 제목·본문은 교재 목차를 보고 붙여 넣으면 돼요.', '<button class="sm pri" data-act="newCurr">+ 새 교재</button>')}</div>
  <h2>공과 배치 현황 <span class="mute small">${esc((store.dept(d) || {}).name || '')} · 오늘 이후</span></h2>
  <div class="tablewrap"><table class="t"><thead><tr><th>주일</th><th>예배</th><th>공과</th></tr></thead><tbody>${plan.map(s => `<tr class="link" data-open="service/${s.id}"><td>${md(s.date)}</td><td>${esc(s.title)}</td><td>${s.lesson ? `<b>${esc(lessonLabel(s.lesson))}</b> <span class="mute small">${esc(s.lesson.cname)}</span>` : '<span class="tag warn">공과 쉼</span>'}</td></tr>`).join('') || '<tr><td colspan="3" class="mute">아직 배치한 공과가 없어요.</td></tr>'}</tbody></table></div>
  <p class="mute small">출판사 교재의 과 제목·본문은 저작권이 있어 앱에 미리 넣어 두지 않았어요. 교재 틀의 주기·과 수는 공개 자료로 확인한 값이고, ‘확인 필요’로 적힌 값은 교재 목차를 보고 고쳐 주세요.</p>`);
}
function vCurriculum(id) {
  const c = store.curriculum(id); if (!c) { page('📚', '교재', '', '<div class="callout bad">교재를 찾을 수 없습니다.</div>'); return; }
  const yr = Math.min(UI.cYear || 1, c.years); const rows = c.lessons.filter(l => l.year === yr);
  const cell = (l, i, k, w) => `<td><input class="cell-in" data-lf="${i}" data-k="${k}" value="${esc(l[k])}" maxlength="${k === 'memory' || k === 'supplies' ? 160 : k === 'activity' ? 200 : 80}" style="min-width:${w}px" aria-label="${l.no}과 ${LESSON_FIELDS.find(f => f[0] === k)[1]}"></td>`;
  page('📚', c.name, `${esc(c.publisher || '직접 만든 교재')} · ${c.years}년 주기`, `<div class="row noprint" style="margin-bottom:12px"><button data-go="#curricula">◀ 교재 목록</button><button data-act="editCurr" data-id="${id}">정보 수정</button><button class="ghost" data-act="exportCurr" data-id="${id}">파일로 내보내기</button><button class="pri" data-act="applyCurr" data-id="${id}">연간 배치</button><span class="sp"></span><button class="dng" data-act="delCurr" data-id="${id}">교재 삭제</button></div>
  ${c.note ? `<div class="tplnote">${esc(c.note)}${c.source ? ` · <a href="${esc(c.source)}" target="_blank" rel="noopener noreferrer">출처</a>` : ''}</div>` : ''}
  ${c.years > 1 ? `<div class="tabs">${Array.from({ length: c.years }, (_, i) => `<a data-cyear="${i + 1}" class="${yr === i + 1 ? 'on' : ''}">${i + 1}년차 (${c.lessons.filter(l => l.year === i + 1).length}과)</a>`).join('')}</div>` : ''}
  <details class="guide noprint"><summary>📋 목차 붙여 넣기 (${yr}년차를 통째로 바꾸기)</summary><p class="mute small">한 줄에 한 과씩: <code>과 번호 | 공과 제목 | 성경 본문 | 암송 구절 | 활동 | 준비물</code>. 엑셀에서 복사하면 칸이 탭으로 나뉘어 그대로 붙여 넣을 수 있어요. 과 번호는 빼도 돼요.</p><textarea id="cpaste" rows="6" placeholder="1 | (공과 제목) | (본문 장·절) | (암송 구절)"></textarea><div class="row" style="margin-top:8px"><button class="pri" data-act="pasteCurr" data-id="${id}" data-year="${yr}">미리 보고 넣기</button></div></details>
  <div class="tablewrap" style="margin-top:12px"><table class="t lessons"><thead><tr><th style="width:56px">과</th><th>공과 제목</th><th>성경 본문</th><th>암송 구절</th><th>활동</th><th>준비물</th></tr></thead><tbody>${rows.map((l, i) => `<tr><td><input class="cell-in" type="number" min="1" max="200" data-lf="${i}" data-k="no" value="${l.no}" style="width:56px" aria-label="과 번호"></td>${cell(l, i, 'title', 180)}${cell(l, i, 'scripture', 120)}${cell(l, i, 'memory', 140)}${cell(l, i, 'activity', 140)}${cell(l, i, 'supplies', 120)}</tr>`).join('') || '<tr><td colspan="6" class="mute">이 해에 과가 없어요. ‘과 추가’나 ‘목차 붙여 넣기’를 쓰세요.</td></tr>'}</tbody></table></div>
  <div class="row noprint" style="margin-top:10px"><button class="pri" data-act="saveCurr" data-id="${id}" data-year="${yr}">${yr}년차 저장</button><button data-act="addLesson" data-id="${id}" data-year="${yr}">+ 과 추가</button><button class="ghost" data-act="delLesson" data-id="${id}" data-year="${yr}">마지막 과 빼기</button><span class="mute small">빈 과는 ‘${'1과'}’처럼 번호만 보여요.</span></div>`);
}

// ----- 일정(교사 기도회·회의 등. 예배·행사와 별도) -----
function scheduleForm(v = {}) {
  form({ title: v.id ? '일정 수정' : '일정 추가', values: { dept_id: workDept(), date: today(), type: '교사 기도회', repeat: 'none', ...v }, intro: '<p class="mute small">교사 기도회·회의처럼 예배·행사가 아닌 모임을 적어요. 주일예배는 ‘예배’ 메뉴에서 관리합니다.</p>',
    fields: [{ k: 'dept_id', label: '부서', type: 'select', options: deptOpts() }, { k: 'type', label: '구분', type: 'select', options: SCHEDULE_TYPES.map(x => [x, x]) }, { k: 'title', label: '일정 이름', req: true, ph: '예: 교사 기도회' }, { k: 'date', label: '날짜', type: 'date', req: true }, { k: 'time', label: '시간', type: 'time' }, { k: 'place', label: '장소' }, ...(!v.id ? REPEAT_FIELDS : []), { k: 'note', label: '메모', type: 'textarea' }],
    onOpen: d => { churchHint(d); const ty = d.querySelector('[name=type]'), ti = d.querySelector('[name=title]'); if (!v.id && ty && ti) { ti.value = ti.value || ty.value; ti.dataset.auto = '1'; ty.onchange = () => { if (ti.dataset.auto === '1') ti.value = ty.value; }; ti.oninput = () => { ti.dataset.auto = '0'; }; } },
    onSubmit: o => { store.saveSchedule({ ...v, ...o, dept_id: Number(o.dept_id) }); seriesToast(); } });
}
function vSchedule(id) {
  const s = store.schedule(id); if (!s) { page('🗓️', '일정', '', '<div class="callout bad">일정을 찾을 수 없습니다.</div>'); return; }
  const n = store.seriesCount('schedule', id);
  page(typeIco({ type: 'schedule', kind: s.type }), s.title, `${deptTag(s.dept_id)} ${esc(s.type)}`, `<div class="row noprint"><button data-go="#plan">◀ 달력</button><button data-act="editSchedule" data-id="${id}">수정</button>${n > 1 ? `<button data-act="delSeries" data-kind="schedule" data-id="${id}">이 날짜부터 반복 ${n}개 삭제</button>` : ''}<span class="sp"></span><button class="dng" data-act="delSchedule" data-id="${id}">삭제</button></div>
  <dl class="props" style="margin-top:14px"><dt>날짜</dt><dd>${md(s.date)} ${esc(s.time)}</dd><dt>교회력</dt><dd>${esc(churchLabel(s.date))}</dd><dt>장소</dt><dd>${esc(s.place) || '-'}</dd><dt>메모</dt><dd style="white-space:pre-wrap">${esc(s.note) || '-'}</dd></dl>`);
}
function vScheduleList(tabs) {
  const t = today(); const all = store.schedules(did()); const rows = [...all.filter(s => s.date < t).slice(-5), ...all.filter(s => s.date >= t)];
  page('🗓️', '일정·계획', '교사 기도회·회의 같은 모임을 등록해요. ‘반복’을 쓰면 여러 주를 한 번에 만들 수 있어요.', `${tabs}<div class="row noprint" style="margin-bottom:12px"><button class="pri" data-act="newSchedule">+ 새 일정</button><button data-act="pdfImport">PDF에서 가져오기</button></div><div class="tablewrap"><table class="t"><thead><tr><th>날짜</th><th>일정</th><th>구분</th><th>부서</th><th>장소</th></tr></thead><tbody>${rows.map(s => `<tr class="link${s.date < t ? ' former' : ''}" data-open="schedule/${s.id}"><td>${md(s.date)} <span class="mute small">${esc(s.time)}</span></td><td><b>${esc(s.title)}</b></td><td>${esc(s.type)}</td><td>${deptTag(s.dept_id)}</td><td>${esc(s.place)}</td></tr>`).join('') || `<tr><td colspan="5">${emptyState('등록된 일정이 없어요', '교사 기도회·교사 회의 같은 모임을 넣어 보세요. 매주 하는 모임은 ‘반복’을 매주로 하면 한 번에 만들어져요.', '<button class="sm pri" data-act="newSchedule">+ 일정 만들기</button>')}</td></tr>`}</tbody></table></div><p class="mute small">지난 일정은 최근 5개만 보여요.</p>`);
}

// ----- 인원·출석 -----
function vPeople() {
  const tabs = `<div class="tabs"><a data-pptab="att" class="${UI.peopleTab === 'att' ? 'on' : ''}">출석부</a><a data-pptab="roster" class="${UI.peopleTab === 'roster' ? 'on' : ''}">명단</a><a data-pptab="visit" class="${UI.peopleTab === 'visit' ? 'on' : ''}">심방·돌봄</a></div>`;
  if (UI.peopleTab === 'att') {
    const d = workDept(); const M = store.attendanceMatrix(d, { last: 8 });
    const recIdx = M.services.map((s, i) => i).filter(i => M.rows.some(r => r.cells[i] !== null && r.cells[i] !== undefined)); const lastI = recIdx[recIdx.length - 1];
    const avg = recIdx.length ? Math.round(recIdx.reduce((a, i) => a + (M.totals[i] || 0), 0) / recIdx.length * 10) / 10 : null; const lowN = M.rows.filter(r => !r.former && r.rate !== null && r.rate < 50).length; const memN = M.rows.filter(r => !r.former).length;
    const attStrip = recIdx.length ? `<div class="strip" role="group" aria-label="출석 요약"><div class="key"><div class="k">가장 최근 예배</div><div class="v">${M.totals[lastI]}명</div><div class="s">${md(M.services[lastI].date)} 출석</div></div><div><div class="k">평균 출석</div><div class="v">${avg}명</div><div class="s">기록한 ${recIdx.length}회 평균</div></div><div class="${lowN ? 'warn' : ''}"><div class="k">출석률 50% 미만</div><div class="v">${lowN}명</div><div class="s">${lowN ? '연락해 볼 사람을 확인하세요' : '해당 없음'}</div></div><div><div class="k">현재 명단</div><div class="v">${memN}명</div><div class="s">최근 ${M.services.length}회 기준</div></div></div>` : '';
    page('👥', '인원·출석', `${deptTag(d)} 최근 정기예배 ${M.services.length}회 · ○ 출석 · × 결석 · 빈칸 미기록 ${UI.dept === 'all' ? '<span class="mute small">(전체 보기에서는 첫 부서)</span>' : ''}`, `${tabs}${attStrip}<div class="row noprint" style="margin-bottom:10px"><button class="ghost" data-act="print">인쇄</button><button class="ghost" data-act="csvAtt">엑셀(CSV)로 내려받기</button></div><div class="tablewrap"><table class="t att"><thead><tr><th>이름 (반)</th>${M.services.map(s => `<th title="${esc(s.title)}" class="${s.date === today() ? 'cur' : ''}"><a data-open="service/${s.id}" style="cursor:pointer">${Number(s.date.slice(5, 7))}/${Number(s.date.slice(8))}<small>${dow(s.date)}</small></a></th>`).join('')}<th>출석</th><th>출석률</th></tr></thead><tbody>${M.rows.map(r => `<tr class="${[r.former ? 'former' : '', !r.former && r.rate !== null && r.rate < 50 ? 'low' : ''].filter(Boolean).join(' ')}"><td><div class="who"><span class="avatar sm dk-${dk(d)}">${esc(r.person.name.slice(0, 1))}</span><span><b>${esc(r.person.name)}</b>${r.person.birth_year && M.rows.filter(x => x.person.name === r.person.name).length > 1 ? ` <span class="mute small">${r.person.birth_year}년생</span>` : ''}<br><span class="mute small">${esc(r.person.class_name)}${r.former ? ' · 이전 부서원' : ''}</span></span></div></td>${r.cells.map(c => `<td class="${c === 1 ? 'p' : c === 0 ? 'a' : 'n'}"><span class="mk" title="${c === 1 ? '출석' : c === 0 ? '결석' : '미기록'}">${c === 1 ? '✓' : c === 0 ? '✕' : '·'}</span></td>`).join('')}<td><b>${r.present}</b></td><td class="rate ${r.rate !== null && r.rate < 50 ? 'lo' : ''}">${r.rate === null ? '-' : r.rate + '%'}${r.rate === null ? '' : barHtml(r.rate, 100)}</td></tr>`).join('') || `<tr><td colspan="${M.services.length + 3}">${emptyState('아직 출석 기록이 없어요', '먼저 ‘인원’을 등록하고, ‘예배’에서 정기예배를 만들어 출석을 체크하면 이 표에 최근 8회가 모여요.', '<button class="sm" data-act="newPerson">+ 인원 등록</button><button class="sm" data-go="#services">예배로 가기</button>')}</td></tr>`}</tbody><tfoot><tr><td>합계(출석 인원)</td>${M.totals.map(n => `<td class="c">${n}</td>`).join('')}<td colspan="2"></td></tr></tfoot></table></div><p class="mute small">출석률이 50% 미만이면 빨간색으로 표시됩니다. 보호자 연락처·알레르기 같은 민감 정보는 이 앱이 수집하지 않습니다.</p>`);
  } else {
    if (UI.peopleTab === 'visit') return vVisits(tabs);
    const st = UI.pstatus || 'active'; const list = store.people({ deptId: did(), status: st }); const sel = new Set([...UI.psel].filter(id => list.some(p => p.id === id))); UI.psel = sel;
    page('👥', '인원·출석', `${list.length}명`, `${tabs}<div class="row noprint" style="margin-bottom:10px"><button class="pri" data-act="newPerson">+ 인원 등록</button><button data-act="peopleImport">양식으로 한꺼번에 등록</button><select data-pstatus><option value="active"${st === 'active' ? ' selected' : ''}>현재 명단</option><option value="graduated"${st === 'graduated' ? ' selected' : ''}>졸업·이동</option><option value="inactive"${st === 'inactive' ? ' selected' : ''}>비활성</option><option value="away"${st === 'away' ? ' selected' : ''}>장기 부재</option><option value="all"${st === 'all' ? ' selected' : ''}>전체</option></select><span class="sp"></span><button class="ghost" data-act="csvRoster">엑셀(CSV)로 내려받기</button><button class="ghost" data-act="peopleTemplate">등록 양식 내려받기</button><button class="ghost" data-act="pdfPeople">PDF에서 가져오기</button></div>${sel.size ? `<div class="callout noprint" style="margin-bottom:10px"><span>☑️</span><div class="sp"><b>${sel.size}명 선택</b></div><button class="sm pri" data-act="bulkMove">부서·반 이동</button><button class="sm" data-act="bulkRetire">명단 제외</button><button class="sm" data-act="bulkClear">선택 해제</button></div>` : ''}<div class="tablewrap"><table class="t"><thead><tr><th style="width:34px"><input type="checkbox" data-pselall aria-label="전체 선택"${list.length && sel.size === list.length ? ' checked' : ''}></th><th>이름</th><th>구분</th><th>부서</th><th>반·조</th><th>상태</th><th></th></tr></thead><tbody>${list.map(p => `<tr class="${sel.has(p.id) ? 'picked' : ''}"><td><input type="checkbox" data-psel="${p.id}"${sel.has(p.id) ? ' checked' : ''} aria-label="${esc(p.name)} 선택"></td><td><b>${esc(p.display)}</b></td><td>${KIND[p.kind]}</td><td>${deptTag(p.dept_id)}</td><td>${esc(p.class_name)}</td><td>${p.status === 'active' ? '' : '<span class="tag">' + ({ graduated: '졸업·이동', inactive: '비활성', away: `장기 부재${p.away ? ' · ' + esc(p.away.reason) : ''}` }[p.status] || '') + '</span>'}</td><td><button class="sm" data-act="editPerson" data-id="${p.id}">수정</button> <button class="sm" data-act="movePerson" data-id="${p.id}">이동</button> <button class="sm" data-act="personVisits" data-id="${p.id}">심방</button> ${p.status === 'active' ? `<button class="sm" data-act="awayPerson" data-id="${p.id}">장기 부재</button> <button class="sm" data-act="retire" data-id="${p.id}">명단 제외</button>` : p.status === 'away' ? `<button class="sm" data-act="backPerson" data-id="${p.id}">돌아왔어요</button>` : `<button class="sm" data-act="reactivate" data-id="${p.id}">복귀</button>`}</td></tr>`).join('') || `<tr><td colspan="7">${emptyState('명단이 비어 있어요', '아동·청년·교사를 반(조)과 함께 등록하세요. 출생년도를 넣으면 같은 이름도 구분돼요. 연락처 같은 민감 정보는 입력하지 마세요.', '<button class="sm pri" data-act="newPerson">+ 인원 등록</button><button class="sm" data-act="peopleImport">양식으로 한꺼번에 등록</button>')}</td></tr>`}</tbody></table></div><p class="mute small">‘명단 제외’는 현재 명단에서만 빼며 과거 출석·행사 기록은 그대로 남습니다.</p>`);
  }
}

// ----- 회계 -----
function txTable(rows) {
  const inc = rows.filter(t => t.kind === 'income').reduce((a, t) => a + t.amount, 0), exp = rows.filter(t => t.kind === 'expense').reduce((a, t) => a + t.amount, 0);
  return `<div class="tablewrap"><table class="t"><thead><tr><th>날짜</th><th>구분</th><th>항목</th><th>적요</th><th>행사</th><th class="num">금액</th><th>영수증</th><th></th></tr></thead><tbody>${rows.map(t => `<tr><td>${md(t.date)}</td><td><span class="tag ${t.kind === 'income' ? 'in' : 'out'}">${t.kind === 'income' ? '수입' : '지출'}</span></td><td>${esc(t.category)}</td><td>${esc(t.memo)}</td><td class="mute small">${esc((store.ev(t.event_id) || {}).title || '')}</td><td class="num" style="color:${t.kind === 'income' ? 'var(--green)' : 'var(--ink)'}">${t.kind === 'income' ? '+' : '−'}${won(t.amount)}</td><td>${t.receipt ? `<button class="sm" data-act="viewReceipt" data-id="${t.id}">📎 보기</button>` : '<span class="mute small">-</span>'}</td><td><button class="sm" data-act="editTx" data-id="${t.id}">수정</button> <button class="sm ghost dng" data-act="voidTx" data-id="${t.id}">취소</button></td></tr>`).join('') || `<tr><td colspan="8">${emptyState('거래가 없어요', '지출이나 수입을 등록하면 여기와 예산 현황에 반영돼요. 행사와 관계있다면 ‘연결 행사’를 고르세요.', '<button class="sm pri" data-act="newTx">+ 지출 등록</button>')}</td></tr>`}</tbody><tfoot><tr><td colspan="5">합계 (수입 ${won(inc)} · 지출 ${won(exp)})</td><td class="num">${inc - exp < 0 ? '−' : '+'}${won(Math.abs(inc - exp))}</td><td></td><td></td></tr></tfoot></table></div>`;
}
function vMoney() {
  const ids = did() ? [did()] : store.depts().map(d => d.id); const sums = ids.map(i => ({ d: store.dept(i), s: store.deptSummary(i, UI.year) }));
  const tot = sums.reduce((a, { s }) => ({ b: a.b + s.budget, i: a.i + s.income, e: a.e + s.expense }), { b: 0, i: 0, e: 0 });
  const wd = workDept(); const mo = store.monthly(wd, UI.year); const month = UI.mmonth || '';
  page('💰', '회계', `${yearSel()} <span class="mute small">행사 지출은 부서 합계에 한 번만 포함됩니다.</span>`, `<div class="strip five" role="group" aria-label="회계 요약"><div><div class="k">예산</div><div class="v">${won(tot.b)}</div><div class="s">${UI.year}년 항목 합계</div></div><div><div class="k">지출</div><div class="v">${won(tot.e)}</div><div class="s">${tot.b ? `예산의 ${Math.round(tot.e / tot.b * 100)}% 사용` : '예산 없음'}</div>${tot.b ? `<div style="margin-top:6px">${barHtml(tot.e, tot.b)}</div>` : ''}</div><div class="key ${tot.b - tot.e < 0 ? 'warn' : ''}"><div class="k">예산 잔액</div><div class="v">${won(tot.b - tot.e)}</div><div class="s">예산 − 지출${tot.b - tot.e < 0 ? ' <span class="tag bad">초과</span>' : ''}</div></div><div><div class="k">수입</div><div class="v">${won(tot.i)}</div><div class="s">참가비·후원 등</div></div><div class="${tot.i - tot.e < 0 ? 'warn' : ''}"><div class="k">수입·지출 차액</div><div class="v" style="${tot.i - tot.e >= 0 ? 'color:var(--good)' : ''}">${won(tot.i - tot.e)}</div><div class="s">수입 − 지출 (예산 잔액과는 다른 값)</div></div></div>
  <h2>예산 대비 집행 <button class="sm noprint" data-act="editBudget">+ 예산 항목</button> <button class="sm ghost noprint" data-act="pdfBudget">PDF에서 가져오기</button></h2>${sums.map(({ d, s }) => `<h3 style="margin-top:14px">${deptTag(d.id)} <span class="mute small">행사 지출 ${won(s.event_expense)} · 행사 외 ${won(s.non_event_expense)}</span></h3><div class="tablewrap"><table class="t"><thead><tr><th>항목</th><th class="num">예산</th><th class="num">지출</th><th class="num">예산 잔액</th><th style="width:22%">집행률</th></tr></thead><tbody>${s.byCategory.map(c => `<tr><td>${esc(c.category)}</td><td class="num">${won(c.budget)}</td><td class="num">${won(c.spent)}</td><td class="num" style="color:${c.remaining < 0 ? 'var(--orange)' : 'inherit'};font-weight:600">${won(c.remaining)}</td><td><div class="row small" style="gap:6px;margin-bottom:4px"><b>${c.budget ? Math.round(c.spent / c.budget * 100) + '%' : '-'}</b>${c.remaining < 0 ? '<span class="tag bad">초과</span>' : ''}</div>${barHtml(c.spent, c.budget)}</td></tr>`).join('') || `<tr><td colspan="5">${emptyState('예산 항목이 없어요', `${UI.year}년 예산을 항목별로 넣으면 예산 잔액이 계산돼요. 예: ${BUDGET_SUGGESTIONS.slice(0, 4).join(' · ')}`, '<button class="sm pri" data-act="editBudget">+ 예산 항목 입력</button>')}</td></tr>`}</tbody><tfoot><tr><td>합계</td><td class="num">${won(s.budget)}</td><td class="num">${won(s.expense)}</td><td class="num">${won(s.budget_remaining)}</td><td>${barHtml(s.expense, s.budget)}</td></tr></tfoot></table></div>`).join('')}
  <h2>월별 수입·지출 <span class="mute small">${esc(store.dept(wd).name)}</span></h2><div class="tablewrap"><table class="t"><thead><tr><th>월</th><th class="num">수입</th><th class="num">지출</th><th class="num">차액</th></tr></thead><tbody>${mo.map(m => `<tr><td>${m.month}월</td><td class="num">${m.income ? won(m.income) : '-'}</td><td class="num">${m.expense ? won(m.expense) : '-'}</td><td class="num" style="color:${m.net < 0 ? 'var(--red)' : 'inherit'}">${m.income || m.expense ? won(m.net) : '-'}</td></tr>`).join('')}</tbody><tfoot><tr><td>합계</td><td class="num">${won(mo.reduce((a, m) => a + m.income, 0))}</td><td class="num">${won(mo.reduce((a, m) => a + m.expense, 0))}</td><td class="num">${won(mo.reduce((a, m) => a + m.net, 0))}</td></tr></tfoot></table></div>
  <h2>거래 내역</h2><div class="row noprint" style="margin-bottom:10px"><button class="pri" data-act="newTx">+ 지출·수입 등록</button><button data-go="#report">월 결산 보고서</button><button data-go="#annual">연말 보고서</button><select data-mmonth aria-label="월 선택"><option value="">전체 월</option>${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}"${String(month) === String(i + 1) ? ' selected' : ''}>${i + 1}월</option>`).join('')}</select><span class="sp"></span><button class="ghost" data-act="pdfTx">PDF에서 가져오기</button><button class="ghost" data-act="csvTx">엑셀(CSV)</button></div>${txTable(store.transactions({ deptId: did(), year: UI.year, month: month || undefined }))}`);
}
function txForm(v = {}) {
  const wd = Number(v.dept_id || workDept()); const evs = store.get().events.filter(e => e.dept_id === wd);
  const cats = [...new Set([...store.get().budgets.filter(b => b.dept_id === wd).map(b => b.category), ...BUDGET_SUGGESTIONS])];
  form({ title: v.id ? '거래 수정' : '지출·수입 등록', values: { kind: 'expense', date: today(), dept_id: wd, event_id: '', ...v, event_id: v.event_id || '' }, fields: [{ k: 'kind', label: '구분', type: 'select', options: [['expense', '지출'], ['income', '수입']] }, { k: 'dept_id', label: '부서', type: 'select', options: deptOpts() }, { k: 'date', label: '날짜', type: 'date', req: true }, { k: 'amount', label: '금액 (원, 정수)', type: 'number', req: true, ph: '예: 45000', hint: '쉼표 없이 숫자만. 0은 입력할 수 없어요.' }, { k: 'category', label: '항목', list: cats, hint: '예산 항목과 같은 이름으로 쓰면 예산 대비 집행에 잡혀요.' }, { k: 'event_id', label: '연결 행사 (선택)', type: 'select', options: [['', '(행사와 무관한 부서 지출)'], ...evs.map(e => [e.id, `${e.start_date} ${e.title}`])], hint: '연결하면 행사 결산에도 보이고, 부서 합계에는 한 번만 더해져요.' }, { k: 'memo', label: '적요', ph: '예: 간식 구입' }, ...(v.receipt ? [{ k: 'receipt_act', label: '현재 영수증 사진', type: 'select', options: [['keep', '그대로 두기'], ['remove', '삭제하기']] }] : []), { k: 'receipt_file', label: v.receipt ? '영수증 사진 바꾸기 (선택)' : '영수증 사진 (선택)', type: 'file', accept: 'image/*', capture: true, hint: `휴대폰에서는 바로 촬영할 수 있어요. 카드번호·주민등록번호·실명 같은 개인정보는 가리고 찍어 주세요. 사진은 올리기 전에 작게 줄이고 위치 정보 등은 지워요. ${RCP.account ? '사진은 내 계정의 서버에만 저장돼요.' : '로그인 전에는 이 브라우저에만 저장돼요.'} 사진은 백업 파일(JSON)에 들어가지 않으니, 종이 영수증도 보관하세요.` }],
    onSubmit: async o => {
      const rec = { ...o, dept_id: Number(o.dept_id), amount: o.amount === '' ? NaN : Number(o.amount), receipt: v.receipt && o.receipt_act !== 'remove' ? v.receipt : null }; delete rec.receipt_file; delete rec.receipt_act; let fresh = null;
      if (o.receipt_file) { fresh = await RCP.put(await compressImage(o.receipt_file)); rec.receipt = fresh; }
      try { if (v.id) store.updateTransaction(v.id, rec); else store.addTransaction(rec); } catch (e) { if (fresh) await RCP.remove(fresh); throw e; }
      if (v.receipt && rec.receipt !== v.receipt) RCP.remove(v.receipt); toast('저장했습니다.');
    } });
}

// ----- 심방·돌봄 기록 -----
const VISIT_HINT = '<p class="mute small">짧게 적어 주세요(300자). 질병·가정 사정 같은 민감한 내용, 연락처·주소는 적지 마세요. 교사·담당자가 다음 연락을 챙기기 위한 메모입니다.</p>';
function visitForm(v = {}) {
  const people = store.people({ deptId: did() });
  form({ title: v.id ? '기록 수정' : '심방·돌봄 기록', intro: VISIT_HINT, values: { date: today(), type: '심방', ...v },
    fields: [...(v.person_id ? [] : [{ k: 'person_id', label: '사람', type: 'select', options: people.map(p => [p.id, `${p.display} (${p.class_name || '-'})`]) }]), { k: 'date', label: '날짜', type: 'date', req: true }, { k: 'type', label: '방법', type: 'select', options: VISIT_TYPES.map(x => [x, x]) }, { k: 'note', label: '내용', type: 'textarea', ph: '예: 결석 안부 전화, 다음 주 출석 약속' }, { k: 'follow_up', label: '다음 연락 예정일 (선택)', type: 'date', hint: '정하면 이 날까지 ‘다음 연락’ 표시가 남아요.' }],
    onSubmit: o => { store.addVisit({ ...v, ...o }); toast('저장했습니다.'); } });
}
function visitRows(list, withName) {
  return list.map(v => `<tr><td>${md(v.date)}</td>${withName ? `<td><b>${esc(v.person ? v.person.name : '(삭제됨)')}</b><br><span class="mute small">${esc(v.person ? v.person.class_name : '')}</span></td>` : ''}<td>${esc(v.type)}</td><td style="white-space:pre-wrap">${esc(v.note)}${v.follow_up ? `<br><span class="tag ${v.follow_up < today() ? 'bad' : 'warn'}">다음 연락 ${md(v.follow_up)}</span>` : ''}</td><td class="noprint"><button class="sm" data-act="editVisit" data-id="${v.id}">수정</button> <button class="sm ghost dng" data-act="delVisit" data-id="${v.id}">삭제</button></td></tr>`).join('');
}
function vVisits(tabs) {
  const sum = store.visitSummary(did()).sort((a, b) => (b.days ?? 99999) - (a.days ?? 99999)); const recent = store.visits({ deptId: did() }).slice(0, 30);
  page('👥', '인원·출석', `심방·돌봄 기록 · 현재 명단 ${sum.length}명`, `${tabs}<div class="row noprint" style="margin-bottom:10px"><button class="pri" data-act="newVisit">+ 기록 추가</button><button class="ghost" data-act="csvVisits">엑셀(CSV)로 내려받기</button></div>${VISIT_HINT}
  <h2>오래 연락하지 못한 순서</h2><div class="tablewrap"><table class="t"><thead><tr><th>이름 (반)</th><th>마지막 기록</th><th>경과</th><th>다음 연락</th><th class="noprint"></th></tr></thead><tbody>${sum.map(r => `<tr><td><b>${esc(r.person.name)}</b> <span class="mute small">${esc(r.person.class_name)}</span></td><td>${r.last ? md(r.last) : '<span class="mute">기록 없음</span>'}</td><td>${r.days === null ? '<span class="tag warn">기록 없음</span>' : `<span class="tag ${r.days >= 60 ? 'warn' : ''}">${r.days}일 전</span>`}</td><td>${r.next ? md(r.next) : '-'}</td><td class="noprint"><button class="sm" data-act="personVisits" data-id="${r.person.id}">기록 보기</button></td></tr>`).join('') || `<tr><td colspan="5">${emptyState('명단이 비어 있어요', '인원을 먼저 등록하면 여기에서 심방·돌봄 기록을 챙길 수 있어요.', '<button class="sm pri" data-go="#people">명단으로 가기</button>')}</td></tr>`}</tbody></table></div>
  <h2>최근 기록</h2><div class="tablewrap"><table class="t"><thead><tr><th>날짜</th><th>이름</th><th>방법</th><th>내용</th><th class="noprint"></th></tr></thead><tbody>${visitRows(recent, true) || '<tr><td colspan="5" class="mute">아직 기록이 없어요. ‘+ 기록 추가’로 시작하세요.</td></tr>'}</tbody></table></div>`);
}

// ----- 비품 -----
function assetForm(v = {}) {
  form({ title: v.id ? '비품 수정' : '비품 추가', values: { dept_id: workDept(), category: ASSET_CATEGORIES[0], status: ASSET_STATUS[0], qty: 1, ...v },
    fields: [{ k: 'dept_id', label: '부서', type: 'select', options: deptOpts() }, { k: 'name', label: '품목 이름', req: true, ph: '예: 이동식 스피커' }, { k: 'category', label: '구분', type: 'select', options: ASSET_CATEGORIES.map(x => [x, x]) }, { k: 'place', label: '보관 장소', ph: '예: 교육관 창고' }, { k: 'qty', label: '수량', type: 'number' }, { k: 'status', label: '상태', type: 'select', options: ASSET_STATUS.map(x => [x, x]) }, { k: 'note', label: '메모', type: 'textarea', ph: '구입 시기, 관리 방법 등' }],
    onSubmit: o => { store.saveAsset({ ...v, ...o, dept_id: Number(o.dept_id) }); toast('저장했습니다.'); } });
}
function vAssets() {
  const all = store.assets(did()); const places = [...new Set(all.map(a => a.place).filter(Boolean))]; const f = UI.asset;
  const list = all.filter(a => (!f.place || a.place === f.place) && (!f.status || a.status === f.status));
  page('🧰', '비품', `교구·악기·기기 등 ${all.length}종 ${all.some(a => a.status === '수리 중') ? '· <span class="tag warn">수리 중 ' + all.filter(a => a.status === '수리 중').length + '건</span>' : ''}`, `<div class="row noprint" style="margin-bottom:12px"><button class="pri" data-act="newAsset">+ 비품 추가</button><button data-act="pdfAssets">PDF에서 가져오기</button><select data-afilter="place"><option value="">모든 장소</option>${places.map(p => `<option${f.place === p ? ' selected' : ''}>${esc(p)}</option>`).join('')}</select><select data-afilter="status"><option value="">모든 상태</option>${ASSET_STATUS.map(s => `<option${f.status === s ? ' selected' : ''}>${s}</option>`).join('')}</select><span class="sp"></span><button data-act="csvAssets">엑셀(CSV)로 내려받기</button><button data-act="print">인쇄</button></div>
  <div class="tablewrap"><table class="t"><thead><tr><th>품목</th><th>구분</th><th>장소</th><th class="num">수량</th><th>상태</th><th>부서</th><th class="num">수리</th></tr></thead><tbody>${list.map(a => `<tr class="link" data-open="asset/${a.id}"><td><b>${esc(a.name)}</b></td><td>${esc(a.category)}</td><td>${esc(a.place)}</td><td class="num">${a.qty}</td><td><span class="tag ${a.status === '수리 중' ? 'warn' : a.status === '폐기' ? '' : 'ok'}">${esc(a.status)}</span></td><td>${deptTag(a.dept_id)}</td><td class="num">${(a.repairs || []).length || '-'}</td></tr>`).join('') || `<tr><td colspan="7">${emptyState('등록된 비품이 없어요', '교구·악기·음향 장비·의자처럼 부서에서 쓰는 물품을 적어 두면 어디에 무엇이 있는지, 수리는 언제 했는지 한눈에 볼 수 있어요.', '<button class="sm pri" data-act="newAsset">+ 비품 추가</button>')}</td></tr>`}</tbody></table></div>`);
}
function vAsset(id) {
  const a = store.asset(id); if (!a) { page('🧰', '비품', '', '<div class="callout bad">비품을 찾을 수 없습니다.</div>'); return; }
  const rep = (a.repairs || []).slice().sort((x, y) => y.date.localeCompare(x.date)); const total = rep.reduce((s, r) => s + (r.cost || 0), 0);
  page('🧰', a.name, `${deptTag(a.dept_id)} ${esc(a.category)}`, `<div class="row noprint"><button data-go="#assets">◀ 목록</button><button data-act="editAsset" data-id="${id}">수정</button><span class="sp"></span><button class="dng" data-act="delAsset" data-id="${id}">삭제</button></div>
  <dl class="props" style="margin-top:14px"><dt>보관 장소</dt><dd>${esc(a.place) || '-'}</dd><dt>수량</dt><dd>${a.qty}</dd><dt>상태</dt><dd>${esc(a.status)}</dd>${a.note ? `<dt>메모</dt><dd style="white-space:pre-wrap">${esc(a.note)}</dd>` : ''}</dl>
  <h2>수리 내역 <button class="sm noprint" data-act="newRepair" data-id="${id}">+ 추가</button></h2><div class="tablewrap"><table class="t"><thead><tr><th>날짜</th><th>내용</th><th class="num">수리비</th><th class="noprint"></th></tr></thead><tbody>${rep.map(r => `<tr><td>${md(r.date)}</td><td>${esc(r.note)}</td><td class="num">${r.cost ? won(r.cost) : '-'}</td><td class="noprint"><button class="sm ghost dng" data-act="delRepair" data-id="${id}/${r.id}">삭제</button></td></tr>`).join('') || '<tr><td colspan="4" class="mute">수리 기록이 없어요.</td></tr>'}</tbody>${rep.length ? `<tfoot><tr><td colspan="2">합계</td><td class="num">${won(total)}</td><td class="noprint"></td></tr></tfoot>` : ''}</table></div><p class="mute small noprint">수리비를 회계에도 남기려면 회계에서 지출로 따로 등록하세요(이 화면의 수리비는 기록용이에요).</p>`);
}

// ----- 월 결산 보고서(인쇄용) -----
function vReport() {
  const [y, m] = UI.rep.month.split('-').map(Number); const R = store.monthlyReport(did(), y, m); const scope = did() ? store.dept(did()).name : `${allScope()} 전체`; const withRc = R.rows.filter(t => t.receipt);
  page('💰', `${y}년 ${m}월 결산 보고서`, esc(scope), `<div class="row noprint" style="margin-bottom:12px"><button data-go="#money">◀ 회계</button><input type="month" data-repmonth value="${UI.rep.month}" aria-label="결산 월"><label class="small"><input type="checkbox" data-repimg${UI.rep.rc ? ' checked' : ''}> 영수증 사진도 함께 인쇄</label><span class="sp"></span><button class="pri" data-act="print">인쇄</button></div>
  <div class="statrow"><div class="card sc"><div class="k">이달 수입</div><div class="v">${won(R.income)}</div></div><div class="card sc"><div class="k">이달 지출</div><div class="v">${won(R.expense)}</div></div><div class="card sc key"><div class="k">수입 − 지출</div><div class="v" style="${R.net < 0 ? 'color:var(--orange)' : ''}">${won(R.net)}</div></div><div class="card sc"><div class="k">${y}년 ${m}월까지 누계 지출</div><div class="v">${won(R.ytdExpense)}</div></div></div>
  ${R.receipts.without ? `<div class="callout warn" style="margin-bottom:14px"><span>🧾</span><div class="sp">영수증이 붙지 않은 지출이 <b>${R.receipts.without}건 (${won(R.receipts.withoutAmount)})</b> 있어요. 종이 영수증과 맞춰 보세요.</div></div>` : (R.rows.some(t => t.kind === 'expense') ? '<div class="callout" style="margin-bottom:14px"><span>✅</span><div class="sp">이달 지출은 모두 영수증이 붙어 있어요.</div></div>' : '')}
  <h2>예산 항목별 집행</h2><div class="tablewrap"><table class="t"><thead><tr><th>항목</th><th class="num">연 예산</th><th class="num">이달 지출</th><th class="num">누계 지출</th><th class="num">예산 잔액</th></tr></thead><tbody>${R.categories.map(c => `<tr><td>${esc(c.category)}</td><td class="num">${c.budget ? won(c.budget) : '-'}</td><td class="num">${c.month ? won(c.month) : '-'}</td><td class="num">${c.ytd ? won(c.ytd) : '-'}</td><td class="num" style="color:${c.budget && c.remaining < 0 ? 'var(--orange)' : 'inherit'}">${c.budget ? won(c.remaining) : '-'}</td></tr>`).join('') || '<tr><td colspan="5" class="mute">예산 항목과 지출이 없어요.</td></tr>'}</tbody></table></div>
  <h2>거래 내역</h2><div class="tablewrap"><table class="t"><thead><tr><th>날짜</th><th>구분</th><th>항목</th><th>적요</th><th class="num">금액</th><th>영수증</th></tr></thead><tbody>${R.rows.map(t => `<tr><td>${md(t.date)}</td><td>${t.kind === 'income' ? '수입' : '지출'}</td><td>${esc(t.category)}</td><td>${esc(t.memo)}</td><td class="num">${t.kind === 'income' ? '+' : '−'}${won(t.amount)}</td><td>${t.receipt ? '있음' : t.kind === 'expense' ? '<span class="tag warn">없음</span>' : '-'}</td></tr>`).join('') || '<tr><td colspan="6" class="mute">이달 거래가 없어요.</td></tr>'}</tbody><tfoot><tr><td colspan="4">합계 (수입 ${won(R.income)} · 지출 ${won(R.expense)})</td><td class="num">${R.net < 0 ? '−' : '+'}${won(Math.abs(R.net))}</td><td></td></tr></tfoot></table></div>
  <div class="sign"><div><span>작성</span></div><div><span>검토</span></div><div><span>승인</span></div></div>
  ${UI.rep.rc && withRc.length ? `<h2 class="pagebreak">영수증 첨부</h2><div class="rc-grid">${withRc.map(t => { const s = RCP.src(t.receipt); return `<figure>${s ? `<img src="${esc(s)}" alt="영수증">` : '<div class="mute small">사진 없음</div>'}<figcaption>${md(t.date)} · ${esc(t.memo || t.category)} · ${won(t.amount)}</figcaption></figure>`; }).join('')}</div>` : ''}
  <p class="mute small noprint">이 보고서는 입력한 거래로 자동 계산돼요. 인쇄 화면에서 ‘PDF로 저장’을 고르면 파일로 보관할 수 있어요.</p>`);
}

// ----- 연말 부서 보고서(인쇄용) -----
function vAnnual() {
  const d = workDept(); const y = UI.year; const R = store.annualReport(d, y, today()); const A = R.attendance, P = R.people, M = R.money;
  const pct = (a, b) => (b ? Math.round(a / b * 100) + '%' : '-'); const none = '<span class="mute">입력 안 함</span>';
  const evRows = R.events.map(({ e, s }) => `<tr><td>${esc(range(md(e.start_date), md(e.end_date)))}</td><td><b>${esc(e.title)}</b><br><span class="mute small">${esc(e.type)}</span></td><td>${e.status === 'done' ? '완료' : e.status === 'cancelled' ? '취소' : '예정'}</td><td class="num">${e.target_count || '-'}</td><td class="num">${s.registered}</td><td class="num">${s.attended}</td><td class="num">${won(s.expense)}<br><span class="mute small">예산 ${won(e.expected_budget)}</span></td></tr>`).join('');
  const retros = R.events.filter(({ e }) => e.retro && (e.retro.good || e.retro.change));
  const moRows = R.monthly.filter(m => m.income || m.expense);
  const themes = Object.entries(R.themes).filter(([, v]) => v).sort((a, b) => a[0] - b[0]);
  page('📑', `${y}년 ${R.dept.name} 연말 보고서`, `작성 기준일 ${md(R.asOf)}${R.partial ? ' · 아직 한 해가 끝나지 않아 지금까지의 기록만 담겨요' : ''}${UI.dept === 'all' ? ' <span class="mute small">(전체 보기에서는 첫 부서)</span>' : ''}`, `<div class="row noprint" style="margin-bottom:12px"><button data-go="#plan">◀ 일정·계획</button>${yearSel()}<span class="sp"></span><button class="pri" data-act="print">인쇄·PDF 저장</button></div>
  <div class="callout noprint" style="margin-bottom:16px"><span>📑</span><div class="sp">입력한 출석·행사·심방·회계 기록으로 자동으로 만든 보고서예요. <b>총평</b>과 <b>내년 사역 목표</b>만 직접 적으면 돼요. 제출 양식은 교회마다 다르니 필요한 부분만 골라 쓰세요.</div></div>
  <div class="strip" role="group" aria-label="한 해 요약"><div class="key"><div class="k">정기예배 평균 출석</div><div class="v">${A.avg === null ? '-' : A.avg + '명'}</div><div class="s">출석 기록 ${A.recorded}회 / 예배 ${A.held}회</div></div><div><div class="k">현재 명단</div><div class="v">${P.active}명</div><div class="s">올해 처음 출석 ${P.newcomers}명</div></div><div><div class="k">행사</div><div class="v">${R.events.length}건</div><div class="s">완료 ${R.events.filter(x => x.e.status === 'done').length} · 취소 ${R.events.filter(x => x.e.status === 'cancelled').length}</div></div><div class="${M.budget && M.expense > M.budget ? 'warn' : ''}"><div class="k">지출</div><div class="v">${won(M.expense)}</div><div class="s">예산 ${won(M.budget)} 중 ${pct(M.expense, M.budget)}</div></div></div>

  <h2>1. 사역 목표와 총평</h2>
  <dl class="props"><dt>올해 사역 목표</dt><dd style="white-space:pre-wrap">${esc(R.goal) || none}</dd></dl>
  <label class="f noprint" style="margin-top:12px">총평 (한 해를 돌아보며 감사한 일, 아쉬운 점, 함께 기도할 일)<textarea id="review" maxlength="3000" rows="5" placeholder="예: 새친구 초청 주일 이후 출석이 늘었습니다. 교사가 부족해 두 반을 합쳐 운영했습니다.">${esc(R.review)}</textarea></label>
  <div class="row noprint"><button data-act="saveReview">총평 저장</button></div>
  <div class="printonly"><p style="white-space:pre-wrap"><b>총평</b><br>${esc(R.review) || '(작성 안 함)'}</p></div>

  <h2>2. 예배와 출석</h2>
  <dl class="props"><dt>정기예배</dt><dd>${A.held}회 (출석 기록 ${A.recorded}회)</dd><dt>특별예배</dt><dd>${A.special}회</dd><dt>평균 출석</dt><dd>${A.avg === null ? '-' : A.avg + '명'} <span class="mute small">(출석을 기록한 예배만 계산)</span></dd><dt>가장 많이 온 주일</dt><dd>${A.top ? `${md(A.top.date)} · ${A.top.present}명` : '-'}</dd><dt>가장 적게 온 주일</dt><dd>${A.low ? `${md(A.low.date)} · ${A.low.present}명` : '-'}</dd></dl>
  <div class="tablewrap" style="margin-top:12px"><table class="t"><thead><tr><th>월</th>${A.months.map(m => `<th class="num">${m.month}월</th>`).join('')}</tr></thead><tbody><tr><td>평균 출석</td>${A.months.map(m => `<td class="num">${m.avg === null ? '-' : m.avg}</td>`).join('')}</tr><tr><td class="mute small">기록 회수</td>${A.months.map(m => `<td class="num mute small">${m.count || '-'}</td>`).join('')}</tr></tbody></table></div>

  <h2>3. 인원 현황 <span class="mute small">작성 기준일 현재</span></h2>
  <dl class="props"><dt>현재 명단</dt><dd>${P.active}명 (아동 ${P.child} · 청소년 ${P.teen} · 청년 ${P.youth} · 교사 ${P.teacher} · 봉사자 ${P.volunteer})</dd><dt>올해 처음 출석</dt><dd>${P.newcomers}명 <span class="mute small">(이 부서 예배에 처음 ‘출석’으로 기록된 날이 올해인 사람)</span></dd></dl>

  <h2>4. 행사</h2>
  <div class="tablewrap"><table class="t"><thead><tr><th>일정</th><th>행사</th><th>상태</th><th class="num">목표</th><th class="num">신청</th><th class="num">참석</th><th class="num">지출</th></tr></thead><tbody>${evRows || '<tr><td colspan="7" class="mute">올해 등록한 행사가 없어요.</td></tr>'}</tbody></table></div>
  ${retros.length ? `<h3 style="margin-top:16px">행사 회고</h3>${retros.map(({ e }) => `<dl class="props" style="margin-bottom:10px"><dt>행사</dt><dd><b>${esc(e.title)}</b></dd><dt>잘된 점</dt><dd style="white-space:pre-wrap">${esc(e.retro.good) || '-'}</dd><dt>바꿀 점</dt><dd style="white-space:pre-wrap">${esc(e.retro.change) || '-'}</dd></dl>`).join('')}` : ''}

  <h2>5. 심방·돌봄</h2>
  <dl class="props"><dt>기록</dt><dd>${R.visits.count}건 · ${R.visits.people}명</dd><dt>방법별</dt><dd>${Object.entries(R.visits.byType).map(([k, n]) => `${esc(k)} ${n}건`).join(' · ') || '-'}</dd></dl>

  <h2>6. 결산</h2>
  <dl class="props"><dt>예산</dt><dd>${won(M.budget)}</dd><dt>지출</dt><dd>${won(M.expense)} (예산의 ${pct(M.expense, M.budget)}) · 행사 지출 ${won(M.event_expense)} · 행사 외 ${won(M.non_event_expense)}</dd><dt>예산 잔액</dt><dd>${won(M.budget_remaining)}</dd><dt>수입</dt><dd>${won(M.income)}</dd><dt>수입 − 지출</dt><dd>${won(M.net)}</dd></dl>
  <div class="tablewrap" style="margin-top:12px"><table class="t"><thead><tr><th>예산 항목</th><th class="num">예산</th><th class="num">지출</th><th class="num">잔액</th><th class="num">집행률</th></tr></thead><tbody>${M.byCategory.map(c => `<tr><td>${esc(c.category)}</td><td class="num">${won(c.budget)}</td><td class="num">${won(c.spent)}</td><td class="num">${won(c.remaining)}</td><td class="num">${pct(c.spent, c.budget)}</td></tr>`).join('') || '<tr><td colspan="5" class="mute">예산 항목이 없어요.</td></tr>'}</tbody></table></div>
  ${moRows.length ? `<div class="tablewrap" style="margin-top:12px"><table class="t"><thead><tr><th>월</th><th class="num">수입</th><th class="num">지출</th><th class="num">차액</th></tr></thead><tbody>${moRows.map(m => `<tr><td>${m.month}월</td><td class="num">${won(m.income)}</td><td class="num">${won(m.expense)}</td><td class="num">${won(m.net)}</td></tr>`).join('')}</tbody></table></div>` : ''}
  ${themes.length ? `<h2>7. 월별 교육 주제</h2><div class="tablewrap"><table class="t"><tbody>${themes.map(([m, v]) => `<tr><td style="width:60px">${m}월</td><td>${esc(v)}</td></tr>`).join('')}</tbody></table></div>` : ''}

  <h2 class="pagebreak">${themes.length ? 8 : 7}. ${y + 1}년 계획 초안</h2>
  <p class="mute small">올해 기록으로 만든 <b>초안</b>이에요. 날짜·예산은 교회 일정과 재정 계획에 맞게 꼭 고쳐 쓰세요.</p>
  <label class="f noprint">${y + 1}년 사역 목표<textarea id="nextgoal" maxlength="1000" rows="3" placeholder="예: 말씀을 삶으로 살아내는 어린이">${esc(R.nextGoal)}</textarea></label>
  <div class="row noprint"><button data-act="saveNextGoal">${y + 1}년 목표 저장</button><span class="mute small">‘일정·계획 → 연간·절기 계획’의 ${y + 1}년 사역 목표에 저장돼요.</span></div>
  <div class="printonly"><p style="white-space:pre-wrap"><b>${y + 1}년 사역 목표</b><br>${esc(R.nextGoal) || '(작성 안 함)'}</p></div>
  <h3 style="margin-top:16px">행사 일정 초안 <span class="mute small">올해 날짜에서 52주 뒤 같은 요일</span></h3>
  <div class="tablewrap"><table class="t"><thead><tr><th>예상 날짜</th><th>행사</th><th>올해 회고에서 바꿀 점</th></tr></thead><tbody>${R.draft.events.map(x => `<tr><td>${md(x.date)}</td><td>${esc(x.title)} <span class="mute small">${esc(x.type)}</span></td><td class="small" style="white-space:pre-wrap">${esc(x.change) || '-'}</td></tr>`).join('') || '<tr><td colspan="3" class="mute">올해 행사가 없어요.</td></tr>'}</tbody></table></div>
  <h3 style="margin-top:16px">예산 초안 <span class="mute small">올해 예산과 실제 지출(만 원 단위 올림) 중 큰 값</span></h3>
  <div class="tablewrap"><table class="t"><thead><tr><th>항목</th><th class="num">${y}년 예산</th><th class="num">${y}년 지출</th><th class="num">${y + 1}년 제안</th></tr></thead><tbody>${R.draft.budget.map(c => `<tr><td>${esc(c.category)}</td><td class="num">${c.budget ? won(c.budget) : '-'}</td><td class="num">${c.spent ? won(c.spent) : '-'}</td><td class="num"><b>${won(c.suggest)}</b></td></tr>`).join('') || '<tr><td colspan="4" class="mute">예산·지출 기록이 없어요.</td></tr>'}</tbody><tfoot><tr><td>합계</td><td></td><td></td><td class="num">${won(R.draft.total)}</td></tr></tfoot></table></div>
  <div class="sign"><div><span>작성</span></div><div><span>검토</span></div><div><span>승인</span></div></div>
  <p class="mute small noprint">사용 전에 확인하세요: 출석·인원 숫자는 입력한 기록만 센 것이라 실제와 다를 수 있어요. 아이 이름이나 심방 내용은 보고서에 넣지 않았어요. 제출 전에 담당 교역자와 함께 확인하세요.</p>`);
}

// ----- 안내 문구(복사용) -----
function noticeModal(kind, id) {
  const lsv = k => lsGet('ms:' + k) || ''; let edited = false;
  const m = modal(`<div class="dlg"><h3>안내 문구 만들기</h3><p class="mute small">복사해서 단체 대화방이나 문자에 붙여넣으세요. 아이 이름·연락처 같은 개인정보는 넣지 않았고, 내용은 자유롭게 고칠 수 있어요.</p><div class="row"><label class="f" style="flex:1;min-width:140px">교회 이름 (선택)<input data-church value="${esc(lsv('church'))}"></label><label class="f" style="flex:1;min-width:140px">문의 연락처 (선택)<input data-contact value="${esc(lsv('contact'))}" placeholder="교사 연락처 등"></label></div><textarea data-text style="min-height:230px;width:100%"></textarea><div class="dlg-foot"><button data-c>닫기</button><button class="pri" data-copy>복사하기</button></div></div>`);
  const ta = $('[data-text]', m);
  const build = () => {
    const o = { church: $('[data-church]', m).value.trim(), contact: $('[data-contact]', m).value.trim() };
    if (kind === 'event') { const e = store.ev(id); return eventNotice(e, { ...o, dept: (store.dept(e.dept_id) || {}).name, supplies: store.supplies(id).map(x => x.name) }); }
    if (kind === 'service') { const s = store.service(id); return serviceNotice(s, { ...o, dept: (store.dept(s.dept_id) || {}).name, label: churchLabel(s.date) }); }
    const H = store.home(did()); return weekNotice(H.week.map(i => ({ date: i.date, time: i.time, title: i.title, place: i.type === 'event' ? ((store.ev(i.id) || {}).place || '') : i.type === 'service' ? ((store.service(i.id) || {}).place || '') : ((store.schedule(i.id) || {}).place || '') })), { ...o, dept: did() ? (store.dept(did()) || {}).name : '' });
  };
  ta.value = build(); ta.addEventListener('input', () => { edited = true; });
  for (const k of ['church', 'contact']) $(`[data-${k}]`, m).addEventListener('input', e => { lsSet('ms:' + k, e.target.value.trim()); if (!edited) ta.value = build(); });
  $('[data-c]', m).onclick = () => m.close();
  $('[data-copy]', m).onclick = async () => { try { await navigator.clipboard.writeText(ta.value); } catch { ta.select(); document.execCommand('copy'); } toast('복사했어요. 대화방에 붙여넣으세요.'); };
}

// ----- 자료실(부서별 추천 사이트) -----
// 기본 목록(public/js/resources.js)은 공식 기관·출판사 위주로 직접 열어 확인한 것이고, 내가 추가한 사이트는 이 계정에만 저장된다.
function linkForm(v = {}) {
  const cats = [...new Set([...RESOURCE_CATEGORIES, '내 사이트'])];
  form({ title: v.id ? '사이트 수정' : '내 사이트 추가', intro: '<p class="mute small">주소는 https://로 시작하는 전체 주소를 넣어 주세요. 로그인 정보나 개인정보가 들어간 주소는 넣지 마세요.</p>', values: { category: '내 사이트', ...v, dept_id: v.dept_id ? v.dept_id : '' },
    fields: [{ k: 'name', label: '사이트 이름', req: true }, { k: 'url', label: '주소', req: true, ph: 'https://' }, { k: 'category', label: '구분', type: 'select', options: cats.map(x => [x, x]) }, { k: 'dept_id', label: '보여 줄 부서', type: 'select', options: [['', '공통(모든 부서)'], ...deptOpts()] }, { k: 'note', label: '메모 (선택)', ph: '무엇에 쓰는 사이트인지' }],
    onSubmit: o => { store.saveLink({ ...v, ...o, dept_id: o.dept_id === '' ? 0 : Number(o.dept_id) }); toast('저장했습니다.'); } });
}
function vResources() {
  const dn = did() ? (store.dept(did()) || {}).name : null; const scope = dn || `${allScope()} 전체`;
  const builtin = RESOURCES.filter(r => !dn || r.audience === '공통' || r.audience === dn).map(r => ({ ...r, mineId: 0 }));
  const mine = store.links(did()).map(l => ({ name: l.name, url: l.url, category: l.category, desc: l.note, note: '', audience: l.dept_id ? (store.dept(l.dept_id) || {}).name || '' : '공통', mineId: l.id }));
  const all = [...builtin, ...mine]; const order = [...RESOURCE_CATEGORIES, ...new Set(mine.map(m => m.category).filter(c => !RESOURCE_CATEGORIES.includes(c)))];
  const cats = order.filter(c => all.some(r => r.category === c)); const sel = cats.includes(UI.resCat) ? UI.resCat : '';
  const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
  const aud = a => `<span class="tag ${a === '아동부' ? 'kid' : a === '청년부' ? 'yth' : ''}">${esc(a || '공통')}</span>`;
  const card = r => `<div class="res-card"><div class="row" style="gap:6px"><a class="res-name" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.name)} <span aria-hidden="true">↗</span></a><span class="sp"></span>${aud(r.audience)}</div><div class="mute small res-host">${esc(host(r.url))}</div>${r.desc ? `<p class="res-desc">${esc(r.desc)}</p>` : ''}${r.note ? `<p class="mute small res-note">${esc(r.note)}</p>` : ''}${r.mineId ? `<div class="row noprint" style="margin-top:6px"><span class="tag">내가 추가</span><span class="sp"></span><button class="sm" data-act="editLink" data-id="${r.mineId}">수정</button><button class="sm ghost dng" data-act="delLink" data-id="${r.mineId}">삭제</button></div>` : ''}</div>`;
  page('📚', '자료실', `${esc(scope)}에 필요한 사이트를 구분별로 모았어요`, `<div class="callout" style="margin-bottom:14px"><span>🔎</span><div class="sp small">공식 기관·출판사 위주로 <b>${esc(RESOURCES_CHECKED)}</b>에 직접 열어 확인한 목록이에요. 광고가 아니며, 주소·이용 조건(유료 여부 등)은 바뀔 수 있으니 사이트에서 확인하세요. 교재·찬양·이미지는 <b>저작권 이용 조건</b>을 꼭 확인하고 쓰세요.</div></div>
  <div class="row noprint" style="margin-bottom:12px"><button class="${!sel ? 'pri' : ''}" data-rescat="">전체 ${all.length}</button>${cats.map(c => `<button class="${sel === c ? 'pri' : ''}" data-rescat="${esc(c)}">${esc(c)} ${all.filter(r => r.category === c).length}</button>`).join('')}<span class="sp"></span><button data-act="newLink">+ 내 사이트 추가</button></div>
  ${cats.filter(c => !sel || c === sel).map(c => `<h2>${esc(c)}</h2><div class="res-grid">${all.filter(r => r.category === c).map(card).join('')}</div>`).join('') || emptyState('표시할 사이트가 없어요', '위의 ‘+ 내 사이트 추가’로 자주 쓰는 사이트를 넣어 보세요.', '<button class="sm pri" data-act="newLink">+ 내 사이트 추가</button>')}`);
}

// ----- 설정 -----
function vSettings() {
  const S = store.get(); const acct = A.mode === 'account'; const ds = store.daysSinceExport();
  const where = acct ? `<b>${esc(A.user.email)}</b> 계정의 서버 저장소에 저장됩니다. 같은 사이트를 써도 계정마다 데이터가 따로이고, 다른 기기에서 같은 계정으로 로그인하면 같은 데이터를 볼 수 있어요.` : `<b>이 브라우저(이 기기)</b>에만 저장되며 서버로 전송되지 않습니다. 다른 기기와 자동으로 공유되지 않으므로 아래 ‘내보내기’로 백업하세요.${A.reason === 'not-configured' ? ' (로그인 서버가 아직 연결되지 않았어요. README의 ‘로그인 켜기’를 따라 하면 사용자별 로그인이 켜져요.)' : ''}`;
  page('⚙️', '설정', '데이터 관리와 배포 정보', `
  ${acct ? `<h2 style="margin-top:0">내 계정</h2><div class="card"><div class="row"><div class="sp"><b>${esc(A.user.name || A.user.email)}</b><br><span class="mute small">${esc(A.user.email)}</span></div><button data-act="logout">로그아웃</button><button data-act="changePw">비밀번호 변경</button><button data-act="logoutAll">모든 기기에서 로그아웃</button><button class="dng" data-act="deleteAcct">계정 삭제</button></div><p class="mute small" style="margin:10px 0 0">가입 상태: ${A.signup ? '<span class="tag warn">열려 있음</span> (초대 코드를 아는 사람은 가입할 수 있어요. 필요한 사람이 모두 가입했다면 관리자가 Cloudflare에서 INVITE_CODE를 삭제하고 다시 배포하면 닫혀요)' : '<span class="tag ok">닫힘</span>'}<br>저장 상태: ${(SAVE_TXT[A.status] || SAVE_TXT.saved)[0]} · 계정을 삭제하면 서버의 내 데이터가 모두 지워져요(되돌릴 수 없음). 삭제 전에 ‘내보내기’로 백업하세요.</p></div>` : ''}
  <h2 ${acct ? '' : 'style="margin-top:0"'}>데이터</h2><div class="callout ${S.demo ? 'warn' : ''}"><span>${S.demo ? '🧪' : '📒'}</span><div>현재 <b>${S.demo ? '가상 데이터' : '실제 데이터'}</b>를 사용 중입니다. 데이터는 ${where}${ds === null ? '' : ` (마지막 내보내기: ${ds === 0 ? '오늘' : ds + '일 전'})`}</div></div>
  <div class="row" style="margin:12px 0"><button data-act="resetDemo">가상 데이터로 초기화</button><button class="pri" data-act="startEmpty">실제 데이터로 시작 (비움)</button></div>
  <h2>백업·복원 (JSON 파일)</h2><div class="row"><button data-act="export">내보내기(.json 다운로드)</button><button data-act="import">파일에서 가져오기</button><input type="file" id="file" accept="application/json,.json" hidden></div>
  <p class="mute small">내보낸 파일에는 이름 등 개인정보가 들어 있을 수 있으니 안전한 곳에만 보관하세요. 가져오면 현재 데이터가 파일 내용으로 바뀝니다(바꾸기 전에 확인합니다).</p>
  <h2>화면 미리보기</h2><div class="row"><button data-act="loginPreview">로그인 화면 미리보기</button><span class="mute small">서버 없이 모양만 보여 줘요(실제 로그인 아님).</span></div>
  ${acct ? `<h2>이미지 만들기 (AI)</h2><div class="box pad" id="imgbox"><p class="mute small" id="imgstatus">확인 중…</p><div id="imgform" hidden>
    <label class="f">만들 그림 자리<select id="imgslot">${IMG_SLOTS.map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join('')}</select></label>
    <label class="f" id="imgsizewrap" hidden>크기<select id="imgsize"><option value="1024x1024">정사각</option><option value="1536x1024">가로</option><option value="1024x1536">세로</option></select></label>
    <label class="f">그림 설명 (5~500자)<textarea id="imgprompt" maxlength="500" placeholder="예: 구유 옆에서 양들과 함께 있는 따뜻한 성탄 장면, 부드러운 노란 불빛"></textarea><span class="hint">이름·연락처·실제 아이의 사진 같은 개인정보는 적지 마세요. 설명은 만들기 위해 OpenAI로 전송돼요. 글자는 그림 안에 넣지 않도록 요청돼요.</span></label>
    <label class="f">품질<select id="imgq"><option value="medium">보통</option><option value="low">빠르게(낮은 품질)</option></select></label>
    <div class="row"><button class="pri" id="imggo">그림 만들기</button><span class="mute small" id="imgleft"></span></div></div><div id="imgresult" style="margin-top:12px"></div></div>` : ''}
  <h2>앱으로 설치 (컴퓨터·휴대폰)</h2><div class="callout"><span>🖥️</span><div class="sp">${isStandalone() ? '지금 <b>설치된 앱</b>으로 실행 중이에요.' : '이 사이트를 <b>앱처럼 설치</b>하면 바탕화면·작업 표시줄에서 바로 열 수 있어요.'} 설치한 앱은 열 때마다 <b>최신 버전</b>(지금 ${esc(VERSION)})을 불러와서 <b>자동으로 업그레이드</b>돼요. ${acct ? '로그인한 계정의 데이터는 서버에 있어서 앱에서도 <b>그대로 이어져요</b>.' : '지금은 데이터가 이 브라우저에만 저장돼요. 설치 전에 아래 ‘내보내기’로 백업하세요.'}</div></div>
  <div class="row" style="margin:12px 0">${!isStandalone() && canPromptInstall() ? '<button class="pri" data-act="installApp">앱으로 설치</button>' : ''}<button data-act="checkUpdate">새 버전 확인</button></div>
  ${(() => { const dv = desktopVersion(); if (dv) { const old = cmpSemver(dv, DESKTOP.version) < 0; return `<div class="callout ${old ? 'warn' : ''}"><span>💻</span><div class="sp">지금 <b>데스크톱 프로그램 ${esc(dv)}</b>로 실행 중이에요(화면과 기능은 사이트 ${esc(VERSION)}).${old ? ` 새 설치 파일 <b>${esc(DESKTOP.version)}</b>이 있어요. <a href="${esc(DESKTOP.download)}" target="_blank" rel="noopener noreferrer">다운로드</a>` : ' 프로그램 파일도 최신이에요.'}</div></div>`; }
    return `<h3 style="margin:16px 0 6px">Windows 데스크톱 프로그램 다운로드</h3><p class="small" style="margin:0 0 8px">설치 파일(약 ${DESKTOP.sizeMB}MB, 프로그램 ${esc(DESKTOP.version)})을 받아 실행하면 시작 메뉴·바탕화면에 ‘목회 비서’가 생겨요. 프로그램은 사이트를 앱 창으로 여는 것이라, <b>사이트 버전(${esc(VERSION)})이 올라가면 열 때마다 자동으로 새 버전</b>이 되고 설치 파일을 다시 받을 필요는 거의 없어요. 데이터는 로그인한 계정에 그대로 이어져요.</p><div class="row" style="margin:8px 0"><a class="btnlike pri" href="${esc(DESKTOP.download)}" target="_blank" rel="noopener noreferrer">💾 Windows 설치 파일 받기 (${esc(DESKTOP.file)})</a><a class="btnlike" href="${esc(DESKTOP.page)}" target="_blank" rel="noopener noreferrer">릴리스 페이지·해시값</a></div><div class="callout warn"><span>⚠️</span><div class="sp"><b>코드 서명이 없는 파일이에요.</b> Windows가 ‘알 수 없는 게시자’ 경고를 띄우면 ‘추가 정보 → 실행’을 누르세요. <b>스마트 앱 컨트롤이 켜진 PC에서는 실행이 막힐 수 있어요.</b> 그럴 때는 위의 ‘앱으로 설치’(브라우저 설치)를 쓰세요. 출처가 의심되면 받은 파일의 SHA-256 해시를 릴리스 페이지의 값과 비교하세요.</div></div>`; })()}
  <details class="small"><summary>설치 방법과 알아 둘 점</summary><ul><li><b>컴퓨터(Chrome·Edge)</b>: 주소창 오른쪽의 설치 아이콘, 또는 브라우저 메뉴에서 ‘앱으로 설치’(이름은 버전에 따라 조금 달라요)를 고르세요. 위의 ‘앱으로 설치’ 버튼이 보이면 그 버튼으로도 설치돼요.</li><li><b>Mac Safari</b>: 파일 메뉴 → ‘Dock에 추가’. <b>휴대폰</b>: 브라우저 메뉴의 ‘홈 화면에 추가’.</li><li>설치 버튼이 안 보이면 이미 설치했거나 이 브라우저가 지원하지 않는 경우예요. 그래도 사이트 주소로 그대로 쓸 수 있어요.</li><li>설치한 앱도 <b>인터넷 연결이 필요</b>해요(오프라인에서는 열리지 않아요).</li><li>설치한 앱에서 로그인 상태나 로컬 데이터가 브라우저와 따로 보이면, 설정의 ‘내보내기’·‘가져오기’로 옮기세요.</li><li>지우려면 앱 창의 메뉴(또는 운영체제의 앱 목록)에서 제거하세요. 로그인한 데이터는 지워지지 않아요.</li></ul></details>
  <h2>버전 기록 <span class="mute small">현재 ${esc(VERSION)}</span></h2><div class="changelog">${CHANGELOG.map(x => `<details ${x.v === VERSION ? 'open' : ''}><summary><b>${esc(x.v)}</b> <span class="mute small">${esc(x.date)}</span>${x.v === VERSION ? ' <span class="tag ok">현재</span>' : ''}</summary><ul class="small">${x.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul></details>`).join('')}</div>
  <h2>글꼴·오픈소스 고지</h2><p class="small">이 사이트의 글꼴은 <b>Pretendard</b> v1.3.9(Copyright © 2021 Kil Hyung-jin, SIL Open Font License 1.1)이며 수정 없이 그대로 사용합니다. 라이선스 전문: <a href="fonts/pretendard/LICENSE.txt" target="_blank" rel="noopener">LICENSE.txt</a><br>PDF 글자 읽기에는 <b>pdf.js</b> 6.5.438(Mozilla, Apache License 2.0)을 수정 없이 사용합니다. 라이선스 전문: <a href="vendor/pdfjs/LICENSE.txt" target="_blank" rel="noopener">LICENSE.txt</a><br>달력·타임라인·차트·디자인 변수에는 <b>vanilla-calendar-pro</b> 3.4.0, <b>frappe-gantt</b> 1.2.2, <b>uPlot</b> 1.6.32, <b>Open Props</b> 1.7.23(모두 MIT License)을 수정 없이 사용합니다. 라이선스 전문: <a href="vendor/vanilla-calendar-pro/LICENSE.txt" target="_blank" rel="noopener">달력</a> · <a href="vendor/frappe-gantt/LICENSE.txt" target="_blank" rel="noopener">타임라인</a> · <a href="vendor/uplot/LICENSE.txt" target="_blank" rel="noopener">차트</a> · <a href="vendor/open-props/LICENSE.txt" target="_blank" rel="noopener">변수</a></p>
  <h2>개인정보 안내</h2><ul class="small"><li>이 앱은 보호자 연락처·알레르기·계좌·주민번호를 입력받지 않습니다.</li>${acct ? '<li>입력한 이름·출석·지출 기록은 이 사이트 관리자의 Cloudflare 계정(D1 데이터베이스)에 저장됩니다. 관리자는 기술적으로 저장된 데이터를 볼 수 있으니, 아이들 이름을 입력하는 것에 대해 교회의 개인정보 방침과 보호자 안내를 확인하세요.</li><li>비밀번호는 원문이 아닌 해시로 저장됩니다.</li><li>‘이미지 만들기(AI)’를 쓰면 입력한 그림 설명이 OpenAI로 전송됩니다(이메일·이름은 보내지 않고, 만든 그림은 서버에 저장하지 않아요). 개인정보는 설명에 적지 마세요.</li>' : '<li>사이트 주소를 아는 사람은 누구나 앱을 열 수 있지만, 입력한 데이터는 각자의 브라우저에만 있어 서로 보이지 않습니다.</li><li>공용 PC에서는 사용 후 브라우저 데이터를 삭제해 정리하세요.</li>'}</ul>
  <h2>정보</h2><dl class="props"><dt>버전</dt><dd><b>${esc(VERSION)}</b></dd><dt>저장 방식</dt><dd>${acct ? '계정별 서버 저장(Cloudflare D1)' : `localStorage (${window.__memOnly ? '사용 불가 → 임시 메모리' : '사용 중'})`}</dd><dt>통화·시간대</dt><dd>원화(정수) · Asia/Seoul</dd></dl>`);
  if (acct) initImageBox();
}

// ----- 이벤트 -----
// ----- PDF에서 가져오기 공통 마법사: 파일 고르기 → 글자 읽기 → 후보 확인·수정 → 등록 (PDF는 브라우저 안에서만 처리) -----
function pdfWizard(cfg) {
  let cands = [];
  const d = modal(`<div class="dlg"><h3>PDF에서 ${esc(cfg.title)} 가져오기</h3>
    <ul class="small"><li>PDF는 <b>이 브라우저 안에서만</b> 읽어요. 서버나 외부로 올라가지 않아요.</li><li>글자가 드래그로 선택되는 PDF(워드·한글에서 ‘PDF로 저장’)만 읽을 수 있어요. <b>스캔본(그림 PDF)은 읽지 못해요.</b></li><li>규칙으로 찾는 방식이라 <b>틀릴 수 있어요.</b> 목록을 확인·수정한 뒤 등록하세요. 이름·연락처가 든 문서는 올리지 마세요.${cfg.tip ? `</li><li>${esc(cfg.tip)}` : ''}</li></ul>
    <div class="row"><label class="f" style="flex:1;min-width:130px">부서<select data-o="dept">${deptOpts().map(([v, l]) => `<option value="${v}"${Number(v) === workDept() ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></label>${cfg.year ? `<label class="f" style="width:120px">기본 연도<input type="number" data-o="year" value="${UI.year}" min="2000" max="2100"></label>` : ''}</div>
    <label class="f">PDF 파일 (15MB 이하, 50쪽까지)<input type="file" accept="application/pdf,.pdf" data-file></label>
    <div data-msg class="callout warn" hidden></div><div data-list></div>
    <div class="dlg-foot"><button data-x>닫기</button><button data-read>읽기</button><button class="pri" data-run hidden>선택한 항목 등록</button></div></div>`);
  d.style.width = 'min(900px, 94vw)'; d.style.maxWidth = 'min(900px, 94vw)';
  const q = s => $(s, d); const opts = () => ({ dept: Number(q('[data-o=dept]').value), year: q('[data-o=year]') ? Number(q('[data-o=year]').value) || UI.year : UI.year });
  const msg = (t, bad = true) => { const m = q('[data-msg]'); m.hidden = !t; m.className = 'callout ' + (bad ? 'warn' : ''); m.style.margin = '8px 0'; m.textContent = t || ''; };
  q('[data-x]').onclick = () => d.close();
  const cell = (col, i, v) => col.type === 'select' ? `<select data-f="${col.k}" data-i="${i}">${col.options.map(([a, b]) => `<option value="${esc(a)}"${String(a) === String(v ?? '') ? ' selected' : ''}>${esc(b)}</option>`).join('')}</select>` : `<input data-f="${col.k}" data-i="${i}" type="${col.type === 'number' ? 'number' : col.type}" value="${esc(v ?? '')}" ${col.type === 'number' ? 'min="0" inputmode="numeric"' : col.type === 'text' ? 'maxlength="80"' : ''} style="width:100%;min-width:${col.type === 'date' ? 140 : col.type === 'time' ? 100 : col.type === 'number' ? 90 : 120}px">`;
  const draw = () => {
    q('[data-list]').innerHTML = `<p class="small"><b>${cands.length}개</b>를 찾았어요. 맞는 것만 체크하고 내용을 고친 뒤 등록하세요. ⚠️는 확인이 필요한 줄이에요.</p><div class="tablewrap" style="max-height:46vh;overflow:auto"><table class="t"><thead><tr><th></th>${cfg.columns.map(c => `<th>${esc(c.label)}</th>`).join('')}<th>원문</th></tr></thead><tbody>${cands.map((c, i) => `<tr><td><input type="checkbox" data-c="${i}" ${c.warn.length ? '' : 'checked'} aria-label="가져오기"></td>${cfg.columns.map((col, ci) => `<td>${cell(col, i, c[col.k])}${ci === 0 && c.warn.length ? `<div class="small" style="color:var(--orange)">⚠️ ${esc(c.warn.join(' '))}</div>` : ''}</td>`).join('')}<td class="mute small">${c.line}번째 줄</td></tr>`).join('')}</tbody></table></div>`;
    q('[data-run]').hidden = false;
  };
  q('[data-read]').onclick = async () => {
    const f = q('[data-file]').files[0]; if (!f) return msg('PDF 파일을 먼저 고르세요.'); const btn = q('[data-read]'); btn.disabled = true; msg('읽는 중…', false); q('[data-list]').innerHTML = ''; q('[data-run]').hidden = true;
    try {
      const { extractPdfLines } = await import('./pdfimport.js'); const r = await extractPdfLines(f, (p, n) => msg(`읽는 중… ${p}/${n}쪽`, false));
      cands = cfg.parse(r.lines, opts()).slice(0, 500); msg(r.truncated ? `${r.pages}쪽 중 앞의 50쪽만 읽었어요.` : '', false);
      if (!cands.length) q('[data-list]').innerHTML = `<p>${esc(cfg.noun)}(으)로 읽을 수 있는 줄을 찾지 못했어요. 표나 목록의 모양이 달라서일 수 있어요.</p><details><summary class="small">읽은 글자 앞부분 보기</summary><pre class="small" style="white-space:pre-wrap">${esc(r.lines.slice(0, 40).join('\n'))}</pre></details>`;
      else draw();
    } catch (e) { msg(e.message || 'PDF를 읽지 못했어요.'); } finally { btn.disabled = false; }
  };
  q('[data-run]').onclick = () => {
    const picked = []; $$('[data-c]:checked', d).forEach(cb => { const i = Number(cb.dataset.c); const row = { ...cands[i], date0: cands[i].date }; for (const col of cfg.columns) row[col.k] = q(`[data-f="${col.k}"][data-i="${i}"]`).value.trim(); picked.push(row); });
    if (!picked.length) return msg('가져올 항목을 체크하세요.');
    try { const m = cfg.commit(picked, opts()); d.close(); render(); toast(m); } catch (e) { msg(e.message); }
  };
}const closeDialogs = () => $$('dialog').forEach(x => x.close());
// 교재 편집 표의 입력값을 모은다(저장 전 ‘과 추가·빼기’를 해도 적던 내용이 사라지지 않게)
const collectLessons = (cid, yr) => { const c = store.curriculum(cid); const edits = []; $('[data-lf]').forEach(inp => { const i = Number(inp.dataset.lf); edits[i] = edits[i] || {}; edits[i][inp.dataset.k] = inp.value; });
  const rows = c.lessons.filter(l => l.year === yr).map((l, i) => ({ ...l, ...(edits[i] || {}), year: yr })); return { c, rows, others: c.lessons.filter(l => l.year !== yr) }; };
const ACT = {
  goRosterAway: () => { UI.peopleTab = 'roster'; UI.pstatus = 'active'; location.hash = '#people'; toast('명단에서 사람 옆의 ‘장기 부재’를 누르세요.'); },
  editChecks: d => { const id = Number(d.id); const cur = store.checks(id); const rows = Array.from({ length: MAX_CHECKS }, (_, i) => cur[i] || { key: '', label: '', points: 0 });
    const m = modal(`<form method="dialog" class="dlg"><h3>${esc((store.dept(id) || {}).name)} 주간 체크 항목</h3><p class="mute small">예배마다 사람별로 체크할 항목이에요(최대 ${MAX_CHECKS}개). 점수를 0보다 크게 하면 달란트로 모아요. 이름을 비우면 그 항목은 빠져요.</p>
      ${rows.map((c, i) => `<div class="row" style="margin-bottom:8px"><input name="label${i}" value="${esc(c.label)}" maxlength="20" placeholder="예: 말씀 암송" style="flex:1" aria-label="항목 ${i + 1} 이름"><input name="points${i}" type="number" min="0" max="100" value="${c.points || 0}" style="width:80px" aria-label="항목 ${i + 1} 점수"><input type="hidden" name="key${i}" value="${esc(c.key)}"><span class="mute small">점</span></div>`).join('')}
      <div class="err"></div><div class="dlg-foot"><button type="button" data-reset>부서 기본값으로</button><span class="sp"></span><button type="button" data-x>취소</button><button class="pri">저장</button></div></form>`);
    $('[data-x]', m).onclick = () => m.close();
    $('[data-reset]', m).onclick = () => { const S0 = store.get(); delete (S0.deptCfg[id] || {}).checks; store.save(); m.close(); toast('기본 항목으로 되돌렸어요.'); render(); };
    $('form', m).onsubmit = e => { e.preventDefault(); const F = e.target.elements; const list = rows.map((_, i) => ({ key: F['key' + i].value, label: F['label' + i].value, points: F['points' + i].value })).filter(c => c.label.trim());
      try { store.saveChecks(id, list); m.close(); toast('체크 항목을 저장했어요.'); render(); } catch (err) { $('.err', m).textContent = err.message; } }; },
  homeNote: d => { const text = homeNoteText(Number(d.id)); if (!text) { toast('다가오는 주일예배에 공과가 없어요. 예배 → 교재·공과 연간 배치로 먼저 넣어 주세요.', true); return; }
    const m = modal(`<div class="dlg"><h3>가정 연계 안내문</h3><p class="mute small">고쳐서 복사해 보내세요. 아이 이름·연락처는 넣지 마세요.</p><textarea rows="14" style="width:100%">${esc(text)}</textarea><div class="dlg-foot"><button data-x>닫기</button><button class="pri" data-copy>복사</button></div></div>`);
    $('[data-x]', m).onclick = () => m.close(); $('[data-copy]', m).onclick = async () => { try { await navigator.clipboard.writeText($('textarea', m).value); toast('복사했어요.'); } catch { $('textarea', m).select(); toast('글을 선택했어요. Ctrl+C로 복사하세요.'); } }; },
  newExam: d => scheduleForm({ dept_id: Number(d.id), type: EXAM_TYPE, title: '중간고사' }),
  ncStart: d => { const id = Number(d.id); const cand = store.people({ deptId: id }).filter(p => !p.newcomer || p.newcomer.done);
    form({ title: '새가족(새친구) 등록', values: { who: '', reg: today() }, intro: '<p class="mute small">이미 명단에 있으면 고르고, 처음이면 이름을 적으세요. 연락처 같은 민감 정보는 적지 마세요.</p>',
      fields: [{ k: 'who', label: '명단에서 고르기', type: 'select', options: [['', '(새로 등록)'], ...cand.map(p => [p.id, p.display])] }, { k: 'name', label: '새로 등록할 이름', ph: '명단에서 골랐으면 비워 두세요' }, { k: 'reg', label: '처음 온 날', type: 'date', req: true }],
      onSubmit: o => { let pid = Number(o.who); if (!pid) pid = store.addPerson({ name: o.name, kind: { kid: 'child', teen: 'teen', youth: 'youth' }[dk(id)] || 'child', dept_id: id }); store.startNewcomer(pid, o.reg); toast('등록했어요. 단계마다 체크해 주세요.'); render(); } }); },
  ncEnd: async d => { if (await ask('정착 과정을 마쳤다고 표시할까요? 목록에서 빠져요.', '정착 완료')) { store.endNewcomer(Number(d.id)); render(); } },
  awayPerson: d => { const p = store.person(Number(d.id)); form({ title: `${p.name} 장기 부재`, values: { reason: AWAY_REASONS[0], start: today(), until: '', every: AWAY_EVERY[AWAY_REASONS[0]] }, intro: '<p class="mute small">출석부·출석률에서 잠시 빠지고, 연락 주기가 되면 홈 브리핑에 나와요. 돌아오면 ‘돌아왔어요’를 누르세요.</p>',
    fields: [{ k: 'reason', label: '사유', type: 'select', options: AWAY_REASONS.map(x => [x, x]) }, { k: 'start', label: '시작일', type: 'date', req: true }, { k: 'until', label: '돌아올 예정일 (전역 예정일 등)', type: 'date' }, { k: 'every', label: '연락 주기(일)', type: 'number', hint: '예: 30이면 한 달에 한 번. 연락은 ‘심방·돌봄’ 기록으로 남겨요.' }, { k: 'note', label: '메모', ph: '예: 육군 ○○사단(부대명은 적지 않아도 돼요)' }],
    onOpen: m => { const r = m.querySelector('[name=reason]'), e = m.querySelector('[name=every]'); r.onchange = () => { e.value = AWAY_EVERY[r.value] || 30; }; },
    onSubmit: o => { store.setAway(p.id, o); toast('장기 부재로 표시했어요.'); render(); } }); },
  backPerson: d => { store.returnFromAway(Number(d.id)); toast('현재 명단으로 돌아왔어요.'); render(); },
  exportCurr: d => { const j = store.exportCurriculum(Number(d.id)); download(`${j.name}.json`, JSON.stringify(j, null, 1), 'application/json'); toast('교재 파일을 내려받았어요. 교회 안에서만 나눠 쓰세요.'); },
  newCurr: () => curriculumForm(),
  editCurr: d => curriculumForm(store.curriculum(Number(d.id))),
  applyCurr: d => applyForm(Number(d.id)),
  delCurr: async d => { if (await ask('이 교재를 삭제할까요? 이미 예배에 배치한 공과 내용은 그대로 남아요.', '삭제')) { store.deleteCurriculum(Number(d.id)); location.hash = '#curricula'; toast('삭제했어요.'); } },
  saveCurr: d => { const { c, rows, others } = collectLessons(Number(d.id), Number(d.year)); guard(() => store.saveCurriculum({ ...c, lessons: [...others, ...rows] }), '저장했어요.'); render(); },
  addLesson: d => { const { c, rows, others } = collectLessons(Number(d.id), Number(d.year)); const no = rows.reduce((m, l) => Math.max(m, Number(l.no) || 0), 0) + 1; guard(() => store.saveCurriculum({ ...c, lessons: [...others, ...rows, { year: Number(d.year), no }] })); render(); },
  delLesson: d => { const { c, rows, others } = collectLessons(Number(d.id), Number(d.year)); if (!rows.length) return; guard(() => store.saveCurriculum({ ...c, lessons: [...others, ...rows.slice(0, -1)] })); render(); },
  pasteCurr: async d => { const rows = parseLessonText($('#cpaste').value); if (!rows.length) { toast('넣을 줄을 찾지 못했어요. 한 줄에 한 과씩 적어 주세요.', true); return; }
    if (await ask(`${d.year}년차를 아래 ${rows.length}과로 바꿀까요?\n\n${rows.slice(0, 5).map(r => `${r.no}과 ${r.title} ${r.scripture}`).join('\n')}${rows.length > 5 ? `\n…외 ${rows.length - 5}과` : ''}`, '넣기')) { guard(() => store.setCurriculumYear(Number(d.id), Number(d.year), rows), `${rows.length}과를 넣었어요.`); render(); } },
  lessonEdit: d => lessonEditor(Number(d.id)),
  lessonShift: async d => { if (await ask('이 주일은 공과를 쉬고, 이 주 공과부터 뒤의 공과를 한 주씩 뒤로 밀까요?\n\n이 예배는 그대로 두고(교체하지 않음), 마지막 공과는 비어 있는 다음 주일(없으면 새로 만든 주일예배)에 들어가요. ‘공과 다시 넣기’로 되돌릴 수 있어요.', '한 주씩 밀기')) { const r = store.shiftLesson(Number(d.id)); toast(`공과 ${r.moved}개를 한 주씩 밀었어요. 마지막 공과는 ${md(r.until)}에 들어갔어요.`); render(); } },
  lessonPull: d => { const n = guard(() => store.pullLesson(Number(d.id))); if (n !== undefined) toast(n ? `뒤의 공과 ${n}개를 한 주씩 당겼어요.` : '공과 쉼을 풀었어요.'); render(); },
  lessonClear: async d => { if (await ask('이 예배에서 공과를 뺄까요? 뒤의 공과는 움직이지 않아요.', '빼기')) { store.clearServiceLesson(Number(d.id)); render(); } },
  pdfImport: () => pdfWizard({ title: '일정·행사·예배', noun: '일정', year: true,
    columns: [{ k: 'date', label: '날짜', type: 'date' }, { k: 'title', label: '이름', type: 'text' }, { k: 'kind', label: '구분', type: 'select', options: [['event', '행사'], ['schedule', '일정(모임)'], ['service', '예배']] }],
    parse: (lines, o) => parsePlanLines(lines, o.year),
    commit: (rows, o) => { const r = store.importPlanItems(rows.map(x => ({ ...x, dept_id: o.dept, end: x.date === x.date0 ? x.end : x.date, type: guessScheduleType(x.title) }))); return `${[r.made.event && `행사 ${r.made.event}`, r.made.schedule && `일정 ${r.made.schedule}`, r.made.service && `예배 ${r.made.service}`].filter(Boolean).join(' · ') || '0'}개를 등록했어요.${r.skipped ? ` (이미 있는 ${r.skipped}개는 건너뜀)` : ''}`; } }),
  pdfEvents: () => pdfWizard({ title: '행사', noun: '행사', year: true,
    columns: [{ k: 'date', label: '시작일', type: 'date' }, { k: 'end', label: '끝나는 날', type: 'date' }, { k: 'title', label: '행사 이름', type: 'text' }],
    parse: (lines, o) => parsePlanLines(lines, o.year),
    commit: (rows, o) => { const r = store.importPlanItems(rows.map(x => ({ kind: 'event', dept_id: o.dept, title: x.title, date: x.date, end: x.end || x.date }))); return `행사 ${r.made.event}개를 등록했어요.${r.skipped ? ` (이미 있는 ${r.skipped}개는 건너뜀)` : ''}`; } }),
  pdfServices: () => pdfWizard({ title: '예배', noun: '예배', year: true,
    columns: [{ k: 'date', label: '날짜', type: 'date' }, { k: 'title', label: '예배 이름', type: 'text' }, { k: 'scripture', label: '성경 본문', type: 'text' }, { k: 'time', label: '시간', type: 'time' }],
    parse: (lines, o) => parseServiceLines(lines, o.year), tip: '성경 본문은 PDF에 적힌 장·절 표기만 옮긴 것이에요. 개역개정 본문은 직접 확인하세요.',
    commit: (rows, o) => { const r = store.importPlanItems(rows.map(x => ({ kind: 'service', dept_id: o.dept, title: x.title, date: x.date, time: x.time, scripture: x.scripture }))); return `예배 ${r.made.service}개를 등록했어요.${r.skipped ? ` (이미 있는 ${r.skipped}개는 건너뜀)` : ''}`; } }),
  pdfPeople: () => pdfWizard({ title: '명단', noun: '인원', year: false, tip: '이름·반·출생년도만 읽어요. 연락처·주소가 든 문서는 올리지 마세요. 같은 이름·부서·반·출생년도가 이미 있으면 건너뛰어요.',
    columns: [{ k: 'name', label: '이름', type: 'text' }, { k: 'kind', label: '구분', type: 'select', options: [['', '(기본)'], ['아동', '아동'], ['청소년', '청소년'], ['청년', '청년'], ['교사', '교사'], ['봉사자', '봉사자']] }, { k: 'class_name', label: '반·조', type: 'text' }, { k: 'birth_year', label: '출생년도', type: 'text' }],
    parse: lines => parsePeopleLines(lines).map(r => ({ ...r, kind: r.kind === 'teacher' ? '교사' : '' })),
    commit: (rows, o) => { const plan = store.planPeopleImport(rows.map(x => ({ line: x.line, name: x.name, kind: x.kind, dept: '', class_name: x.class_name, birth_year: x.birth_year })), o.dept); if (plan.errors.length) throw new Error(`확인이 필요한 줄이 있어요: ${plan.errors.slice(0, 3).map(e => `${e.line}번째 줄 ${e.msg}`).join(' / ')}`); if (!plan.ok.length) throw new Error('모두 이미 등록된 사람이에요.'); store.addPeopleBulk(plan.ok); return `${plan.ok.length}명을 등록했어요.${plan.dup.length ? ` (이미 있는 ${plan.dup.length}명은 건너뜀)` : ''}`; } }),
  pdfBudget: () => pdfWizard({ title: '예산', noun: '예산 항목', year: true, tip: '같은 항목 이름이 이미 있으면 금액이 수정돼요. 합계 줄은 자동으로 빼요.',
    columns: [{ k: 'category', label: '항목', type: 'text' }, { k: 'amount', label: '예산액(원)', type: 'number' }],
    parse: lines => parseBudgetLines(lines).map(r => ({ ...r, warn: [...r.warn] })),
    commit: (rows, o) => { const r = store.importBudgets(o.dept, o.year, rows); return `예산 항목 ${r.added}개를 추가하고 ${r.updated}개를 수정했어요.`; } }),
  pdfTx: () => pdfWizard({ title: '거래 내역', noun: '거래', year: true, tip: '영수증 사진은 PDF에서 가져오지 않아요. 수입·지출 구분은 글자로 짐작한 것이니 꼭 확인하세요. 같은 날짜·금액·적요가 이미 있으면 건너뛰어요.',
    columns: [{ k: 'date', label: '날짜', type: 'date' }, { k: 'kind', label: '구분', type: 'select', options: [['expense', '지출'], ['income', '수입']] }, { k: 'memo', label: '적요', type: 'text' }, { k: 'amount', label: '금액(원)', type: 'number' }, { k: 'category', label: '항목', type: 'text' }],
    parse: (lines, o) => parseTxLines(lines, o.year),
    commit: (rows, o) => { const r = store.importTransactions(o.dept, rows); return `거래 ${r.made}개를 등록했어요.${r.skipped ? ` (이미 있는 ${r.skipped}개는 건너뜀)` : ''}`; } }),
  pdfAssets: () => pdfWizard({ title: '비품', noun: '비품', year: false, tip: '같은 부서·이름·장소가 이미 있으면 건너뛰어요.',
    columns: [{ k: 'name', label: '품목', type: 'text' }, { k: 'qty', label: '수량', type: 'number' }, { k: 'place', label: '장소', type: 'text' }, { k: 'category', label: '구분', type: 'select', options: ASSET_CATEGORIES.map(x => [x, x]) }],
    parse: lines => parseAssetLines(lines),
    commit: (rows, o) => { const r = store.importAssets(o.dept, rows); return `비품 ${r.made}개를 등록했어요.${r.skipped ? ` (이미 있는 ${r.skipped}개는 건너뜀)` : ''}`; } }),
  pdfThemes: () => pdfWizard({ title: '월별 교육 주제', noun: '월별 주제', year: true, tip: '체크한 달의 주제를 덮어써요. 이미 적은 주제와 다르면 ⚠️로 알려 드려요.',
    columns: [{ k: 'month', label: '달', type: 'select', options: Array.from({ length: 12 }, (_, i) => [String(i + 1), `${i + 1}월`]) }, { k: 'theme', label: '교육 주제', type: 'text' }],
    parse: (lines, o) => { const cur = store.plan(o.dept, o.year).themes || {}; return parseThemeLines(lines).map(r => ({ ...r, month: String(r.month), warn: [...r.warn, ...(cur[r.month] && cur[r.month] !== r.theme ? [`지금 적힌 주제 ‘${cur[r.month]}’을(를) 바꿔요.`] : [])] })); },
    commit: (rows, o) => { const th = {}; for (const r of rows) th[r.month] = r.theme; const n = store.importMonthThemes(o.dept, o.year, th); return `${n}개 달의 주제를 저장했어요.`; } }),  notice: d => noticeModal(d.kind, Number(d.id)),
  newLink: () => linkForm(), editLink: d => linkForm(store.link(Number(d.id))),
  delLink: async d => { if (await ask('이 사이트를 목록에서 지울까요?', '삭제')) { store.deleteLink(Number(d.id)); render(); toast('지웠어요.'); } },
  newVisit: () => visitForm(), editVisit: d => { closeDialogs(); visitForm(store.visit(Number(d.id))); },
  delVisit: async d => { if (await ask('이 기록을 삭제할까요? 되돌릴 수 없어요.', '삭제')) { closeDialogs(); store.deleteVisit(Number(d.id)); render(); toast('삭제했어요.'); } },
  personVisits: d => {
    const p = store.person(Number(d.id)); const list = store.visits({ personId: p.id });
    const m = modal(`<div class="dlg"><div class="row"><h3 style="margin:0">${esc(p.name)} · 심방·돌봄 기록</h3><span class="sp"></span><button class="sm" data-c>닫기</button></div>${VISIT_HINT}${list.length ? `<div class="tablewrap"><table class="t"><thead><tr><th>날짜</th><th>방법</th><th>내용</th><th></th></tr></thead><tbody>${visitRows(list, false)}</tbody></table></div>` : '<p class="mute">아직 기록이 없어요.</p>'}<div class="dlg-foot"><button class="pri" data-add>+ 기록 추가</button></div></div>`);
    $('[data-c]', m).onclick = () => m.close(); $('[data-add]', m).onclick = () => { m.close(); visitForm({ person_id: p.id }); };
  },
  csvVisits: () => { const rows = [['날짜', '이름', '반·조', '방법', '내용', '다음 연락일'], ...store.visits({ deptId: did() }).map(v => [v.date, v.person ? v.person.name : '', v.person ? v.person.class_name : '', v.type, v.note, v.follow_up || ''])]; download(`심방기록_${today()}.csv`, toCsv(rows)); },
  bulkClear: () => { UI.psel = new Set(); render(); },
  bulkMove: () => { const ids = [...UI.psel]; if (!ids.length) return; form({ title: `${ids.length}명 이동`, intro: '<p class="mute small">이동 후에도 과거 출석 기록은 남아요. 반·조를 비우면 지금 반·조를 그대로 둬요.</p>', values: { dept_id: workDept() }, fields: [{ k: 'dept_id', label: '새 부서', type: 'select', options: deptOpts() }, { k: 'cls', label: '새 반·조 (선택)' }], submit: '이동', onSubmit: o => { const n = store.movePeople(ids, Number(o.dept_id), o.cls); UI.psel = new Set(); toast(`${n}명을 이동했어요.`); } }); },
  bulkRetire: async () => { const ids = [...UI.psel]; if (ids.length && await ask(`선택한 ${ids.length}명을 현재 명단에서 제외합니다. 과거 출석·참가 기록은 그대로 남아요.`, '명단 제외')) { store.setPeopleStatus(ids, 'graduated'); UI.psel = new Set(); render(); toast('명단에서 제외했어요.'); } },
  newAsset: () => assetForm(), editAsset: d => assetForm(store.asset(Number(d.id))),
  delAsset: async d => { if (await ask('이 비품과 수리 내역을 삭제할까요? 되돌릴 수 없어요.', '삭제')) { store.deleteAsset(Number(d.id)); location.hash = '#assets'; toast('삭제했어요.'); } },
  newRepair: d => form({ title: '수리 내역 추가', values: { date: today() }, fields: [{ k: 'date', label: '날짜', type: 'date', req: true }, { k: 'note', label: '수리 내용', req: true, ph: '예: 케이블 교체' }, { k: 'cost', label: '수리비 (원, 선택)', type: 'number' }], onSubmit: o => store.addRepair(Number(d.id), o) }),
  delRepair: async d => { const [a, r] = d.id.split('/').map(Number); if (await ask('이 수리 기록을 삭제할까요?', '삭제')) { store.deleteRepair(a, r); render(); } },
  csvAssets: () => { const rows = [['품목', '구분', '보관 장소', '수량', '상태', '부서', '수리 횟수', '수리비 합계', '메모'], ...store.assets(did()).map(a => [a.name, a.category, a.place, a.qty, a.status, (store.dept(a.dept_id) || {}).name || '', (a.repairs || []).length, (a.repairs || []).reduce((s, r) => s + (r.cost || 0), 0), a.note])]; download(`비품목록_${today()}.csv`, toCsv(rows)); },
  newSchedule: () => scheduleForm(), editSchedule: d => scheduleForm(store.schedule(Number(d.id))),
  delSchedule: async d => { if (await ask('이 일정을 삭제할까요?', '삭제')) { store.deleteSchedule(Number(d.id)); location.hash = '#plan'; toast('삭제했어요.'); } },
  delSeries: async d => { const id = Number(d.id); const n = store.seriesCount(d.kind, id); if (await ask(`이 날짜부터 같은 반복으로 만든 ${n}개를 모두 삭제할까요?${d.kind === 'service' ? '\n해당 예배의 출석 기록도 함께 지워져요.' : ''}\n되돌릴 수 없어요.`, '삭제')) { store.deleteSeries(d.kind, id); location.hash = d.kind === 'service' ? '#services' : '#plan'; toast('삭제했어요.'); } },
  printPage: () => window.print(),
  editTodo: d => { const x = (store.get().todos || []).find(v => v.id === Number(d.id)); if (!x) return; form({ title: '할 일 수정', values: x, fields: [{ k: 'title', label: '할 일', req: true }, { k: 'date', label: '날짜', type: 'date', req: true }, { k: 'time', label: '알림 시간(선택)', type: 'time', hint: '비우면 알림 없이 목록에만 보여요.' }], onSubmit: o => { store.saveTodo({ id: x.id, ...o }); } }); },
  delTodo: d => { guard(() => store.deleteTodo(Number(d.id))); render(); },
  moveTodo: d => { guard(() => store.moveTodoToToday(Number(d.id)), '오늘로 옮겼어요.'); render(); },
  enableNotif: async () => { const r = await askNotifyPermission(); toast(r === 'granted' ? '바탕화면 알림을 켰어요.' : '알림을 켜지 않았어요. 화면 팝업으로는 계속 알려요.'); render(); },
  installApp: async () => { const r = await promptInstall(); if (r === 'accepted') toast('설치했어요. 바탕화면·시작 메뉴에서 ‘목회 비서’를 열어 보세요.'); else if (r === 'unavailable') toast('이 브라우저에서는 설치 버튼을 쓸 수 없어요. 아래 설치 방법을 보세요.', true); render(); },
  checkUpdate: async () => { const v = await fetchLatestVersion(); if (!v) { toast('새 버전을 확인하지 못했어요. 인터넷 연결을 확인하세요.', true); return; } if (v !== VERSION) showUpdateBar(v); else toast(`최신 버전이에요 (${VERSION}).`); },
  settle: d => { guard(() => store.setSettled(Number(d.id), d.on === '1')); render(); },
  finishEvent: d => { const e = store.ev(Number(d.id)); if (e) guard(() => store.saveEvent({ ...e, status: 'done' }), '행사를 완료로 표시했어요.'); render(); },
  retro: d => { const e = store.ev(Number(d.id)); if (!e) return; form({ title: '행사 회고', intro: '<p class="mute small">다음 담당자가 이 글만 읽고 시작할 수 있게 적어 주세요. 이름·연락처 같은 개인정보는 적지 마세요.</p>', values: e.retro || {}, fields: [{ k: 'good', label: '잘된 점', type: 'textarea' }, { k: 'change', label: '바꿀 점', type: 'textarea' }, { k: 'next', label: '다음 담당자가 언제 무엇부터 할지', type: 'textarea', ph: '예: 행사 8주 전에 장소 예약부터' }], onSubmit: o => { guard(() => store.saveRetro(Number(d.id), o), '회고를 저장했어요.'); render(); } }); },
  gotoTask: d => { const el = document.getElementById('task-' + Number(d.id)); if (!el) return; el.scrollIntoView({ block: 'center' }); const c = el.querySelector('input'); if (c) c.focus(); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1500); },
  guideFlow: d => { const e = store.ev(Number(d.id)); const g = GUIDES[d.key]; if (!e || !g) return; const mark = `[진행 순서 예시 · ${g.name}]`; if ((e.note || '').includes(mark)) { toast('이미 메모에 들어 있어요.'); return; }
    const text = `${mark}\n${g.flow.map(([t, w]) => `${t} ${w}`).join('\n')}`; guard(() => store.saveEvent({ ...e, note: e.note ? `${e.note}\n\n${text}` : text }), '행사 메모에 넣었어요. ‘수정’에서 고칠 수 있어요.'); render(); },
  guidePrep: d => { const key = GUIDES[d.key] ? d.key : 'general'; guard(() => { const n = store.applyGuidePrep(Number(d.id), guideTasks(key)); toast(n ? `준비 업무 ${n}개를 추가했어요. 아래 ‘준비할 일’에서 확인하세요.` : '이미 모두 추가되어 있어요.'); }); render(); },
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
  saveReview: () => { guard(() => store.saveReview(workDept(), UI.year, $('#review').value), '총평을 저장했어요.'); render(); },
  saveNextGoal: () => { const d = workDept(); const y = UI.year + 1; guard(() => store.savePlan(d, y, $('#nextgoal').value, store.plan(d, y).themes), `${y}년 사역 목표를 저장했어요.`); render(); },
  savePlan: () => { const d = workDept(); const th = {}; $$('[data-theme]').forEach(i => { if (i.value.trim()) th[i.dataset.theme] = i.value.trim(); }); store.savePlan(d, UI.year, $('#goal').value, th); toast('저장했습니다.'); },
  editSeason: d => { const s = d.id ? store.get().seasons.find(x => x.id === Number(d.id)) : { dept_id: workDept(), year: UI.year }; form({ title: '절기 계획', values: s, fields: [{ k: 'name', label: '절기명', req: true }, { k: 'start', label: '시작일', type: 'date' }, { k: 'end', label: '종료일', type: 'date' }, { k: 'theme', label: '주제' }, { k: 'scripture', label: '성경 본문 (개역개정 · 인용 전 확인)' }, { k: 'plan', label: '예배·교육·행사 계획', type: 'textarea' }], onSubmit: o => store.saveSeason({ ...s, ...o, start: o.start || null, end: o.end || null }) }); },
  delSeason: async d => { if (await ask('이 절기 계획을 삭제할까요?', '삭제')) { store.deleteSeason(Number(d.id)); render(); } },
  editBudget: () => form({ title: '예산 항목', intro: `<p class="mute small">${UI.year}년 · ${esc(store.dept(workDept()).name)} · 같은 항목명이면 금액이 수정됩니다.</p>`, fields: [{ k: 'category', label: '항목', req: true }, { k: 'amount', label: '예산액 (원)', type: 'number', req: true }], onSubmit: o => store.saveBudget(workDept(), UI.year, o.category.trim(), Number(o.amount)) }),
  resetDemo: async () => { if (await ask('가상 데이터로 되돌립니다. 지금 입력한 내용은 사라집니다.', '초기화')) { store.resetDemo(); render(); toast('가상 데이터로 초기화했습니다.'); } },
  startEmpty: async () => { if (await ask('비어 있는 실제 데이터로 시작합니다. 현재(가상) 데이터는 사라집니다. 먼저 ‘내보내기’로 백업할 수 있습니다.', '비우고 시작')) { store.startEmpty(); location.hash = '#home'; render(); toast('실제 데이터로 시작합니다.'); } },
  export: () => { download(`목회비서_백업_${today()}.json`, store.exportJson(), 'application/json'); guard(() => store.markExported(), '백업 파일을 내려받았어요. 안전한 곳에 보관하세요.'); render(); },
  import: () => $('#file').click(),
  print: () => window.print(),

  // --- 도움 장치 ---
  loginPreview: () => { location.hash = '#login-preview'; },
  help: () => openHelp(), tipHide: d => { lsSet('ms:tip:' + d.k, '1'); render(); }, tipShow: d => { lsSet('ms:tip:' + d.k, '0'); render(); },
  themeTpl: () => { const n = guard(() => store.loadMonthThemes(workDept(), UI.year)); toast(n ? `비어 있던 ${n}개 달에 예시를 넣었어요. 우리 교회에 맞게 고쳐 쓰세요.` : '비어 있는 달이 없어요.'); render(); },
  seasonTpl: () => { const n = guard(() => store.loadSeasonTemplate(workDept(), UI.year)); toast(n ? `${UI.year}년 절기 ${n}개를 넣었어요. 날짜를 꼭 확인하세요.` : '이미 모두 들어 있어요.'); render(); },
  applyTpl: d => form({ title: '예시 준비 업무 추가', intro: '<p class="mute small">이 행사의 시작일을 기준으로 마감일을 계산해 준비 업무와 준비물을 추가해요. 이미 같은 이름이 있으면 건너뛰어요.</p>', fields: [{ k: 'tpl', label: '예시 선택', type: 'select', options: Object.entries(EVENT_TEMPLATES).map(([k, t]) => [k, t.name]) }], submit: '추가',
    onSubmit: o => { const r = store.applyEventTemplate(Number(d.id), o.tpl); toast(`준비 업무 ${r.tasks}개, 준비물 ${r.supplies}개를 추가했어요.`); } }),
  // --- 삭제·수정 보강 ---
  delEvent: async d => { if (await ask('이 행사를 삭제할까요? 준비 업무와 준비물도 함께 지워져요. (참가자나 거래가 연결된 행사는 삭제되지 않아요. 그땐 상태를 ‘취소’로 바꾸세요.)', '삭제')) { if (guard(() => { store.deleteEvent(Number(d.id)); return true; }, '삭제했어요.')) location.hash = '#events'; } },
  delService: async d => { if (await ask('이 예배와 출석 기록을 삭제할까요? 되돌릴 수 없어요.', '삭제')) { store.deleteService(Number(d.id)); location.hash = '#services'; toast('삭제했어요.'); } },
  editPerson: d => { const p = store.person(Number(d.id)); form({ title: '인원 수정', values: { name: p.name, kind: p.kind, dept_id: p.dept_id, class_name: p.class_name, birth_year: p.birth_year || '' }, fields: [{ k: 'name', label: '이름', req: true }, { k: 'kind', label: '구분', type: 'select', options: Object.entries(KIND) }, { k: 'dept_id', label: '부서', type: 'select', options: deptOpts(), hint: '부서를 바꿔도 과거 출석 기록은 남아요.' }, { k: 'class_name', label: '반·조' }, { k: 'birth_year', label: '출생년도', type: 'number' }], onSubmit: o => store.updatePerson(p.id, { ...o, dept_id: Number(o.dept_id) }) }); },
  editTx: d => { const t = store.get().transactions.find(x => x.id === Number(d.id)); if (t) txForm(t); },
  newSupply: d => form({ title: '준비물 추가', fields: [{ k: 'name', label: '준비물', req: true, ph: '예: 이름표' }], onSubmit: o => store.addSupply(Number(d.id), o.name) }),
  delSupply: d => { store.deleteSupply(Number(d.id)); render(); },
  peopleTemplate: () => { const dn = (store.dept(workDept()) || {}).name || '아동부'; download('명단_등록양식.csv', toCsv([['이름', '구분(아동/청년/교사/봉사자)', '부서(비우면 현재 선택한 부서)', '반·조', '출생년도'], ['(예시)가온', '아동', dn, '해님반', '2018'], ['(예시)나래', '아동', dn, '달님반', '2016'], ['(예시)김교사', '교사', dn, '해님반', '']])); toast('양식을 내려받았어요. ‘(예시)’ 줄은 지우고 입력한 뒤 CSV로 저장하세요.'); },
  peopleImport: () => {
    let plan = null;
    const d = modal(`<div class="dlg"><h3>명단 한꺼번에 등록</h3><ol class="small"><li>‘등록 양식 내려받기’로 파일을 받아 엑셀에서 열어요.</li><li>이름·구분·반·출생년도를 줄마다 입력하고(‘(예시)’ 줄은 지우세요) <b>CSV로 저장</b>해요.</li><li>아래에서 그 파일을 고르거나, 엑셀 표를 복사해 붙여넣으세요.</li></ol><div class="row" style="margin-bottom:8px"><button data-tpl>양식 내려받기</button></div><label class="f">파일 선택(.csv)<input type="file" accept=".csv,.txt,text/csv"></label><label class="f">또는 엑셀에서 복사해 붙여넣기<textarea data-paste placeholder="이름 [탭] 구분 [탭] 부서 [탭] 반·조 [탭] 출생년도"></textarea></label><div data-prev></div><p class="mute small">연락처·주소 같은 민감한 정보는 넣지 마세요. 같은 이름·부서·반·출생년도가 이미 있으면 건너뜁니다.</p><div class="dlg-foot"><button data-x>닫기</button><button data-check>내용 확인</button><button class="pri" data-run disabled>등록하기</button></div></div>`);
    $('[data-x]', d).onclick = () => d.close(); $('[data-tpl]', d).onclick = () => ACT.peopleTemplate();
    $('[data-check]', d).onclick = async () => {
      const prev = $('[data-prev]', d); const run = $('[data-run]', d); run.disabled = true; plan = null;
      try {
        const f = $('input[type=file]', d).files[0]; const text = f ? decodeText(await f.arrayBuffer()) : $('[data-paste]', d).value;
        if (!text.trim()) throw new Error('파일을 고르거나 표를 붙여넣어 주세요.');
        let rows = parseTable(text).map((r, i) => ({ r, line: i + 1 })); if (rows.length && /이름/.test(rows[0].r[0] || '')) rows = rows.slice(1);
        rows = rows.filter(x => !/^\(예시\)/.test((x.r[0] || '').trim())).map(({ r, line }) => ({ line, name: r[0], kind: r[1], dept: r[2], class_name: r[3], birth_year: r[4] }));
        if (!rows.length) throw new Error('등록할 줄이 없어요. 양식의 ‘(예시)’ 줄만 있는지 확인하세요.');
        plan = store.planPeopleImport(rows, workDept());
        prev.innerHTML = `<div class="callout ${plan.errors.length ? 'warn' : ''}" style="margin:8px 0"><div class="sp"><b>등록 ${plan.ok.length}명</b> · 중복 건너뜀 ${plan.dup.length}명 · 확인 필요 ${plan.errors.length}줄</div></div>${plan.errors.length ? `<ul class="small">${plan.errors.slice(0, 8).map(e => `<li>${e.line}번째 줄: ${esc(e.msg)}</li>`).join('')}${plan.errors.length > 8 ? `<li>…외 ${plan.errors.length - 8}줄</li>` : ''}</ul><p class="mute small">확인이 필요한 줄은 등록되지 않아요. 파일을 고쳐서 다시 올리거나, 등록 가능한 사람만 먼저 등록하세요.</p>` : ''}${plan.ok.length ? `<div class="tablewrap"><table class="t"><thead><tr><th>이름</th><th>구분</th><th>부서</th><th>반·조</th><th>출생</th></tr></thead><tbody>${plan.ok.slice(0, 8).map(p => `<tr><td>${esc(p.name)}</td><td>${KIND[p.kind]}</td><td>${esc((store.dept(p.dept_id) || {}).name || '')}</td><td>${esc(p.class_name)}</td><td>${p.birth_year || ''}</td></tr>`).join('')}</tbody></table></div>${plan.ok.length > 8 ? `<p class="mute small">…외 ${plan.ok.length - 8}명</p>` : ''}` : ''}`;
        run.disabled = !plan.ok.length;
      } catch (e) { prev.innerHTML = `<div class="callout warn" style="margin:8px 0">${esc(e.message)}</div>`; }
    };
    $('[data-run]', d).onclick = () => { if (!plan || !plan.ok.length) return; const n = guard(() => store.addPeopleBulk(plan.ok), `${plan.ok.length}명을 등록했어요.`); if (n) { d.close(); render(); } };
  },
  viewReceipt: d => { const t = store.get().transactions.find(x => x.id === Number(d.id)); if (!t || !t.receipt) return; const src = RCP.src(t.receipt); const dl = modal(`<div class="dlg"><div class="row"><h3 style="margin:0">영수증 · ${esc(t.date)} ${esc(t.memo || t.category)}</h3><span class="sp"></span><button class="sm" data-c>닫기</button></div>${src ? `<img class="rc-img" src="${esc(src)}" alt="영수증 사진">` : '<p class="mute">사진을 찾을 수 없어요. 다른 브라우저에서 올린 사진이거나 삭제된 사진일 수 있어요.</p>'}<p class="mute small">${won(t.amount)}</p></div>`); $('[data-c]', dl).onclick = () => dl.close(); },
  csvAtt: () => { const M = store.attendanceMatrix(workDept(), { last: 8 }); const rows = [['이름', '반', ...M.services.map(s => s.date), '출석', '출석률'], ...M.rows.map(r => [r.person.name, r.person.class_name, ...r.cells.map(c => (c === 1 ? '○' : c === 0 ? '×' : '')), r.present, r.rate === null ? '' : r.rate + '%'])]; download(`출석부_${store.dept(workDept()).name}_${today()}.csv`, toCsv(rows)); },
  csvRoster: () => { const rows = [['이름', '구분', '부서', '반·조', '출생년도', '상태'], ...store.people({ deptId: did(), status: UI.pstatus || 'active' }).map(p => [p.name, KIND[p.kind], (store.dept(p.dept_id) || {}).name || '', p.class_name, p.birth_year || '', p.status])]; download(`명단_${today()}.csv`, toCsv(rows)); },
  csvTx: () => { const rows = [['날짜', '부서', '구분', '항목', '적요', '행사', '금액', '영수증'],...store.transactions({ deptId: did(), year: UI.year, month: UI.mmonth || undefined }).map(t => [t.date, (store.dept(t.dept_id) || {}).name, t.kind === 'income' ? '수입' : '지출', t.category, t.memo, (store.ev(t.event_id) || {}).title || '', t.amount, t.receipt ? '있음' : ''])]; download(`거래내역_${UI.year}_${today()}.csv`, toCsv(rows)); },
  // --- 계정 ---
  logout: async () => { if (AUTH_BUSY()) return toast('저장 중이에요. 잠시 후 다시 눌러 주세요.', true); await accountApi.logout().catch(() => {}); location.reload(); },
  logoutAll: async () => { if (AUTH_BUSY()) return toast('저장 중이에요. 잠시 후 다시 눌러 주세요.', true); if (!(await ask('이 기기를 포함해 모든 기기에서 로그아웃합니다. 기기를 잃어버렸거나 남이 내 계정을 썼을 수 있을 때 사용하세요. 저장된 데이터는 지워지지 않아요.', '모두 로그아웃'))) return; await accountApi.logoutAll().catch(e => { throw e; }); location.reload(); },
  changePw: () => form({ title: '비밀번호 변경', intro: '<p class="mute small">변경하면 다른 기기는 모두 로그아웃돼요.</p>', fields: [{ k: 'cur', label: '현재 비밀번호', type: 'password', req: true }, { k: 'nxt', label: '새 비밀번호 (10자 이상)', type: 'password', req: true }], onSubmit: async o => { try { await accountApi.changePassword(o.cur, o.nxt); toast('비밀번호를 바꿨어요.'); } catch (e) { throw e; } } }),
  deleteAcct: async () => { if (!(await ask('계정과 서버에 저장된 내 데이터가 모두 삭제돼요. 되돌릴 수 없어요. 먼저 ‘내보내기’로 백업하셨나요?', '계속'))) return; form({ title: '계정 삭제 확인', intro: '<p class="mute small">비밀번호를 입력하면 계정이 삭제돼요.</p>', fields: [{ k: 'pw', label: '비밀번호', type: 'password', req: true }], submit: '계정 삭제', onSubmit: async o => { await accountApi.deleteAccount(o.pw); location.reload(); } }); },
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
  if ((el = t.closest('[data-rescat]'))) { UI.resCat = el.dataset.rescat; render(); return; }
  if ((el = t.closest('[data-evview]'))) { UI.evView = el.dataset.evview === 'tl' ? 'tl' : 'list'; render(); return; }
  if ((el = t.closest('[data-evtl]'))) { UI.evTl = UI.evTl === Number(el.dataset.evtl) ? 0 : Number(el.dataset.evtl); render(); return; }
  if ((el = t.closest('[data-evflt]'))) { UI.evFilter = el.dataset.evflt; render(); return; }
  if ((el = t.closest('[data-guidepick]'))) { if (GUIDES[el.dataset.guidepick]) { UI.guide = el.dataset.guidepick; if (location.hash !== '#guides') location.hash = '#guides'; else render(); } return; }
  if ((el = t.closest('[data-cyear]'))) { UI.cYear = Number(el.dataset.cyear); render(); return; }
  if ((el = t.closest('[data-cls]'))) { AT.cls = el.dataset.cls; render(); return; }
  if (t.closest('#menu-btn') || t.closest('#scrim')) document.body.classList.toggle('nav-open');
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.matches('[data-year]')) { UI.year = Number(t.value); render(); }
  else if (t.matches('[data-task]')) { guard(() => store.setTaskStatus(Number(t.dataset.task), t.checked ? 'done' : 'todo')); render(); }
  else if (t.matches('[data-guidesel]')) { if (GUIDES[t.value]) { UI.evGuide = { id: Number(t.dataset.guidesel), key: t.value }; render(); } }
  else if (t.matches('[data-evstatus]')) { const ev = store.ev(Number(t.dataset.evstatus)); guard(() => store.saveEvent({ ...ev, status: t.value }), '저장했습니다.'); render(); }
  else if (t.matches('[data-pstat]')) { const [a, b] = t.dataset.pstat.split('/').map(Number); guard(() => store.setParticipant(a, b, t.value)); render(); }
  else if (t.matches('[data-att]')) { const [a, b] = t.dataset.att.split('/').map(Number); guard(() => store.setAttendance(a, b, t.checked)); t.closest('label').classList.toggle('on', t.checked); const c = store.attendanceCount(a); const h = $('#main h2 .tag.ok'); if (h) { h.textContent = `출석 ${c.present}명`; h.nextElementSibling.textContent = `기록 ${c.recorded}명`; } }
  else if (t.matches('[data-supply]')) { guard(() => store.toggleSupply(Number(t.dataset.supply), t.checked)); render(); }
  else if (t.matches('[data-calsvc]')) { UI.calSvc = t.checked; render(); }
  else if (t.matches('[data-psel]')) { const id = Number(t.dataset.psel); if (t.checked) UI.psel.add(id); else UI.psel.delete(id); render(); }
  else if (t.matches('[data-pselall]')) { UI.psel = t.checked ? new Set(store.people({ deptId: did(), status: UI.pstatus || 'active' }).map(p => p.id)) : new Set(); render(); }
  else if (t.matches('[data-afilter]')) { UI.asset[t.dataset.afilter] = t.value; render(); }
  else if (t.matches('[data-repmonth]')) { if (/^\d{4}-\d{2}$/.test(t.value)) { UI.rep.month = t.value; render(); } }
  else if (t.matches('[data-repimg]')) { UI.rep.rc = t.checked; render(); }
  else if (t.matches('[data-pstatus]')) { UI.pstatus = t.value; render(); }
  else if (t.matches('[data-mmonth]')) { UI.mmonth = t.value; render(); }
  else if (t.id === 'file') { const f = t.files[0]; if (!f) return; f.text().then(async txt => { if (await ask('현재 데이터를 이 파일의 내용으로 바꿉니다. 계속할까요?', '가져오기')) { guard(() => { store.importJson(txt); render(); }, '가져왔습니다.'); } t.value = ''; }); }
});
render();
if (store.wasRecovered()) toast('저장된 데이터가 손상되어 가상 데이터로 시작했어요. 손상된 원본은 브라우저에 따로 보관돼 있어요.', true);
