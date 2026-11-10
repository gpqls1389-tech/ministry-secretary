import { createStore, kstToday } from './store.js';
import { EVENT_TEMPLATES, SERVICE_TEMPLATES, BUDGET_SUGGESTIONS, GUIDE_STEPS, TIPS, GLOSSARY, FAQ, churchInfo, churchLabel, churchYear, REPEAT_RULES, SCHEDULE_TYPES, VISIT_TYPES, ASSET_CATEGORIES, ASSET_STATUS, eventNotice, serviceNotice, weekNotice } from './templates.js';
import { toCsv, parseTable, decodeText } from './csv.js';
const lsGet = k => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* 저장소 사용 불가 */ } };

import { initAuth, accountApi, openLoginPreview, receiptApi } from './auth.js';
import { makeReceiptStore, compressImage } from './receipts.js';
import { imgSrc, emptyImgFor, bannerFor } from './images.js';
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
const KIND = { child: '아동', youth: '청년', teacher: '교사', volunteer: '봉사자' };
const PST = { applied: '신청', attended: '참석', cancelled: '취소' };
const TST = { todo: '대기', doing: '진행', done: '완료' };
const UI = { dept: 'all', year: Number(today().slice(0, 4)), month: today().slice(0, 7), planTab: 'cal', peopleTab: 'att', calSvc: false, psel: new Set(), asset: { place: '', status: '' }, rep: { month: today().slice(0, 7), rc: false } };
try { UI.dept = localStorage.getItem('ms:dept') || 'all'; } catch { /* 저장소 사용 불가 */ }
const did = () => (UI.dept === 'all' ? null : Number(UI.dept));
const workDept = () => did() || store.depts()[0].id;
const deptTag = id => { const d = store.dept(id); return d ? `<span class="tag ${id === 1 ? 'kid' : 'yth'}">${esc(d.name)}</span>` : ''; };
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
const NAV = [['home', '🏠', '홈'], ['plan', '🗓️', '일정·계획'], ['events', '🎉', '행사'], ['services', '⛪', '예배'], ['people', '👥', '인원·출석'], ['money', '💰', '회계'], ['assets', '🧰', '비품'], ['settings', '⚙️', '설정']];
function render() {
  const [view, id] = (location.hash || '#home').slice(1).split('/'); const base = view === 'event' ? 'events' : view === 'service' ? 'services' : view === 'schedule' ? 'plan' : view === 'asset' ? 'assets' : view === 'report' ? 'money' : view;
  $('#nav').innerHTML = NAV.map(([k, ico, l]) => `<a data-go="#${k}" class="${base === k ? 'on' : ''}"><span class="ico">${ico}</span>${l}</a>`).join('');
  $('#dept-box').innerHTML = [...store.depts().map(d => [String(d.id), d.name]), ['all', '전체']].map(([v, l]) => `<button data-dept="${v}" class="${UI.dept === v ? 'on' : ''}">${l}</button>`).join('');
  paintAcct();
  document.body.dataset.theme = UI.dept === 'all' ? 'all' : (did() === 1 ? 'kid' : did() === 2 ? 'youth' : 'all'); // 아동부 노랑 · 청년부 파랑 · 전체 초록
  const bar = $('#demo-bar'); const demo = store.get().demo;
  bar.hidden = !demo && !window.__memOnly; bar.innerHTML = window.__memOnly ? '이 브라우저는 저장을 허용하지 않아 입력한 내용이 창을 닫으면 사라집니다.' : '가상 데이터로 체험 중입니다. 설정에서 ‘실제 데이터로 시작’을 누르면 비어 있는 상태로 시작합니다.';
  const V = { home: vHome, plan: vPlan, events: vEvents, event: vEvent, services: vServices, service: vService, schedule: vSchedule, assets: vAssets, asset: vAsset, report: vReport, people: vPeople, money: vMoney, settings: vSettings, 'login-preview': vLoginPreview }[view] || vHome;
  $('#main').innerHTML = ''; V(id ? Number(id) : null); document.body.classList.remove('nav-open');
  $('#crumb').textContent = (NAV.find(n => n[0] === base) || NAV[0])[2] + (UI.dept === 'all' ? '' : ' · ' + (store.dept(did()) || {}).name);
}
window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });
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
  const scope = UI.dept === 'all' ? '아동부·청년부' : (store.dept(did()) || {}).name; const month = Number(t.slice(5, 7));
  const todayN = H.week.filter(i => i.date <= t && i.end >= t).length; const overN = H.tasks.filter(k => k.overdue).length;
  const totB = H.budget.reduce((a, b) => a + b.budget, 0), totE = H.budget.reduce((a, b) => a + b.expense, 0);
  const monthExp = store.transactions({ deptId: did(), year: UI.year, month }).filter(x => x.kind === 'expense').reduce((a, x) => a + x.amount, 0);
  const items = H.week.map(i => { const isToday = i.date <= t && i.end >= t; return `<div class="sched" data-open="${i.type}/${i.id}"><div class="datebox ${isToday ? 'today' : ''}"><small>${dow(i.date)}</small><b>${Number(i.date.slice(8))}</b></div><div class="what"><b>${typeIco(i)} ${esc(i.title)}</b><span>${i.end !== i.date ? esc(range(md(i.date), md(i.end))) : [i.time ? esc(i.time) : '', i.type === 'service' ? esc(churchLabel(i.date)) : i.type === 'schedule' ? esc(i.kind || '일정') : '행사'].filter(Boolean).join(' · ')}${isToday ? ' · 오늘' : ''}</span></div>${deptTag(i.dept_id)}</div>`; }).join('');
  const tasks = H.tasks.slice(0, 8).map(k => { const [c, l] = k.due ? dday(k.due) : ['', '기한 없음']; return `<div class="todo"><input type="checkbox" data-task="${k.id}" aria-label="완료"><div class="sp"><div class="tt">${esc(k.title)}</div><div class="mute small">${esc(k.event.title)}${k.assignee ? ' · ' + esc(k.assignee) : ''}</div></div><span class="tag ${c}">${l}</span></div>`; }).join('');
  const budget = H.budget.map(b => { const pct = b.budget ? Math.round(b.expense / b.budget * 100) : 0; return `<div class="pad"><div class="row"><b>${esc(b.dept.name)}</b><span class="sp"></span>${b.budget && b.expense > b.budget ? '<span class="tag bad">예산 초과</span>' : `<span class="tag blue">${b.budget ? pct + '% 사용' : '예산 없음'}</span>`}</div><div style="margin:10px 0 14px">${barHtml(b.expense, b.budget)}</div><div class="dl"><div><div class="k">예산</div><div class="v">${won(b.budget)}</div></div><div><div class="k">지출</div><div class="v">${won(b.expense)}</div></div><div><div class="k">예산 잔액</div><div class="v" style="color:${b.budget_remaining < 0 ? 'var(--orange)' : 'var(--primary-dk)'}">${won(b.budget_remaining)}</div></div><div><div class="k">수입·지출 차액</div><div class="v" style="color:${b.net < 0 ? 'var(--orange)' : 'var(--good)'}">${won(b.net)}</div></div></div></div>`; }).join('<div style="border-top:1px solid var(--line)"></div>');
  const actions = '<button class="pri" data-act="newEvent">+ 행사</button><button data-act="newService">+ 예배</button><button data-act="newSchedule">+ 일정</button><button data-act="newTx">+ 지출 등록</button><button data-go="#services">출석 기록</button><button data-act="notice" data-kind="week">이번 주 안내 문구</button>';
  page('🏠', '홈', `${H.today} (${dow(H.today)}) · ${esc(scope)}`, `${backupNote}
  <div class="statrow">
    <div class="card sc"><div class="k">이번 주 일정</div><div class="v">${H.week.length}건</div><div class="s">오늘 ${todayN}건 · ${md(H.from)} ~ ${md(H.to)}</div></div>
    <div class="card sc ${overN ? 'warn' : ''}"><div class="k">준비할 일</div><div class="v">${H.tasks.length}건</div><div class="s">${overN ? `<span class="tag bad">기한 지남 ${overN}건</span>` : '기한 지난 업무 없음'}</div></div>
    <div class="card sc"><div class="k">${month}월 지출</div><div class="v">${won(monthExp)}</div><div class="s">${UI.year}년 누계 ${won(totE)}</div></div>
    <div class="card sc key"><div class="k">예산 잔액</div><div class="v">${won(totB - totE)}</div><div class="s">${totB ? `예산 ${won(totB)} 중 ${Math.round(totE / totB * 100)}% 사용` : '예산 항목을 입력하세요'}</div></div>
  </div>
  <div class="cols">
    <section class="box"><div class="cardh"><h3>이번 주 일정</h3><span class="sub">${md(H.from)} ~ ${md(H.to)}</span><span class="sp"></span><button class="sm" data-go="#plan">달력 보기</button></div><div class="cardb">${items || emptyState('이번 주 일정이 없어요', '예배나 행사를 등록하면 여기에 모입니다.', '<button class="sm" data-act="newService">+ 예배</button><button class="sm" data-act="newEvent">+ 행사</button>')}</div></section>
    <section class="box"><div class="cardh"><h3>준비할 일</h3><span class="tag">${H.tasks.length}</span><span class="sp"></span><button class="sm" data-go="#events">행사 보기</button></div><div class="cardb">${tasks || emptyState('남은 준비 업무가 없어요', store.get().events.length ? '모든 준비를 마쳤어요. 🎉' : '행사를 만들 때 ‘예시로 시작’을 고르면 준비 업무와 마감일이 자동으로 만들어져요.', store.get().events.length ? '' : '<button class="sm" data-act="newEvent">+ 행사 만들기</button>')}${H.tasks.length > 8 ? `<p class="mute small" style="margin:8px 12px">외 ${H.tasks.length - 8}건은 각 행사에서 볼 수 있어요.</p>` : ''}</div></section>
  </div>
  <section class="box" style="margin-top:20px"><div class="cardh"><h3>예산 현황</h3><span class="sub">${UI.year}년</span><span class="sp"></span><button class="sm" data-go="#money">회계 보기</button></div>${budget}</section>
  ${guide}`, actions);
}

