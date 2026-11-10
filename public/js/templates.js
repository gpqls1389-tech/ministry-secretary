// 예시(템플릿) 모음. 모두 '출발점'일 뿐이며 교회·부서 사정에 맞게 고쳐 쓰도록 만든 일반적인 항목입니다.
// 성경 본문은 장·절 참조만 적었고, 사용 전에 개역개정 본문을 확인해야 합니다.

export const addDaysStr = (d, n) => { const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
const dow = d => new Date(d + 'T00:00:00Z').getUTCDay();
const ymd = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

// 부활절(그레고리력, 서방교회) — 익명 그레고리 알고리즘
export function easterDate(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return ymd(y, month, day);
}
// 대림절 첫째 주일 = 성탄절(12/25) 앞의 네 번째 주일(11/27~12/3 사이의 주일)
export function adventStart(y) {
  const xmas = ymd(y, 12, 25); const back = dow(xmas) === 0 ? 7 : dow(xmas); // 성탄절 직전 주일
  return addDaysStr(addDaysStr(xmas, -back), -21);
}
const nthSunday = (y, m, n) => { const first = ymd(y, m, 1); const add = (7 - dow(first)) % 7; return addDaysStr(first, add + 7 * (n - 1)); };

export function seasonTemplates(y) {
  const easter = easterDate(y), advent = adventStart(y);
  return [
    { name: '사순절', start: addDaysStr(easter, -46), end: addDaysStr(easter, -1), theme: '고난과 십자가를 기억하며', scripture: '(본문 선택·확인 필요)', plan: '고난 주간 묵상, 절제와 나눔 실천' },
    { name: '부활절', start: easter, end: easter, theme: '다시 사신 예수님', scripture: '마태복음 28장 (본문 확인 필요)', plan: '부활절 연합예배, 부활 이야기 공과, 달걀 나눔' },
    { name: '어린이주일', start: nthSunday(y, 5, 1), end: nthSunday(y, 5, 1), theme: '어린이를 환영하시는 예수님', scripture: '(본문 선택·확인 필요)', plan: '어린이 주일예배, 선물·간식, 보호자 초청 (교회 사정에 맞게 날짜 수정)' },
    { name: '성령강림절', start: addDaysStr(easter, 49), end: addDaysStr(easter, 49), theme: '성령과 함께하는 공동체', scripture: '(본문 선택·확인 필요)', plan: '성령강림절 예배, 전도·나눔 활동' },
    { name: '추수감사절', start: nthSunday(y, 11, 3), end: nthSunday(y, 11, 3), theme: '감사와 나눔', scripture: '(본문 선택·확인 필요)', plan: '감사 편지, 이웃과 나눔 (교회마다 날짜가 달라 수정 필요)' },
    { name: '대림절', start: advent, end: ymd(y, 12, 24), theme: '임마누엘, 하나님이 우리와 함께하심', scripture: '이사야 7:14 (본문 확인 필요)', plan: '4주 대림초 점화, 4주 공과, 성탄 발표회 준비' },
    { name: '성탄절', start: ymd(y, 12, 25), end: ymd(y, 12, 25), theme: '말씀이 사람이 되어 우리 가운데 오심', scripture: '요한복음 1:14 (본문 확인 필요)', plan: '성탄 예배·발표회, 이웃과 나눔(소외된 이웃 방문·후원)' },
  ];
}

export const MONTH_THEMES = ['새해와 새 마음', '사랑', '고난과 부활(사순절)', '부활의 기쁨', '가정과 어린이', '믿음', '여름성경학교', '쉼과 회복', '추수·감사', '말씀과 기도', '감사와 나눔', '임마누엘(대림·성탄)'];

// 행사 예시: offset = 행사 시작일 기준 며칠 전(-)/후(+)
const T = (offset, title, assignee = '') => ({ offset, title, assignee });
export const EVENT_TEMPLATES = {
  vbs: { name: '여름성경학교', type: '여름성경학교', days: 3, purpose: '말씀을 즐겁게 배우고 친구를 초대하는 시간', target: '유치·유년·초등', place: '교육관',
    tasks: [T(-90, '주제·본문·일정 확정(담임목사 협의)'), T(-75, '교사 모집과 역할 배정'), T(-60, '예산안 작성·승인'), T(-45, '장소·시설 사용 신청'), T(-45, '교재·프로그램 준비 시작'), T(-30, '홍보물 제작, 보호자 안내문 발송'), T(-30, '교사 사전 모임(교육·역할 확인)'), T(-21, '참가 신청 접수 시작'), T(-14, '안전 교육·응급 대처 점검, 보호자 동의서 확인'), T(-10, '간식·식사·준비물 구매'), T(-7, '프로그램 리허설, 반 편성 확정'), T(-3, '최종 인원 확인, 이름표 준비'), T(3, '교사 평가 모임'), T(7, '결산·영수증 정리, 결과보고서 작성')],
    supplies: ['이름표', '응급약품 상자', '간식·음료', '교재·만들기 재료', '음향·영상 장비', '상 받는 선물(작은 선물)'] },
  retreat: { name: '수련회', type: '수련회', days: 3, purpose: '말씀과 교제로 공동체를 세우는 시간', target: '', place: '수련원',
    tasks: [T(-90, '장소·숙소 예약'), T(-75, '주제·강사·프로그램 확정'), T(-60, '예산안 작성·승인'), T(-45, '차량 배정·이동 계획'), T(-40, '참가 신청·참가비 접수 시작'), T(-21, '보험 가입·안전 계획 점검'), T(-14, '조·숙소 배정'), T(-7, '최종 인원 확인, 보호자 연락 체계 점검'), T(-3, '준비물·비상 연락망 최종 점검'), T(7, '결산·영수증 정리, 결과보고서 작성')],
    supplies: ['응급약품', '이름표·조 명단', '프로그램 자료', '차량·숙소 배정표', '간식·음료'] },
  christmas: { name: '성탄 발표회', type: '절기행사', days: 1, purpose: '성육신(하나님이 사람이 되어 우리와 함께하심)의 의미를 나누는 시간', target: '', place: '본당',
    tasks: [T(-60, '대본·순서 확정(성탄의 의미가 드러나게)'), T(-45, '배역·역할 배정, 연습 일정 확정'), T(-30, '의상·소품 준비'), T(-21, '초대장·홍보'), T(-14, '리허설(주 1회)'), T(-3, '최종 리허설, 음향·영상 점검'), T(7, '평가 모임, 결산 정리')],
    supplies: ['의상·소품', '대본', '음향·영상 장비', '초대장', '다과'] },
  outing: { name: '가을 소풍·야외 행사', type: '행사', days: 1, purpose: '자연 속에서 함께 놀며 친해지는 시간', target: '', place: '',
    tasks: [T(-30, '장소 답사·예약'), T(-30, '버스 예약'), T(-21, '안전 계획·인솔 교사 배정'), T(-14, '보호자 안내문 발송, 참가 신청'), T(-7, '비상 연락망·응급처치 점검'), T(-3, '간식·도시락 구매, 우천 대비 계획 확정'), T(7, '결산 정리')],
    supplies: ['응급약품', '돗자리', '간식·음료', '쓰레기봉투', '이름표'] },
  general: { name: '일반 행사(기본 틀)', type: '행사', days: 1, purpose: '', target: '', place: '',
    tasks: [T(-30, '목적·일정 확정'), T(-28, '담당자 배정'), T(-21, '예산안 작성'), T(-14, '홍보·안내'), T(-7, '준비물 점검'), T(-1, '최종 확인'), T(7, '결산·평가')],
    supplies: [] },
};
export function eventTaskDue(startDate, offset) { return addDaysStr(startDate, offset); }

export const SERVICE_TEMPLATES = {
  kids: { name: '어린이 예배 (약 45분)', order: '1. 입례·묵상 기도\n2. 찬양\n3. 대표 기도\n4. 성경 봉독\n5. 말씀(설교)\n6. 공과·활동\n7. 감사 헌금\n8. 광고\n9. 축도' },
  youth: { name: '청년 예배 (약 60분)', order: '1. 찬양\n2. 대표 기도\n3. 성경 봉독\n4. 말씀(설교)\n5. 결단 기도\n6. 헌금\n7. 광고·교제\n8. 파송(축도)' },
  special: { name: '특별 예배(절기)', order: '1. 입례\n2. 절기 상징 예식(예: 대림초 점화)\n3. 찬양\n4. 성경 봉독\n5. 말씀\n6. 기도·결단\n7. 헌금(나눔)\n8. 축도' },
};
export const BUDGET_SUGGESTIONS = ['교육비(교재)', '행사비', '간식·다과', '선물·상품', '소모품', '여름성경학교', '수련회', '절기행사', '교사 연수', '기타'];

// 홈의 '처음 시작' 체크리스트
export const GUIDE_STEPS = [
  { key: 'people', title: '인원 명단 등록', hint: '아동·청년·교사를 반(조)과 함께 등록합니다. 여러 명이면 ‘양식으로 한꺼번에 등록’(엑셀 양식)이 빨라요.', go: '#people', btn: '인원 등록하기' },
  { key: 'plan', title: '올해 목표와 월별 주제 적기', hint: '‘예시 넣기’로 월별 주제와 절기를 한 번에 채운 뒤 고쳐 쓰세요.', go: '#plan', btn: '연간 계획 열기' },
  { key: 'event', title: '행사 1개 등록하기', hint: '‘예시로 시작’을 고르면 준비 업무와 마감일이 자동으로 만들어집니다.', go: '#events', btn: '행사 만들기' },
  { key: 'service', title: '예배 회차 만들기', hint: '‘반복’을 매주로 하면 한 해 주일예배를 한 번에 만들 수 있어요. 절기(대림절 제1주 등)는 자동으로 붙어요.', go: '#services', btn: '예배 만들기' },
  { key: 'attendance', title: '출석 한 번 기록하기', hint: '이름을 누르면 바로 저장됩니다. 출석부에서 최근 8회가 한눈에 보입니다.', go: '#services', btn: '출석 기록하기' },
  { key: 'budget', title: '예산 항목 입력하기', hint: '항목별 예산을 넣으면 홈과 회계에서 예산 잔액이 계산됩니다.', go: '#money', btn: '회계 열기' },
  { key: 'backup', title: '백업 파일 내려받기', hint: '설정에서 내보내기를 눌러 안전한 곳에 보관하세요. (영수증 사진은 백업 파일에 들어가지 않아요.)', go: '#settings', btn: '설정 열기' },
];

export const TIPS = {
  home: ['홈 사용법', '이번 주 예배·행사, 기한이 다가오는 준비 업무, 예산 현황이 모입니다. 준비 업무는 체크하면 완료되고, 위의 부서 버튼으로 아동부 / 청년부 / 전체를 바꿔 볼 수 있습니다.'],
  plan: ['일정·계획 사용법', '‘월 달력’과 ‘일정 목록’에는 교사 기도회·회의 같은 일정과 행사를 모아요(주일예배는 ‘예배’ 메뉴에서 관리하고, 달력에서 함께 볼 수도 있어요). 주일에는 교회력(대림절 제1주 등)이 자동으로 표시돼요. ‘연간·절기 계획’에서는 사역 목표, 월별 교육 주제, 절기 계획을 적습니다.'],
  events: ['행사 사용법', '행사를 만들면 일정표·연간 계획·회계에 같은 정보가 함께 쓰입니다. ‘새 행사’에서 ‘예시로 시작’을 고르면 준비 업무와 마감일이 자동으로 채워집니다. 행사를 눌러 준비·참가·결산을 관리하세요.'],
  event: ['행사 화면 사용법', '위에서부터 준비할 일 → 참가 현황 → 결산 순서로 사용합니다. 신청과 실제 참석은 따로 집계되고, 지출을 등록할 때 이 행사를 연결하면 행사 결산과 부서 합계에 한 번씩만 반영됩니다.'],
  services: ['예배 사용법', '예배는 일정과 따로 관리해요. ‘+ 새 예배’에서 ‘반복’을 매주로 하고 종료일을 정하면 주일예배를 한 번에 만들 수 있고, 교회력(절기·주차)은 날짜로 자동 표시돼요. 예배를 눌러 출석을 체크하면 정기예배 출석은 ‘인원·출석’의 출석부에 모입니다.'],
  service: ['출석 체크 사용법', '이름을 누르면 바로 저장되며 같은 회차에서 한 사람은 한 번만 집계됩니다. 반 버튼으로 반별로 보고, ‘보이는 인원 전원 출석’ 후 결석자만 해제하면 빠릅니다.'],
  people: ['인원·출석 사용법', '출석부는 최근 정기예배 8회를 사람별로 보여 줍니다(○ 출석, × 결석, 점은 미기록). 졸업·이동한 사람은 ‘명단 제외’를 쓰면 과거 기록이 그대로 남습니다. 연락처·알레르기 같은 민감 정보는 이 앱에 입력하지 마세요. ‘명단’ 탭의 ‘등록 양식 내려받기’로 엑셀 양식을 받아 한꺼번에 등록할 수 있어요.'],
  money: ['회계 사용법', '예산 항목을 먼저 넣고 지출·수입을 등록합니다. 예산 잔액은 ‘예산 − 지출’, 수입·지출 차액은 ‘수입 − 지출’로 서로 다른 값입니다. 행사 지출은 연결한 행사의 결산에도 함께 보입니다. 거래를 등록할 때 영수증 사진을 붙일 수 있어요(개인정보는 가리고 찍으세요).'],
  assets: ['비품 사용법', '교구·악기·음향 장비·의자처럼 부서에서 쓰는 물품을 적어 두는 곳이에요. 품목을 누르면 수리 내역을 남길 수 있고, 장소·상태로 걸러 볼 수 있어요. 엑셀(CSV)로 내려받거나 인쇄해 점검표로 쓰세요.'],
  asset: ['비품 상세 사용법', '‘+ 추가’로 수리 내역(날짜·내용·수리비)을 남기세요. 수리비를 회계에도 남기려면 회계에서 지출로 따로 등록하세요.'],
  report: ['월 결산 보고서 사용법', '월을 고르면 이달 수입·지출, 예산 항목별 집행, 거래 내역이 자동으로 계산돼요. 영수증이 없는 지출은 따로 알려 줘요. 인쇄하거나 ‘PDF로 저장’으로 보관하고, 서명란에 작성·검토·승인을 받으세요.'],
  settings: ['설정 사용법', '데이터는 이 브라우저(이 기기)에만 저장됩니다. 가끔 ‘내보내기’로 파일을 받아 두고, 기기를 바꿀 때 ‘가져오기’로 옮기세요.'],
};

export const GLOSSARY = [
  ['신청(취소 제외)', '참가를 신청했거나 이미 참석 처리된 사람 수입니다. 취소한 사람은 빠집니다.'],
  ['실제 참석', '‘참석’으로 표시한 사람 수입니다. 신청과 따로 집계됩니다.'],
  ['예산 잔액', '예산 − 지출. 예산이 100만 원이고 40만 원을 썼다면 60만 원입니다.'],
  ['수입·지출 차액', '수입 − 지출. 수입이 60만 원, 지출이 40만 원이면 +20만 원입니다. 예산 잔액과는 다른 값입니다.'],
  ['명단 제외', '졸업·이동한 사람을 현재 명단에서만 빼는 기능입니다. 과거 출석·참가 기록은 지워지지 않습니다.'],
  ['복제', '예배는 순서·담당만 복사하고 출석은 복사하지 않습니다.'],
];
export const FAQ = [
  ['데이터는 어디에 저장되나요?', '지금 쓰는 브라우저에만 저장됩니다(서버로 보내지 않음). 같은 주소라도 다른 기기·다른 브라우저에서는 보이지 않습니다. 그래서 설정의 ‘내보내기’로 백업 파일을 만들어 두세요.'],
  ['기기를 바꾸거나 브라우저 데이터를 지우면요?', '지우기 전에 ‘내보내기’를 해 두었다면 새 기기의 설정 → 가져오기로 되돌릴 수 있습니다. 내보내지 않은 데이터는 복구할 수 없습니다.'],
  ['아이들 연락처나 알레르기 정보는 어떻게 하나요?', '이 앱은 입력받지 않습니다. 꼭 필요한 정보는 교회가 정한 안전한 방법(종이 명단 등)으로 따로 관리하세요.'],
  ['가상 데이터는 어떻게 지우나요?', '설정 → ‘실제 데이터로 시작(비움)’을 누르면 가상 데이터가 모두 지워지고 부서만 남습니다.'],
  ['성경 본문은 앱이 알려 주나요?', '아니요. 본문은 직접 입력하는 칸이며, 예시의 장·절은 참고용입니다. 개역개정 본문을 꼭 확인하세요.'],
  ['휴대폰에서도 쓸 수 있나요?', '네. 화면이 작으면 ‘메뉴’ 버튼으로 메뉴가 펼쳐집니다. 표는 좌우로 밀어서 볼 수 있습니다.'],
];


// ===== 교회력(절기) 자동 계산 =====
// 서구 교회력(그레고리력) 일반 규칙으로 계산한 값입니다. 교단·교회마다 절기 이름이나 주차 세는 방법이 조금 다를 수 있으니 사용 전에 확인하세요.
const dayDiff = (a, b) => Math.round((Date.parse(a + 'T00:00:00Z') - Date.parse(b + 'T00:00:00Z')) / 864e5);
const sundayOnOrBefore = d => addDaysStr(d, -dow(d));
const sundayAfter = d => addDaysStr(d, 7 - dow(d)); // d 다음에 오는 첫 주일(d가 주일이면 일주일 뒤)
const lastSunday = (y, m) => { const last = ymd(y, m, new Date(Date.UTC(y, m, 0)).getUTCDate()); return addDaysStr(last, -dow(last)); };
const COLOR = { 보라: '#6b4fa0', 흰색: '#ffffff', 초록: '#2f8f4e', 빨강: '#c0392b' };
export const LITURGICAL_COLORS = COLOR;

export function churchInfo(ds) {
  const y = Number(ds.slice(0, 4)); const mm = ds.slice(5, 10);
  const mk = (season, label, color, week = 0) => ({ season, label, color, colorHex: COLOR[color], week });
  let info;
  if (mm <= '01-05') { // 지난해 성탄절기에 속하는 1/1~1/5
    const w = Math.floor(dayDiff(ds, sundayOnOrBefore(ymd(y - 1, 12, 25))) / 7) + 1; info = mk('성탄절', `성탄절 제${w}주`, '흰색', w);
  } else {
    const E = easterDate(y), advent = adventStart(y), xmas = ymd(y, 12, 25), ash = addDaysStr(E, -46);
    if (ds >= xmas) { const w = Math.floor(dayDiff(ds, sundayOnOrBefore(xmas)) / 7) + 1; info = ds === xmas ? mk('성탄절', '성탄절(성탄일)', '흰색', 1) : mk('성탄절', `성탄절 제${w}주`, '흰색', w); }
    else if (ds >= advent) { const w = Math.floor(dayDiff(ds, advent) / 7) + 1; info = mk('대림절', `대림절 제${w}주`, '보라', w); }
    else if (ds >= addDaysStr(E, 49)) { // 성령강림절 이후
      const trinity = addDaysStr(E, 56); const king = addDaysStr(advent, -7);
      if (ds === addDaysStr(E, 49)) info = mk('성령강림절', '성령강림절(성령강림주일)', '빨강');
      else if (ds < trinity) info = mk('성령강림절', '성령강림절', '빨강');
      else if (ds >= king) info = mk('성령강림 후', '왕이신 그리스도 주일', '흰색', Math.floor(dayDiff(ds, trinity) / 7) + 1);
      else { const w = Math.floor(dayDiff(ds, trinity) / 7) + 1; info = mk('성령강림 후', `성령강림 후 제${w}주${ds === trinity ? ' (삼위일체주일)' : ''}`, '초록', w); }
    }
    else if (ds >= E) { const w = Math.floor(dayDiff(ds, E) / 7) + 1; info = mk('부활절', ds === E ? '부활절(부활주일)' : `부활절 제${w}주`, '흰색', w); }
    else if (ds >= ash) {
      const first = addDaysStr(E, -42); const palm = addDaysStr(E, -7);
      if (ds >= palm) info = mk('사순절', ds === palm ? '종려주일(고난주간 시작)' : ds === addDaysStr(E, -3) ? '고난주간(성목요일)' : ds === addDaysStr(E, -2) ? '고난주간(성금요일)' : '고난주간', '보라', 6);
      else if (ds < first) info = mk('사순절', ds === ash ? '사순절 시작(재의 수요일)' : '사순절', '보라');
      else { const w = Math.floor(dayDiff(ds, first) / 7) + 1; info = mk('사순절', `사순절 제${w}주`, '보라', w); }
    } else { // 1/6 ~ 재의 수요일 전: 주현절
      const first = sundayAfter('' + y + '-01-06'); const transfig = addDaysStr(E, -49);
      if (ds < first) info = mk('주현절', ds === ymd(y, 1, 6) ? '주현절(주현일)' : '주현절', '흰색');
      else { const w = Math.floor(dayDiff(ds, first) / 7) + 1; info = mk('주현절', `주현절 제${w}주${ds === transfig ? ' (변모주일)' : ''}`, ds === transfig ? '흰색' : '초록', w); }
    }
  }
  // 한국 교회에서 널리 지키는 주일(교회마다 날짜·이름이 다를 수 있음)
  if (dow(ds) === 0) {
    const nth = (m, n) => nthSunday(y, m, n);
    const sp = ds === nth(5, 1) ? '어린이주일' : ds === nth(5, 2) ? '어버이주일' : ds === nth(7, 1) ? '맥추감사주일' : ds === nth(10, 1) ? '세계성찬주일' : ds === lastSunday(y, 10) ? '종교개혁주일' : ds === nth(11, 3) ? '추수감사주일' : '';
    if (sp) info.special = sp;
  }
  return info;
}
export const churchLabel = ds => { const i = churchInfo(ds); return i.special ? `${i.label} · ${i.special}` : i.label; };

// 한 해의 교회력(표시용): 절기 이름과 기간
export function churchYear(y) {
  const E = easterDate(y), advent = adventStart(y), trin = addDaysStr(E, 56);
  return [
    { name: '성탄절기', color: '흰색', start: ymd(y - 1, 12, 25), end: ymd(y, 1, 5), note: '성탄일부터 1/5까지(성탄절 제1~3주)' },
    { name: '주현절', color: '흰색·초록', start: ymd(y, 1, 6), end: addDaysStr(E, -47), note: '1/6 주현일 ~ 재의 수요일 전날' },
    { name: '사순절', color: '보라', start: addDaysStr(E, -46), end: addDaysStr(E, -1), note: '재의 수요일 ~ 고난주간(종려주일 포함)' },
    { name: '부활절', color: '흰색', start: E, end: addDaysStr(E, 48), note: '부활주일부터 50일(성령강림 전날까지)' },
    { name: '성령강림절', color: '빨강', start: addDaysStr(E, 49), end: addDaysStr(E, 55), note: '성령강림주일(부활 후 50일째)' },
    { name: '성령강림 후 주일들', color: '초록', start: trin, end: addDaysStr(advent, -1), note: '삼위일체주일부터 왕이신 그리스도 주일까지' },
    { name: '대림절', color: '보라', start: advent, end: ymd(y, 12, 24), note: '성탄 전 네 주일(대림절 제1~4주)' },
    { name: '성탄절', color: '흰색', start: ymd(y, 12, 25), end: ymd(y, 12, 31), note: '12/25 성탄일부터' },
  ];
}

// ===== 반복 입력 =====
export const REPEAT_RULES = [['none', '한 번만'], ['weekly', '매주(같은 요일)'], ['biweekly', '격주'], ['monthly', '매월(같은 날짜)'], ['monthly-nth', '매월(같은 요일·같은 주차, 예: 둘째 주 화요일)']];
export const MAX_REPEAT = 104; // 한 번에 만들 수 있는 최대 횟수(매주 2년치)
export function repeatDates(start, rule, until) {
  if (!rule || rule === 'none') return [start];
  if (!until || until < start) return [start];
  const out = []; const [y0, m0, d0] = start.split('-').map(Number); const nthIdx = Math.floor((d0 - 1) / 7); const wd = dow(start);
  if (rule === 'weekly' || rule === 'biweekly') { const step = rule === 'weekly' ? 7 : 14; for (let d = start; d <= until && out.length < MAX_REPEAT; d = addDaysStr(d, step)) out.push(d); return out; }
  for (let i = 0; out.length < MAX_REPEAT; i++) {
    const mi = m0 - 1 + i; const y = y0 + Math.floor(mi / 12); const m = (mi % 12) + 1; let d;
    if (rule === 'monthly') { const dim = new Date(Date.UTC(y, m, 0)).getUTCDate(); if (d0 > dim) continue; d = ymd(y, m, d0); }
    else { const first = ymd(y, m, 1); const cand = addDaysStr(first, ((wd - dow(first) + 7) % 7) + 7 * nthIdx); if (cand.slice(0, 7) !== first.slice(0, 7)) continue; d = cand; }
    if (d > until) break; if (d >= start) out.push(d);
  }
  return out;
}

// ===== 일정(교사 기도회·회의 등) =====
export const SCHEDULE_TYPES = ['교사 기도회', '교사 회의', '부서 회의', '교사 연수', '심방·돌봄', '준비 모임', '기타'];

// ===== 심방·돌봄 기록, 비품 =====
export const VISIT_TYPES = ['심방', '전화', '문자·메신저', '가정방문', '면담', '기타'];
export const ASSET_CATEGORIES = ['교구·교재', '악기·음향', '영상·전자기기', '비품·가구', '행사 물품', '기타'];
export const ASSET_STATUS = ['사용 중', '수리 중', '보관', '폐기'];

// ===== 안내 문구(복사해서 단체방·문자에 붙여넣기) =====
const WD = ['일', '월', '화', '수', '목', '금', '토'];
export const fmtDateKo = ds => `${Number(ds.slice(5, 7))}월 ${Number(ds.slice(8, 10))}일(${WD[dow(ds)]})`;
export function fmtTimeKo(t) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t || ''); if (!m) return ''; const h = Number(m[1]), mi = Number(m[2]);
  return `${h < 12 ? '오전' : '오후'} ${h % 12 === 0 ? 12 : h % 12}시${mi ? ` ${mi}분` : ''}`;
}
const sign = o => `${o.church ? o.church + ' ' : ''}${o.dept || ''}`.trim();
const tail = o => [o.contact ? `문의: ${o.contact}` : null, sign(o) ? `- ${sign(o)} -` : null];
const join = lines => lines.filter(l => l !== null && l !== undefined && l !== false).join('\n').replace(/\n{3,}/g, '\n\n').trim(); // null은 빈 항목(줄 자체 생략), ''는 빈 줄
export function eventNotice(e, o = {}) {
  const when = e.end_date && e.end_date !== e.start_date ? `${fmtDateKo(e.start_date)} ~ ${fmtDateKo(e.end_date)}` : fmtDateKo(e.start_date);
  return join([`[${e.title} 안내]`, '', `일시: ${when}`, e.place ? `장소: ${e.place}` : null, e.owner ? `담당: ${e.owner}` : null, o.supplies && o.supplies.length ? `준비물: ${o.supplies.join(', ')}` : null, e.note ? `안내: ${e.note}` : null, '', '궁금하신 점은 편하게 문의해 주세요.', ...tail(o)]);
}
export function serviceNotice(s, o = {}) {
  return join([`[${s.title} 안내]`, '', `일시: ${fmtDateKo(s.date)}${s.time ? ' ' + fmtTimeKo(s.time) : ''}`, o.label ? `절기: ${o.label}` : null, s.place ? `장소: ${s.place}` : null, s.scripture ? `본문: ${s.scripture}` : null, s.sermon_title ? `말씀: ${s.sermon_title}` : null, '', '함께 예배하며 기쁨을 나누어요.', ...tail(o)]);
}
export function weekNotice(items, o = {}) {
  const rows = items.map(i => `• ${fmtDateKo(i.date)}${i.time ? ' ' + fmtTimeKo(i.time) : ''} ${i.title}${i.place ? ` (${i.place})` : ''}`);
  return join(['[이번 주 안내]', '', ...(rows.length ? rows : ['이번 주 예정된 일정이 없습니다.']), '', ...tail(o)]);
}