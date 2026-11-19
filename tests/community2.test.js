import test from 'node:test';
import assert from 'node:assert/strict';
import { PW, call, mkUsers, signup, envOf, post, get, send, mid, count } from './_community_util.js';

test('MB12.10 소개(프로필): 내 번호, 저장 검사, 표시 이름이 글·댓글 작성자로 쓰인다, 관리자 표시', async () => {
  const { env, a, b } = await mkUsers();
  assert.equal((await get(env, null, '/me')).status, 401);
  const me = (await get(env, b, '/me')).json; assert.ok(me.mid > 0); assert.deepEqual([me.listed, me.dm_ok, me.nick], [false, true, '']);
  assert.equal((await send(env, b, '/me', { listed: true, nick: '', church: '가온교회' }, undefined, 'PUT')).status, 400, '공개하려면 표시 이름이 필요');
  for (const bad of [{ nick: '가'.repeat(21) }, { church: '가'.repeat(31) }, { role: '가'.repeat(31) }, { bio: '가'.repeat(201) }]) assert.equal((await send(env, b, '/me', { nick: '밥', ...bad }, undefined, 'PUT')).status, 400);
  assert.equal((await send(env, b, '/me', { listed: true, dm_ok: true, nick: '  박  전도사 ', church: '가온교회', role: '아동부', bio: '성탄 발표회를 준비해요\n\n\n\n함께해요' }, undefined, 'PUT')).status, 200);
  const saved = (await get(env, b, '/me')).json; assert.deepEqual([saved.listed, saved.nick, saved.church, saved.role], [true, '박 전도사', '가온교회', '아동부']); assert.equal(saved.bio, '성탄 발표회를 준비해요\n\n함께해요');
  const p = (await post(env, b, { category: '자유', title: '표시 이름 시험', body: '내용' })).json.id;
  const d = (await get(env, a, '/posts/' + p)).json; assert.equal(d.post.author, '박 전도사', '표시 이름이 우선'); assert.equal(d.post.mid, saved.mid); assert.equal(d.post.staff, false);
  const mine = (await post(env, a, { category: '공지', title: '관리자 글', body: '내용' })).json.id; assert.equal((await get(env, b, '/posts/' + mine)).json.post.staff, true, '관리자 계정 글에는 관리자 표시(사칭 방지)');
  await call(env, 'POST', `/api/community/posts/${p}/comments`, { cookie: a, body: { body: '관리자 댓글' } }); const cm = (await get(env, b, '/posts/' + p)).json.comments[0]; assert.equal(cm.staff, true); assert.ok(cm.mid > 0);
  assert.ok(!JSON.stringify(d).includes('@church.kr'), '이메일은 어디에도 없다');
});

test('MB12.10 사람 찾기: 공개한 사람만, 검색, 쪽 나누기, 카드(공개 안 한 사람은 이름만)', async () => {
  const { env, a, b, c } = await mkUsers(); const bm = await mid(env, b), cm = await mid(env, c);
  assert.deepEqual((await get(env, a, '/members')).json.items, [], '아무도 공개하지 않았으면 비어 있다');
  await send(env, b, '/me', { listed: true, nick: '박전도사', church: '가온교회', role: '아동부 담당', bio: '유치부 성탄 발표회 준비 중' }, undefined, 'PUT');
  await send(env, c, '/me', { listed: false, nick: '비공개', church: '숨은교회', role: '청년부', bio: '비밀' }, undefined, 'PUT');
  const L = (await get(env, a, '/members')).json; assert.equal(L.items.length, 1); assert.deepEqual([L.items[0].mid, L.items[0].name, L.items[0].church, L.items[0].mine], [bm, '박전도사', '가온교회', false]);
  assert.equal((await get(env, a, '/members?q=' + encodeURIComponent('성탄'))).json.items.length, 1, '한마디 소개에서도 검색'); assert.equal((await get(env, a, '/members?q=' + encodeURIComponent('청년부'))).json.items.length, 0, '공개하지 않은 사람은 검색되지 않는다');
  assert.equal((await get(env, a, '/members?q=' + encodeURIComponent('%'))).json.items.length, 0, '% 같은 기호는 글자로 취급'); assert.equal((await get(env, b, '/members')).json.items[0].mine, true);
  const card = (await get(env, a, '/members/' + bm)).json.card; assert.deepEqual([card.name, card.church, card.role, card.listed, card.dm_ok, card.mine], ['박전도사', '가온교회', '아동부 담당', true, true, false]);
  const hid = (await get(env, a, '/members/' + cm)).json.card; assert.deepEqual([hid.listed, hid.church, hid.role, hid.bio], [false, '', '', ''], '공개하지 않은 사람의 교회·사역·소개는 카드에도 없다'); assert.equal(hid.name, '비공개', '표시 이름은 글에 이미 쓰이는 이름');
  assert.equal((await get(env, a, '/members/99999')).status, 404);
  const ids = []; for (let i = 0; i < 25; i++) ids.push(Number(env.DB.raw.prepare("INSERT INTO members(user_id, listed, nick) SELECT id, 1, ? FROM users WHERE email='bob@church.kr' AND 0").run('x').lastInsertRowid));
  for (let i = 0; i < 24; i++) { const e = `u${i}@church.kr`; await signup(env, e); const ck = (await call(env, 'POST', '/api/login', { body: { email: e, password: PW }, ip: '8.8.8.' + i })).cookie; await send(env, ck, '/me', { listed: true, nick: '선생님' + i }, undefined, 'PUT'); }
  const p1 = (await get(env, a, '/members')).json; assert.equal(p1.items.length, 20); assert.ok(p1.next > 0); const p2 = (await get(env, a, '/members?before=' + p1.next)).json; assert.equal(p2.items.length, 5, '24명 + 박전도사 - 앞 20명'); assert.equal(p2.next, 0);
});

