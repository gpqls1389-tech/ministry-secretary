(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const KEY = 'kcal-note-v1';
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num = v => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
const r0 = n => Math.round(n);
const r1 = n => Math.round(n * 10) / 10;
const fmt = n => r0(n).toLocaleString('ko-KR');
const pad = n => String(n).padStart(2, '0');
const dstr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const uid = () => Math.random().toString(36).slice(2, 10);

/* ================= 상태 ================= */
const DEFAULT = { profile: { sex: 'm', age: '', height: '', weight: '', activity: '1.2', goal: 'maintain', burnRate: '0.7',
  smm: '', lbm: '', fatmass: '', fatpct: '', ibBmr: '' }, foods: {}, workouts: {} };
let state = load();
let curDate = dstr(new Date());
let view = 'dash';
let selFood = null;

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.profile) return { ...DEFAULT, ...s, profile: { ...DEFAULT.profile, ...s.profile } };
  } catch (e) {}
  return structuredClone(DEFAULT);
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { toast('저장 공간이 없어 기록을 저장하지 못했어요'); } }
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2200); }

/* ================= 운동 데이터 ================= */
// 체중 70kg 기준 1회(또는 1초)당 소모 kcal 추정값 (MET 기반 근사). 체중에 비례해 보정.
const EXERCISES = {
  pushup:   { name: '푸시업',        unit: '회', kcal: 0.40 },
  squat:    { name: '스쿼트',        unit: '회', kcal: 0.32 },
  lunge:    { name: '런지(좌우 합쳐 1회)', unit: '회', kcal: 0.35 },
  situp:    { name: '윗몸일으키기',   unit: '회', kcal: 0.17 },
  burpee:   { name: '버피',          unit: '회', kcal: 1.00 },
  jack:     { name: '점핑잭',        unit: '회', kcal: 0.20 },
  climber:  { name: '마운틴클라이머', unit: '회', kcal: 0.25 },
  pullup:   { name: '턱걸이',        unit: '회', kcal: 0.90 },
  plank:    { name: '플랭크',        unit: '초', kcal: 0.06 },
  run:      { name: '달리기',        unit: 'km', kcal: 0 },
};

/* ================= 계산 ================= */
function calc() {
  const p = state.profile, w = num(p.weight), h = num(p.height), a = num(p.age);
  const ready = w > 0 && h > 0 && a > 0;
  let bmr = 0, method = '';
  if (num(p.ibBmr) > 0) { bmr = num(p.ibBmr); method = '인바디 기초대사량'; }
  else if (num(p.lbm) > 0) { bmr = 370 + 21.6 * num(p.lbm); method = '제지방량 공식(Katch-McArdle)'; }
  else if (ready) { bmr = 10 * w + 6.25 * h - 5 * a + (p.sex === 'm' ? 5 : -161); method = '키·나이·체중 공식(Mifflin-St Jeor)'; }
  const tdee = bmr * num(p.activity);
  const adj = p.goal === 'lose' ? -500 : p.goal === 'gain' ? 300 : 0;
  const floor = p.sex === 'm' ? 1500 : 1200;
  const base = bmr ? Math.max(tdee + adj, Math.min(floor, tdee)) : 0;
  const pPerKg = p.goal === 'maintain' ? 1.4 : 1.8;
  return { ready, bmr, method, tdee, adj, base, pPerKg, w: w || 70 };
}
function dayData(date) {
  const c = calc();
  const foods = state.foods[date] || [], ex = state.workouts[date] || [];
  const eaten = foods.reduce((s, f) => s + f.k * f.q, 0);
  const sum = key => foods.reduce((s, f) => s + f[key] * f.q, 0);
  const burned = ex.reduce((s, e) => s + e.kcal, 0);
  const budget = c.base + burned * num(state.profile.burnRate);
  const pT = Math.min(c.pPerKg * c.w, 0.35 * budget / 4);
  const fT = 0.25 * budget / 9;
  const cT = Math.max(0, (budget - pT * 4 - fT * 9) / 4);
  return { c, foods, ex, eaten, burned, budget,
    got: { c: sum('c'), p: sum('p'), f: sum('f') }, target: { c: cT, p: pT, f: fT } };
}
function exKcal(type, o, w) {
  const e = EXERCISES[type];
  if (type === 'run') return 1.036 * w * o.km;
  return e.kcal * (w / 70) * o.sets * o.reps;
}

