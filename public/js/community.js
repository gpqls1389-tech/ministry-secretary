// 커뮤니티 화면(MB12.9~): 게시판(글·댓글·좋아요·검색·신고), 쪽지, 사람 찾기·내 소개, 관리자 정리, 메뉴 알림 배지.
// 데이터는 로그인한 계정끼리만 공유되고(서버 /api/community), 모든 글자는 화면에 넣기 전에 esc()를 거친다.
export const COMMUNITY_CATS = ['공지', '자료 나눔', '질문·상담', '나눔·소식', '기도 제목', '자유'];
export const CAT_ICON = { '공지': '📢', '자료 나눔': '📎', '질문·상담': '❓', '나눔·소식': '🌿', '기도 제목': '🙏', '자유': '💬' };
export const CAT_HINT = { '공지': '관리자가 알리는 글', '자료 나눔': '직접 만든 활동지·대본·순서 나눔', '질문·상담': '사역하며 궁금한 것 묻기', '나눔·소식': '행사 후기·감사 나눔', '기도 제목': '함께 기도할 제목(실명·병명은 적지 마세요)', '자유': '그 밖의 이야기' };
export const COMMUNITY_RULES = [
  '아이들의 이름·사진·연락처·주소 같은 개인정보는 올리지 마세요. 기도 제목에도 실명이나 병명은 적지 않는 것이 좋아요.',
  '저작권이 있는 찬양 가사, 교재 본문, 이미지·영상은 그대로 올리지 말고 제목과 구할 수 있는 곳만 알려 주세요. 직접 만든 자료는 마음껏 나눠 주세요.',
  '서로를 존중해 주세요. 교회·교단·사람을 비방하는 글은 관리자가 숨기거나 지울 수 있어요.',
  '글은 이 목회 비서에 로그인한 모든 계정에 보이고, 쪽지는 보낸 사람과 받은 사람만 보지만 서버 관리자는 기술적으로 열람할 수 있어요. 깊은 상담이나 민감한 이야기는 만나서 나누세요.',
];
// 전화번호·주민등록번호 꼴이 들어 있으면 올리기 전에 한 번 더 묻는다
const PII = /(01[016789][-\s.]?\d{3,4}[-\s.]?\d{4})|(\d{6}[-\s]?[1-4]\d{6})/;
export const hasPersonalInfo = t => PII.test(String(t || ''));
export const badgeText = n => (n > 99 ? '99+' : String(n));
export function agoText(ms, now = Date.now()) {
  const s = Math.max(0, Math.floor((now - ms) / 1000)); if (s < 60) return '방금'; const m = Math.floor(s / 60); if (m < 60) return `${m}분 전`; const h = Math.floor(m / 60); if (h < 24) return `${h}시간 전`; const d = Math.floor(h / 24); if (d < 7) return `${d}일 전`;
  const dt = new Date(ms + 9 * 3600e3); return `${dt.getUTCMonth() + 1}/${dt.getUTCDate()}`;
}
// 이미 esc()를 거친 글에서 http(s) 주소만 눌러서 열 수 있는 링크로 바꾼다(그 밖의 주소 형식은 그대로 글자). 값은 이스케이프된 채라 속성에 넣어도 안전하다.
const TAIL = /(?:&#39;|&quot;|&lt;|&gt;|[.,;:!?)\]}])$/;
export function linkify(escaped) {
  return String(escaped).replace(/https?:\/\/[^\s<>"']+/g, raw => {
    let url = raw, tail = ''; for (let t; (t = TAIL.exec(url)); ) { tail = t[0] + tail; url = url.slice(0, -t[0].length); }
    return /^https?:\/\/[^\s/?#]+/i.test(url) && url.length > 8 ? `<a href="${url}" target="_blank" rel="noopener noreferrer nofollow">${url}</a>${tail}` : raw;
  });
}

export function makeCommunity({ $, $$, esc, page, toast, ask, modal, A, UI, api, render }) {
  const S = (UI.comm = UI.comm || { tab: 'board', cat: '', q: '', mine: '', items: [], next: 0, admin: false, reports: 0, dm: 0, mineNew: 0, feed: 0 });
  const here = h => (location.hash || '').startsWith(h);
  const fail = e => toast(e && e.message ? e.message : '문제가 생겼어요. 잠시 뒤에 다시 해 주세요.', true);
  const catTag = c => `<span class="tag ccat">${CAT_ICON[c] || ''} ${esc(c)}</span>`;
  const staffTag = s => (s ? '<span class="tag ok" title="관리자 계정">🛡️ 관리자</span>' : '');
  const body = t => linkify(esc(t));
  const rules = () => `<details class="guide commguide noprint"><summary>📋 이용 안내</summary><ul class="small">${COMMUNITY_RULES.map(r => `<li>${esc(r)}</li>`).join('')}</ul></details>`;
  const offline = (msg, retry) => `<div class="callout bad"><span>📡</span><div class="sp">${esc(msg)}</div><button class="sm" ${retry}>다시 불러오기</button></div>`;
  const needLogin = () => page('💬', '커뮤니티', '', `<div class="callout"><span>🔐</span><div class="sp">커뮤니티는 <b>로그인한 계정</b>에서만 쓸 수 있어요. 지금은 이 브라우저에만 저장하는 모드라서 열 수 없어요.</div></div>`);
  const authorBtn = p => (p.mid && !p.mine ? `<button class="authorbtn" data-mid="${p.mid}" title="이 사람 보기">${esc(p.author)}</button>` : `<b>${esc(p.author)}${p.mine ? ' (나)' : ''}</b>`) + staffTag(p.staff);
  const bindAuthors = root => $$('[data-mid]', root).forEach(b => { b.onclick = () => openCard(Number(b.dataset.mid)); });
  const run = async (fn, ok) => { try { await fn(); if (ok) toast(ok); } catch (e) { fail(e); } };

  // ----- 메뉴 알림 배지(게시판 새 글·댓글 + 안 읽은 쪽지) -----
  function paintBadge() {
    const a = $('#nav a[data-go="#community"]'); if (a) { let b = a.querySelector('.navbadge');
      if (!UI.commUnread) { if (b) b.remove(); } else { if (!b) { b = document.createElement('span'); b.className = 'navbadge'; b.setAttribute('aria-label', '새 글·댓글·쪽지'); a.appendChild(b); } b.textContent = badgeText(UI.commUnread); } }
    const t = $('[data-ctab=dm] .ctabbadge'); if (t) { t.hidden = !S.dm; t.textContent = badgeText(S.dm || 0); }
  }
  const setCounts = (feed, dm) => { S.feed = feed; S.dm = dm; UI.commUnread = feed + dm; paintBadge(); };
  let lastPoll = 0;
  async function refreshBadge() {
    if (A.mode !== 'account' || document.visibilityState !== 'visible') return; lastPoll = Date.now();
    try { const r = await api.summary(); S.admin = r.admin; S.reports = r.reports || 0; S.mineNew = r.mine || 0; setCounts(here('#community') || here('#post') ? 0 : r.unread, r.dm); } catch { /* 오프라인이거나 로그인이 끝났으면 조용히 넘어간다 */ }
  }
  function startBadge() {
    if (A.mode !== 'account') return; setTimeout(refreshBadge, 1500); setInterval(refreshBadge, 3 * 60e3);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Date.now() - lastPoll > 60e3) refreshBadge(); });
  }

  // ----- 사람 카드 · 차단 -----
  async function openCard(mid) {
    let c; try { c = (await api.card(mid)).card; } catch (e) { return fail(e); }
    const d = modal(`<div class="dlg"><h3>🧑 ${esc(c.name)} ${staffTag(c.staff)}</h3>${c.listed ? `${c.church || c.role ? `<p class="small" style="margin:4px 0">${esc([c.church, c.role].filter(Boolean).join(' · '))}</p>` : ''}${c.bio ? `<p class="cbody">${esc(c.bio)}</p>` : ''}` : '<p class="mute small">소개를 공개하지 않은 분이에요.</p>'}
      ${c.mine ? '<p class="mute small">나예요. ‘내 소개’ 탭에서 고칠 수 있어요.</p>' : ''}<div class="err"></div><div class="dlg-foot"><button data-x>닫기</button>${c.mine ? '' : `<button class="ghost" data-block>${c.blocked ? '차단 풀기' : '차단'}</button>${c.dm_ok ? '<button class="pri" data-dm>✉️ 쪽지 보내기</button>' : '<span class="mute small">쪽지를 받지 않는 분이에요</span>'}`}</div></div>`);
    $('[data-x]', d).onclick = () => d.close(); const dm = $('[data-dm]', d); if (dm) dm.onclick = () => { d.close(); location.hash = `#dm/${mid}`; };
    const bl = $('[data-block]', d); if (bl) bl.onclick = async () => { if (!c.blocked && !(await ask('이 분을 차단할까요? 차단하면 이 분은 나에게 쪽지를 보낼 수 없어요(차단했다는 사실은 알려지지 않아요). 언제든 풀 수 있어요.', '차단'))) return; try { await api.block(mid, !c.blocked); d.close(); toast(c.blocked ? '차단을 풀었어요.' : '차단했어요.'); } catch (e) { $('.err', d).textContent = e.message; } };
  }

  // ----- 게시판 목록 -----
  const postCard = p => `<a class="cpost${p.pinned ? ' pinned' : ''}${p.hidden ? ' hiddenpost' : ''}" href="#post/${p.id}"><div class="ctop">${p.pinned ? '<span class="tag warn">📌 고정</span>' : ''}${catTag(p.category)}${p.hidden ? '<span class="tag bad">숨김</span>' : ''}<b>${esc(p.title)}</b></div><p class="cprev">${esc(p.preview || '')}</p><div class="cmeta"><span>${esc(p.author)}${p.mine ? ' (나)' : ''}${p.staff ? ' 🛡️' : ''}</span><span>${esc(agoText(p.at))}</span><span aria-label="댓글">💬 ${p.comments}</span><span aria-label="도움이 돼요">👍 ${p.likes}</span></div></a>`;
  function drawList() {
    const box = $('#commlist'); if (!box) return;
    box.innerHTML = S.items.length ? S.items.map(postCard).join('') : `<div class="empty"><p><b>${S.q || S.mine ? '찾는 글이 없어요.' : '아직 글이 없어요.'}</b></p><p class="mute small">${S.q ? `‘${esc(S.q)}’ 낱말이 들어간 글이 없어요. 다른 낱말로 찾아 보세요.` : S.mine ? '아직 해당하는 글이 없어요.' : S.cat ? `‘${esc(S.cat)}’ 분류의 첫 글을 남겨 보세요.` : '첫 글을 남겨 보세요. 만든 활동지나 대본, 궁금한 점 무엇이든 좋아요.'}</p></div>`;
    const more = $('#commmore'); if (more) { more.innerHTML = S.next ? '<button data-cm="more">더 보기</button>' : ''; const b = $('[data-cm=more]'); if (b) b.onclick = () => loadList(false); }
  }
  async function loadList(reset) {
    const box = $('#commlist'); if (!box) return;
    if (reset) { S.items = []; S.next = 0; box.innerHTML = '<p class="mute small">불러오는 중…</p>'; }
    try {
      const r = await api.posts({ category: S.cat, before: reset ? 0 : S.next, q: S.q, mine: S.mine }); if (!here('#community') || S.tab !== 'board') return;
      S.admin = r.admin; S.items = reset ? r.items : [...S.items, ...r.items]; S.next = r.next; drawList();
      if (reset && !S.q && !S.mine) { api.seen().catch(() => {}); setCounts(0, S.dm); if (r.admin) loadReports(); }
    } catch (e) { box.innerHTML = offline(e.message, 'data-cm="retry"'); const b = $('[data-cm=retry]'); if (b) b.onclick = () => loadList(true); }
  }
  async function loadReports() {
    const box = $('#commreports'); if (!box) return;
    try {
      const r = await api.reports(); if (!here('#community') || S.tab !== 'board') return; S.reports = r.items.length; if (!r.items.length) { box.innerHTML = ''; return; }
      const KIND = { post: '글', comment: '댓글', dm: '쪽지' };
      box.innerHTML = `<details class="box reportbox" open><summary><b>🚩 신고된 글·댓글·쪽지 ${r.items.length}건</b> <span class="mute small">(관리자만 보여요 · 신고된 쪽지는 신고한 분이 보낸 그 쪽지만 보여요)</span></summary><div class="cardb">${r.items.map(x => `<div class="reportitem"><div><span class="tag ${x.kind === 'post' ? '' : 'warn'}">${KIND[x.kind]}</span> ${x.kind === 'post' && x.title ? `<b>${esc(x.title)}</b> ` : ''}<span class="mute small">${esc(x.author)} · 신고 ${x.count}건${x.hidden ? ' · 숨김 중' : ''}</span><p class="small" style="margin:4px 0">${esc(x.excerpt)}</p>${x.reasons.length ? `<p class="small mute" style="margin:0">사유: ${x.reasons.map(esc).join(' / ')}</p>` : ''}</div><div class="row">${x.kind === 'dm' ? `<button class="sm dng" data-rdel="${x.id}">쪽지 지우기</button>` : `<a class="btnlike sm" href="#post/${x.postId}">보기</a><button class="sm" data-rhide="${x.kind}:${x.id}:${x.hidden ? 0 : 1}">${x.hidden ? '숨김 풀기' : '숨기기'}</button>`}<button class="sm ghost" data-rclear="${x.kind}:${x.id}">신고 지우기</button></div></div>`).join('')}</div></details>`;
      $$('[data-rhide]', box).forEach(b => { b.onclick = async () => { const [k, id, h] = b.dataset.rhide.split(':'); try { await (k === 'post' ? api.hidePost(id, h === '1') : api.hideComment(id, h === '1')); toast(h === '1' ? '숨겼어요.' : '숨김을 풀었어요.'); loadReports(); loadList(true); } catch (e) { fail(e); } }; });
      $$('[data-rdel]', box).forEach(b => { b.onclick = async () => { if (!(await ask('신고된 이 쪽지를 지울까요? 보낸 사람과 받은 사람 모두에게서 사라지고 되돌릴 수 없어요.', '지우기'))) return; run(async () => { await api.delDm(b.dataset.rdel); loadReports(); }, '지웠어요.'); }; });
      $$('[data-rclear]', box).forEach(b => { b.onclick = async () => { const [k, id] = b.dataset.rclear.split(':'); try { await api.clearReports(k, id); loadReports(); } catch (e) { fail(e); } }; });
    } catch { /* 신고 목록을 못 불러와도 글 목록은 쓸 수 있다 */ }
  }
  async function drawBoard() {
    const box = $('#commbody'); if (!box) return;
    box.innerHTML = `<div class="row noprint" style="margin:10px 0"><button class="pri" data-cm="new">✏️ 글쓰기</button><form class="csearch" id="csearch" role="search"><input type="search" name="q" placeholder="글 찾기(제목·내용)" maxlength="30" value="${esc(S.q)}" aria-label="글 찾기"><button class="sm">찾기</button></form></div>${rules()}
      <div id="cnew"></div>
      <div class="tabs commchips" role="group" aria-label="보기">${[['', '전체 글'], ['1', '내가 쓴 글'], ['2', '내가 댓글 단 글']].map(([k, l]) => `<a data-cmine="${k}" class="${S.mine === k ? 'on' : ''}">${l}</a>`).join('')}</div>
      <div class="tabs commtabs" role="tablist"><a data-ccat="" class="${S.cat === '' ? 'on' : ''}">전체</a>${COMMUNITY_CATS.map(c => `<a data-ccat="${esc(c)}" class="${S.cat === c ? 'on' : ''}" title="${esc(CAT_HINT[c])}">${CAT_ICON[c]} ${esc(c)}</a>`).join('')}</div>
      <div id="commreports"></div><div id="commlist" aria-live="polite"><p class="mute small">불러오는 중…</p></div><div id="commmore" class="row" style="justify-content:center;margin-top:10px"></div>`;
    $$('[data-ccat]').forEach(a => { a.onclick = () => { S.cat = a.dataset.ccat; $$('[data-ccat]').forEach(x => x.classList.toggle('on', x === a)); loadList(true); }; });
    $$('[data-cmine]').forEach(a => { a.onclick = () => { S.mine = a.dataset.cmine; $$('[data-cmine]').forEach(x => x.classList.toggle('on', x === a)); loadList(true); }; });
    $('[data-cm=new]').onclick = () => openCompose(null); $('#csearch').onsubmit = e => { e.preventDefault(); S.q = e.target.elements.q.value.trim(); loadList(true); };
    try { const r = await api.summary(); S.mineNew = r.mine || 0; S.dm = r.dm; S.admin = r.admin; paintBadge(); } catch { /* 안내 띠 없이 진행 */ }
    const strip = $('#cnew'); if (strip && S.mineNew > 0) { strip.innerHTML = `<div class="callout small noprint"><span>💬</span><div class="sp">내 글에 <b>새 댓글 ${S.mineNew}개</b>가 달렸어요.</div><button class="sm" data-cm="mymine">내가 쓴 글 보기</button></div>`; $('[data-cm=mymine]').onclick = () => { S.mine = '1'; S.mineNew = 0; drawBoard(); }; }
    loadList(true);
  }

  // ----- 쪽지함 · 사람 찾기 · 내 소개 -----
  async function drawInbox() {
    const box = $('#commbody'); if (!box) return; box.innerHTML = '<p class="mute small" style="margin-top:12px">불러오는 중…</p>';
    try {
      const r = await api.inbox(); if (!here('#community') || S.tab !== 'dm') return; setCounts(S.feed, r.items.reduce((a, x) => a + x.unread, 0));
      box.innerHTML = `<p class="mute small" style="margin:10px 0">쪽지는 보낸 사람과 받은 사람만 볼 수 있어요(서버 관리자는 기술적으로 열람할 수 있으니 민감한 이야기는 만나서 나누세요). 새 쪽지는 ‘사람 찾기’나 글쓴이 이름에서 보낼 수 있어요.</p>${r.items.length ? r.items.map(x => `<a class="cpost${x.unread ? ' unreadpost' : ''}" href="#dm/${x.mid}"><div class="ctop"><b>${esc(x.name)}</b>${x.unread ? `<span class="navbadge">${badgeText(x.unread)}</span>` : ''}${x.blocked ? '<span class="tag bad">차단함</span>' : ''}</div><p class="cprev">${x.lastMine ? '나: ' : ''}${esc(x.last)}</p><div class="cmeta"><span>${esc(agoText(x.at))}</span></div></a>`).join('') : '<div class="empty"><p><b>받은·보낸 쪽지가 없어요.</b></p><p class="mute small">‘사람 찾기’에서 같은 사역을 하는 분을 찾아 첫 쪽지를 보내 보세요.</p></div>'}`;
    } catch (e) { box.innerHTML = offline(e.message, 'data-cm="retry"'); const b = $('[data-cm=retry]'); if (b) b.onclick = drawInbox; }
  }
  const pcard = x => `<div class="pcard"><div><b>${esc(x.name)}</b> ${staffTag(x.staff)}${x.mine ? ' <span class="mute small">(나)</span>' : ''}<div class="small mute">${esc([x.church, x.role].filter(Boolean).join(' · '))}</div>${x.bio ? `<p class="small cbody" style="margin:4px 0">${esc(x.bio)}</p>` : ''}</div>${x.mine ? '' : x.dm_ok ? `<a class="btnlike sm" href="#dm/${x.mid}">✉️ 쪽지</a>` : '<span class="mute small">쪽지 받지 않음</span>'}</div>`;
  async function drawPeople(reset = true) {
    const box = $('#commbody'); if (!box) return; const P = S.people = S.people || { q: '', items: [], next: 0 };
    if (reset) { P.items = []; P.next = 0; box.innerHTML = `<form class="csearch" id="psearch" role="search" style="margin:12px 0"><input type="search" name="q" placeholder="이름·교회·맡은 사역·소개로 찾기" maxlength="30" value="${esc(P.q)}" aria-label="사람 찾기"><button class="sm">찾기</button></form><p class="mute small">소개를 공개한 분만 보여요. 내 소개는 ‘내 소개’ 탭에서 공개할 수 있어요.</p><div id="plist"><p class="mute small">불러오는 중…</p></div><div id="pmore" class="row" style="justify-content:center"></div>`; $('#psearch').onsubmit = e => { e.preventDefault(); P.q = e.target.elements.q.value.trim(); drawPeople(true); }; }
    try {
      const r = await api.members({ q: P.q, before: reset ? 0 : P.next }); if (!here('#community') || S.tab !== 'people') return; P.items = reset ? r.items : [...P.items, ...r.items]; P.next = r.next;
      $('#plist').innerHTML = P.items.length ? P.items.map(pcard).join('') : `<div class="empty"><p><b>${P.q ? '찾는 분이 없어요.' : '아직 소개를 공개한 분이 없어요.'}</b></p><p class="mute small">${P.q ? '다른 낱말로 찾아 보세요.' : '‘내 소개’에서 먼저 소개를 공개해 보세요.'}</p></div>`;
      $('#pmore').innerHTML = P.next ? '<button data-cm="pmore">더 보기</button>' : ''; const b = $('[data-cm=pmore]'); if (b) b.onclick = () => drawPeople(false);
    } catch (e) { $('#plist').innerHTML = offline(e.message, 'data-cm="retry"'); const b = $('[data-cm=retry]'); if (b) b.onclick = () => drawPeople(true); }
  }
  async function drawMe() {
    const box = $('#commbody'); if (!box) return; box.innerHTML = '<p class="mute small" style="margin-top:12px">불러오는 중…</p>'; let me;
    try { me = await api.me(); } catch (e) { box.innerHTML = offline(e.message, 'data-cm="retry"'); const b = $('[data-cm=retry]'); if (b) b.onclick = drawMe; return; } if (S.tab !== 'me') return;
    box.innerHTML = `<form id="meform" class="meform"><p class="mute small" style="margin:10px 0">커뮤니티에서 나를 어떻게 보여 줄지 정해요. 소개를 <b>공개</b>하면 ‘사람 찾기’에 나타나고, 글쓴이 이름을 눌렀을 때 교회·사역·소개가 보여요. 연락처·집 주소·아이들의 정보는 적지 마세요.</p>
      <label class="f">표시 이름 (글·댓글·쪽지에 보이는 이름, 20자까지)<input name="nick" maxlength="20" value="${esc(me.nick)}" placeholder="예: 박OO 전도사"><span class="hint">비워 두면 계정 이름(없으면 이메일 앞 두 글자와 ***)이 보여요.</span></label>
      <label class="f">교회·기관 (선택, 30자까지)<input name="church" maxlength="30" value="${esc(me.church)}"></label>
      <label class="f">맡은 사역 (선택, 30자까지)<input name="role" maxlength="30" value="${esc(me.role)}" placeholder="예: 유치부 교사"></label>
      <label class="f">한마디 소개 (선택, 200자까지)<textarea name="bio" rows="3" maxlength="200">${esc(me.bio)}</textarea></label>
      <label class="chk" style="display:flex;gap:8px;margin:8px 0"><input type="checkbox" name="listed"${me.listed ? ' checked' : ''}> <span><b>소개를 공개해요</b> — ‘사람 찾기’에 보이고 이름을 누르면 소개가 보여요(표시 이름 2자 이상 필요)</span></label>
      <label class="chk" style="display:flex;gap:8px;margin:8px 0"><input type="checkbox" name="dm_ok"${me.dm_ok ? ' checked' : ''}> <span><b>쪽지를 받아요</b> — 끄면 아무도 나에게 새 쪽지를 보낼 수 없어요</span></label>
      <div class="err"></div><div class="row"><button class="pri">저장</button></div></form>`;
    const f = $('#meform'); f.onsubmit = async e => { e.preventDefault(); const el = f.elements; try { await api.saveMe({ nick: el.nick.value, church: el.church.value, role: el.role.value, bio: el.bio.value, listed: el.listed.checked, dm_ok: el.dm_ok.checked }); toast('저장했어요.'); } catch (er) { $('.err', f).textContent = er.message; } };
  }
  function showTab() {
    $$('[data-ctab]').forEach(a => a.classList.toggle('on', a.dataset.ctab === S.tab)); stopDmTimer();
    ({ board: drawBoard, dm: drawInbox, people: () => drawPeople(true), me: drawMe }[S.tab] || drawBoard)();
  }
  function vCommunity() {
    if (A.mode !== 'account') return needLogin();
    page('💬', '커뮤니티', '같은 목회 비서를 쓰는 선생님·교역자가 자료와 이야기를 나누고 서로 만나는 공간이에요.', `<div class="tabs commmain" role="tablist">${[['board', '📋 게시판'], ['dm', '✉️ 쪽지'], ['people', '🧑‍🤝‍🧑 사람 찾기'], ['me', '🙋 내 소개']].map(([k, l]) => `<a data-ctab="${k}" class="${S.tab === k ? 'on' : ''}">${l}<span class="navbadge ctabbadge" hidden></span></a>`).join('')}</div><div id="commbody"></div>`);
    $$('[data-ctab]').forEach(a => { a.onclick = () => { S.tab = a.dataset.ctab; showTab(); }; }); paintBadge(); showTab();
  }

  // ----- 쪽지 대화 -----
  let dmTimer = null; const stopDmTimer = () => { if (dmTimer) { clearInterval(dmTimer); dmTimer = null; } };
  window.addEventListener('hashchange', () => { if (!here('#dm/')) stopDmTimer(); });
  function vDm(mid) {
    if (A.mode !== 'account') return needLogin(); stopDmTimer(); let T = { with: null, items: [], more: false };
    page('✉️', '쪽지', '', `<div class="row noprint" style="margin-bottom:10px"><a class="btnlike" href="#community" id="dmback">◀ 쪽지함</a><b id="dmname"></b><span class="sp"></span><button class="sm ghost" id="dmblock" hidden></button></div><div id="dmbox"><p class="mute small">불러오는 중…</p></div>
      <form class="cform noprint" id="dmform"><label class="f">쪽지 쓰기<textarea name="body" rows="3" maxlength="1000" placeholder="1000자까지 쓸 수 있어요. 아이들의 개인정보·연락처는 적지 마세요." required></textarea></label><div class="row"><button class="pri">보내기</button><span class="mute small" id="dmcount"></span><span class="mute small">상대가 읽기 전에는 10개까지 보낼 수 있어요</span></div></form>`);
    $('#dmback').onclick = () => { S.tab = 'dm'; };
    const draw = keepScroll => { const box = $('#dmbox'); if (!box || !T.with) return; const w = T.with;
      $('#dmname').innerHTML = `${esc(w.name)} ${staffTag(w.staff)}`; const bl = $('#dmblock'); bl.hidden = false; bl.textContent = w.blocked ? '차단 풀기' : '차단'; bl.onclick = () => run(async () => { if (!w.blocked && !(await ask('이 분을 차단할까요? 차단하면 이 분은 나에게 쪽지를 보낼 수 없어요(차단했다는 사실은 알려지지 않아요).', '차단'))) return; await api.block(mid, !w.blocked); w.blocked = !w.blocked; draw(); }, null);
      box.innerHTML = `${T.more ? '<div class="row" style="justify-content:center"><button class="sm ghost" data-dm="older">이전 쪽지 더 보기</button></div>' : ''}<div class="dmlist" aria-live="polite">${T.items.length ? T.items.map(x => `<div class="dmmsg ${x.mine ? 'mine' : 'theirs'}"><div class="dmbody cbody">${body(x.body)}</div><div class="cmeta"><span>${esc(agoText(x.at))}</span>${x.mine ? `<span>${x.read ? '읽음' : '안 읽음'}</span><button class="sm ghost" data-ddel="${x.id}">지우기</button>` : `<button class="sm ghost" data-drep="${x.id}">신고</button>`}</div></div>`).join('') : '<p class="mute small">아직 주고받은 쪽지가 없어요. 첫 인사를 보내 보세요.</p>'}</div>${w.dm_ok ? '' : '<p class="mute small">이 분은 지금 쪽지를 받지 않아요.</p>'}`;
      const older = $('[data-dm=older]', box); if (older) older.onclick = () => run(async () => { const r = await api.thread(mid, T.items[0].id); T.items = [...r.items, ...T.items]; T.more = r.more; draw(); });
      $$('[data-ddel]', box).forEach(b => { b.onclick = async () => { if (!(await ask('이 쪽지를 지울까요? 받은 사람에게서도 사라져요.', '지우기'))) return; run(async () => { await api.delDm(b.dataset.ddel); T.items = T.items.filter(x => String(x.id) !== b.dataset.ddel); draw(); }); }; });
      $$('[data-drep]', box).forEach(b => { b.onclick = () => reportDm(b.dataset.drep); });
      if (!keepScroll) window.scrollTo(0, document.body.scrollHeight); };
    const load = async quiet => { try { const r = await api.thread(mid); if (!here('#dm/' + mid)) return; const changed = quiet && JSON.stringify(r.items.map(x => [x.id, x.read])) === JSON.stringify(T.items.map(x => [x.id, x.read])); T = { with: r.with, items: r.items, more: r.more }; if (!changed) draw(quiet); if (!quiet) setCounts(S.feed, Math.max(0, S.dm - 1)); } catch (e) { if (!quiet) { const box = $('#dmbox'); if (box) box.innerHTML = `<div class="callout bad"><span>🙈</span><div class="sp">${esc(e.message)}</div></div>`; } } };
    load(false); dmTimer = setInterval(() => { if (document.visibilityState === 'visible' && here('#dm/' + mid)) load(true); }, 10e3); // 열려 있는 동안 10초마다 새 쪽지 확인
    const f = $('#dmform'); const ta = f.elements.body; ta.oninput = () => { $('#dmcount').textContent = `${ta.value.length}/1000`; };
    f.onsubmit = async e => { e.preventDefault(); const text = ta.value.trim(); if (!text) return; if (hasPersonalInfo(text) && !(await ask('쪽지에 전화번호나 주민등록번호처럼 보이는 숫자가 들어 있어요. 그래도 보낼까요?', '보내기'))) return; const btn = f.querySelector('button.pri'); btn.disabled = true; try { await api.sendDm(mid, text); ta.value = ''; $('#dmcount').textContent = ''; await load(false); } catch (er) { fail(er); } btn.disabled = false; };
  }
  function reportDm(id) {
    const d = modal(`<form method="dialog" class="dlg"><h3>🚩 쪽지 신고</h3><p class="mute small">광고, 불쾌한 내용, 개인정보 요구처럼 신고하고 싶은 쪽지만 관리자에게 알려요. <b>신고한 이 쪽지의 내용만</b> 관리자에게 보이고, 나머지 대화는 보이지 않아요.</p><label class="f">사유 (선택)<input name="reason" maxlength="200"></label><div class="err"></div><div class="dlg-foot"><button type="button" data-x>취소</button><button class="pri">신고하기</button></div></form>`);
    $('[data-x]', d).onclick = () => d.close();
    $('form', d).onsubmit = async e => { e.preventDefault(); try { await api.report('dm', Number(id), e.target.elements.reason.value); d.close(); toast('신고했어요. 관리자가 확인해요.'); } catch (er) { $('.err', d).textContent = er.message; } };
  }

  // ----- 글 보기 -----
  let cur = null; // { post, comments }
  const commentHtml = (c, admin) => c.hidden && !admin && !c.mine ? '<div class="ccomment hiddenc"><span class="mute small">관리자가 숨긴 댓글이에요.</span></div>'
    : `<div class="ccomment${c.hidden ? ' hiddenc' : ''}" data-cid="${c.id}"><div class="cmeta">${authorBtn(c)}<span>${esc(agoText(c.at))}</span>${c.hidden ? '<span class="tag bad">숨김</span>' : ''}<span class="sp"></span>${c.mine || admin ? `<button class="sm ghost" data-cdel="${c.id}">지우기</button>` : `<button class="sm ghost" data-crep="${c.id}">신고</button>`}${admin ? `<button class="sm ghost" data-chide="${c.id}:${c.hidden ? 0 : 1}">${c.hidden ? '숨김 풀기' : '숨기기'}</button>` : ''}</div><p class="cbody">${body(c.body)}</p></div>`;
  function drawPost() {
    const box = $('#postbox'); if (!box || !cur) return; const p = cur.post; const admin = !!p.admin;
    box.innerHTML = `<article class="box cfull${p.hidden ? ' hiddenpost' : ''}"><div class="cardb"><div class="ctop">${p.pinned ? '<span class="tag warn">📌 고정</span>' : ''}${catTag(p.category)}${p.hidden ? '<span class="tag bad">숨김</span>' : ''}</div><h2 class="ctitle">${esc(p.title)}</h2><div class="cmeta">${authorBtn(p)}<span>${esc(agoText(p.at))}${p.edited ? ' · 수정됨' : ''}</span></div>${p.hidden ? '<div class="callout warn small"><span>🙈</span><div class="sp">관리자가 이 글을 숨겼어요. 다른 사람에게는 보이지 않아요.</div></div>' : ''}<div class="cbody cfulltext">${body(p.body)}</div>
      <div class="row noprint" style="margin-top:12px"><button class="${p.liked ? 'pri' : ''}" data-pm="like" aria-pressed="${p.liked}">👍 도움이 돼요 ${p.likes}</button><span class="sp"></span>${p.mine ? '<button data-pm="edit">고치기</button><button class="dng" data-pm="del">지우기</button>' : '<button class="ghost" data-pm="report">🚩 신고</button>'}</div>
      ${admin ? `<div class="row noprint adminrow"><span class="mute small">관리자</span><button class="sm" data-pm="pin">${p.pinned ? '고정 풀기' : '📌 고정'}</button><button class="sm" data-pm="hide">${p.hidden ? '숨김 풀기' : '숨기기'}</button>${p.mine ? '' : '<button class="sm dng" data-pm="del">지우기</button>'}</div>` : ''}</div></article>
      <h3 style="margin:16px 0 8px">댓글 ${cur.comments.filter(c => !c.hidden).length}</h3><div id="ccomments">${cur.comments.length ? cur.comments.map(c => commentHtml(c, admin)).join('') : '<p class="mute small">아직 댓글이 없어요. 첫 댓글을 남겨 보세요.</p>'}</div>
      <form class="cform noprint" id="cform"><label class="f">댓글 쓰기<textarea name="body" rows="3" maxlength="1000" placeholder="따뜻한 말 한마디를 남겨 주세요(1000자까지)" required></textarea></label><div class="row"><button class="pri">댓글 달기</button><span class="mute small" id="ccount2"></span></div></form>`;
    bindPost(); bindAuthors(box);
  }
  function bindPost() {
    const id = cur.post.id; const act = n => $(`[data-pm=${n}]`);
    const reload = async () => { const r = await api.post(id); cur = { post: r.post, comments: r.comments }; drawPost(); };
    const like = act('like'); if (like) like.onclick = () => run(async () => { const r = await api.like(id); cur.post.liked = r.liked; cur.post.likes = r.likes; drawPost(); });
    const edit = act('edit'); if (edit) edit.onclick = () => openCompose(cur.post);
    $$('[data-pm=del]').forEach(b => { b.onclick = async () => { if (!(await ask('이 글을 지울까요? 댓글도 함께 지워지고 되돌릴 수 없어요.', '지우기'))) return; run(async () => { await api.removePost(id); toast('지웠어요.'); location.hash = '#community'; }); }; });
    const rep = act('report'); if (rep) rep.onclick = () => report('post', id);
    const pin = act('pin'); if (pin) pin.onclick = () => run(async () => { await api.pin(id, !cur.post.pinned); await reload(); });
    const hide = act('hide'); if (hide) hide.onclick = () => run(async () => { await api.hidePost(id, !cur.post.hidden); await reload(); });
    $$('[data-cdel]').forEach(b => { b.onclick = async () => { if (!(await ask('이 댓글을 지울까요?', '지우기'))) return; run(async () => { await api.removeComment(b.dataset.cdel); await reload(); }); }; });
    $$('[data-crep]').forEach(b => { b.onclick = () => report('comment', b.dataset.crep); });
    $$('[data-chide]').forEach(b => { b.onclick = () => run(async () => { const [cid, h] = b.dataset.chide.split(':'); await api.hideComment(cid, h === '1'); await reload(); }); });
    const f = $('#cform'); const ta = f.elements.body; ta.oninput = () => { $('#ccount2').textContent = `${ta.value.length}/1000`; };
    f.onsubmit = async e => { e.preventDefault(); const text = ta.value.trim(); if (!text) return; if (hasPersonalInfo(text) && !(await ask('댓글에 전화번호나 주민등록번호처럼 보이는 숫자가 들어 있어요. 그래도 올릴까요?', '올리기'))) return; const btn = f.querySelector('button.pri'); btn.disabled = true; try { await api.comment(id, text); ta.value = ''; await reload(); } catch (er) { fail(er); } btn.disabled = false; };
  }
  function report(kind, id) {
    const d = modal(`<form method="dialog" class="dlg"><h3>🚩 신고하기</h3><p class="mute small">광고, 개인정보 노출, 저작권 침해, 비방처럼 모두에게 보여서는 안 되는 내용을 관리자에게 알려요. 신고한 사람은 알려지지 않아요.</p><label class="f">사유 (선택)<input name="reason" maxlength="200" placeholder="예: 연락처가 적혀 있어요"></label><div class="err"></div><div class="dlg-foot"><button type="button" data-x>취소</button><button class="pri">신고하기</button></div></form>`);
    $('[data-x]', d).onclick = () => d.close();
    $('form', d).onsubmit = async e => { e.preventDefault(); try { await api.report(kind, Number(id), e.target.elements.reason.value); d.close(); toast('신고했어요. 관리자가 확인해요.'); } catch (er) { $('.err', d).textContent = er.message; } };
  }
  function vPost(id) {
    if (A.mode !== 'account') return needLogin(); cur = null;
    page('💬', '커뮤니티', '', `<div class="row noprint" style="margin-bottom:10px"><a class="btnlike" href="#community" id="pback">◀ 목록</a></div><div id="postbox"><p class="mute small">불러오는 중…</p></div>`); $('#pback').onclick = () => { S.tab = 'board'; };
    api.post(id).then(r => { if (!here('#post/' + id)) return; cur = { post: r.post, comments: r.comments }; drawPost(); setCounts(0, S.dm); })
      .catch(e => { const box = $('#postbox'); if (box) box.innerHTML = `<div class="callout bad"><span>🙈</span><div class="sp">${esc(e.message)}</div></div>`; });
  }

  // ----- 글쓰기·고치기 -----
  function openCompose(p) {
    const edit = !!p; const admin = S.admin; const cats = COMMUNITY_CATS.filter(c => c !== '공지' || admin || (edit && p.category === '공지'));
    const d = modal(`<form method="dialog" class="dlg wide"><h3>${edit ? '글 고치기' : '✏️ 새 글 쓰기'}</h3>
      <label class="f">분류<select name="category">${cats.map(c => `<option value="${esc(c)}"${(edit ? p.category : '자유') === c ? ' selected' : ''}>${CAT_ICON[c]} ${esc(c)} — ${esc(CAT_HINT[c])}</option>`).join('')}</select></label>
      <label class="f">제목<input name="title" maxlength="60" required value="${esc(edit ? p.title : '')}" placeholder="2~60자"></label>
      <label class="f">내용<textarea name="body" rows="10" maxlength="4000" required placeholder="4000자까지 쓸 수 있어요. 웹 주소(https://…)는 눌러서 열 수 있게 보여요.">${esc(edit ? p.body : '')}</textarea><span class="hint" id="ccount">0/4000</span></label>
      <div class="callout warn small"><span>🔒</span><div class="sp">아이들의 이름·사진·연락처, 저작권이 있는 찬양 가사·교재 본문·이미지는 올리지 마세요. 이 글은 로그인한 모든 계정과 서버 관리자에게 보여요.</div></div>
      <div class="err"></div><div class="dlg-foot"><button type="button" data-x>취소</button><button class="pri">${edit ? '저장' : '올리기'}</button></div></form>`);
    const f = $('form', d); const ta = f.elements.body; const count = () => { $('#ccount', d).textContent = `${ta.value.length}/4000`; }; ta.oninput = count; count();
    $('[data-x]', d).onclick = () => d.close();
    f.onsubmit = async e => {
      e.preventDefault(); const b = { category: f.elements.category.value, title: f.elements.title.value, body: ta.value };
      if (hasPersonalInfo(b.title + '\n' + b.body) && !(await ask('글에 전화번호나 주민등록번호처럼 보이는 숫자가 들어 있어요. 아이들이나 다른 사람의 개인정보라면 지우고 올려 주세요. 그래도 올릴까요?', '올리기'))) return;
      const btn = $('button.pri', d); btn.disabled = true;
      try { if (edit) { await api.update(p.id, b); d.close(); toast('고쳤어요.'); const r = await api.post(p.id); cur = { post: r.post, comments: r.comments }; drawPost(); } else { const r = await api.create(b); d.close(); toast('올렸어요.'); location.hash = `#post/${r.id}`; } }
      catch (er) { btn.disabled = false; $('.err', d).textContent = er.message; }
    };
  }
  return { vCommunity, vPost, vDm, refreshBadge, startBadge, paintBadge };
}
