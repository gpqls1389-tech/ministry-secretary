// 한글(HWPX) 파일 만들기: 문서 블록(admin.js formBlocks) → OWPML XML → ZIP.
// 바탕 파일(header.xml 등)은 python-hwpx(Apache-2.0)의 빈 문서 틀을 쓰고, 표 테두리·굵은 글자·가운데 정렬 모양만 더했다(vendor/hwpx).
// 브라우저와 Node(테스트) 양쪽에서 동작하도록 바탕 파일은 인자로 받는다.
export const HWPX_BASE_FILES = ['header.xml', 'version.xml', 'settings.xml', 'container.xml', 'container.rdf', 'manifest.xml'];
const NS = 'xmlns:ha="http://www.hancom.co.kr/hwpml/2011/app" xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph" xmlns:hp10="http://www.hancom.co.kr/hwpml/2016/paragraph" xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core" xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head" xmlns:hhs="http://www.hancom.co.kr/hwpml/2011/history" xmlns:hm="http://www.hancom.co.kr/hwpml/2011/master-page" xmlns:hpf="http://www.hancom.co.kr/schema/2011/hpf" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf/" xmlns:ooxmlchart="http://www.hancom.co.kr/hwpml/2016/ooxmlchart" xmlns:hwpunitchar="http://www.hancom.co.kr/hwpml/2016/HwpUnitChar" xmlns:epub="http://www.idpf.org/2007/ops" xmlns:config="urn:oasis:names:tc:opendocument:xmlns:config:1.0"';
// 첫 문단의 구역 설정(A4 세로, 여백) — 바탕 문서와 같다
const SECPR = '<hp:secPr id="" textDirection="HORIZONTAL" spaceColumns="1134" tabStop="8000" tabStopVal="4000" tabStopUnit="HWPUNIT" outlineShapeIDRef="1" memoShapeIDRef="0" textVerticalWidthHead="0" masterPageCnt="0"><hp:grid lineGrid="0" charGrid="0" wonggojiFormat="0"/><hp:startNum pageStartsOn="BOTH" page="0" pic="0" tbl="0" equation="0"/><hp:visibility hideFirstHeader="0" hideFirstFooter="0" hideFirstMasterPage="0" border="SHOW_ALL" fill="SHOW_ALL" hideFirstPageNum="0" hideFirstEmptyLine="0" showLineNumber="0"/><hp:lineNumberShape restartType="0" countBy="0" distance="0" startNumber="0"/><hp:pagePr landscape="WIDELY" width="59528" height="84186" gutterType="LEFT_ONLY"><hp:margin header="4252" footer="4252" gutter="0" left="8504" right="8504" top="5668" bottom="4252"/></hp:pagePr><hp:footNotePr><hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar=")" supscript="0"/><hp:noteLine length="-1" type="SOLID" width="0.12 mm" color="#000000"/><hp:noteSpacing betweenNotes="283" belowLine="567" aboveLine="850"/><hp:numbering type="CONTINUOUS" newNum="1"/><hp:placement place="EACH_COLUMN" beneathText="0"/></hp:footNotePr><hp:endNotePr><hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar=")" supscript="0"/><hp:noteLine length="14692344" type="SOLID" width="0.12 mm" color="#000000"/><hp:noteSpacing betweenNotes="0" belowLine="567" aboveLine="850"/><hp:numbering type="CONTINUOUS" newNum="1"/><hp:placement place="END_OF_DOCUMENT" beneathText="0"/></hp:endNotePr><hp:pageBorderFill type="BOTH" borderFillIDRef="1" textBorder="PAPER" headerInside="0" footerInside="0" fillArea="PAPER"><hp:offset left="1417" right="1417" top="1417" bottom="1417"/></hp:pageBorderFill><hp:pageBorderFill type="EVEN" borderFillIDRef="1" textBorder="PAPER" headerInside="0" footerInside="0" fillArea="PAPER"><hp:offset left="1417" right="1417" top="1417" bottom="1417"/></hp:pageBorderFill><hp:pageBorderFill type="ODD" borderFillIDRef="1" textBorder="PAPER" headerInside="0" footerInside="0" fillArea="PAPER"><hp:offset left="1417" right="1417" top="1417" bottom="1417"/></hp:pageBorderFill></hp:secPr><hp:ctrl><hp:colPr id="" type="NEWSPAPER" layout="LEFT" colCount="1" sameSz="1" sameGap="0"/></hp:ctrl>';
const TEXT_W = 42520; // A4 폭 59528 - 좌우 여백 8504×2
const CH = { normal: 0, bold: 7, title: 8, small: 9 }, PA = { normal: 22, center: 20, right: 21 }, BF = { line: 3, head: 4 };

