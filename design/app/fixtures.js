/* 검수 픽스처 — 가짜 데이터로 통과한 화면은 무효.
 * 경계 전수: .claude/skills/design-doctrine/references/fixtures.md
 * 난수 0 · 외부 요청 0 · classic script(file:// 더블클릭으로 열리게; ES module은 file://에서 차단됨)
 * 날짜는 전부 'YYYY-MM-DD' 로컬 문자열(Asia/Seoul) — 정오표 G5-1 기본값 */
var WD = window.WD || (window.WD = {});

WD.TODAY = "2026-09-24"; // 목 — 오늘 7건 중 확인 필요 3
WD.NOW = "14:05";

WD.events = [
  { id: "E1", name: "가을 직거래장터",        start_date: "2026-09-12", end_date: "2026-10-31", location: "고성읍 공설운동장",      status: "confirmed" },
  { id: "E2", name: "공룡나라 직거래장터",    start_date: "2026-10-03", end_date: "2026-12-20", location: "당항포관광지 주차장",    status: "confirmed" },
  { id: "E3", name: "연말 농특산물 특판전",   start_date: "2026-12-19", end_date: "2027-01-11", location: "고성군농산물유통센터",   status: "needs_confirmation" }
];

/* 업체 28곳 — 18자+ 3곳 · 동명 2곳(고성수산) · 법인격 접두어 5종(㈜/영농조합법인/주식회사/유한회사/농업회사법인) */
WD.vendors = [
  { id: "V01", name: "고성수산",                              contact_name: "김○○", contact_phone: "010-2345-6789", products: ["생미역","건멸치","물메기"], status: "confirmed" },
  { id: "V02", name: "고성청과",                              contact_name: "박○○", contact_phone: "010-3456-7890", products: ["단감","배"], status: "confirmed" },
  { id: "V03", name: "㈜하이면친환경농업회사법인",             contact_name: "이○○", contact_phone: "010-4567-8901", products: ["친환경쌀","찹쌀","현미","흑미","귀리","보리","수수","기장"], status: "confirmed" },
  { id: "V04", name: "영농조합법인 고성들녘",                  contact_name: "최○○", contact_phone: "010-5678-9012", products: ["방울토마토","파프리카"], status: "confirmed" },
  { id: "V05", name: "삼산딸기작목반",                         contact_name: "정○○", contact_phone: "010-6789-0123", products: ["설향딸기"], status: "needs_confirmation" },
  { id: "V06", name: "거류참다래영농조합",                     contact_name: "강○○", contact_phone: "010-7890-1234", products: ["참다래"], status: "confirmed" },
  { id: "V07", name: "유한회사 대가한과",                      contact_name: "조○○", contact_phone: "010-8901-2345", products: ["유과","약과"], status: "confirmed" },
  { id: "V08", name: "회화양봉",                               contact_name: "윤○○", contact_phone: "010-9012-3456", products: ["아카시아꿀","밤꿀"], status: "confirmed" },
  { id: "V09", name: "농업회사법인 마암표고농장",              contact_name: "장○○", contact_phone: "010-0123-4567", products: ["생표고","건표고"], status: "confirmed" },
  { id: "V10", name: "개천쌀작목반",                           contact_name: "임○○", contact_phone: "010-1234-5678", products: ["백미"], status: "confirmed" },
  { id: "V11", name: "동해자연산미역",                         contact_name: "한○○", contact_phone: "010-2345-6780", products: ["자연산미역","돌미역"], status: "confirmed" },
  { id: "V12", name: "고성수산",                               contact_name: "오○○", contact_phone: "010-3456-7801", products: ["굴","바지락"], status: "needs_confirmation" },
  { id: "V13", name: "상리방앗간",                             contact_name: "서○○", contact_phone: "010-4567-8012", products: ["참기름","들기름"], status: "confirmed" },
  { id: "V14", name: "하일멸치",                               contact_name: "신○○", contact_phone: "010-5678-9023", products: ["볶음용멸치","국물멸치"], status: "cancelled" },
  { id: "V15", name: "영현흑돼지농장",                         contact_name: "권○○", contact_phone: "010-6789-0134", products: ["삼겹","목살"], status: "confirmed" },
  { id: "V16", name: "구만감자",                               contact_name: "황○○", contact_phone: "010-7890-1245", products: ["수미감자"], status: "needs_confirmation" },
  { id: "V17", name: "당항포어촌계직판장 수산물가공사업부",     contact_name: "안○○", contact_phone: "010-8901-2356", products: ["손질갑오징어","반건조볼락","건오징어"], status: "confirmed" },
  { id: "V18", name: "고성군농업기술센터 가공품연구회 시제품반", contact_name: "송○○", contact_phone: "010-9012-3467", products: ["가공시제품"], status: "needs_confirmation" },
  { id: "V19", name: "주식회사 소가야전통장류",                contact_name: "류○○", contact_phone: "010-0123-4578", products: ["된장","간장","고추장"], status: "confirmed" },
  { id: "V20", name: "거류우리밀",                             contact_name: "전○○", contact_phone: "010-1234-5689", products: ["우리밀가루"], status: "confirmed" },
  { id: "V21", name: "영농조합법인 고성들녘친환경농산물유통",   contact_name: "고○○", contact_phone: "010-2345-6791", products: ["친환경채소"], status: "confirmed" },
  { id: "V22", name: "영오들기름",                             contact_name: "문○○", contact_phone: "010-3456-7802", products: ["들기름"], status: "confirmed" },
  { id: "V23", name: "하이면굴구이",                           contact_name: "배○○", contact_phone: "010-4567-8013", products: ["구이용굴"], status: "confirmed" },
  { id: "V24", name: "마암단호박",                             contact_name: "백○○", contact_phone: "010-5678-9024", products: ["단호박"], status: "confirmed" },
  { id: "V25", name: "고성백서향농원",                         contact_name: "남○○", contact_phone: "010-6789-0135", products: ["백서향","화분"], status: "confirmed" },
  { id: "V26", name: "철성한우",                               contact_name: "유○○", contact_phone: "010-7890-1246", products: ["정육","국거리"], status: "confirmed" },
  { id: "V27", name: "대흥농원",                               contact_name: "노○○", contact_phone: "010-8901-2357", products: ["블루베리"], status: "confirmed" },
  { id: "V28", name: "삼산해풍쑥",                             contact_name: "심○○", contact_phone: "010-9012-3468", products: ["해풍쑥"], status: "confirmed" }
];

