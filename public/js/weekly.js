// 주간 가정 메시지·교사 브리핑 글 만들기(순수 함수: 화면·테스트가 같이 쓴다).
// 대화 질문·가정 미션은 공과 내용을 지어내지 않도록 본문·제목을 넣는 일반 틀만 쓴다.
const md = d => `${Number(d.slice(5, 7))}/${Number(d.slice(8))}`;
const has = (l, k) => l && (l.pick || []).includes(k) && l[k];

export const FAMILY_QUESTIONS = {
  kid: ['오늘(이번 주) 배운 성경 이야기에 누가 나왔는지 말해 줄래?', '그 이야기에서 하나님은 어떤 분이셨을까?', '이번 주에 말씀대로 해 볼 일 한 가지는 뭐가 좋을까?'],
  teen: ['이번 주 본문에서 가장 마음에 남은 구절은 뭐였어?', '그 말씀이 학교나 친구 관계에서는 어떤 뜻일까?', '서로를 위해 기도할 제목을 하나씩 나눠 볼까?'],
  youth: ['이번 주 본문에서 마음에 남은 한 구절은 무엇인가요?', '그 말씀을 이번 주 일상(학교·직장·관계)에서 어떻게 살아 볼까요?', '서로를 위해 기도할 제목을 나눠 주세요.'],
};
export const FAMILY_MISSIONS = {
  kid: l => [l && l.memory ? '암송 말씀을 하루 한 번 함께 소리 내어 말해 보세요.' : '본문을 아이와 함께 소리 내어 읽어 보세요.', '식사 기도나 잠자리 기도 때 이번 주 말씀을 한 줄 넣어 기도해 주세요.'],
  teen: l => ['본문을 하루 한 번 읽고, 저녁에 한 문장씩 나눠 보세요.', l && l.memory ? '암송 말씀을 휴대폰 잠금 화면에 적어 두면 좋아요.' : '이번 주 말씀을 한 문장으로 정리해 보세요.'],
  youth: () => ['본문을 하루 한 번 읽고 짧게 묵상해 보세요.', '소그룹 단체방에 마음에 남은 구절을 나눠 주세요.'],
};

// data: store.weeklyData(), opts: { mode: 'before'|'after', season: '대림절 제1주' 등, name: 받는 사람 이름(선택) }
export function familyMessage(data, { mode = 'before', season = '', name = '' } = {}) {
  const { service: s, dept, kind, next, events } = data; const l = s.lesson; const youth = kind === 'youth';
  const to = name ? (youth ? `${name}님, ` : `${name} 보호자님, `) : '';
  const L = [`[${dept.name} ${youth ? '말씀 나눔' : '가정 안내'}] ${md(s.date)}${season ? ' ' + season : ''}`, ''];
  L.push(`${to}${mode === 'after' ? '오늘 함께 나눈 말씀이에요.' : '이번 주일에 함께 배울 말씀이에요.'}`);
  const scripture = has(l, 'scripture') ? l.scripture : s.scripture;
  if (l && has(l, 'title')) L.push(`· 공과: ${l.title}`); else if (s.sermon_title) L.push(`· 말씀 제목: ${s.sermon_title}`);
  if (scripture) L.push(`· 성경 본문: ${scripture}`);
  if (has(l, 'memory')) L.push(`· 암송 말씀: ${l.memory}`);
  if (mode === 'before' && has(l, 'supplies')) L.push(`· 준비물: ${l.supplies}`);
  L.push('', youth ? '함께 생각해 볼 질문' : '가정에서 이렇게 물어봐 주세요', ...(FAMILY_QUESTIONS[kind] || FAMILY_QUESTIONS.kid).map(q => `· ${q}`));
  L.push('', youth ? '이번 주 실천' : '이번 주 가정 미션', ...(FAMILY_MISSIONS[kind] || FAMILY_MISSIONS.kid)(l).map(q => `· ${q}`));
  if (next && next.lesson && next.lesson.title) L.push('', `다음 주(${md(next.date)}) 공과: ${next.lesson.title}${next.lesson.scripture ? ` (${next.lesson.scripture})` : ''}`);
  if (events.length) L.push('', '알려 드려요', ...events.slice(0, 3).map(e => `· ${md(e.start_date)}${e.end_date !== e.start_date ? '~' + md(e.end_date) : ''} ${e.title.replace(/^\[가상\]\s*/, '')}${e.place ? ` (${e.place})` : ''}`));
  L.push('', '(본문은 개역개정 성경으로 확인해 주세요)');
  return L.join('\n');
}

// 교사 브리핑(복사용 글)
export function briefingText(b, season = '') {
  const s = b.service; const l = s.lesson; const L = [`[${b.dept.name} 교사 브리핑] ${md(s.date)} ${s.time || ''} ${s.place || ''}${season ? ' · ' + season : ''}`.trim(), ''];
  L.push('■ 예배', `· ${s.title}${s.leader ? ' / 인도 ' + s.leader : ''}`); if (s.scripture || s.sermon_title) L.push(`· ${[s.scripture, s.sermon_title].filter(Boolean).join(' / ')}`);
  if (s.order_text) L.push(...s.order_text.split('\n').filter(Boolean).map(x => `  ${x}`));
  if (l) { L.push('', '■ 공과', `· ${l.no ? l.no + '과 ' : ''}${l.title || ''}${l.scripture ? ' (' + l.scripture + ')' : ''}`); if (l.memory) L.push(`· 암송: ${l.memory}`); if (l.activity) L.push(`· 활동: ${l.activity}`); if (l.supplies) L.push(`· 준비물: ${l.supplies}`); }
  else if (s.lesson_hold) L.push('', '■ 공과: 이번 주는 공과 쉼');
  if (b.tasks.length) L.push('', '■ 준비할 일', ...b.tasks.map(k => `· ${k.overdue ? '[지남] ' : ''}${k.due ? md(k.due) + ' ' : ''}${k.title} — ${k.event}${k.assignee ? ' / ' + k.assignee : ''}`));
  if (b.schedules.length) L.push('', '■ 이번 주 모임', ...b.schedules.map(x => `· ${md(x.date)} ${x.time || ''} ${x.title}${x.place ? ' (' + x.place + ')' : ''}`));
  const care = [];
  if (b.lastAtt) care.push(`· 지난 예배(${md(b.lastAtt.date)}) 출석 ${b.lastAtt.present}명`);
  if (b.low.length) care.push(`· 최근 출석이 적은 사람: ${b.low.join(', ')}`);
  if (b.newcomers.length) care.push(`· 새친구·새가족: ${b.newcomers.map(n => `${n.name}${n.next ? '(' + n.next + ')' : ''}`).join(', ')}`);
  if (b.birthdays.length) care.push(`· 이번 주 생일: ${b.birthdays.map(x => `${x.name} ${md(x.date)}`).join(', ')}`);
  if (b.health.length) care.push(...b.health.map(h => `· 건강 주의 ${h.name}: ${h.health}`));
  if (care.length) L.push('', '■ 돌봄 (교사만 보기)', ...care);
  return L.join('\n');
}