export const xmlEsc = s => String(s ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function makeWriter() {
  let pid = 1, oid = 1000;
  const para = (text, { ch = CH.normal, pa = PA.normal } = {}) => `<hp:p id="${pid++}" paraPrIDRef="${pa}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="${ch}">${text === '' ? '<hp:t/>' : `<hp:t>${xmlEsc(text)}</hp:t>`}</hp:run></hp:p>`;
  const paras = (text, o) => String(text ?? '').split('\n').map(l => para(l, o)).join('');
  // rows: [[{text, head, h}]] — 칸 너비는 widths(비율)로 나눈다
  function table(rows, widths, { width = TEXT_W, pa = PA.normal } = {}) {
    const cols = widths.length; const sum = widths.reduce((a, b) => a + b, 0); const ws = widths.map(w => Math.floor(width * w / sum)); ws[cols - 1] += width - ws.reduce((a, b) => a + b, 0);
    const heights = rows.map(r => Math.max(...r.map(c => c.h || 282)));
    const trs = rows.map((r, ri) => `<hp:tr>${r.map((c, ci) => `<hp:tc name="" header="${c.head ? 1 : 0}" hasMargin="0" protect="0" editable="0" dirty="0" borderFillIDRef="${c.head ? BF.head : BF.line}"><hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="${c.top ? 'TOP' : 'CENTER'}" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">${paras(c.text, { ch: c.head ? CH.bold : CH.normal, pa: c.head || c.center ? PA.center : PA.normal })}</hp:subList><hp:cellAddr colAddr="${ci}" rowAddr="${ri}"/><hp:cellSpan colSpan="1" rowSpan="1"/><hp:cellSz width="${ws[ci]}" height="${heights[ri]}"/><hp:cellMargin left="510" right="510" top="141" bottom="141"/></hp:tc>`).join('')}</hp:tr>`).join('');
    const tbl = `<hp:tbl id="${oid++}" zOrder="0" numberingType="TABLE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" pageBreak="CELL" repeatHeader="1" rowCnt="${rows.length}" colCnt="${cols}" cellSpacing="0" borderFillIDRef="${BF.line}" noAdjust="0"><hp:sz width="${width}" widthRelTo="ABSOLUTE" height="${heights.reduce((a, b) => a + b, 0)}" heightRelTo="ABSOLUTE" protect="0"/><hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="COLUMN" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/><hp:outMargin left="0" right="0" top="0" bottom="0"/><hp:inMargin left="510" right="510" top="141" bottom="141"/>${trs}</hp:tbl>`;
    return `<hp:p id="${pid++}" paraPrIDRef="${pa}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="0">${tbl}<hp:t/></hp:run></hp:p>`;
  }
  return { para, paras, table };
}

// 블록 → section0.xml
export function sectionXml(blocks) {
  const w = makeWriter(); const out = [];
  for (const b of blocks) {
    if (b.t === 'title') out.push(w.para(b.text, { ch: CH.title, pa: PA.center }), w.para(''));
    else if (b.t === 'h') out.push(w.para(''), w.para(b.text, { ch: CH.bold }));
    else if (b.t === 'p' && b.box) out.push(w.table([[{ text: b.text, h: b.text ? 282 : 4200, top: true }]], [1]));
    else if (b.t === 'p') out.push(w.paras(b.text, { ch: b.small ? CH.small : CH.normal, pa: b.align === 'right' ? PA.right : b.align === 'center' ? PA.center : PA.normal }));
    else if (b.t === 'approve') out.push(w.table([b.cols.map(c => ({ text: c, head: true })), b.cols.map(() => ({ text: '', h: 2600 }))], b.cols.map(() => 1), { width: 6800 * b.cols.length, pa: PA.right }), w.para(''));
    else if (b.t === 'info') out.push(w.table(b.rows.map(r => r.map((c, i) => ({ text: c, head: i % 2 === 0 && c !== '' }))), [16, 34, 16, 34]));
    else if (b.t === 'table') out.push(w.table([b.head.map(c => ({ text: c, head: true })), ...b.rows.map(r => r.map(c => ({ text: c })))], b.widths || b.head.map(() => 1)));
    else if (b.t === 'check') out.push(...b.items.map(i => w.para(`${i.on ? '■' : '□'} ${i.text}`)));
  }
  const first = `<hp:p id="0" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="0">${SECPR}</hp:run><hp:run charPrIDRef="0"><hp:t/></hp:run></hp:p>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?><hs:sec ${NS}>${first}${out.join('')}</hs:sec>`;
}

export function contentHpf(title, now = new Date()) {
  const iso = now.toISOString().replace(/\.\d+Z$/, 'Z');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?><opf:package ${NS} version="" unique-identifier="" id=""><opf:metadata><opf:title>${xmlEsc(title)}</opf:title><opf:language>ko</opf:language><opf:meta name="creator" content="text">목회 비서</opf:meta><opf:meta name="subject" content="text"/><opf:meta name="description" content="text"/><opf:meta name="lastsaveby" content="text">목회 비서</opf:meta><opf:meta name="CreatedDate" content="text">${iso}</opf:meta><opf:meta name="ModifiedDate" content="text">${iso}</opf:meta><opf:meta name="date" content="text"/><opf:meta name="keyword" content="text"/></opf:metadata><opf:manifest><opf:item id="header" href="Contents/header.xml" media-type="application/xml"/><opf:item id="section0" href="Contents/section0.xml" media-type="application/xml"/><opf:item id="settings" href="settings.xml" media-type="application/xml"/></opf:manifest><opf:spine><opf:itemref idref="header" linear="yes"/><opf:itemref idref="section0" linear="yes"/></opf:spine></opf:package>`;
}

// ---- ZIP(무압축 저장). mimetype은 맨 앞에 무압축으로 둔다(HWPX 규칙) ----
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
export const crc32 = u8 => { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
export function zipStore(files, now = new Date()) {
  const enc = new TextEncoder(); const parts = []; const central = []; let off = 0;
  const dtime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1), ddate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  for (const [name, data] of files) {
    const nb = enc.encode(name); const body = typeof data === 'string' ? enc.encode(data) : data; const crc = crc32(body);
    const h = new DataView(new ArrayBuffer(30)); h.setUint32(0, 0x04034b50, true); h.setUint16(4, 10, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true); h.setUint16(10, dtime, true); h.setUint16(12, ddate, true); h.setUint32(14, crc, true); h.setUint32(18, body.length, true); h.setUint32(22, body.length, true); h.setUint16(26, nb.length, true); h.setUint16(28, 0, true);
    parts.push(new Uint8Array(h.buffer), nb, body);
    const c = new DataView(new ArrayBuffer(46)); c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 10, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true); c.setUint16(12, dtime, true); c.setUint16(14, ddate, true); c.setUint32(16, crc, true); c.setUint32(20, body.length, true); c.setUint32(24, body.length, true); c.setUint16(28, nb.length, true); c.setUint32(42, off, true);
    central.push(new Uint8Array(c.buffer), nb); off += 30 + nb.length + body.length;
  }
  const csize = central.reduce((a, p) => a + p.length, 0); const e = new DataView(new ArrayBuffer(22)); e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, csize, true); e.setUint32(16, off, true);
  const all = [...parts, ...central, new Uint8Array(e.buffer)]; const out = new Uint8Array(all.reduce((a, p) => a + p.length, 0)); let p = 0; for (const a of all) { out.set(a, p); p += a.length; } return out;
}

// base: { 'header.xml': '...', ... } (vendor/hwpx 파일 내용), text: 미리보기 글
export function buildHwpx(blocks, { title = '문서', text = '', base, now = new Date() }) {
  for (const f of HWPX_BASE_FILES) if (!base || typeof base[f] !== 'string') throw new Error(`한글 파일 바탕(${f})을 불러오지 못했어요.`);
  return zipStore([
    ['mimetype', 'application/hwp+zip'], ['version.xml', base['version.xml']], ['Contents/header.xml', base['header.xml']], ['Contents/section0.xml', sectionXml(blocks)],
    ['Preview/PrvText.txt', String(text).slice(0, 1000)], ['settings.xml', base['settings.xml']], ['META-INF/container.rdf', base['container.rdf']], ['Contents/content.hpf', contentHpf(title, now)],
    ['META-INF/container.xml', base['container.xml']], ['META-INF/manifest.xml', base['manifest.xml']],
  ], now);
}
