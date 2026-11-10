// CSV 내보내기(엑셀에서 한글이 깨지지 않도록 UTF-8 BOM 포함). 수식으로 해석될 수 있는 셀은 앞에 ' 를 붙여 무력화한다.
export function csvCell(v) {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = "'" + s; // 숫자(음수 포함)는 그대로 둔다
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
export const toCsv = rows => '﻿' + rows.map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
