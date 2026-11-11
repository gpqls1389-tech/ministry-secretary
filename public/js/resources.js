// 자료실(부서별 추천 사이트) 목록.
// - 2026-11-10에 주소가 실제로 열리는지(HTTP 200) 확인하고, 사이트의 메뉴·소개를 직접 열어 확인한 내용만 desc에 적었습니다.
// - 공식 기관·출판사를 우선했고 광고가 아닙니다. 유료 여부·회원가입·이용 조건은 바뀔 수 있어 note에는 ‘확인된 것’만 적고, 나머지는 사이트에서 확인하도록 했습니다.
// - 교재·찬양·이미지·성경 본문은 저작권 이용 조건을 각 사이트에서 확인하세요. 이 목록은 주소와 소개만 담고 내용은 가져오지 않습니다.
// - 고칠 때: 아래 배열에 { name, url(https 전체 주소), category, audience('공통'|'아동부'|'청년부'), desc, note } 를 추가하고, 새 구분이면 RESOURCE_CATEGORIES에도 넣으세요. RESOURCES_CHECKED도 확인한 날짜로 바꾸세요.
export const RESOURCES_CHECKED = '2026-11-11';

export const RESOURCE_CATEGORIES = ['교단·교회력', '성경', '교재·공과', '대림절·성탄절', '활동지·성경학교', '놀이·활동', '교사 교육', '청년 사역', '행정·회계', '저작권', '이미지·디자인', '안전·아동 보호', '개인정보'];

