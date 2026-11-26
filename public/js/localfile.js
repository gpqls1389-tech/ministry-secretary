// 내 컴퓨터에만 저장(MB12.27, 설치형 앱 전용): 서버·로그인 없이 내 문서\목회비서\data.json 파일에 저장한다.
// store는 동기 저장소를 기대하므로 메모리에 두고, 바뀌면 잠시 뒤 파일로 보낸다(창을 닫는 순간에는 동기 저장).
import { KEY } from './store.js';
import { nextDelay } from './savedelay.js';

export const STORAGE_KEY = 'ministry-secretary:storage'; // 'file'(이 컴퓨터) | 'account'(서버 계정)
export const MIGRATE_KEY = 'ministry-secretary:migrate'; // '1' 이면 다음 로그인 때 컴퓨터 데이터를 새 계정으로 옮긴다
export const desktopFile = () => ((typeof window !== 'undefined' && window.mbDesktop && window.mbDesktop.localdata) || null);

// ld: { write(state) → {ok,error}, writeSync(state) → {ok,error} } (데스크톱 preload가 주는 객체와 같은 모양)
export function makeFileAdapter(ld, initial, { savedStr = initial, onStatus = () => {}, delay = 1500, maxWait = 10000, timers = { set: (f, ms) => setTimeout(f, ms), clear: t => clearTimeout(t) }, now = Date.now } = {}) {
  let cache = initial, saved = savedStr, dirty = false, inflight = false, timer = null, first = 0, closed = false;
  const status = (s, m = '') => { try { onStatus(s, m); } catch (e) { /* 표시 오류는 저장과 무관 */ } };
  const schedule = ms => { timers.clear(timer); timer = timers.set(flush, ms); };
  async function flush() {
    timers.clear(timer); timer = null; if (inflight || !dirty || closed) return; inflight = true; dirty = false; first = 0; const snap = cache;
    try {
      const r = await ld.write(snap);
      if (r && r.ok) { saved = snap; if (!dirty) status('saved'); else { schedule(nextDelay(now(), first || now(), delay, maxWait)); } }
      else { dirty = true; status('failed', (r && r.error) || '파일에 저장하지 못했어요.'); schedule(5000); }
    } catch (e) { dirty = true; status('failed', '파일에 저장하지 못했어요. 자동으로 다시 시도합니다.'); schedule(5000); }
    finally { inflight = false; }
  }
  return {
    getItem: k => (k === KEY ? cache : null),
    setItem(k, v) {
      if (k !== KEY || closed) return; cache = v;
      if (v === saved && !inflight) { dirty = false; timers.clear(timer); timer = null; first = 0; status('saved'); return; }
      if (!dirty || !first) first = now(); dirty = true; status('saving'); schedule(nextDelay(now(), first, delay, maxWait));
    },
    flush,
    // 창을 닫거나 숨기기 직전: 기다리지 않고 동기로 저장한다
    flushSync() { if (!dirty || closed) return true; timers.clear(timer); timer = null; try { const r = ld.writeSync ? ld.writeSync(cache) : null; if (r && r.ok) { saved = cache; dirty = false; first = 0; status('saved'); return true; } } catch (e) { /* 아래에서 실패로 둔다 */ } status('failed', '파일에 저장하지 못했어요.'); return false; },
    close() { closed = true; timers.clear(timer); },
    get dirty() { return dirty; },
    current: () => cache,
  };
}
