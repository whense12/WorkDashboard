/* SPIKE D - hardcoded fixtures. No backend, no storage, no persistence. */
/* days = 마감까지 남은 일수. 음수 = 기한 지남. 고정 정수로 두어 테스트를 결정적으로 만든다. */
(function () {
  const F3 = [
    { id: 'a1', title: '업체 참가신청 접수 마감', event: '가을 농특산물 대축제', days: -1 },
    { id: 'a2', title: '행사장 배치도 확정', event: '가을 농특산물 대축제', days: 2 },
    { id: 'a3', title: '상반기 정산 마감', event: '정산', days: 9 }
  ];

  const F8 = [
    { id: 'b1', title: '업체 참가신청 접수 마감', event: '가을 농특산물 대축제', days: -3 },
    { id: 'b2', title: '보조금 집행 잔액 보고', event: '정산', days: -1 },
    { id: 'b3', title: '행사장 배치도 확정', event: '가을 농특산물 대축제', days: 0 },
    { id: 'b4', title: '가판대 임차 계약', event: '가을 농특산물 대축제', days: 4 },
    { id: 'b5', title: '가격표시제 점검 통보', event: '지도점검', days: 4 },
    { id: 'b6', title: '직거래장터 운영일지 제출', event: '직거래장터', days: 11 },
    { id: 'b7', title: '추석 성수품 수급 회의', event: '수급대책', days: 23 },
    { id: 'b8', title: '내년도 사업계획 초안', event: '사업계획', days: 45 }
  ];

  const F20 = [
    { id: 'c01', title: '업체 참가신청 접수 마감', event: '가을 농특산물 대축제', days: -6 },
    { id: 'c02', title: '보조금 집행 잔액 보고', event: '정산', days: -3 },
    { id: 'c03', title: '부스 전기공사 발주', event: '가을 농특산물 대축제', days: -1 },
    { id: 'c04', title: '행사장 배치도 확정', event: '가을 농특산물 대축제', days: 0 },
    { id: 'c05', title: '가격표시제 점검 통보', event: '지도점검', days: 0 },
    { id: 'c06', title: '가판대 임차 계약', event: '가을 농특산물 대축제', days: 2 },
    { id: 'c07', title: '안전관리계획 제출', event: '가을 농특산물 대축제', days: 3 },
    { id: 'c08', title: '직거래장터 참가업체 확정', event: '직거래장터', days: 5 },
    { id: 'c09', title: '천막 임차 견적 비교', event: '가을 농특산물 대축제', days: 5 },
    { id: 'c10', title: '홍보물 인쇄 입고', event: '홍보', days: 7 },
    { id: 'c11', title: '직거래장터 운영일지 제출', event: '직거래장터', days: 9 },
    { id: 'c12', title: '위생교육 이수 확인', event: '지도점검', days: 12 },
    { id: 'c13', title: '정산 증빙 스캔 보관', event: '정산', days: 14 },
    { id: 'c14', title: '추석 성수품 수급 회의', event: '수급대책', days: 18 },
    { id: 'c15', title: '온라인몰 기획전 소재 마감', event: '홍보', days: 21 },
    { id: 'c16', title: '가을 축제 결과보고 초안', event: '가을 농특산물 대축제', days: 26 },
    { id: 'c17', title: '농가 교육 일정 공지', event: '농가교육', days: 30 },
    { id: 'c18', title: '내년도 사업계획 초안', event: '사업계획', days: 38 },
    { id: 'c19', title: '장비 정기점검 신청', event: '지도점검', days: 52 },
    { id: 'c20', title: '연말 재고 실사 준비', event: '정산', days: 74 }
  ];

  window.FIXTURES = { 3: F3, 8: F8, 20: F20 };
})();
