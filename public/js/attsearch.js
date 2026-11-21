// 출석 화면의 이름 검색 계산(화면과 Node 시험이 함께 쓴다).
// 반 거르기는 ‘이 반 명단’, 이름 검색은 ‘지금 보이는 사람’이다. 전원 출석 버튼은 보이는 사람에게만 적용한다.
export const norm = s => String(s ?? '').normalize('NFC').replace(/\s+/g, '').toLowerCase();
export const matchPerson = (p, q) => { const n = norm(q); return !n || norm(p.display).includes(n) || norm(p.name).includes(n); };
export const inClass = (people, cls) => people.filter(p => !cls || p.class_name === cls);
export const visiblePeople = (people, { cls = '', q = '' } = {}) => inClass(people, cls).filter(p => matchPerson(p, q));
// 화면 위의 한 줄 안내: 지금 보이는 범위와 전원 출석이 적용되는 범위
export function scopeText(people, { cls = '', q = '' } = {}) {
  const inScope = inClass(people, cls).length; const vis = visiblePeople(people, { cls, q }).length; const where = cls || '전체 반'; // 반 이름은 ‘해님반’처럼 이미 ‘반’이 붙어 있을 수 있어 그대로 쓴다
  return q.trim() ? `${where} ${inScope}명 중 ‘${q.trim()}’ 검색 ${vis}명이 보입니다. 전원 출석은 보이는 ${vis}명에게만 적용됩니다.`
    : `${where} ${inScope}명이 보입니다. 전원 출석은 이 ${inScope}명에게 적용됩니다.`;
}
