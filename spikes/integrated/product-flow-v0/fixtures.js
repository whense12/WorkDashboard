/* Integrated UX Prototype v0 — prototype fixture data only.
   이 파일은 프로토타입 픽스처다. 도메인 모델을 여기서 확정하지 않는다. */
'use strict';

const TODAY = '2026-09-18';            // 금요일
const MONTH = { year: 2026, month: 9 }; // 2026-09

const VENDORS = [
  { id: 'v01', name: '고성한과영농조합',   area: '고성읍',   rep: '김순덕' },
  { id: 'v02', name: '상리들녘농원',       area: '상리면',   rep: '박찬호' },
  { id: 'v03', name: '회화마을영어조합',   area: '회화면',   rep: '정미경' },
  { id: 'v04', name: '동해면수산',         area: '동해면',   rep: '최영달' },
  { id: 'v05', name: '거류산꿀벌농장',     area: '거류면',   rep: '한상우' },
  { id: 'v06', name: '마암참다래작목반',   area: '마암면',   rep: '오세진' },
  { id: 'v07', name: '영오청정미곡',       area: '영오면',   rep: '배동식' },
  { id: 'v08', name: '하이면해풍마늘',     area: '하이면',   rep: '윤길자' },
  { id: 'v09', name: '삼산포구건어물',     area: '삼산면',   rep: '강두식' },
  { id: 'v10', name: '개천면버섯마을',     area: '개천면',   rep: '신복례' },
  { id: 'v11', name: '구만들깨방앗간',     area: '구만면',   rep: '임태수' },
  { id: 'v12', name: '대가면단감농장',     area: '대가면',   rep: '노경자' },
  { id: 'v13', name: '영현흑염소농장',     area: '영현면',   rep: '서병국' },
  { id: 'v14', name: '고성명주양조장',     area: '고성읍',   rep: '문재식' },
  { id: 'v15', name: '철성유자가공',       area: '거류면',   rep: '황미숙' },
  { id: 'v16', name: '송학동떡공방',       area: '고성읍',   rep: '조은희' },
  { id: 'v17', name: '자란만굴수협',       area: '하일면',   rep: '권기태' },
  { id: 'v18', name: '옥천사산나물',       area: '개천면',   rep: '류정애' },
  { id: 'v19', name: '남산정육점',         area: '고성읍',   rep: '차용범' },
  { id: 'v20', name: '고성찰옥수수회',     area: '영오면',   rep: '민경섭' },
  { id: 'v21', name: '무량산도라지',       area: '영현면',   rep: '전수길' },
  { id: 'v22', name: '갈모봉표고',         area: '하이면',   rep: '남기영' }
];

const EVENTS = [
  { id: 'e1', name: '제28회 가을 농특산물 대축제', from: '2026-09-23', to: '2026-09-27',
    place: '고성종합운동장 특설무대', status: '확정', owner: '유통지원팀' },
  { id: 'e2', name: '고성 수산물 직거래 장터',     from: '2026-09-11', to: '2026-09-12',
    place: '동해면 해안주차장', status: '확정', owner: '수산유통팀' },
  { id: 'e3', name: '추석맞이 농특산물 기획전',     from: '2026-09-16', to: '2026-09-18',
    place: '고성읍 전통시장 광장', status: '확인 필요', owner: '유통지원팀' },
  { id: 'e4', name: '김장철 절임배추 예약판매 설명회', from: '2026-10-08', to: '2026-10-08',
    place: '농업기술센터 대회의실', status: '예정', owner: '유통지원팀' }
];

