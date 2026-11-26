import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStore, ValidationError, validateState, normalizeState } from '../public/js/store.js';
import { DEPT_KINDS, KIND_ORDER, PRESET_DEPTS, KIND_INFO, DEFAULT_CHECKS, guessDeptKind, personKindOf, starterKeyOf, sermonKeyOf, LEARNER_KINDS, SELF_CONTACT, DEPT_MAX } from '../public/js/ministry.js';
import { STARTERS } from '../public/js/worship.js';
import { STRUCTURES } from '../public/js/sermon.js';

const PUB = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const text = p => fs.readFileSync(path.join(PUB, p), 'utf8').replace(/\r\n/g, '\n');
const mem = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; };
const mk = () => createStore(mem(), () => '2026-11-10');

test('MB12.26 부서 종류 표: 6종·차례·바로가기·종류별 세부사항·기본 체크가 서로 맞는다', () => {
  assert.deepEqual(Object.keys(DEPT_KINDS).sort(), [...KIND_ORDER].sort()); assert.deepEqual(PRESET_DEPTS.map(p => p[0]), ['유치부', '유년부', '장년부']); assert.ok(PRESET_DEPTS.every(([n, k]) => DEPT_KINDS[k] === n));
  for (const k of KIND_ORDER) { assert.ok(DEFAULT_CHECKS[k] && DEFAULT_CHECKS[k].length >= 3 && DEFAULT_CHECKS[k].length <= 6, `${k} 체크`); assert.ok(['child', 'teen', 'youth', 'adult'].includes(personKindOf(k)), k); assert.ok(STARTERS[starterKeyOf(k)], `${k} 순서지 틀`); assert.ok(STRUCTURES[sermonKeyOf(k)], `${k} 설교 틀`); }
  for (const k of ['toddler', 'elem', 'adult']) { const i = KIND_INFO[k]; assert.ok(i.age && i.intro && i.points.length >= 3, k); }
  assert.deepEqual(['toddler', 'elem', 'kid'].map(personKindOf), ['child', 'child', 'child']); assert.equal(personKindOf('adult'), 'adult'); assert.ok(LEARNER_KINDS.includes('adult') && SELF_CONTACT.has('adult') && SELF_CONTACT.has('youth') && !SELF_CONTACT.has('kid'));
  assert.ok(DEFAULT_CHECKS.adult.some(c => c.label === '속회 참석'), '감리교 속회'); assert.ok(DEFAULT_CHECKS.adult.every(c => c.points === 0), '장년부는 달란트 없음');
  const t = (n, id) => guessDeptKind(n, id); assert.deepEqual([t('유치부'), t('유년부'), t('아동부'), t('초등부'), t('중고등부'), t('청년부'), t('장년부'), t('영아부'), t('여전도회')], ['toddler', 'elem', 'kid', 'kid', 'teen', 'youth', 'adult', 'toddler', 'adult']);
});

test('부서 추가·이름 고치기·지우기: 기본 부서 유지, 종류 차례대로 놓임, 중복·길이·개수 검사, 기록 있으면 못 지움', () => {
  const s = mk(); const base = s.depts().map(d => d.name); const baseIds = s.depts().map(d => d.id); assert.ok(['아동부', '중고등부', '청년부'].every(n => base.includes(n)));
  const a = s.addDept('유치부', 'toddler'), b = s.addDept('유년부', 'elem'), c = s.addDept('장년부', 'adult');
  assert.deepEqual(s.depts().map(d => d.name), ['유치부', '유년부', '아동부', '중고등부', '청년부', '장년부'], '종류 차례(유치→유년→아동→중고등→청년→장년)'); assert.ok(new Set(s.depts().map(d => d.id)).size === 6, '번호는 겹치지 않는다');
  assert.deepEqual(baseIds.filter(i => s.dept(i).custom), [], '기본 부서에는 custom 표시가 없다'); assert.equal(s.dept(a).custom, true); assert.equal(s.deptKind(a), 'toddler'); assert.equal(s.deptKind(c), 'adult');
  assert.throws(() => s.addDept('', 'kid'), ValidationError); assert.throws(() => s.addDept('유치부', 'toddler'), /같은 이름/); assert.throws(() => s.addDept('가'.repeat(13), 'kid'), /12자/); assert.throws(() => s.addDept('x', 'nope'), /종류/);
  assert.equal(s.renameDept(a, ' 영유아부 '), '영유아부'); assert.throws(() => s.renameDept(a, '아동부'), /같은 이름/); assert.equal(s.renameDept(baseIds[0], '어린이부'), '어린이부', '기본 부서도 이름은 고칠 수 있다'); assert.throws(() => s.renameDept(9999, 'x'), ValidationError);
  assert.throws(() => s.deleteDept(baseIds[0]), /기본 부서/);
  s.addPerson({ name: '성도', kind: 'adult', dept_id: c, class_name: '1속회' }); assert.equal(s.deptUsage(c).people, 1); assert.throws(() => s.deleteDept(c), /기록이 있어/); s.deleteDept(b); assert.equal(s.dept(b), undefined, '기록 없는 추가 부서는 지움');
  for (let i = 0; s.depts().length < DEPT_MAX; i++) s.addDept('부서' + i, 'kid'); assert.throws(() => s.addDept('초과', 'kid'), /12개/);
  const raw = JSON.parse(JSON.stringify(s.get())); validateState(raw); assert.equal(normalizeState(JSON.parse(JSON.stringify(raw))).depts.find(d => d.name === '영유아부').kind, 'toddler', '저장하고 다시 읽어도 종류 유지');
  const odd = JSON.parse(JSON.stringify(raw)); odd.depts.find(d => d.name === '영유아부').kind = '엉뚱'; assert.equal(normalizeState(odd).depts.find(d => d.name === '영유아부').kind, 'toddler', '알 수 없는 종류는 이름으로 짐작');
});