/* 참가계획 — weekdays는 ISO 1=월 … 7=일 (정오표 G5-2 기본값)
 * 경계: 월 경계 · 연말 경계 · 단일일 · weekdays 0개(무효) · 같은 (행사,업체) 중첩 2건 */
WD.plans = [
  { id: "P01", event_id: "E1", vendor_id: "V01", start_date: "2026-09-12", end_date: "2026-10-31", weekdays: [5,6],   status: "confirmed" },
  { id: "P02", event_id: "E1", vendor_id: "V02", start_date: "2026-09-12", end_date: "2026-10-31", weekdays: [6],     status: "confirmed" },
  { id: "P03", event_id: "E1", vendor_id: "V03", start_date: "2026-09-19", end_date: "2026-10-24", weekdays: [6,7],   status: "confirmed" },
  { id: "P04", event_id: "E1", vendor_id: "V04", start_date: "2026-09-12", end_date: "2026-10-03", weekdays: [5,6],   status: "confirmed" },
  { id: "P05", event_id: "E1", vendor_id: "V05", start_date: "2026-09-12", end_date: "2026-10-31", weekdays: [6],     status: "needs_confirmation" },
  { id: "P06", event_id: "E1", vendor_id: "V06", start_date: "2026-10-01", end_date: "2026-10-31", weekdays: [4,5,6], status: "confirmed" },
  { id: "P07", event_id: "E1", vendor_id: "V07", start_date: "2026-09-24", end_date: "2026-09-24", weekdays: [4],     status: "confirmed" },
  { id: "P08", event_id: "E1", vendor_id: "V08", start_date: "2026-09-12", end_date: "2026-10-31", weekdays: [6,7],   status: "confirmed" },
  { id: "P09", event_id: "E1", vendor_id: "V09", start_date: "2026-09-12", end_date: "2026-10-31", weekdays: [5,6],   status: "confirmed" },
  { id: "P10", event_id: "E1", vendor_id: "V10", start_date: "2026-09-26", end_date: "2026-10-31", weekdays: [6],     status: "confirmed" },
  { id: "P11", event_id: "E1", vendor_id: "V11", start_date: "2026-09-12", end_date: "2026-10-31", weekdays: [6,7],   status: "confirmed" },
  { id: "P12", event_id: "E1", vendor_id: "V12", start_date: "2026-09-12", end_date: "2026-10-31", weekdays: [5,6],   status: "needs_confirmation" },
  { id: "P13", event_id: "E1", vendor_id: "V13", start_date: "2026-09-12", end_date: "2026-10-31", weekdays: [6],     status: "confirmed" },
  { id: "P14", event_id: "E1", vendor_id: "V15", start_date: "2026-10-02", end_date: "2026-10-31", weekdays: [5,6],   status: "confirmed" },
  { id: "P15", event_id: "E1", vendor_id: "V17", start_date: "2026-09-12", end_date: "2026-10-31", weekdays: [6],     status: "confirmed" },
  { id: "P16", event_id: "E1", vendor_id: "V19", start_date: "2026-09-12", end_date: "2026-10-31", weekdays: [5,6,7], status: "confirmed" },
  { id: "P17", event_id: "E1", vendor_id: "V20", start_date: "2026-09-12", end_date: "2026-10-31", weekdays: [6],     status: "confirmed" },
  { id: "P18", event_id: "E1", vendor_id: "V21", start_date: "2026-09-12", end_date: "2026-10-31", weekdays: [6,7],   status: "confirmed" },
  { id: "P19", event_id: "E1", vendor_id: "V22", start_date: "2026-09-12", end_date: "2026-10-31", weekdays: [6],     status: "confirmed" },
  { id: "P20", event_id: "E1", vendor_id: "V23", start_date: "2026-10-03", end_date: "2026-10-31", weekdays: [6],     status: "confirmed" },
  { id: "P21", event_id: "E1", vendor_id: "V24", start_date: "2026-09-12", end_date: "2026-10-31", weekdays: [6],     status: "confirmed" },
  { id: "P22", event_id: "E1", vendor_id: "V25", start_date: "2026-09-12", end_date: "2026-10-31", weekdays: [6,7],   status: "confirmed" },
  { id: "P23", event_id: "E1", vendor_id: "V26", start_date: "2026-09-12", end_date: "2026-10-31", weekdays: [6],     status: "confirmed" },
  { id: "P24", event_id: "E1", vendor_id: "V27", start_date: "2026-09-12", end_date: "2026-10-31", weekdays: [6],     status: "confirmed" },
  { id: "P25", event_id: "E1", vendor_id: "V28", start_date: "2026-09-12", end_date: "2026-10-31", weekdays: [6],     status: "confirmed" },
  { id: "P26", event_id: "E1", vendor_id: "V18", start_date: "2026-09-12", end_date: "2026-10-31", weekdays: [6],     status: "needs_confirmation" },
  { id: "P27", event_id: "E2", vendor_id: "V01", start_date: "2026-10-03", end_date: "2026-12-20", weekdays: [7],     status: "confirmed" },
  { id: "P28", event_id: "E2", vendor_id: "V02", start_date: "2026-10-03", end_date: "2026-11-30", weekdays: [3,7],   status: "confirmed" },
  /* 중첩 충돌: 같은 (행사,업체)에 기간이 겹치는 계획 2건 — 불변식 위반(G5-3) */
  { id: "P29", event_id: "E2", vendor_id: "V02", start_date: "2026-11-01", end_date: "2026-12-20", weekdays: [7],     status: "confirmed" },
  /* weekdays 0개 = 무효 입력 — 참가일 0일로 계산되어야 한다 */
  { id: "P30", event_id: "E2", vendor_id: "V16", start_date: "2026-10-03", end_date: "2026-12-20", weekdays: [],      status: "needs_confirmation" },
  /* 연말 경계: 해를 넘는 계획 */
  { id: "P31", event_id: "E3", vendor_id: "V19", start_date: "2026-12-19", end_date: "2027-01-11", weekdays: [6,7],   status: "needs_confirmation" },
  { id: "P32", event_id: "E3", vendor_id: "V07", start_date: "2026-12-19", end_date: "2027-01-11", weekdays: [6],     status: "confirmed" }
];

