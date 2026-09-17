/* SPIKE C - Object Lens : hardcoded fixtures. No backend, no persistence. */
(function (global) {
  'use strict';

  var MONTH = { year: 2026, month: 9, label: '2026년 9월', today: '2026-09-17' };

  /* Exactly three lens kinds: vendor | event | schedule  */
  var OBJECTS = {
    'v-hansol': {
      id: 'v-hansol', kind: 'vendor', name: '한솔농원',
      contact: '김한솔 · 010-2201-4417', category: '농산물 / 사과·배',
      plan: '매주 토요일 (반복)', planExceptions: ['2026-09-19 불참', '2026-09-26 보류'],
      linkedEventIds: ['e-autumn'],
      attachments: { count: 3, kinds: '폴더 1 · 압축 1 · 문서 1' },
      tasks: [
        { id: 't-h1', title: '참가신청서 접수', state: 'done', due: '2026-09-02' },
        { id: 't-h2', title: '부스 배치 확정', state: 'active', due: '2026-09-17' },
        { id: 't-h3', title: '정산자료 제출', state: 'future', due: '2026-09-30' }
      ],
      history: ['09-14 참가계획 반복패턴 등록', '09-16 09-19 날짜예외 추가(불참)']
    },
    'v-baram': {
      id: 'v-baram', kind: 'vendor', name: '바람들녘',
      contact: '이바람 · 010-3388-0912', category: '가공식품 / 장류',
      plan: '매주 수요일 (반복)', planExceptions: ['2026-09-16 보류'],
      linkedEventIds: [],
      attachments: { count: 1, kinds: '폴더 1' },
      tasks: [
        { id: 't-b1', title: '위생교육 이수 확인', state: 'done', due: '2026-09-04' },
        { id: 't-b2', title: '판매품목 변경 검토', state: 'active', due: '2026-09-18' }
      ],
      history: ['09-10 반복패턴 수요일로 변경']
    },
    'v-dolsan': {
      id: 'v-dolsan', kind: 'vendor', name: '돌산수산',
      contact: '박돌산 · 010-7714-5520', category: '수산물 / 건어물',
      plan: '격주 토요일 (반복)', planExceptions: [],
      linkedEventIds: ['e-autumn'],
      attachments: { count: 0, kinds: '없음' },
      tasks: [
        { id: 't-d1', title: '냉장차량 배정', state: 'future', due: '2026-09-19' }
      ],
      history: ['09-08 격주 패턴 등록']
    },
    'e-autumn': {
      id: 'e-autumn', kind: 'event', name: '가을 로컬푸드 장터',
      venue: '군청 앞 광장', period: '2026-09-19 ~ 2026-09-20',
      vendorIds: ['v-hansol', 'v-dolsan'],
      attachments: { count: 5, kinds: '폴더 2 · 압축 1 · 문서 2' },
      tasks: [
        { id: 't-a1', title: '행사계획 결재', state: 'done', due: '2026-09-05' },
        { id: 't-a2', title: '부스 배치도 확정', state: 'active', due: '2026-09-17' },
        { id: 't-a3', title: '안전관리 점검', state: 'active', due: '2026-09-18' },
        { id: 't-a4', title: '결과보고 작성', state: 'future', due: '2026-09-28' }
      ],
      history: ['09-01 행사 등록', '09-12 참가업체 2곳 연결']
    },
    'e-training': {
      id: 'e-training', kind: 'event', name: '유통과 실무교육',
      venue: '농식품유통과 회의실', period: '2026-09-24',
      vendorIds: [],
      attachments: { count: 2, kinds: '문서 2' },
      tasks: [
        { id: 't-e1', title: '교육 대상자 취합', state: 'active', due: '2026-09-19' },
        { id: 't-e2', title: '교재 인쇄 의뢰', state: 'future', due: '2026-09-22' }
      ],
      history: ['09-09 교육 일정 확정']
    },
    's-budget': {
      id: 's-budget', kind: 'schedule', name: '3분기 예산 집행 점검',
      owner: '유통기획팀', time: '10:00 ~ 11:30', place: '과장실',
      attachments: { count: 1, kinds: '압축 1' },
      tasks: [
        { id: 't-s1', title: '집행내역 출력', state: 'done', due: '2026-09-10' },
        { id: 't-s2', title: '점검결과 정리', state: 'done', due: '2026-09-11' }
      ],
      history: ['09-03 일정 등록', '09-11 완료 처리']
    },
    's-visit': {
      id: 's-visit', kind: 'schedule', name: '현장 점검 방문',
      owner: '유통지원팀', time: '14:00 ~ 16:00', place: '가을장터 예정지',
      attachments: { count: 2, kinds: '폴더 1 · 문서 1' },
      tasks: [
        { id: 't-s3', title: '점검표 준비', state: 'done', due: '2026-09-16' },
        { id: 't-s4', title: '현장 사진 정리', state: 'active', due: '2026-09-17' },
        { id: 't-s5', title: '보완사항 통보', state: 'future', due: '2026-09-21' }
      ],
      history: ['09-15 방문 일정 등록']
    },
    's-report': {
      id: 's-report', kind: 'schedule', name: '행사 결과보고 작성',
      owner: '유통기획팀', time: '09:00 ~ 12:00', place: '사무실',
      attachments: { count: 0, kinds: '없음' },
      tasks: [
        { id: 't-s6', title: '정산자료 취합', state: 'future', due: '2026-09-28' }
      ],
      history: ['09-12 후속 일정 등록']
    }
  };

  /* date -> entries. Vendor entries carry a per-date status (MUST 3/4: 날짜 예외). */
  var ENTRIES = {
    '2026-09-02': [{ objectId: 'v-baram', status: '확정' }],
    '2026-09-05': [{ objectId: 'v-hansol', status: '확정' }, { objectId: 'v-dolsan', status: '확정' }],
    '2026-09-09': [{ objectId: 'v-baram', status: '확정' }],
    '2026-09-11': [{ objectId: 's-budget', status: '완료' }],
    '2026-09-12': [{ objectId: 'v-hansol', status: '확정' }],
    '2026-09-16': [{ objectId: 'v-baram', status: '보류' }],
    '2026-09-17': [{ objectId: 's-visit', status: '진행' }],
    '2026-09-19': [
      { objectId: 'e-autumn', status: '진행' },
      { objectId: 'v-hansol', status: '불참' },
      { objectId: 'v-dolsan', status: '확정' }
    ],
    '2026-09-20': [{ objectId: 'e-autumn', status: '진행' }],
    '2026-09-23': [{ objectId: 'v-baram', status: '확정' }],
    '2026-09-24': [{ objectId: 'e-training', status: '예정' }],
    '2026-09-26': [{ objectId: 'v-hansol', status: '보류' }],
    '2026-09-28': [{ objectId: 's-report', status: '예정' }],
    '2026-09-30': [{ objectId: 'v-baram', status: '확정' }]
  };

  var VENDOR_STATUS_CYCLE = ['확정', '보류', '불참'];
  var WORK_STATUS_CYCLE = ['예정', '진행', '완료'];

  global.SPIKE_FIXTURES = {
    MONTH: MONTH,
    OBJECTS: OBJECTS,
    ENTRIES: ENTRIES,
    VENDOR_STATUS_CYCLE: VENDOR_STATUS_CYCLE,
    WORK_STATUS_CYCLE: WORK_STATUS_CYCLE
  };
})(window);
