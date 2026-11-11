// 시간이 정해진 ‘오늘 할 일’의 알림. 앱(또는 사이트 탭)이 열려 있는 동안 20초마다 확인해서 시간이 되면 알려 줍니다.
// 서버에서 푸시로 보내는 알림이 아니므로, 창을 닫으면 알림이 오지 않습니다.
// 알림을 이미 보냈는지는 이 기기(localStorage)에만 기록합니다(여러 기기에서 쓰면 기기마다 한 번씩 알립니다).
export const kstNow = (ms = Date.now()) => { const d = new Date(ms + 9 * 3600e3); return { date: d.toISOString().slice(0, 10), time: d.toISOString().slice(11, 16) }; };

// 지금 알려야 할 할 일을 골라낸다(순수 함수: 시험하기 쉽게 시간·기록을 인자로 받음).
export function dueTodos(todos, now, fired = {}, snooze = {}, nowMs = Date.now()) {
  return (todos || []).filter(t => !t.done && t.time && t.date === now.date && t.time <= now.time && !fired[`${t.id}|${t.date}|${t.time}`] && !(snooze[t.id] && nowMs < snooze[t.id]));
}

const read = (k) => { try { return JSON.parse(localStorage.getItem(k) || '{}') || {}; } catch (e) { return {}; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 저장 불가면 같은 알림이 다시 뜰 수 있음 */ } };
export const markFired = t => { const f = read('mb_fired'); f[`${t.id}|${t.date}|${t.time}`] = t.date; write('mb_fired', f); };
// ‘다시 알림’: 알림 기록을 지우고 minutes 분 동안은 다시 울리지 않게 한다(그 뒤 다시 확인되면 한 번 더 알림).
export const snoozeTodo = (todo, minutes) => { const f = read('mb_fired'); delete f[`${todo.id}|${todo.date}|${todo.time}`]; write('mb_fired', f); const s = read('mb_snooze'); s[todo.id] = Date.now() + minutes * 60e3; write('mb_snooze', s); };
const prune = today => { const f = read('mb_fired'); let ch = false; for (const k of Object.keys(f)) if (f[k] < today) { delete f[k]; ch = true; } if (ch) write('mb_fired', f); const s = read('mb_snooze'); let c2 = false; for (const k of Object.keys(s)) if (s[k] < Date.now() - 864e5) { delete s[k]; c2 = true; } if (c2) write('mb_snooze', s); };

// getTodos: 지금 할 일 목록을 돌려주는 함수, onDue(todo): 알림을 띄우는 함수.
export function startReminders({ getTodos, onDue }) {
  let busy = false;
  const check = () => {
    if (busy) return; busy = true;
    try {
      const now = kstNow(); prune(now.date);
      const due = dueTodos(getTodos(), now, read('mb_fired'), read('mb_snooze'));
      for (const t of due) { markFired(t); onDue(t); }
    } finally { busy = false; }
  };
  setInterval(check, 20000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
  setTimeout(check, 2000);
  return check;
}

// 바탕화면(브라우저·앱) 알림. 권한이 허용돼 있을 때만 보낸다.
export const notifySupported = () => typeof Notification !== 'undefined';
export const notifyPermission = () => (notifySupported() ? Notification.permission : 'unsupported');
export const askNotifyPermission = async () => { if (!notifySupported()) return 'unsupported'; try { return await Notification.requestPermission(); } catch (e) { return Notification.permission; } };
export function desktopNotify(t) {
  if (!notifySupported() || Notification.permission !== 'granted') return false;
  try { const n = new Notification('⏰ 목회 비서 — 할 일', { body: `${t.time}  ${t.title}`, tag: `mb-todo-${t.id}`, icon: 'img/icon-192.png' }); n.onclick = () => { try { window.focus(); } catch (e) { /* 무시 */ } n.close(); }; return true; } catch (e) { return false; }
}