/* 예외 — type: exclude(이 날만 불참) / include(이 날만 참가)
 * 경계: 10/5~10/11 한 주에 3개 겹침 · 계획 기간 밖 고아 1건 · 요일 밖 include · 요일 안 exclude */
WD.exceptions = [
  { id: "X01", plan_id: "P01", date: "2026-10-10", type: "exclude", reason: "선박 수리" },
  { id: "X02", plan_id: "P02", date: "2026-10-08", type: "include", reason: "추가 물량 소화" },
  { id: "X03", plan_id: "P09", date: "2026-10-09", type: "exclude", reason: "종균 입상" },
  { id: "X04", plan_id: "P05", date: "2026-10-03", type: "exclude", reason: "수확 지연" },
  { id: "X05", plan_id: "P08", date: "2026-09-24", type: "include", reason: "시음 행사" },
  /* 고아 예외: P04는 10/03에 끝나는데 11/15에 예외가 남아 있다 */
  { id: "X06", plan_id: "P04", date: "2026-11-15", type: "include", reason: "계획 축소 전에 잡아둔 날" },
  { id: "X07", plan_id: "P31", date: "2026-12-25", type: "exclude", reason: "성탄절 휴무" }
];

/* 사무일정·업무(Task) — category: office(사무) / vendor(업체 연락·확인)
 * 날짜 분포: 9/24 7건(확인 필요 3) · 9/25 1건 · 9/27 0건 · 10/10 23건 */
