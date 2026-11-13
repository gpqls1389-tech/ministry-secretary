// 교재(공과) 연간 배치에 쓰는 순수 함수와 교재 ‘틀’ 목록.
// 출판사 교재의 과 제목·본문 목록은 저작권이 있는 내용이라 앱에 넣지 않는다. 대신 공개된 ‘구성(몇 년 주기, 과정당 과 수)’만 틀로 제공하고,
// 각 과의 제목·본문은 교사가 가진 교재 목차를 보고 직접 적거나 붙여 넣는다.

export const LESSON_FIELDS = [['title', '공과 제목'], ['scripture', '성경 본문'], ['memory', '암송 구절'], ['activity', '활동'], ['supplies', '준비물'], ['note', '메모']];
export const LESSON_KEYS = LESSON_FIELDS.map(([k]) => k);
export const FIELD_MAX = { title: 80, scripture: 80, memory: 160, activity: 200, supplies: 160, note: 200 };
export const MAX_LESSONS = 400; // 교재 하나에 담을 수 있는 과(3년 × 약 52주 + 여유)
export const MAX_CURRICULA = 30;

// 넣을 항목 묶음(연간 배치할 때 고르는 값). 주마다 나중에 따로 고칠 수 있다.
export const PICK_PRESETS = {
  basic: { label: '공과 제목·성경 본문', pick: ['title', 'scripture'] },
  verse: { label: '공과 제목·성경 본문·암송 구절', pick: ['title', 'scripture', 'memory'] },
  all: { label: '모든 항목(활동·준비물·메모 포함)', pick: LESSON_KEYS.slice() },
};

// 교재 틀: 공개 자료로 확인한 구성만 적는다. 확인하지 못한 값은 ‘확인 필요’로 남기고, 과 수는 교사가 바꿀 수 있다.
export const CURRICULUM_PRESETS = [
  { key: 'custom', name: '직접 만들기', publisher: '', years: 1, perYear: 52, note: '우리 교회 교재 목차를 보고 과마다 제목·본문을 적으세요.' },
  { key: 'paidion', name: '파이디온 예수빌리지 (과정 1개)', publisher: '파이디온선교회', years: 1, perYear: 24,
    note: '구약1·2·3, 신약1·2·3 과정이 있고 과정마다 24과(유아·유치·유년·초등·청소년부)로 안내돼 있어요. 어느 과정을 몇 학기에 쓸지는 교회에서 정하세요.', source: 'https://paidion-jv.net/composition_e.php' },
  { key: 'hisshow-bibleland', name: '히즈쇼 하나님나라 바이블랜드 (미취학, 2년)', publisher: '히즈쇼', years: 2, perYear: 48,
    note: '1년에 4권, 권마다 3호, 호마다 4주(한 해 48주). 창세기~사도행전을 2년에 걸쳐 차례로 배우고, 성탄절기 권이 해마다 4분기에 있어요. 교육계획안은 매달 다섯째 주일을 복습·특별 프로그램으로 비워요. 교회가 가진 커리큘럼 자료로 목차를 채우세요.', source: 'https://m.hisshow.co.kr/skin-skin6/board/product_people3-1/read.html?board_no=2&no=11689' },
  { key: 'hisshow-teens', name: '히즈쇼 하나님나라 틴즈 (취학, 2년)', publisher: '히즈쇼', years: 2, perYear: 48,
    note: '바이블랜드와 같은 하나님나라 흐름의 취학 아동용 토론식 공과예요. 1년에 4권 × 3호 × 4주(48주). 교회가 가진 커리큘럼 자료로 목차를 채우세요.', source: 'https://m.hisshow.co.kr/skin-skin6/board/product_people3-1/read.html?board_no=2&no=11689' },
  { key: 'hisshow-explore', name: '히즈쇼 하나님나라 성경탐험 (8~13세, 2년)', publisher: '히즈쇼', years: 2, perYear: 48,
    note: '소개 자료 기준 2년 과정, 1년차 1~12호·2년차 13~24호예요. 한 호를 4주로 잡았어요(확인 필요). 교회가 가진 커리큘럼 자료로 목차를 채우세요.', source: 'https://m.hisshow.co.kr/skin-skin6/board/product_people3-1/read.html?board_no=2&no=11689' },
  { key: 'hisshow-jesus', name: '히즈쇼 예수님과 나 (키즈·주니어, 1년)', publisher: '히즈쇼', years: 1, perYear: 48,
    note: '1년 과정, 4권 × 3호 × 4주(48주). 호마다 말씀송(키즈)·챈트(주니어)가 있어요. 교회가 가진 커리큘럼 자료로 목차를 채우세요.', source: 'https://m.hisshow.co.kr/skin-skin6/board/product_people3-1/read.html?board_no=2&no=11689' },
  { key: 'hisshow-hiteens', name: '히즈쇼 하이틴즈 (청소년, 3년)', publisher: '히즈쇼', years: 3, perYear: 52,
    note: '3년 과정, 해마다 4권(교리·생활·성경·비전), 권마다 13주(한 해 52주). 매일 짧은 큐티가 함께 있어요. 교회가 가진 커리큘럼 자료로 목차를 채우세요.', source: 'https://m.hisshow.co.kr/skin-skin6/board/product_people3-1/read.html?board_no=2&no=11689' },
  { key: 'kmc', name: '감리회 교육국 공과', publisher: '기독교대한감리회 교육국', years: 3, perYear: 52,
    note: '감리회 교회학교 규칙 제8조는 ‘교육국이 지정한 교재’를 쓰도록 해요. 몇 년 주기인지, 과 수는 공개 자료로 확인하지 못했어요(확인 필요). 교재 목차를 보고 바꿔 주세요.', source: 'https://law.kmc.or.kr/local-gov-law/2025.html' },
  { key: 'pck-gpls', name: '예장통합 GPLS 공과 (3년 나선형)', publisher: '대한예수교장로회총회 교육자원부', years: 3, perYear: 52,
    note: '판매처 안내에 따르면 2026년부터 유아~중고등부 ‘3년 2회(학기) 나선형’ 커리큘럼이며 2026년 상반기가 1-1이에요. 학기당 과 수는 확인하지 못했어요(확인 필요).', source: 'https://godwithus.co.kr/product/%ED%86%B5%ED%95%A9%EA%B3%B5%EA%B3%BC-2026%EB%85%84-1%ED%95%99%EA%B8%B0-gpls-%EC%9C%A0%EC%95%84%EC%9C%A0%EC%B9%98%EB%B6%80-%EA%B5%90%EC%82%AC%EB%B0%94%EC%9D%B4%EB%B8%94-on/8844/' },
];

