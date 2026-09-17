/* Hardcoded fixtures for the calendar-density spike. No backend, no persistence. */
(function () {
  "use strict";

  // 44 vendor names. Densities reuse the head of this pool so the same vendor
  // recurs across dates (participation plans repeat in the real product).
  var VENDOR_POOL = [
    "고성한과", "동해수산물유통", "봉평메밀식품", "남해죽방멸치", "금강로컬푸드",
    "청학골된장", "해운대수제어묵", "강진청자공방", "영덕대게직판", "지리산흑돼지",
    "완도전복영어조합", "무주머루와인", "포항구룡포과메기", "상주곶감마을", "제주감귤농원",
    "안동간고등어", "울릉도호박엿", "보성녹차원", "횡성한우직거래", "통영굴수협",
    "여수갓김치", "임실치즈마을", "정선황기영농조합", "산청곶감", "밀양얼음골사과",
    "서산육쪽마늘", "고창복분자", "담양죽순가공", "김해단감작목반", "괴산청결고추",
    "평창더덕영농조합", "남원추어탕가공", "영월곤드레", "거창사과원예", "함안수박작목반",
    "부여밤가공센터", "의성마늘농협", "홍천잣영농조합", "장수오미자", "창녕양파유통",
    "성주참외작목반", "논산딸기연구회", "강화순무영농조합", "진도울금농원"
  ];

  function vendors(n) { return VENDOR_POOL.slice(0, n); }

  // September 2026. The five benchmark densities sit on five different weeks so
  // each week row has exactly one busy day (variable-height rows are visible).
  var DAYS = [
    { date: "2026-09-01", general: ["사무실 비품 신청 마감"], vendors: [] },
    { date: "2026-09-03", general: ["팀 주간회의 10:00"], vendors: vendors(1), benchmark: 1 },
    { date: "2026-09-07", general: [], vendors: [VENDOR_POOL[40], VENDOR_POOL[41]] },
    { date: "2026-09-09", general: ["출장 정산 마감"], vendors: vendors(5), benchmark: 5 },
    { date: "2026-09-11", general: ["행사장 전기 안전점검"], vendors: [] },
    { date: "2026-09-15", general: [], vendors: [VENDOR_POOL[41], VENDOR_POOL[42], VENDOR_POOL[43]] },
    { date: "2026-09-16", general: ["부스 배치도 확정"], vendors: vendors(10), benchmark: 10 },
    { date: "2026-09-21", general: ["추석 연휴 근무표 제출"], vendors: [] },
    { date: "2026-09-23", general: ["행사 운영인력 교육"], vendors: vendors(20), benchmark: 20 },
    { date: "2026-09-25", general: ["정산 서류 1차 검토"], vendors: [] },
    { date: "2026-09-30", general: ["가을 대축제 개막"], vendors: vendors(40), benchmark: 40 }
  ];

  window.FIXTURES = {
    year: 2026,
    month: 9,
    label: "2026년 9월",
    vendorPool: VENDOR_POOL,
    days: DAYS,
    byDate: DAYS.reduce(function (acc, d) { acc[d.date] = d; return acc; }, {}),
    benchmarks: DAYS.filter(function (d) { return d.benchmark; })
      .map(function (d) { return { date: d.date, density: d.benchmark, vendors: d.vendors }; })
  };
})();
