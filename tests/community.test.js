import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { handle } from '../functions/_lib/handler.js';
import { COMMUNITY_CATS } from '../functions/_lib/community.js';

// 커뮤니티(MB12.9) API 시험: 실제 SQLite로 같은 SQL을 실행한다(api.test.js와 같은 방식)
function fakeD1() {
  const db = new DatabaseSync(':memory:'); db.exec('PRAGMA foreign_keys=ON'); db.exec(fs.readFileSync(new URL('../migrations/0001_init.sql', import.meta.url), 'utf8'));
  return { raw: db, prepare: sql => { const st = db.prepare(sql); return { bind: (...a) => ({ first: async () => st.get(...a) || null, all: async () => ({ results: st.all(...a) }), run: async () => ({ success: true, meta: { changes: Number(st.run(...a).changes) } }) }) }; } };
}
const BASE = 'https://site.test';
async function call(env, method, path, { body, cookie, origin = BASE, ip = '1.1.1.1', now } = {}) {
  const headers = { 'CF-Connecting-IP': ip }; if (cookie) headers.Cookie = cookie; if (origin) headers.Origin = origin; if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await handle(new Request(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }), env, now);
  const sc = res.headers.get('Set-Cookie'); return { status: res.status, json: await res.json(), cookie: sc ? sc.split(';')[0] : null };
}
const envOf = (extra = {}) => ({ DB: fakeD1(), INVITE_CODE: 'invite-xyz-12345', ...extra });
const PW = 'correct-horse-9';
async function signup(env, email, ip, name = '') { const r = await call(env, 'POST', '/api/register', { body: { email, name, password: PW, invite: 'invite-xyz-12345' }, ip }); assert.equal(r.status, 201, JSON.stringify(r.json)); return r.cookie; }
const mkUsers = async () => { const env = envOf(); const a = await signup(env, 'admin@church.kr', '1.1.1.1'); const b = await signup(env, 'bob@church.kr', '2.2.2.2'); const c = await signup(env, 'carol@church.kr', '3.3.3.3'); return { env, a, b, c }; };
const post = (env, ck, body, now) => call(env, 'POST', '/api/community/posts', { cookie: ck, body, now });
const del = (env, ck, path) => call(env, 'DELETE', path, { cookie: ck, body: {} });
const n = (env, sql, ...a) => env.DB.raw.prepare(sql).get(...a).c;

test('커뮤니티: 로그인 필요, 글쓰기 검사(분류·길이·공지는 관리자만), 목록·상세, 작성자 이메일 비노출', async () => {
  const { env, a, b } = await mkUsers();
  assert.equal((await call(env, 'GET', '/api/community/posts')).status, 401); assert.equal((await call(env, 'POST', '/api/community/posts', { body: { category: '자유', title: '제목', body: '내용' } })).status, 401);
  assert.equal((await post(env, b, { category: '없는분류', title: '제목', body: '내용' })).status, 400); assert.equal((await post(env, b, { category: '자유', title: '가', body: '내용' })).status, 400, '제목 너무 짧음');
  assert.equal((await post(env, b, { category: '자유', title: '제목', body: ' ' })).status, 400); assert.equal((await post(env, b, { category: '자유', title: '가'.repeat(61), body: '내용' })).status, 400); assert.equal((await post(env, b, { category: '자유', title: '제목', body: '가'.repeat(4001) })).status, 400);
  assert.equal((await post(env, b, { category: '공지', title: '공지입니다', body: '내용' })).status, 403, '공지는 관리자만'); assert.equal((await post(env, a, { category: '공지', title: '공지입니다', body: '내용' })).status, 201);
  const p1 = await post(env, b, { category: '자료 나눔', title: '  성탄 활동 아이디어  ', body: '1. 대림초 만들기\r\n2. <b>굵게</b> & "따옴표"\u0001' }); assert.equal(p1.status, 201); assert.ok(p1.json.id > 0);
  const d = await call(env, 'GET', '/api/community/posts/' + p1.json.id, { cookie: a }); assert.equal(d.status, 200); assert.equal(d.json.post.title, '성탄 활동 아이디어');
  assert.equal(d.json.post.body, '1. 대림초 만들기\n2. <b>굵게</b> & "따옴표"', '제어문자 제거·줄바꿈 통일, 태그는 그대로 저장(화면에서 이스케이프)');
  assert.equal(d.json.post.author, 'bo***', '이름이 없으면 이메일 앞 두 글자+***'); assert.ok(!JSON.stringify(d.json).includes('bob@church.kr'), '이메일 전체는 응답에 없다'); assert.equal(d.json.post.mine, false); assert.equal((await call(env, 'GET', '/api/community/posts/' + p1.json.id, { cookie: b })).json.post.mine, true);
  const L = await call(env, 'GET', '/api/community/posts', { cookie: b }); assert.equal(L.status, 200); assert.equal(L.json.items.length, 2); assert.ok(L.json.items[0].preview.length <= 140); assert.ok(!('body' in L.json.items[0]), '목록에는 본문 전체가 없다'); assert.deepEqual(L.json.cats, COMMUNITY_CATS);
  assert.equal((await call(env, 'GET', '/api/community/posts?category=' + encodeURIComponent('자료 나눔'), { cookie: b })).json.items.length, 1); assert.equal((await call(env, 'GET', '/api/community/posts?category=x', { cookie: b })).status, 400);
  assert.equal((await call(env, 'GET', '/api/community/posts/99999', { cookie: b })).status, 404); assert.equal((await post(env, b, { category: '자유', title: '제목', body: '내용' })).status, 201); assert.equal((await call(env, 'POST', '/api/community/posts', { cookie: b, body: { category: '자유', title: '제목', body: '내용' }, origin: 'https://evil.test' })).status, 403, '다른 출처 거부');
  assert.equal((await call(env, 'GET', '/api/community/nope', { cookie: b })).status, 404);
});

