// (자동 생성) 데스크톱 앱 renderer/icons.js와 같은 원본. 직접 그린 SVG라 외부 이미지·글꼴·아이콘 라이브러리가 필요 없다.
/* 목회 비서 시각 자산: 업무 아이콘 · 절기 일러스트 · 빈 화면 삽화 · 앱 아이콘. 모두 이 프로젝트에서 직접 그린 SVG라 외부 이미지·글꼴·아이콘 라이브러리 없이 쓸 수 있다.
   규칙: 아이콘은 24px 격자·선 1.75px·둥근 끝, 일러스트는 선 2px·납작한 색면(그라데이션·그림자 없음), 팔레트는 포레스트·황토·아이보리·차콜만 사용, 사람 얼굴·사진 느낌의 그림은 쓰지 않는다. */

  const F = '#285540', O = '#926116', I = '#fbfaf5', P = '#f3f0e4', K = '#243830', LN = '#bcb69f';
  const ic = body => `<svg class="ic" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
  const IC = {
    home: ic('<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>'),
    calendar: ic('<rect x="3.5" y="5" width="17" height="15" rx="1.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'),
    plan: ic('<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11M10 8h5"/>'),
    event: ic('<path d="M5 21V4"/><path d="M5 4h12l-2.5 4L17 12H5"/>'),
    service: ic('<path d="M12 2v4M10 4h4"/><path d="M12 6l6 5v10H6V11z"/><path d="M10 21v-5a2 2 0 0 1 4 0v5"/>'),
    people: ic('<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.4 2.7-6 6-6s6 2.6 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.2c3 .2 5 2.3 5 5.3"/>'),
    money: ic('<rect x="3" y="6" width="18" height="13" rx="1.5"/><path d="M3 10h18M16 15h2"/><path d="M6 6l9-3 1 3"/>'),
    meeting: ic('<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 12h7M9 16h7"/>'),
    sync: ic('<path d="M7 18a4.5 4.5 0 0 1-.5-9 6 6 0 0 1 11.3 1.5A3.8 3.8 0 0 1 17.5 18z"/><path d="M12 11v5m-2-2l2 2 2-2"/>'),
    // 사이트(웹) 메뉴용
    ministry: ic('<path d="M12 21v-9"/><path d="M12 12c0-4 3-6 7-6 0 4-3 6-7 6z"/><path d="M12 15c0-3-2.2-5-6-5 0 3 2.2 5 6 5z"/>'),
    admin: ic('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
    community: ic('<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/>'),
    sermon: ic('<path d="M4 20l1-4L16.5 4.5l3 3L8 19z"/><path d="M14 7l3 3"/><path d="M4 20h6"/>'),
    resources: ic('<path d="M5 4h4v16H5zM9 4h4v16H9z"/><path d="M14.5 5.5l3.8-1 3 14.5-3.8 1z"/>'),
    settings: ic('<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>'),
  };
  const art = (label, w, h, body) => `<svg class="art" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${label}" fill="none" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
  const hill = (d, fill = P) => `<path d="${d}" fill="${fill}"/><path d="${d.replace(/V180H0z$/, "")}" stroke="${F}" stroke-width="2"/>`;
  const ILLUS = {
    // 대림절: 네 개의 초 가운데 첫째 초만 불을 켠 모습
    advent: art('대림절 — 초 네 개 중 첫째 초에 불이 켜진 그림', 320, 180, `<path d="M36 152Q160 190 284 152" stroke="${F}" stroke-width="2"/><path d="M70 160l6-10m14 14l2-12m24 14l-2-12m24 14l-4-12m24 12l-2-12m24 12l2-12m24 12l4-12m24 10l6-10" stroke="${F}" stroke-width="2"/>`
      + [[78, 70, 1], [132, 62, 0], [188, 58, 0], [242, 54, 0]].map(([x, h, lit]) => `<rect x="${x - 9}" y="${150 - h}" width="18" height="${h}" fill="${I}" stroke="${F}" stroke-width="2"/><path d="M${x} ${150 - h}v-6" stroke="${K}" stroke-width="2"/>${lit ? `<path d="M${x} ${150 - h - 6}c-8-8-6-15 0-24 6 9 8 16 0 24z" fill="${O}" stroke="${O}" stroke-width="2"/>` : ''}`).join('')),
    // 성탄절: 별과 구유(성육신)
    christmas: art('성탄절 — 별과 구유 그림', 320, 180, `<path d="M160 14l7 31 31 7-31 7-7 31-7-31-31-7 31-7z" fill="${O}" stroke="${O}" stroke-width="2"/>${hill('M0 150Q80 118 160 142T320 138V180H0z')}<path d="M118 128h84l-12 24h-60z" fill="${I}" stroke="${F}" stroke-width="2"/><path d="M132 152l-10 18M188 152l10 18M138 152l22 18 22-18" stroke="${F}" stroke-width="2"/><path d="M128 126l8-12m12 12l6-14m14 14l2-14m12 14l-2-12m12 12l-6-10" stroke="${O}" stroke-width="2"/>`),
    // 주현절: 빛이 퍼지는 별
    epiphany: art('주현절 — 빛이 퍼지는 별 그림', 320, 180, `<g stroke="${O}" stroke-width="2">${Array.from({ length: 12 }, (_, i) => { const a = i * Math.PI / 6; return `<path d="M${(160 + Math.cos(a) * 44).toFixed(1)} ${(78 + Math.sin(a) * 44).toFixed(1)}L${(160 + Math.cos(a) * 66).toFixed(1)} ${(78 + Math.sin(a) * 66).toFixed(1)}"/>`; }).join('')}</g><path d="M160 36l9 33 33 9-33 9-9 33-9-33-33-9 33-9z" fill="${O}" stroke="${O}" stroke-width="2"/>${hill('M0 158Q100 132 200 152T320 146V180H0z')}`),
    // 사순절: 언덕 위의 십자가
    lent: art('사순절 — 언덕 위의 십자가 그림', 320, 180, `<circle cx="236" cy="52" r="20" fill="${P}" stroke="${LN}" stroke-width="2"/>${hill('M0 150Q90 112 170 136T320 128V180H0z')}<path d="M160 30v100M132 62h56" stroke="${K}" stroke-width="7"/><path d="M96 142l12-6m100 4l14-4" stroke="${F}" stroke-width="2"/>`),
    // 부활절: 새벽 해가 떠오르는 언덕의 십자가
    easter: art('부활절 — 새벽 해와 십자가 그림', 320, 180, `<path d="M96 138a64 64 0 0 1 128 0z" fill="${O}" stroke="${O}" stroke-width="2"/><g stroke="${O}" stroke-width="2">${Array.from({ length: 9 }, (_, i) => { const a = Math.PI + (i + 0.5) * Math.PI / 9; return `<path d="M${(160 + Math.cos(a) * 76).toFixed(1)} ${(138 + Math.sin(a) * 76).toFixed(1)}L${(160 + Math.cos(a) * 94).toFixed(1)} ${(138 + Math.sin(a) * 94).toFixed(1)}"/>`; }).join('')}</g>${hill('M0 140Q80 128 160 138T320 136V180H0z', I)}<path d="M160 64v76M142 84h36" stroke="${K}" stroke-width="6"/>`),
    // 추수감사절: 곡식 이삭과 열매 바구니
    thanksgiving: art('추수감사절 — 곡식과 열매 바구니 그림', 320, 180, `<g stroke="${F}" stroke-width="2"><path d="M70 160Q56 120 74 74"/><path d="M250 160Q264 120 246 74"/></g><g fill="${O}" stroke="${O}" stroke-width="2"><path d="M74 74c-7-6-7-13 0-20 7 7 7 14 0 20z"/><path d="M70 96c-9-3-12-10-9-17 8 2 12 9 9 17z"/><path d="M68 116c-9-1-14-8-12-15 9 0 14 7 12 15z"/><path d="M246 74c7-6 7-13 0-20-7 7-7 14 0 20z"/><path d="M250 96c9-3 12-10 9-17-8 2-12 9-9 17z"/><path d="M252 116c9-1 14-8 12-15-9 0-14 7-12 15z"/></g><circle cx="124" cy="102" r="17" fill="${O}" stroke="${O}" stroke-width="2"/><circle cx="160" cy="92" r="19" fill="${P}" stroke="${F}" stroke-width="2"/><circle cx="198" cy="102" r="17" fill="${O}" stroke="${O}" stroke-width="2"/><path d="M96 112h128l-14 50H110z" fill="${I}" stroke="${F}" stroke-width="2"/><path d="M104 130h112M108 146h104M130 112l-4 50M160 112v50M190 112l4 50" stroke="${LN}" stroke-width="2"/>`),
    // 빈 화면: 열린 수첩과 연필
    notebook: art('빈 수첩 그림', 200, 120, `<path d="M20 22h72a8 8 0 0 1 8 8v78a8 8 0 0 0-8-8H20z" fill="${I}" stroke="${F}" stroke-width="2"/><path d="M180 22h-72a8 8 0 0 0-8 8v78a8 8 0 0 1 8-8h72z" fill="${I}" stroke="${F}" stroke-width="2"/><path d="M32 42h56M32 56h56M32 70h40M112 42h56M112 56h56" stroke="${LN}" stroke-width="2"/><path d="M150 96l22-28 8 6-22 28-10 4z" fill="${O}" stroke="${O}" stroke-width="2"/>`),
    // 빈 화면(인원): 얼굴 없는 사람 윤곽 셋
    people: art('빈 명단 그림', 200, 120, `<g fill="${I}" stroke="${F}" stroke-width="2"><circle cx="100" cy="42" r="15"/><path d="M70 98c0-17 13-28 30-28s30 11 30 28z"/><circle cx="50" cy="56" r="11"/><path d="M28 98c0-13 9-21 22-21 6 0 11 2 15 5"/><circle cx="150" cy="56" r="11"/><path d="M172 98c0-13-9-21-22-21-6 0-11 2-15 5"/></g><path d="M16 104h168" stroke="${LN}" stroke-width="2"/>`),
  };
  // 앱 아이콘: 사역 수첩(스프링 링·줄) 앞에 성경(십자가·가름끈)을 겹친 모양 — 포레스트 바탕, 납작한 색면
  const APP_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256"><rect width="256" height="256" rx="48" fill="${F}"/>
<rect x="92" y="38" width="116" height="160" rx="8" fill="${I}"/><path d="M110 76h70M110 98h70M110 120h46" stroke="${LN}" stroke-width="6" stroke-linecap="round"/><g fill="${O}">${[56, 80, 104, 128, 152, 176].map(y => `<circle cx="208" cy="${y}" r="6.5"/>`).join('')}</g>
<rect x="44" y="84" width="112" height="140" rx="8" fill="${O}"/><rect x="44" y="84" width="14" height="140" rx="4" fill="#7a4f10"/><path d="M104 114v62M82 138h44" stroke="${I}" stroke-width="10" stroke-linecap="round"/><path d="M134 224v24l-10-8-10 8v-24z" fill="${I}"/></svg>`;
  const PALETTE = { F, O, I, P, K, LN };
export { IC, ILLUS, APP_ICON, PALETTE };
