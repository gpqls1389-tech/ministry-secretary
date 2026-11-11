// 화면 부품(날짜 선택기·타임라인·차트). 외부 라이브러리는 public/vendor 에 복사해 두고, 필요한 화면에서만 불러옵니다.
//  - 날짜 선택기: vanilla-calendar-pro 3.4.0 (MIT)
//  - 타임라인(간트): frappe-gantt 1.2.2 (MIT)
//  - 차트: uPlot 1.6.32 (MIT)
// 사용자가 입력한 제목 등은 라이브러리가 innerHTML 로 그리는 곳이 있어, 넘기기 전에 반드시 escapeHtml 을 거칩니다.
export const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const loaded = {};
const once = (k, fn) => (loaded[k] = loaded[k] || fn());
const cssLink = href => once('css:' + href, () => new Promise((res, rej) => { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; l.onload = () => res(); l.onerror = () => rej(new Error('css')); document.head.appendChild(l); }));
const DATE = /^\d{4}-\d{2}-\d{2}$/;

// ----- 1) 날짜 선택기 -----
// 마우스가 있는 기기(pointer: fine)에서만 달력 팝업을 붙인다. 휴대폰·태블릿은 기기 기본 날짜 선택을 그대로 쓴다.
// 라이브러리를 못 불러오면 입력칸은 원래대로 남는다.
export async function enhanceDates(root) {
  try {
    if (!window.matchMedia || !window.matchMedia('(pointer: fine)').matches) return;
    const inputs = [...root.querySelectorAll('input[type=date]')]; if (!inputs.length) return;
    const [{ Calendar }] = await Promise.all([once('vcp', () => import('../vendor/vanilla-calendar-pro/index.mjs')), cssLink('vendor/vanilla-calendar-pro/index.css')]);
    const cals = []; const toTop = m => { try { m.setAttribute('popover', 'manual'); Object.assign(m.style, { margin: '0', right: 'auto', bottom: 'auto', width: 'auto', height: 'auto' }); if (!m.matches(':popover-open')) m.showPopover(); } catch (e) { /* popover 미지원이면 달력이 대화상자 뒤에 가려질 수 있음 */ } };
    for (const input of inputs) {
      const v = input.value; input.type = 'text'; input.value = v; input.placeholder = 'YYYY-MM-DD'; input.autocomplete = 'off'; input.maxLength = 10; input.setAttribute('inputmode', 'numeric');
      const cal = new Calendar(input, {
        inputMode: true, locale: 'ko-KR', firstWeekday: 0, selectedTheme: 'light', positionToInput: 'auto', selectedDates: DATE.test(v) ? [v] : [],
        onShow(self) { const cur = DATE.test(input.value) ? [input.value] : []; self.selectedDates = cur; if (cur[0]) { self.selectedYear = Number(cur[0].slice(0, 4)); self.selectedMonth = Number(cur[0].slice(5, 7)) - 1; } self.update({ dates: true, month: true, year: true }); toTop(self.context.mainElement); },
        onHide(self) { try { const m = self.context.mainElement; if (m && m.matches(':popover-open')) m.hidePopover(); } catch (e) { /* 이미 닫힘 */ } },
        onChangeToInput(self) { const d = self.context.selectedDates[0]; input.value = d || ''; input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); self.hide(); },
      });
      cal.init(); cals.push(cal);
    }
    // 대화상자가 닫히면(Esc 포함) 열려 있던 달력도 함께 치운다.
    root.addEventListener('close', () => cals.forEach(c => { try { const m = c.context.mainElement; if (m && m.matches(':popover-open')) m.hidePopover(); c.destroy(); } catch (e) { /* 이미 정리됨 */ } }));
  } catch (e) { /* 달력 없이도 입력은 가능 */ }
}