/* ================= 렌더링 ================= */
function render() {
  $('#date').value = curDate;
  const warn = $('#warn');
  const c = calc();
  if (!c.ready && !num(state.profile.ibBmr)) {
    warn.hidden = false;
    warn.innerHTML = '먼저 <b>내 정보</b>에서 성별·나이·키·체중을 입력하면 목표 칼로리가 계산돼요. (지금은 체중 70kg 기준으로 운동 칼로리만 추정합니다)';
  } else warn.hidden = true;
  renderDash(); renderFood(); renderEx();
}

function renderDash() {
  const d = dayData(curDate), c = d.c;
  const left = d.budget - d.eaten;
  const ring = $('#ringFg');
  const pct = d.budget > 0 ? Math.min(d.eaten / d.budget, 1) : 0;
  ring.style.strokeDashoffset = 339.3 * (1 - pct);
  ring.classList.toggle('over', left < 0);
  $('#remain').textContent = d.budget ? fmt(Math.abs(left)) : '-';
  $('#remainLabel').textContent = left < 0 ? 'kcal 초과' : '남은 kcal';
  $('#sBudget').textContent = d.budget ? fmt(d.budget) + ' kcal' : '-';
  $('#sEaten').textContent = fmt(d.eaten) + ' kcal';
  $('#sBurn').textContent = fmt(d.burned) + ' kcal';

  const M = [['탄수화물', 'c', 'var(--c)', 4], ['단백질', 'p', 'var(--p)', 4], ['지방', 'f', 'var(--f)', 9]];
  const tk = M.reduce((s, m) => s + d.got[m[1]] * m[3], 0);
  let html = '';
  if (tk > 0) {
    html += '<div class="ratio" aria-label="섭취 탄단지 비율">' + M.map(m => `<i style="width:${d.got[m[1]] * m[3] / tk * 100}%;background:${m[2]}"></i>`).join('') + '</div>';
    html += `<p class="hint">섭취 비율 탄 ${r0(d.got.c * 4 / tk * 100)} : 단 ${r0(d.got.p * 4 / tk * 100)} : 지 ${r0(d.got.f * 9 / tk * 100)}</p>`;
  }
  html += M.map(m => {
    const g = d.got[m[1]], t = d.target[m[1]], over = t > 0 && g > t * 1.1;
    return `<div class="macro"><div class="h"><span>${m[0]}</span><span><b>${r0(g)}</b> / ${t ? r0(t) : '-'} g</span></div>
      <div class="bar"><i class="${over ? 'over' : ''}" style="width:${t ? Math.min(g / t * 100, 100) : 0}%;background:${m[2]}"></i></div></div>`;
  }).join('');
  $('#macros').innerHTML = html;

  $('#reco').innerHTML = recommend(d);

  // 최근 7일
  const days = [];
  for (let i = 6; i >= 0; i--) { const dt = new Date(curDate + 'T00:00:00'); dt.setDate(dt.getDate() - i); days.push(dstr(dt)); }
  const ds = days.map(x => ({ x, ...dayData(x) }));
  const mx = Math.max(...ds.map(z => Math.max(z.eaten, z.budget)), 1);
  const wk = ['일', '월', '화', '수', '목', '금', '토'];
  $('#week').innerHTML = ds.map(z => {
    const dt = new Date(z.x + 'T00:00:00');
    return `<div class="wd ${z.x === curDate ? 'sel' : ''}"><b>${z.eaten ? fmt(z.eaten) : ''}</b>
      <div class="col"><i class="${z.budget && z.eaten > z.budget ? 'over' : ''}" style="height:${z.eaten / mx * 100}%"></i>${z.budget ? `<u style="bottom:${z.budget / mx * 100}%"></u>` : ''}</div>
      <span>${dt.getDate()}<br>${wk[dt.getDay()]}</span></div>`;
  }).join('');

  // 요약
  if (!c.bmr) { $('#plan').innerHTML = '<p class="empty">내 정보를 입력하면 기초대사량·목표 칼로리가 여기에 표시돼요.</p>'; }
  else {
    const gl = { lose: '체지방 감량', maintain: '체중 유지', gain: '근육 증량' }[state.profile.goal];
    $('#plan').innerHTML = `<dl class="kv">
      <dt>기초대사량(BMR)</dt><dd>${fmt(c.bmr)} kcal</dd>
      <dt>BMR 산출 방식</dt><dd>${esc(c.method)}</dd>
      <dt>하루 총 소비(운동 제외)</dt><dd>${fmt(c.tdee)} kcal</dd>
      <dt>목표(${gl})</dt><dd>${fmt(c.base)} kcal</dd>
      <dt>단백질 목표</dt><dd>체중 1kg당 ${c.pPerKg}g (${r0(c.pPerKg * c.w)}g)</dd>
      <dt>지방 / 탄수화물</dt><dd>지방 약 25% / 나머지 탄수화물</dd></dl>
      <p class="hint">일반적으로 널리 쓰이는 추정 공식이며 의학적 진단·처방이 아닙니다.</p>`;
  }
}

