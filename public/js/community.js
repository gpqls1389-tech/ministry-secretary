// 커뮤니티(게시판, MB12.9) 화면: 글 목록·글 보기·글쓰기·댓글·좋아요·신고·관리자 정리, 메뉴 알림 배지.
// 데이터는 로그인한 계정끼리만 공유되고(서버 /api/community), 모든 글자는 화면에 넣기 전에 esc()를 거친다.
export const COMMUNITY_CATS = ['공지', '자료 나눔', '질문·상담', '나눔·소식', '기도 제목', '자유'];
export const CAT_ICON = { '공지': '📢', '자료 나눔': '📎', '질문·상담': '❓', '나눔·소식': '🌿', '기도 제목': '🙏', '자유': '💬' };
export const CAT_HINT = { '공지': '관리자가 알리는 글', '자료 나눔': '직접 만든 활동지·대본·순서 나눔', '질문·상담': '사역하며 궁금한 것 묻기', '나눔·소식': '행사 후기·감사 나눔', '기도 제목': '함께 기도할 제목(실명·병명은 적지 마세요)', '자유': '그 밖의 이야기' };
export const COMMUNITY_RULES = [
  '아이들의 이름·사진·연락처·주소 같은 개인정보는 올리지 마세요. 기도 제목에도 실명이나 병명은 적지 않는 것이 좋아요.',
  '저작권이 있는 찬양 가사, 교재 본문, 이미지·영상은 그대로 올리지 말고 제목과 구할 수 있는 곳만 알려 주세요. 직접 만든 자료는 마음껏 나눠 주세요.',
  '서로를 존중해 주세요. 교회·교단·사람을 비방하는 글은 관리자가 숨기거나 지울 수 있어요.',
  '글은 이 목회 비서에 로그인한 모든 계정에 보이고, 서버 관리자도 볼 수 있어요.',
];
// 전화번호·주민등록번호 꼴이 들어 있으면 올리기 전에 한 번 더 묻는다
const PII = /(01[016789][-\s.]?\d{3,4}[-\s.]?\d{4})|(\d{6}[-\s]?[1-4]\d{6})/;
export const hasPersonalInfo = t => PII.test(String(t || ''));
export const badgeText = n => (n > 99 ? '99+' : String(n));
export function agoText(ms, now = Date.now()) {
  const s = Math.max(0, Math.floor((now - ms) / 1000)); if (s < 60) return '방금'; const m = Math.floor(s / 60); if (m < 60) return `${m}분 전`; const h = Math.floor(m / 60); if (h < 24) return `${h}시간 전`; const d = Math.floor(h / 24); if (d < 7) return `${d}일 전`;
  const dt = new Date(ms + 9 * 3600e3); return `${dt.getUTCMonth() + 1}/${dt.getUTCDate()}`;
}

