# 목회 비서 (ministry-secretary)

아동부·청년부를 한 사람이 관리하는 웹앱입니다. 빌드 과정이 없는 **정적 사이트**(HTML·CSS·JavaScript)라서 Cloudflare Pages에 그대로 올릴 수 있습니다.

- 메뉴: 홈 · 일정·계획 · 행사 · 예배 · 인원·출석 · 회계 · 설정
- 첫 화면: 이번 주 예배·행사, 준비할 일, 예산 현황 (부서 선택: 아동부 / 청년부 / 전체)
- 처음 열면 **가상 데이터**가 들어 있어 모든 화면과 기능을 바로 눌러볼 수 있습니다. 설정에서 ‘실제 데이터로 시작’을 누르면 비워집니다.
- 데이터는 **사용하는 브라우저(기기)의 localStorage에만** 저장됩니다. 서버로 전송하지 않으며, 다른 기기와 자동으로 공유되지 않습니다. 설정의 ‘내보내기(JSON)’로 백업하세요.
- 보호자 연락처·알레르기·계좌·주민번호는 **입력받지 않습니다**(웹앱 1차 버전의 의도적 제한).

## 디자인
`DESIGN-notion.md` 가이드를 따릅니다: 따뜻한 종이색 배경(`#f6f5f4`) 위의 흰 카드(12px, 헤어라인 `#e6e6e6` + 아주 옅은 겹 그림자), 구조에 쓰는 강조색은 파란색 `#0075de` 하나(주요 버튼은 알약형, 활성 메뉴 표시선·링크·포커스), 굵은 헤드라인과 음수 자간, 입력칸 4px·유틸리티 버튼 8px. 아동부·청년부 구분 배지처럼 스티커 팔레트(청록·보라·주황)는 장식·분류에만 쓰고, 진한 남색 `#213183` 히어로 띠는 홈 첫 화면 한 곳에만 씁니다.
- 글꼴: 가이드의 `NotionInter`(Inter)는 파일을 포함하지 않았습니다. PC에 Inter가 설치되어 있으면 쓰고, 없으면 시스템 글꼴(한글은 맑은 고딕)로 표시됩니다. Inter를 그대로 쓰려면 woff2 파일을 `public/fonts/`에 넣고 `@font-face`를 추가하세요(외부 글꼴 서버는 CSP 때문에 쓰지 않았습니다).
- 가이드에 오류·성공 전용 색이 없어, 기한 지남·적자는 주황, 수입·완료는 초록 스티커 색으로 표시합니다.

## 폴더 구조
```
public/            ← 배포되는 폴더 (Cloudflare Pages 출력 폴더)
  index.html  style.css  _headers
  js/app.js        화면
  js/store.js      데이터·집계 로직 (브라우저와 Node 테스트에서 공통 사용)
  js/seed.js       가상 데이터 (오늘 날짜 기준으로 생성)
scripts/serve.js   로컬 미리보기 서버 (배포에는 쓰이지 않음)
tests/             자동 테스트 (node --test)
```

## 내 PC에서 확인하기
Node.js 20 이상이 필요합니다(없으면 `winget install OpenJS.NodeJS.LTS`).
```bash
npm test
npm start
```
`npm start` 후 브라우저에서 `http://localhost:8788` 을 엽니다. 설치할 패키지는 없습니다.

---

## 1. GitHub에 올리기 전 검토하는 방법 (중요)
이 폴더의 변경 사항은 **아직 GitHub에 올라가지 않았습니다.** 아래 순서로 직접 확인한 뒤 올리세요. `main` 브랜치에 바로 올리지 말고 **작업 브랜치 → Pull Request → 검토 → 병합** 순서를 쓰면, 병합 전에는 실제 사이트가 바뀌지 않습니다.

Git이 없다면 먼저 설치합니다: `winget install --id Git.Git -e`

```bash
git clone https://github.com/<내 아이디>/ministry-secretary.git
```
이 폴더의 파일(`.git` 제외, `node_modules` 제외)을 clone된 폴더에 복사한 뒤:
```bash
git checkout -b feat/initial-app
git add -A
git status
git diff --cached
```
`git status`로 올라갈 파일 목록을, `git diff --cached`로 내용을 읽어 보세요. 개인정보(실제 이름·연락처)나 비밀 값이 없는지 확인합니다. 이상이 없으면:
```bash
git commit -m "목회 비서 웹앱 초기 버전"
git push -u origin feat/initial-app
```
GitHub 저장소 페이지에서 **Compare & pull request** → 변경 파일(Files changed)을 한 번 더 검토 → 문제가 없으면 **Merge**. Cloudflare Pages를 연결해 두었다면 PR을 열면 **미리보기 주소**가 따로 생기므로, 병합 전에 화면까지 확인할 수 있습니다(공식 문서: `main` 같은 프로덕션 브랜치 외의 브랜치는 미리보기 배포로 사용됩니다).