test('커뮤니티: 이름 표시, 고치기·지우기 권한, 댓글, 좋아요(토글), 쪽 나누기와 고정 글', async () => {
  const { env, a, b, c } = await mkUsers(); const named = await signup(env, 'named@church.kr', '4.4.4.4', '김전도사');
  const p = (await post(env, named, { category: '질문·상담', title: '질문 있어요', body: '본문입니다' })).json.id; assert.equal((await call(env, 'GET', '/api/community/posts/' + p, { cookie: b })).json.post.author, '김전도사');
  assert.equal((await call(env, 'PUT', '/api/community/posts/' + p, { cookie: b, body: { title: '바꿈', body: '바꿈 내용' } })).status, 403); assert.equal((await call(env, 'PUT', '/api/community/posts/' + p, { cookie: a, body: { title: '바꿈', body: '바꿈 내용' } })).status, 403, '관리자도 남의 글은 못 고친다');
  assert.equal((await call(env, 'PUT', '/api/community/posts/' + p, { cookie: named, body: { title: '고친 제목', body: '고친 내용' }, now: Date.now() + 5000 })).status, 200); const g = (await call(env, 'GET', '/api/community/posts/' + p, { cookie: b })).json.post; assert.equal(g.title, '고친 제목'); assert.equal(g.edited, true); assert.equal(g.category, '질문·상담', '분류는 그대로');
  assert.equal((await call(env, 'PUT', '/api/community/posts/' + p, { cookie: named, body: { category: '공지', title: '고친 제목', body: '고친 내용' } })).status, 403, '일반 사용자가 공지로 바꿀 수 없다');
  assert.equal((await call(env, 'POST', `/api/community/posts/${p}/comments`, { cookie: b, body: { body: '' } })).status, 400); const cm = await call(env, 'POST', `/api/community/posts/${p}/comments`, { cookie: b, body: { body: '첫 댓글 <script>' } }); assert.equal(cm.status, 201); await call(env, 'POST', `/api/community/posts/${p}/comments`, { cookie: c, body: { body: '두 번째' } });
  let like = await call(env, 'POST', `/api/community/posts/${p}/like`, { cookie: b, body: {} }); assert.deepEqual([like.json.liked, like.json.likes], [true, 1]); like = await call(env, 'POST', `/api/community/posts/${p}/like`, { cookie: c, body: {} }); assert.equal(like.json.likes, 2); like = await call(env, 'POST', `/api/community/posts/${p}/like`, { cookie: b, body: {} }); assert.deepEqual([like.json.liked, like.json.likes], [false, 1], '다시 누르면 취소');
  const det = (await call(env, 'GET', '/api/community/posts/' + p, { cookie: c })).json; assert.equal(det.comments.length, 2); assert.equal(det.comments[0].body, '첫 댓글 <script>'); assert.equal(det.comments[0].mine, false); assert.equal(det.comments[1].mine, true); assert.equal(det.post.comments, 2); assert.equal(det.post.liked, true);
  assert.equal((await del(env, c, '/api/community/comments/' + cm.json.id)).status, 403); assert.equal((await del(env, b, '/api/community/comments/' + cm.json.id)).status, 200);
  assert.equal((await del(env, b, '/api/community/posts/' + p)).status, 403); assert.equal((await del(env, a, '/api/community/posts/' + p)).status, 200, '관리자는 지울 수 있다');
  assert.equal(n(env, 'SELECT COUNT(*) c FROM comments'), 0); assert.equal(n(env, 'SELECT COUNT(*) c FROM post_likes'), 0); assert.equal((await call(env, 'GET', '/api/community/posts/' + p, { cookie: a })).status, 404);
  const uid = env.DB.raw.prepare('SELECT id FROM users WHERE email=?').get('named@church.kr').id; const ids = []; // 한 시간 10개 제한을 피해 SQL로 직접 25개를 넣는다
  for (let i = 0; i < 25; i++) ids.push(Number(env.DB.raw.prepare('INSERT INTO posts(user_id, category, title, body, created_at, updated_at) VALUES(?,?,?,?,?,?)').run(uid, '자유', '글 ' + i, '내용 ' + i, Date.now() + i, Date.now() + i).lastInsertRowid));
  assert.equal((await call(env, 'POST', `/api/community/posts/${ids[0]}/pin`, { cookie: b, body: { pinned: true } })).status, 403); assert.equal((await call(env, 'POST', `/api/community/posts/${ids[0]}/pin`, { cookie: a, body: { pinned: true } })).json.pinned, true);
  const p1 = (await call(env, 'GET', '/api/community/posts', { cookie: b })).json; assert.equal(p1.items[0].id, ids[0], '고정 글이 맨 위'); assert.equal(p1.items[0].pinned, true); assert.equal(p1.items.length, 21, '고정 1 + 20'); assert.ok(p1.next > 0);
  const p2 = (await call(env, 'GET', '/api/community/posts?before=' + p1.next, { cookie: b })).json; assert.equal(p2.items.length, 4, '남은 4개'); assert.equal(p2.next, 0); assert.ok(!p2.items.some(x => x.id === ids[0]), '고정 글은 첫 쪽에만');
});