test('MB12.10 1:1 쪽지: 보내기·받기·읽음, 목록, 권한, 길이·횟수 제한, 지우기', async () => {
  const { env, a, b, c } = await mkUsers(); const am = await mid(env, a), bm = await mid(env, b);
  assert.equal((await send(env, b, '/dm/' + bm, { body: '나에게' })).status, 400, '나에게는 보낼 수 없다'); assert.equal((await send(env, b, '/dm/99999', { body: 'x' })).status, 404);
  assert.equal((await send(env, b, '/dm/' + am, { body: '' })).status, 400); assert.equal((await send(env, b, '/dm/' + am, { body: '가'.repeat(1001) })).status, 400);
  const t0 = Date.now(); const m1 = await send(env, b, '/dm/' + am, { body: '안녕하세요, 성탄 대본 자료 받을 수 있을까요? <b>' }, t0); assert.equal(m1.status, 201);
  assert.equal((await get(env, a, '/summary', t0 + 1)).json.dm, 1, '받는 사람에게 안 읽은 쪽지 1');
  const inbox = (await get(env, a, '/dm')).json.items; assert.equal(inbox.length, 1); assert.deepEqual([inbox[0].mid, inbox[0].name, inbox[0].unread, inbox[0].lastMine], [bm, 'bo***', 1, false]); assert.ok(inbox[0].last.startsWith('안녕하세요'));
  const th = (await get(env, a, '/dm/' + bm, t0 + 2)).json; assert.equal(th.items.length, 1); assert.deepEqual([th.items[0].mine, th.items[0].body], [false, '안녕하세요, 성탄 대본 자료 받을 수 있을까요? <b>']); assert.equal(th.with.name, 'bo***');
  assert.equal((await get(env, a, '/summary', t0 + 3)).json.dm, 0, '열어 보면 읽음 처리'); assert.equal((await get(env, a, '/dm')).json.items[0].unread, 0);
  assert.equal((await get(env, b, '/dm/' + am)).json.items[0].read, true, '보낸 사람은 읽힌 것을 본다');
  assert.equal((await send(env, a, '/dm/' + bm, { body: '네, 보내 드릴게요' }, t0 + 4)).status, 201); const th2 = (await get(env, b, '/dm/' + am)).json.items; assert.deepEqual(th2.map(x => x.mine), [true, false]);
  assert.equal(count(env, 'SELECT COUNT(*) c FROM dms'), 2); assert.deepEqual((await get(env, c, '/dm')).json.items, [], '제3자는 못 본다'); assert.equal((await get(env, c, '/dm/' + am)).json.items.length, 0, '제3자의 같은 요청은 자기 쪽지함(빈)');
  // 읽기 전 10개 제한
  const cm = await mid(env, c); for (let i = 0; i < 10; i++) assert.equal((await send(env, b, '/dm/' + cm, { body: '쪽지 ' + i }, t0 + 10 + i)).status, 201); const over = await send(env, b, '/dm/' + cm, { body: '초과' }, t0 + 30); assert.equal(over.status, 429); assert.match(over.json.error, /10개/);
  await get(env, c, '/dm/' + bm, t0 + 40); assert.equal((await send(env, b, '/dm/' + cm, { body: '읽은 뒤에는 다시 보낼 수 있다' }, t0 + 41)).status, 201);
  // 지우기: 보낸 사람만
  const id = m1.json.id; assert.equal((await send(env, a, '/dm/message/' + id, {}, undefined, 'DELETE')).status, 403, '받은 사람은 지울 수 없다'); assert.equal((await send(env, b, '/dm/message/' + id, {}, undefined, 'DELETE')).status, 200); assert.equal(count(env, 'SELECT COUNT(*) c FROM dms WHERE id=?', id), 0);
});

