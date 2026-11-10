// PDF에서 글자 읽기(브라우저 안에서만 처리: PDF 파일은 서버나 외부로 전송되지 않는다). 글자가 들어 있는 PDF만 읽을 수 있고 스캔본(그림 PDF)은 읽지 못한다.
export const MAX_PDF_BYTES = 15 * 1024 * 1024;
export const MAX_PDF_PAGES = 50;

// 같은 줄(세로 위치가 비슷한 글자)끼리 묶고 왼쪽부터 이어 붙인다. 표의 칸 사이처럼 간격이 넓으면 ' | '로 구분한다.
export function itemsToLines(items) {
  const rows = [];
  for (const it of items) {
    if (!it || typeof it.str !== 'string' || !it.str.trim() || !Array.isArray(it.transform)) continue;
    const y = it.transform[5], x = it.transform[4]; const h = Math.abs(it.transform[3]) || 10;
    let row = rows.find(r => Math.abs(r.y - y) <= Math.max(2, h * 0.35)); if (!row) { row = { y, parts: [] }; rows.push(row); }
    row.parts.push({ x, w: it.width || it.str.length * h * 0.5, s: it.str, h });
  }
  return rows.sort((a, b) => b.y - a.y).map(r => {
    const ps = r.parts.sort((a, b) => a.x - b.x); let s = '';
    ps.forEach((p, i) => { if (i) { const gap = p.x - (ps[i - 1].x + ps[i - 1].w); s += gap > p.h * 1.8 ? ' | ' : gap > p.h * 0.15 ? ' ' : ''; } s += p.s; });
    return s.replace(/\s+/g, ' ').trim();
  }).filter(Boolean);
}

export async function extractPdfLines(file, onProgress = () => {}) {
  if (!file || (file.type && file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name))) throw new Error('PDF 파일만 올릴 수 있어요.');
  if (file.size > MAX_PDF_BYTES) throw new Error('PDF가 너무 커요(15MB 이하).');
  const pdfjs = await import('../vendor/pdfjs/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;
  const data = new Uint8Array(await file.arrayBuffer());
  if (String.fromCharCode(...data.slice(0, 5)) !== '%PDF-') throw new Error('PDF 파일이 아니에요.');
  let pdf; try { pdf = await pdfjs.getDocument({ data, cMapUrl: new URL('../vendor/pdfjs/cmaps/', import.meta.url).href, cMapPacked: true, isEvalSupported: false, enableXfa: false, stopAtErrors: false }).promise; }
  catch (e) { throw new Error(e && e.name === 'PasswordException' ? '암호가 걸린 PDF는 읽을 수 없어요. 암호를 푼 파일로 올려 주세요.' : 'PDF를 읽지 못했어요. 파일이 손상되었을 수 있어요.'); }
  const pages = Math.min(pdf.numPages, MAX_PDF_PAGES); const lines = [];
  try {
    for (let p = 1; p <= pages; p++) { onProgress(p, pages); const page = await pdf.getPage(p); const tc = await page.getTextContent(); lines.push(...itemsToLines(tc.items)); lines.push(''); }
  } finally { try { await pdf.destroy(); } catch { /* 무시 */ } }
  const chars = lines.join('').replace(/\s/g, '').length;
  if (chars < 20) throw new Error('이 PDF에는 읽을 수 있는 글자가 거의 없어요. 스캔본(그림으로 된 PDF)일 수 있어요. 워드·한글 등에서 ‘PDF로 저장’한, 글자가 드래그로 선택되는 PDF로 올려 주세요.');
  return { lines, pages: pdf.numPages, truncated: pdf.numPages > MAX_PDF_PAGES };
}
