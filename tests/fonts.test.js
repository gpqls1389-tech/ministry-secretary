import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GROUPS, FONTS, DEFAULT_BODY, DEFAULT_HEAD, byId } from '../public/js/fonts-catalog.js';

const PUB = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const text = p => fs.readFileSync(path.join(PUB, p), 'utf8');

test('MB12.15 글꼴 목록: 묶음·기본값·중복 없음, 내장 글꼴은 모두 SIL OFL 1.1', () => {
  assert.deepEqual(GROUPS, ['고딕', '명조', '제목·장식', '손글씨']); const ids = FONTS.map(f => f.id); assert.equal(new Set(ids).size, ids.length); assert.ok(FONTS.length >= 30, `글꼴 ${FONTS.length}개`);
  assert.equal(DEFAULT_BODY, 'pretendard', '본문 기본은 지금까지 쓰던 프리텐다드'); assert.ok(byId(DEFAULT_BODY) && byId(DEFAULT_HEAD));
  for (const f of FONTS) { assert.ok(GROUPS.includes(f.group), f.id); assert.ok(f.weights.includes(400), f.id); if (f.family) assert.ok(f.stack.startsWith(`'${f.family}'`), f.id); if (f.license) assert.equal(f.license, 'SIL Open Font License 1.1', f.id); }
});

test('글꼴 파일: CSS가 가리키는 woff2가 모두 있고 외부 주소가 없다, 폴더마다 OFL 라이선스 파일, 보안 설정(CSP)이 자기 주소만 허용', () => {
  const emb = FONTS.filter(f => f.css); assert.equal(emb.length, 28, '새로 내장한 글꼴 28종');
  for (const f of emb) {
    const css = text(f.css); const dir = path.dirname(f.css); const urls = [...css.matchAll(/url\(([^)]+)\)/g)].map(m => m[1].replace(/['"]/g, '')); assert.ok(urls.length > 50, `${f.id} 조각 수`);
    for (const u of urls) { assert.ok(!/^(https?:)?\/\//i.test(u), `${f.id}: 외부 주소(${u})`); assert.match(u, /\.woff2$/); assert.ok(fs.existsSync(path.join(PUB, dir, u)), `${f.id}: ${u} 없음`); }
    assert.ok(css.includes(`font-family:'${f.family}'`), `${f.id} family`); assert.match(text(`${dir}/LICENSE.txt`), /SIL OPEN FONT LICENSE/i, `${f.id} OFL`);
  }
  assert.ok(fs.existsSync(path.join(PUB, 'fonts/pretendard/LICENSE.txt')), '프리텐다드 라이선스');
  const headers = text('_headers'); assert.ok(/font-src 'self'/.test(headers) && /style-src 'self'/.test(headers), '글꼴·CSS는 자기 주소에서만');
  assert.ok(/\/fonts\/\*\s+Cache-Control: public, max-age=31536000, immutable/.test(headers), '글꼴은 오래 캐시');
});

test('글꼴 화면 연결: 선택 상자·미리보기·초기화·지연 불러오기, 시작할 때 전부 불러오지 않는다', () => {
  const app = text('js/app.js'); const html = text('index.html'); const css = text('style.css');
  for (const k of ["import * as FC from './fonts-catalog.js'", 'data-font-sel="body"', 'data-font-sel="head"', 'fontReset', 'fontUse', 'id="font-all"', "setProperty('--sans'", "setProperty('--serif'", '${fontSection()}']) assert.ok(app.includes(k), k);
  assert.ok(app.includes('link[data-font="${f.id}"]'), '같은 글꼴 CSS를 두 번 넣지 않는다'); assert.ok(!/fonts\/kr/.test(html), '시작할 때 새 글꼴을 불러오지 않는다(고른 것만)');
  assert.ok(/body \{[^}]*font-family:var\(--sans\)/.test(css), '본문은 --sans'); assert.ok(app.includes("'ms:fontBody'") && app.includes("'ms:fontHead'"), '이 기기에만 저장');
});
