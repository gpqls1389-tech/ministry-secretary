// 부서별 사역 도구의 기준값(아동부·중고등부·청년부). 근거는 README와 화면의 ‘참고한 자료’에 적었다.
// - 아동부: 말씀 암송·성경 읽기·가정 미션을 주마다 체크하고 달란트로 모으는 방식(히즈쇼 교육계획안의 말씀 암송·달란트 잔치·가정미션, Awana의 암송 진도 확인).
// - 중고등부: 큐티 생활화·소그룹 나눔(히즈쇼 하이틴즈 교육계획안), 시험 기간 일정 관리(학교 정기시험 기간에는 행사를 피하도록).
// - 청년부: 새가족 정착 단계(환영 → 새가족 교육 → 소그룹 → 봉사), 군 입대·유학 등 장기 부재 청년과의 정기 연락.

// 부서 종류(MB12.26): 기본 3개(아동부·중고등부·청년부)에 설정에서 유치부·유년부·장년부를 더할 수 있다.
export const DEPT_KINDS = { toddler: '유치부', elem: '유년부', kid: '아동부', teen: '중고등부', youth: '청년부', adult: '장년부' };
export const KIND_ORDER = ['toddler', 'elem', 'kid', 'teen', 'youth', 'adult']; // 부서를 더할 때 놓이는 차례(같은 종류는 만든 차례)
export const PRESET_DEPTS = [['유치부', 'toddler'], ['유년부', 'elem'], ['장년부', 'adult']]; // ‘추가할 수 있는 부서’ 바로가기
export const BASE_KINDS = ['kid', 'teen', 'youth'];
export const DEPT_MAX = 12;
// 사람 종류(명단)와의 짝: 유치·유년·아동 → 아동, 장년 → 장년(본인에게 직접 연락)
export const LEARNER_KINDS = ['child', 'teen', 'youth', 'adult'];
export const SELF_CONTACT = new Set(['youth', 'adult']); // 보호자가 아니라 본인에게 연락하는 부서 종류
export const personKindOf = k => ({ toddler: 'child', elem: 'child', kid: 'child', teen: 'teen', youth: 'youth', adult: 'adult' }[k] || 'child');
export const starterKeyOf = k => ({ toddler: 'kid', elem: 'kid', kid: 'kid', teen: 'teen', youth: 'youth', adult: 'youth' }[k] || 'kid'); // 예배 순서지 시작 틀
export const sermonKeyOf = k => ({ toddler: 'short', elem: 'short', kid: 'short', teen: 'short', youth: 'three', adult: 'three' }[k] || 'three');
// 새 부서 종류의 세부사항: 소개·나이대·운영 원칙(일반 원칙이라 교회·교단 지침이 우선) · 부서 사역 화면에 놓일 도구
export const KIND_INFO = {
  toddler: { age: '만 4~7세 안팎', intro: '유치부는 안전과 돌봄이 가장 먼저예요. 보호자 인계와 알레르기·건강 주의를 챙기고, 짧고 반복되는 활동으로 말씀을 만나게 해요.', points: ['한 활동은 10~15분 안쪽으로 짧게, 몸으로 따라 하는 활동을 섞어요.', '아이 수가 많지 않게 반을 나누고, 이동·화장실에는 교사가 함께해요(교회 안전 지침을 따르세요).', '귀가 때는 등록된 보호자에게만 인계하고, 새로 오는 분은 보호자 확인을 거쳐요.', '알레르기·건강 주의는 간식·활동 전에 교사 모두가 확인해요.'] },
  elem: { age: '초등 저학년 안팎', intro: '유년부는 글을 읽기 시작하는 시기라 말씀 암송과 이야기 나누기가 잘 맞아요. 주마다 작은 성취를 격려하고 가정과 이어지게 해요.', points: ['말씀 암송은 한 절씩 짧게, 경쟁보다 격려가 되도록 순위는 보여 주지 않아요.', '공과 이야기 뒤에 대화 질문 한두 개와 가정 미션으로 한 주 동안 이어 가요.', '반 이동·진급은 학년 기준을 정해 두고 ‘반 이동’으로 함께 옮겨요.'] },
  adult: { age: '장년(성인)', intro: '장년부는 속회(구역)를 중심으로 서로를 돌봐요. 속회별 출석 흐름과 마지막 만남을 보고, 오래 만나지 못한 분을 먼저 챙겨요.', points: ['‘반·조’ 칸에 속회(구역) 이름을 쓰면 속회별로 모아 볼 수 있어요.', '새가족은 환영 연락 → 새가족 교육 → 속회 연결 → 봉사 연결 순서로 정착을 돕고, 단계마다 체크해요.', '병환·이사·직장 등으로 오래 못 나오는 분은 ‘장기 부재’로 두고 정기적으로 연락해요.', '연락처는 본인 번호를 쓰고, 화면을 함께 볼 때는 번호를 가려요.'] },
};