test('커뮤니티: 숨기기(관리자)·신고·신고 처리, 숨긴 글은 일반 사용자에게 안 보인다', async () => {
  const { env, a, b, c } = await mkUsers(); const p = (await post(env, b, { category: '자유', title: '문제 글', body: '문제 내용' })).json.id; const cm = (await call(env, 'POST', `/api/community/posts/${p}/comments`, { cookie: c, body: { body: '문제 댓글' } })).json.id;
  assert.equal((await call(env, 'POST', '/api/community/report', { cookie: b, body: { kind: 'post', id: p, reason: '내 글' } })).status, 400); assert.equal((await call(env, 'POST', '/api/community/report', { cookie: c, body: { kind: 'post', id: 99999 } })).status, 404); assert.equal((await call(env, 'POST', '/api/community/report', { cookie: c, body: { kind: 'x', id: p } })).status, 400);
  assert.equal((await call(env, 'POST', '/api/community/report', { cookie: c, body: { kind: 'post', id: p, reason: '광고입니다' } })).status, 200); await call(env, 'POST', '/api/community/report', { cookie: c, body: { kind: 'post', id: p, reason: '또 신고' } }); await call(env, 'POST', '/api/community/report', { cookie: a, body: { kind: 'comment', id: cm, reason: '부적절' } });
  assert.equal(n(env, "SELECT COUNT(*) c FROM community_reports WHERE kind='post'"), 1, '같은 사람의 같은 대상 신고는 한 번만');
  assert.equal((await call(env, 'GET', '/api/community/reports', { cookie: c })).status, 403); const R = (await call(env, 'GET', '/api/community/reports', { cookie: a })).json.items; assert.equal(R.length, 2); const rp = R.find(x => x.kind === 'post'); assert.equal(rp.id, p); assert.equal(rp.count, 1); assert.deepEqual(rp.reasons, ['광고입니다']); assert.equal(rp.author, 'bo***'); assert.equal(R.find(x => x.kind === 'comment').postId, p);
  assert.equal((await call(env, 'GET', '/api/community/summary', { cookie: a })).json.reports, 2, '관리자에게만 신고 수'); assert.equal((await call(env, 'GET', '/api/community/summary', { cookie: c })).json.reports, 0);
  assert.equal((await call(env, 'POST', `/api/community/posts/${p}/hide`, { cookie: c, body: { hidden: true } })).status, 403); assert.equal((await call(env, 'POST', `/api/community/posts/${p}/hide`, { cookie: a, body: { hidden: true } })).json.hidden, true);
  assert.equal((await call(env, 'GET', '/api/community/posts', { cookie: c })).json.items.length, 0); assert.equal((await call(env, 'GET', '/api/community/posts/' + p, { cookie: c })).status, 404);
  const mine = (await call(env, 'GET', '/api/community/posts', { cookie: b })).json.items; assert.equal(mine.length, 1, '작성자는 자기 글이 숨겨진 것을 볼 수 있다'); assert.equal(mine[0].hidden, true); assert.equal((await call(env, 'GET', '/api/community/posts/' + p, { cookie: a })).json.post.hidden, true);
  assert.equal((await call(env, 'POST', `/api/community/posts/${p}/comments`, { cookie: c, body: { body: '숨긴 글에 댓글' } })).status, 404);
  await call(env, 'POST', `/api/community/posts/${p}/hide`, { cookie: a, body: { hidden: false } }); assert.equal((await call(env, 'GET', '/api/community/posts', { cookie: c })).json.items.length, 1);
  assert.equal((await call(env, 'POST', `/api/community/comments/${cm}/hide`, { cookie: c, body: { hidden: true } })).status, 403); await call(env, 'POST', `/api/community/comments/${cm}/hide`, { cookie: a, body: { hidden: true } });
  const view = (await call(env, 'GET', '/api/community/posts/' + p, { cookie: b })).json; assert.deepEqual([view.comments[0].hidden, view.comments[0].body, view.comments[0].author], [true, '', '']); assert.equal(view.post.comments, 0, '숨긴 댓글은 댓글 수에서 뺀다');
  assert.equal((await call(env, 'GET', '/api/community/posts/' + p, { cookie: a })).json.comments[0].body, '문제 댓글', '관리자는 본문을 본다');
  await call(env, 'POST', '/api/community/reports/clear', { cookie: a, body: { kind: 'post', id: p } }); assert.equal((await call(env, 'GET', '/api/community/reports', { cookie: a })).json.items.length, 1); assert.equal((await call(env, 'POST', '/api/community/reports/clear', { cookie: c, body: { kind: 'comment', id: cm } })).status, 403);
});

