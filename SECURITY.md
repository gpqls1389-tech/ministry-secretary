# 보안 점검 결과와 설정 안내 (목회 비서 웹)

점검일: 2026-11-10 · 점검 방법: 코드 검토, 운영 사이트와 GitHub 설정 읽기 전용 확인, 자동 테스트(가상 데이터)

## 한눈에
| 항목 | 상태 |
|---|---|
| 운영 사이트 | Cloudflare Pages(`*.pages.dev`), 저장소는 GitHub **공개** |
| 로그인 서버(D1) | **운영에는 아직 꺼져 있음**(`/api/me`가 `configured:false`) → 계정·서버 저장 데이터 없음, 모든 API는 503 |
| 데이터 저장 위치 | 지금은 각자 **브라우저(localStorage)**. 로그인을 켜면 Cloudflare **D1**(계정별 한 줄) |
| 첨부파일 | 웹앱에는 첨부파일 기능이 없음(저장소·R2 사용 안 함). 영수증 첨부는 설치형 앱에만 있음 |
| Supabase | 사용하지 않음(코드·설정에 없음) |
| 보호자 연락처·알레르기·계좌 | 웹앱이 입력받지 않음 |

## 점검 결과 (위험도순)
| # | 위험 | 근거 | 상태 / 무료 해결 |
|---|---|---|---|
| 1 | **높음(로그인을 켤 때)** 가입을 아무나 열 수 있음 | 초대 코드가 짧거나 가입이 열려 있으면 외부인이 계정을 만들 수 있음 | **코드 수정함**: 초대 코드 12자 미만이면 가입 자동 닫힘, 틀린 코드는 전체 30회/시간 후 잠금, `MAX_USERS`로 인원 제한. **직접 설정**: 혼자 쓰면 `MAX_USERS=1`, 내 계정 생성 후 `INVITE_CODE` 삭제 |
| 2 | **높음** 계정 탈취(GitHub·Cloudflare) | 두 계정이 사이트와 데이터를 통제함. GitHub API에서 2단계 인증 여부가 확인되지 않음 | **직접 설정**: 두 계정 모두 2단계 인증 켜기(아래 안내) |
| 3 | 중간 `main` 브랜치 보호 없음 | 보호 규칙 없음(확인됨) → 실수로 운영에 바로 반영 가능 | **직접 설정**: `main`은 Pull Request로만 반영(아래 안내) |
| 4 | 중간 공개 저장소의 커밋 기록에 계정 이메일 | 웹 업로드 커밋 일부에 이메일이 기록됨(주소는 여기에 적지 않음) | **직접 설정**: GitHub에서 이메일 비공개 설정(앞으로의 커밋). 이미 올라간 커밋의 기록은 남음 |
| 5 | 중간 PC·브라우저 데이터 노출(로컬 모드) | localStorage는 암호화되지 않음. PC를 다른 사람이 쓰면 열람 가능 | 사용 후 로그아웃·잠금, Windows 로그인 암호, 가끔 ‘내보내기’ 백업 |
| 6 | 낮음 비밀번호 해시 반복 100,000회 | Workers WebCrypto 한도 내 값(최신 권장치 600,000보다 낮음) | 10자 이상+흔한 비밀번호 거부+시도 제한으로 보완. 긴 문장형 비밀번호 사용 |
| 7 | 낮음 로그인 시도 제한 | 특정 이메일을 15분 잠글 수 있음(계정 잠금 공격) | 허용한 절충. 혼자 쓰면 가입 닫기로 영향 최소 |
| 8 | 낮음 CSP에 `style-src 'unsafe-inline'` | 화면의 인라인 스타일 때문. 스크립트는 `script-src 'self'`로 차단됨 | 유지(스크립트 주입 방어는 유지됨) |
| 9 | 정보 `_headers`는 API 응답에 적용 안 됨 | Cloudflare 문서에 명시 | **코드 수정함**: API 응답 헤더를 코드에서 직접 설정 |

## 이번에 코드로 고친 것
- 초대 코드 최소 길이(12자) 안전장치, 전체 무차별 대입 잠금, `MAX_USERS`
- 약한 비밀번호 거부(흔한 것·같은 글자 반복·이메일 포함)
- 세션 30일 → **14일**, 화면 **30분 무조작 자동 로그아웃**
- 교차 사이트 요청 차단 강화(`Sec-Fetch-Site`), API 응답에 보안 헤더(CSP·X-Frame-Options 등)
- 사이트 헤더 추가: `Strict-Transport-Security`, `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`, CSP 세분화(`connect-src`, `object-src`, `upgrade-insecure-requests` 등)
- `.gitignore`에 `.dev.vars`, 키·DB 파일 추가