function recommend(d) {
  const c = d.c;
  if (!d.budget) return '<p class="empty">내 정보를 입력하면 필요한 음식을 추천해 드려요.</p>';
  if (!d.foods.length) {
    return `<div class="reco-item">아직 기록이 없어요. 하루 목표는 <b>${fmt(d.budget)} kcal</b>, 단백질 <b>${r0(d.target.p)}g</b> 이상을 목표로 해 보세요.</div>
      <div class="reco-item">단백질이 풍부한 음식 예: ${topFoods('p', 99999, 5).map(f => `<b>${esc(f[0])}</b>`).join(', ')}</div>`;
  }
  const out = [];
  const left = d.budget - d.eaten;
  const lack = ['p', 'c', 'f'].map(k => ({ k, miss: d.target[k] - d.got[k], ratio: (d.target[k] - d.got[k]) / (d.target[k] || 1) }))
    .filter(x => x.ratio > 0.15).sort((a, b) => b.ratio - a.ratio);
  const label = { p: '단백질', c: '탄수화물', f: '지방' };
  if (left < 0) out.push(`<div class="reco-item">목표보다 <b>${fmt(-left)} kcal</b> 많이 먹었어요. 남은 식사는 채소·단백질 위주로 가볍게, 또는 가벼운 걷기를 추천해요.</div>`);
  if (left > 0 && lack.length) {
    lack.slice(0, 2).forEach(x => {
      const fl = topFoods(x.k, left, 5);
      if (!fl.length) return;
      out.push(`<div class="reco-item">${label[x.k]}이(가) 약 <b>${r0(x.miss)}g</b> 부족해요 (남은 칼로리 ${fmt(left)} kcal 안에서).
        <div class="chips">${fl.map(f => `<button class="chip" data-add="${FOODS.indexOf(f)}">${esc(f[0])} · ${f[1]}</button>`).join('')}</div></div>`);
    });
  }
  const over = ['p', 'c', 'f'].filter(k => d.got[k] > d.target[k] * 1.15 && d.target[k] > 0);
  if (over.length) out.push(`<div class="reco-item">${over.map(k => label[k]).join('·')}은(는) 이미 충분해요. 다음 식사에서는 줄여 보세요.</div>`);
  if (!out.length) out.push('<div class="reco-item">탄·단·지 균형이 좋아요! 👍 지금처럼 유지해 보세요.</div>');
  return out.join('');
}
// 해당 영양소 밀도가 높고, 남은 칼로리에 들어가는 음식
function topFoods(k, leftKcal, n) {
  const i = { c: 3, p: 4, f: 5 }[k];
  return FOODS.filter(f => f[2] <= Math.max(leftKcal, 0) && f[2] > 20 && f[i] * (k === 'f' ? 9 : 4) / f[2] >= (k === 'c' ? 0.6 : k === 'p' ? 0.3 : 0.5))
    .sort((a, b) => (b[i] * (k === 'f' ? 9 : 4) / b[2]) - (a[i] * (k === 'f' ? 9 : 4) / a[2])).slice(0, n);
}