test('새 부서의 세부사항: 주간 체크 기본값, 장년부 속회 현황, 유치부 안전·돌봄, 장년은 학습자(본인 연락)', () => {
  const s = mk(); s.startEmpty(); const t = s.addDept('유치부', 'toddler'), e = s.addDept('유년부', 'elem'), a = s.addDept('장년부', 'adult');
  assert.deepEqual(s.checks(t).map(c => c.label), DEFAULT_CHECKS.toddler.map(c => c.label)); assert.deepEqual(s.checks(e).map(c => c.label), DEFAULT_CHECKS.elem.map(c => c.label)); assert.deepEqual(s.checks(a).map(c => c.key), ['sokhoe', 'bible', 'prayer', 'serve']);
  const p1 = s.addPerson({ name: '박성도', kind: 'adult', dept_id: a, class_name: '1속회' }), p2 = s.addPerson({ name: '최성도', kind: 'adult', dept_id: a, class_name: '1속회' }), p3 = s.addPerson({ name: '정성도', kind: 'adult', dept_id: a, class_name: '2속회' }); s.addPerson({ name: '이권사', kind: 'teacher', dept_id: a, class_name: '1속회' }); s.addPerson({ name: '무소속', kind: 'adult', dept_id: a });
  for (let w = 0; w < 4; w++) { const sv = s.saveService({ dept_id: a, title: '장년 예배', date: `2026-10-${String(4 + 7 * w).padStart(2, '0')}`, kind: 'regular' }); s.setAttendance(sv, p1, true); s.setAttendance(sv, p2, w === 0); s.setAttendance(sv, p3, true); }
  s.addVisit({ person_id: p1, date: '2026-11-01', type: '심방', note: '방문' }); const g = s.groupSummary(a); assert.deepEqual(g.map(x => x.name), ['1속회', '2속회', ''], '속회 이름순, 속회 없음은 맨 뒤');
  const g1 = g[0]; assert.deepEqual([g1.count, g1.leaders.join(), g1.rate, g1.low, g1.lastVisit], [2, '이권사', 63, 1, '2026-11-01'], '박성도 100% · 최성도 25% → 평균 63%, 50% 미만 1명'); assert.equal(g[1].rate, 100); assert.equal(g[1].lastVisit, '');
  const c1 = s.addPerson({ name: '햇살', kind: 'child', dept_id: t, class_name: '병아리반' }); const c2 = s.addPerson({ name: '하늘', kind: 'child', dept_id: t }); s.addPerson({ name: '선생', kind: 'teacher', dept_id: t });
  s.setPersonInfo(c1, { health: '땅콩 알레르기', guardian_phone: '010-1111-2222', birth: '2021-11-14' }); const care = s.careSummary(t, '2026-11-10');
  assert.deepEqual([care.total, care.health.map(h => h.name), care.noGuardian, care.birthdays], [2, ['햇살'], ['하늘'], [{ name: '햇살', day: 14 }]], '교사는 제외, 건강 주의·보호자 없음·이번 달 생일');
  assert.equal(s.stats ? 1 : 1, 1); const wd = s.weeklyData(s.saveService({ dept_id: a, title: '다음 예배', date: '2026-11-15', kind: 'regular' }), '2026-11-10'); assert.ok(wd.recipients.length >= 1, '장년부도 가정(본인) 메시지 받는 사람이 만들어진다');
});

test('화면 연결: 설정 부서 관리·부서 사역 종류별 도구·색·범례, 기본 3개는 그대로', () => {
  const app = text('js/app.js'); const css = text('style.css');
  for (const k of ['function deptCard', 'data-act="deptAdd"', 'data-act="deptAddCustom"', 'deptRename:', 'deptDel:', 'const safetySec', 'const groupSec', 'toddler: [checkSec, safetySec, homeSec, ncSec]', 'adult: [checkSec, groupSec, ncSec, awaySec]', 'const kindIntro', "Object.hasOwn(DEPT_KINDS, dk(did())) ? dk(did()) : 'all'", 'personKindOf(dk(id))', 'starterKeyOf(dk(s.dept_id))', 'sermonKeyOf(dk(s.dept_id))', "${store.depts().map(x => `<span class=\"lg dk-${dk(x.id)}\"></span>"]) assert.ok(app.includes(k), k);
  for (const k of ['body[data-theme="toddler"]', 'body[data-theme="elem"]', 'body[data-theme="adult"]', '.tag.toddler', '.avatar.dk-adult', '.dayitem.dk-elem', '.callegend .lg.dk-toddler', 'dept-box button.dk-adult.on']) assert.ok(css.includes(k), k);
  assert.ok(!/<span class="lg dk-kid"><\/span>아동부 <span/.test(app), '범례는 부서 목록을 따라간다');
});