/* 일반 사무일정 — 행사와 같은 체계 안에 들어간다 (KERNEL MUST 1) */
const SCHEDULES = [
  { id: 's01', date: '2026-09-01', time: '09:30', title: '부서 주간회의',            status: '완료',      repeat: '매주 화 09:30', attach: 2 },
  { id: 's02', date: '2026-09-04', time: '14:00', title: '9월 정기 업무보고',        status: '완료',      repeat: '', attach: 3 },
  { id: 's03', date: '2026-09-07', time: '10:00', title: '예산 집행 점검',            status: '완료',      repeat: '매월 첫째 월', attach: 1 },
  { id: 's04', date: '2026-09-08', time: '09:30', title: '부서 주간회의',            status: '완료',      repeat: '매주 화 09:30', attach: 0 },
  { id: 's05', date: '2026-09-10', time: '13:30', title: '농산물 유통 실태 지도점검', status: '진행',      repeat: '', attach: 4 },
  { id: 's06', date: '2026-09-14', time: '17:00', title: '결산 자료 제출',            status: '확인 필요', repeat: '', attach: 2 },
  { id: 's07', date: '2026-09-15', time: '09:30', title: '부서 주간회의',            status: '완료',      repeat: '매주 화 09:30', attach: 0 },
  { id: 's08', date: '2026-09-18', time: '11:00', title: '추석 연휴 당직 편성',       status: '확인 필요', repeat: '', attach: 1 },
  { id: 's09', date: '2026-09-18', time: '15:00', title: '기획전 현장 점검',          status: '진행',      repeat: '', attach: 2 },
  { id: 's10', date: '2026-09-21', time: '10:00', title: '대축제 준비 점검회의',      status: '예정',      repeat: '', attach: 5 },
  { id: 's11', date: '2026-09-22', time: '09:30', title: '부서 주간회의',            status: '예정',      repeat: '매주 화 09:30', attach: 0 },
  { id: 's12', date: '2026-09-23', time: '08:00', title: '행사장 안전점검',          status: '예정',      repeat: '', attach: 3 },
  { id: 's13', date: '2026-09-25', time: '16:00', title: '중간 정산 자료 취합',       status: '예정',      repeat: '', attach: 1 },
  { id: 's14', date: '2026-09-29', time: '09:30', title: '10월 업무계획 수립',        status: '예정',      repeat: '', attach: 0 },
  { id: 's15', date: '2026-09-30', time: '14:00', title: '대축제 결산 보고',          status: '예정',      repeat: '', attach: 2 }
];

/* 업체 참가계획: 반복 패턴 + 특정 날짜 예외 (KERNEL MUST 3 / 4) */
const PLANS = [
  { vendorId: 'v01', eventId: 'e1', pattern: '대축제 기간 매일 (09-23~09-27)', dates: ['2026-09-23','2026-09-24','2026-09-25','2026-09-26','2026-09-27'],
    exceptions: [{ date: '2026-09-25', status: '불참', reason: '포장설비 점검' }] },
  { vendorId: 'v02', eventId: 'e1', pattern: '대축제 주말만 (09-26~09-27)', dates: ['2026-09-23','2026-09-26','2026-09-27'], exceptions: [] },
  { vendorId: 'v03', eventId: 'e1', pattern: '대축제 기간 매일', dates: ['2026-09-23','2026-09-24','2026-09-26','2026-09-27'], exceptions: [] },
  { vendorId: 'v04', eventId: 'e2', pattern: '수산물 장터 이틀 + 대축제 첫날', dates: ['2026-09-11','2026-09-12','2026-09-23'],
    exceptions: [{ date: '2026-09-12', status: '보류', reason: '기상 악화 대기' }] },
  { vendorId: 'v05', eventId: 'e1', pattern: '대축제 전반 3일', dates: ['2026-09-23','2026-09-24','2026-09-26'], exceptions: [] },
  { vendorId: 'v06', eventId: 'e3', pattern: '기획전 전일 + 대축제 첫날', dates: ['2026-09-16','2026-09-17','2026-09-18','2026-09-23'], exceptions: [] },
  { vendorId: 'v07', eventId: 'e1', pattern: '대축제 기간 매일', dates: ['2026-09-23','2026-09-24','2026-09-25','2026-09-26','2026-09-27'], exceptions: [] },
  { vendorId: 'v08', eventId: 'e3', pattern: '기획전 이틀 + 대축제', dates: ['2026-09-16','2026-09-18','2026-09-23','2026-09-26'], exceptions: [] },
  { vendorId: 'v09', eventId: 'e2', pattern: '수산물 장터 이틀', dates: ['2026-09-11','2026-09-12','2026-09-23'], exceptions: [] },
  { vendorId: 'v10', eventId: 'e1', pattern: '대축제 후반 2일', dates: ['2026-09-23','2026-09-26','2026-09-27'], exceptions: [] },
  { vendorId: 'v11', eventId: 'e1', pattern: '대축제 기간 매일', dates: ['2026-09-23','2026-09-24','2026-09-25','2026-09-26'],
    exceptions: [{ date: '2026-09-24', status: '보류', reason: '참가비 납부 확인 중' }] },
  { vendorId: 'v12', eventId: 'e1', pattern: '대축제 기간 매일', dates: ['2026-09-23','2026-09-24','2026-09-26','2026-09-27'], exceptions: [] },
  { vendorId: 'v13', eventId: 'e1', pattern: '대축제 첫날만', dates: ['2026-09-23'], exceptions: [] },
  { vendorId: 'v14', eventId: 'e1', pattern: '대축제 기간 매일', dates: ['2026-09-23','2026-09-24','2026-09-25','2026-09-26','2026-09-27'], exceptions: [] },
  { vendorId: 'v15', eventId: 'e3', pattern: '기획전 첫날 + 대축제', dates: ['2026-09-16','2026-09-23','2026-09-26'], exceptions: [] },
  { vendorId: 'v16', eventId: 'e3', pattern: '기획전 전일', dates: ['2026-09-16','2026-09-17','2026-09-18','2026-09-23'], exceptions: [] },
  { vendorId: 'v17', eventId: 'e2', pattern: '수산물 장터 이틀 + 대축제', dates: ['2026-09-11','2026-09-12','2026-09-23','2026-09-24'], exceptions: [] },
  { vendorId: 'v18', eventId: 'e1', pattern: '대축제 기간 매일', dates: ['2026-09-23','2026-09-24','2026-09-25','2026-09-26','2026-09-27'], exceptions: [] },
  { vendorId: 'v19', eventId: 'e1', pattern: '대축제 첫날 + 주말', dates: ['2026-09-23','2026-09-26'], exceptions: [] },
  { vendorId: 'v20', eventId: 'e1', pattern: '대축제 기간 매일', dates: ['2026-09-23','2026-09-24','2026-09-26','2026-09-27'], exceptions: [] },
  { vendorId: 'v21', eventId: 'e2', pattern: '수산물 장터 첫날', dates: ['2026-09-11'], exceptions: [] },
  { vendorId: 'v22', eventId: 'e3', pattern: '기획전 마지막날', dates: ['2026-09-17','2026-09-18'], exceptions: [] },
  { vendorId: 'v21', eventId: 'e4', pattern: '설명회 1회', dates: ['2026-10-08'], exceptions: [] }
];

