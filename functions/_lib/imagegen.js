// AI 이미지 만들기(OpenAI 이미지 생성 API 연동). 로그인한 사용자가 서버(Pages Function)를 거쳐서만 호출합니다.
// - API 키는 서버 비밀 변수 OPENAI_API_KEY 에만 있고 브라우저로 나가지 않습니다.
// - 만든 이미지는 서버에 저장하지 않고 그 자리에서 돌려줍니다(사용자가 내려받아 쓰기).
// - 비용·남용을 막으려고 사용자별 하루 한도(IMAGE_DAILY_LIMIT, 기본 8)와 전체 하루 한도(IMAGE_DAILY_TOTAL, 기본 40)가 있습니다.
// - 선택 설정: OPENAI_IMAGE_MODEL(기본값 아래 DEFAULT_MODEL), IMAGE_ALLOWED_EMAILS(쉼표로 구분한 이메일만 허용).
// 요청 형식은 OpenAI 공식 문서(https://developers.openai.com/api/docs/guides/image-generation)의 Image API 설명을 따랐습니다: POST /v1/images/generations, 응답 data[0].b64_json.
export const DEFAULT_MODEL = 'gpt-image-2.5-flare';
export const ENDPOINT = 'https://api.openai.com/v1/images/generations';
export const IMAGE_KINDS = {
  banner: { label: '행사 배너(가로)', size: '1536x1024' },
  hero: { label: '로그인 큰 그림(가로)', size: '1536x1024' },
  season: { label: '절기 그림(가로)', size: '1536x1024' },
  empty: { label: '빈 화면 일러스트(정사각)', size: '1024x1024' },
  avatar: { label: '아바타(정사각)', size: '1024x1024' },
  free: { label: '자유(크기 선택)', size: null },
};
export const IMAGE_SIZES = ['1024x1024', '1536x1024', '1024x1536'];
export const IMAGE_QUALITIES = ['low', 'medium'];
export const PROMPT_MIN = 5, PROMPT_MAX = 500;
const DAY = 24 * 3600e3;

// 모든 요청 앞에 붙는 안전 지침(교회학교 앱에 맞는 그림체, 글자·실존 인물·유명 캐릭터 금지).
const STYLE = 'Warm, simple flat illustration for a Korean church-school teachers\' app. Soft friendly colors (green and warm yellow), rounded shapes, clean composition, welcoming for children and families. '
  + 'Do NOT put any text, letters, numbers, logos or watermarks in the image. Do NOT depict real people, celebrities, famous cartoon characters, brands, or imitate a specific artist\'s style. Keep faces simple and stylized, not photorealistic. ';
export const buildPrompt = text => `${STYLE}Request: ${String(text).trim()}`;

const intOr = (v, d, lo, hi) => { const n = Number(v); return Number.isInteger(n) && n >= lo && n <= hi ? n : d; };
export function imageConfig(env) {
  return { limit: intOr(env.IMAGE_DAILY_LIMIT, 8, 1, 200), total: intOr(env.IMAGE_DAILY_TOTAL, 40, 1, 2000), model: String(env.OPENAI_IMAGE_MODEL || DEFAULT_MODEL).slice(0, 60),
    allowed: String(env.IMAGE_ALLOWED_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean) };
}
export const emailAllowed = (cfg, email) => !cfg.allowed.length || cfg.allowed.includes(String(email || '').toLowerCase());

// 업스트림 응답에서 이미지 바이트의 종류를 알아낸다(앞부분 바이트로 판별).
export function sniffMime(b64) {
  try { const u = Uint8Array.from(atob(b64.slice(0, 24)), c => c.charCodeAt(0));
    if (u[0] === 0x89 && u[1] === 0x50 && u[2] === 0x4E && u[3] === 0x47) return 'image/png';
    if (u[0] === 0xFF && u[1] === 0xD8 && u[2] === 0xFF) return 'image/jpeg';
    if (u[0] === 0x52 && u[1] === 0x49 && u[2] === 0x46 && u[3] === 0x46) return 'image/webp';
  } catch (e) { /* 아래에서 null */ }
  return null;
}

// OpenAI 호출. 실패는 { status, message } 형태의 오류로 던진다(업스트림 응답 원문은 그대로 전달하지 않는다).
export async function callOpenAI({ env, cfg, prompt, size, quality, safetyId, fetchFn }) {
  const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 85000);
  let res;
  try {
    res = await fetchFn(ENDPOINT, { method: 'POST', signal: ctl.signal, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: cfg.model, prompt: buildPrompt(prompt), size, quality, n: 1, safety_identifier: safetyId }) });
  } catch (e) {
    throw Object.assign(new Error(e && e.name === 'AbortError' ? '이미지를 만드는 데 시간이 너무 오래 걸렸어요. 잠시 뒤 다시 해 보세요.' : '이미지 서비스에 연결하지 못했어요.'), { status: e && e.name === 'AbortError' ? 504 : 502 });
  } finally { clearTimeout(timer); }
  let j = null; try { j = await res.json(); } catch (e) { j = null; }
  if (!res.ok) {
    const code = String((j && j.error && (j.error.code || j.error.type)) || ''); const msg = String((j && j.error && j.error.message) || '');
    if (res.status === 400 && /safety|moderation|content_policy|policy|safe/i.test(code + ' ' + msg)) throw Object.assign(new Error('이 설명으로는 만들 수 없어요(안전 정책). 다른 표현으로 써 보세요.'), { status: 422 });
    if (res.status === 401 || res.status === 403) throw Object.assign(new Error('이미지 서비스 인증에 문제가 있어요. 관리자에게 알려 주세요(API 키·조직 인증 확인).'), { status: 502 });
    if (res.status === 429) throw Object.assign(new Error('이미지 서비스가 바쁘거나 사용 한도에 걸렸어요. 잠시 뒤 다시 해 보세요.'), { status: 503 });
    throw Object.assign(new Error('이미지를 만들지 못했어요. 잠시 뒤 다시 해 보세요.'), { status: 502 });
  }
  const b64 = j && j.data && j.data[0] && j.data[0].b64_json;
  if (typeof b64 !== 'string' || b64.length < 100 || b64.length > 12_000_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) throw Object.assign(new Error('이미지를 받지 못했어요. 잠시 뒤 다시 해 보세요.'), { status: 502 });
  const mime = sniffMime(b64); if (!mime) throw Object.assign(new Error('받은 이미지 형식을 알 수 없어요.'), { status: 502 });
  return { image: `data:${mime};base64,${b64}`, mime };
}

export const rateKeys = userId => ({ user: `ig:u:${userId}`, all: 'ig:all' });
export const DAY_MS = DAY;