## 영수증 사진 기능의 보안 (`/api/receipts`)
- 사진은 **내 계정에만** 묶여 저장됩니다. 조회·삭제는 항상 세션의 사용자 번호로만 찾으므로 다른 계정 사진은 번호를 알아도 404입니다(테스트로 확인). 로그아웃 상태는 401, 다른 사이트에서 온 삭제 요청은 403.
- JPEG만 받습니다(MIME + 파일 첫 바이트 확인). SVG·PNG 등 스크립트가 들어갈 수 있는 형식은 거부, 한 장 400KB·계정당 300장·60MB·시간당 60회 제한.
- 사진 응답은 `Content-Type: image/jpeg`, `nosniff`, `Cache-Control: private, no-store`, `Content-Security-Policy: sandbox`, `Cross-Origin-Resource-Policy: same-origin`.
- 사진은 올리기 전에 브라우저에서 다시 그려 저장하므로 위치 정보(EXIF) 같은 숨은 정보가 지워집니다. 계정을 삭제하면 사진도 함께 삭제됩니다.
- **한계**: 사진은 암호화하지 않고 D1에 저장되므로 사이트 관리자는 기술적으로 볼 수 있습니다. 사진은 JSON 백업에 들어가지 않습니다. 영수증에 보이는 개인정보(카드번호·실명 등)는 가리고 찍도록 화면에 안내합니다.

## 확인한 것 (가상 데이터, 자동 테스트 45개)
- 로그아웃 상태: 명단·출석·회계 저장소 읽기/쓰기/비밀번호 변경/계정 삭제 모두 401, 데이터 변동 없음
- 다른 계정: B는 A의 데이터를 읽기·덮어쓰기·삭제 불가, 요청에 `user_id`를 넣어도 무시, 토큰 한 글자 변조·로그아웃한 토큰 재사용·삭제된 계정 세션 모두 거부
- 권한 상승: 관리자 권한/역할 자체가 없음(`role`·`is_admin` 값 무시, `/api/admin` 등 404)
- 주입: SQL 주입 문자열은 데이터를 건드리지 못함, 악성 문자열(스크립트 태그 등)을 모든 입력 항목에 넣어도 화면 19곳에서 실행되지 않고 글자 그대로 표시
- 응답: 비밀번호 해시·세션 토큰은 어떤 응답에도 없음, 쿠키는 HttpOnly·Secure·SameSite=Strict·`__Host-`
- 운영 사이트(읽기 전용 확인): 로그인 서버 미설정이라 모든 API 503, `.git`·`functions`·`migrations`·`.env` 경로는 실제 파일이 아니라 앱 첫 화면을 반환(파일 노출 없음)

## 아직 확인하지 못한 것
- Cloudflare 계정 안의 설정(D1 연결, 비밀 변수, 2단계 인증)은 로그인이 필요해 보지 못했습니다. 운영 `/api/me`가 `configured:false`라는 사실만 확인했습니다.
- GitHub 2단계 인증 여부는 API에서 값이 나오지 않았습니다.
- Cloudflare 위에서의 실제 동작(Functions·D1)은 같은 SQL을 SQLite로 실행해 검증했습니다.

## 직접 설정할 것
### GitHub (github.com)
1. **2단계 인증**: 오른쪽 위 프로필 → Settings → **Password and authentication** → Two-factor authentication 켜기(인증 앱 권장, 복구 코드 보관).
2. **이메일 비공개**: Settings → **Emails** → ‘Keep my email addresses private’와 ‘Block command line pushes that expose my email’ 켜기.
3. **main 보호**: 저장소 → Settings → **Rules → Rulesets**(또는 Branches → Add branch protection rule) → 대상 `main` → ‘Require a pull request before merging’ 켜기. (공개 저장소는 무료)
4. 이미 켜져 있음(확인됨): Secret scanning, Push protection.

### Cloudflare (dash.cloudflare.com)
1. **2단계 인증**: 오른쪽 위 프로필 → My Profile → **Authentication** → Two-Factor Authentication 켜기. (메뉴 이름은 바뀔 수 있음)
2. **로그인을 켤 때만** README ‘로그인 켜기’ 순서(D1 만들기 → 테이블 → `DB` 연결). 그리고 Settings → **Variables and Secrets**에서
   - `INVITE_CODE`: 12자 이상 무작위 문장, **Encrypt**
   - `MAX_USERS`: 혼자 쓰면 `1`
   - **내 계정을 만든 뒤 `INVITE_CODE`를 삭제하고 재배포** → 가입이 완전히 닫힘
3. **백업**: 사이트의 설정 → ‘내보내기’(JSON)를 정기적으로 받아 안전한 곳에 보관. D1은 **Time Travel**(항상 켜져 있음, 무료 플랜 7일)이 있고 복원은 문서상 Wrangler 명령줄로 합니다.
4. Cloudflare Access는 문서상 기본적으로 **미리보기 배포만** 보호합니다. 운영 `*.pages.dev` 보호 여부는 문서에서 확인되지 않아 이 저장소에서는 사용하지 않았습니다.

## 백업·복원
- 내보내기(JSON)에는 인원·행사·예배·출석·참가·예산·거래가 모두 들어갑니다. 첨부파일 기능은 웹앱에 없습니다.
- 복원: 설정 → 파일에서 가져오기. 구조를 먼저 검사해 어긋나면 **현재 데이터를 건드리지 않고** 거부합니다.
- 내보낸 파일에는 이름 등이 들어 있으니 안전하게 보관하세요(암호화하지 않음).

## 패키지
- 웹 사이트는 외부 패키지·CDN 스크립트를 쓰지 않습니다(의존성 0). 취약 패키지 해당 없음.
- (별개 프로젝트) 설치형 앱의 `exceljs` 하위 `uuid`에 중간 등급 권고 2건 — 해당 함수를 앱이 쓰지 않아 실제 위험은 낮고, 자동 수정은 `exceljs`를 낮은 버전으로 되돌리는 변경이라 적용하지 않음.
