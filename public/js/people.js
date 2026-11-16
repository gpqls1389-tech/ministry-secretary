// 사람별 상세 정보(연락처·주소·보호자·건강 메모 등). 모두 선택 입력이고, 계정 서버(또는 이 브라우저)에만 저장된다.
// group: 화면에서 묶는 제목, max: 글자 수, type: tel(전화) / date / text / area(여러 줄)
export const INFO_FIELDS = [
  { k: 'phone', label: '휴대폰', group: '연락처', type: 'tel', max: 20 },
  { k: 'email', label: '이메일', group: '연락처', type: 'email', max: 80 },
  { k: 'address', label: '주소', group: '연락처', type: 'text', max: 120 },
  { k: 'birth', label: '생일', group: '기본', type: 'date', max: 10 },
  { k: 'school', label: '학교·학년 (또는 직장)', group: '기본', type: 'text', max: 40 },
  { k: 'role', label: '직분·맡은 일', group: '기본', type: 'text', max: 40 },
  { k: 'family', label: '가족·교회 등록 가족', group: '기본', type: 'text', max: 80 },
  { k: 'baptism', label: '세례·입교', group: '기본', type: 'text', max: 40 },
  { k: 'guardian', label: '보호자 이름', group: '보호자', type: 'text', max: 20 },
  { k: 'guardian_rel', label: '관계', group: '보호자', type: 'text', max: 10 },
  { k: 'guardian_phone', label: '보호자 연락처', group: '보호자', type: 'tel', max: 20 },
  { k: 'guardian2_phone', label: '비상 연락처(다른 보호자)', group: '보호자', type: 'tel', max: 40 },
  { k: 'health', label: '알레르기·건강 주의', group: '돌봄', type: 'area', max: 200, sensitive: true },
  { k: 'care', label: '돌봄 메모(가정 사정 등)', group: '돌봄', type: 'area', max: 300, sensitive: true },
  { k: 'consent', label: '개인정보 수집 동의', group: '동의', type: 'text', max: 60, hint: '예: 2026-03-01 보호자 서면 동의(교육부 보관)' },
];
export const INFO_KEYS = INFO_FIELDS.map(f => f.k);
const TEL = /^[0-9+\-() ,/]*$/;
// 저장 전에 다듬는다: 모르는 칸은 버리고, 글자 수를 자르고, 전화·날짜 형식을 확인한다(틀리면 오류 문장을 던짐)
export function cleanInfo(info = {}, onError = m => { throw new Error(m); }) {
  const out = {};
  for (const f of INFO_FIELDS) {
    const v = String(info[f.k] ?? '').trim().slice(0, f.max); if (!v) continue;
    if (f.type === 'tel' && !TEL.test(v)) onError(`${f.label}에는 숫자와 - 만 적어 주세요.`);
    if (f.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(v)) onError(`${f.label}은 YYYY-MM-DD 형식으로 적어 주세요.`);
    if (f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) onError(`${f.label} 형식이 올바르지 않아요.`);
    out[f.k] = v;
  }
  return out;
}
export const telHref = v => 'tel:' + String(v || '').split(/[,/]/)[0].replace(/[^0-9+]/g, '');
export const smsHref = v => 'sms:' + String(v || '').split(/[,/]/)[0].replace(/[^0-9+]/g, '');
export const mainPhone = info => (info && (info.phone || info.guardian_phone)) || '';
// 화면을 함께 볼 때(빔 프로젝터 등) 가리기: 010-1234-5678 → 010-****-5678
export const maskPhone = v => String(v || '').replace(/(\d{2,3})[- ]?(\d{3,4})[- ]?(\d{4})/, (m, a, b, c) => `${a}-${'*'.repeat(b.length)}-${c}`);
// 이번 달(또는 주어진 날짜의 달) 생일
export const birthdayIn = (info, ym) => !!(info && info.birth && info.birth.slice(5, 7) === ym.slice(5, 7));
