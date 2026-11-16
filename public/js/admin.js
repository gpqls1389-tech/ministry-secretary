// 행정 서식: 교회학교에서 자주 쓰는 서식의 항목 정의와 문서 블록(인쇄·한글 파일 공용) 만들기.
// 항목 구성은 교회 서식 예시(행사 계획·결과 보고, 결산, 연간 계획표)와 개인정보 보호법의 동의 고지 항목을 참고해 정리했다.
// type: text | date | area(여러 줄) | table(cols, widths, rows) | check(items) | note(고정 문구)
export const ADMIN_CATS = [['plan', '계획·보고'], ['event', '행사'], ['money', '재정'], ['people', '사람·돌봄'], ['ops', '운영']];
const T = (k, label, extra = {}) => ({ k, label, type: 'text', ...extra });
const D = (k, label) => ({ k, label, type: 'date' });
const A = (k, label, hint = '') => ({ k, label, type: 'area', hint });
const TB = (k, label, cols, widths, rows = 5) => ({ k, label, type: 'table', cols, widths, rows });
const APPROVE = ['담당', '부장', '교역자'];
export const CONSENT_NOTE = '개인정보 보호법 제15조에 따라 아래 내용을 알려 드립니다. 동의하지 않을 권리가 있으며, 동의하지 않으면 해당 행사·연락 안내를 받기 어려울 수 있습니다. 만 14세 미만은 법정대리인(보호자)이 동의해 주세요(같은 법 제22조의2).';

