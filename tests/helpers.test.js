import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore, ValidationError, KEY } from '../public/js/store.js';
import { easterDate, adventStart, seasonTemplates, EVENT_TEMPLATES, GUIDE_STEPS, TIPS } from '../public/js/templates.js';
import { toCsv, csvCell } from '../public/js/csv.js';

const mem = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m }; };
const mk = () => createStore(mem(), () => '2026-11-10');

test('부활절·대림절 날짜 계산', () => {
  assert.equal(easterDate(2025), '2025-04-20'); assert.equal(easterDate(2026), '2026-04-05'); assert.equal(easterDate(2027), '2027-03-28');
  assert.equal(adventStart(2026), '2026-11-29'); assert.equal(adventStart(2025), '2025-11-30'); assert.equal(adventStart(2027), '2027-11-28'); // 2027-12-25는 토요일
  assert.equal(adventStart(2022), '2022-11-27'); // 12/25가 일요일 → 직전 주일은 12/18, 대림절은 11/27
  for (const y of [2025, 2026, 2027, 2028]) assert.equal(new Date(adventStart(y) + 'T00:00:00Z').getUTCDay(), 0, '대림절 시작은 주일');
});

test('절기 예시: 7개, 날짜 유효, 같은 연도에 다시 불러와도 중복 없음, 부서별 독립', () => {
  const s = mk(); s.startEmpty();
  const t = seasonTemplates(2026); assert.equal(t.length, 7); assert.ok(t.every(x => x.start <= x.end));
  assert.equal(t.find(x => x.name === '사순절').start, '2026-02-18'); // 부활절 4/5 − 46일
  assert.equal(t.find(x => x.name === '대림절').end, '2026-12-24');
  assert.equal(s.loadSeasonTemplate(1, 2026), 7); assert.equal(s.loadSeasonTemplate(1, 2026), 0); assert.equal(s.loadSeasonTemplate(2, 2026), 7);
  assert.equal(s.seasons(1, 2026).length, 7);
});

test('월별 주제 예시는 비어 있는 달만 채운다', () => {
  const s = mk(); s.startEmpty(); s.savePlan(1, 2026, '목표', { 1: '내가 쓴 주제' });
  assert.equal(s.loadMonthThemes(1, 2026), 11); const p = s.plan(1, 2026); assert.equal(p.themes[1], '내가 쓴 주제'); assert.equal(p.goal, '목표'); assert.equal(Object.keys(p.themes).length, 12);
  assert.equal(s.loadMonthThemes(1, 2026), 0);
});

test('행사 예시: 준비 업무 마감일은 시작일 기준, 중복 적용 없음, 준비물 추가', () => {
  const s = mk(); s.startEmpty(); const e = s.saveEvent({ dept_id: 1, title: '여름성경학교', start_date: '2026-07-24', end_date: '2026-07-26' });
  const r = s.applyEventTemplate(e, 'vbs'); assert.equal(r.tasks, EVENT_TEMPLATES.vbs.tasks.length); assert.ok(r.supplies > 0);
  const tasks = s.get().tasks.filter(t => t.event_id === e); const first = tasks.find(t => t.title.startsWith('주제·본문')); assert.equal(first.due, '2026-04-25'); // 7/24 − 90일
  assert.equal(tasks.find(t => t.title.startsWith('결산')).due, '2026-07-31'); // 7/24 + 7일
  assert.deepEqual(s.applyEventTemplate(e, 'vbs'), { tasks: 0, supplies: 0 }); assert.equal(s.supplies(e).length, r.supplies);
  assert.throws(() => s.applyEventTemplate(e, 'nope'), ValidationError);
  for (const [k, t] of Object.entries(EVENT_TEMPLATES)) assert.ok(t.tasks.every(x => Number.isInteger(x.offset) && x.title), k);
});

test('시작 체크리스트는 데이터에서 자동 계산', () => {
  const s = mk(); s.startEmpty(); assert.ok(Object.values(s.guideProgress()).every(v => v === false));
  assert.deepEqual(GUIDE_STEPS.map(x => x.key).sort(), Object.keys(s.guideProgress()).sort());
  s.addPerson({ name: '가', dept_id: 1 }); s.markExported(); const g = s.guideProgress(); assert.ok(g.people && g.backup && !g.event);
  assert.equal(s.daysSinceExport(), 0);
});