test('커뮤니티: 관리자 지정(첫 가입자·ADMIN_EMAILS), 글·댓글 횟수 제한, 알림 배지, 계정 삭제 정리', async () => {
  const { env, a, b, c } = await mkUsers();
  assert.equal((await call(env, 'GET', '/api/community/summary', { cookie: a })).json.admin, true, '가장 먼저 가입한 계정'); assert.equal((await call(env, 'GET', '/api/community/summary', { cookie: b })).json.admin, false);
  const env2 = { ...envOf(), ADMIN_EMAILS: 'bob@church.kr, other@church.kr' }; const a2 = await signup(env2, 'admin@church.kr', '1.1.1.1'); const b2 = await signup(env2, 'bob@church.kr', '2.2.2.2');
  assert.equal((await call(env2, 'GET', '/api/community/summary', { cookie: a2 })).json.admin, false, 'ADMIN_EMAILS가 있으면 그 목록만'); assert.equal((await call(env2, 'GET', '/api/community/summary', { cookie: b2 })).json.admin, true);
  const t0 = Date.now(); assert.equal((await call(env, 'GET', '/api/community/summary', { cookie: b, now: t0 })).json.unread, 0, '처음 열면 0'); await call(env, 'GET', '/api/community/summary', { cookie: c, now: t0 }); await call(env, 'GET', '/api/community/summary', { cookie: a, now: t0 });
  const p = (await post(env, c, { category: '자유', title: '새 글', body: '내용' }, t0 + 1000)).json.id; await call(env, 'POST', `/api/community/posts/${p}/comments`, { cookie: a, body: { body: '댓글' }, now: t0 + 2000 });
  assert.equal((await call(env, 'GET', '/api/community/summary', { cookie: b, now: t0 + 3000 })).json.unread, 2); assert.equal((await call(env, 'GET', '/api/community/summary', { cookie: c, now: t0 + 3000 })).json.unread, 1, '내 글은 빼고 다른 사람 댓글만');
  await call(env, 'POST', '/api/community/seen', { cookie: b, body: {}, now: t0 + 4000 }); assert.equal((await call(env, 'GET', '/api/community/summary', { cookie: b, now: t0 + 5000 })).json.unread, 0);
  for (let i = 0; i < 10; i++) assert.equal((await post(env, b, { category: '자유', title: '도배 ' + i, body: '내용' }, t0 + 6000)).status, 201); const spam = await post(env, b, { category: '자유', title: '도배 초과', body: '내용' }, t0 + 6000); assert.equal(spam.status, 429); assert.match(spam.json.error, /한 시간에 10개/);
  assert.equal((await post(env, b, { category: '자유', title: '한 시간 뒤', body: '내용' }, t0 + 6000 + 3601e3)).status, 201, '한 시간 뒤에는 다시');
  for (let i = 0; i < 40; i++) assert.equal((await call(env, 'POST', `/api/community/posts/${p}/comments`, { cookie: b, body: { body: '도배 ' + i }, now: t0 + 9e6 })).status, 201); assert.equal((await call(env, 'POST', `/api/community/posts/${p}/comments`, { cookie: b, body: { body: '초과' }, now: t0 + 9e6 })).status, 429);
  assert.equal((await post(env, c, { category: '자유', title: '다른 사람은 가능', body: '내용' }, t0 + 6000)).status, 201, '다른 계정의 한도는 영향 없음');
  const mine = (await post(env, c, { category: '자유', title: 'c의 글', body: '내용' }, t0 + 6000)).json.id; await call(env, 'POST', `/api/community/posts/${mine}/comments`, { cookie: a, body: { body: 'a의 댓글' }, now: t0 + 9e6 + 1 }); await call(env, 'POST', `/api/community/posts/${p}/like`, { cookie: c, body: {} }); await call(env, 'POST', '/api/community/report', { cookie: c, body: { kind: 'post', id: mine + 0 === p ? 0 : (await post(env, b, { category: '자유', title: 'b의 글', body: '내용' }, t0 + 6000 + 3601e3 + 1)).json.id } });
  assert.equal((await call(env, 'POST', '/api/delete-account', { cookie: c, body: { password: PW } })).status, 200);
  assert.equal(n(env, 'SELECT COUNT(*) c FROM posts WHERE user_id=(SELECT id FROM users WHERE email=?)', 'carol@church.kr'), 0); assert.equal(n(env, 'SELECT COUNT(*) c FROM posts WHERE id=?', mine), 0); assert.equal(n(env, 'SELECT COUNT(*) c FROM comments WHERE post_id=?', mine), 0, '그 사람 글에 달린 다른 사람 댓글도 함께 지워진다');
  assert.equal(n(env, 'SELECT COUNT(*) c FROM post_likes'), 0); assert.equal(n(env, 'SELECT COUNT(*) c FROM community_reports'), 0); assert.equal((await call(env, 'GET', '/api/community/posts', { cookie: b })).status, 200, '삭제 뒤에도 목록은 정상');
});

test('커뮤니티: 분류 목록은 서버와 화면이 같다', async () => {
  const ui = await import('../public/js/community.js').catch(() => null); if (ui) assert.deepEqual(ui.COMMUNITY_CATS, COMMUNITY_CATS);
});