export const RESOURCES = [
  // ----- 교단·교회력 (공통) -----
  { name: '기독교대한감리회', url: 'https://kmc.or.kr/', category: '교단·교회력', audience: '공통', desc: '감리회 소개, 본부 공지와 조직(선교국·교육국 등), 교리와 장정 등 통합자료실을 제공하는 교단 공식 홈페이지입니다.', note: '이용 조건은 사이트에서 확인' },
  { name: '교회력에 따른 성서일과(감리회)', url: 'https://lectionary.kmc.or.kr/', category: '교단·교회력', audience: '공통', desc: '2026년 교회력과 절기별 성서일과표를 도서출판kmc가 제공하는 페이지입니다. 이 사이트의 교회력 계산을 대조한 자료입니다.', note: '이용 조건은 사이트에서 확인' },
  { name: '기독교대한감리회 교육국', url: 'https://kmc.or.kr/hq-system/dept-of-education', category: '교단·교회력', audience: '공통', desc: '목회·장년·차세대·어린이교육정책부 소개와 교육 교재 자료실 안내가 있는 본부 교육국 페이지입니다.', note: '교재별 이용 조건은 각 안내 페이지에서 확인' },
  { name: '감리교신학대학교', url: 'https://www.mtu.ac.kr/', category: '교단·교회력', audience: '공통', desc: '대학 소개와 총장 인사말·설교문 등을 안내하는 감리교신학대학교 공식 홈페이지입니다.', note: '접속하면 메인 페이지로 자동 이동' },
  { name: '연합감리교회(UMC) 한국어 안내', url: 'https://www.umc.org/ko/?region=Global', category: '교단·교회력', audience: '공통', desc: '연합감리교회의 선교 사명과 전 세계 사역을 한국어로 소개하는 공식 사이트의 한국어 페이지입니다.', note: '일부 세부 페이지는 영어일 수 있음' },

  // ----- 성경 (공통) -----
  { name: '대한성서공회', url: 'https://www.bskorea.or.kr/', category: '성경', audience: '공통', desc: '개역개정 등 성경 읽기, 매일성경묵상, 성경 지도·용어해설 같은 성경탐구자료를 제공하는 기관 사이트입니다.', note: '성경 본문을 자료에 옮겨 쓸 때는 ‘성경의 저작권’ 안내의 허가 조건을 확인. 회원가입·로그인 메뉴 있음' },

  // ----- 교재·공과 (아동부 중심, 공통 포함) -----
  { name: '도서출판kmc (감리회본부 온라인서점)', url: 'https://www.kmcpress.co.kr/', category: '교재·공과', audience: '공통', desc: '감리회 본부 출판 온라인서점으로 영유아·유치·초등 부서별 교재와 ‘아하! 바이블큐브’, 대림절 묵상집을 소개합니다.', note: '교재 판매 쇼핑몰(유료), 회원가입·로그인 메뉴 있음. 결제·배송 조건은 사이트에서 확인' },
  { name: '감리회 교육국 교재 안내', url: 'https://kmc.or.kr/hq-system/dept-of-education/gyojae-annae', category: '교재·공과', audience: '공통', desc: '감리회 교육국의 교재 안내 페이지로 ‘아하! 바이블큐브’와 청소년·장년 교재 등을 소개하며, 어린이교육정책부는 영·유아·유치·초등부 교재 기획을 맡습니다.', note: '주문 방법은 페이지에 없음. 이용 조건은 사이트에서 확인' },
  { name: '성서유니온선교회', url: 'https://www.su.or.kr/', category: '교재·공과', audience: '공통', desc: '매일성경과 어린이 매일성경 연계 주일 공과의 교사 지도안·활동 자료·설교문과 PPT를 자료실에 월별로 올리는 선교 단체입니다.', note: '2026년 11-12월 공과 지도안이 자료실에 있음. 열람·내려받기에 로그인이 필요한지와 이용 약관은 사이트에서 확인' },
  { name: '두란노서원 (두란노닷컴)', url: 'https://www.duranno.com/', category: '교재·공과', audience: '공통', desc: '큐티 메뉴에 유아·유치부와 어린이(저·고) 큐티가 있고 성경·잡지·도서·온라인 강의를 함께 제공합니다.', note: '회원가입·로그인, 큐티 이용권·정기구독 안내가 있음. 교재 내용과 가격은 사이트에서 확인' },
  { name: '생명의말씀사 라이프북', url: 'https://www.lifebook.co.kr/', category: '교재·공과', audience: '아동부', desc: '유년초등부 등 부서별 교재를 여러 출판사 것까지 모아 판매하는 온라인몰이며 어린이용 대림절 말씀달력도 있습니다.', note: '온라인 판매몰. 결제·회원 조건은 사이트에서 확인' },

  // ----- 대림절·성탄절 (감리회 대림절 묵상집은 위 ‘도서출판kmc’ 항목에서 안내) -----
  { name: 'The United Methodist Church — Advent & Christmas', url: 'https://www.umc.org/en/ways-we-grow/advent-christmas', category: '대림절·성탄절', audience: '공통', desc: '연합감리교회가 가족용 주간 대림절 묵상(본문·묵상·기도·활동), 대림초 설명, 성탄 12일 활동 아이디어 등을 소개합니다.', note: '영어 자료. 무료 여부는 각 자료에서 확인' },
  { name: 'ResourceUMC — Christmas', url: 'https://www.resourceumc.org/en/topics/seasonal/christmas', category: '대림절·성탄절', audience: '공통', desc: '연합감리교회 계열 ResourceUMC의 절기 주제 가운데 성탄절 관련 자료를 모아 둔 영어 페이지입니다.', note: '영어 자료. 자료별 이용·저작권 조건은 각 자료에서 확인' },
  { name: 'ResourceUMC', url: 'https://www.resourceumc.org/en/', category: '대림절·성탄절', audience: '아동부', desc: '연합감리교회 커뮤니케이션즈가 운영하며 2026 대림절 설교 시리즈와 어린이 대림절·성탄 사역 툴박스를 목록에 둡니다.', note: '영어 자료. 툴박스의 구체 내용·가격은 확인하지 못함' },
  { name: 'Cokesbury — Advent 2026', url: 'https://www.cokesbury.com/advent2026', category: '대림절·성탄절', audience: '아동부', desc: '연령별 교재·대림절 소그룹 공부·묵상·가정용 대림절 상품을 판매하는 영어 서점의 대림절 안내 페이지입니다.', note: '유료 판매 중심. 일부 무료 항목이 있음. 운영 주체는 사이트에서 확인' },

  // ----- 활동지·성경학교 (아동부) -----
  { name: '성서유니온 자료실 (어린이)', url: 'https://www.su.or.kr/03bible/sub05MediReferRoom01.do?mode=list&type=3', category: '활동지·성경학교', audience: '아동부', desc: '어린이 탭에 월별 공과 교사 지도안·활동 자료와 성경 활동 자료(예: 예수님 집 만들기)가 게시되어 있습니다.', note: '2026년 11-12월 자료가 목록에 있음. 무료 여부·로그인 필요 여부는 게시글에서 확인' },
  { name: '감리회 교육국 성경학교 자료', url: 'https://kmc.or.kr/hq-system/dept-of-education/seonggyeonghaggyo', category: '활동지·성경학교', audience: '아동부', desc: '감리회 교육국의 성경학교 메뉴로 성경학교·청소년수련회·노년성경학교 자료 항목이 있습니다.', note: '‘2026 성경학교’ 메뉴 주소가 2025로 표기되어 최신 여부는 확인 필요. 내려받기 조건은 사이트에서 확인' },

  // ----- 교사 교육 (공통) -----
  { name: '감리회 교육국 교재 자료실 (교사교육·교사ON)', url: 'https://kmc.or.kr/hq-system/dept-of-education/gyojae-jaryosil', category: '교사 교육', audience: '공통', desc: '교재 자료실에 ‘교사교육 교사ON’ 항목과 유치부·초등부 큐브, 찬양·요절송 자료실 메뉴가 있습니다.', note: '항목 이름만 확인함(교사ON의 구체 내용은 미확인). 로그인·무료 여부는 사이트에서 확인' },

  // ----- 청년 사역 (청년부) -----
  { name: '한국기독학생회 IVF', url: 'https://www.ivf.or.kr/', category: '청년 사역', audience: '청년부', desc: '대학 캠퍼스 사역 단체로, 성경공부 자료실과 영상·이미지 자료실, 전국수련회 소식을 안내하는 사이트입니다.', note: '로그인·회원가입 메뉴 있음. 자료별 이용 조건은 사이트에서 확인' },
  { name: 'QTM (큐티인)', url: 'https://www.qtm.or.kr/', category: '청년 사역', audience: '청년부', desc: '청년 큐티인을 포함한 큐티인 시리즈 구독·구매와 청장년·청소년 소그룹(GQS) 안내를 제공하는 큐티 사역 기관 사이트입니다.', note: '구독·구매(택배비 구매자 부담), 회원가입·로그인 있음' },
  { name: 'IVP 출판사', url: 'https://ivp.co.kr/', category: '청년 사역', audience: '청년부', desc: '신간·스테디셀러 도서와 매거진, 북클럽, 자료실 메뉴로 도서를 소개하는 출판사 사이트입니다.', note: '도서 구매는 유료, 회원가입 있음. 청년·대학생 사역 도서로 쓸 수 있는지는 직접 검토. (www 없는 주소만 열림)' },

  // ----- 행정·회계 (공통) -----
  { name: '국세청 홈택스', url: 'https://www.hometax.go.kr/', category: '행정·회계', audience: '공통', desc: '국세청이 운영하는 전자세금 신고·납부 누리집으로, 교회 세무 업무 때 접속하는 공식 창구입니다.', note: '기부금영수증 등 세부 메뉴와 로그인·인증 필요 여부는 사이트에서 확인' },
  { name: '국세청', url: 'https://www.nts.go.kr/', category: '행정·회계', audience: '공통', desc: '종교인소득 신고·원천징수 안내와 전자기부금영수증 제도 안내 메뉴가 있는 국세청 누리집입니다.', note: '상담은 국번 없이 126(페이지 안내). 세무 판단은 세무서·전문가에 문의' },
  { name: '기윤실 (기독교윤리실천운동)', url: 'https://cemk.org/', category: '행정·회계', audience: '공통', desc: '기독교 시민단체로, 교회 재정과 관련한 재정세미나·재정보고 메뉴를 운영하는 것을 확인했습니다.', note: '민간 공익 단체(공식 기관 아님). 세미나 이용 조건은 사이트에서 확인' },
  { name: '오직 (Ohjic)', url: 'https://www.ohjic.com/', category: '행정·회계', audience: '공통', desc: '교적, 재정(기부금 영수증 발행 포함), 비품, 문자 등 교회 행정 프로그램을 소개하는 상용 서비스입니다.', note: '상용 서비스, 참고용. 요금은 견적·가입 문의로 확인(홈페이지 안내: 1599-0657)' },

  // ----- 저작권 (공통) -----
  { name: '한국음악저작권협회 (KOMCA)', url: 'https://www.komca.or.kr/', category: '저작권', audience: '공통', desc: '음악저작물의 권리를 관리하는 신탁관리 사단법인으로, 협회 소개와 연혁을 안내합니다.', note: '교회 예배·성탄 행사에서의 이용료 적용 여부는 확인하지 못함 → 협회에 직접 문의' },
  { name: '한국저작권위원회', url: 'https://www.copyright.or.kr/', category: '저작권', audience: '공통', desc: '저작권 상담센터와 챗봇 상담, 저작권 등록, 공유마당, 저작권 교육 포털로 이어지는 메뉴를 제공합니다.', note: '상담 전화 1800-5455(페이지 안내). 이용 조건은 서비스별로 확인' },
  { name: '공공누리 (KOGL)', url: 'https://www.kogl.or.kr/info/freeUse.do', category: '저작권', audience: '공통', desc: '공공기관 저작물을 표시된 유형(제0~4유형)의 조건에 따라 자유롭게 이용하도록 안내하는 제도 사이트입니다.', note: '유형마다 출처표시·상업적 이용·변경 가능 여부가 다름. 쓰기 전에 자료의 유형 표시를 원문에서 확인' },

  // ----- 이미지·디자인 (공통) -----
  { name: '공유마당', url: 'https://www.copyright.or.kr/business/gongu/index.do', category: '이미지·디자인', audience: '공통', desc: '한국저작권위원회가 운영하며 CCL, 만료·기증저작물, 공공저작물을 모아 제공하고 무료 폰트 정보도 안내합니다.', note: '회원가입 없이 조회·무료 내려받기 가능(페이지 안내). CCL 조건(BY·NC·ND·SA)은 저작물마다 확인' },

  // ----- 안전·아동 보호 (공통) -----
  { name: '국가아동권리보장원 — 아동학대 신고·예방', url: 'https://www.ncrc.or.kr/ncrc/cm/cntnts/cntntsView.do?mi=1030&cntntsId=1484', category: '안전·아동 보호', audience: '공통', desc: '아동학대 의심 징후, 신고에 필요한 정보, 신고 방법(국번 없이 112)과 신고의무자 대상 기관을 안내합니다.', note: '신고자 신분 보장 안내 포함' },
  { name: '아동학대예방의 날 (국가아동권리보장원)', url: 'https://dayforchild.ncrc.or.kr/sub5_1.php', category: '안전·아동 보호', audience: '공통', desc: '아동학대의 정의, 신고 시점 예시, 112 신고 안내, 전국 아동보호전문기관 안내를 제공합니다.', note: '이용 조건은 사이트에서 확인' },
  { name: '보건복지부 — 아동학대 예방 및 피해아동 보호', url: 'https://www.mohw.go.kr/menu.es?mid=a10711050100', category: '안전·아동 보호', audience: '공통', desc: '아동학대 정의, 예방·보호 사업, 신고 방법과 신고의무자 범위를 안내하는 정책 페이지입니다.', note: '페이지 최종 수정일 2025-03-21 표기. 법령·수치는 최신 자료로 재확인' },
  { name: '국민안전24 (행정안전부)', url: 'https://www.mois.go.kr/frt/sub/a06/b11/safekorea/screen.do', category: '안전·아동 보호', audience: '공통', desc: '국민행동요령, 자율안전점검, 어린이안전놀이시설 점검, 어린이안전교육 관리 메뉴 등 재난·안전 정보를 안내합니다.', note: '공식 전자정부 누리집. 세부 서비스 이용 조건은 사이트에서 확인' },
  { name: '한국어린이안전재단', url: 'https://childsafe.or.kr/', category: '안전·아동 보호', audience: '공통', desc: '어린이 안전교육, 찾아가는 안전체험, 카시트 보급 캠페인과 자료실을 운영하는 재단 누리집입니다.', note: '민간 재단. 교육·후원·신청은 회원가입이 필요할 수 있음' },

  // ----- 개인정보 (공통) -----
  { name: '개인정보 포털 (개인정보보호위원회)', url: 'https://www.privacy.go.kr/', category: '개인정보', audience: '공통', desc: '개인정보 침해신고, 열람 요구, 분쟁조정 신청과 사업자용 자가진단, 아동·청소년 개인정보 삭제 요청 등을 제공합니다.', note: '본인인증으로 이용, 만 14세 미만은 법정대리인 동의 필요(페이지 안내). 침해신고 118' },
  { name: '개인정보보호위원회', url: 'https://pipc.go.kr/np/', category: '개인정보', audience: '공통', desc: '개인정보 정책·법령 해석 지원, 침해신고·분쟁조정 제도 안내와 아동·청소년 관련 자료를 모은 누리집입니다.', note: '법령해석지원센터 02-2100-3043(평일 9~18시, 페이지 안내)' },
  // ----- 교재·공과·성경학교 추가 (2026-11-11 확인) -----
  { name: '히즈쇼 (HisShow)', url: 'https://www.hisshow.co.kr/', category: '교재·공과', audience: '아동부', desc: '주일학교 교재(하나님나라 바이블랜드·성경탐험, 예수님과 나 키즈/주니어, 왕의 자녀 키즈/주니어, 하나님나라 틴즈·하이틴즈), 여름/겨울성경학교 공과교재, 가정홈스쿨 제품, 히즈쇼 TV 메뉴를 운영하는 교재 쇼핑몰입니다.', note: '교재는 유료 판매. 가격·최신 주제는 사이트에서 확인(페이지마다 다르게 보일 수 있음). 감리교 전통과 맞는지는 교재를 직접 보고 판단' },
  { name: '파이디온선교회', url: 'https://www.paidion.org/min_kids.php', category: '교재·공과', audience: '아동부', desc: '3세~6학년을 위한 연령별 활동 중심·성경 중심 교재를 개발·보급하는 선교회로, 유아·유치·유년·초등부 교재와 신나는 성경탐험, 교사 강습회·디렉터스쿨을 안내합니다(검색 결과의 공식 페이지 기준).', note: '검색 결과에 2018~2025년 페이지가 섞여 있어 현재 판매 교재·가격은 공식 사이트에서 확인' },
  { name: '파이디온 VBS (성경학교)', url: 'https://paidion.org/ministry/vbs/', category: '활동지·성경학교', audience: '아동부', desc: '파이디온선교회의 여름·겨울 성경학교(VBS) 소개 페이지로, 연도별 주제와 교재·교사강습회로 이어집니다.', note: '교재는 유료. 연도별 주제는 해마다 바뀜' },
  { name: '갓피플 (GodPeople)', url: 'https://www.godpeople.com/', category: '성경', audience: '공통', desc: '성경별(구약·신약) 자료, 갓피플성경 앱 소개, 오늘의 테마 콘텐츠, 신간 도서 소개를 모은 기독교 포털입니다(메인 화면 기준).', note: '교회학교 전용 사이트는 아님. 자료별 이용 조건 확인' },
  // ----- 놀이·활동 (영어 자료는 번역·각색 시 출처와 이용 조건 확인) -----
  { name: 'Ministry-To-Children', url: 'https://ministry-to-children.com/', category: '놀이·활동', audience: '아동부', desc: '어린이 예배 공과와 자료를 제공하는 영어 사이트로, 주일학교 게임·성경 암송 게임·활동지·만들기·절기(크리스마스) 분류를 둔 것을 확인했습니다.', note: '영어. 자료별 이용 조건과 신학 입장 확인, 한국 상황에 맞게 각색' },
  { name: 'Sunday School Zone', url: 'https://sundayschoolzone.com/', category: '놀이·활동', audience: '아동부', desc: '성경 활동과 주일학교 활동 자료를 모은 영어 사이트로, 성탄 만들기·활동지·어린이 설교 자료 분류가 있습니다.', note: '영어. 이용 조건은 자료별로 확인' },
  { name: "DLTK's Bible", url: 'https://www.dltk-bible.com/', category: '놀이·활동', audience: '아동부', desc: '성경 이야기를 바탕으로 한 색칠 그림, 워크시트, 공작, 게임을 인쇄해 쓰도록 모은 영어 사이트입니다.', note: '페이지에 저작권 표기와 이용약관 링크가 있어 인쇄·배포 전 약관 확인. 영어' },
  { name: 'ChurchLeaders 어린이 사역', url: 'https://churchleaders.com/children', category: '놀이·활동', audience: '아동부', desc: '어린이 사역자를 위한 글과 무료 자료(공과·만들기·인쇄물) 분류를 제공하는 영어 사이트입니다.', note: '영어. 글마다 이용 조건 확인' },
  { name: 'Kids Sunday School', url: 'https://www.kidssundayschool.com/', category: '놀이·활동', audience: '아동부', desc: '유아·초등 주일학교 공과, 만들기, 활동, 게임, 퍼즐, 연극 대본, 노래, 게시판 꾸미기 자료를 제공하는 영어 사이트입니다.', note: '온라인 자료는 회원가입과 유료 이용권이 필요(페이지 안내). 영어' },
  // ----- 이미지·디자인 추가 (2026-11-11 확인) -----
  { name: '미리캔버스', url: 'https://www.miricanvas.com/', category: '이미지·디자인', audience: '공통', desc: '프레젠테이션, 포스터, 소셜 미디어, 퀴즈 등의 템플릿을 제공하는 온라인 디자인 도구입니다.', note: '무료 범위와 유료 요금제는 사이트에서 확인. 템플릿 속 이미지·폰트 이용 조건 확인' },
  { name: '망고보드', url: 'https://www.mangoboard.net/', category: '이미지·디자인', audience: '공통', desc: '카드뉴스, PPT, 포스터, SNS 템플릿, 영상을 템플릿으로 만드는 디자인·영상 제작 플랫폼입니다.', note: '요금제·결제 메뉴가 있어 무료 범위는 사이트에서 확인' },
  { name: 'Canva (캔바)', url: 'https://www.canva.com/ko_kr/', category: '이미지·디자인', audience: '공통', desc: '온라인 비주얼 디자인 도구로, 포스터·PPT·퀴즈·레크리에이션 템플릿을 찾아 쓸 수 있습니다.', note: '캐릭터·유료 소재가 들어간 템플릿이 있어 이용 조건과 저작권 확인' },
  { name: '눈누', url: 'https://noonnu.cc/', category: '이미지·디자인', audience: '공통', desc: '상업적으로 쓸 수 있는 한글 폰트를 찾아보는 폰트 검색 사이트이며 유료 폰트 마켓도 함께 운영합니다.', note: '폰트마다 사용 범위가 다르니 각 폰트의 라이선스 문구를 직접 확인' },
  { name: 'Google Fonts', url: 'https://fonts.google.com/', category: '이미지·디자인', audience: '공통', desc: '글꼴을 둘러보고 고를 수 있는 Google의 글꼴 서비스입니다.', note: '글꼴별 라이선스 확인' },
  { name: 'Pixabay (픽사베이)', url: 'https://pixabay.com/ko/', category: '이미지·디자인', audience: '공통', desc: '무료 이미지를 검색할 수 있는 이미지 사이트입니다.', note: '이용 조건은 사이트 약관에서 확인. 인물 사진은 초상권을 확인하고, 교회 아이들 사진과 섞어 쓰지 않기' },
  { name: 'Pexels (펙셀스)', url: 'https://www.pexels.com/ko-kr/', category: '이미지·디자인', audience: '공통', desc: '무료 이미지(저작권 없는 이미지)를 검색할 수 있는 이미지 사이트입니다.', note: '이용 조건은 사이트 약관에서 확인. 인물 사진은 초상권 확인' },
  { name: 'Unsplash (언스플래시)', url: 'https://unsplash.com/', category: '이미지·디자인', audience: '공통', desc: '무료 이미지와 사진을 검색할 수 있는 사진 사이트입니다.', note: '이용 조건은 사이트 약관에서 확인. 인물 사진은 초상권 확인' },
  { name: 'unDraw', url: 'https://undraw.co/', category: '이미지·디자인', audience: '공통', desc: '무료 오픈소스 SVG 일러스트 모음입니다. 페이지에 출처 표기 없이 상업적·개인적 프로젝트에 쓸 수 있다고 안내하되 unDraw 자체를 복제하는 것은 허용하지 않는다고 적혀 있습니다.', note: '교회 행사 포스터·활동지 일러스트로 활용 가능. 안내 문구는 사용 전 다시 확인' },
];