// ----- 일정·계획 -----
function vPlan() {
  const tabs = `<div class="tabs"><a data-ptab="cal" class="${UI.planTab === 'cal' ? 'on' : ''}">월 달력</a><a data-ptab="list" class="${UI.planTab === 'list' ? 'on' : ''}">일정 목록</a><a data-ptab="year" class="${UI.planTab === 'year' ? 'on' : ''}">연간·절기 계획</a></div>`;
  if (UI.planTab === 'cal') {
    const [y, m] = UI.month.split('-').map(Number); const dim = new Date(Date.UTC(y, m, 0)).getUTCDate(); const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
    const items = store.calendar(did(), `${UI.month}-01`, `${UI.month}-${pad(dim)}`, { services: UI.calSvc }); const cells = [];
    for (let i = 0; i < lead; i++) cells.push('<div class="out"></div>');
    for (let d = 1; d <= dim; d++) { const ds = `${UI.month}-${pad(d)}`; cells.push(`<div class="${ds === today() ? 'today' : ''}"><b>${d}</b>${dow(ds) === '일' ? `<small class="cs" title="교회력(자동 계산)"><i style="background:${churchInfo(ds).colorHex}"></i>${esc(churchInfo(ds).special || churchInfo(ds).label)}</small>` : ''}${items.filter(i => i.date <= ds && i.end >= ds).map(i => `<a class="d${i.dept_id}" data-open="${i.type}/${i.id}" title="${esc(i.title)}">${typeIco(i)} ${esc(i.title)}</a>`).join('')}</div>`); }
    const prev = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7), next = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);
    page('🗓️', '일정·계획', '일정(교사 기도회·회의)과 행사를 모아 보는 달력이에요. 주일예배는 ‘예배’ 메뉴에서 관리하고, 필요하면 아래에서 함께 볼 수 있어요.', `${tabs}<div class="row" style="margin-bottom:10px"><button data-month="${prev}">◀</button><b>${y}년 ${m}월</b><button data-month="${next}">▶</button><button data-month="${today().slice(0, 7)}">오늘</button><label class="small noprint" style="margin-left:8px"><input type="checkbox" data-calsvc${UI.calSvc ? ' checked' : ''}> 예배도 함께 보기</label><span class="sp"></span><button class="pri sm noprint" data-act="newSchedule">+ 일정</button></div><div class="cal">${['월', '화', '수', '목', '금', '토', '일'].map(w => `<div class="h">${w}</div>`).join('')}${cells.join('')}</div>`);
  } else {
    if (UI.planTab === 'list') return vScheduleList(tabs);
    const d = workDept(); const P = store.plan(d, UI.year); const autoSeasons = !store.seasons(d, UI.year).length ? guard(() => store.loadSeasonTemplate(d, UI.year)) : 0; const seasons = store.seasons(d, UI.year);
    const evs = store.get().events.filter(e => e.dept_id === d && e.start_date.startsWith(String(UI.year))).sort((a, b) => a.start_date.localeCompare(b.start_date));
    page('🗓️', '일정·계획', `${deptTag(d)} ${UI.dept === 'all' ? '<span class="mute small">(전체 보기에서는 첫 부서를 표시합니다)</span>' : ''}`, `${tabs}<div class="row"><b>${store.dept(d).name}</b>${yearSel()}</div>
    <h2>교회력 <span class="mute small">${UI.year}년 · 자동 계산</span></h2><div class="tablewrap"><table class="t"><thead><tr><th>절기</th><th>전례 색</th><th>기간</th><th>설명</th></tr></thead><tbody>${churchYear(UI.year).map(s => `<tr><td><b>${esc(s.name)}</b></td><td>${esc(s.color)}</td><td>${esc(s.start)} ~ ${esc(s.end)}</td><td class="mute small">${esc(s.note)}</td></tr>`).join('')}</tbody></table></div><p class="mute small">서방 교회력의 일반 규칙으로 계산한 값이에요. 교단·교회마다 절기 이름과 주차 세는 방법이 조금 다를 수 있으니 확인해서 쓰세요. 달력과 예배 목록에는 이 계산 결과가 자동으로 표시돼요.${autoSeasons ? ` 아래 ‘절기 계획’에는 ${UI.year}년 기본 절기 ${autoSeasons}개를 자동으로 넣었어요.` : ''}</p>
    <h2>사역 목표</h2><textarea id="goal" placeholder="올해 사역 목표">${esc(P.goal)}</textarea>
    <h2>월별 교육 주제 <button class="sm noprint" data-act="themeTpl">예시 넣기</button></h2><p class="mute small noprint" style="margin:-6px 0 10px">비어 있는 달만 예시로 채웁니다. 이미 적은 달은 바뀌지 않아요. 채운 뒤 우리 교회에 맞게 고쳐 쓰세요.</p><div class="tablewrap"><table class="t"><tbody>${Array.from({ length: 12 }, (_, i) => `<tr><td style="width:60px">${i + 1}월</td><td><input class="cell-in" data-theme="${i + 1}" value="${esc(P.themes[i + 1] || '')}" placeholder="교육 주제"></td></tr>`).join('')}</tbody></table></div>
    <div class="row" style="margin-top:8px"><button class="pri" data-act="savePlan">목표·주제 저장</button></div>
    <h2>절기 계획 <button class="sm noprint" data-act="editSeason">+ 추가</button> <button class="sm noprint" data-act="seasonTpl">절기 예시 넣기</button></h2><p class="mute small noprint" style="margin:-6px 0 10px">사순절·부활절·어린이주일·성령강림절·추수감사절·대림절·성탄절을 ${UI.year}년 날짜로 계산해 넣습니다. 교회마다 날짜가 다른 절기는 꼭 확인해 수정하세요.</p>
    <table class="t"><thead><tr><th>절기</th><th>기간</th><th>주제·본문</th><th>계획</th><th></th></tr></thead><tbody>${seasons.map(s => `<tr><td><b>${esc(s.name)}</b></td><td>${esc(s.start || '')}${s.end && s.end !== s.start ? ' ~ ' + esc(s.end) : ''}</td><td>${esc(s.theme)}<br><span class="mute small">${esc(s.scripture)}</span></td><td>${esc(s.plan)}</td><td><button class="sm" data-act="editSeason" data-id="${s.id}">수정</button> <button class="sm dng" data-act="delSeason" data-id="${s.id}">삭제</button></td></tr>`).join('') || `<tr><td colspan="5">${emptyState('등록된 절기가 없어요', '‘절기 예시 넣기’를 누르면 올해 날짜로 한 번에 채워져요. 날짜는 해마다 달라지니 확인 후 수정하세요.', '<button class="sm" data-act="seasonTpl">절기 예시 넣기</button>')}</td></tr>`}</tbody></table>
    <h2>올해 행사</h2><table class="t"><tbody>${evs.map(e => `<tr class="link" data-open="event/${e.id}"><td style="width:92px">${md(e.start_date)}</td><td>${esc(e.title)}</td><td class="num">${e.expected_budget ? won(e.expected_budget) : ''}</td></tr>`).join('') || '<tr><td class="mute">행사가 없습니다.</td></tr>'}</tbody></table>`);
  }
}

