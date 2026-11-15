# 칼로리 노트

나이·체중·인바디 PDF로 하루 필요 칼로리와 탄단지를 계산하고, 식단·운동(맨몸운동·달리기)을 기록하는 정적 웹앱입니다.

- 실행: `index.html`을 브라우저로 열거나 `python3 -m http.server`로 서빙
- 데이터: 브라우저 localStorage에만 저장 (서버 전송 없음). 설정 탭에서 JSON 백업 가능
- 인바디 PDF 인식: pdf.js(cdnjs)를 PDF 선택 시에만 불러오므로 인터넷 필요. 실패 시 수동 입력
- 계산: BMR은 인바디 값 → 제지방량(Katch-McArdle) → Mifflin-St Jeor 순으로 사용. 운동 kcal은 체중·횟수 기반 추정치
- 음식 데이터(`foods.js`)는 평균 추정값이므로 정확한 값은 식약처 식품영양성분 DB 또는 라벨 확인