function renderFood() {
  const q = $('#fSearch').value.trim().toLowerCase();
  const list = FOODS.map((f, i) => ({ f, i })).filter(x => !q || x.f[0].toLowerCase().includes(q));
  $('#fList').innerHTML = list.length ? list.map(x => `<button data-i="${x.i}" class="${selFood === x.i ? 'on' : ''}"><span>${esc(x.f[0])}</span><small>${x.f[1]} · ${x.f[2]}kcal</small></button>`).join('')
    : '<div class="empty">검색 결과가 없어요. 아래에서 직접 입력해 주세요.</div>';
  const sel = $('#fSel');
  if (selFood !== null) {
    const f = FOODS[selFood];
    sel.hidden = false;
    $('#fSelName').textContent = f[0];
    $('#fSelInfo').textContent = `${f[1]} 기준 · 탄 ${f[3]} / 단 ${f[4]} / 지 ${f[5]} g`;
  } else sel.hidden = true;

  const d = dayData(curDate);
  $('#foodTotal').textContent = d.foods.length ? `· ${fmt(d.eaten)} kcal` : '';
  if (!d.foods.length) { $('#foodLog').innerHTML = '<div class="empty">아직 기록한 음식이 없어요.</div>'; return; }
  $('#foodLog').innerHTML = ['아침', '점심', '저녁', '간식'].map(m => {
    const items = d.foods.filter(f => f.meal === m);
    if (!items.length) return '';
    return `<div class="log-group"><h3><span>${m}</span><span>${fmt(items.reduce((s, f) => s + f.k * f.q, 0))} kcal</span></h3>` +
      items.map(f => `<div class="log-item"><div class="t"><b>${esc(f.name)} × ${f.q}</b><small>${fmt(f.k * f.q)}kcal · 탄 ${r0(f.c * f.q)} 단 ${r0(f.p * f.q)} 지 ${r0(f.f * f.q)}g</small></div><button data-del-food="${f.id}" aria-label="삭제">✕</button></div>`).join('') + '</div>';
  }).join('');
}

function renderEx() {
  const sel = $('#eType');
  if (!sel.options.length) sel.innerHTML = Object.entries(EXERCISES).map(([k, e]) => `<option value="${k}">${esc(e.name)}</option>`).join('');
  const t = sel.value, box = $('#eFields');
  if (box.dataset.t !== t) {
    box.dataset.t = t;
    box.innerHTML = t === 'run'
      ? '<label>거리(km)<input id="eKm" type="number" inputmode="decimal" step="0.1" min="0"></label><label>시간(분, 선택)<input id="eMin" type="number" inputmode="decimal" min="0"></label>'
      : `<label>세트<input id="eSets" type="number" inputmode="numeric" min="1" value="1"></label><label>세트당 ${EXERCISES[t].unit === '초' ? '시간(초)' : '횟수'}<input id="eReps" type="number" inputmode="numeric" min="1"></label>`;
    $$('#eFields input').forEach(i => i.addEventListener('input', previewEx));
  }
  previewEx();
  const d = dayData(curDate);
  $('#exTotal').textContent = d.ex.length ? `· ${fmt(d.burned)} kcal` : '';
  $('#exLog').innerHTML = d.ex.length ? d.ex.map(e => `<div class="log-item"><div class="t"><b>${esc(e.label)}</b><small>약 ${fmt(e.kcal)} kcal 소모</small></div><button data-del-ex="${e.id}" aria-label="삭제">✕</button></div>`).join('')
    : '<div class="empty">아직 기록한 운동이 없어요.</div>';
}
function readEx() {
  const t = $('#eType').value, e = EXERCISES[t], w = calc().w;
  if (t === 'run') {
    const km = num($('#eKm')?.value), min = num($('#eMin')?.value);
    if (km <= 0) return null;
    const pace = min > 0 ? ` · 평균 ${r1(min / km)}분/km` : '';
    return { type: t, kcal: exKcal(t, { km }, w), label: `달리기 ${km}km${min > 0 ? ' ' + min + '분' : ''}${pace}` };
  }
  const sets = Math.max(1, num($('#eSets')?.value)), reps = num($('#eReps')?.value);
  if (reps <= 0) return null;
  return { type: t, kcal: exKcal(t, { sets, reps }, w), label: `${e.name} ${sets}세트 × ${reps}${e.unit} (총 ${sets * reps}${e.unit})` };
}
function previewEx() {
  const r = readEx();
  $('#ePreview').textContent = r ? `예상 소모: 약 ${fmt(r.kcal)} kcal` : '횟수(또는 거리)를 입력하면 칼로리가 계산돼요.';
}