test('가져오기 검증: 구조가 깨진 파일은 거부하고 현재 데이터는 그대로', () => {
  const s = mk(); const good = JSON.parse(s.exportJson()); const before = s.exportJson();
  const bads = [
    { ...good, transactions: [{ id: 1, dept_id: 1, date: '2026-01-01', kind: 'expense', amount: -5 }] },
    { ...good, events: [{ id: 1, dept_id: 99, title: 'x', start_date: '2026-01-01', end_date: '2026-01-01' }] },
    { ...good, attendance: [{ service_id: 9999, person_id: 1 }] },
    { ...good, nextId: 'x' }, { ...good, plans: [] }, { ...good, supplies: 'x' }, { version: 1 },
  ];
  for (const b of bads) assert.throws(() => s.importJson(JSON.stringify(b)), ValidationError);
  assert.equal(s.exportJson(), before);
  s.importJson(JSON.stringify(good)); assert.equal(s.people().length, good.people.filter(p => p.status === 'active').length);
});

test('MB12.7 읽지 못한 저장값은 절대 덮어쓰지 않고, 저장을 막고, 복구 길을 준다', () => {
  const raw = '{"version":1,"depts":"oops"}'; const st = mem(); st.setItem(KEY, raw); let writes = 0; const set = st.setItem; st.setItem = (k, v) => { writes++; set(k, v); };
  const s = createStore(st, () => '2026-11-10'); const f = s.loadFailure();
  assert.ok(f && /손상/.test(f.message) && f.size === raw.length && f.canSalvage === false); assert.equal(st.getItem(KEY), raw, '원본 그대로'); assert.equal(writes, 0, '아무것도 쓰지 않음');
  assert.throws(() => s.addPerson({ name: '가', dept_id: 1 }), /저장을 멈췄어요/); assert.equal(st.getItem(KEY), raw); assert.equal(s.loadFailureRaw(), raw);
  assert.throws(() => s.openSalvaged(), /자동으로 열 수 없는/); assert.equal(st.getItem(KEY), raw);
  s.recoverStartFresh(); assert.equal(st.getItem(KEY + ':broken'), raw, '새로 시작하기 전에 원본을 한 부 남김'); assert.equal(s.loadFailure(), null); assert.equal(s.get().demo, false); assert.equal(s.people().length, 0);
  s.addPerson({ name: '다시', dept_id: 1 }); // 이제 저장된다
  // 깨진 JSON도 같은 길
  const st2 = mem(); st2.setItem(KEY, '{not json'); const s2 = createStore(st2, () => '2026-11-10'); assert.ok(s2.loadFailure()); assert.equal(st2.getItem(KEY), '{not json');
  // 정상 데이터는 그대로 열리고 loadFailure가 없다
  const st3 = mem(); const ok = createStore(st3, () => '2026-11-10'); assert.equal(ok.loadFailure(), null); const s3 = createStore(st3, () => '2026-11-10'); assert.equal(s3.loadFailure(), null);
});

test('MB12.7 문제가 된 선택 항목만 비우고 열기(실제 학생 기록은 지켜진다)', () => {
  const base = JSON.parse(createStore(mem(), () => '2026-11-10').exportJson()); base.demo = false; base.people.push({ id: 5000, name: '실제 학생', kind: 'child', dept_id: 1, class_name: 'a', birth_year: 2018, status: 'active' });
  base.docs = [{ form: 'annual', values: null }]; base.people[0].info = [1]; const raw = JSON.stringify(base);
  const st = mem(); st.setItem(KEY, raw); const s = createStore(st, () => '2026-11-10'); const f = s.loadFailure(); assert.ok(f.canSalvage); assert.equal(st.getItem(KEY), raw);
  const dropped = s.openSalvaged(); assert.deepEqual(dropped.sort(), ['사람 상세 정보', '행정 문서'].sort());
  assert.ok(s.get().people.some(p => p.name === '실제 학생')); assert.equal(s.get().docs.length, 0); assert.equal(s.loadFailure(), null);
  assert.notEqual(st.getItem(KEY), raw); assert.ok(JSON.parse(st.getItem(KEY)).people.some(p => p.name === '실제 학생'));
  // 필수 목록이 깨졌으면 비우기로 열 수 없다
  const bad = JSON.parse(raw); bad.attendance = 'x'; const st2 = mem(); st2.setItem(KEY, JSON.stringify(bad)); assert.equal(createStore(st2, () => '2026-11-10').loadFailure().canSalvage, false);
});

test('저장 실패는 조용히 넘어가지 않고 알린다', () => {
  const st = mem(); const s = createStore(st, () => '2026-11-10'); st.setItem = () => { throw new Error('quota'); };
  assert.throws(() => s.addPerson({ name: '가', dept_id: 1 }), /저장하지 못했습니다/);
});