/* 업무 — 예정 / 진행 / 완료 (KERNEL MUST 7) */
const WORKS = [
  { id: 'w01', ownerKind: 'event', ownerId: 'e1', title: '참가업체 모집 공고',      state: 'done',    due: '2026-08-20', attach: 3 },
  { id: 'w02', ownerKind: 'event', ownerId: 'e1', title: '부스 배치도 확정',        state: 'done',    due: '2026-09-10', attach: 2 },
  { id: 'w03', ownerKind: 'event', ownerId: 'e1', title: '무대 음향 업체 계약',      state: 'doing',   due: '2026-09-19', attach: 1 },
  { id: 'w04', ownerKind: 'event', ownerId: 'e1', title: '홍보물 배포 (읍면 12개소)', state: 'doing',  due: '2026-09-21', attach: 0 },
  { id: 'w05', ownerKind: 'event', ownerId: 'e1', title: '안전관리 계획 승인',        state: 'planned', due: '2026-09-22', attach: 4 },
  { id: 'w06', ownerKind: 'event', ownerId: 'e1', title: '정산 자료 취합',            state: 'planned', due: '2026-09-30', attach: 0 },
  { id: 'w07', ownerKind: 'event', ownerId: 'e2', title: '수산물 위생검사 의뢰',      state: 'done',    due: '2026-09-08', attach: 2 },
  { id: 'w08', ownerKind: 'event', ownerId: 'e2', title: '장터 운영 결과보고',        state: 'doing',   due: '2026-09-18', attach: 1 },
  { id: 'w09', ownerKind: 'event', ownerId: 'e3', title: '기획전 판매실적 집계',      state: 'doing',   due: '2026-09-19', attach: 2 },
  { id: 'w10', ownerKind: 'event', ownerId: 'e3', title: '상인회 협의 결과 정리',      state: 'planned', due: '2026-09-21', attach: 0 },
  { id: 'w11', ownerKind: 'vendor', ownerId: 'v01', title: '참가 신청서 접수',        state: 'done',    due: '2026-08-28', attach: 1 },
  { id: 'w12', ownerKind: 'vendor', ownerId: 'v01', title: '위생교육 이수증 확인',    state: 'done',    due: '2026-09-05', attach: 1 },
  { id: 'w13', ownerKind: 'vendor', ownerId: 'v01', title: '부스 전기용량 협의',      state: 'doing',   due: '2026-09-19', attach: 0 },
  { id: 'w14', ownerKind: 'vendor', ownerId: 'v01', title: '09-25 불참 대체업체 확보', state: 'planned', due: '2026-09-22', attach: 2 },
  { id: 'w15', ownerKind: 'vendor', ownerId: 'v04', title: '수산물 원산지 표시 점검',  state: 'doing',   due: '2026-09-19', attach: 1 },
  { id: 'w16', ownerKind: 'vendor', ownerId: 'v04', title: '보류일(09-12) 처리 결정',  state: 'planned', due: '2026-09-20', attach: 0 },
  { id: 'w17', ownerKind: 'vendor', ownerId: 'v11', title: '참가비 납부 확인',        state: 'doing',   due: '2026-09-20', attach: 1 },
  { id: 'w18', ownerKind: 'vendor', ownerId: 'v17', title: '활어차 진입 동선 협의',    state: 'done',    due: '2026-09-09', attach: 2 },
  { id: 'w19', ownerKind: 'schedule', ownerId: 's08', title: '당직자 명단 취합',      state: 'doing',   due: '2026-09-18', attach: 1 },
  { id: 'w20', ownerKind: 'schedule', ownerId: 's08', title: '비상연락망 갱신',        state: 'planned', due: '2026-09-22', attach: 0 },
  { id: 'w21', ownerKind: 'schedule', ownerId: 's08', title: '지난 연휴 당직일지 정리', state: 'done',   due: '2026-09-11', attach: 3 },
  { id: 'w22', ownerKind: 'schedule', ownerId: 's06', title: '세입세출 대조',          state: 'doing',   due: '2026-09-14', attach: 2 },
  { id: 'w23', ownerKind: 'schedule', ownerId: 's10', title: '점검회의 자료 작성',      state: 'planned', due: '2026-09-21', attach: 1 },
  { id: 'w24', ownerKind: 'schedule', ownerId: 's05', title: '지도점검 결과 통보',      state: 'doing',   due: '2026-09-21', attach: 4 }
];