export function makeCommunity({ $, $$, esc, page, toast, ask, modal, A, UI, api, render }) {
  const S = (UI.comm = UI.comm || { cat: '', items: [], next: 0, admin: false, reports: 0 });
  const here = h => (location.hash || '').startsWith(h);
  const fail = e => toast(e && e.message ? e.message : '문제가 생겼어요. 잠시 뒤에 다시 해 주세요.', true);
  const catTag = c => `<span class="tag ccat">${CAT_ICON[c] || ''} ${esc(c)}</span>`;
  const rules = () => `<details class="guide commguide noprint"><summary>📋 이용 안내</summary><ul class="small">${COMMUNITY_RULES.map(r => `<li>${esc(r)}</li>`).join('')}</ul></details>`;
  const offline = (msg, retry) => `<div class="callout bad"><span>📡</span><div class="sp">${esc(msg)}</div><button class="sm" ${retry}>다시 불러오기</button></div>`;
  const needLogin = () => page('💬', '커뮤니티', '', `<div class="callout"><span>🔐</span><div class="sp">커뮤니티는 <b>로그인한 계정</b>에서만 쓸 수 있어요. 지금은 이 브라우저에만 저장하는 모드라서 열 수 없어요.</div></div>`);

  // ----- 메뉴 알림 배지 -----
  function paintBadge() {
    const a = $('#nav a[data-go="#community"]'); if (!a) return; let b = a.querySelector('.navbadge');
    if (!UI.commUnread) { if (b) b.remove(); return; }
    if (!b) { b = document.createElement('span'); b.className = 'navbadge'; b.setAttribute('aria-label', '새 글·댓글'); a.appendChild(b); } b.textContent = badgeText(UI.commUnread);
  }
  const setUnread = n => { UI.commUnread = n; paintBadge(); };
  let lastPoll = 0;
  async function refreshBadge() {
    if (A.mode !== 'account' || document.visibilityState !== 'visible') return; lastPoll = Date.now();
    try { const r = await api.summary(); S.admin = r.admin; S.reports = r.reports || 0; setUnread(here('#community') || here('#post') ? 0 : r.unread); } catch { /* 오프라인이거나 로그인이 끝났으면 조용히 넘어간다 */ }
  }
  function startBadge() {
    if (A.mode !== 'account') return; setTimeout(refreshBadge, 1500); setInterval(refreshBadge, 3 * 60e3);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Date.now() - lastPoll > 60e3) refreshBadge(); });
  }

  // ----- 글 목록 -----
  const postCard = p => `<a class="cpost${p.pinned ? ' pinned' : ''}${p.hidden ? ' hiddenpost' : ''}" href="#post/${p.id}"><div class="ctop">${p.pinned ? '<span class="tag warn">📌 고정</span>' : ''}${catTag(p.category)}${p.hidden ? '<span class="tag bad">숨김</span>' : ''}<b>${esc(p.title)}</b></div><p class="cprev">${esc(p.preview || '')}</p><div class="cmeta"><span>${esc(p.author)}${p.mine ? ' (나)' : ''}</span><span>${esc(agoText(p.at))}</span><span aria-label="댓글">💬 ${p.comments}</span><span aria-label="도움이 돼요">👍 ${p.likes}</span></div></a>`;
  function drawList() {
    const box = $('#commlist'); if (!box) return;
    box.innerHTML = S.items.length ? S.items.map(postCard).join('') : `<div class="empty"><p><b>아직 글이 없어요.</b></p><p class="mute small">${S.cat ? `‘${esc(S.cat)}’ 분류의 첫 글을 남겨 보세요.` : '첫 글을 남겨 보세요. 만든 활동지나 대본, 궁금한 점 무엇이든 좋아요.'}</p></div>`;
    const more = $('#commmore'); if (more) more.innerHTML = S.next ? '<button data-cm="more">더 보기</button>' : '';
    bindList();
  }
  function bindList() { const m = $('[data-cm=more]'); if (m) m.onclick = () => loadList(false); }
  async function loadList(reset) {
    const box = $('#commlist'); if (!box) return;
    if (reset) { S.items = []; S.next = 0; box.innerHTML = '<p class="mute small">불러오는 중…</p>'; }
    try {
      const r = await api.posts({ category: S.cat, before: reset ? 0 : S.next }); if (!here('#community')) return;
      S.admin = r.admin; S.items = reset ? r.items : [...S.items, ...r.items]; S.next = r.next; drawList();
      if (reset) { api.seen().catch(() => {}); setUnread(0); if (r.admin) loadReports(); }
    } catch (e) { box.innerHTML = offline(e.message, 'data-cm="retry"'); const b = $('[data-cm=retry]'); if (b) b.onclick = () => loadList(true); }
  }
  async function loadReports() {
    const box = $('#commreports'); if (!box) return;
    try {
      const r = await api.reports(); if (!here('#community')) return; S.reports = r.items.length; if (!r.items.length) { box.innerHTML = ''; return; }
      box.innerHTML = `<details class="box reportbox" open><summary><b>🚩 신고된 글·댓글 ${r.items.length}건</b> <span class="mute small">(관리자만 보여요)</span></summary><div class="cardb">${r.items.map(x => `<div class="reportitem"><div><span class="tag ${x.kind === 'post' ? '' : 'warn'}">${x.kind === 'post' ? '글' : '댓글'}</span> ${x.title ? `<b>${esc(x.title)}</b> ` : ''}<span class="mute small">${esc(x.author)} · 신고 ${x.count}건${x.hidden ? ' · 숨김 중' : ''}</span><p class="small" style="margin:4px 0">${esc(x.excerpt)}</p>${x.reasons.length ? `<p class="small mute" style="margin:0">사유: ${x.reasons.map(esc).join(' / ')}</p>` : ''}</div><div class="row"><a class="btnlike sm" href="#post/${x.postId}">보기</a><button class="sm" data-rhide="${x.kind}:${x.id}:${x.hidden ? 0 : 1}">${x.hidden ? '숨김 풀기' : '숨기기'}</button><button class="sm ghost" data-rclear="${x.kind}:${x.id}">신고 지우기</button></div></div>`).join('')}</div></details>`;
      $$('[data-rhide]', box).forEach(b => { b.onclick = async () => { const [k, id, h] = b.dataset.rhide.split(':'); try { await (k === 'post' ? api.hidePost(id, h === '1') : api.hideComment(id, h === '1')); toast(h === '1' ? '숨겼어요.' : '숨김을 풀었어요.'); loadReports(); loadList(true); } catch (e) { fail(e); } }; });
      $$('[data-rclear]', box).forEach(b => { b.onclick = async () => { const [k, id] = b.dataset.rclear.split(':'); try { await api.clearReports(k, id); loadReports(); } catch (e) { fail(e); } }; });
    } catch { /* 신고 목록을 못 불러와도 글 목록은 쓸 수 있다 */ }
  }
  function vCommunity() {
    if (A.mode !== 'account') return needLogin();
    page('💬', '커뮤니티', '같은 목회 비서를 쓰는 선생님·교역자가 자료와 이야기를 나누는 공간이에요.', `<div class="row noprint" style="margin-bottom:10px"><button class="pri" data-cm="new">✏️ 글쓰기</button><button class="ghost" data-cm="refresh">새로 고침</button></div>${rules()}
      <div class="tabs commtabs" role="tablist"><a data-ccat="" class="${S.cat === '' ? 'on' : ''}">전체</a>${COMMUNITY_CATS.map(c => `<a data-ccat="${esc(c)}" class="${S.cat === c ? 'on' : ''}" title="${esc(CAT_HINT[c])}">${CAT_ICON[c]} ${esc(c)}</a>`).join('')}</div>
      <div id="commreports"></div><div id="commlist" aria-live="polite"><p class="mute small">불러오는 중…</p></div><div id="commmore" class="row" style="justify-content:center;margin-top:10px"></div>`);
    $$('[data-ccat]').forEach(a => { a.onclick = () => { S.cat = a.dataset.ccat; $$('[data-ccat]').forEach(x => x.classList.toggle('on', x === a)); loadList(true); }; });
    $('[data-cm=new]').onclick = () => openCompose(null); $('[data-cm=refresh]').onclick = () => { loadList(true); };
    loadList(true);
  }

  // ----- 글 보기 -----
  let cur = null; // { post, comments }
  const commentHtml = (c, admin) => c.hidden && !admin && !c.mine ? '<div class="ccomment hiddenc"><span class="mute small">관리자가 숨긴 댓글이에요.</span></div>'
    : `<div class="ccomment${c.hidden ? ' hiddenc' : ''}" data-cid="${c.id}"><div class="cmeta"><b>${esc(c.author)}${c.mine ? ' (나)' : ''}</b><span>${esc(agoText(c.at))}</span>${c.hidden ? '<span class="tag bad">숨김</span>' : ''}<span class="sp"></span>${c.mine || admin ? `<button class="sm ghost" data-cdel="${c.id}">지우기</button>` : `<button class="sm ghost" data-crep="${c.id}">신고</button>`}${admin ? `<button class="sm ghost" data-chide="${c.id}:${c.hidden ? 0 : 1}">${c.hidden ? '숨김 풀기' : '숨기기'}</button>` : ''}</div><p class="cbody">${esc(c.body)}</p></div>`;
  function drawPost() {
    const box = $('#postbox'); if (!box || !cur) return; const p = cur.post; const admin = !!p.admin;
    box.innerHTML = `<article class="box cfull${p.hidden ? ' hiddenpost' : ''}"><div class="cardb"><div class="ctop">${p.pinned ? '<span class="tag warn">📌 고정</span>' : ''}${catTag(p.category)}${p.hidden ? '<span class="tag bad">숨김</span>' : ''}</div><h2 class="ctitle">${esc(p.title)}</h2><div class="cmeta"><b>${esc(p.author)}${p.mine ? ' (나)' : ''}</b><span>${esc(agoText(p.at))}${p.edited ? ' · 수정됨' : ''}</span></div>${p.hidden ? '<div class="callout warn small"><span>🙈</span><div class="sp">관리자가 이 글을 숨겼어요. 다른 사람에게는 보이지 않아요.</div></div>' : ''}<div class="cbody cfulltext">${esc(p.body)}</div>
      <div class="row noprint" style="margin-top:12px"><button class="${p.liked ? 'pri' : ''}" data-pm="like" aria-pressed="${p.liked}">👍 도움이 돼요 ${p.likes}</button><span class="sp"></span>${p.mine ? '<button data-pm="edit">고치기</button><button class="dng" data-pm="del">지우기</button>' : '<button class="ghost" data-pm="report">🚩 신고</button>'}</div>
      ${admin ? `<div class="row noprint adminrow"><span class="mute small">관리자</span><button class="sm" data-pm="pin">${p.pinned ? '고정 풀기' : '📌 고정'}</button><button class="sm" data-pm="hide">${p.hidden ? '숨김 풀기' : '숨기기'}</button>${p.mine ? '' : '<button class="sm dng" data-pm="del">지우기</button>'}</div>` : ''}</div></article>
      <h3 style="margin:16px 0 8px">댓글 ${cur.comments.filter(c => !c.hidden).length}</h3><div id="ccomments">${cur.comments.length ? cur.comments.map(c => commentHtml(c, admin)).join('') : '<p class="mute small">아직 댓글이 없어요. 첫 댓글을 남겨 보세요.</p>'}</div>
      <form class="cform noprint" id="cform"><label class="f">댓글 쓰기<textarea name="body" rows="3" maxlength="1000" placeholder="따뜻한 말 한마디를 남겨 주세요(1000자까지)" required></textarea></label><div class="row"><button class="pri">댓글 달기</button><span class="mute small" id="ccount2"></span></div></form>`;
    bindPost();
  }
  const run = async (fn, ok) => { try { await fn(); if (ok) toast(ok); } catch (e) { fail(e); } };
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
    page('💬', '커뮤니티', '', `<div class="row noprint" style="margin-bottom:10px"><a class="btnlike" href="#community">◀ 목록</a></div><div id="postbox"><p class="mute small">불러오는 중…</p></div>`);
    api.post(id).then(r => { if (!here('#post/' + id)) return; cur = { post: r.post, comments: r.comments }; drawPost(); setUnread(0); })
      .catch(e => { const box = $('#postbox'); if (box) box.innerHTML = `<div class="callout bad"><span>🙈</span><div class="sp">${esc(e.message)}</div></div>`; });
  }

  // ----- 글쓰기·고치기 -----
  function openCompose(p) {
    const edit = !!p; const admin = S.admin; const cats = COMMUNITY_CATS.filter(c => c !== '공지' || admin || (edit && p.category === '공지'));
    const d = modal(`<form method="dialog" class="dlg wide"><h3>${edit ? '글 고치기' : '✏️ 새 글 쓰기'}</h3>
      <label class="f">분류<select name="category">${cats.map(c => `<option value="${esc(c)}"${(edit ? p.category : '자유') === c ? ' selected' : ''}>${CAT_ICON[c]} ${esc(c)} — ${esc(CAT_HINT[c])}</option>`).join('')}</select></label>
      <label class="f">제목<input name="title" maxlength="60" required value="${esc(edit ? p.title : '')}" placeholder="2~60자"></label>
      <label class="f">내용<textarea name="body" rows="10" maxlength="4000" required placeholder="4000자까지 쓸 수 있어요">${esc(edit ? p.body : '')}</textarea><span class="hint" id="ccount">0/4000</span></label>
      <div class="callout warn small"><span>🔒</span><div class="sp">아이들의 이름·사진·연락처, 저작권이 있는 찬양 가사·교재 본문·이미지는 올리지 마세요. 이 글은 로그인한 모든 계정과 서버 관리자에게 보여요.</div></div>
      <div class="err"></div><div class="dlg-foot"><button type="button" data-x>취소</button><button class="pri">${edit ? '저장' : '올리기'}</button></div></form>`);
    const f = $('form', d); const ta = f.elements.body; const count = () => { $('#ccount', d).textContent = `${ta.value.length}/4000`; }; ta.oninput = count; count();
    $('[data-x]', d).onclick = () => d.close();
    f.onsubmit = async e => {
      e.preventDefault(); const body = { category: f.elements.category.value, title: f.elements.title.value, body: ta.value };
      if (hasPersonalInfo(body.title + '\n' + body.body) && !(await ask('글에 전화번호나 주민등록번호처럼 보이는 숫자가 들어 있어요. 아이들이나 다른 사람의 개인정보라면 지우고 올려 주세요. 그래도 올릴까요?', '올리기'))) return;
      const btn = $('button.pri', d); btn.disabled = true;
      try { if (edit) { await api.update(p.id, body); d.close(); toast('고쳤어요.'); const r = await api.post(p.id); cur = { post: r.post, comments: r.comments }; drawPost(); } else { const r = await api.create(body); d.close(); toast('올렸어요.'); location.hash = `#post/${r.id}`; } }
      catch (er) { btn.disabled = false; $('.err', d).textContent = er.message; }
    };
  }
  return { vCommunity, vPost, refreshBadge, startBadge, paintBadge };
}
