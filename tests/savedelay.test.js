import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nextDelay, SAVE_DELAY, SAVE_MAX_WAIT } from '../public/js/savedelay.js';

const PUB = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const text = p => fs.readFileSync(path.join(PUB, p), 'utf8').replace(/\r\n/g, '\n');

test('MB12.23 저장 간격: 입력이 멈추면 5초 뒤, 계속 고쳐도 첫 변경 후 30초 안에는 저장', () => {
  assert.equal(SAVE_DELAY, 5000); assert.equal(SAVE_MAX_WAIT, 30000);
  assert.equal(nextDelay(1000, 1000), 5000, '막 고쳤을 때는 5초');
  assert.equal(nextDelay(26000, 1000), 5000, '25초째까지는 5초');
  assert.equal(nextDelay(28000, 1000), 3000, '30초 한도에 가까우면 남은 시간만');
  assert.equal(nextDelay(31000, 1000), 0, '한도를 넘었으면 바로');
  assert.equal(nextDelay(99000, 1000), 0);
  // 1초마다 1분 동안 계속 고치는 경우의 저장 횟수 시뮬레이션: 예전 방식(700ms 디바운스)은 매번 저장, 지금은 30초마다
  let saves = 0, first = 0, timerAt = Infinity;
  for (let t = 0; t <= 60000; t += 1000) { if (t >= timerAt) { saves++; timerAt = Infinity; first = 0; } if (!first) first = t; timerAt = t + nextDelay(t, first); }
  assert.ok(saves <= 3, `1분 연속 편집에 저장 ${saves}번`);
});

test('MB12.23 서버 저장 어댑터: 같은 내용은 올리지 않고, 저장 중 바뀌면 간격을 두고 다시, 화면을 숨기면 바로', () => {
  const au = text('js/auth.js');
  for (const k of ["import { nextDelay } from './savedelay.js'", 'savedStr = snap', 'if (v === savedStr && !inflight)', 'nextDelay(Date.now(), firstDirtyAt)', "document.addEventListener('visibilitychange'", "window.addEventListener('online', nowFlush)", "if (inflight || blocked) { timer = null; return; }", 'if (dirty && !blocked && !timer) timer = setTimeout(flush, nextDelay(']) assert.ok(au.includes(k), k);
  assert.ok(!/setTimeout\(flush, 700\)/.test(au), '예전 0.7초 저장은 없앤다'); assert.ok(!/while \(dirty && !blocked\)/.test(au), '저장 중 바뀐 내용을 바로 연속으로 올리지 않는다');
  assert.ok(au.includes('pendingWrite(v)'), '서버 저장 전까지 이 기기에 임시 보관(창을 닫아도 되살아남)');
});
