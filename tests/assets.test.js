import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { IC, ILLUS, APP_ICON, PALETTE } from '../public/js/icons.js';

const read = p => fs.readFileSync(new URL('../' + p, import.meta.url));
const text = p => read(p).toString('utf8').replace(/\r\n/g, '\n'); // 윈도우 줄바꿈(CRLF)으로 내려받아도 같게 비교

test('MB12.14 시각 자산: 아이콘 14종·그림 8종은 팔레트 안의 색만 쓰고 대체 글이 있다', () => {
  const allowed = new Set(Object.values(PALETTE).map(c => c.toLowerCase()).concat(['#7a4f10'])); const colors = s => [...s.matchAll(/#[0-9a-fA-F]{6}\b/g)].map(m => m[0].toLowerCase());
  assert.equal(Object.keys(IC).length, 14); for (const [k, svg] of Object.entries(IC)) { assert.match(svg, /aria-hidden="true"/, k); assert.ok(!/#[0-9a-f]{6}/i.test(svg), `${k}: 글자색을 따라간다`); }
  assert.deepEqual(Object.keys(ILLUS).sort(), ['advent', 'christmas', 'easter', 'epiphany', 'lent', 'notebook', 'people', 'thanksgiving']);
  for (const [k, svg] of Object.entries(ILLUS)) { assert.match(svg, /role="img"/, k); assert.match(svg, /aria-label="[^"]{4,}"/, k); for (const c of colors(svg)) assert.ok(allowed.has(c), `${k} ${c}`); assert.ok(!/Gradient|filter=|<image/.test(svg), `${k}: 그라데이션·그림자·이미지 없음`); }
  for (const c of colors(APP_ICON)) assert.ok(allowed.has(c), `앱 아이콘 ${c}`);
});

test('사이트 이미지 파일: 로고·파비콘은 새 앱 아이콘, 절기 배너·빈 화면은 같은 그림체, PNG 크기가 맞다', () => {
  assert.equal(text('public/img/logo.svg'), APP_ICON); assert.equal(text('public/img/favicon.svg'), APP_ICON);
  for (const f of ['advent', 'christmas', 'lent', 'easter', 'thanksgiving']) { const s = text(`public/img/season-${f}.svg`); assert.match(s, /viewBox="0 0 1000 300"/, f); assert.ok(s.includes(PALETTE.P), `${f}: 아이보리 바탕`); assert.match(s, /aria-label=/, f); }
  for (const f of ['schedule', 'tasks', 'events', 'attendance', 'money', 'people']) assert.match(text(`public/img/empty-${f}.svg`), /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/, f);
  const dim = (p, n) => { const b = read(p); assert.equal(b.subarray(1, 4).toString(), 'PNG', p); assert.equal(b.readUInt32BE(16), n, `${p} 너비`); assert.equal(b.readUInt32BE(20), n, `${p} 높이`); };
  dim('public/img/apple-touch-icon.png', 180); dim('public/img/icon-192.png', 192); dim('public/img/icon-512.png', 512); dim('public/img/icon-maskable-512.png', 512); dim('desktop/build/icon.png', 256);
  const ico = read('desktop/build/icon.ico'); assert.equal(ico.readUInt16LE(2), 1); assert.equal(ico.readUInt16LE(4), 7);
});

test('화면 연결: 메뉴는 icons.js의 아이콘, 절기 띠는 5개 절기, 테마 색이 새 초록', () => {
  const app = text('public/js/app.js'); const html = text('public/index.html'); const man = text('public/manifest.webmanifest'); const css = text('public/style.css');
  assert.ok(app.includes("import { IC, ILLUS } from './icons.js'") && app.includes('IC[NAV_ICON[k] || k]'), '메뉴 아이콘 연결');
  for (const s of ['대림절', '성탄절', '주현절', '사순절', '부활절']) assert.ok(new RegExp(`${s}: \\['`).test(app), `${s} 절기 띠`);
  assert.ok(app.includes('${seasonBand}${seasonCard}'), '홈에 절기 띠'); assert.ok(html.includes('content="#285540"') && man.includes('"theme_color": "#285540"'));
  assert.ok(css.includes('MB12.14 작업대 디자인') && /--radius-md:3px/.test(css) && /--kid:#1d7565/.test(css) && /--yth:#405385/.test(css), '디자인 층');
  assert.ok(css.lastIndexOf('MB12.14 작업대 디자인') > css.lastIndexOf('MB11.7 디자인 정리'), '맨 아래에 두어 우선');
});
