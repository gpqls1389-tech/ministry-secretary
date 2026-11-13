// 부서별 사역 도구의 기준값(아동부·중고등부·청년부). 근거는 README와 화면의 ‘참고한 자료’에 적었다.
// - 아동부: 말씀 암송·성경 읽기·가정 미션을 주마다 체크하고 달란트로 모으는 방식(히즈쇼 교육계획안의 말씀 암송·달란트 잔치·가정미션, Awana의 암송 진도 확인).
// - 중고등부: 큐티 생활화·소그룹 나눔(히즈쇼 하이틴즈 교육계획안), 시험 기간 일정 관리(학교 정기시험 기간에는 행사를 피하도록).
// - 청년부: 새가족 정착 단계(환영 → 새가족 교육 → 소그룹 → 봉사), 군 입대·유학 등 장기 부재 청년과의 정기 연락.

export const DEPT_KINDS = { kid: '아동부', teen: '중고등부', youth: '청년부' };

// 부서 이름으로 종류를 짐작한다(교회마다 이름이 달라 ‘유치부·유년부·초등부’ 등도 아동부로 본다).
export function guessDeptKind(name = '', id = 0) {
  const n = String(name);
  if (/중고등|청소년|중등|고등|학생부|틴/.test(n)) return 'teen';
  if (/청년|대학|young/i.test(n)) return 'youth';
  if (/아동|유치|유년|초등|어린이|영아|유아|키즈|주일학교/.test(n)) return 'kid';
  return id === 1 ? 'kid' : id === 2 ? 'youth' : 'kid';
}

// 주간 체크 항목 기본값. points가 0이면 달란트 없이 체크만 한다. 부서마다 고칠 수 있다.
export const DEFAULT_CHECKS = {
  kid: [{ key: 'memory', label: '말씀 암송', points: 2 }, { key: 'bible', label: '성경 읽기', points: 1 }, { key: 'home', label: '가정 미션', points: 1 }, { key: 'bring', label: '성경책 가져오기', points: 1 }],
  teen: [{ key: 'qt', label: '큐티', points: 0 }, { key: 'share', label: '소그룹 나눔', points: 0 }, { key: 'friend', label: '친구 초대', points: 0 }],
  youth: [{ key: 'group', label: '소그룹 모임', points: 0 }, { key: 'serve', label: '봉사', points: 0 }, { key: 'qt', label: '큐티', points: 0 }],
};
export const MAX_CHECKS = 6;

// 청년부 새가족 정착 단계(교회마다 이름·순서를 다르게 써도 되도록 키만 고정)
export const NEWCOMER_STEPS = [['welcome', '환영 연락'], ['class', '새가족 교육'], ['group', '소그룹 연결'], ['serve', '봉사 연결']];

// 장기 부재(명단에서 잠시 빠지는 청년·학생) 사유와 기본 연락 주기(일)
export const AWAY_REASONS = ['군 복무', '유학·어학연수', '직장·학업으로 타지', '장기 입원·요양', '기타'];
export const AWAY_EVERY = { '군 복무': 30, '유학·어학연수': 30, '직장·학업으로 타지': 30, '장기 입원·요양': 14, '기타': 30 };

export const EXAM_TYPE = '시험 기간';
