import test from 'node:test';
import assert from 'node:assert/strict';
import { PW, call, mkUsers, signup, post, get, send, mid, count } from './_community_util.js';
import { DEFAULT_ROOMS, COMMUNITY_LIMITS } from '../functions/_lib/community.js';

const rooms = async (env, ck) => (await get(env, ck, '/rooms')).json;
const say = (env, ck, rid, body, now) => send(env, ck, `/rooms/${rid}/messages`, { body }, now);
const read = (env, ck, rid, after = 0, now) => get(env, ck, `/rooms/${rid}/messages?after=${after}`, now);

test('MB12.11 대화방: 기본 방이 만들어지고, 로그인이 필요하며, 처음 보는 방은 읽지 않은 글이 0이다', async () => {
  const { env, a, b, c } = await mkUsers();
  assert.equal((await get(env, null, '/rooms')).status, 401);
  const R = await rooms(env, b); assert.deepEqual(R.items.map(r => r.name), DEFAULT_ROOMS.map(r => r[0])); assert.ok(R.items.every(r => r.unread === 0 && r.active === 0 && r.last === null && r.closed === false)); assert.equal(R.admin, false); assert.equal((await rooms(env, a)).admin, true);
  const rid = R.items[0].id; assert.equal((await say(env, a, rid, '먼저 쓴 글', 1000)).status, 201);
  // 처음 방 목록을 여는 c는(이미 쓴 글이 있어도) 그때부터 센다. 이미 열어 본 b는 그 뒤에 쓴 글을 센다.
  assert.equal((await rooms(env, b)).items[0].unread, 1, 'b는 이미 열어 본 사람: a가 쓴 글 1개'); assert.equal((await rooms(env, c)).items[0].unread, 0, '처음 보는 방: 기존 글은 읽은 것으로'); await say(env, a, rid, '그 뒤에 쓴 글', 2000); assert.equal((await rooms(env, c)).items[0].unread, 1);
  assert.equal((await get(env, b, '/rooms/99999/messages')).status, 404);
});

test('MB12.11 대화방: 보내기 검사, 이어서 가져오기(after), 읽음, 작성자 표시, 5분 내 대화 인원', async () => {
  const { env, a, b, c } = await mkUsers(); const rid = (await rooms(env, b)).items[0].id; const t0 = Date.now();
  await rooms(env, c); // c의 읽기 기준선
  assert.equal((await say(env, b, rid, '', t0)).status, 400); assert.equal((await say(env, b, rid, '가'.repeat(501), t0)).status, 400);
  const m1 = await say(env, b, rid, '안녕하세요 <b>반갑습니다</b> https://example.com', t0 + 1000); assert.equal(m1.status, 201); await say(env, a, rid, '관리자입니다', t0 + 2000);
  const first = (await read(env, c, rid, 0, t0 + 3000)).json; assert.equal(first.items.length, 2); assert.deepEqual(first.items.map(x => x.body), ['안녕하세요 <b>반갑습니다</b> https://example.com', '관리자입니다'], '본문은 글자 그대로(화면에서 이스케이프)');
  assert.deepEqual([first.items[0].author, first.items[0].mine, first.items[0].staff, first.items[1].staff], ['bo***', false, false, true]); assert.ok(first.items[0].mid > 0); assert.equal(first.last, first.items[1].id); assert.equal(first.active, 2); assert.ok(!JSON.stringify(first).includes('@church.kr'));
  assert.equal((await rooms(env, c)).items[0].unread, 0, '읽으면 0'); await say(env, b, rid, '세 번째 글', t0 + 4000);
  const inc = (await read(env, c, rid, first.last, t0 + 5000)).json; assert.deepEqual(inc.items.map(x => x.body), ['세 번째 글'], '그 뒤 글만 가져온다'); assert.equal((await read(env, c, rid, inc.last, t0 + 6000)).json.items.length, 0, '새 글이 없으면 빈 목록');
  assert.equal((await read(env, b, rid, 0, t0 + 6000)).json.items.find(x => x.id === m1.json.id).mine, true);
  const old = (await read(env, c, rid, 0, t0 + 6 * 60e3)).json; assert.equal(old.active, 0, '5분이 지나면 대화 인원 0');
  assert.equal(count(env, 'SELECT COUNT(*) c FROM chat_messages WHERE room_id=?', rid), 3);
  // 보낸 사람 자신의 글은 읽지 않은 글로 세지 않는다
  assert.equal((await rooms(env, b)).items[0].unread, 0, 'b는 방을 읽어서 0'); await say(env, b, rid, '내가 또 씀', t0 + 7000); assert.equal((await rooms(env, b)).items[0].unread, 0, '내가 보낸 글은 읽지 않은 글로 세지 않는다'); assert.equal((await rooms(env, a)).items[0].unread, 2, 'a는 자기 글 뒤에 b가 쓴 글 2개(세 번째 글, 내가 또 씀)');
});

