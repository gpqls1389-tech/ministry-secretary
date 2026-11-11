// 앱으로 설치하기(PWA)와 새 버전 알림.
// 설치한 앱은 별도 프로그램이 아니라 이 사이트를 앱 창으로 여는 것이라, 열 때마다 최신 사이트(버전)를 불러옵니다.
// 로그인한 계정의 데이터는 서버에 있으므로 앱과 브라우저 어디서든 그대로입니다.
let deferred = null;
let installed = false;
if (typeof window !== 'undefined') { // (테스트처럼 브라우저가 아닌 곳에서도 불러올 수 있게)
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; });
  window.addEventListener('appinstalled', () => { installed = true; deferred = null; });
}

export const isStandalone = () => !!(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
export const canPromptInstall = () => !!deferred && !installed;
export async function promptInstall() {
  if (!deferred) return 'unavailable';
  deferred.prompt(); const r = await deferred.userChoice.catch(() => ({ outcome: 'dismissed' })); deferred = null; return r.outcome === 'accepted' ? 'accepted' : 'dismissed';
}

// js/version.js 의 VERSION 값을 읽는다(테스트에서도 쓰는 순수 함수).
export const parseVersion = text => { const m = /export\s+const\s+VERSION\s*=\s*'(MB\d+(?:\.\d+)?)'/.exec(String(text || '')); return m ? m[1] : null; };

// 서버에 올라온 최신 버전을 가져온다. 실패하면 null.
export async function fetchLatestVersion() {
  try { const r = await fetch('js/version.js', { cache: 'no-store' }); if (!r.ok) return null; return parseVersion(await r.text()); } catch (e) { return null; }
}

// 창이 다시 보일 때(최대 30분에 한 번) 새 버전이 있는지 보고, 있으면 onNew(버전)를 부른다. 오래 켜 둔 앱 창이 옛 버전에 머물지 않게 한다.
export function watchUpdates(current, onNew) {
  let last = 0; let told = '';
  const check = async () => { if (Date.now() - last < 30 * 60 * 1000) return; last = Date.now(); const v = await fetchLatestVersion(); if (v && v !== current && v !== told) { told = v; onNew(v); } };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
  window.addEventListener('focus', check);
  setTimeout(check, 5000);
}