## 2. Cloudflare Pages 배포 설정
Cloudflare 대시보드 → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git** → **GitHub** 인증 → `ministry-secretary` 저장소 선택 → **Begin setup**.

| 설정 항목 | 입력값 |
|---|---|
| 프로젝트 이름 | `ministry-secretary` (주소의 일부가 됩니다. 원하는 이름으로 변경 가능) |
| 프로덕션 브랜치 | `main` |
| 프레임워크 프리셋 | **None**(선택 안 함) |
| 빌드 명령어 | `exit 0` (공식 문서: 프리셋이 없고 빌드 단계가 없을 때 사용) |
| 빌드 출력 디렉터리 | `public` |
| 루트 디렉터리 | 비워 둠 |
| 환경 변수 | 없음 |

**Save and Deploy**를 누르면 첫 배포가 시작됩니다. 이후에는 `main`에 병합할 때마다 자동 배포되고, 다른 브랜치·PR은 미리보기로 배포됩니다.

> 공식 문서 확인: [빌드 설정](https://developers.cloudflare.com/pages/configuration/build-configuration/), [Git 연결](https://developers.cloudflare.com/pages/get-started/git-integration/). 대시보드 메뉴 이름은 바뀔 수 있으니 화면과 다르면 문서를 참고하세요.

## 3. 배포된 사이트 확인하는 방법
1. Cloudflare 대시보드 → 해당 프로젝트 → **Deployments**에서 최신 배포가 **Success**인지 확인하고, 프로젝트 이름으로 만들어진 `https://<프로젝트 이름>.pages.dev` 주소를 엽니다. (주소는 프로젝트 화면에 표시됩니다.)
2. 아래를 눌러 봅니다.
   - [ ] 첫 화면에 ‘가상 데이터로 체험 중’ 안내와 이번 주 일정·준비할 일·예산 현황이 보인다
   - [ ] 왼쪽 메뉴 7개(홈·일정·계획·행사·예배·인원·출석·회계·설정)가 모두 열린다
   - [ ] 예배 → 아무 예배 → 이름을 눌러 출석 체크 → 인원·출석의 출석부에 반영된다
   - [ ] 회계 → ‘지출·수입 등록’ → 금액에 `0`을 넣으면 오류, 숫자를 넣으면 저장된다
   - [ ] 새로고침해도 입력한 내용이 남아 있다
   - [ ] 휴대폰에서 열면 ☰ 메뉴로 열리고 표가 가로로 스크롤된다
3. 보안 헤더: 브라우저 개발자 도구(F12) → Network → 첫 요청의 Response Headers에 `Content-Security-Policy`, `X-Frame-Options` 가 있는지 확인합니다(`public/_headers`).
4. 문제가 있을 때
   - 404가 뜬다 → 빌드 출력 디렉터리가 `public`인지 확인
   - 빈 화면 → F12 Console의 오류 확인(`js/` 파일 경로 대소문자 포함)
   - 수정했는데 그대로다 → 강력 새로고침(Ctrl+F5) 후 Deployments에서 최신 커밋인지 확인

## 4. 접근 제한과 개인정보
- `*.pages.dev` 주소는 **누구나 열 수 있습니다.** 다만 데이터는 각자의 브라우저에만 있어 서로 보이지 않습니다. 검색 노출을 줄이려고 `noindex`를 넣었지만 완전한 비공개는 아닙니다.
- 주소를 아는 사람의 접근 자체를 막으려면 Cloudflare의 접근 제어(Cloudflare Access) 사용을 검토하세요(이 저장소에서는 설정하지 않았습니다).
- 실제 아동 정보를 입력하기 전에 위 사항을 확인하고, 공용 PC에서는 사용 후 브라우저 데이터를 지우세요. 내보낸 JSON 파일에는 이름 등이 들어 있으니 안전하게 보관하세요.

## 5. 검증 결과와 한계
- `npm test`: 로직 테스트 9개 통과(집계·중복 방지·검증·저장/복원).
- 이 PC의 브라우저 창에서 직접 확인: 홈·인원·출석부·회계·예배 화면, 출석 체크 저장, 잘못된 금액 거부, 지출 저장 후 새로고침 유지, 모바일(375px) 레이아웃, 콘솔 오류 없음.
- **Cloudflare Pages 배포 자체는 하지 않았습니다**(계정 로그인·GitHub 연결이 필요). `_headers`의 적용 여부는 배포 후 3장 3번으로 확인하세요.
- 여러 기기 간 자동 동기화, 로그인, 영수증 첨부, 엑셀·PDF 출력은 이 웹앱에 없습니다(데스크톱 앱 `MokhoeBiseo`에는 있음). 인쇄는 브라우저 인쇄(Ctrl+P)로 A4 출력됩니다.
- 사용 전 확인: 성경 본문은 직접 입력하는 칸이며 앱이 인용하지 않습니다(개역개정 본문을 확인하세요). 가상 데이터의 이름·금액은 모두 가짜입니다.