export const ADMIN_FORMS = [
  { key: 'annual', cat: 'plan', name: '연간 교육 계획서', icon: '📅', use: '새해 사역을 시작하기 전(보통 11~1월) 교육위원회·당회에 내는 부서의 한 해 계획', approve: APPROVE, ctx: 'year',
    fields: [T('year', '연도'), T('dept', '부서'), T('pastor', '담당 교역자'), T('head', '부장'), T('motto', '표어'), T('verse', '주제 성구', { hint: '장·절을 적고 개역개정으로 확인하세요' }),
      A('review', '지난해 평가', '잘된 점, 아쉬운 점, 숫자(출석·행사)'), A('goals', '교육 목표', '3개 안팎으로'), A('focus', '중점 사업', '예: 말씀 암송, 가정 연계, 새친구 정착'),
      T('curriculum', '교육 과정(공과)'), TB('months', '월별 계획', ['월', '교회력·절기', '교육 주제', '행사·사업', '비고'], [8, 20, 24, 36, 12], 12),
      TB('org', '교사 조직·반 편성', ['반', '담임 교사', '인원', '비고'], [20, 30, 15, 35], 6), TB('budget', '예산 계획', ['항목', '금액(원)', '내용'], [30, 20, 50], 8),
      A('expect', '기대 효과·기도 제목')] },
  { key: 'monthly', cat: 'plan', name: '월간 사역 보고서', icon: '🗒️', use: '매달 초 지난달 출석·행사·재정·기도 제목을 교육위원회나 담당 교역자에게 보고', approve: APPROVE, ctx: 'month',
    fields: [T('month', '보고 월'), T('dept', '부서'), T('writer', '작성자'), TB('att', '출석 현황', ['주일', '재적', '출석', '새친구', '비고'], [25, 15, 15, 15, 30], 5),
      TB('events', '행사·사역', ['날짜', '내용', '결과'], [20, 40, 40], 4), TB('money', '재정', ['구분', '금액(원)', '내용'], [20, 25, 55], 4), A('care', '돌봄·심방'), A('next', '다음 달 계획'), A('pray', '기도 제목')] },
  { key: 'meeting', cat: 'plan', name: '교사 회의록', icon: '🧑‍🤝‍🧑', use: '교사 회의·기도회에서 정한 일을 남기고 다음 회의에서 점검', ctx: 'date',
    fields: [D('date', '일시'), T('place', '장소'), T('chair', '사회'), T('writer', '기록'), T('attend', '참석자'), A('agenda', '안건'), A('talk', '논의 내용'), A('decide', '결정 사항'),
      TB('todo', '할 일', ['할 일', '담당', '기한'], [55, 25, 20], 5), A('pray', '기도 제목')] },
  { key: 'eventPlan', cat: 'event', name: '행사 계획서', icon: '🎯', use: '행사 4~6주 전, 목적·일정·역할·예산·안전 대책을 정리해 결재받을 때', approve: APPROVE, ctx: 'event',
    fields: [T('title', '행사명'), T('when', '일시'), T('place', '장소'), T('target', '대상·예상 인원'), T('owner', '책임자'), A('purpose', '목적'),
      TB('schedule', '세부 일정', ['시간', '내용', '담당'], [20, 55, 25], 8), A('roles', '역할 분담'), A('prep', '준비물'),
      TB('budget', '예산', ['항목', '내역', '금액(원)'], [25, 50, 25], 6), A('safety', '안전 대책', '인솔 비율, 비상 연락, 보험, 차량, 응급 처치'), A('expect', '기대 효과')] },
  { key: 'eventReport', cat: 'event', name: '행사 결과 보고서', icon: '📝', use: '행사 뒤 2주 안에 참가 인원·경비·평가를 정리해 보고', approve: APPROVE, ctx: 'event',
    fields: [T('title', '행사명'), T('when', '일시'), T('place', '장소'), T('owner', '책임자'), T('count', '참가 인원'), A('changed', '계획과 달라진 점'),
      TB('money', '소요 경비', ['항목', '금액(원)', '비고'], [40, 25, 35], 6), A('good', '잘된 점'), A('bad', '아쉬운 점'), A('next', '다음에 바꿀 점')] },
  { key: 'consentEvent', cat: 'event', name: '참가 신청서·보호자 동의서', icon: '✍️', use: '외부·숙박 행사, 차량 이동이 있을 때 보호자 동의를 받기', ctx: 'event',
    fields: [T('title', '행사명'), T('when', '일시'), T('place', '장소'), T('fee', '참가비'), { k: 'n1', type: 'note', text: '— 아래는 보호자가 적어 주세요 —' },
      T('child', '참가자 이름'), T('birth', '생년월일'), T('school', '학교·학년'), T('guardian', '보호자 이름(관계)'), T('phone', '보호자 연락처'), T('emergency', '비상 연락처'), A('health', '알레르기·건강상 주의할 점'),
      { k: 'n2', type: 'note', text: CONSENT_NOTE },
      { k: 'agree', label: '동의 항목', type: 'check', items: ['위 행사에 자녀가 참가하는 것에 동의합니다.', '행사 중 응급 상황이 생기면 인솔 교사가 필요한 응급 조치와 병원 이송을 하는 것에 동의합니다.', '개인정보(이름·생년월일·연락처·건강 정보) 수집·이용 — 목적: 행사 운영과 안전 관리 / 보유 기간: 행사 종료 후 1개월', '행사 사진·영상 촬영과 교회 안 게시에 동의합니다(선택).'] },
      { k: 'sign', type: 'note', text: '20    년    월    일          보호자              (서명)' }] },
  { key: 'safety', cat: 'event', name: '행사 안전 점검표', icon: '🦺', use: '행사 1주 전과 당일 아침에 함께 점검', ctx: 'event',
    fields: [T('title', '행사명'), T('when', '일시'), T('checker', '점검자'), { k: 'items', label: '점검 항목', type: 'check', items: ['보호자 동의서와 비상 연락처를 모두 받았다', '알레르기·복용 약이 있는 아이와 담당 교사를 정했다', '인솔 교사 수가 충분하다(아이 수에 맞게)', '구급상자·상비약을 챙겼다', '가까운 병원·응급실 위치를 확인했다', '차량·운전자 보험과 안전벨트를 확인했다', '장소의 비상구·위험한 곳을 미리 살폈다', '날씨(더위·추위·비)에 맞는 준비를 했다', '아이를 보호자에게 넘기는 방법(귀가 확인)을 정했다', '행사 보험(여행자 보험 등) 가입 여부를 확인했다'] }, A('note', '특이 사항')] },
  { key: 'incident', cat: 'event', name: '안전사고 보고서', icon: '🚑', use: '다침·분실 등 사고가 났을 때 당일 기록(보호자 연락과 후속 조치 포함)', approve: APPROVE,
    fields: [T('when', '일시'), T('place', '장소'), T('who', '관련 인원'), T('writer', '작성자'), A('what', '사고 내용(있는 그대로)'), A('first', '응급 조치'), A('family', '보호자 연락(시각·내용)'), A('after', '후속 조치·재발 방지')] },
  { key: 'expense', cat: 'money', name: '지출결의서(예산 청구서)', icon: '🧾', use: '돈을 쓰기 전 청구하거나, 쓴 뒤 영수증을 붙여 정산할 때', approve: APPROVE, ctx: 'none',
    fields: [D('date', '청구일'), T('dept', '부서'), T('who', '청구자'), T('item', '예산 항목'), T('total', '청구 금액(원)'),
      TB('rows', '사용 내역', ['날짜', '내용', '금액(원)', '증빙'], [18, 47, 20, 15], 6), T('account', '받을 방법', { hint: '교회 재정 규정에 따라 적어 주세요' }), A('note', '비고')] },
  { key: 'settle', cat: 'money', name: '결산 보고서', icon: '📊', use: '분기·연말에 부서의 예산 대비 지출을 보고', approve: APPROVE, ctx: 'year',
    fields: [T('period', '기간'), T('dept', '부서'), T('writer', '작성자'), TB('summary', '총괄', ['구분', '금액(원)'], [50, 50], 5), TB('cats', '항목별', ['항목', '예산(원)', '지출(원)', '잔액(원)'], [34, 22, 22, 22], 8), A('note', '설명·특이 사항')] },
  { key: 'privacy', cat: 'people', name: '개인정보 수집·이용 동의서', icon: '🔐', use: '새 학기 등록 때 연락처·보호자 정보를 받기 전에', ctx: 'none',
    fields: [T('church', '교회·부서'), { k: 'n1', type: 'note', text: CONSENT_NOTE },
      TB('table', '수집·이용 내용', ['구분', '내용'], [25, 75], 4), { k: 'agree', label: '동의 여부', type: 'check', items: ['위 개인정보 수집·이용에 동의합니다.', '(선택) 건강 정보(알레르기 등)를 안전 관리 목적으로 수집·이용하는 것에 동의합니다.'] },
      T('child', '학생 이름'), T('guardian', '보호자 이름(관계)'), { k: 'sign', type: 'note', text: '20    년    월    일          서명              (인)' }] },
  { key: 'newcomer', cat: 'people', name: '새친구 등록 카드', icon: '🌱', use: '처음 온 친구를 맞을 때(보호자 동의를 함께 받기)', ctx: 'none',
    fields: [D('date', '처음 온 날'), T('name', '이름'), T('birth', '생년월일'), T('school', '학교·학년'), T('phone', '연락처'), T('guardian', '보호자(관계)'), T('gphone', '보호자 연락처'), T('address', '주소'), T('by', '인도한 사람'),
      A('likes', '좋아하는 것·기도 제목'), { k: 'n1', type: 'note', text: CONSENT_NOTE }, { k: 'agree', label: '동의', type: 'check', items: ['교회학교 연락과 출석 관리를 위한 개인정보 수집·이용에 동의합니다(보유: 졸업·이동 후 1년).'] }] },
  { key: 'visit', cat: 'people', name: '심방 보고서', icon: '🏠', use: '가정·전화 심방 뒤 내용과 후속 연락을 남기기', ctx: 'none',
    fields: [D('date', '일시'), T('who', '대상'), T('how', '방법(방문·전화 등)'), T('by', '심방한 사람'), A('talk', '나눈 이야기'), A('pray', '기도 제목'), A('next', '후속 연락·필요한 도움')] },
  { key: 'teacher', cat: 'people', name: '교사 봉사 신청서', icon: '🙋', use: '새해 교사 모집 때(11~12월)', ctx: 'none',
    fields: [T('name', '이름'), T('phone', '연락처'), T('duty', '직분'), T('want', '희망 부서·반'), A('faith', '신앙 고백·봉사 동기'), A('career', '봉사 경력'), { k: 'agree', label: '약속', type: 'check', items: ['교사 기도회·교육에 성실히 참여하겠습니다.', '아이들의 안전과 개인정보를 소중히 지키겠습니다.'] }, { k: 'sign', type: 'note', text: '20    년    월    일          신청자              (서명)' }] },
  { key: 'facility', cat: 'ops', name: '장소·비품 사용 신청서', icon: '🔑', use: '교회 시설·차량·비품을 빌릴 때', approve: ['신청', '관리 담당'], ctx: 'none',
    fields: [T('who', '신청자(부서)'), T('when', '사용 일시'), T('place', '장소·비품'), T('purpose', '사용 목적'), T('people', '인원'), A('note', '요청 사항'), { k: 'agree', label: '확인', type: 'check', items: ['사용 후 정리·원상 복구하겠습니다.', '파손·분실 시 관리 담당에게 바로 알리겠습니다.'] }] },
];
export const formByKey = k => ADMIN_FORMS.find(f => f.key === k);

