// 커뮤니티(게시판, MB12.9): 로그인한 계정끼리 글·댓글·좋아요를 나누고, 신고와 관리자 정리를 할 수 있다.
// 표는 처음 쓸 때 자동으로 만든다(관리자가 따로 SQL을 실행할 필요 없음). 이 기능만 계정 사이에 공유되는 데이터다.
// 모든 요청은 로그인 뒤에만 오고, 작성자 표시는 이름(없으면 이메일 앞 두 글자+***)만 보여 이메일 전체는 새지 않는다.
export const COMMUNITY_CATS = ['공지', '자료 나눔', '질문·상담', '나눔·소식', '기도 제목', '자유'];
const ADMIN_ONLY = new Set(['공지']);
export const COMMUNITY_LIMITS = { title: 60, post: 4000, comment: 1000, report: 200, page: 20 };
const RATE = { post: [10, 3600e3], comment: [40, 3600e3], report: [20, 24 * 3600e3] };
const clean = s => String(s ?? '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '').trim();

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
  ready.add(db);
}

// 관리자: 환경변수 ADMIN_EMAILS(쉼표로 구분)가 있으면 그 계정들, 없으면 가장 먼저 가입한 계정
export async function isCommunityAdmin(db, env, user) {
  const list = String((env && env.ADMIN_EMAILS) || '').toLowerCase().split(/[,\s]+/).filter(Boolean);
  if (list.length) return list.includes(String(user.email).toLowerCase());
  const first = await db.prepare('SELECT id FROM users ORDER BY created_at ASC, id ASC LIMIT 1').bind().first();
  return !!first && first.id === user.id;
}
// 계정을 삭제할 때 그 사람의 글·댓글·좋아요·신고를 지운다(그 사람 글에 달린 다른 사람의 댓글도 함께 지워진다)
export async function communityPurge(db, userId) {
  await ensure(db);
  for (const sql of ['DELETE FROM post_likes WHERE user_id=?', 'DELETE FROM community_reports WHERE user_id=?', 'DELETE FROM comments WHERE user_id=?', 'DELETE FROM comments WHERE post_id IN (SELECT id FROM posts WHERE user_id=?)', 'DELETE FROM post_likes WHERE post_id IN (SELECT id FROM posts WHERE user_id=?)', 'DELETE FROM posts WHERE user_id=?', 'DELETE FROM community_seen WHERE user_id=?']) await db.prepare(sql).bind(userId).run();
}

const authorOf = r => ((r.name || '').trim() || `${String(r.email || '').split('@')[0].slice(0, 2)}***`);
const sel = full => `SELECT p.id, p.category, p.title, ${full ? 'p.body AS body' : 'SUBSTR(p.body, 1, 140) AS preview'}, p.pinned, p.hidden, p.created_at, p.updated_at, p.user_id, u.name, u.email,
  (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id AND c.hidden = 0) AS ncom, (SELECT COUNT(*) FROM post_likes l WHERE l.post_id = p.id) AS nlike,
  EXISTS(SELECT 1 FROM post_likes l WHERE l.post_id = p.id AND l.user_id = ?) AS liked FROM posts p JOIN users u ON u.id = p.user_id`;
const postOut = (r, me, admin) => ({ id: r.id, category: r.category, title: r.title, ...(r.body !== undefined ? { body: r.body } : { preview: r.preview }), pinned: !!r.pinned, hidden: !!r.hidden, author: authorOf(r), mine: r.user_id === me.id, at: r.created_at, edited: r.updated_at > r.created_at, comments: r.ncom, likes: r.nlike, liked: !!r.liked, ...(admin ? { admin: true } : {}) });