// 부서 이름으로 종류를 짐작한다(교회마다 이름이 달라 ‘유치부·유년부·초등부’ 등도 아동부로 본다).
export function guessDeptKind(name = '', id = 0) {
  const n = String(name);
  if (/중고등|청소년|중등|고등|학생부|틴/.test(n)) return 'teen';
  if (/청년|대학|young/i.test(n)) return 'youth';
  if (/장년|성인|노년|장로|권사|여전도|남전도|속회/.test(n)) return 'adult';
  if (/유치|영아|유아|영유아|베이비/.test(n)) return 'toddler';
  if (/유년/.test(n)) return 'elem';
  if (/아동|초등|어린이|키즈|주일학교/.test(n)) return 'kid';
  return id === 1 ? 'kid' : id === 2 ? 'youth' : 'kid';
}

// 주간 체크 항목 기본값. points가 0이면 달란트 없이 체크만 한다. 부서마다 고칠 수 있다.
export const DEFAULT_CHECKS = {
  kid: [{ key: 'memory', label: '말씀 암송', points: 2 }, { key: 'bible', label: '성경 읽기', points: 1 }, { key: 'home', label: '가정 미션', points: 1 }, { key: 'bring', label: '성경책 가져오기', points: 1 }],
  teen: [{ key: 'qt', label: '큐티', points: 0 }, { key: 'share', label: '소그룹 나눔', points: 0 }, { key: 'friend', label: '친구 초대', points: 0 }],
  youth: [{ key: 'group', label: '소그룹 모임', points: 0 }, { key: 'serve', label: '봉사', points: 0 }, { key: 'qt', label: '큐티', points: 0 }],
  toddler: [{ key: 'listen', label: '말씀 이야기 듣기', points: 1 }, { key: 'pray', label: '따라 기도하기', points: 1 }, { key: 'sing', label: '찬양·율동 참여', points: 1 }, { key: 'home', label: '가정 감사 미션', points: 1 }],
  elem: [{ key: 'memory', label: '말씀 암송', points: 2 }, { key: 'bible', label: '성경 읽기', points: 1 }, { key: 'home', label: '가정 미션', points: 1 }, { key: 'bring', label: '성경책 가져오기', points: 1 }],
  adult: [{ key: 'sokhoe', label: '속회 참석', points: 0 }, { key: 'bible', label: '성경 읽기', points: 0 }, { key: 'prayer', label: '기도 모임', points: 0 }, { key: 'serve', label: '봉사', points: 0 }],
};
export const MAX_CHECKS = 6;

// 청년부 새가족 정착 단계(교회마다 이름·순서를 다르게 써도 되도록 키만 고정)
export const NEWCOMER_STEPS = [['welcome', '환영 연락'], ['class', '새가족 교육'], ['group', '소그룹 연결'], ['serve', '봉사 연결']];

// 장기 부재(명단에서 잠시 빠지는 청년·학생) 사유와 기본 연락 주기(일)
export const AWAY_REASONS = ['군 복무', '유학·어학연수', '직장·학업으로 타지', '장기 입원·요양', '기타'];
export const AWAY_EVERY = { '군 복무': 30, '유학·어학연수': 30, '직장·학업으로 타지': 30, '장기 입원·요양': 14, '기타': 30 };

export const EXAM_TYPE = '시험 기간';