// ----- 행사 -----
const EVT = ['행사', '여름성경학교', '겨울성경학교', '수련회', '절기행사', '봉사·선교', '기타'];
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
    onSubmit: o => { const key = o.tpl; const id = store.saveEvent({ ...v, ...o, dept_id: Number(o.dept_id) }); if (isNew && key) { const r = store.applyEventTemplate(id, key); toast(`준비 업무 ${r.tasks}개, 준비물 ${r.supplies}개를 만들었어요.`); } if (isNew) location.hash = `#event/${id}`; } });
}
function vEvents() {
  const list = store.get().events.filter(e => (!did() || e.dept_id === did()) && e.start_date.startsWith(String(UI.year))).sort((a, b) => a.start_date.localeCompare(b.start_date));
  const others = store.get().events.filter(e => !did() || e.dept_id === did()).length - list.length;
  page('🎉', '행사', `${yearSel()} <span class="mute small">행사를 누르면 준비 업무·참가·결산을 볼 수 있습니다.</span>`, `<div class="row noprint" style="margin-bottom:12px"><button class="pri" data-act="newEvent">+ 새 행사</button></div>
  <div class="tablewrap"><table class="t"><thead><tr><th>일정</th><th>행사</th><th>부서</th><th class="num">목표</th><th class="num">신청</th><th class="num">참석</th><th class="num">지출</th><th>상태</th></tr></thead><tbody>${list.map(e => { const s = store.eventSummary(e.id); return `<tr class="link" data-open="event/${e.id}"><td>${esc(range(md(e.start_date), md(e.end_date)))}</td><td><b>${esc(e.title)}</b><br><span class="mute small">${esc(e.type)}</span></td><td>${deptTag(e.dept_id)}</td><td class="num">${e.target_count || '-'}</td><td class="num">${s.registered}</td><td class="num">${s.attended}</td><td class="num">${won(s.expense)}</td><td>${e.status === 'done' ? '<span class="tag ok">완료</span>' : e.status === 'cancelled' ? '<span class="tag bad">취소</span>' : '<span class="tag">예정</span>'}</td></tr>`; }).join('') || `<tr><td colspan="8">${emptyState(others > 0 ? '이 해에는 행사가 없어요' : '아직 행사가 없어요', others > 0 ? `다른 해에 행사가 ${others}개 있어요. 위에서 연도를 바꿔 보세요.` : '예: 여름성경학교, 수련회, 성탄 발표회. ‘새 행사’에서 <b>예시로 시작</b>을 고르면 준비 업무와 마감일이 자동으로 만들어져요.', '<button class="sm pri" data-act="newEvent">+ 새 행사</button>')}</td></tr>`}</tbody></table></div>`);
}
function vEvent(id) {
  const e = store.ev(id); if (!e) { page('🎉', '행사', '', '<div class="callout bad">행사를 찾을 수 없습니다.</div>'); return; }
  const s = store.eventSummary(id); const tasks = store.get().tasks.filter(t => t.event_id === id); const parts = store.participants(id).sort((a, b) => (a.person.class_name || '').localeCompare(b.person.class_name || '', 'ko')); const tx = store.transactions({ eventId: id });
  page('🎉', e.title, `${deptTag(e.dept_id)} ${esc(e.type)}`, `${(() => { const b = bannerFor(e.type, e.title, e.dept_id); return `<div class="banner${b.src ? ' has-img' : ''}" style="--bn1:${b.c1};--bn2:${b.c2}">${b.src ? `<img src="${b.src}" alt="">` : ''}<span class="em">${b.em}</span><div><b>${esc(e.title)}</b><span class="t">${esc(range(e.start_date, e.end_date))}</span></div></div>`; })()}<div class="row noprint"><button data-go="#events">◀ 목록</button><button data-act="editEvent" data-id="${id}">수정</button><button data-act="applyTpl" data-id="${id}">예시 준비 업무 추가</button><button data-act="notice" data-kind="event" data-id="${id}">안내 문구</button><select data-evstatus="${id}">${[['planned', '예정'], ['done', '완료'], ['cancelled', '취소']].map(([v, l]) => `<option value="${v}"${e.status === v ? ' selected' : ''}>${l}</option>`).join('')}</select><span class="sp"></span><button class="dng" data-act="delEvent" data-id="${id}">삭제</button></div>
  <dl class="props" style="margin-top:14px"><dt>일정</dt><dd>${esc(range(e.start_date, e.end_date))}</dd><dt>장소</dt><dd>${esc(e.place) || '-'}</dd><dt>담당자</dt><dd>${esc(e.owner) || '-'}</dd><dt>목표 인원</dt><dd>${e.target_count || '-'}명</dd><dt>예상 예산</dt><dd>${won(e.expected_budget)}</dd>${e.note ? `<dt>메모</dt><dd>${esc(e.note)}</dd>` : ''}</dl>
  <h2>준비할 일 <button class="sm" data-act="newTask" data-id="${id}">+ 추가</button></h2>${tasks.map(k => `<div class="todo ${k.status === 'done' ? 'done' : ''}"><input type="checkbox" data-task="${k.id}" ${k.status === 'done' ? 'checked' : ''} aria-label="완료"><span class="tt sp">${esc(k.title)} <span class="mute small">${esc(k.assignee)}</span></span>${k.due ? `<span class="tag ${k.status !== 'done' && k.due < today() ? 'bad' : ''}">${md(k.due)}</span>` : ''}<button class="sm ghost" data-act="delTask" data-id="${k.id}" aria-label="삭제">✕</button></div>`).join('') || emptyState('준비 업무가 없어요', '‘+ 추가’로 직접 적거나, 위의 ‘예시 준비 업무 추가’로 이 행사에 맞는 예시를 불러오세요.', '')}
  <h2>준비물 <button class="sm" data-act="newSupply" data-id="${id}">+ 추가</button></h2>${store.supplies(id).map(x => `<div class="todo ${x.done ? 'done' : ''}"><input type="checkbox" data-supply="${x.id}" ${x.done ? 'checked' : ''} aria-label="준비 완료"><span class="tt sp">${esc(x.name)}</span><button class="sm ghost" data-act="delSupply" data-id="${x.id}" aria-label="삭제">✕</button></div>`).join('') || '<p class="mute small">준비물이 없어요. ‘+ 추가’로 적거나 행사 예시를 적용하면 채워져요.</p>'}
  <h2>참가 현황</h2><div class="cols3" style="margin-bottom:12px"><div class="card stat"><div class="v">${s.registered}<span class="mute small"> / 목표 ${e.target_count || '-'}</span></div><div class="l">신청 (취소 제외)</div></div><div class="card stat"><div class="v">${s.attended}</div><div class="l">실제 참석</div></div><div class="card stat"><div class="v">${s.first_time}</div><div class="l">처음 온 사람 · 취소 ${s.cancelled}</div></div></div>
  <div class="row noprint" style="margin-bottom:8px"><button data-act="addPart" data-id="${id}">+ 부서원 등록</button><button data-act="addNew" data-id="${id}">+ 처음 온 사람</button></div>
  <div class="tablewrap"><table class="t"><thead><tr><th>이름</th><th>반</th><th>구분</th><th>상태</th><th></th></tr></thead><tbody>${parts.map(p => `<tr><td>${esc(p.person.name)}${p.person.birth_year ? ` <span class="mute small">${p.person.birth_year}년생</span>` : ''}</td><td>${esc(p.person.class_name)}</td><td>${p.first_time ? '<span class="tag warn">처음</span>' : ''}</td><td><select data-pstat="${id}/${p.person_id}">${Object.entries(PST).map(([v, l]) => `<option value="${v}"${p.status === v ? ' selected' : ''}>${l}</option>`).join('')}</select></td><td><button class="sm ghost" data-act="delPart" data-id="${id}/${p.person_id}">제외</button></td></tr>`).join('') || '<tr><td colspan="5" class="mute">참가자를 등록하세요.</td></tr>'}</tbody></table></div>
  <h2>결산 <button class="sm" data-act="newTx" data-ev="${id}">+ 지출·수입</button></h2><div class="cols3" style="margin-bottom:12px"><div class="card stat"><div class="v">${won(s.expense)}</div><div class="l">지출 (예상 예산 ${won(e.expected_budget)})</div></div><div class="card stat"><div class="v">${won(s.budget_remaining)}</div><div class="l">예산 잔액 (예산−지출)</div></div><div class="card stat"><div class="v" style="color:${s.net < 0 ? 'var(--red)' : 'var(--green)'}">${won(s.net)}</div><div class="l">수입·지출 차액 (수입 ${won(s.income)})</div></div></div>${txTable(tx)}`);
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
    { k: 'dept_id', label: '부서', type: 'select', options: deptOpts() }, { k: 'title', label: '예배명', req: true, ph: '예: 어린이 주일예배' }, { k: 'kind', label: '구분', type: 'select', options: [['regular', '정기예배'], ['special', '특별예배']], hint: '출석부에는 정기예배만 나와요.' }, { k: 'date', label: '날짜', type: 'date', req: true }, { k: 'time', label: '시간', type: 'time' }, { k: 'place', label: '장소' }, ...(!v.id ? REPEAT_FIELDS : []),
    { k: 'scripture', label: '성경 본문 (개역개정, 장·절)', ph: '예: 시편 23:1-6', hint: '직접 입력하는 칸이에요. 개역개정 본문을 확인하세요.' }, { k: 'sermon_title', label: '설교 제목' }, { k: 'leader', label: '담당자' }, { k: 'order_text', label: '예배 순서', type: 'textarea', ph: '줄마다 한 순서씩' }];
  form({ title: v.id ? '예배 수정' : '예배 추가', values: { dept_id: workDept(), date: today(), kind: 'regular', repeat: 'none', ...v }, fields,
    onOpen: d => { churchHint(d); const sel = d.querySelector('[name=tpl]'); if (!sel) return; sel.onchange = () => { const t = SERVICE_TEMPLATES[sel.value]; if (!t) return; const o = d.querySelector('[name=order_text]'); if (!o.value.trim() || o.dataset.auto === '1') { o.value = t.order; o.dataset.auto = '1'; } if (sel.value === 'special') d.querySelector('[name=kind]').value = 'special'; }; },
    onSubmit: o => { const id = store.saveService({ ...v, ...o, dept_id: Number(o.dept_id) }); if (!v.id) { const ls = store.lastSeries(); seriesToast(); location.hash = ls.made > 1 ? '#services' : `#service/${id}`; } } });
}
function vServices() {
  const list = store.services(did()).filter(s => s.date.startsWith(String(UI.year)));
  const others = store.services(did()).length - list.length;
  page('⛪', '예배', `${yearSel()}`, `<div class="row noprint" style="margin-bottom:12px"><button class="pri" data-act="newService">+ 새 예배</button></div><div class="tablewrap"><table class="t"><thead><tr><th>날짜</th><th>예배</th><th>교회력</th><th>부서</th><th>설교 제목</th><th class="num">출석</th></tr></thead><tbody>${list.map(s => { const c = store.attendanceCount(s.id); return `<tr class="link" data-open="service/${s.id}"><td>${md(s.date)} <span class="mute small">${esc(s.time)}</span></td><td><b>${esc(s.title)}</b> ${s.kind === 'special' ? '<span class="tag warn">특별</span>' : ''}</td><td><span class="lcdot" style="background:${churchInfo(s.date).colorHex}"></span>${esc(churchLabel(s.date))}</td><td>${deptTag(s.dept_id)}</td><td>${esc(s.sermon_title)}</td><td class="num">${c.recorded ? c.present + '명' : '<span class="mute">미기록</span>'}</td></tr>`; }).join('') || `<tr><td colspan="6">${emptyState(others > 0 ? '이 해에는 예배가 없어요' : '아직 예배가 없어요', others > 0 ? `다른 해에 예배가 ${others}개 있어요. 위에서 연도를 바꿔 보세요.` : '예배를 만들고 눌러서 출석을 체크해요. ‘예시로 시작’을 고르면 예배 순서가 채워지고, ‘반복’을 매주로 하면 한 해 주일예배를 한 번에 만들 수 있어요.', '<button class="sm pri" data-act="newService">+ 예배 만들기</button>')}</td></tr>`}</tbody></table></div>`);
}
const AT = { cls: '' };
function vService(id) {
  const s = store.service(id); if (!s) { page('⛪', '예배', '', '<div class="callout bad">예배를 찾을 수 없습니다.</div>'); return; }
  const people = store.people({ deptId: s.dept_id }); const classes = [...new Set(people.map(p => p.class_name).filter(Boolean))]; const att = new Map(store.get().attendance.filter(a => a.service_id === id).map(a => [a.person_id, a.present]));
  const shown = people.filter(p => !AT.cls || p.class_name === AT.cls); const c = store.attendanceCount(id);
  page('⛪', s.title, `${deptTag(s.dept_id)} ${md(s.date)} ${esc(s.time)} ${esc(s.place)} · ${esc(churchLabel(s.date))}`, `<div class="row noprint"><button data-go="#services">◀ 목록</button><button data-act="editService" data-id="${id}">수정</button><button data-act="cloneService" data-id="${id}">다음 예배로 복제</button>${store.seriesCount('service', id) > 1 ? `<button data-act="delSeries" data-kind="service" data-id="${id}">이 날짜부터 반복 ${store.seriesCount('service', id)}개 삭제</button>` : ''}<button data-act="print">인쇄</button><button data-act="notice" data-kind="service" data-id="${id}">안내 문구</button><span class="sp"></span><button class="dng" data-act="delService" data-id="${id}">삭제</button></div>
  <dl class="props" style="margin-top:14px"><dt>교회력</dt><dd><span class="lcdot" style="background:${churchInfo(s.date).colorHex}"></span>${esc(churchLabel(s.date))} <span class="mute small">(자동 계산)</span></dd><dt>성경 본문</dt><dd>${esc(s.scripture) || '-'}</dd><dt>설교 제목</dt><dd>${esc(s.sermon_title) || '-'}</dd><dt>담당</dt><dd>${esc(s.leader) || '-'}</dd><dt>순서</dt><dd style="white-space:pre-wrap">${esc(s.order_text) || '-'}</dd></dl>
  <h2>출석 체크 <span class="tag ok">출석 ${c.present}명</span> <span class="tag">기록 ${c.recorded}명</span></h2><p class="mute small noprint">이름을 누르면 바로 저장됩니다. 같은 회차에서 한 사람은 한 번만 집계되고, 복제한 예배의 출석은 비어 있습니다.</p>
  <div class="row noprint" style="margin-bottom:10px"><button data-cls="" class="${!AT.cls ? 'pri' : ''}">전체</button>${classes.map(x => `<button data-cls="${esc(x)}" class="${AT.cls === x ? 'pri' : ''}">${esc(x)}</button>`).join('')}<span class="sp"></span><button data-act="allPresent" data-id="${id}">보이는 인원 전원 출석</button><button data-act="newPersonHere" data-id="${id}">+ 새 사람</button></div>
  <div class="att-list">${shown.map(p => `<label class="att-row ${att.get(p.id) ? 'on' : ''}"><span class="who"><span class="avatar k${s.dept_id}">${esc(p.name.slice(0, 1))}</span><span style="min-width:0"><b>${esc(p.display)}</b><span class="mute small">${esc(p.class_name)}${p.kind === 'teacher' ? ' · 교사' : ''}</span></span></span><span class="chk"><input type="checkbox" data-att="${id}/${p.id}" ${att.get(p.id) ? 'checked' : ''} aria-label="${esc(p.name)} 출석"><i><span class="y">✓ 출석</span><span class="n">출석 체크</span></i></span></label>`).join('') || emptyState('명단이 없어요', '인원·출석에서 이 부서의 인원을 먼저 등록하세요.', '<button class="sm pri" data-go="#people">인원 등록하러 가기</button>')}</div>`);
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
  page('🗓️', '일정·계획', '교사 기도회·회의 같은 모임을 등록해요. ‘반복’을 쓰면 여러 주를 한 번에 만들 수 있어요.', `${tabs}<div class="row noprint" style="margin-bottom:12px"><button class="pri" data-act="newSchedule">+ 새 일정</button></div><div class="tablewrap"><table class="t"><thead><tr><th>날짜</th><th>일정</th><th>구분</th><th>부서</th><th>장소</th></tr></thead><tbody>${rows.map(s => `<tr class="link${s.date < t ? ' former' : ''}" data-open="schedule/${s.id}"><td>${md(s.date)} <span class="mute small">${esc(s.time)}</span></td><td><b>${esc(s.title)}</b></td><td>${esc(s.type)}</td><td>${deptTag(s.dept_id)}</td><td>${esc(s.place)}</td></tr>`).join('') || `<tr><td colspan="5">${emptyState('등록된 일정이 없어요', '교사 기도회·교사 회의 같은 모임을 넣어 보세요. 매주 하는 모임은 ‘반복’을 매주로 하면 한 번에 만들어져요.', '<button class="sm pri" data-act="newSchedule">+ 일정 만들기</button>')}</td></tr>`}</tbody></table></div><p class="mute small">지난 일정은 최근 5개만 보여요.</p>`);
}