test('수정·삭제 보강: 인원 수정, 거래 수정(검증 포함), 예배·행사 삭제', () => {
  const s = mk(); s.startEmpty(); const p = s.addPerson({ name: '가', dept_id: 1, class_name: 'A' }); s.updatePerson(p, { name: '나', kind: 'youth', birth_year: 2001, class_name: 'B' });
  assert.deepEqual([s.person(p).name, s.person(p).kind, s.person(p).class_name, s.person(p).birth_year], ['나', 'youth', 'B', 2001]); assert.throws(() => s.updatePerson(p, { name: ' ' }), ValidationError);
  const t = s.addTransaction({ dept_id: 1, date: '2026-05-01', kind: 'expense', amount: 1000 }); const before = s.get().nextId;
  s.updateTransaction(t, { dept_id: 1, date: '2026-05-02', kind: 'expense', amount: 2500, memo: '수정' });
  const row = s.get().transactions.find(x => x.id === t); assert.equal(row.amount, 2500); assert.equal(s.get().transactions.length, 1); assert.equal(s.get().nextId, before);
  assert.throws(() => s.updateTransaction(t, { dept_id: 1, date: '2026-05-02', kind: 'expense', amount: 0 }), ValidationError); assert.equal(s.get().transactions.find(x => x.id === t).amount, 2500); // 실패 시 원래대로
  const sv = s.saveService({ dept_id: 1, title: '주일', date: '2026-11-01' }); s.setAttendance(sv, p, true); s.deleteService(sv); assert.equal(s.get().attendance.length, 0); assert.equal(s.services().length, 0);
  const e = s.saveEvent({ dept_id: 1, title: 'E', start_date: '2026-08-01', end_date: '2026-08-01' }); s.addSupply(e, '이름표'); s.addTask(e, '일', null); s.deleteEvent(e); assert.equal(s.get().supplies.length, 0); assert.equal(s.get().tasks.length, 0);
});

test('CSV: BOM, 따옴표·줄바꿈 처리, 수식 주입 방지, 숫자는 그대로', () => {
  assert.ok(toCsv([['a']]).startsWith('﻿')); assert.equal(csvCell('a,b'), '"a,b"'); assert.equal(csvCell('He said "hi"'), '"He said ""hi"""'); assert.equal(csvCell('줄\n바꿈'), '"줄\n바꿈"');
  assert.equal(csvCell('=1+1'), "'=1+1"); assert.equal(csvCell('+cmd'), "'+cmd"); assert.equal(csvCell('@x'), "'@x"); assert.equal(csvCell(-1202345), '-1202345'); assert.equal(csvCell(null), '');
});

test('도움말 내용이 모든 화면에 있다', () => { for (const k of ['home', 'plan', 'events', 'event', 'services', 'service', 'people', 'money', 'settings']) assert.ok(TIPS[k] && TIPS[k][0] && TIPS[k][1], k); });

test('MB12.1 묶음 파일 읽기와 교재 이름으로 부서 짐작', async () => {
  const { bundleItems, guessCurriculumDept, BUNDLE_TYPE } = await import('../public/js/curriculum.js');
  const one = { type: 'mokhoe-curriculum', name: 'a', lessons: [] };
  assert.equal(bundleItems(one).length, 1); assert.equal(bundleItems({ type: BUNDLE_TYPE, items: [one, one] }).length, 2);
  assert.throws(() => bundleItems({ type: BUNDLE_TYPE, items: [] })); assert.throws(() => bundleItems({ name: 'x' }));
  const depts = [{ id: 1, name: '유치부', kind: 'kid' }, { id: 4, name: '유년부', kind: 'kid' }, { id: 3, name: '중고등부', kind: 'teen' }, { id: 2, name: '청년부', kind: 'youth' }];
  assert.equal(guessCurriculumDept('히즈쇼 바이블랜드 (미취학, 2년)', depts), 1);
  assert.equal(guessCurriculumDept('히즈쇼 틴즈 (취학, 2년)', depts), 4);
  assert.equal(guessCurriculumDept('히즈쇼 하이틴즈 (청소년, 3년)', depts), 3);
  assert.equal(guessCurriculumDept('무엇', depts), 0);
});

