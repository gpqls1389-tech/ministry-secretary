import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PUB = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const text = p => fs.readFileSync(path.join(PUB, p), 'utf8').replace(/\r\n/g, '\n');

test('MB12.21 메뉴: 설교는 행정 바로 아래 메뉴이고 설교 화면에서 켜진다', () => {
  const app = text('js/app.js'); const i = app.indexOf("const NAV = ["); const nav = app.slice(i, app.indexOf('\n', i));
  assert.ok(nav.indexOf("['admin'") >= 0 && nav.indexOf("['sermon', '✍️', '설교']") === nav.indexOf("['admin', '🗂️', '행정'], ") + "['admin', '🗂️', '행정'], ".length, '행정 다음');
  assert.ok(app.includes("view === 'sermon' || view === 'shelf' ? 'sermon'"), '서가도 설교 메뉴 아래'); assert.ok(!/view === 'att' \|\| view === 'sermon'/.test(app), '예배 메뉴에 묶지 않는다');
});

test('MB12.21 회계: 수입 빨강 · 지출 파랑(색+글자+부호), 수입만·지출만 보기', () => {
  const app = text('js/app.js'); const css = text('style.css');
  for (const k of ["tx-in' : 'tx-out'", "'amt-in' : 'amt-out'", 'data-txkind="income"', 'data-txkind="expense"', "UI.txkind = el.dataset.txkind", 'allTx.filter(t => t.kind === kindF)', 'txTable(txs)', "filter(t => !UI.txkind || t.kind === UI.txkind)"]) assert.ok(app.includes(k), k);
  assert.ok(/--tx-in:#b3261e/.test(css) && /--tx-out:#1a56b0/.test(css), '빨강·파랑 토큰'); for (const k of ['.amt-in', '.amt-out', 'tr.tx-in', '.tag.in', '.tag.out', '.txseg']) assert.ok(css.includes(k), k);
  const lum = h => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  assert.ok(ratio('#b3261e', '#fbfaf5') >= 4.5, '빨강 글자 대비'); assert.ok(ratio('#1a56b0', '#fbfaf5') >= 4.5, '파랑 글자 대비');
});