export async function handleCommunity({ db, env, user, request, path, method, now, body, json, HttpError, limited, fail }) {
  if (!path.startsWith('/api/community')) return null;
  await ensure(db);
  const admin = await isCommunityAdmin(db, env, user); const rest = path.slice('/api/community'.length) || '/'; let m;
  const num = s => Number(s);
  const need = (cond, msg, status = 400) => { if (!cond) throw new HttpError(status, msg); };
  const throttle = async (name) => { const [max, win] = RATE[name]; const key = `c${name[0]}:${user.id}`; if (await limited(db, key, max, now)) throw new HttpError(429, name === 'post' ? '글은 한 시간에 10개까지 올릴 수 있어요. 잠시 뒤에 다시 해 주세요.' : name === 'comment' ? '댓글은 한 시간에 40개까지 달 수 있어요. 잠시 뒤에 다시 해 주세요.' : '신고는 하루에 20건까지 할 수 있어요.'); return () => fail(db, key, now, win); };
  const loadPost = async id => {
    const r = await db.prepare(`${sel(true)} WHERE p.id = ?`).bind(user.id, id).first();
    if (!r || (r.hidden && !admin && r.user_id !== user.id)) throw new HttpError(404, '글을 찾을 수 없어요. 지워졌거나 숨겨졌을 수 있어요.'); return r;
  };
  const checkText = (title, text, cat) => {
    need(COMMUNITY_CATS.includes(cat), '분류를 골라 주세요.'); need(!ADMIN_ONLY.has(cat) || admin, '공지는 관리자만 올릴 수 있어요.', 403);
    need(title.length >= 2 && title.length <= COMMUNITY_LIMITS.title, `제목은 2~${COMMUNITY_LIMITS.title}자로 적어 주세요.`); need(text.length >= 2 && text.length <= COMMUNITY_LIMITS.post, `내용은 2~${COMMUNITY_LIMITS.post}자로 적어 주세요.`);
  };

  // ---- 알림 배지: 내가 마지막으로 본 뒤 다른 사람이 올린 글·댓글 수 ----
  if (rest === '/summary' && method === 'GET') {
    const seen = await db.prepare('SELECT seen_at FROM community_seen WHERE user_id=?').bind(user.id).first();
    const reports = admin ? (await db.prepare('SELECT COUNT(*) c FROM (SELECT 1 FROM community_reports GROUP BY kind, target_id)').bind().first()).c : 0;
    if (!seen) { await db.prepare('INSERT OR IGNORE INTO community_seen(user_id, seen_at) VALUES(?,?)').bind(user.id, now).run(); return json({ ok: true, unread: 0, admin, reports }); }
    const c = await db.prepare('SELECT (SELECT COUNT(*) FROM posts WHERE created_at > ? AND user_id <> ? AND hidden = 0) + (SELECT COUNT(*) FROM comments WHERE created_at > ? AND user_id <> ? AND hidden = 0) AS n').bind(seen.seen_at, user.id, seen.seen_at, user.id).first();
    return json({ ok: true, unread: c.n, admin, reports });
  }
  if (rest === '/seen' && method === 'POST') { await db.prepare('INSERT INTO community_seen(user_id, seen_at) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET seen_at = excluded.seen_at').bind(user.id, now).run(); return json({ ok: true }); }

  // ---- 글 목록(고정 글은 첫 쪽에만) · 글쓰기 ----
  if (rest === '/posts' && method === 'GET') {
    const sp = new URL(request.url).searchParams; const cat = sp.get('category') || ''; need(!cat || COMMUNITY_CATS.includes(cat), '분류가 올바르지 않아요.'); const before = Math.max(0, Math.trunc(num(sp.get('before')) || 0));
    const vis = '(p.hidden = 0 OR ? = 1 OR p.user_id = ?)'; const adm = admin ? 1 : 0; const lim = COMMUNITY_LIMITS.page;
    const pinned = before ? [] : (await db.prepare(`${sel(false)} WHERE ${vis} AND p.pinned = 1 AND (? = '' OR p.category = ?) ORDER BY p.id DESC LIMIT 5`).bind(user.id, adm, user.id, cat, cat).all()).results;
    const rows = (await db.prepare(`${sel(false)} WHERE ${vis} AND p.pinned = 0 AND (? = '' OR p.category = ?) AND (? = 0 OR p.id < ?) ORDER BY p.id DESC LIMIT ?`).bind(user.id, adm, user.id, cat, cat, before, before, lim + 1).all()).results;
    const more = rows.length > lim; const items = rows.slice(0, lim);
    return json({ ok: true, admin, cats: COMMUNITY_CATS, items: [...pinned, ...items].map(r => postOut(r, user, admin)), next: more ? items[items.length - 1].id : 0 });
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
      const cs = (await db.prepare('SELECT c.id, c.body, c.hidden, c.created_at, c.user_id, u.name, u.email FROM comments c JOIN users u ON u.id = c.user_id WHERE c.post_id = ? ORDER BY c.id ASC LIMIT 300').bind(id).all()).results;
      return json({ ok: true, post: postOut(p, user, admin), comments: cs.map(c => (c.hidden && !admin && c.user_id !== user.id) ? { id: c.id, hidden: true, body: '', author: '', mine: false, at: c.created_at } : { id: c.id, hidden: !!c.hidden, body: c.body, author: authorOf(c), mine: c.user_id === user.id, at: c.created_at }) });
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

  // ---- 신고(누구나) · 신고 목록·처리(관리자) ----
  if (rest === '/report' && method === 'POST') {
    const b = await body(request); const kind = b.kind === 'comment' ? 'comment' : b.kind === 'post' ? 'post' : ''; need(kind, '신고할 대상이 올바르지 않아요.'); const id = Math.trunc(num(b.id)); need(Number.isSafeInteger(id) && id > 0, '신고할 대상이 올바르지 않아요.');
    const owner = kind === 'post' ? await db.prepare('SELECT user_id FROM posts WHERE id=?').bind(id).first() : await db.prepare('SELECT user_id FROM comments WHERE id=?').bind(id).first(); need(owner, '신고할 대상을 찾을 수 없어요.', 404); need(owner.user_id !== user.id, '내 글은 신고할 수 없어요.');
    const count = await throttle('report'); await db.prepare('INSERT OR IGNORE INTO community_reports(kind, target_id, user_id, reason, created_at) VALUES(?,?,?,?,?)').bind(kind, id, user.id, clean(b.reason).slice(0, COMMUNITY_LIMITS.report), now).run(); await count();
    return json({ ok: true });
  }
  if (rest === '/reports' && method === 'GET') {
    need(admin, '관리자만 볼 수 있어요.', 403);
    const groups = (await db.prepare('SELECT kind, target_id, COUNT(*) AS n, MAX(created_at) AS at FROM community_reports GROUP BY kind, target_id ORDER BY at DESC LIMIT 50').bind().all()).results; const items = [];
    for (const g of groups) {
      const reasons = (await db.prepare("SELECT reason FROM community_reports WHERE kind=? AND target_id=? AND reason <> '' ORDER BY id DESC LIMIT 3").bind(g.kind, g.target_id).all()).results.map(r => r.reason);
      if (g.kind === 'post') { const p = await db.prepare('SELECT p.id, p.title, SUBSTR(p.body,1,120) AS excerpt, p.hidden, u.name, u.email FROM posts p JOIN users u ON u.id=p.user_id WHERE p.id=?').bind(g.target_id).first(); if (p) items.push({ kind: 'post', id: p.id, postId: p.id, title: p.title, excerpt: p.excerpt, hidden: !!p.hidden, author: authorOf(p), count: g.n, at: g.at, reasons }); }
      else { const c = await db.prepare('SELECT c.id, c.post_id, SUBSTR(c.body,1,120) AS excerpt, c.hidden, u.name, u.email FROM comments c JOIN users u ON u.id=c.user_id WHERE c.id=?').bind(g.target_id).first(); if (c) items.push({ kind: 'comment', id: c.id, postId: c.post_id, title: '', excerpt: c.excerpt, hidden: !!c.hidden, author: authorOf(c), count: g.n, at: g.at, reasons }); }
    }
    return json({ ok: true, items });
  }
  if (rest === '/reports/clear' && method === 'POST') { need(admin, '관리자만 할 수 있어요.', 403); const b = await body(request); const kind = b.kind === 'comment' ? 'comment' : 'post'; await db.prepare('DELETE FROM community_reports WHERE kind=? AND target_id=?').bind(kind, Math.trunc(num(b.id)) || 0).run(); return json({ ok: true }); }
  return null;
}
