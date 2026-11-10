// 가상(예제) 데이터. 실제 인물·계좌·영수증과 무관합니다. 날짜는 오늘 기준으로 만들어 첫 화면에 이번 주 일정이 보입니다.
const addDays = (d, n) => { const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };

export function makeSeed(today) {
  const year = Number(today.slice(0, 4));
  const dow = new Date(today + 'T00:00:00Z').getUTCDay(); const sunday = addDays(today, (7 - dow) % 7); // 이번 주 일요일(오늘이 일요일이면 오늘)
  const S = { version: 1, demo: true, nextId: 1000, depts: [{ id: 1, name: '아동부' }, { id: 2, name: '청년부' }], people: [], events: [], tasks: [], participants: [], services: [], attendance: [], budgets: [], transactions: [], plans: {}, seasons: [], schedules: [] };
  let pid = 1; const P = (name, kind, dept, cls, by) => { S.people.push({ id: pid, name, kind, dept_id: dept, class_name: cls, birth_year: by || null, status: 'active' }); return pid++; };
  const kids = [P('가온', 'child', 1, '해님반', 2018), P('나래', 'child', 1, '해님반', 2018), P('다온', 'child', 1, '달님반', 2016), P('라온', 'child', 1, '달님반', 2016), P('마루', 'child', 1, '별님반', 2014), P('하늬', 'child', 1, '별님반', 2014), P('하늬', 'child', 1, '별님반', 2015)];
  P('김교사(가상)', 'teacher', 1, '해님반');
  const yth = [P('청년 A', 'youth', 2, '1조', 2001), P('청년 B', 'youth', 2, '1조', 2002), P('청년 C', 'youth', 2, '2조', 2000), P('청년 D', 'youth', 2, '2조', 1999)];
  // 정기예배: 지난 7주 + 이번 주
  let sid = 1; const sv = (dept, title, date, sermon, scripture) => { S.services.push({ id: sid, dept_id: dept, title, date, time: dept === 1 ? '11:00' : '14:00', place: dept === 1 ? '교육관' : '본당', scripture, sermon_title: sermon, leader: dept === 1 ? '담당 교역자' : '청년부 담당', order_text: '묵상기도 · 찬양 · 말씀 · 헌금 · 축도', kind: 'regular' }); return sid++; };
  const titles = ['선한 목자', '작은 것의 소중함', '함께하는 기쁨', '용서', '감사', '기도', '순종', '이번 주 말씀'];
  const kidSvc = [], ythSvc = [];
  for (let i = 7; i >= 0; i--) { kidSvc.push(sv(1, '어린이 주일예배', addDays(sunday, -7 * i), `[가상] ${titles[7 - i]}`, '(본문 입력)')); ythSvc.push(sv(2, '청년 주일예배', addDays(sunday, -7 * i), `[가상] ${titles[7 - i]}`, '(본문 입력)')); }
  // 출석(마지막 회차는 비워 둬서 출석 체크를 직접 해볼 수 있음)
  const att = (svcId, ids, absent = []) => { ids.forEach(id => S.attendance.push({ service_id: svcId, person_id: id, present: !absent.includes(id), class_at: S.people.find(p => p.id === id).class_name, dept_at: S.people.find(p => p.id === id).dept_id })); };
  kidSvc.slice(0, 7).forEach((s, i) => att(s, kids, [kids[(i * 2) % 7], kids[(i * 3 + 1) % 7]].slice(0, i % 3)));
  ythSvc.slice(0, 7).forEach((s, i) => att(s, yth, i % 2 ? [yth[i % 4]] : []));
  // 행사
  let eid = 1; const E = (o) => { S.events.push({ id: eid, status: 'planned', target_count: 0, place: '', owner: '', note: '', type: '행사', ...o }); return eid++; };
  const e1 = E({ dept_id: 1, title: '[가상] 어린이 가을 소풍', type: '절기행사', start_date: addDays(sunday, -1), end_date: addDays(sunday, -1), place: '근린공원', owner: '아동부 전도사', target_count: 30, expected_budget: 600000 });
  const e2 = E({ dept_id: 2, title: '[가상] 청년부 수련회', type: '수련회', start_date: addDays(sunday, 21), end_date: addDays(sunday, 23), place: '수련원', owner: '청년부 담당', target_count: 20, expected_budget: 2000000 });
  const e3 = E({ dept_id: 1, title: '[가상] 여름성경학교', type: '여름성경학교', start_date: `${year}-07-24`, end_date: `${year}-07-26`, place: '교육관', owner: '아동부 전도사', target_count: 40, expected_budget: 1500000, status: 'done' });
  const e4 = E({ dept_id: 1, title: '[가상] 성탄 발표회', type: '절기행사', start_date: `${year}-12-20`, end_date: `${year}-12-20`, place: '본당', owner: '아동부 전도사', target_count: 40, expected_budget: 500000 });
  let tid = 1; const T = (event_id, title, due, assignee, status = 'todo') => S.tasks.push({ id: tid++, event_id, title, due, assignee, status });
  T(e1, '장소 사용 허락', addDays(today, -3), '총무', 'done'); T(e1, '간식 구매', addDays(today, 0), '총무'); T(e1, '안전 교육·보호자 동의서 확인', addDays(today, 1), '교사'); T(e1, '버스 예약', addDays(today, -1), '부장');
  T(e2, '숙소 예약', addDays(today, 7), '총무'); T(e2, '차량 배정', addDays(today, 10), '총무'); T(e2, '프로그램 확정', addDays(today, 5), '담당자');
  T(e3, '교사 모집', `${year}-06-15`, '부장', 'done'); T(e4, '대본 확정', addDays(today, 14), '담당 교사'); T(e4, '리허설 일정 조율', addDays(today, 20), '담당 교사');
  const part = (e, ids, status) => ids.forEach(id => S.participants.push({ event_id: e, person_id: id, status, first_time: false }));
  part(e1, kids.slice(0, 5), 'attended'); part(e1, [kids[5]], 'cancelled'); part(e1, [kids[6]], 'applied');
  const nc = pid++; S.people.push({ id: nc, name: '새친구(가상)', kind: 'child', dept_id: 1, class_name: '달님반', birth_year: 2017, status: 'active' }); S.participants.push({ event_id: e1, person_id: nc, status: 'attended', first_time: true });
  part(e3, kids, 'attended'); part(e2, yth, 'applied'); part(e4, kids, 'applied');
  // 예산·거래 (금액은 모두 가상)
  let bid = 1; const B = (dept_id, category, amount) => S.budgets.push({ id: bid++, dept_id, year, category, amount });
  B(1, '여름성경학교', 1500000); B(1, '교육비', 800000); B(1, '절기행사', 1100000); B(2, '수련회', 2000000); B(2, '교육비', 500000);
  let xid = 1; const X = (dept_id, date, kind, amount, category, memo, event_id = null) => S.transactions.push({ id: xid++, dept_id, date, kind, amount, category, memo, event_id, voided: false });
  X(1, `${year}-07-20`, 'expense', 320000, '여름성경학교', '[가상] 간식', e3); X(1, `${year}-07-24`, 'expense', 450000, '여름성경학교', '[가상] 재료비', e3); X(1, `${year}-07-24`, 'income', 200000, '여름성경학교', '[가상] 참가비', e3);
  X(1, `${year}-03-10`, 'expense', 80000, '교육비', '[가상] 공과 교재'); X(1, `${year}-05-05`, 'expense', 120000, '교육비', '[가상] 어린이날 선물');
  X(1, addDays(sunday, -1), 'expense', 210000, '절기행사', '[가상] 소풍 간식·음료', e1); X(1, addDays(sunday, -1), 'expense', 150000, '절기행사', '[가상] 버스 대절 계약금', e1); X(1, addDays(sunday, -1), 'income', 100000, '절기행사', '[가상] 참가비', e1);
  X(2, `${year}-02-14`, 'expense', 60000, '교육비', '[가상] 교재'); X(2, `${year}-05-20`, 'income', 300000, '수련회', '[가상] 수련회 적립'); X(2, `${year}-06-30`, 'expense', 400000, '수련회', '[가상] 숙소 계약금', e2);
  // 일정(교사 기도회·회의): 예배·행사와 별도로 관리
  let scid = 1; const SC = (dept_id, title, type, date, time, place) => S.schedules.push({ id: scid++, dept_id, title, type, date, time, place, note: '' });
  for (let i = 0; i < 6; i++) SC(1, '교사 기도회', '교사 기도회', addDays(sunday, -4 + 7 * i), '10:30', '교육관');
  SC(1, '[가상] 아동부 교사 회의', '교사 회의', addDays(sunday, 9), '13:00', '교육관'); SC(2, '[가상] 청년부 임원 회의', '부서 회의', addDays(sunday, 11), '20:00', '온라인');
  // 계획
  S.plans[`1-${year}`] = { goal: '[가상] 말씀 안에서 함께 자라는 어린이', themes: { 1: '새해와 새 마음', 3: '고난과 부활', 5: '가정', 7: '여름성경학교', 10: '감사', 12: '임마누엘(성탄)' } };
  S.plans[`2-${year}`] = { goal: '[가상] 삶으로 예배하는 청년 공동체', themes: { 1: '새해 비전', 8: '수련회', 11: '감사' } };
  let sid2 = 1; S.seasons.push({ id: sid2++, dept_id: 1, year, name: '대림절', start: `${year}-11-29`, end: `${year}-12-24`, theme: '임마누엘', scripture: '이사야 7:14 (본문 확인 필요)', plan: '대림초 점화, 4주 공과' });
  S.seasons.push({ id: sid2++, dept_id: 1, year, name: '성탄절', start: `${year}-12-25`, end: `${year}-12-25`, theme: '말씀이 육신이 되어', scripture: '요한복음 1:14 (본문 확인 필요)', plan: '성탄 발표회, 나눔' });
  S.nextId = 1000; return S;
}
