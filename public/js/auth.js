// 로그인과 사용자별 서버 저장. /api가 없거나(정적 미리보기) 서버 설정 전이면 로컬 모드(이 브라우저에만 저장)로 동작한다.
import { KEY, emptyState } from './store.js';
import { loadImages, imgSrc } from './images.js';

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
  logoutAll: () => req('POST', '/api/logout-all', {}),
  changePassword: (current, next) => req('POST', '/api/password', { current, next }),
  deleteAccount: password => req('POST', '/api/delete-account', { password }),
};
export const imageApi = {
  status: () => req('GET', '/api/image/status'),
  generate: b => req('POST', '/api/image/generate', b),
};
export const receiptApi = {
  put: data => req('POST', '/api/receipts', { data }),
  remove: id => req('DELETE', '/api/receipts/' + encodeURIComponent(id), {}),
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

// 로그인·가입 화면(왼쪽 소개 + 오른쪽 입력). preview=true면 서버 없이 모양만 보여 준다(설정 → 로그인 화면 미리보기).
function showLogin(signupOpen, { preview = false } = {}) {
  document.body.dataset.theme = 'all'; // 로그인 화면은 항상 기본(진한 초록) 색
  return new Promise(resolve => {
    document.getElementById('auth')?.remove();
    const el = document.createElement('div'); el.id = 'auth'; document.body.appendChild(el); let tab = 'login';
    const draw = (err = '') => {
      el.innerHTML = `<div class="auth-wrap">
        <section class="auth-hero"><div>
          <div class="brandline"><img src="${imgSrc('logo')}" alt="">목회 비서</div>
          <h1>아동부·청년부 사역을<br>한곳에서 차분하게</h1>
          <p class="lead2">연간 계획, 행사 준비, 출석, 부서 회계를 한 화면에서 관리해요.</p>
          <ul><li>이번 주 일정과 준비할 일이 홈에 모여요</li><li>출석은 이름 옆 버튼을 누르면 바로 저장돼요</li><li>예산 잔액과 지출이 한눈에 보여요</li></ul>
        </div><img class="hero-img" src="${imgSrc('login-hero')}" alt=""></section>
        <section class="auth-pane">
          ${preview ? '<div class="auth-preview"><span>👀 미리보기 화면이에요. 실제 로그인은 되지 않아요.</span><span class="sp"></span><button class="sm" id="pv-close" type="button">닫기</button></div>' : ''}
          <div class="auth-card">
            <h2>${tab === 'login' ? '다시 만나서 반가워요' : '계정 만들기'}</h2><p class="sub2">${tab === 'login' ? '이메일과 비밀번호로 로그인하세요.' : '관리자에게 받은 초대 코드가 필요해요.'}</p>
            <div class="tabs" style="margin:0 0 16px"><a data-t="login" class="${tab === 'login' ? 'on' : ''}">로그인</a><a data-t="register" class="${tab === 'register' ? 'on' : ''}">가입</a></div>
            <form autocomplete="on">
              <label class="f">이메일<input name="email" type="email" autocomplete="username" required></label>
              ${tab === 'register' ? '<label class="f">이름 (선택)<input name="name" autocomplete="name" maxlength="40"></label>' : ''}
              <label class="f">비밀번호${tab === 'register' ? ' (10자 이상)' : ''}<input name="password" type="password" autocomplete="${tab === 'login' ? 'current-password' : 'new-password'}" minlength="${tab === 'register' ? 10 : 1}" required></label>
              <label class="small" style="display:flex;gap:6px;align-items:center;margin:-4px 0 10px;color:var(--mute)"><input type="checkbox" id="showpw"> 비밀번호 보기</label>
              ${tab === 'register' ? `<label class="f">초대 코드<input name="invite" autocomplete="off" required><span class="hint">${signupOpen ? '관리자에게 받은 코드를 입력하세요.' : '지금은 가입이 닫혀 있어요(관리자가 초대 코드를 설정해야 열립니다).'}</span></label>` : ''}
              <div class="err" role="alert">${esc(err)}</div>
              <button class="pri">${tab === 'login' ? '로그인' : '가입하고 시작'}</button>
            </form>
          </div>
          <p class="auth-foot">로그인하면 사용자마다 따로 저장돼요. 같은 사이트를 써도 다른 사람의 데이터는 보이지 않아요. 공용 컴퓨터에서는 사용 후 꼭 로그아웃하세요. 비밀번호를 잊으면 관리자에게 문의하세요(자동 재설정은 아직 없어요).</p>
        </section></div>`;
      el.querySelectorAll('[data-t]').forEach(a => (a.onclick = () => { tab = a.dataset.t; draw(); }));
      el.querySelector('#showpw').onchange = e => { const p = el.querySelector('[name=password]'); p.type = e.target.checked ? 'text' : 'password'; };
      if (preview) el.querySelector('#pv-close').onclick = () => { el.remove(); resolve(); };
      el.querySelector('form').onsubmit = async e => {
        e.preventDefault(); const f = new FormData(e.target);
        if (preview) { draw('미리보기 화면이에요. 실제 로그인은 서버를 켠 뒤에 사용할 수 있어요.'); return; }
        const btn = el.querySelector('button.pri'); btn.disabled = true;
        try { const body = { email: f.get('email'), password: f.get('password') }; if (tab === 'register') { body.name = f.get('name') || ''; body.invite = f.get('invite'); } await req('POST', tab === 'login' ? '/api/login' : '/api/register', body); el.remove(); resolve(); }
        catch (er) { draw(er.message); const em = el.querySelector('[name=email]'); if (em) em.value = f.get('email'); }
      };
    };
    draw();
  });
}
export const openLoginPreview = () => showLogin(true, { preview: true });
export async function initAuth() {
  await loadImages();
  let me; try { me = await req('GET', '/api/me'); } catch (e) { AUTH.reason = e.missing ? 'api-missing' : 'offline'; AUTH.storage = localStorageSafe(); return AUTH; }
  if (!me.configured) { AUTH.reason = 'not-configured'; AUTH.storage = localStorageSafe(); return AUTH; }
  if (!me.user) { await showLogin(me.signup); me = await req('GET', '/api/me'); }
  AUTH.mode = 'account'; AUTH.user = me.user; AUTH.signup = !!me.signup;
  const st = await req('GET', '/api/state'); AUTH.version = st.version;
  AUTH.storage = makeAdapter(st.state ?? JSON.stringify(emptyState())); // 새 계정은 가상 데이터 없이 빈 상태로 시작
  return AUTH;
}
