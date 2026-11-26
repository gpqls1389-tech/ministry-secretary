import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { makeFileAdapter } from '../public/js/localfile.js';
import { KEY, emptyState } from '../public/js/store.js';

const require = createRequire(import.meta.url);
const LD = require('../desktop/localdata.js');
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const text = p => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mb-ld-'));
const S = (extra = {}) => JSON.stringify({ ...emptyState('2026-11-10'), ...extra });

test('MB12.27 데스크톱 파일 저장소: 읽기·쓰기·검사, 그날 첫 저장 전 상태를 백업으로 남김', () => {
  const dir = tmp(); let t = new Date(2026, 10, 26, 9, 5); const ld = LD.create(dir, () => t);
  assert.deepEqual([ld.read().ok, ld.read().state], [true, null], '처음에는 파일이 없다'); assert.equal(ld.info().exists, false);
  for (const bad of [null, '', '{깨짐', '[]', '{"version":2}', 'x'.repeat(10)]) assert.equal(ld.write(bad).ok, false, `거절: ${String(bad).slice(0, 8)}`); assert.equal(fs.existsSync(ld.main), false, '거절하면 파일을 만들지 않는다');
  const a = S({ nextId: 101 }); assert.equal(ld.write(a).ok, true); assert.equal(ld.read().state, a); assert.equal(ld.list().items.length, 0, '첫 저장에는 백업할 이전 상태가 없다');
  const b = S({ nextId: 102 }); ld.write(b); assert.deepEqual(ld.list().items.map(x => x.name), ['data-2026-11-26.json'], '그날 첫 덮어쓰기 전 상태가 백업'); assert.equal(ld.readBackup('data-2026-11-26.json').state, a);
  ld.write(S({ nextId: 103 })); assert.equal(ld.readBackup('data-2026-11-26.json').state, a, '같은 날 두 번째 저장은 백업을 바꾸지 않는다');
  t = new Date(2026, 10, 27, 8, 0); ld.write(S({ nextId: 104 })); assert.equal(ld.list().items.length, 2, '다음 날 첫 저장에 새 백업'); assert.equal(ld.readBackup('data-2026-11-27.json').state, S({ nextId: 103 }));
  assert.equal(fs.existsSync(ld.main + '.tmp'), false, '임시 파일이 남지 않는다'); assert.equal(JSON.parse(ld.read().state).nextId, 104);
  const m = ld.backupNow(); assert.match(m.name, /^data-2026-11-27-0800-manual\.json$/); assert.equal(ld.list().items.find(x => x.manual).name, m.name); assert.equal(ld.info().backups, 3);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('백업 이름 검사(경로 못 빠져나감)·보관 개수·읽기 오류', () => {
  const dir = tmp(); const ld = LD.create(dir); ld.write(S());
  for (const bad of ['../data.json', '..\\x.json', 'data.json', 'data-2026-11-26.json/../../x', 'data-2026-1-1.json', '', null, 5]) assert.equal(ld.readBackup(bad).ok, false, String(bad));
  assert.equal(ld.readBackup('data-2026-01-01.json').ok, false, '없는 백업');
  fs.mkdirSync(path.join(dir, 'backup'), { recursive: true });
  for (let i = 0; i < 40; i++) { const d = new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10); fs.writeFileSync(path.join(dir, 'backup', `data-${d}.json`), S()); }
  for (let i = 0; i < 25; i++) fs.writeFileSync(path.join(dir, 'backup', `data-2026-03-01-${String(1000 + i)}-manual.json`), S());
  const t = new Date(2027, 0, 5); const ld2 = LD.create(dir, () => t); ld2.write(S({ nextId: 200 })); const items = ld2.list().items;
  assert.ok(items.filter(x => !x.manual).length <= LD.KEEP_DAILY, '매일 백업은 30개까지'); assert.ok(items.filter(x => x.manual).length <= LD.KEEP_MANUAL, '직접 백업은 20개까지');
  fs.writeFileSync(path.join(dir, 'backup', 'data-2026-05-05.json'), '깨진 파일'); assert.equal(ld2.readBackup('data-2026-05-05.json').ok, false, '깨진 백업은 되돌리기에 쓰지 않는다');
  const bad = LD.create(path.join(dir, 'data.json', 'x')); assert.equal(bad.write(S()).ok, false, '폴더를 못 만들면 오류를 돌려준다'); fs.rmSync(dir, { recursive: true, force: true });
});

function fakeLd() { const w = { writes: [], sync: [], fail: false }; return { w, write: async s => { w.writes.push(s); return w.fail ? { ok: false, error: '실패' } : { ok: true }; }, writeSync: s => { w.sync.push(s); return { ok: true }; } }; }
function fakeTimers() { let id = 0; const q = new Map(); return { set: (f, ms) => { q.set(++id, { f, ms }); return id; }, clear: t => { q.delete(t); }, q, fire: async () => { const [k, v] = [...q][0] || []; if (k) { q.delete(k); await v.f(); } } }; }

test('파일 저장 어댑터: 바뀌면 잠시 뒤 한 번 저장, 같은 내용은 생략, 실패는 다시 시도, 닫을 때 동기 저장', async () => {
  const ld = fakeLd(); const tm = fakeTimers(); let clock = 0; const st = []; const ad = makeFileAdapter(ld, 'A', { timers: tm, now: () => clock, onStatus: (s, m) => st.push(s + (m ? ':' + m : '')) });
  assert.equal(ad.getItem(KEY), 'A'); assert.equal(ad.getItem('other'), null);
  ad.setItem(KEY, 'A'); assert.equal(tm.q.size, 0, '서버(파일)와 같은 내용이면 저장 예약 없음'); ad.setItem(KEY, 'B'); clock = 200; ad.setItem(KEY, 'C'); assert.equal(tm.q.size, 1, '연속 변경은 예약 하나로'); assert.ok([...tm.q.values()][0].ms <= 1500);
  await tm.fire(); assert.deepEqual(ld.w.writes, ['C'], '마지막 내용만 한 번 저장'); assert.equal(st.at(-1), 'saved'); assert.equal(ad.dirty, false);
  ad.setItem(KEY, 'C'); assert.equal(tm.q.size, 0, '방금 저장한 것과 같으면 생략');
  ld.w.fail = true; ad.setItem(KEY, 'D'); await tm.fire(); assert.match(st.at(-1), /^failed:실패/); assert.equal(ad.dirty, true); assert.equal(tm.q.size, 1, '5초 뒤 다시 시도'); ld.w.fail = false; await tm.fire(); assert.equal(ld.w.writes.at(-1), 'D'); assert.equal(st.at(-1), 'saved');
  ad.setItem(KEY, 'E'); assert.equal(ad.flushSync(), true); assert.deepEqual(ld.w.sync, ['E'], '닫기 직전 동기 저장'); assert.equal(ad.dirty, false); assert.equal(ad.flushSync(), true, '바뀐 게 없으면 그대로 성공');
  ad.setItem(KEY, 'F'); ad.close(); ad.setItem(KEY, 'G'); await tm.fire(); assert.equal(ld.w.writes.includes('G'), false, '닫은 뒤에는 저장하지 않는다');
  const ad2 = makeFileAdapter(ld, 'X', { savedStr: null, timers: fakeTimers() }); ad2.setItem(KEY, 'X'); assert.equal(ad2.dirty, true, '파일에 아직 없던 내용(savedStr 없음)은 같아도 저장한다');
});

test('기본 타이머는 setTimeout을 메서드로 부르지 않는다(브라우저에서 Illegal invocation) — 실제 타이머로 저장된다', async () => {
  const ld = fakeLd(); const ad = makeFileAdapter(ld, 'A', { delay: 20, maxWait: 100 }); ad.setItem(KEY, 'B'); await new Promise(r => setTimeout(r, 120)); assert.deepEqual(ld.w.writes, ['B']);
  const src = text('public/js/localfile.js'); assert.ok(/timers = \{ set: \(f, ms\) => setTimeout\(f, ms\), clear: t => clearTimeout\(t\) \}/.test(src), '화살표 함수로 감싼다');
});

test('연결: 시작 화면 버튼·파일 시작·계정 옮기기·저장 방식 카드, 데스크톱 IPC·preload·설치 파일 목록', () => {
  const au = text('public/js/auth.js'); const app = text('public/js/app.js'); const main = text('desktop/main.js'); const pre = text('desktop/preload.js'); const pkg = JSON.parse(text('desktop/package.json'));
  for (const k of ['id="filego"', "lsSet(STORAGE_KEY, 'file')", 'async function fileStart', "lsGet(STORAGE_KEY) === 'file'", "if (r === 'file') return fileStart", "AUTH.reason = 'file'", "MIGRATE_KEY) === '1'", "!desktopFile() ? ''"]) assert.ok(au.includes(k), k);
  for (const k of ['function storageCard', 'async function paintStorage', "A.reason === 'file'", 'storageToAccount', 'storageToFile', 'storageRestore', 'if (i.ok && i.exists) await ld.backup()', 'setTimeout(paintStorage, 0)']) assert.ok(app.includes(k), k);
  for (const k of ["ipcMain.handle('ld:read'", "ipcMain.handle('ld:write'", "ipcMain.on('ld:writeSync'", "ipcMain.handle('ld:readBackup'", 'fromSite(e) ?', 'const DEV = !app.isPackaged', '(DEV && process.env.MB_DATA_DIR)', "require('./localdata')"]) assert.ok(main.includes(k), k);
  for (const k of ['localdata: {', "ipcRenderer.invoke('ld:read')", "ipcRenderer.sendSync('ld:writeSync'", "String(name || '')"]) assert.ok(pre.includes(k), k);
  assert.ok(!/path|filePath|dir/i.test(pre.slice(pre.indexOf('localdata: {'))), '화면이 경로를 넘길 수 없다(preload)'); assert.ok(pkg.build.files.includes('localdata.js'), '설치 파일에 localdata.js 포함');
  assert.ok(/const SITE = 'https:\/\/ministry-secretary\.pages\.dev\/';/.test(main) && /const BASE = \(DEV && process\.env\.MB_SITE\) \|\| SITE;/.test(main), '주소 환경 변수는 개발 중에만(설치본은 항상 SITE)');
});
