// 커뮤니티 시험 공용 도우미(이 파일은 이름이 .test.js가 아니라 시험으로 실행되지 않는다)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { handle } from '../functions/_lib/handler.js';

export function fakeD1() {
  const db = new DatabaseSync(':memory:'); db.exec('PRAGMA foreign_keys=ON'); db.exec(fs.readFileSync(new URL('../migrations/0001_init.sql', import.meta.url), 'utf8'));
  return { raw: db, prepare: sql => { const st = db.prepare(sql); return { bind: (...a) => ({ first: async () => st.get(...a) || null, all: async () => ({ results: st.all(...a) }), run: async () => ({ success: true, meta: { changes: Number(st.run(...a).changes) } }) }) }; } };
}
export const BASE = 'https://site.test';
export const PW = 'correct-horse-9';
export async function call(env, method, path, { body, cookie, origin = BASE, ip = '1.1.1.1', now } = {}) {
  const headers = { 'CF-Connecting-IP': ip }; if (cookie) headers.Cookie = cookie; if (origin) headers.Origin = origin; if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await handle(new Request(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }), env, now);
  const sc = res.headers.get('Set-Cookie'); return { status: res.status, json: await res.json(), cookie: sc ? sc.split(';')[0] : null };
}
export const envOf = (extra = {}) => ({ DB: fakeD1(), INVITE_CODE: 'invite-xyz-12345', ...extra });
let ipSeq = 10;
export async function signup(env, email, name = '') { const r = await call(env, 'POST', '/api/register', { body: { email, name, password: PW, invite: 'invite-xyz-12345' }, ip: `9.9.9.${ipSeq++}` }); assert.equal(r.status, 201, JSON.stringify(r.json)); return r.cookie; }
export async function mkUsers() { const env = envOf(); const a = await signup(env, 'admin@church.kr'); const b = await signup(env, 'bob@church.kr'); const c = await signup(env, 'carol@church.kr'); return { env, a, b, c }; }
export const post = (env, ck, body, now) => call(env, 'POST', '/api/community/posts', { cookie: ck, body, now });
export const get = (env, ck, path, now) => call(env, 'GET', '/api/community' + path, { cookie: ck, now });
export const send = (env, ck, path, body = {}, now, method = 'POST') => call(env, method, '/api/community' + path, { cookie: ck, body, now });
export const mid = async (env, ck) => (await get(env, ck, '/me')).json.mid;
export const count = (env, sql, ...a) => env.DB.raw.prepare(sql).get(...a).c;
