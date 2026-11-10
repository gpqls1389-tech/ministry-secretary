// 로그인과 사용자별 서버 저장. /api가 없거나(정적 미리보기) 서버 설정 전이면 로컬 모드(이 브라우저에만 저장)로 동작한다.
import { KEY, emptyState } from './store.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const AUTH = { mode: 'local', reason: '', user: null, version: 0, status: 'saved', message: '', storage: null, onStatus: () => {}, onConflict: () => {} };

async function req(method, path, body) {
  let r; try { r = await fetch(path, { method, credentials: 'same-origin', headers: body !== undefined ? { 'Content-Type': 'application/json' } : {}, body: body !== undefined ? JSON.stringify(body) : undefined }); }
  catch { throw Object.assign(new Error('서버에 연결할 수 없어요. 인터넷 연결을 확인하세요.'), { offline: true }); }
  if (!(r.headers.get('content-type') || '').includes('application/json')) throw Object.assign(new Error('api-missing'), { missing: true });
  const j = await r.json(); if (!r.ok) throw Object.assign(new Error(j.error || '오류가 발생했어요.'), { status: r.status, data: j }); return j;
}
export const accountApi = {
  logout: async () => { try { await req('POST', '/api/logout', {}); } finally { /* 쿠키는 서버가 지움 */ } },
  changePassword: (current, next) => req('POST', '/api/password', { current, next }),
  deleteAccount: password => req('POST', '/api/delete-account', { password }),
};

function localStorageSafe() {
  try { const t = '__t'; window.localStorage.setItem(t, '1'); window.localStorage.removeItem(t); return window.localStorage; }
  catch { const m = new Map(); window.__memOnly = true; return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v) }; }
}

// ---- 서버 저장 어댑터: store는 동기 저장소를 기대하므로 메모리에 두고 변경 시 서버로 보낸다 ----
function makeAdapter(initial) {
  let cache = initial, dirty = false, inflight = false, timer = null, retry = 0, blocked = false;
  const set = (s, m = '') => { AUTH.status = s; AUTH.message = m; AUTH.onStatus(s, m); };
  async function flush() {
    if (inflight || blocked) return; inflight = true; clearTimeout(timer); timer = null;
    try {
      while (dirty && !blocked) {
        dirty = false; const snap = cache;
        try { const r = await req('PUT', '/api/state', { baseVersion: AUTH.version, state: snap }); AUTH.version = r.version; retry = 0; if (!dirty) set('saved'); }
        catch (e) {
          dirty = true;
          if (e.status === 409) { blocked = true; set('failed', '다른 기기에서 먼저 저장했어요.'); AUTH.onConflict(e.data.version); return; }
          if (e.status === 401) { blocked = true; set('failed', '로그인이 만료됐어요. 새로고침해서 다시 로그인하세요. (저장되지 않은 변경이 있습니다)'); return; }
          if (e.status === 413 || e.status === 422) { blocked = true; set('failed', e.message); return; }
          retry++; set('failed', e.message + ' 자동으로 다시 시도합니다.'); timer = setTimeout(flush, Math.min(30000, 2000 * 2 ** retry)); return;
        }
      }
    } finally { inflight = false; }
  }
  AUTH.forceSave = async serverVersion => { AUTH.version = serverVersion; blocked = false; dirty = true; set('saving'); await flush(); };
  window.addEventListener('beforeunload', e => { if (dirty || inflight || AUTH.status === 'failed') { e.preventDefault(); e.returnValue = ''; } });
  return {
    getItem: k => (k === KEY ? cache : null),
    setItem(k, v) { if (k !== KEY) return; cache = v; dirty = true; set('saving'); clearTimeout(timer); timer = setTimeout(flush, 700); }, // 저장 오류는 상태 표시로 알림(동기 오류를 던지지 않음)
  };
}

function showLogin(signupOpen) {
  return new Promise(resolve => {
    const el = document.createElement('div'); el.id = 'auth'; document.body.appendChild(el); let tab = 'login';
    const draw = (err = '') => {
      el.innerHTML = `<div class="auth-card"><div class="brand" style="padding:0 0 14px"><span class="dot"></span>목회 비서</div>
        <div class="tabs" style="margin:0 0 16px"><a data-t="login" class="${tab === 'login' ? 'on' : ''}">로그인</a><a data-t="register" class="${tab === 'register' ? 'on' : ''}">가입</a></div>
        <form autocomplete="on">
          <label class="f">이메일<input name="email" type="email" autocomplete="username" required></label>
          ${tab === 'register' ? '<label class="f">이름 (선택)<input name="name" autocomplete="name" maxlength="40"></label>' : ''}
          <label class="f">비밀번호${tab === 'register' ? ' (10자 이상)' : ''}<input name="password" type="password" autocomplete="${tab === 'login' ? 'current-password' : 'new-password'}" minlength="${tab === 'register' ? 10 : 1}" required></label>
          ${tab === 'register' ? `<label class="f">초대 코드<input name="invite" autocomplete="off" required><span class="hint">${signupOpen ? '관리자에게 받은 코드를 입력하세요.' : '지금은 가입이 닫혀 있어요(관리자가 초대 코드를 설정해야 열립니다).'}</span></label>` : ''}
          <div class="err" role="alert">${esc(err)}</div>
          <button class="pri" style="width:100%;margin-top:6px">${tab === 'login' ? '로그인' : '가입하고 시작'}</button>
        </form>
        <p class="mute small" style="margin:14px 0 0">로그인하면 사용자마다 따로 저장돼요. 같은 사이트를 써도 다른 사람의 데이터는 보이지 않아요. 비밀번호를 잊으면 관리자에게 문의하세요(자동 재설정은 아직 없어요).</p></div>`;
      el.querySelectorAll('[data-t]').forEach(a => (a.onclick = () => { tab = a.dataset.t; draw(); }));
      el.querySelector('form').onsubmit = async e => {
        e.preventDefault(); const f = new FormData(e.target); const btn = el.querySelector('button.pri'); btn.disabled = true;
        try { const body = { email: f.get('email'), password: f.get('password') }; if (tab === 'register') { body.name = f.get('name') || ''; body.invite = f.get('invite'); } await req('POST', tab === 'login' ? '/api/login' : '/api/register', body); el.remove(); resolve(); }
        catch (er) { draw(er.message); const em = el.querySelector('[name=email]'); if (em) em.value = f.get('email'); }
      };
    };
    draw();
  });
}

export async function initAuth() {
  let me; try { me = await req('GET', '/api/me'); } catch (e) { AUTH.reason = e.missing ? 'api-missing' : 'offline'; AUTH.storage = localStorageSafe(); return AUTH; }
  if (!me.configured) { AUTH.reason = 'not-configured'; AUTH.storage = localStorageSafe(); return AUTH; }
  if (!me.user) { await showLogin(me.signup); me = await req('GET', '/api/me'); }
  AUTH.mode = 'account'; AUTH.user = me.user;
  const st = await req('GET', '/api/state'); AUTH.version = st.version;
  AUTH.storage = makeAdapter(st.state ?? JSON.stringify(emptyState())); // 새 계정은 가상 데이터 없이 빈 상태로 시작
  return AUTH;
}
