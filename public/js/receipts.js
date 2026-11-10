// 영수증 사진: 올리기 전에 브라우저에서 작게 줄이고(위치 정보 등 사진 속 숨은 정보는 이때 모두 사라짐), 저장한다.
// 로그인 모드: 서버(/api/receipts)에 내 계정으로만 저장 / 로컬 모드: 이 브라우저(localStorage)에만 저장
export const MAX_PICK = 20 * 1024 * 1024;   // 고를 수 있는 원본 최대 크기
const LIMIT_BYTES = 380_000;                  // 줄인 뒤 한 장 목표 크기(서버 한도 400KB 아래)
const LOCAL_PREFIX = 'ms:rc:';
const LOCAL_TOTAL = 3_000_000;                // 이 브라우저 저장 공간에서 영수증이 차지할 수 있는 글자 수(대략 2MB 사진)

const dataUrlBytes = u => Math.floor((u.length - u.indexOf(',') - 1) * 3 / 4);
const blobToDataUrl = b => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => no(new Error('사진을 읽지 못했어요.')); r.readAsDataURL(b); });
const toBlob = (cv, q) => new Promise(ok => cv.toBlob(ok, 'image/jpeg', q));

export async function compressImage(file) {
  if (!file || !/^image\//.test(file.type)) throw new Error('사진(이미지) 파일만 올릴 수 있어요.');
  if (file.size > MAX_PICK) throw new Error('사진이 너무 커요(20MB 이하).');
  let bmp; try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { throw new Error('이 사진 형식은 읽을 수 없어요. JPG·PNG 사진으로 올려 주세요.'); }
  let max = 1600;
  for (let round = 0; round < 4; round++) {
    const sc = Math.min(1, max / Math.max(bmp.width, bmp.height)); const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(bmp.width * sc)); cv.height = Math.max(1, Math.round(bmp.height * sc));
    const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height); ctx.drawImage(bmp, 0, 0, cv.width, cv.height);
    for (const q of [0.78, 0.65, 0.52, 0.4]) { const b = await toBlob(cv, q); if (b && b.size <= LIMIT_BYTES) { bmp.close?.(); return blobToDataUrl(b); } }
    max = Math.round(max * 0.75); // 그래도 크면 크기를 더 줄여서 다시
  }
  bmp.close?.(); throw new Error('사진을 충분히 줄이지 못했어요. 더 단순한 사진으로 다시 찍어 주세요.');
}

// api: { put(dataUrl) → {id}, remove(id) }는 로그인 모드에서만 주입된다.
export function makeReceiptStore({ account, api }) {
  const ls = (() => { try { return window.localStorage; } catch { return null; } })();
  const localUsed = () => { let n = 0; if (ls) for (let i = 0; i < ls.length; i++) { const k = ls.key(i); if (k && k.startsWith(LOCAL_PREFIX)) n += (ls.getItem(k) || '').length; } return n; };
  return {
    account,
    async put(dataUrl) {
      if (dataUrlBytes(dataUrl) > 400_000) throw new Error('사진이 너무 커요.');
      if (account) return (await api.put(dataUrl)).id;
      if (!ls) throw new Error('이 브라우저는 저장을 허용하지 않아 사진을 저장할 수 없어요.');
      if (localUsed() + dataUrl.length > LOCAL_TOTAL) throw new Error('이 브라우저에 저장할 수 있는 영수증 사진 공간이 가득 찼어요. 로그인 기능을 켜면 서버에 더 많이 저장할 수 있어요. 지금은 오래된 사진을 지워 주세요.');
      const id = 'l' + [...crypto.getRandomValues(new Uint8Array(12))].map(x => x.toString(16).padStart(2, '0')).join('');
      try { ls.setItem(LOCAL_PREFIX + id, dataUrl); } catch { throw new Error('저장 공간이 부족해 사진을 저장하지 못했어요.'); }
      return id;
    },
    src(id) { return account ? `/api/receipts/${encodeURIComponent(id)}` : (ls && ls.getItem(LOCAL_PREFIX + id)) || ''; },
    async remove(id) { try { if (account) await api.remove(id); else ls && ls.removeItem(LOCAL_PREFIX + id); } catch { /* 이미 없는 사진이면 무시 */ } },
    usage() { return account ? null : { used: localUsed(), limit: LOCAL_TOTAL }; },
  };
}
