// 서버에 아직 올리지 못한 변경을 이 기기에 임시로 보관한다(MB12.7).
// 와이파이가 끊기거나 탭이 닫혀도 다음에 로그인할 때 되살릴 수 있게 하기 위한 것이고, 서버 저장에 성공하면 바로 지운다.
// 계정(이메일)마다 따로 두어 다른 사람의 변경이 섞이지 않게 한다. ls는 localStorage와 같은 getItem/setItem/removeItem 객체.
export const pendingKey = email => `ministry-secretary:pending:${String(email || '').trim().toLowerCase()}`;
export function writePending(ls, email, state, base, at = Date.now()) {
  try { ls.setItem(pendingKey(email), JSON.stringify({ state: String(state), base: Number(base) || 0, at })); return true; } catch { return false; } // 용량 부족이면 조용히 포기
}
export function readPending(ls, email) {
  try {
    const raw = ls.getItem(pendingKey(email)); if (!raw) return null; const j = JSON.parse(raw);
    return j && typeof j.state === 'string' && Number.isFinite(j.base) && Number.isFinite(j.at) ? { state: j.state, base: j.base, at: j.at } : null;
  } catch { return null; }
}
export function clearPending(ls, email) { try { ls.removeItem(pendingKey(email)); } catch { /* 무시 */ } }
// 서버 상태와 비교해 어떻게 할지: none(없음/같음) · restore(그 사이 서버가 안 바뀜 → 자동으로 되살림) · conflict(다른 기기가 먼저 저장 → 내려받기만)
export function pendingAction(pending, server) {
  if (!pending || pending.state === server.state) return 'none';
  return pending.base === server.version ? 'restore' : 'conflict';
}