test('MB12.11 대화방: 1분 20개 제한, 닫힌 방, 방마다 최근 500개만 보관', async () => {
  const { env, a, b } = await mkUsers(); const rid = (await rooms(env, b)).items[0].id; const t0 = Date.now();
  for (let i = 0; i < 20; i++) assert.equal((await say(env, b, rid, '글 ' + i, t0)).status, 201); const spam = await say(env, b, rid, '초과', t0 + 1000); assert.equal(spam.status, 429); assert.match(spam.json.error, /1분에 20개/);
  assert.equal((await say(env, b, rid, '1분 뒤', t0 + 61e3)).status, 201, '1분 뒤에는 다시'); assert.equal((await say(env, a, rid, '다른 사람은 가능', t0 + 1000)).status, 201);
  // 닫힌 방: 읽기는 되고 보내기는 안 된다
  assert.equal((await send(env, a, '/rooms/' + rid, { name: '전체 이야기', topic: '쉬는 중', closed: true }, undefined, 'PUT')).status, 200); const closed = await say(env, b, rid, '닫힌 방', t0 + 70e3); assert.equal(closed.status, 403); assert.equal((await read(env, b, rid, 0, t0 + 70e3)).json.room.closed, true);
  await send(env, a, '/rooms/' + rid, { name: '전체 이야기', topic: '다시 열었어요', closed: false }, undefined, 'PUT');
  // 최근 500개만: SQL로 520개를 넣고 한 개 더 보내면 정리된다
  const bm = await mid(env, b); const ins = env.DB.raw.prepare('INSERT INTO chat_messages(room_id, member_id, body, created_at) VALUES(?,?,?,?)'); env.DB.raw.exec('BEGIN'); for (let i = 0; i < 520; i++) ins.run(rid, bm, '오래된 ' + i, t0 + i); env.DB.raw.exec('COMMIT');
  assert.ok(count(env, 'SELECT COUNT(*) c FROM chat_messages WHERE room_id=?', rid) > 520); assert.equal((await say(env, a, rid, '정리 유발', t0 + 200e3)).status, 201);
  assert.equal(count(env, 'SELECT COUNT(*) c FROM chat_messages WHERE room_id=?', rid), COMMUNITY_LIMITS.keep, `${COMMUNITY_LIMITS.keep}개만 남는다`); assert.equal(count(env, "SELECT COUNT(*) c FROM chat_messages WHERE body='정리 유발'"), 1, '가장 최근 글은 남는다'); assert.equal(count(env, "SELECT COUNT(*) c FROM chat_messages WHERE body='오래된 0'"), 0, '가장 오래된 글은 사라진다');
});

test('MB12.11 대화방: 지우기·숨기기·신고(관리자 처리)', async () => {
  const { env, a, b, c } = await mkUsers(); const rid = (await rooms(env, b)).items[0].id; const t0 = Date.now();
  const mb = (await say(env, b, rid, 'b의 글', t0)).json.id; const mc = (await say(env, c, rid, 'c의 글', t0 + 1)).json.id;
  assert.equal((await send(env, c, `/chat/messages/${mb}`, {}, undefined, 'DELETE')).status, 403, '남의 글은 못 지운다'); assert.equal((await send(env, b, `/chat/messages/${mb}`, {}, undefined, 'DELETE')).status, 200, '내 글은 지운다');
  // 신고: 내 글 불가, 중복 1건, 관리자 목록
  assert.equal((await send(env, c, '/report', { kind: 'chat', id: mc })).status, 400); assert.equal((await send(env, b, '/report', { kind: 'chat', id: 99999 })).status, 404); assert.equal((await send(env, b, '/report', { kind: 'chat', id: mc, reason: '광고' })).status, 200); await send(env, b, '/report', { kind: 'chat', id: mc, reason: '또' });
  const R = (await get(env, a, '/reports')).json.items; assert.equal(R.length, 1); assert.deepEqual([R[0].kind, R[0].id, R[0].title, R[0].excerpt, R[0].count, R[0].reasons], ['chat', mc, '전체 이야기', 'c의 글', 1, ['광고']]); assert.equal(R[0].postId, rid, '방 번호로 이동할 수 있다');
  // 숨기기: 관리자만. 일반 사용자에게는 자리표시, 작성자·관리자는 본문
  assert.equal((await send(env, b, `/chat/messages/${mc}/hide`, { hidden: true })).status, 403); assert.equal((await send(env, a, `/chat/messages/${mc}/hide`, { hidden: true })).json.hidden, true);
  const seenB = (await read(env, b, rid, 0)).json.items.find(x => x.id === mc); assert.deepEqual([seenB.hidden, seenB.body, seenB.author], [true, '', '']); assert.equal((await read(env, c, rid, 0)).json.items.find(x => x.id === mc).body, 'c의 글', '작성자는 자기 글을 본다'); assert.equal((await read(env, a, rid, 0)).json.items.find(x => x.id === mc).body, 'c의 글', '관리자는 본문을 본다');
  assert.equal((await rooms(env, b)).items[0].last, null, '숨긴 글은 방 목록의 마지막 글에서 빠진다');
  assert.equal((await send(env, a, '/reports/clear', { kind: 'chat', id: mc })).status, 200); assert.equal((await get(env, a, '/reports')).json.items.length, 0);
  assert.equal((await send(env, a, `/chat/messages/${mc}`, {}, undefined, 'DELETE')).status, 200, '관리자는 지울 수 있다'); assert.equal(count(env, 'SELECT COUNT(*) c FROM chat_messages WHERE id=?', mc), 0);
});