/* 절차 (procedure) — Focus Surface 에서 본다 */
const PROCEDURES = {
  e1: { name: '행사 추진 절차', steps: [
    { title: '계획 수립', state: 'done' }, { title: '업체 모집', state: 'done' },
    { title: '부스 배치', state: 'done' }, { title: '안전계획 승인', state: 'doing' },
    { title: '행사 운영', state: 'planned' }, { title: '정산·결산', state: 'planned' } ] },
  e2: { name: '행사 추진 절차', steps: [
    { title: '계획 수립', state: 'done' }, { title: '위생검사', state: 'done' },
    { title: '장터 운영', state: 'done' }, { title: '결과보고', state: 'doing' } ] },
  e3: { name: '행사 추진 절차', steps: [
    { title: '계획 수립', state: 'done' }, { title: '상인회 협의', state: 'doing' },
    { title: '기획전 운영', state: 'doing' }, { title: '실적 집계', state: 'planned' } ] },
  v01: { name: '업체 참가 절차', steps: [
    { title: '신청서 접수', state: 'done' }, { title: '자격 확인', state: 'done' },
    { title: '위생교육 이수', state: 'done' }, { title: '부스 배정', state: 'doing' },
    { title: '참가비 납부', state: 'planned' }, { title: '참가 확정', state: 'planned' } ] },
  v04: { name: '업체 참가 절차', steps: [
    { title: '신청서 접수', state: 'done' }, { title: '자격 확인', state: 'done' },
    { title: '원산지 점검', state: 'doing' }, { title: '참가 확정', state: 'planned' } ] },
  v11: { name: '업체 참가 절차', steps: [
    { title: '신청서 접수', state: 'done' }, { title: '자격 확인', state: 'done' },
    { title: '참가비 납부', state: 'doing' }, { title: '참가 확정', state: 'planned' } ] },
  s08: { name: '사무일정 처리 절차', steps: [
    { title: '대상자 파악', state: 'done' }, { title: '명단 취합', state: 'doing' },
    { title: '결재 상정', state: 'planned' }, { title: '통보', state: 'planned' } ] },
  s06: { name: '사무일정 처리 절차', steps: [
    { title: '자료 수집', state: 'done' }, { title: '세입세출 대조', state: 'doing' },
    { title: '제출', state: 'planned' } ] }
};

