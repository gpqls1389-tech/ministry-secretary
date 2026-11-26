// 목회 비서 데스크톱: ‘내 컴퓨터에만 저장’ 모드의 파일 저장소(MB12.27).
// 정해진 폴더(내 문서\목회비서) 안의 data.json 하나와 backup 폴더만 다룬다. 어떤 경로도 바깥에서 받지 않는다.
// - 쓰기는 임시 파일에 쓴 뒤 바꿔치기(중간에 꺼져도 옛 파일이 그대로)
// - 그날 처음 쓸 때, 쓰기 전의 data.json을 backup\data-날짜.json 으로 남긴다(어제까지의 마지막 상태). 30일치만 보관
// - ‘지금 백업’은 backup\data-날짜-시분-manual.json (20개 보관)
'use strict';
const fs = require('fs');
const path = require('path');

const MAX_BYTES = 30 * 1024 * 1024;
const KEEP_DAILY = 30;
const KEEP_MANUAL = 20;
const NAME = /^data-\d{4}-\d{2}-\d{2}(?:-\d{4}-manual)?\.json$/;
const pad = n => String(n).padStart(2, '0');

function create(dir, now = () => new Date()) {
  const main = path.join(dir, 'data.json'); const bdir = path.join(dir, 'backup');
  const day = () => { const d = now(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const hm = () => { const d = now(); return `${pad(d.getHours())}${pad(d.getMinutes())}`; };
  const ensure = () => { fs.mkdirSync(bdir, { recursive: true }); };
  const fail = e => ({ ok: false, error: e && e.code === 'EACCES' ? '이 폴더에 쓸 권한이 없어요.' : e && e.code === 'ENOSPC' ? '저장 공간이 부족해요.' : String((e && e.message) || e).slice(0, 160) });
  // 앱 데이터(JSON 글자)인지 확인: 크기 제한, 객체, version 1
  const valid = s => { if (typeof s !== 'string' || !s || Buffer.byteLength(s) > MAX_BYTES) return false; try { const j = JSON.parse(s); return !!j && typeof j === 'object' && !Array.isArray(j) && j.version === 1; } catch (e) { return false; } };
  function atomicWrite(file, data) { const tmp = `${file}.tmp`; const fd = fs.openSync(tmp, 'w'); try { fs.writeSync(fd, data); fs.fsyncSync(fd); } finally { fs.closeSync(fd); } fs.renameSync(tmp, file); }
  function files() { try { return fs.readdirSync(bdir).filter(n => NAME.test(n)).map(n => { const st = fs.statSync(path.join(bdir, n)); return { name: n, bytes: st.size, at: st.mtimeMs, manual: n.endsWith('-manual.json') }; }).sort((a, b) => b.name.localeCompare(a.name)); } catch (e) { return []; } }
  function prune() { const all = files(); for (const [manual, keep] of [[false, KEEP_DAILY], [true, KEEP_MANUAL]]) for (const f of all.filter(x => x.manual === manual).slice(keep)) { try { fs.unlinkSync(path.join(bdir, f.name)); } catch (e) { /* 지우지 못해도 그만 */ } } }
  return {
    dir, main,
    read() { try { if (!fs.existsSync(main)) return { ok: true, state: null, path: main }; const state = fs.readFileSync(main, 'utf8'); return { ok: true, state, path: main, bytes: Buffer.byteLength(state), savedAt: fs.statSync(main).mtimeMs }; } catch (e) { return fail(e); } },
    write(state) {
      if (!valid(state)) return { ok: false, error: '저장할 데이터 형식이 올바르지 않아요(저장하지 않았어요).' };
      try {
        ensure();
        if (fs.existsSync(main)) { const dst = path.join(bdir, `data-${day()}.json`); if (!fs.existsSync(dst)) { fs.copyFileSync(main, dst); prune(); } } // 그날 첫 저장 전의 상태를 남긴다
        atomicWrite(main, state); return { ok: true, bytes: Buffer.byteLength(state), savedAt: Date.now() };
      } catch (e) { return fail(e); }
    },
    backupNow() { try { if (!fs.existsSync(main)) return { ok: false, error: '저장된 데이터가 아직 없어요.' }; ensure(); const name = `data-${day()}-${hm()}-manual.json`; fs.copyFileSync(main, path.join(bdir, name)); prune(); return { ok: true, name }; } catch (e) { return fail(e); } },
    list() { return { ok: true, items: files() }; },
    readBackup(name) { if (typeof name !== 'string' || !NAME.test(name)) return { ok: false, error: '백업 이름이 올바르지 않아요.' }; try { const state = fs.readFileSync(path.join(bdir, name), 'utf8'); return valid(state) ? { ok: true, state } : { ok: false, error: '이 백업 파일은 열 수 없어요.' }; } catch (e) { return fail(e); } },
    info() { const r = this.read(); return { ok: r.ok, dir, path: main, exists: !!(r.ok && r.state), bytes: r.bytes || 0, savedAt: r.savedAt || 0, backups: files().length }; },
    valid,
  };
}
module.exports = { create, NAME, MAX_BYTES, KEEP_DAILY, KEEP_MANUAL };