test('MB12.4 연락처 도구: 전화 링크, 가리기, 생일 달', async () => {
  const { telHref, smsHref, maskPhone, birthdayIn, mainPhone } = await import('../public/js/people.js');
  assert.equal(telHref('010-0000-0001, 02-000-0000'), 'tel:01000000001'); assert.equal(smsHref('010 0000 0001'), 'sms:01000000001');
  assert.equal(maskPhone('010-1234-5678'), '010-****-5678'); assert.equal(maskPhone('02-123-4567'), '02-***-4567');
  assert.ok(birthdayIn({ birth: '2018-11-15' }, '2026-11-16')); assert.ok(!birthdayIn({}, '2026-11-16'));
  assert.equal(mainPhone({ guardian_phone: '010-0000-0002' }), '010-0000-0002'); assert.equal(mainPhone(undefined), '');
});

test('MB12.7 기기 임시 보관: 계정별, 손상 무시, 서버와 비교해 되살림·충돌 가름', async () => {
  const { writePending, readPending, clearPending, pendingKey, pendingAction } = await import('../public/js/pending.js');
  const m = new Map(); const ls = { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) };
  assert.equal(readPending(ls, 'a@church.kr'), null); assert.ok(writePending(ls, 'A@Church.kr', '{"x":1}', 7, 1000));
  assert.deepEqual(readPending(ls, 'a@church.kr'), { state: '{\"x\":1}', base: 7, at: 1000 }, '이메일 대소문자 무시');
  assert.equal(readPending(ls, 'b@church.kr'), null, '다른 계정과 섞이지 않음'); assert.equal(pendingKey(' A@Church.kr '), pendingKey('a@church.kr'));
  m.set(pendingKey('a@church.kr'), 'not json'); assert.equal(readPending(ls, 'a@church.kr'), null); m.set(pendingKey('a@church.kr'), JSON.stringify({ state: 5, base: 1, at: 1 })); assert.equal(readPending(ls, 'a@church.kr'), null);
  writePending(ls, 'a@church.kr', 'S1', 7); clearPending(ls, 'a@church.kr'); assert.equal(readPending(ls, 'a@church.kr'), null);
  const full = { getItem: () => null, setItem: () => { throw new Error('quota'); }, removeItem: () => {} }; assert.equal(writePending(full, 'a@b.kr', 'x', 1), false);
  assert.equal(pendingAction(null, { state: 'S', version: 3 }), 'none'); assert.equal(pendingAction({ state: 'S', base: 3, at: 1 }, { state: 'S', version: 4 }), 'none', '서버와 같으면 할 일 없음');
  assert.equal(pendingAction({ state: 'N', base: 3, at: 1 }, { state: 'S', version: 3 }), 'restore'); assert.equal(pendingAction({ state: 'N', base: 3, at: 1 }, { state: 'S', version: 4 }), 'conflict');
});

test('MB12.7 화면 코드 점검: 제목 이중 이스케이프 없음, 주소 없는 링크는 키보드 처리가 있다', async () => {
  const fs = await import('node:fs'); const app = fs.readFileSync(new URL('../public/js/app.js', import.meta.url), 'utf8');
  assert.ok(!/\bpage\([^,\n]+,\s*(esc\(|`[^`\n]*\$\{esc\()/.test(app), 'page()는 제목을 스스로 이스케이프하므로 esc()로 미리 감싸면 &가 &amp;로 보인다');
  assert.ok(app.includes('function a11yPass') && app.includes("el.matches('a:not([href])[tabindex]") && app.includes('a11yPass();'));
  assert.ok(app.includes('A.snapNext = true; store.resetDemo()') && app.includes('A.snapNext = true; store.startEmpty()') && app.includes('A.snapNext = true; store.importJson(txt)'), '비우기·초기화·가져오기는 서버에 이전 상태를 꼭 보관하게 한다');
  assert.ok(app.includes('if (store.loadFailure()) showRecovery(); else render();'));
});

test('MB12.8 날짜 달력: 모달 대화상자 안으로 옮겨 클릭이 닿게 하고, 입력칸 기준 fixed로 놓는다(코드 점검)', async () => {
  const fs = await import('node:fs'); const ui = fs.readFileSync(new URL('../public/js/ui.js', import.meta.url), 'utf8');
  assert.ok(ui.includes("root.tagName === 'DIALOG' && m.parentElement !== root) root.appendChild(m)"), '대화상자 밖에 있는 달력은 모달이 inert로 막아 날짜를 눌러도 반응이 없다');
  assert.ok(ui.includes("position: 'fixed'") && ui.includes('toTop(self.context.mainElement, input)') && ui.includes('place(m, input)'));
  assert.ok(ui.includes("root.addEventListener('scroll'") && ui.includes("root.addEventListener('close'"));
});