/* 첨부 존재표시 — 존재만 표시한다. 파일 처리는 하지 않는다 (KERNEL MUST 8) */
const ATTACHMENTS = {
  e1: { folder: 2, zip: 1, doc: 5 }, e2: { folder: 1, zip: 0, doc: 2 }, e3: { folder: 1, zip: 1, doc: 3 },
  v01: { folder: 1, zip: 0, doc: 2 }, v04: { folder: 0, zip: 1, doc: 1 }, v11: { folder: 0, zip: 0, doc: 1 },
  s08: { folder: 0, zip: 0, doc: 1 }, s06: { folder: 1, zip: 0, doc: 2 }, s10: { folder: 1, zip: 1, doc: 3 }
};

/* 변경 이력 (KERNEL MUST 11) */
const HISTORY = {
  e1: [ { at: '2026-09-16 10:12', who: '나', what: '부스 배치도 v3 확정' },
        { at: '2026-09-12 15:40', who: '나', what: '참가업체 20개소로 확정' },
        { at: '2026-09-02 09:05', who: '나', what: '행사 기간 09-23~09-27 로 변경 (기존 09-24~09-27)' } ],
  e2: [ { at: '2026-09-12 17:20', who: '나', what: '둘째날 기상 악화로 일부 업체 보류' } ],
  e3: [ { at: '2026-09-17 11:02', who: '나', what: '상태를 확인 필요로 변경' } ],
  v01: [ { at: '2026-09-17 09:31', who: '나', what: '09-25 날짜예외 추가 — 불참 (포장설비 점검)' },
         { at: '2026-09-05 14:02', who: '나', what: '위생교육 이수증 확인' },
         { at: '2026-08-28 10:00', who: '나', what: '참가 신청서 접수' } ],
  v04: [ { at: '2026-09-12 08:40', who: '나', what: '09-12 날짜예외 추가 — 보류 (기상 악화 대기)' } ],
  v11: [ { at: '2026-09-15 16:11', who: '나', what: '09-24 날짜예외 추가 — 보류 (참가비 확인)' } ],
  s08: [ { at: '2026-09-18 08:50', who: '나', what: '상태를 확인 필요로 변경' } ],
  s06: [ { at: '2026-09-14 17:05', who: '나', what: '제출 기한 경과 — 확인 필요' } ]
};