test('MB12.11 대화방 관리(관리자만): 만들기·고치기·지우기, 개수·길이 제한, 알림 배지(chat)', async () => {
  const { env, a, b } = await mkUsers(); const t0 = Date.now(); const base = (await rooms(env, b)).items;
  assert.equal((await send(env, b, '/rooms', { name: '새 방', topic: '' })).status, 403, '일반 사용자는 방을 만들 수 없다'); assert.equal((await send(env, a, '/rooms', { name: '가', topic: '' })).status, 400); assert.equal((await send(env, a, '/rooms', { name: '가'.repeat(21), topic: '' })).status, 400); assert.equal((await send(env, a, '/rooms', { name: '새 방', topic: '가'.repeat(61) })).status, 400);
  const made = await send(env, a, '/rooms', { name: '  성탄  발표회  ', topic: '대본 이야기' }); assert.equal(made.status, 201); const R = (await rooms(env, b)).items; assert.equal(R.length, base.length + 1); assert.equal(R[R.length - 1].name, '성탄 발표회', '새 방은 맨 뒤, 이름의 공백은 정리');
  assert.equal((await send(env, b, '/rooms/' + made.json.id, { name: '바꿈', topic: '' }, undefined, 'PUT')).status, 403); assert.equal((await send(env, b, '/rooms/' + made.json.id, {}, undefined, 'DELETE')).status, 403);
  // 방 개수 상한(20개)
  while ((await rooms(env, a)).items.length < COMMUNITY_LIMITS.rooms) assert.equal((await send(env, a, '/rooms', { name: '방 ' + Math.random().toString(36).slice(2, 6), topic: '' })).status, 201); assert.equal((await send(env, a, '/rooms', { name: '초과 방', topic: '' })).status, 400);
  // 알림 배지: 다른 사람의 새 대화방 글만 센다
  const rid = base[0].id; await get(env, b, '/summary', t0); assert.equal((await get(env, b, '/summary', t0 + 1)).json.chat, 0); await say(env, a, rid, '새 글 1', t0 + 2000); await say(env, a, made.json.id, '새 글 2', t0 + 3000); await say(env, b, rid, '내 글', t0 + 4000);
  assert.equal((await get(env, b, '/summary', t0 + 5000)).json.chat, 1, '글을 보내면 그 방은 읽은 것으로 보고, 다른 방의 새 글 1개만 센다'); await say(env, a, rid, '새 글 3', t0 + 5500); assert.equal((await get(env, b, '/summary', t0 + 5600)).json.chat, 2); await read(env, b, rid, 0, t0 + 6000); assert.equal((await get(env, b, '/summary', t0 + 7000)).json.chat, 1, '한 방을 읽으면 그 방은 빠진다');
  // 방을 지우면 글·읽음·그 글의 신고까지 함께
  await send(env, b, '/report', { kind: 'chat', id: (await say(env, a, made.json.id, '신고될 글', t0 + 8000)).json.id }); assert.equal((await send(env, a, '/rooms/' + made.json.id, {}, undefined, 'DELETE')).status, 200);
  assert.equal(count(env, 'SELECT COUNT(*) c FROM chat_messages WHERE room_id=?', made.json.id), 0); assert.equal(count(env, 'SELECT COUNT(*) c FROM chat_reads WHERE room_id=?', made.json.id), 0); assert.equal(count(env, "SELECT COUNT(*) c FROM community_reports WHERE kind='chat'"), 0); assert.equal((await get(env, b, `/rooms/${made.json.id}/messages`)).status, 404);
});

test('MB12.11 계정 삭제 정리: 대화방 글·읽음·신고가 함께 지워진다', async () => {
  const { env, a, b, c } = await mkUsers(); const rid = (await rooms(env, b)).items[0].id; const t0 = Date.now(); await rooms(env, c);
  const mc = (await say(env, c, rid, 'c의 글', t0)).json.id; await say(env, b, rid, 'b의 글', t0 + 1); await send(env, b, '/report', { kind: 'chat', id: mc }); await read(env, c, rid, 0, t0 + 2);
  assert.equal((await call(env, 'POST', '/api/delete-account', { cookie: c, body: { password: PW } })).status, 200);
  assert.equal(count(env, "SELECT COUNT(*) c FROM chat_messages WHERE body='c의 글'"), 0); assert.equal(count(env, "SELECT COUNT(*) c FROM chat_messages WHERE body='b의 글'"), 1, '다른 사람 글은 남는다'); assert.equal(count(env, "SELECT COUNT(*) c FROM community_reports WHERE kind='chat'"), 0);
  assert.equal(count(env, 'SELECT COUNT(*) c FROM chat_reads cr JOIN members m ON m.id = cr.member_id JOIN users u ON u.id = m.user_id WHERE u.email = ?', 'carol@church.kr'), 0); assert.equal((await read(env, b, rid)).status, 200, '삭제 뒤에도 방은 정상');
});
