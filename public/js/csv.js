// CSV 내보내기(엑셀에서 한글이 깨지지 않도록 UTF-8 BOM 포함). 수식으로 해석될 수 있는 셀은 앞에 ' 를 붙여 무력화한다.
export function csvCell(v) {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = "'" + s; // 숫자(음수 포함)는 그대로 둔다
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
export const toCsv = rows => '﻿' + rows.map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n';

// CSV·탭 구분 텍스트 읽기(엑셀에서 저장한 CSV, 엑셀에서 복사해 붙여넣은 표). 따옴표 안의 쉼표·줄바꿈을 처리하고 BOM을 제거한다.
export function parseTable(text) {
  let t = String(text || '').replace(/^\uFEFF/, ''); const first = t.split(/\r?\n/, 1)[0] || ''; const delim = first.includes('\t') && !first.includes(',') ? '\t' : ',';
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"' && cell === '') q = true;
    else if (c === delim) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; row.push(cell); cell = ''; if (row.some(x => x.trim() !== '')) rows.push(row); row = []; }
    else cell += c;
  }
  row.push(cell); if (row.some(x => x.trim() !== '')) rows.push(row);
  return rows;
}
// 파일 바이트를 글자로: UTF-8이 아니면(엑셀 기본 ‘CSV’는 한글 윈도우에서 CP949) euc-kr로 다시 읽는다.
export function decodeText(buf) {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch { try { return new TextDecoder('euc-kr').decode(buf); } catch { return new TextDecoder('utf-8').decode(buf); } }
}