# ADR-0003 타이포그래피: 공무원 서식 기반 맑은 고딕, 400/700

- 상태: 확정 (사용자 결정 2026-09-09 "한글 서체는 공무원 서식 기반으로")
- 관련: 발견 F01, F13, F21, G1-0, G2-0, G2-3 · 토큰 `docs/spec/design_tokens_v0.2.json` typography 절

## 맥락
- 명세 v2와 토큰 v0.1에는 서체·타입 램프가 전혀 없고(F21/G1-0), Fluent UI v9 기본 스택·Segoe UI에는 한글 글리프가 없어 한글 렌더 서체가 통제되지 않았다(facts: Fluent tokens fonts.ts, Windows typography). [확인]
- 두 서드파티 스킬의 서체 규칙은 전부 라틴 전용이고 한글 지침이 0건이다(F01/G2-0). [확인]
- 부서 보고서 양식(goseong-official-doc/references/form-spec.md)의 글꼴: 제목·소제목 HY헤드라인M, ❍ 1단 휴먼명조 15pt, • 2단 항목 맑은 고딕 13pt, ❖ 요약 맑은 고딕 15pt, ▣ 추진부서 굴림 14pt. [확인]

## 결정
1. 화면 UI 서체 = **맑은 고딕(시스템)**. 스택 `"Malgun Gothic","맑은 고딕","Segoe UI Variable Text","Segoe UI","NanumGothic","Noto Sans KR",sans-serif`. 맑은 고딕을 선두에 두어 한글·라틴·숫자를 한 서체로 조판한다(기준선 불일치 방지).
2. 굵기는 **400/700만**. 맑은 고딕에는 Semibold가 없어(Regular/Bold/Semilight) 독트린 초안의 600 슬롯은 전부 700으로 치환. 뷰당 Bold ≤2.
3. 램프(normal): anchor 28/36·700(위젯 날짜) / title 20/28·700 / subtitle 16/22·700 / body 14/20·400 / bodyStrong 14/20·700(결론형 요약) / caption 12/16·400 / micro 11/14(라틴·숫자 전용). compact는 크기를 내리지 않고 행 높이·패딩만 줄인다. 한글 12px 하한.
4. 서식 대응: 제목·소제목 → anchor/title, ❖ 요약 → bodyStrong 결론형 한 줄, • 2단 → body, ❍ 1단(명조) → 섹션 caption 라벨(명조 미사용), ▣ 추진부서(굴림) → 미사용.
5. HY헤드라인M·휴먼명조·굴림은 한컴 동봉 인쇄용 서체(재배포 불가, 12–14px UI 부적합) → 화면 UI 미사용. Phase 6 인쇄/보고 뷰에서 `local()` 존재 시에만 선택 사용 [Claude 제안].
6. 숫자는 같은 스택 + `font-variant-numeric: tabular-nums`. 맑은 고딕의 tnum 지원은 Windows 실측 항목 [미확인]; 미지원 시 숫자 슬롯 고정폭으로 대체.
7. Linux 개발 환경에는 맑은 고딕이 없으므로 NanumGothic(fonts-nanum, OFL)을 **대체 렌더 전용**으로 설치하고 저장소에는 넣지 않는다. 프로토타입의 font-guard가 실제 렌더 서체를 화면과 결과표에 기록하며, 조판 승인은 Windows 열람 후로 유보(G2-3).

## 대안과 기각 사유
- Pretendard Variable 번들(OFL, 굵기 축 일치, Linux 재현 가능): 사용자 결정(서식 기반)과 불일치, 번들 1~2MB·WPF 폴백 동일 서체 문제. [폐기]
- Noto Sans KR 번들: 위와 같음 + 용량. [폐기]
- 서식 서체(HY헤드라인M·휴먼명조)를 UI에 그대로: 재배포 불가·인쇄용 굵기·12px 가독성 불량. [폐기, 인쇄 뷰 한정 보류]
- Segoe UI 선두 + 맑은 고딕 폴백: 라틴/한글 기준선·굵기 불일치 위험(facts: 맑은 고딕 메트릭) → 맑은 고딕 선두로 결정.

## 결과
- 토큰 v0.2 typography 절, 독트린 `docs/design/doctrine.md`, 스킬 `design-doctrine/references/typography-ko.md`에 반영.
- Windows 실측 항목(인계 체크리스트): 혼합 문자 한 줄의 700 굵기·기준선, tnum, 125/150% DPI 한글 12px 가독성.
