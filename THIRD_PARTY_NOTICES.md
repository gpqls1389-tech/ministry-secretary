# 제3자 소프트웨어·글꼴 고지

## Pretendard v1.3.9 (웹 글꼴)
- 위치: `public/fonts/pretendard/` (공식 배포본의 변수 글꼴 동적 서브셋, **수정 없이 그대로**)
- 저작권: Copyright (c) 2021, Kil Hyung-jin (https://github.com/orioncactus/pretendard), with Reserved Font Name 'Pretendard'.
  - 구성 요소: Copyright 2014-2021 Adobe (Source Han Sans, Reserved Font Name 'Source'), Copyright (c) 2016 The Inter Project Authors (Reserved Font Name 'Inter'), Copyright 2021 The M+ FONTS Project Authors (Reserved Font Name 'M PLUS 1')
- 라이선스: SIL Open Font License, Version 1.1 — 전문: `public/fonts/pretendard/LICENSE.txt`, FAQ: https://scripts.sil.org/OFL
- 이 프로젝트가 지키는 조건: 저작권 고지와 라이선스 전문을 글꼴과 함께 배포함 / 글꼴을 단독으로 판매하지 않음 / 글꼴을 수정하지 않았고 이름도 바꾸지 않음 / 저작권자의 이름으로 홍보하지 않음
- 화면에서도 `설정 → 글꼴·오픈소스 고지`에 같은 내용을 표시합니다.

## pdf.js (pdfjs-dist) 6.5.438 (PDF 글자 읽기)
- 위치: `public/vendor/pdfjs/` (`pdf.min.mjs`, `pdf.worker.min.mjs`, `cmaps/` — **수정 없이 그대로**)
- 저작권·라이선스: Mozilla 및 pdf.js 기여자, Apache License 2.0 — 전문: `public/vendor/pdfjs/LICENSE.txt`, 출처: https://github.com/mozilla/pdf.js
- 받은 곳: npm 공식 저장소 `pdfjs-dist-6.5.438.tgz` (npm이 제공하는 sha512 무결성 해시와 일치함을 확인)
- 쓰임: `설정 → 일정·계획 → PDF에서 가져오기`에서 PDF의 글자를 **브라우저 안에서만** 읽습니다(PDF를 서버로 보내지 않음).
## 화면 부품 4종 (달력·타임라인·차트·디자인 변수) — 모두 MIT License
받은 곳은 모두 npm 공식 저장소이며, npm이 제공하는 sha512 무결성 해시와 일치함을 확인했습니다. 파일은 **수정 없이 그대로** `public/vendor/` 에 두었고, 자동 테스트가 파일이 바뀌지 않았는지(SHA-256) 확인합니다. 각 폴더의 `LICENSE.txt` 가 라이선스 전문입니다.
- **vanilla-calendar-pro 3.4.0** — Copyright (c) 2024 Yury Uvarov, 출처 https://github.com/uvarov-frontend/vanilla-calendar-pro, 위치 `public/vendor/vanilla-calendar-pro/` (`index.mjs`, `index.css`). 쓰임: 날짜 입력칸의 달력 선택(마우스가 있는 기기에서만).
- **frappe-gantt 1.2.2** — Copyright (c) 2024 Frappe Technologies Pvt. Ltd., 출처 https://github.com/frappe/gantt, 위치 `public/vendor/frappe-gantt/` (`frappe-gantt.es.js`, `frappe-gantt.css`). 쓰임: 행사·준비 일정 타임라인(읽기 전용). 이 라이브러리는 제목을 HTML로 그리는 곳이 있어, 사용자가 입력한 글은 항상 이스케이프해서 넘깁니다.
- **uPlot 1.6.32** — Copyright (c) 2022 Leon Sorokin, 출처 https://github.com/leeoniya/uPlot, 위치 `public/vendor/uplot/` (`uPlot.esm.js`, `uPlot.min.css`). 쓰임: 예배 화면의 출석 추이 차트.
- **Open Props 1.7.23** — Copyright (c) 2021 Adam Argyle, 출처 https://github.com/argyleink/open-props, 위치 `public/vendor/open-props/` (`sizes.min.css`, `borders.min.css`, `shadows.min.css` 만 사용). 쓰임: 새 화면 부품의 간격·모서리·그림자 값.