// ----- 인원·출석 -----
function vPeople() {
  const tabs = `<div class="tabs"><a data-pptab="att" class="${UI.peopleTab === 'att' ? 'on' : ''}">출석부</a><a data-pptab="roster" class="${UI.peopleTab === 'roster' ? 'on' : ''}">명단</a><a data-pptab="visit" class="${UI.peopleTab === 'visit' ? 'on' : ''}">심방·돌봄</a></div>`;
  if (UI.peopleTab === 'att') {
    const d = workDept(); const M = store.attendanceMatrix(d, { last: 8 });
    page('👥', '인원·출석', `${deptTag(d)} 최근 정기예배 ${M.services.length}회 · ○ 출석 · × 결석 · 빈칸 미기록 ${UI.dept === 'all' ? '<span class="mute small">(전체 보기에서는 첫 부서)</span>' : ''}`, `${tabs}<div class="row noprint" style="margin-bottom:10px"><button data-act="print">인쇄</button><button data-act="csvAtt">엑셀(CSV)로 내려받기</button></div><div class="tablewrap"><table class="t att"><thead><tr><th>이름 (반)</th>${M.services.map(s => `<th title="${esc(s.title)}" class="${s.date === today() ? 'cur' : ''}"><a data-open="service/${s.id}" style="cursor:pointer">${Number(s.date.slice(5, 7))}/${Number(s.date.slice(8))}<small>${dow(s.date)}</small></a></th>`).join('')}<th>출석</th><th>출석률</th></tr></thead><tbody>${M.rows.map(r => `<tr class="${r.former ? 'former' : ''}"><td><div class="who"><span class="avatar sm k${d}">${esc(r.person.name.slice(0, 1))}</span><span><b>${esc(r.person.name)}</b>${r.person.birth_year && M.rows.filter(x => x.person.name === r.person.name).length > 1 ? ` <span class="mute small">${r.person.birth_year}년생</span>` : ''}<br><span class="mute small">${esc(r.person.class_name)}${r.former ? ' · 이전 부서원' : ''}</span></span></div></td>${r.cells.map(c => `<td class="${c === 1 ? 'p' : c === 0 ? 'a' : 'n'}"><span class="mk" title="${c === 1 ? '출석' : c === 0 ? '결석' : '미기록'}">${c === 1 ? '✓' : c === 0 ? '✕' : '·'}</span></td>`).join('')}<td><b>${r.present}</b></td><td class="rate ${r.rate !== null && r.rate < 50 ? 'lo' : ''}">${r.rate === null ? '-' : r.rate + '%'}${r.rate === null ? '' : barHtml(r.rate, 100)}</td></tr>`).join('') || `<tr><td colspan="${M.services.length + 3}">${emptyState('아직 출석 기록이 없어요', '먼저 ‘인원’을 등록하고, ‘예배’에서 정기예배를 만들어 출석을 체크하면 이 표에 최근 8회가 모여요.', '<button class="sm" data-act="newPerson">+ 인원 등록</button><button class="sm" data-go="#services">예배로 가기</button>')}</td></tr>`}</tbody><tfoot><tr><td>합계(출석 인원)</td>${M.totals.map(n => `<td class="c">${n}</td>`).join('')}<td colspan="2"></td></tr></tfoot></table></div><p class="mute small">출석률이 50% 미만이면 빨간색으로 표시됩니다. 보호자 연락처·알레르기 같은 민감 정보는 이 앱이 수집하지 않습니다.</p>`);
  } else {
    if (UI.peopleTab === 'visit') return vVisits(tabs);
    const st = UI.pstatus || 'active'; const list = store.people({ deptId: did(), status: st }); const sel = new Set([...UI.psel].filter(id => list.some(p => p.id === id))); UI.psel = sel;
    page('👥', '인원·출석', `${list.length}명`, `${tabs}<div class="row noprint" style="margin-bottom:10px"><button class="pri" data-act="newPerson">+ 인원 등록</button><select data-pstatus><option value="active"${st === 'active' ? ' selected' : ''}>현재 명단</option><option value="graduated"${st === 'graduated' ? ' selected' : ''}>졸업·이동</option><option value="inactive"${st === 'inactive' ? ' selected' : ''}>비활성</option><option value="all"${st === 'all' ? ' selected' : ''}>전체</option></select><button data-act="csvRoster">엑셀(CSV)로 내려받기</button><button data-act="peopleTemplate">등록 양식 내려받기</button><button class="pri" data-act="peopleImport">양식으로 한꺼번에 등록</button></div>${sel.size ? `<div class="callout noprint" style="margin-bottom:10px"><span>☑️</span><div class="sp"><b>${sel.size}명 선택</b></div><button class="sm pri" data-act="bulkMove">부서·반 이동</button><button class="sm" data-act="bulkRetire">명단 제외</button><button class="sm" data-act="bulkClear">선택 해제</button></div>` : ''}<div class="tablewrap"><table class="t"><thead><tr><th style="width:34px"><input type="checkbox" data-pselall aria-label="전체 선택"${list.length && sel.size === list.length ? ' checked' : ''}></th><th>이름</th><th>구분</th><th>부서</th><th>반·조</th><th>상태</th><th></th></tr></thead><tbody>${list.map(p => `<tr class="${sel.has(p.id) ? 'picked' : ''}"><td><input type="checkbox" data-psel="${p.id}"${sel.has(p.id) ? ' checked' : ''} aria-label="${esc(p.name)} 선택"></td><td><b>${esc(p.display)}</b></td><td>${KIND[p.kind]}</td><td>${deptTag(p.dept_id)}</td><td>${esc(p.class_name)}</td><td>${p.status === 'active' ? '' : '<span class="tag">' + (p.status === 'graduated' ? '졸업·이동' : '비활성') + '</span>'}</td><td><button class="sm" data-act="editPerson" data-id="${p.id}">수정</button> <button class="sm" data-act="movePerson" data-id="${p.id}">이동</button> <button class="sm" data-act="personVisits" data-id="${p.id}">심방</button> ${p.status === 'active' ? `<button class="sm" data-act="retire" data-id="${p.id}">명단 제외</button>` : `<button class="sm" data-act="reactivate" data-id="${p.id}">복귀</button>`}</td></tr>`).join('') || `<tr><td colspan="7">${emptyState('명단이 비어 있어요', '아동·청년·교사를 반(조)과 함께 등록하세요. 출생년도를 넣으면 같은 이름도 구분돼요. 연락처 같은 민감 정보는 입력하지 마세요.', '<button class="sm pri" data-act="newPerson">+ 인원 등록</button><button class="sm" data-act="peopleImport">양식으로 한꺼번에 등록</button>')}</td></tr>`}</tbody></table></div><p class="mute small">‘명단 제외’는 현재 명단에서만 빼며 과거 출석·행사 기록은 그대로 남습니다.</p>`);
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
  page('💰', '회계', `${yearSel()} <span class="mute small">행사 지출은 부서 합계에 한 번만 포함됩니다.</span>`, `<div class="statrow five"><div class="card sc"><div class="k">예산</div><div class="v">${won(tot.b)}</div><div class="s">${UI.year}년 항목 합계</div></div><div class="card sc"><div class="k">지출</div><div class="v">${won(tot.e)}</div><div class="s">${tot.b ? `예산의 ${Math.round(tot.e / tot.b * 100)}% 사용` : '예산 없음'}</div></div><div class="card sc key"><div class="k">예산 잔액</div><div class="v" style="${tot.b - tot.e < 0 ? 'color:var(--orange)' : ''}">${won(tot.b - tot.e)}</div><div class="s">예산 − 지출${tot.b - tot.e < 0 ? ' <span class="tag bad">초과</span>' : ''}</div></div><div class="card sc"><div class="k">수입</div><div class="v">${won(tot.i)}</div><div class="s">참가비·후원 등</div></div><div class="card sc ${tot.i - tot.e < 0 ? 'warn' : ''}"><div class="k">수입·지출 차액</div><div class="v" style="${tot.i - tot.e >= 0 ? 'color:var(--good)' : ''}">${won(tot.i - tot.e)}</div><div class="s">수입 − 지출 (예산 잔액과는 다른 값)</div></div></div>
  <h2>예산 대비 집행 <button class="sm noprint" data-act="editBudget">+ 예산 항목</button></h2>${sums.map(({ d, s }) => `<h3 style="margin-top:14px">${deptTag(d.id)} <span class="mute small">행사 지출 ${won(s.event_expense)} · 행사 외 ${won(s.non_event_expense)}</span></h3><div class="tablewrap"><table class="t"><thead><tr><th>항목</th><th class="num">예산</th><th class="num">지출</th><th class="num">예산 잔액</th><th style="width:22%">집행률</th></tr></thead><tbody>${s.byCategory.map(c => `<tr><td>${esc(c.category)}</td><td class="num">${won(c.budget)}</td><td class="num">${won(c.spent)}</td><td class="num" style="color:${c.remaining < 0 ? 'var(--orange)' : 'inherit'};font-weight:600">${won(c.remaining)}</td><td><div class="row small" style="gap:6px;margin-bottom:4px"><b>${c.budget ? Math.round(c.spent / c.budget * 100) + '%' : '-'}</b>${c.remaining < 0 ? '<span class="tag bad">초과</span>' : ''}</div>${barHtml(c.spent, c.budget)}</td></tr>`).join('') || `<tr><td colspan="5">${emptyState('예산 항목이 없어요', `${UI.year}년 예산을 항목별로 넣으면 예산 잔액이 계산돼요. 예: ${BUDGET_SUGGESTIONS.slice(0, 4).join(' · ')}`, '<button class="sm pri" data-act="editBudget">+ 예산 항목 입력</button>')}</td></tr>`}</tbody><tfoot><tr><td>합계</td><td class="num">${won(s.budget)}</td><td class="num">${won(s.expense)}</td><td class="num">${won(s.budget_remaining)}</td><td>${barHtml(s.expense, s.budget)}</td></tr></tfoot></table></div>`).join('')}
  <h2>월별 수입·지출 <span class="mute small">${esc(store.dept(wd).name)}</span></h2><div class="tablewrap"><table class="t"><thead><tr><th>월</th><th class="num">수입</th><th class="num">지출</th><th class="num">차액</th></tr></thead><tbody>${mo.map(m => `<tr><td>${m.month}월</td><td class="num">${m.income ? won(m.income) : '-'}</td><td class="num">${m.expense ? won(m.expense) : '-'}</td><td class="num" style="color:${m.net < 0 ? 'var(--red)' : 'inherit'}">${m.income || m.expense ? won(m.net) : '-'}</td></tr>`).join('')}</tbody><tfoot><tr><td>합계</td><td class="num">${won(mo.reduce((a, m) => a + m.income, 0))}</td><td class="num">${won(mo.reduce((a, m) => a + m.expense, 0))}</td><td class="num">${won(mo.reduce((a, m) => a + m.net, 0))}</td></tr></tfoot></table></div>
  <h2>거래 내역 <button class="sm noprint pri" data-act="newTx">+ 지출·수입 등록</button> <button class="sm noprint" data-act="csvTx">엑셀(CSV)</button> <button class="sm noprint" data-go="#report">월 결산 보고서</button> <select class="noprint" data-mmonth><option value="">전체 월</option>${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}"${String(month) === String(i + 1) ? ' selected' : ''}>${i + 1}월</option>`).join('')}</select></h2>${txTable(store.transactions({ deptId: did(), year: UI.year, month: month || undefined }))}`);
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
  page('👥', '인원·출석', `심방·돌봄 기록 · 현재 명단 ${sum.length}명`, `${tabs}<div class="row noprint" style="margin-bottom:10px"><button class="pri" data-act="newVisit">+ 기록 추가</button><button data-act="csvVisits">엑셀(CSV)로 내려받기</button></div>${VISIT_HINT}
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
  page('🧰', '비품', `교구·악기·기기 등 ${all.length}종 ${all.some(a => a.status === '수리 중') ? '· <span class="tag warn">수리 중 ' + all.filter(a => a.status === '수리 중').length + '건</span>' : ''}`, `<div class="row noprint" style="margin-bottom:12px"><button class="pri" data-act="newAsset">+ 비품 추가</button><select data-afilter="place"><option value="">모든 장소</option>${places.map(p => `<option${f.place === p ? ' selected' : ''}>${esc(p)}</option>`).join('')}</select><select data-afilter="status"><option value="">모든 상태</option>${ASSET_STATUS.map(s => `<option${f.status === s ? ' selected' : ''}>${s}</option>`).join('')}</select><span class="sp"></span><button data-act="csvAssets">엑셀(CSV)로 내려받기</button><button data-act="print">인쇄</button></div>
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
  const [y, m] = UI.rep.month.split('-').map(Number); const R = store.monthlyReport(did(), y, m); const scope = did() ? store.dept(did()).name : '아동부·청년부 전체'; const withRc = R.rows.filter(t => t.receipt);
  page('💰', `${y}년 ${m}월 결산 보고서`, esc(scope), `<div class="row noprint" style="margin-bottom:12px"><button data-go="#money">◀ 회계</button><input type="month" data-repmonth value="${UI.rep.month}" aria-label="결산 월"><label class="small"><input type="checkbox" data-repimg${UI.rep.rc ? ' checked' : ''}> 영수증 사진도 함께 인쇄</label><span class="sp"></span><button class="pri" data-act="print">인쇄</button></div>
  <div class="statrow"><div class="card sc"><div class="k">이달 수입</div><div class="v">${won(R.income)}</div></div><div class="card sc"><div class="k">이달 지출</div><div class="v">${won(R.expense)}</div></div><div class="card sc key"><div class="k">수입 − 지출</div><div class="v" style="${R.net < 0 ? 'color:var(--orange)' : ''}">${won(R.net)}</div></div><div class="card sc"><div class="k">${y}년 ${m}월까지 누계 지출</div><div class="v">${won(R.ytdExpense)}</div></div></div>
  ${R.receipts.without ? `<div class="callout warn" style="margin-bottom:14px"><span>🧾</span><div class="sp">영수증이 붙지 않은 지출이 <b>${R.receipts.without}건 (${won(R.receipts.withoutAmount)})</b> 있어요. 종이 영수증과 맞춰 보세요.</div></div>` : (R.rows.some(t => t.kind === 'expense') ? '<div class="callout" style="margin-bottom:14px"><span>✅</span><div class="sp">이달 지출은 모두 영수증이 붙어 있어요.</div></div>' : '')}
  <h2>예산 항목별 집행</h2><div class="tablewrap"><table class="t"><thead><tr><th>항목</th><th class="num">연 예산</th><th class="num">이달 지출</th><th class="num">누계 지출</th><th class="num">예산 잔액</th></tr></thead><tbody>${R.categories.map(c => `<tr><td>${esc(c.category)}</td><td class="num">${c.budget ? won(c.budget) : '-'}</td><td class="num">${c.month ? won(c.month) : '-'}</td><td class="num">${c.ytd ? won(c.ytd) : '-'}</td><td class="num" style="color:${c.budget && c.remaining < 0 ? 'var(--orange)' : 'inherit'}">${c.budget ? won(c.remaining) : '-'}</td></tr>`).join('') || '<tr><td colspan="5" class="mute">예산 항목과 지출이 없어요.</td></tr>'}</tbody></table></div>
  <h2>거래 내역</h2><div class="tablewrap"><table class="t"><thead><tr><th>날짜</th><th>구분</th><th>항목</th><th>적요</th><th class="num">금액</th><th>영수증</th></tr></thead><tbody>${R.rows.map(t => `<tr><td>${md(t.date)}</td><td>${t.kind === 'income' ? '수입' : '지출'}</td><td>${esc(t.category)}</td><td>${esc(t.memo)}</td><td class="num">${t.kind === 'income' ? '+' : '−'}${won(t.amount)}</td><td>${t.receipt ? '있음' : t.kind === 'expense' ? '<span class="tag warn">없음</span>' : '-'}</td></tr>`).join('') || '<tr><td colspan="6" class="mute">이달 거래가 없어요.</td></tr>'}</tbody><tfoot><tr><td colspan="4">합계 (수입 ${won(R.income)} · 지출 ${won(R.expense)})</td><td class="num">${R.net < 0 ? '−' : '+'}${won(Math.abs(R.net))}</td><td></td></tr></tfoot></table></div>
  <div class="sign"><div><span>작성</span></div><div><span>검토</span></div><div><span>승인</span></div></div>
  ${UI.rep.rc && withRc.length ? `<h2 class="pagebreak">영수증 첨부</h2><div class="rc-grid">${withRc.map(t => { const s = RCP.src(t.receipt); return `<figure>${s ? `<img src="${esc(s)}" alt="영수증">` : '<div class="mute small">사진 없음</div>'}<figcaption>${md(t.date)} · ${esc(t.memo || t.category)} · ${won(t.amount)}</figcaption></figure>`; }).join('')}</div>` : ''}
  <p class="mute small noprint">이 보고서는 입력한 거래로 자동 계산돼요. 인쇄 화면에서 ‘PDF로 저장’을 고르면 파일로 보관할 수 있어요.</p>`);
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

// ----- 설정 -----
function vSettings() {
  const S = store.get(); const acct = A.mode === 'account'; const ds = store.daysSinceExport();
  const where = acct ? `<b>${esc(A.user.email)}</b> 계정의 서버 저장소에 저장됩니다. 같은 사이트를 써도 계정마다 데이터가 따로이고, 다른 기기에서 같은 계정으로 로그인하면 같은 데이터를 볼 수 있어요.` : `<b>이 브라우저(이 기기)</b>에만 저장되며 서버로 전송되지 않습니다. 다른 기기와 자동으로 공유되지 않으므로 아래 ‘내보내기’로 백업하세요.${A.reason === 'not-configured' ? ' (로그인 서버가 아직 연결되지 않았어요. README의 ‘로그인 켜기’를 따라 하면 사용자별 로그인이 켜져요.)' : ''}`;
  page('⚙️', '설정', '데이터 관리와 배포 정보', `
  ${acct ? `<h2 style="margin-top:0">내 계정</h2><div class="card"><div class="row"><div class="sp"><b>${esc(A.user.name || A.user.email)}</b><br><span class="mute small">${esc(A.user.email)}</span></div><button data-act="logout">로그아웃</button><button data-act="changePw">비밀번호 변경</button><button class="dng" data-act="deleteAcct">계정 삭제</button></div><p class="mute small" style="margin:10px 0 0">저장 상태: ${(SAVE_TXT[A.status] || SAVE_TXT.saved)[0]} · 계정을 삭제하면 서버의 내 데이터가 모두 지워져요(되돌릴 수 없음). 삭제 전에 ‘내보내기’로 백업하세요.</p></div>` : ''}
  <h2 ${acct ? '' : 'style="margin-top:0"'}>데이터</h2><div class="callout ${S.demo ? 'warn' : ''}"><span>${S.demo ? '🧪' : '📒'}</span><div>현재 <b>${S.demo ? '가상 데이터' : '실제 데이터'}</b>를 사용 중입니다. 데이터는 ${where}${ds === null ? '' : ` (마지막 내보내기: ${ds === 0 ? '오늘' : ds + '일 전'})`}</div></div>
  <div class="row" style="margin:12px 0"><button data-act="resetDemo">가상 데이터로 초기화</button><button class="pri" data-act="startEmpty">실제 데이터로 시작 (비움)</button></div>
  <h2>백업·복원 (JSON 파일)</h2><div class="row"><button data-act="export">내보내기(.json 다운로드)</button><button data-act="import">파일에서 가져오기</button><input type="file" id="file" accept="application/json,.json" hidden></div>
  <p class="mute small">내보낸 파일에는 이름 등 개인정보가 들어 있을 수 있으니 안전한 곳에만 보관하세요. 가져오면 현재 데이터가 파일 내용으로 바뀝니다(바꾸기 전에 확인합니다).</p>
  <h2>화면 미리보기</h2><div class="row"><button data-act="loginPreview">로그인 화면 미리보기</button><span class="mute small">서버 없이 모양만 보여 줘요(실제 로그인 아님).</span></div>
  <h2>글꼴·오픈소스 고지</h2><p class="small">이 사이트의 글꼴은 <b>Pretendard</b> v1.3.9(Copyright © 2021 Kil Hyung-jin, SIL Open Font License 1.1)이며 수정 없이 그대로 사용합니다. 라이선스 전문: <a href="fonts/pretendard/LICENSE.txt" target="_blank" rel="noopener">LICENSE.txt</a></p>
  <h2>개인정보 안내</h2><ul class="small"><li>이 앱은 보호자 연락처·알레르기·계좌·주민번호를 입력받지 않습니다.</li>${acct ? '<li>입력한 이름·출석·지출 기록은 이 사이트 관리자의 Cloudflare 계정(D1 데이터베이스)에 저장됩니다. 관리자는 기술적으로 저장된 데이터를 볼 수 있으니, 아이들 이름을 입력하는 것에 대해 교회의 개인정보 방침과 보호자 안내를 확인하세요.</li><li>비밀번호는 원문이 아닌 해시로 저장됩니다.</li>' : '<li>사이트 주소를 아는 사람은 누구나 앱을 열 수 있지만, 입력한 데이터는 각자의 브라우저에만 있어 서로 보이지 않습니다.</li><li>공용 PC에서는 사용 후 브라우저 데이터를 삭제해 정리하세요.</li>'}</ul>
  <h2>정보</h2><dl class="props"><dt>버전</dt><dd>0.2.0</dd><dt>저장 방식</dt><dd>${acct ? '계정별 서버 저장(Cloudflare D1)' : `localStorage (${window.__memOnly ? '사용 불가 → 임시 메모리' : '사용 중'})`}</dd><dt>통화·시간대</dt><dd>원화(정수) · Asia/Seoul</dd></dl>`);
}

// ----- 이벤트 -----
const closeDialogs = () => $$('dialog').forEach(x => x.close());
const ACT = {
  notice: d => noticeModal(d.kind, Number(d.id)),
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