test('MB12.10 쪽지 차단·거부·신고: 차단하면 못 보내고 이유는 알려 주지 않는다, 쪽지 받기 끄기, 신고는 받은 쪽지만, 관리자 처리', async () => {
  const { env, a, b, c } = await mkUsers(); const am = await mid(env, a), bm = await mid(env, b), cm = await mid(env, c);
  assert.equal((await send(env, b, '/block/' + bm, { blocked: true })).status, 400, '자신은 차단할 수 없다'); assert.equal((await send(env, c, '/block/' + bm, { blocked: true })).json.blocked, true);
  const denied = await send(env, b, '/dm/' + cm, { body: '차단당함' }); assert.equal(denied.status, 403); assert.equal(denied.json.error, '이 분에게는 쪽지를 보낼 수 없어요.', '차단 사실을 알려 주지 않는 같은 문장');
  await send(env, a, '/me', { dm_ok: false }, undefined, 'PUT'); const off = await send(env, b, '/dm/' + am, { body: '받기 꺼짐' }); assert.equal(off.status, 403); assert.equal(off.json.error, denied.json.error, '받기를 끈 경우도 같은 문장');
  assert.equal((await get(env, c, '/members/' + bm)).json.card.blocked, true); const mineBlocked = await send(env, c, '/dm/' + bm, { body: '내가 차단한 사람에게' }); assert.equal(mineBlocked.status, 403); assert.match(mineBlocked.json.error, /차단을 풀고/);
  assert.equal((await send(env, c, '/block/' + bm, { blocked: false })).json.blocked, false); assert.equal((await send(env, b, '/dm/' + cm, { body: '차단 풀린 뒤' })).status, 201);
  // 신고: 받은 쪽지만
  const dmId = (await get(env, c, '/dm/' + bm)).json.items[0].id; assert.equal((await send(env, b, '/report', { kind: 'dm', id: dmId, reason: '보낸 사람은 신고 못 함' })).status, 403); assert.equal((await send(env, a, '/report', { kind: 'dm', id: dmId })).status, 403, '제3자는 신고 못 함');
  assert.equal((await send(env, c, '/report', { kind: 'dm', id: dmId, reason: '광고 쪽지' })).status, 200);
  const R = (await get(env, a, '/reports')).json.items; assert.equal(R.length, 1); assert.deepEqual([R[0].kind, R[0].id, R[0].author, R[0].reasons], ['dm', dmId, 'bo***', ['광고 쪽지']]); assert.equal(R[0].excerpt, '차단 풀린 뒤', '신고된 쪽지의 내용만 관리자에게 보인다');
  assert.equal((await get(env, b, '/reports')).status, 403); assert.equal((await send(env, c, '/dm/message/' + dmId, {}, undefined, 'DELETE')).status, 403, '받은 사람도 지울 수 없다(보낸 사람 또는 신고된 건의 관리자만)');
  assert.equal((await send(env, a, '/dm/message/' + dmId, {}, undefined, 'DELETE')).status, 200, '관리자는 신고된 쪽지를 지울 수 있다'); assert.equal((await get(env, a, '/reports')).json.items.length, 0);
  const other = (await send(env, b, '/dm/' + cm, { body: '신고 안 된 쪽지' })).json.id; assert.equal((await send(env, a, '/dm/message/' + other, {}, undefined, 'DELETE')).status, 403, '관리자도 신고되지 않은 쪽지는 지울 수 없다(비밀 보호)');
});

