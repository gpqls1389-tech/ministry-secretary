// 커뮤니티(MB12.9~): 로그인한 계정끼리 글·댓글·좋아요를 나누고(게시판), 소개(프로필)를 공개해 서로 찾고, 1:1 쪽지를 주고받는다.
// 표는 처음 쓸 때 자동으로 만든다(관리자가 따로 SQL을 실행할 필요 없음). 이 기능만 계정 사이에 공유되는 데이터다.
// 모든 요청은 로그인 뒤에만 오고, 상대에게는 이름(표시 이름 → 계정 이름 → 이메일 앞 두 글자+***)만 보여 이메일 전체는 새지 않는다.
// 사람은 이메일·계정 번호 대신 작은 정수 번호(members.id)로만 가리킨다.
export const COMMUNITY_CATS = ['공지', '자료 나눔', '질문·상담', '나눔·소식', '기도 제목', '자유'];
const ADMIN_ONLY = new Set(['공지']);
export const COMMUNITY_LIMITS = { title: 60, post: 4000, comment: 1000, report: 200, page: 20, dm: 1000, nick: 20, church: 30, role: 30, bio: 200, query: 30 };
// 이름, [횟수, 기간(ms), 안내 문장]
const RATE = {
  post: ['cp', 10, 3600e3, '글은 한 시간에 10개까지 올릴 수 있어요. 잠시 뒤에 다시 해 주세요.'], comment: ['cc', 40, 3600e3, '댓글은 한 시간에 40개까지 달 수 있어요. 잠시 뒤에 다시 해 주세요.'],
  report: ['cr', 20, 24 * 3600e3, '신고는 하루에 20건까지 할 수 있어요.'], dm: ['cd', 30, 3600e3, '쪽지는 한 시간에 30개까지 보낼 수 있어요. 잠시 뒤에 다시 해 주세요.'],
};
const clean = s => String(s ?? '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '').trim();
const one = s => clean(s).replace(/\s+/g, ' '); // 한 줄 글(이름·교회 등)
const likeOf = q => `%${q.replace(/[\\%_]/g, m => '\\' + m)}%`;

const ready = new WeakSet();
async function ensure(db) {
  if (ready.has(db)) return;
  const q = sql => db.prepare(sql).bind().run();
  await q('CREATE TABLE IF NOT EXISTS posts (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, category TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, pinned INTEGER NOT NULL DEFAULT 0, hidden INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)');
  await q('CREATE INDEX IF NOT EXISTS idx_posts_list ON posts(pinned, id)');
  await q('CREATE INDEX IF NOT EXISTS idx_posts_user ON posts(user_id)');
  await q('CREATE TABLE IF NOT EXISTS comments (id INTEGER PRIMARY KEY AUTOINCREMENT, post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, body TEXT NOT NULL, hidden INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL)');
  await q('CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id, id)');
  await q('CREATE INDEX IF NOT EXISTS idx_comments_user ON comments(user_id)');
  await q('CREATE TABLE IF NOT EXISTS post_likes (post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, PRIMARY KEY (post_id, user_id))');
  await q('CREATE TABLE IF NOT EXISTS community_reports (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, target_id INTEGER NOT NULL, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, reason TEXT NOT NULL DEFAULT \'\', created_at INTEGER NOT NULL, UNIQUE (kind, target_id, user_id))');
  await q('CREATE TABLE IF NOT EXISTS community_seen (user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, seen_at INTEGER NOT NULL)');
  // MB12.10: 소개(프로필)·쪽지·차단. 사람은 members.id(작은 정수)로 가리킨다.
  await q('CREATE TABLE IF NOT EXISTS members (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE, listed INTEGER NOT NULL DEFAULT 0, dm_ok INTEGER NOT NULL DEFAULT 1, nick TEXT NOT NULL DEFAULT \'\', church TEXT NOT NULL DEFAULT \'\', role TEXT NOT NULL DEFAULT \'\', bio TEXT NOT NULL DEFAULT \'\', updated_at INTEGER NOT NULL DEFAULT 0)');
  await q('CREATE TABLE IF NOT EXISTS dms (id INTEGER PRIMARY KEY AUTOINCREMENT, from_m INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE, to_m INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE, body TEXT NOT NULL, created_at INTEGER NOT NULL, read_at INTEGER)');
  await q('CREATE INDEX IF NOT EXISTS idx_dms_to ON dms(to_m, read_at)'); await q('CREATE INDEX IF NOT EXISTS idx_dms_pair ON dms(from_m, to_m, id)');
  await q('CREATE TABLE IF NOT EXISTS member_blocks (blocker INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE, blocked INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE, PRIMARY KEY (blocker, blocked))');
  await q('INSERT OR IGNORE INTO members(user_id) SELECT user_id FROM posts UNION SELECT user_id FROM comments'); // MB12.9에서 글·댓글을 쓴 사람에게도 번호를 준다
  ready.add(db);
}

const adminEmails = env => String((env && env.ADMIN_EMAILS) || '').toLowerCase().split(/[,\s]+/).filter(Boolean);
// 관리자: 환경변수 ADMIN_EMAILS(쉼표로 구분)가 있으면 그 계정들, 없으면 가장 먼저 가입한 계정
export async function isCommunityAdmin(db, env, user) {
  const list = adminEmails(env); if (list.length) return list.includes(String(user.email).toLowerCase());
  const first = await db.prepare('SELECT id FROM users ORDER BY created_at ASC, id ASC LIMIT 1').bind().first();
  return !!first && first.id === user.id;
}
// 계정을 삭제할 때 그 사람의 글·댓글·좋아요·신고·쪽지·소개·차단을 지운다(그 사람 글에 달린 다른 사람의 댓글, 주고받은 쪽지도 함께 지워진다)
export async function communityPurge(db, userId) {
  await ensure(db);
  for (const sql of ['DELETE FROM post_likes WHERE user_id=?', 'DELETE FROM community_reports WHERE user_id=?', 'DELETE FROM comments WHERE user_id=?', 'DELETE FROM comments WHERE post_id IN (SELECT id FROM posts WHERE user_id=?)', 'DELETE FROM post_likes WHERE post_id IN (SELECT id FROM posts WHERE user_id=?)', 'DELETE FROM posts WHERE user_id=?', 'DELETE FROM community_seen WHERE user_id=?',
    "DELETE FROM community_reports WHERE kind='dm' AND target_id IN (SELECT id FROM dms WHERE from_m IN (SELECT id FROM members WHERE user_id=?) OR to_m IN (SELECT id FROM members WHERE user_id=?))",
    'DELETE FROM dms WHERE from_m IN (SELECT id FROM members WHERE user_id=?) OR to_m IN (SELECT id FROM members WHERE user_id=?)', 'DELETE FROM member_blocks WHERE blocker IN (SELECT id FROM members WHERE user_id=?) OR blocked IN (SELECT id FROM members WHERE user_id=?)', 'DELETE FROM members WHERE user_id=?']) {
    const n = (sql.match(/\?/g) || []).length; await db.prepare(sql).bind(...Array(n).fill(userId)).run();
  }
}

// 표시 이름: 내가 정한 표시 이름 → 계정 이름 → 이메일 앞 두 글자+***
const authorOf = r => ((r.nick || '').trim() || (r.name || '').trim() || `${String(r.email || '').split('@')[0].slice(0, 2)}***`);
const sel = full => `SELECT p.id, p.category, p.title, ${full ? 'p.body AS body' : 'SUBSTR(p.body, 1, 140) AS preview'}, p.pinned, p.hidden, p.created_at, p.updated_at, p.user_id, u.name, u.email, m.id AS mid, m.nick,
  (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id AND c.hidden = 0) AS ncom, (SELECT COUNT(*) FROM post_likes l WHERE l.post_id = p.id) AS nlike,
  EXISTS(SELECT 1 FROM post_likes l WHERE l.post_id = p.id AND l.user_id = ?) AS liked FROM posts p JOIN users u ON u.id = p.user_id LEFT JOIN members m ON m.user_id = p.user_id`;

export async function handleCommunity({ db, env, user, request, path, method, now, body, json, HttpError, limited, fail }) {
  if (!path.startsWith('/api/community')) return null;
  await ensure(db);
  const admin = await isCommunityAdmin(db, env, user); const rest = path.slice('/api/community'.length) || '/'; let m;
  const num = s => Number(s);
  const need = (cond, msg, status = 400) => { if (!cond) throw new HttpError(status, msg); };
  const throttle = async name => { const [pre, max, win, msg] = RATE[name]; const key = `${pre}:${user.id}`; if (await limited(db, key, max, now)) throw new HttpError(429, msg); return () => fail(db, key, now, win); };
  // 내 번호(처음이면 만든다)
  let me = await db.prepare('SELECT id, listed, dm_ok, nick, church, role, bio FROM members WHERE user_id=?').bind(user.id).first();
  if (!me) { await db.prepare('INSERT OR IGNORE INTO members(user_id) VALUES(?)').bind(user.id).run(); me = await db.prepare('SELECT id, listed, dm_ok, nick, church, role, bio FROM members WHERE user_id=?').bind(user.id).first(); }
  // 운영진 표시(사칭 방지): 관리자 계정의 글·댓글에는 관리자 표시를 붙인다
  let staffIds = null; const staffOf = async () => { if (staffIds) return staffIds; const list = adminEmails(env); const rows = list.length ? (await db.prepare(`SELECT id FROM users WHERE LOWER(email) IN (${list.map(() => '?').join(',')})`).bind(...list).all()).results : [await db.prepare('SELECT id FROM users ORDER BY created_at ASC, id ASC LIMIT 1').bind().first()].filter(Boolean); return (staffIds = new Set(rows.map(r => r.id))); };
  const person = async r => ({ author: authorOf(r), mid: r.mid || 0, mine: r.user_id === user.id, staff: (await staffOf()).has(r.user_id) });
  const postOut = async r => ({ id: r.id, category: r.category, title: r.title, ...(r.body !== undefined ? { body: r.body } : { preview: r.preview }), pinned: !!r.pinned, hidden: !!r.hidden, ...(await person(r)), at: r.created_at, edited: r.updated_at > r.created_at, comments: r.ncom, likes: r.nlike, liked: !!r.liked, ...(admin ? { admin: true } : {}) });
  const loadPost = async id => {
    const r = await db.prepare(`${sel(true)} WHERE p.id = ?`).bind(user.id, id).first();
    if (!r || (r.hidden && !admin && r.user_id !== user.id)) throw new HttpError(404, '글을 찾을 수 없어요. 지워졌거나 숨겨졌을 수 있어요.'); return r;
  };
  const checkText = (title, text, cat) => {
    need(COMMUNITY_CATS.includes(cat), '분류를 골라 주세요.'); need(!ADMIN_ONLY.has(cat) || admin, '공지는 관리자만 올릴 수 있어요.', 403);
    need(title.length >= 2 && title.length <= COMMUNITY_LIMITS.title, `제목은 2~${COMMUNITY_LIMITS.title}자로 적어 주세요.`); need(text.length >= 2 && text.length <= COMMUNITY_LIMITS.post, `내용은 2~${COMMUNITY_LIMITS.post}자로 적어 주세요.`);
  };

  // ---- 알림 배지: 내가 마지막으로 본 뒤 다른 사람이 올린 글·댓글(unread), 그중 내 글에 달린 댓글(mine), 안 읽은 쪽지(dm) ----
  if (rest === '/summary' && method === 'GET') {
    const seen = await db.prepare('SELECT seen_at FROM community_seen WHERE user_id=?').bind(user.id).first();
    const reports = admin ? (await db.prepare('SELECT COUNT(*) c FROM (SELECT 1 FROM community_reports GROUP BY kind, target_id)').bind().first()).c : 0;
    const dm = (await db.prepare('SELECT COUNT(*) c FROM dms WHERE to_m=? AND read_at IS NULL').bind(me.id).first()).c;
    if (!seen) { await db.prepare('INSERT OR IGNORE INTO community_seen(user_id, seen_at) VALUES(?,?)').bind(user.id, now).run(); return json({ ok: true, unread: 0, mine: 0, dm, admin, reports }); }
    const c = await db.prepare('SELECT (SELECT COUNT(*) FROM posts WHERE created_at > ? AND user_id <> ? AND hidden = 0) + (SELECT COUNT(*) FROM comments WHERE created_at > ? AND user_id <> ? AND hidden = 0) AS n, (SELECT COUNT(*) FROM comments c JOIN posts p ON p.id = c.post_id WHERE c.created_at > ? AND c.user_id <> ? AND c.hidden = 0 AND p.user_id = ?) AS mine').bind(seen.seen_at, user.id, seen.seen_at, user.id, seen.seen_at, user.id, user.id).first();
    return json({ ok: true, unread: c.n, mine: c.mine, dm, admin, reports });
  }
  if (rest === '/seen' && method === 'POST') { await db.prepare('INSERT INTO community_seen(user_id, seen_at) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET seen_at = excluded.seen_at').bind(user.id, now).run(); return json({ ok: true }); }

  // ---- 글 목록(고정 글은 첫 쪽에만) · 검색 · 내 글 · 글쓰기 ----
  if (rest === '/posts' && method === 'GET') {
    const sp = new URL(request.url).searchParams; const cat = sp.get('category') || ''; need(!cat || COMMUNITY_CATS.includes(cat), '분류가 올바르지 않아요.'); const before = Math.max(0, Math.trunc(num(sp.get('before')) || 0));
    const q = one(sp.get('q') || '').slice(0, COMMUNITY_LIMITS.query); const mine = sp.get('mine') || ''; need(['', '1', '2'].includes(mine), '보기 방식이 올바르지 않아요.');
    const wh = ['(p.hidden = 0 OR ? = 1 OR p.user_id = ?)']; const pr = [admin ? 1 : 0, user.id];
    if (cat) { wh.push('p.category = ?'); pr.push(cat); }
    if (q) { wh.push("(p.title LIKE ? ESCAPE '\\' OR p.body LIKE ? ESCAPE '\\')"); pr.push(likeOf(q), likeOf(q)); }
    if (mine === '1') { wh.push('p.user_id = ?'); pr.push(user.id); }
    if (mine === '2') { wh.push('EXISTS (SELECT 1 FROM comments c WHERE c.post_id = p.id AND c.user_id = ?)'); pr.push(user.id); }
    const where = wh.join(' AND '); const lim = COMMUNITY_LIMITS.page;
    const pinned = before ? [] : (await db.prepare(`${sel(false)} WHERE ${where} AND p.pinned = 1 ORDER BY p.id DESC LIMIT 5`).bind(user.id, ...pr).all()).results;
    const rows = (await db.prepare(`${sel(false)} WHERE ${where} AND p.pinned = 0 AND (? = 0 OR p.id < ?) ORDER BY p.id DESC LIMIT ?`).bind(user.id, ...pr, before, before, lim + 1).all()).results;
    const more = rows.length > lim; const items = rows.slice(0, lim);
    return json({ ok: true, admin, cats: COMMUNITY_CATS, items: await Promise.all([...pinned, ...items].map(postOut)), next: more ? items[items.length - 1].id : 0 });
  }
  if (rest === '/posts' && method === 'POST') {
    const b = await body(request, 12000); const cat = String(b.category || ''); const title = clean(b.title), text = clean(b.body); checkText(title, text, cat);
    const count = await throttle('post');
    const r = await db.prepare('INSERT INTO posts(user_id, category, title, body, created_at, updated_at) VALUES(?,?,?,?,?,?) RETURNING id').bind(user.id, cat, title, text, now, now).first(); await count();
    return json({ ok: true, id: r.id }, 201);
  }

  // ---- 글 한 건: 보기 · 고치기 · 지우기 ----
  if ((m = /^\/posts\/(\d{1,12})$/.exec(rest))) {
    const id = num(m[1]);
    if (method === 'GET') {
      const p = await loadPost(id);
      const cs = (await db.prepare('SELECT c.id, c.body, c.hidden, c.created_at, c.user_id, u.name, u.email, m.id AS mid, m.nick FROM comments c JOIN users u ON u.id = c.user_id LEFT JOIN members m ON m.user_id = c.user_id WHERE c.post_id = ? ORDER BY c.id ASC LIMIT 300').bind(id).all()).results;
      return json({ ok: true, post: await postOut(p), comments: await Promise.all(cs.map(async c => (c.hidden && !admin && c.user_id !== user.id) ? { id: c.id, hidden: true, body: '', author: '', mid: 0, mine: false, staff: false, at: c.created_at } : { id: c.id, hidden: !!c.hidden, body: c.body, ...(await person(c)), at: c.created_at })) });
    }
    if (method === 'PUT') {
      const p = await loadPost(id); need(p.user_id === user.id, '내가 쓴 글만 고칠 수 있어요.', 403);
      const b = await body(request, 12000); const cat = String(b.category || p.category); const title = clean(b.title), text = clean(b.body); checkText(title, text, cat);
      await db.prepare('UPDATE posts SET category=?, title=?, body=?, updated_at=? WHERE id=?').bind(cat, title, text, now, id).run(); return json({ ok: true });
    }
    if (method === 'DELETE') {
      const p = await loadPost(id); need(p.user_id === user.id || admin, '내가 쓴 글만 지울 수 있어요.', 403);
      for (const sql of ['DELETE FROM comments WHERE post_id=?', 'DELETE FROM post_likes WHERE post_id=?', 'DELETE FROM posts WHERE id=?']) await db.prepare(sql).bind(id).run();
      await db.prepare("DELETE FROM community_reports WHERE kind='post' AND target_id=?").bind(id).run(); return json({ ok: true });
    }
  }
  if ((m = /^\/posts\/(\d{1,12})\/(comments|like|pin|hide)$/.exec(rest)) && method === 'POST') {
    const id = num(m[1]); const p = await loadPost(id);
    if (m[2] === 'comments') {
      const b = await body(request, 4000); const text = clean(b.body); need(text.length >= 1 && text.length <= COMMUNITY_LIMITS.comment, `댓글은 1~${COMMUNITY_LIMITS.comment}자로 적어 주세요.`); need(!p.hidden || admin, '숨겨진 글에는 댓글을 달 수 없어요.', 403);
      const count = await throttle('comment'); const r = await db.prepare('INSERT INTO comments(post_id, user_id, body, created_at) VALUES(?,?,?,?) RETURNING id').bind(id, user.id, text, now).first(); await count(); return json({ ok: true, id: r.id }, 201);
    }
    if (m[2] === 'like') {
      const had = await db.prepare('SELECT 1 x FROM post_likes WHERE post_id=? AND user_id=?').bind(id, user.id).first();
      if (had) await db.prepare('DELETE FROM post_likes WHERE post_id=? AND user_id=?').bind(id, user.id).run(); else await db.prepare('INSERT OR IGNORE INTO post_likes(post_id, user_id) VALUES(?,?)').bind(id, user.id).run();
      const n = await db.prepare('SELECT COUNT(*) c FROM post_likes WHERE post_id=?').bind(id).first(); return json({ ok: true, liked: !had, likes: n.c });
    }
    need(admin, '관리자만 할 수 있어요.', 403); const b = await body(request);
    if (m[2] === 'pin') { await db.prepare('UPDATE posts SET pinned=? WHERE id=?').bind(b.pinned ? 1 : 0, id).run(); return json({ ok: true, pinned: !!b.pinned }); }
    await db.prepare('UPDATE posts SET hidden=? WHERE id=?').bind(b.hidden ? 1 : 0, id).run(); return json({ ok: true, hidden: !!b.hidden });
  }

  // ---- 댓글: 지우기 · 숨기기 ----
  if ((m = /^\/comments\/(\d{1,12})(\/hide)?$/.exec(rest))) {
    const id = num(m[1]); const c = await db.prepare('SELECT id, post_id, user_id FROM comments WHERE id=?').bind(id).first(); need(c, '댓글을 찾을 수 없어요.', 404);
    if (!m[2] && method === 'DELETE') { need(c.user_id === user.id || admin, '내가 쓴 댓글만 지울 수 있어요.', 403); await db.prepare('DELETE FROM comments WHERE id=?').bind(id).run(); await db.prepare("DELETE FROM community_reports WHERE kind='comment' AND target_id=?").bind(id).run(); return json({ ok: true }); }
    if (m[2] && method === 'POST') { need(admin, '관리자만 할 수 있어요.', 403); const b = await body(request); await db.prepare('UPDATE comments SET hidden=? WHERE id=?').bind(b.hidden ? 1 : 0, id).run(); return json({ ok: true, hidden: !!b.hidden }); }
  }

  // ---- 소개(프로필) ----
  if (rest === '/me' && method === 'GET') return json({ ok: true, mid: me.id, listed: !!me.listed, dm_ok: !!me.dm_ok, nick: me.nick, church: me.church, role: me.role, bio: me.bio, admin });
  if (rest === '/me' && method === 'PUT') {
    const b = await body(request); const L = COMMUNITY_LIMITS; const nick = one(b.nick), church = one(b.church), role = one(b.role), bio = clean(b.bio).replace(/\n{3,}/g, '\n\n');
    need(nick.length <= L.nick, `표시 이름은 ${L.nick}자까지예요.`); need(church.length <= L.church, `교회·기관은 ${L.church}자까지예요.`); need(role.length <= L.role, `맡은 사역은 ${L.role}자까지예요.`); need(bio.length <= L.bio, `한마디 소개는 ${L.bio}자까지예요.`);
    const listed = b.listed ? 1 : 0; need(!listed || nick.length >= 2, '소개를 공개하려면 표시 이름을 2자 이상 적어 주세요.');
    await db.prepare('UPDATE members SET listed=?, dm_ok=?, nick=?, church=?, role=?, bio=?, updated_at=? WHERE id=?').bind(listed, b.dm_ok === false || b.dm_ok === 0 ? 0 : 1, nick, church, role, bio, now, me.id).run(); return json({ ok: true });
  }
  // 사람 찾기(소개를 공개한 사람만) · 한 사람 카드(공개하지 않은 사람은 이름만)
  if (rest === '/members' && method === 'GET') {
    const sp = new URL(request.url).searchParams; const q = one(sp.get('q') || '').slice(0, COMMUNITY_LIMITS.query); const before = Math.max(0, Math.trunc(num(sp.get('before')) || 0)); const lim = COMMUNITY_LIMITS.page;
    const rows = (await db.prepare(`SELECT m.id, m.user_id, m.nick, m.church, m.role, m.bio, m.dm_ok FROM members m WHERE m.listed = 1 AND m.nick <> '' AND (? = '' OR m.nick LIKE ? ESCAPE '\\' OR m.church LIKE ? ESCAPE '\\' OR m.role LIKE ? ESCAPE '\\' OR m.bio LIKE ? ESCAPE '\\') AND (? = 0 OR m.id < ?) ORDER BY m.id DESC LIMIT ?`).bind(q, likeOf(q), likeOf(q), likeOf(q), likeOf(q), before, before, lim + 1).all()).results;
    const items = rows.slice(0, lim); const st = await staffOf();
    return json({ ok: true, items: items.map(r => ({ mid: r.id, name: r.nick, church: r.church, role: r.role, bio: r.bio, dm_ok: !!r.dm_ok, mine: r.user_id === user.id, staff: st.has(r.user_id) })), next: rows.length > lim ? items[items.length - 1].id : 0 });
  }
  const memberRow = async mid => { const r = await db.prepare('SELECT m.id, m.user_id, m.listed, m.dm_ok, m.nick, m.church, m.role, m.bio, u.name, u.email FROM members m JOIN users u ON u.id = m.user_id WHERE m.id = ?').bind(mid).first(); need(r, '사람을 찾을 수 없어요.', 404); return r; };
  if ((m = /^\/members\/(\d{1,12})$/.exec(rest)) && method === 'GET') {
    const r = await memberRow(num(m[1])); const iBlock = await db.prepare('SELECT 1 x FROM member_blocks WHERE blocker=? AND blocked=?').bind(me.id, r.id).first();
    return json({ ok: true, card: { mid: r.id, name: authorOf(r), listed: !!r.listed, church: r.listed ? r.church : '', role: r.listed ? r.role : '', bio: r.listed ? r.bio : '', dm_ok: !!r.dm_ok, mine: r.user_id === user.id, staff: (await staffOf()).has(r.user_id), blocked: !!iBlock } });
  }
  if ((m = /^\/block\/(\d{1,12})$/.exec(rest)) && method === 'POST') {
    const r = await memberRow(num(m[1])); need(r.id !== me.id, '나 자신은 차단할 수 없어요.'); const b = await body(request);
    if (b.blocked) await db.prepare('INSERT OR IGNORE INTO member_blocks(blocker, blocked) VALUES(?,?)').bind(me.id, r.id).run(); else await db.prepare('DELETE FROM member_blocks WHERE blocker=? AND blocked=?').bind(me.id, r.id).run();
    return json({ ok: true, blocked: !!b.blocked });
  }

  // ---- 1:1 쪽지 ----
  if (rest === '/dm' && method === 'GET') {
    const convs = (await db.prepare('SELECT other, MAX(id) AS last_id, SUM(CASE WHEN to_m = ? AND read_at IS NULL THEN 1 ELSE 0 END) AS unread FROM (SELECT id, to_m, read_at, CASE WHEN from_m = ? THEN to_m ELSE from_m END AS other FROM dms WHERE from_m = ? OR to_m = ?) GROUP BY other ORDER BY last_id DESC LIMIT 50').bind(me.id, me.id, me.id, me.id).all()).results;
    if (!convs.length) return json({ ok: true, items: [] });
    const ph = ids => ids.map(() => '?').join(',');
    const lasts = (await db.prepare(`SELECT id, from_m, SUBSTR(body, 1, 80) AS excerpt, created_at FROM dms WHERE id IN (${ph(convs)})`).bind(...convs.map(c => c.last_id)).all()).results; const lastBy = new Map(lasts.map(l => [l.id, l]));
    const people = (await db.prepare(`SELECT m.id, m.nick, u.name, u.email FROM members m JOIN users u ON u.id = m.user_id WHERE m.id IN (${ph(convs)})`).bind(...convs.map(c => c.other)).all()).results; const pBy = new Map(people.map(p => [p.id, p]));
    const blocks = (await db.prepare(`SELECT blocked FROM member_blocks WHERE blocker = ? AND blocked IN (${ph(convs)})`).bind(me.id, ...convs.map(c => c.other)).all()).results; const blocked = new Set(blocks.map(b => b.blocked));
    return json({ ok: true, items: convs.map(c => { const l = lastBy.get(c.last_id) || {}; const p = pBy.get(c.other) || {}; return { mid: c.other, name: authorOf(p), last: l.excerpt || '', lastMine: l.from_m === me.id, at: l.created_at || 0, unread: c.unread || 0, blocked: blocked.has(c.other) }; }) });
  }
  if ((m = /^\/dm\/(\d{1,12})$/.exec(rest))) {
    const other = await memberRow(num(m[1])); need(other.id !== me.id, '나에게는 쪽지를 보낼 수 없어요.');
    if (method === 'GET') {
      const before = Math.max(0, Math.trunc(num(new URL(request.url).searchParams.get('before')) || 0));
      const rows = (await db.prepare('SELECT id, from_m, body, created_at, read_at FROM dms WHERE ((from_m = ? AND to_m = ?) OR (from_m = ? AND to_m = ?)) AND (? = 0 OR id < ?) ORDER BY id DESC LIMIT 51').bind(me.id, other.id, other.id, me.id, before, before).all()).results;
      const more = rows.length > 50; const list = rows.slice(0, 50).reverse();
      if (!before) await db.prepare('UPDATE dms SET read_at = ? WHERE to_m = ? AND from_m = ? AND read_at IS NULL').bind(now, me.id, other.id).run();
      const iBlock = await db.prepare('SELECT 1 x FROM member_blocks WHERE blocker=? AND blocked=?').bind(me.id, other.id).first();
      return json({ ok: true, with: { mid: other.id, name: authorOf(other), dm_ok: !!other.dm_ok, blocked: !!iBlock, staff: (await staffOf()).has(other.user_id) }, more, items: list.map(d => ({ id: d.id, mine: d.from_m === me.id, body: d.body, at: d.created_at, read: !!d.read_at })) });
    }
    if (method === 'POST') {
      const b = await body(request, 4000); const text = clean(b.body); need(text.length >= 1 && text.length <= COMMUNITY_LIMITS.dm, `쪽지는 1~${COMMUNITY_LIMITS.dm}자로 적어 주세요.`);
      need(!(await db.prepare('SELECT 1 x FROM member_blocks WHERE blocker=? AND blocked=?').bind(me.id, other.id).first()), '차단한 분에게는 쪽지를 보낼 수 없어요. 차단을 풀고 보내세요.', 403);
      need(other.dm_ok && !(await db.prepare('SELECT 1 x FROM member_blocks WHERE blocker=? AND blocked=?').bind(other.id, me.id).first()), '이 분에게는 쪽지를 보낼 수 없어요.', 403); // 거부한 이유(차단 여부)는 알려 주지 않는다
      const waiting = (await db.prepare('SELECT COUNT(*) c FROM dms WHERE from_m=? AND to_m=? AND read_at IS NULL').bind(me.id, other.id).first()).c; need(waiting < 10, '상대가 읽기 전에는 쪽지를 10개까지만 보낼 수 있어요.', 429);
      const count = await throttle('dm'); const r = await db.prepare('INSERT INTO dms(from_m, to_m, body, created_at) VALUES(?,?,?,?) RETURNING id').bind(me.id, other.id, text, now).first(); await count(); return json({ ok: true, id: r.id }, 201);
    }
  }
  if ((m = /^\/dm\/message\/(\d{1,12})$/.exec(rest)) && method === 'DELETE') { // 내가 보낸 쪽지 지우기(받는 사람 쪽에서도 사라진다). 신고된 쪽지는 관리자도 지울 수 있다.
    const id = num(m[1]); const d = await db.prepare('SELECT id, from_m FROM dms WHERE id=?').bind(id).first(); need(d, '쪽지를 찾을 수 없어요.', 404);
    const reported = admin && !!(await db.prepare("SELECT 1 x FROM community_reports WHERE kind='dm' AND target_id=?").bind(id).first()); need(d.from_m === me.id || reported, '내가 보낸 쪽지만 지울 수 있어요.', 403);
    await db.prepare('DELETE FROM dms WHERE id=?').bind(id).run(); await db.prepare("DELETE FROM community_reports WHERE kind='dm' AND target_id=?").bind(id).run(); return json({ ok: true });
  }

  // ---- 신고(누구나) · 신고 목록·처리(관리자) ----
  if (rest === '/report' && method === 'POST') {
    const b = await body(request); const kind = ['post', 'comment', 'dm'].includes(b.kind) ? b.kind : ''; need(kind, '신고할 대상이 올바르지 않아요.'); const id = Math.trunc(num(b.id)); need(Number.isSafeInteger(id) && id > 0, '신고할 대상이 올바르지 않아요.');
    if (kind === 'dm') { const d = await db.prepare('SELECT to_m FROM dms WHERE id=?').bind(id).first(); need(d, '신고할 대상을 찾을 수 없어요.', 404); need(d.to_m === me.id, '받은 쪽지만 신고할 수 있어요.', 403); }
    else { const owner = kind === 'post' ? await db.prepare('SELECT user_id FROM posts WHERE id=?').bind(id).first() : await db.prepare('SELECT user_id FROM comments WHERE id=?').bind(id).first(); need(owner, '신고할 대상을 찾을 수 없어요.', 404); need(owner.user_id !== user.id, '내 글은 신고할 수 없어요.'); }
    const count = await throttle('report'); await db.prepare('INSERT OR IGNORE INTO community_reports(kind, target_id, user_id, reason, created_at) VALUES(?,?,?,?,?)').bind(kind, id, user.id, clean(b.reason).slice(0, COMMUNITY_LIMITS.report), now).run(); await count();
    return json({ ok: true });
  }
  if (rest === '/reports' && method === 'GET') {
    need(admin, '관리자만 볼 수 있어요.', 403);
    const groups = (await db.prepare('SELECT kind, target_id, COUNT(*) AS n, MAX(created_at) AS at FROM community_reports GROUP BY kind, target_id ORDER BY at DESC LIMIT 50').bind().all()).results; const items = [];
    for (const g of groups) {
      const reasons = (await db.prepare("SELECT reason FROM community_reports WHERE kind=? AND target_id=? AND reason <> '' ORDER BY id DESC LIMIT 3").bind(g.kind, g.target_id).all()).results.map(r => r.reason);
      if (g.kind === 'post') { const p = await db.prepare('SELECT p.id, p.title, SUBSTR(p.body,1,120) AS excerpt, p.hidden, u.name, u.email, m.nick FROM posts p JOIN users u ON u.id=p.user_id LEFT JOIN members m ON m.user_id=p.user_id WHERE p.id=?').bind(g.target_id).first(); if (p) items.push({ kind: 'post', id: p.id, postId: p.id, title: p.title, excerpt: p.excerpt, hidden: !!p.hidden, author: authorOf(p), count: g.n, at: g.at, reasons }); }
      else if (g.kind === 'comment') { const c = await db.prepare('SELECT c.id, c.post_id, SUBSTR(c.body,1,120) AS excerpt, c.hidden, u.name, u.email, m.nick FROM comments c JOIN users u ON u.id=c.user_id LEFT JOIN members m ON m.user_id=c.user_id WHERE c.id=?').bind(g.target_id).first(); if (c) items.push({ kind: 'comment', id: c.id, postId: c.post_id, title: '', excerpt: c.excerpt, hidden: !!c.hidden, author: authorOf(c), count: g.n, at: g.at, reasons }); }
      else if (g.kind === 'dm') { const d = await db.prepare('SELECT d.id, SUBSTR(d.body,1,120) AS excerpt, u.name, u.email, m.nick FROM dms d JOIN members m ON m.id=d.from_m JOIN users u ON u.id=m.user_id WHERE d.id=?').bind(g.target_id).first(); if (d) items.push({ kind: 'dm', id: d.id, postId: 0, title: '쪽지', excerpt: d.excerpt, hidden: false, author: authorOf(d), count: g.n, at: g.at, reasons }); }
    }
    return json({ ok: true, items });
  }
  if (rest === '/reports/clear' && method === 'POST') { need(admin, '관리자만 할 수 있어요.', 403); const b = await body(request); const kind = ['comment', 'dm'].includes(b.kind) ? b.kind : 'post'; await db.prepare('DELETE FROM community_reports WHERE kind=? AND target_id=?').bind(kind, Math.trunc(num(b.id)) || 0).run(); return json({ ok: true }); }
  return null;
}