// ----- 2) 타임라인(간트) -----
// items: [{ id, name, start:'YYYY-MM-DD', end:'YYYY-MM-DD'(포함), cls, note }]  — 마감일 같은 하루짜리는 start=end.
export async function ganttChart(el, items, { mode = 'Week' } = {}) {
  el.textContent = '';
  const rows = items.filter(i => DATE.test(i.start) && DATE.test(i.end || i.start));
  if (!rows.length) { el.innerHTML = '<p class="mute small">표시할 일정이 없어요.</p>'; return null; }
  try {
    const [mod] = await Promise.all([once('gantt', () => import('../vendor/frappe-gantt/frappe-gantt.es.js')), cssLink('vendor/frappe-gantt/frappe-gantt.css')]);
    const Gantt = mod.default; const byId = new Map(rows.map(r => [String(r.id), r]));
    const tasks = rows.map(r => ({ id: String(r.id), name: escapeHtml(r.name), start: r.start, end: r.end || r.start, progress: r.progress || 0, custom_class: r.cls || '' }));
    const holder = document.createElement('div'); el.appendChild(holder);
    const g = new Gantt(holder, tasks, {
      view_mode: mode, language: 'ko', readonly: true, today_button: false, view_mode_select: false, bar_height: 26, padding: 14, container_height: 'auto', infinite_padding: false, scroll_to: 'today',
      popup: ctx => { const r = byId.get(String(ctx.task.id)) || {}; ctx.get_title().textContent = r.name || ''; ctx.get_subtitle().textContent = r.start === (r.end || r.start) ? r.start : `${r.start} ~ ${r.end}`; ctx.get_details().textContent = r.note || ''; },
    });
    return g;
  } catch (e) { el.innerHTML = '<p class="mute small">타임라인을 불러오지 못했어요. 새로고침한 뒤 다시 시도하세요.</p>'; return null; }
}

// ----- 3) 꺾은선 차트 -----
// points: [{ date:'YYYY-MM-DD', value:number }] (날짜 오름차순). 차트 아래에는 같은 값을 표로도 보여 줘서 화면 읽기 프로그램·인쇄에서도 확인할 수 있다.
export async function lineChart(el, points, { label = '값', color = '#2f7d4f', height = 220 } = {}) {
  el.textContent = '';
  if (points.length < 2) { el.innerHTML = '<p class="mute small">기록이 2개 이상 쌓이면 추이를 그려 줘요.</p>'; return null; }
  try {
    const [mod] = await Promise.all([once('uplot', () => import('../vendor/uplot/uPlot.esm.js')), cssLink('vendor/uplot/uPlot.min.css')]);
    const uPlot = mod.default; const xs = points.map(p => Date.parse(p.date + 'T00:00:00Z') / 1000); const ys = points.map(p => p.value);
    const fmt = new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', timeZone: 'UTC' });
    const holder = document.createElement('div'); holder.setAttribute('role', 'img'); holder.setAttribute('aria-label', `${label} 추이 차트. 최근 ${points.length}회, 최근 값 ${ys.at(-1)}`); el.appendChild(holder);
    const w = () => Math.max(240, el.clientWidth || 600);
    const u = new uPlot({
      width: w(), height, legend: { show: false }, cursor: { points: { size: 8 } },
      scales: { x: { time: false }, y: { range: (_, mn, mx) => [0, Math.max(5, Math.ceil(mx * 1.15))] } },
      axes: [{ values: (_, v) => v.map(t => fmt.format(new Date(t * 1000))), splits: () => xs, space: 50, stroke: '#64748b' }, { stroke: '#64748b', size: 40, values: (_, v) => v.map(n => (Number.isInteger(n) ? n : '')) }],
      series: [{}, { label, stroke: color, width: 2, fill: color + '22', points: { show: true, size: 7, fill: color } }],
    }, [xs, ys], holder);
    const onResize = () => { if (holder.isConnected) u.setSize({ width: w(), height }); else window.removeEventListener('resize', onResize); };
    window.addEventListener('resize', onResize);
    return u;
  } catch (e) { el.innerHTML = '<p class="mute small">차트를 불러오지 못했어요. 아래 표에서 값을 확인하세요.</p>'; return null; }
}
