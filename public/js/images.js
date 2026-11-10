// 이미지 관리: 기본 그림은 img/<이름>.svg(직접 만든 것). img/manifest.json에 파일이름을 적으면 그 이미지로 바뀐다.
const DEFAULTS = { logo: 'logo.svg', 'login-hero': 'login-hero.svg', 'empty-schedule': 'empty-schedule.svg', 'empty-tasks': 'empty-tasks.svg', 'empty-people': 'empty-people.svg', 'empty-attendance': 'empty-attendance.svg', 'empty-money': 'empty-money.svg', 'empty-events': 'empty-events.svg' };
const custom = {};

export async function loadImages() {
  try {
    const r = await fetch('img/manifest.json', { cache: 'no-cache' }); if (!r.ok) return;
    const j = await r.json();
    for (const [k, v] of Object.entries(j)) if (!k.startsWith('_') && typeof v === 'string' && /^[\w.-]+\.(svg|png|webp|jpg|jpeg)$/i.test(v)) custom[k] = v; // 안전한 파일 이름만 허용
  } catch { /* 매니페스트가 없거나 깨져도 기본 그림을 쓴다 */ }
}
export const imgSrc = key => (custom[key] ? `img/${custom[key]}` : DEFAULTS[key] ? `img/${DEFAULTS[key]}` : null);
export const hasCustom = key => !!custom[key];

// 빈 화면 제목에 맞는 일러스트 고르기
const EMPTY_BY_WORD = [[/준비/, 'empty-tasks'], [/출석/, 'empty-attendance'], [/명단|인원|사람/, 'empty-people'], [/거래|예산|지출|수입/, 'empty-money'], [/행사/, 'empty-events'], [/일정|예배|절기/, 'empty-schedule']];
export function emptyImgFor(title) { const hit = EMPTY_BY_WORD.find(([re]) => re.test(title)); return imgSrc(hit ? hit[1] : 'empty-schedule'); }

// 행사 배너(행사 상세 맨 위): 이미지가 없으면 색 띠 + 이모지
const BANNERS = { 여름성경학교: ['banner-vbs', '☀️', '#16a34a', '#0f766e'], 겨울성경학교: ['banner-vbs', '❄️', '#0ea5e9', '#2563eb'], 수련회: ['banner-retreat', '🏕️', '#1d4ed8', '#0b3a8f'], 절기행사: ['banner-christmas', '⭐', '#15803d', '#14532d'], '봉사·선교': ['banner-general', '🤝', '#0f766e', '#115e59'], 행사: ['banner-general', '🎉', '#15803d', '#0f5f2e'], 기타: ['banner-general', '📌', '#475569', '#334155'] };
export function bannerFor(type, title, deptId) {
  const [key, em, c1, c2] = BANNERS[type] || BANNERS['행사']; const pair = deptId === 2 ? ['#0075de', '#005bab'] : [c1, c2]; // 청년부는 파랑 계열
  const src = custom[key] ? `img/${custom[key]}` : '';
  return { key, em, c1: pair[0], c2: pair[1], src };
}