/* ================= 이벤트 ================= */
function setView(v) {
  view = v;
  $$('.view').forEach(e => e.classList.toggle('active', e.id === 'v-' + v));
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === v));
  $('#title').textContent = { dash: '대시보드', food: '식단', ex: '운동', me: '내 정보' }[v];
  $('.datebox').style.visibility = v === 'me' ? 'hidden' : 'visible';
  window.scrollTo(0, 0);
}
$$('.tab').forEach(t => t.addEventListener('click', () => setView(t.dataset.view)));
const shift = n => { const d = new Date(curDate + 'T00:00:00'); d.setDate(d.getDate() + n); curDate = dstr(d); render(); };
$('#prevDay').onclick = () => shift(-1);
$('#nextDay').onclick = () => shift(1);
$('#date').onchange = e => { if (e.target.value) { curDate = e.target.value; render(); } };

// 프로필 입력
$$('[data-k]').forEach(el => {
  el.value = state.profile[el.dataset.k];
  el.addEventListener('input', () => { state.profile[el.dataset.k] = el.value; save(); render(); });
});

// 음식
$('#fSearch').addEventListener('input', () => { renderFood(); });
$('#fList').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; selFood = +b.dataset.i; renderFood(); $('#fQty').focus({ preventScroll: true }); });
function addFood(item) {
  (state.foods[curDate] ||= []).push(item); save(); render(); toast(`${item.name} 추가됨`);
}
$('#fAdd').onclick = () => {
  if (selFood === null) return;
  const f = FOODS[selFood], q = num($('#fQty').value);
  if (q <= 0) return toast('섭취량을 입력해 주세요');
  addFood({ id: uid(), meal: $('#fMeal').value, name: f[0], k: f[2], c: f[3], p: f[4], f: f[5], q });
  selFood = null; $('#fQty').value = 1; renderFood();
};
$('#cAdd').onclick = () => {
  const name = $('#cName').value.trim(), k = num($('#cK').value);
  if (!name || k <= 0) return toast('이름과 kcal를 입력해 주세요');
  addFood({ id: uid(), meal: $('#fMeal').value, name, k, c: num($('#cC').value), p: num($('#cP').value), f: num($('#cF').value), q: 1 });
  ['cName', 'cK', 'cC', 'cP', 'cF'].forEach(i => $('#' + i).value = '');
};
$('#foodLog').addEventListener('click', e => {
  const id = e.target.closest('[data-del-food]')?.dataset.delFood; if (!id) return;
  state.foods[curDate] = (state.foods[curDate] || []).filter(f => f.id !== id); save(); render();
});
$('#reco').addEventListener('click', e => {
  const b = e.target.closest('[data-add]'); if (!b) return;
  selFood = +b.dataset.add; setView('food'); renderFood();
});

// 운동
$('#eType').addEventListener('change', renderEx);
$('#eAdd').onclick = () => {
  const r = readEx(); if (!r) return toast('횟수(또는 거리)를 입력해 주세요');
  (state.workouts[curDate] ||= []).push({ id: uid(), ...r }); save();
  $$('#eFields input').forEach(i => { if (i.id !== 'eSets') i.value = ''; });
  render(); toast('운동 기록됨');
};
$('#exLog').addEventListener('click', e => {
  const id = e.target.closest('[data-del-ex]')?.dataset.delEx; if (!id) return;
  state.workouts[curDate] = (state.workouts[curDate] || []).filter(x => x.id !== id); save(); render();
});

