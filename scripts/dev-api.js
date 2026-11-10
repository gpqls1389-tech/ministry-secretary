// 로컬 개발용: 정적 파일 + /api(로그인·저장)를 함께 제공. Cloudflare D1 대신 같은 SQL을 SQLite 파일(.devdata/dev.sqlite)로 실행한다.
// 실행: npm run dev:api  → http://localhost:8789  (초대 코드는 환경변수 INVITE_CODE, 기본값 dev-invite-local-only)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { handle } from '../functions/_lib/handler.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const pub = path.join(root, 'public'); const dataDir = path.join(root, '.devdata'); fs.mkdirSync(dataDir, { recursive: true });
const port = Number(process.env.PORT) || 8789;
const sqlite = new DatabaseSync(process.env.DEV_DB || path.join(dataDir, 'dev.sqlite')); sqlite.exec('PRAGMA foreign_keys=ON'); sqlite.exec(fs.readFileSync(path.join(root, 'migrations', '0001_init.sql'), 'utf8'));
const DB = { prepare: sql => { const st = sqlite.prepare(sql); return { bind: (...a) => ({ first: async () => st.get(...a) || null, all: async () => ({ results: st.all(...a) }), run: async () => ({ success: true, meta: { changes: Number(st.run(...a).changes) } }) }) }; } };
const env = { DB, MAX_USERS: process.env.MAX_USERS, INVITE_CODE: process.env.INVITE_CODE === '' ? undefined : (process.env.INVITE_CODE || 'dev-invite-local-only') };
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg' };

http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://localhost:${port}`);
  if (u.pathname.startsWith('/api/')) {
    const chunks = []; for await (const c of req) chunks.push(c); const body = Buffer.concat(chunks);
    const headers = new Headers(); for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v); headers.set('CF-Connecting-IP', req.socket.remoteAddress || 'local');
    const r = await handle(new Request(u.href, { method: req.method, headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : body }), env);
    const out = {}; r.headers.forEach((v, k) => { out[k] = v; }); res.writeHead(r.status, out); res.end(Buffer.from(await r.arrayBuffer())); return; // 사진(바이너리)도 깨지지 않게 바이트 그대로 전달
  }
  let p = decodeURIComponent(u.pathname); if (p.endsWith('/')) p += 'index.html'; const f = path.normalize(path.join(pub, p));
  if (!f.startsWith(pub) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Not found'); return; }
  res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); fs.createReadStream(f).pipe(res);
}).listen(port, '127.0.0.1', () => console.log(`http://localhost:${port}  (초대 코드: ${env.INVITE_CODE ?? '가입 닫힘'})`));
