// 오프라인 사용(MB12.24): 이 기기에 계정 데이터의 복사본을 두어, 인터넷이 없어도 앱을 열고 고칠 수 있게 한다.
// 개인정보가 기기에 남으므로 ‘설정 → 오프라인 사용’에서 직접 켠 사람에게만 만들고, 로그아웃하면 복사본을 지운다.
// ls는 localStorage와 같은 getItem/setItem/removeItem/key/length 객체.
export const OFF_ON = 'ministry-secretary:offline:on';
export const OFF_USER = 'ministry-secretary:offline:user';
const PREFIX = 'ministry-secretary:offline:state:';
export const offKey = email => PREFIX + String(email || '').trim().toLowerCase();

export const offlineEnabled = ls => { try { return !!ls && ls.getItem(OFF_ON) === '1'; } catch { return false; } };
// 끄면 복사본도 함께 지운다(켜 둔 채로 남기지 않는다)
export function setOfflineEnabled(ls, on) { try { if (on) ls.setItem(OFF_ON, '1'); else { clearOfflineData(ls); ls.removeItem(OFF_ON); } return true; } catch { return false; } }
export function clearOfflineData(ls) {
  try { ls.removeItem(OFF_USER); for (let i = ls.length - 1; i >= 0; i--) { const k = ls.key(i); if (k && k.startsWith(PREFIX)) ls.removeItem(k); } } catch { /* 무시 */ }
}
// 서버에 올라간 마지막 상태(state 글자, 서버 버전)를 복사해 둔다. 용량이 모자라면 조용히 포기한다.
export function saveCopy(ls, user, state, version, at = Date.now()) {
  try { if (!user || !user.email) return false; ls.setItem(OFF_USER, JSON.stringify({ email: String(user.email), name: String(user.name || '') })); ls.setItem(offKey(user.email), JSON.stringify({ state: String(state), version: Number(version) || 0, at })); return true; } catch { return false; }
}
export function readCopy(ls, email) {
  try { const raw = ls.getItem(offKey(email)); if (!raw) return null; const j = JSON.parse(raw); return j && typeof j.state === 'string' && Number.isFinite(j.version) && Number.isFinite(j.at) ? { state: j.state, version: j.version, at: j.at } : null; } catch { return null; }
}
export function lastUser(ls) {
  try { const raw = ls.getItem(OFF_USER); if (!raw) return null; const j = JSON.parse(raw); return j && typeof j.email === 'string' && j.email ? { email: j.email, name: typeof j.name === 'string' ? j.name : '' } : null; } catch { return null; }
}