/* ================= 인바디 PDF ================= */
const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
let pdfLib;
async function loadPdfJs() {
  if (pdfLib) return pdfLib;
  await new Promise((res, rej) => { const s = document.createElement('script'); s.src = PDFJS + 'pdf.min.js'; s.onload = res; s.onerror = () => rej(new Error('pdf.js 로드 실패')); document.head.appendChild(s); });
  const code = await (await fetch(PDFJS + 'pdf.worker.min.js')).text();
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
  return (pdfLib = window.pdfjsLib);
}
const FIELDS = [
  ['weight', '체중(kg)', ['체중', 'Weight'], 25, 250],
  ['smm', '골격근량(kg)', ['골격근량', 'Skeletal Muscle Mass'], 5, 80],
  ['lbm', '제지방량(kg)', ['제지방량', 'Lean Body Mass', 'Fat Free Mass'], 15, 120],
  ['fatmass', '체지방량(kg)', ['체지방량', 'Body Fat Mass'], 2, 120],
  ['fatpct', '체지방률(%)', ['체지방률', 'Percent Body Fat', 'PBF'], 2, 70],
  ['ibBmr', '기초대사량(kcal)', ['기초대사량', 'Basal Metabolic Rate', 'BMR'], 600, 4000],
];
function extract(text) {
  const found = {};
  for (const [key, , labels, lo, hi] of FIELDS) {
    for (const lb of labels) {
      const re = new RegExp(lb + '[^0-9\\n]{0,25}?(\\d{1,4}(?:\\.\\d+)?)', 'gi');
      let m;
      while ((m = re.exec(text))) { const v = parseFloat(m[1]); if (v >= lo && v <= hi) { found[key] = v; break; } }
      if (found[key] !== undefined) break;
    }
  }
  return found;
}
$('#pdf').addEventListener('change', async e => {
  const file = e.target.files[0]; if (!file) return;
  const box = $('#pdfResult');
  box.innerHTML = '<div class="pdfbox">PDF를 읽는 중…</div>';
  try {
    if (file.size > 20 * 1024 * 1024) throw new Error('파일이 너무 커요(20MB 이하)');
    const lib = await loadPdfJs();
    const pdf = await lib.getDocument({ data: await file.arrayBuffer() }).promise;
    let text = '';
    for (let i = 1; i <= Math.min(pdf.numPages, 4); i++) {
      const tc = await (await pdf.getPage(i)).getTextContent();
      text += tc.items.map(x => x.str).join(' ') + '\n';
    }
    const found = extract(text);
    const keys = Object.keys(found);
    if (!keys.length) { box.innerHTML = '<div class="pdfbox">PDF에서 인바디 수치를 찾지 못했어요. 스캔 이미지 PDF이거나 양식이 다를 수 있어요. 아래 칸에 직접 입력해 주세요.</div>'; return; }
    box.innerHTML = `<div class="pdfbox"><b>인식된 값</b> (실제 결과지와 꼭 대조해 주세요)<ul>${FIELDS.filter(f => found[f[0]] !== undefined).map(f => `<li>${f[1]}: <b>${found[f[0]]}</b></li>`).join('')}</ul>
      <button class="btn" id="applyPdf">이 값 적용하기</button></div>`;
    $('#applyPdf').onclick = () => {
      keys.forEach(k => { state.profile[k] = String(found[k]); const el = $(`[data-k="${k}"]`); if (el) el.value = found[k]; });
      save(); render(); box.innerHTML = '<div class="pdfbox">적용했어요. 값이 맞는지 아래 칸에서 확인하세요.</div>';
    };
  } catch (err) {
    box.innerHTML = `<div class="pdfbox">PDF를 읽지 못했어요(${esc(err.message)}). 인터넷 연결을 확인하거나 아래 칸에 직접 입력해 주세요.</div>`;
  }
  e.target.value = '';
});

/* ================= 백업 ================= */
$('#exp').onclick = () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }));
  a.download = `칼로리노트-백업-${dstr(new Date())}.json`; a.click(); URL.revokeObjectURL(a.href);
};
$('#imp').addEventListener('change', async e => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const s = JSON.parse(await f.text());
    if (!s.profile || typeof s.foods !== 'object' || typeof s.workouts !== 'object') throw 0;
    if (!confirm('현재 기록을 백업 파일 내용으로 덮어쓸까요?')) return;
    state = { ...DEFAULT, ...s, profile: { ...DEFAULT.profile, ...s.profile } }; save();
    $$('[data-k]').forEach(el => el.value = state.profile[el.dataset.k]); render(); toast('불러왔어요');
  } catch (_) { toast('올바른 백업 파일이 아니에요'); }
  e.target.value = '';
});
$('#reset').onclick = () => {
  if (!confirm('모든 정보와 기록을 삭제할까요? 되돌릴 수 없어요.')) return;
  state = structuredClone(DEFAULT); save();
  $$('[data-k]').forEach(el => el.value = state.profile[el.dataset.k]); render(); toast('초기화했어요');
};

render();
setView('dash');
})();