// 빈 값: 표는 지정한 줄 수의 빈 칸
export function blankValues(form) { const v = {}; for (const f of form.fields) { if (f.type === 'table') v[f.k] = Array.from({ length: f.rows }, () => f.cols.map(() => '')); else if (f.type === 'check') v[f.k] = []; else if (f.type !== 'note') v[f.k] = ''; } return v; }
export const PRIVACY_ROWS = [['수집·이용 목적', '교회학교 출석·연락 관리, 행사 안내와 안전 관리'], ['수집 항목', '이름, 생년월일, 학교·학년, 연락처, 보호자 이름·연락처, 주소'], ['보유·이용 기간', '졸업·이동 후 1년(또는 동의 철회 시까지)'], ['동의 거부 권리', '동의하지 않을 수 있으며, 이 경우 연락·행사 안내를 받기 어려울 수 있어요']];

// 문서 블록: title / approve(결재) / info(이름표 표) / h / p / table / check
export function formBlocks(form, values = {}, meta = {}) {
  const B = [{ t: 'title', text: meta.title || form.name }]; if (meta.sub) B.push({ t: 'p', text: meta.sub, align: 'right' });
  if (form.approve) B.push({ t: 'approve', cols: form.approve });
  let info = [];
  const flush = () => { if (info.length) { const rows = []; for (let i = 0; i < info.length; i += 2) rows.push([info[i].label, info[i].v, info[i + 1] ? info[i + 1].label : '', info[i + 1] ? info[i + 1].v : '']); B.push({ t: 'info', rows }); info = []; } };
  for (const f of form.fields) {
    const v = values[f.k];
    if (f.type === 'text' || f.type === 'date') { info.push({ label: f.label, v: String(v || '') }); continue; }
    flush();
    if (f.type === 'note') B.push({ t: 'p', text: f.text, small: true });
    else if (f.type === 'area') B.push({ t: 'h', text: f.label }, { t: 'p', text: String(v || ''), box: true });
    else if (f.type === 'table') B.push({ t: 'h', text: f.label }, { t: 'table', head: f.cols, widths: f.widths, rows: (Array.isArray(v) && v.length ? v : blankValues({ fields: [f] })[f.k]).map(r => f.cols.map((_, i) => String((r || [])[i] ?? ''))) });
    else if (f.type === 'check') B.push({ t: 'h', text: f.label }, { t: 'check', items: f.items.map((x, i) => ({ text: x, on: Array.isArray(v) && v.includes(i) })) });
  }
  flush(); return B;
}
// 블록 → 일반 글(미리보기 글자·복사용)
export function blocksText(B) {
  return B.map(b => b.t === 'title' ? `【${b.text}】` : b.t === 'h' ? `\n■ ${b.text}` : b.t === 'p' ? b.text : b.t === 'approve' ? `결재: ${b.cols.join(' / ')}` : b.t === 'info' ? b.rows.map(r => `${r[0]}: ${r[1]}${r[2] ? `    ${r[2]}: ${r[3]}` : ''}`).join('\n') : b.t === 'table' ? [b.head.join(' | '), ...b.rows.filter(r => r.some(Boolean)).map(r => r.join(' | '))].join('\n') : b.t === 'check' ? b.items.map(i => `${i.on ? '■' : '□'} ${i.text}`).join('\n') : '').join('\n');
}
