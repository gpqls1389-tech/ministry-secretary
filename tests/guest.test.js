import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PUB = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const text = p => fs.readFileSync(path.join(PUB, p), 'utf8').replace(/\r\n/g, '\n');

test('MB12.17 게스트 모드: 로그인 화면 버튼, 서버·브라우저에 저장하지 않는 메모리 저장소, 안내 띠, 막아 둘 기능', () => {
  const auth = text('js/auth.js'); const app = text('js/app.js');
  for (const k of ['id="guestgo"', "resolve('guest')", "AUTH.mode = 'guest'", 'const m = new Map()']) assert.ok(auth.includes(k), k);
  const guest = auth.slice(auth.indexOf("r === 'guest'"), auth.indexOf("me = await req('GET', '/api/me');\n  }"));
  assert.ok(!/localStorage|req\(/.test(guest), '게스트는 서버 호출·localStorage를 쓰지 않는다');
  assert.ok(/preview \|\| tab === 'register' \? ''/.test(auth), '미리보기·가입 화면에는 게스트 버튼이 없다');
  for (const k of ["const GUEST = A.mode === 'guest'", '게스트 모드 — 가상 데이터', "n[0] === 'community'", 'guestLogin', '영수증 사진을 올릴 수 없어요']) assert.ok(app.includes(k), k);
  assert.ok(/\$\{GUEST \? '' : '<button class="pri" data-act="startEmpty">/.test(app), '게스트에게는 ‘실제 데이터로 시작’을 숨긴다');
});