const clip = (v, k) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, FIELD_MAX[k] || 80);
export const cleanLesson = (l = {}) => Object.fromEntries(LESSON_KEYS.map(k => [k, clip(l[k], k)]));

// 빈 틀 만들기: years년 × perYear과. 과 번호는 해마다 1부터.
export function blankLessons(years, perYear) {
  const out = []; for (let y = 1; y <= years; y++) for (let n = 1; n <= perYear; n++) out.push({ year: y, no: n, ...cleanLesson() });
  return out.slice(0, MAX_LESSONS);
}

// 목차 붙여 넣기: 한 줄에 한 과. 칸은 탭(엑셀에서 복사) 또는 | 로 나눈다.
// 칸 순서: 과 번호 | 공과 제목 | 성경 본문 | 암송 구절 | 활동 | 준비물. 첫 칸이 숫자가 아니면 제목부터로 본다.
export function parseLessonText(text) {
  const rows = []; let auto = 0;
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim(); if (!line) continue;
    const cells = (line.includes('\t') ? line.split('\t') : line.split('|')).map(c => c.trim());
    let no; const m = /^(\d{1,3})\s*(과|주|주차)?\.?$/.exec(cells[0] || '');
    if (m) { no = Number(m[1]); cells.shift(); } else no = auto + 1;
    auto = no; const [title = '', scripture = '', memory = '', activity = '', supplies = ''] = cells;
    if (!title && !scripture) continue;
    rows.push({ no, ...cleanLesson({ title, scripture, memory, activity, supplies }) });
  }
  return rows;
}

// start부터 until까지의 주일(일요일) 날짜
export function sundaysBetween(start, until) {
  const out = []; let t = new Date(start + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + (7 - t.getUTCDay()) % 7);
  const end = new Date(until + 'T00:00:00Z'); while (t <= end && out.length < 200) { out.push(t.toISOString().slice(0, 10)); t.setUTCDate(t.getUTCDate() + 7); }
  return out;
}

export const lessonLabel = l => (l ? `${l.year > 1 || l.years > 1 ? `${l.year}년차 ` : ''}${l.no}과${l.title ? ' · ' + l.title : ''}` : '');