WD.tasks = (function () {
  var t = [
    { id: "T01", title: "참가업체 확정 명단 과장 보고",        date: "2026-09-24", time: "09:30", category: "office",  status: "confirmed",         event_id: "E1", vendor_id: null },
    { id: "T02", title: "부스 전기인입 용량 재단 협의",         date: "2026-09-24", time: "11:00", category: "office",  status: "needs_confirmation", event_id: "E1", vendor_id: null },
    { id: "T03", title: "참가비 입금 확인",                    date: "2026-09-24", time: "13:30", category: "vendor",  status: "needs_confirmation", event_id: "E1", vendor_id: "V05" },
    { id: "T04", title: "품목 변경 요청 확인",                 date: "2026-09-24", time: "14:00", category: "vendor",  status: "confirmed",          event_id: "E1", vendor_id: "V01" },
    { id: "T05", title: "시음 행사 물품 수량 확인",             date: "2026-09-24", time: "15:00", category: "vendor",  status: "needs_confirmation", event_id: "E1", vendor_id: "V08" },
    { id: "T06", title: "명패 제작 시안 검토",                 date: "2026-09-24", time: "16:00", category: "office",  status: "confirmed",          event_id: "E1", vendor_id: null },
    { id: "T07", title: "사전점검 일정 통보",                  date: "2026-09-24", time: "17:00", category: "office",  status: "confirmed",          event_id: "E1", vendor_id: null },
    { id: "T08", title: "천막 임차 계약 검토",                 date: "2026-09-25", time: "10:00", category: "office",  status: "confirmed",          event_id: "E1", vendor_id: null },
    { id: "T09", title: "10월 운영일 배치 확정",               date: "2026-09-28", time: "09:00", category: "office",  status: "needs_confirmation", event_id: "E1", vendor_id: null },
    { id: "T10", title: "공룡나라 장터 업체 모집 공고",         date: "2026-09-30", time: "09:00", category: "office",  status: "confirmed",          event_id: "E2", vendor_id: null }
  ];
  /* 10/10(토) 23건 — 결정적 생성(난수 0) */
  var names = ["부스 배치 확인","간판 설치 확인","전기 분전반 점검","주차 안내 배치","현수막 게시","쓰레기 수거 협의","원산지 표시 점검","저울 검정 확인","시식대 위치 조정","방역 물품 배치","안내 방송 문안","행사 사진 기록","카드 단말기 점검","잔돈 준비","우천 대비 천막","업체 출입증 배부","정산 양식 배부","이벤트 경품 확인","소방 통로 확보","의자·테이블 추가","명패 교체","민원 응대 기록","마감 정산 취합"];
  for (var i = 0; i < names.length; i++) {
    t.push({
      id: "TA" + (i + 11),
      title: names[i],
      date: "2026-10-10",
      time: (String(8 + Math.floor(i / 3)).padStart(2, "0")) + ":" + ["00", "20", "40"][i % 3],
      category: i % 4 === 0 ? "vendor" : "office",
      status: i % 7 === 0 ? "needs_confirmation" : "confirmed",
      event_id: "E1",
      vendor_id: i % 4 === 0 ? WD.vendors[i % WD.vendors.length].id : null
    });
  }
  return t;
})();

/* 첨부 20개(V03) · 변경 이력 100건(V01) — 가상 스크롤·밀도 검수용, 난수 0 */
WD.attachments = (function () {
  var a = [], kind = ["사업자등록증", "통장사본", "원산지증명", "품목사진", "안전성검사서"];
  for (var i = 0; i < 20; i++) {
    a.push({ id: "A" + (i + 1), owner_id: "V03", filename: kind[i % 5] + "_" + (2026 - (i % 3)) + "_" + (i + 1) + ".pdf",
             file_size: 48 * 1024 + i * 7331, added_at: "2026-0" + (7 + (i % 3)) + "-" + String(1 + (i % 28)).padStart(2, "0") + " 09:" + String(10 + (i % 49)).padStart(2, "0"),
             missing: i === 13 });
  }
  return a;
})();

WD.audit = (function () {
  var r = [], acts = ["참가요일 변경", "연락처 수정", "품목 추가", "이 날짜만 변경", "상태 변경", "메모 수정"];
  var prev = ["금·토", "010-2345-678*", "물메기", "참가", "확인 필요", "—"];
  var next = ["금·토·일", "010-2345-678*", "물메기·건멸치", "불참", "확정", "선박 수리"];
  for (var i = 0; i < 100; i++) {
    var k = i % 6;
    r.push({ id: "L" + (i + 1), entity_type: "Vendor", entity_id: "V01", action: acts[k],
             previous_value: prev[k], new_value: next[k], actor: "GOSEONG\\nongsan01",
             timestamp: "2026-0" + (6 + (i % 4)) + "-" + String(1 + (i % 28)).padStart(2, "0") + " " + String(9 + (i % 9)).padStart(2, "0") + ":" + String(i % 60).padStart(2, "0") });
  }
  return r;
})();