/* D-day 20건. pinned:true 는 사용자가 직접 중요 표시한 항목 (독립 pin) */
const DDAY = [
  { id: 'd01', title: '결산 자료 제출 기한 경과', date: '2026-09-14', owner: '사무일정', pinned: false },
  { id: 'd02', title: '수산물 장터 결과보고 미제출', date: '2026-09-16', owner: '고성 수산물 직거래 장터', pinned: false },
  { id: 'd03', title: '기획전 판매실적 집계', date: '2026-09-17', owner: '추석맞이 농특산물 기획전', pinned: false },
  { id: 'd04', title: '추석 연휴 당직 편성', date: '2026-09-18', owner: '사무일정', pinned: true },
  { id: 'd05', title: '기획전 현장 점검', date: '2026-09-18', owner: '추석맞이 농특산물 기획전', pinned: false },
  { id: 'd06', title: '무대 음향 업체 계약', date: '2026-09-19', owner: '가을 농특산물 대축제', pinned: false },
  { id: 'd07', title: '고성한과영농조합 부스 전기용량 협의', date: '2026-09-19', owner: '고성한과영농조합', pinned: false },
  { id: 'd08', title: '동해면수산 보류일 처리 결정', date: '2026-09-20', owner: '동해면수산', pinned: false },
  { id: 'd09', title: '구만들깨방앗간 참가비 납부 확인', date: '2026-09-20', owner: '구만들깨방앗간', pinned: false },
  { id: 'd10', title: '대축제 준비 점검회의', date: '2026-09-21', owner: '사무일정', pinned: false },
  { id: 'd11', title: '홍보물 배포 완료', date: '2026-09-21', owner: '가을 농특산물 대축제', pinned: false },
  { id: 'd12', title: '안전관리 계획 승인', date: '2026-09-22', owner: '가을 농특산물 대축제', pinned: true },
  { id: 'd13', title: '제28회 가을 농특산물 대축제 개막', date: '2026-09-23', owner: '가을 농특산물 대축제', pinned: true },
  { id: 'd14', title: '중간 정산 자료 취합', date: '2026-09-25', owner: '사무일정', pinned: false },
  { id: 'd15', title: '대축제 폐막·철수', date: '2026-09-27', owner: '가을 농특산물 대축제', pinned: false },
  { id: 'd16', title: '10월 업무계획 수립', date: '2026-09-29', owner: '사무일정', pinned: false },
  { id: 'd17', title: '대축제 결산 보고', date: '2026-09-30', owner: '가을 농특산물 대축제', pinned: false },
  { id: 'd18', title: '절임배추 예약판매 설명회', date: '2026-10-08', owner: '김장철 절임배추 설명회', pinned: false },
  { id: 'd19', title: '3분기 유통실적 보고', date: '2026-10-15', owner: '사무일정', pinned: false },
  { id: 'd20', title: '내년 대축제 기본계획 착수', date: '2026-11-30', owner: '가을 농특산물 대축제', pinned: false }
];

/* 다른 업무 (Desktop Idle 에서 보이는 것) */
const DESKWORK = [
  { title: '2026년 농특산물 유통지원 계획(안).hwpx', kind: '한글', lines: [
      '1. 추진 배경', '  가. 지역 농특산물의 판로 확대 필요', '  나. 직거래 장터 참가업체 증가 (전년 대비 18%)',
      '2. 추진 방향', '  가. 행사·업체·업무를 하나의 일정 체계로 관리', '  나. 반복 참가계획과 날짜예외를 분리 관리',
      '3. 세부 추진계획', '  가. 가을 농특산물 대축제 (9.23.~9.27.)', '  나. 추석맞이 기획전 (9.16.~9.18.)' ] },
  { title: '9월_업체참가현황.xlsx', kind: '표계산', rows: [
      ['업체', '참가일수', '상태'], ['고성한과영농조합', '5', '확정'], ['상리들녘농원', '3', '확정'],
      ['동해면수산', '3', '보류 1'], ['구만들깨방앗간', '4', '보류 1'] ] }
];

/* ---- 파생 조회 ---- */
function dateKey(d) { return d; }
function participationOn(date) {
  const out = [];
  for (const p of PLANS) {
    if (!p.dates.includes(date)) continue;
    const ex = p.exceptions.find(e => e.date === date);
    out.push({
      vendorId: p.vendorId, eventId: p.eventId,
      vendor: VENDORS.find(v => v.id === p.vendorId),
      status: ex ? ex.status : '확정',
      exception: ex || null, plan: p
    });
  }
  return out;
}
function eventsOn(date) { return EVENTS.filter(e => date >= e.from && date <= e.to); }
function schedulesOn(date) { return SCHEDULES.filter(s => s.date === date); }
function worksOf(kind, id) { return WORKS.filter(w => w.ownerKind === kind && w.ownerId === id); }
function planOf(vendorId) { return PLANS.filter(p => p.vendorId === vendorId); }
function participationDates() {
  const set = new Set();
  PLANS.forEach(p => p.dates.forEach(d => set.add(d)));
  return [...set].sort();
}
function daysUntil(date) {
  const a = Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10));
  const b = Date.UTC(+TODAY.slice(0, 4), +TODAY.slice(5, 7) - 1, +TODAY.slice(8, 10));
  return Math.round((a - b) / 86400000);
}

window.FIX = { TODAY, MONTH, VENDORS, EVENTS, SCHEDULES, PLANS, WORKS, PROCEDURES,
  ATTACHMENTS, HISTORY, DDAY, DESKWORK, dateKey, participationOn, eventsOn, schedulesOn,
  worksOf, planOf, participationDates, daysUntil };