test('MB12.10 게시판 보완: 검색·내 글·내가 댓글 단 글, 내 글의 새 댓글 알림', async () => {
  const { env, a, b, c } = await mkUsers(); const t0 = Date.now();
  const p1 = (await post(env, b, { category: '자료 나눔', title: '대림절 가정 묵상', body: '촛불 활동지' }, t0)).json.id; const p2 = (await post(env, c, { category: '자유', title: '성탄 발표회 후기', body: '아이들이 좋아했어요 100% 만족_함' }, t0)).json.id; await post(env, a, { category: '질문·상담', title: '교사 모집', body: '새해 교사' }, t0);
  const titles = async (ck, qs) => (await get(env, ck, '/posts' + qs)).json.items.map(x => x.title).sort();
  assert.deepEqual(await titles(a, '?q=' + encodeURIComponent('대림절')), ['대림절 가정 묵상']); assert.deepEqual(await titles(a, '?q=' + encodeURIComponent('활동지')), ['대림절 가정 묵상'], '본문에서도 검색'); assert.deepEqual(await titles(a, '?q=' + encodeURIComponent('없는말')), []);
  assert.deepEqual(await titles(a, '?q=' + encodeURIComponent('100%')), ['성탄 발표회 후기'], '% 는 글자 그대로'); assert.deepEqual(await titles(a, '?q=' + encodeURIComponent('%')), ['성탄 발표회 후기'], '% 하나도 와일드카드가 아니라 글자로만 찾는다'); assert.deepEqual(await titles(a, '?q=' + encodeURIComponent('만족_함')), ['성탄 발표회 후기']); assert.deepEqual(await titles(a, '?q=' + encodeURIComponent('만족x함')), [], '_ 도 글자');
  assert.deepEqual(await titles(a, '?q=' + encodeURIComponent('성탄') + '&category=' + encodeURIComponent('자유')), ['성탄 발표회 후기']); assert.deepEqual(await titles(b, '?mine=1'), ['대림절 가정 묵상']); assert.equal((await get(env, b, '/posts?mine=9')).status, 400);
  await call(env, 'POST', `/api/community/posts/${p2}/comments`, { cookie: b, body: { body: '저도 해 볼게요' }, now: t0 + 1000 }); assert.deepEqual(await titles(b, '?mine=2'), ['성탄 발표회 후기'], '내가 댓글 단 글');
  // 내 글의 새 댓글 알림(mine)은 다른 사람 글의 댓글을 세지 않는다
  await get(env, b, '/summary', t0); await get(env, c, '/summary', t0);
  await call(env, 'POST', `/api/community/posts/${p1}/comments`, { cookie: c, body: { body: 'b님 글에 댓글' }, now: t0 + 2000 }); await call(env, 'POST', `/api/community/posts/${p2}/comments`, { cookie: a, body: { body: 'c님 글에 댓글' }, now: t0 + 3000 });
  const sb = (await get(env, b, '/summary', t0 + 4000)).json; assert.equal(sb.mine, 1, 'b의 글에는 댓글 1개'); assert.equal(sb.unread, 2, '다른 사람이 쓴 댓글 2개 전체'); const sc = (await get(env, c, '/summary', t0 + 4000)).json; assert.equal(sc.mine, 2, 'c의 글에는 b(t0+1000)와 a(t0+3000)의 댓글 2개');
});

test('MB12.10 계정 삭제 정리: 소개·쪽지·차단·쪽지 신고까지 함께 지워진다', async () => {
  const { env, a, b, c } = await mkUsers(); const am = await mid(env, a), bm = await mid(env, b), cm = await mid(env, c);
  await send(env, c, '/me', { listed: true, nick: '곧 탈퇴' }, undefined, 'PUT'); const d1 = (await send(env, b, '/dm/' + cm, { body: 'b→c' })).json.id; await send(env, c, '/dm/' + bm, { body: 'c→b' }); await send(env, a, '/dm/' + bm, { body: 'a→b' });
  await send(env, c, '/report', { kind: 'dm', id: d1, reason: '신고' }); await send(env, c, '/block/' + am, { blocked: true }); await send(env, a, '/block/' + cm, { blocked: true });
  assert.equal((await call(env, 'POST', '/api/delete-account', { cookie: c, body: { password: PW } })).status, 200);
  assert.equal(count(env, 'SELECT COUNT(*) c FROM members WHERE id=?', cm), 0); assert.equal(count(env, 'SELECT COUNT(*) c FROM dms WHERE from_m=? OR to_m=?', cm, cm), 0, 'c와 주고받은 쪽지는 모두 삭제'); assert.equal(count(env, 'SELECT COUNT(*) c FROM dms'), 1, '다른 사람 사이 쪽지는 남는다');
  assert.equal(count(env, 'SELECT COUNT(*) c FROM member_blocks'), 0); assert.equal(count(env, "SELECT COUNT(*) c FROM community_reports WHERE kind='dm'"), 0);
  assert.equal((await get(env, b, '/dm')).json.items.length, 1); assert.equal((await get(env, a, '/members/' + cm)).status, 404, '탈퇴한 사람 카드는 없다');
});
