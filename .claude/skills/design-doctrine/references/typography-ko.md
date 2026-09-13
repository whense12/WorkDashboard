# 타이포그래피·한글 규약 (ADR-0003, 토큰 v0.2 typography)

## 서체
- 결정 [사용자 결정]: 공무원 서식 기반 → 부서 보고서 양식의 본문 서체 **맑은 고딕(시스템)**.
- 스택: `"Malgun Gothic", "맑은 고딕", "Segoe UI Variable Text", "Segoe UI", "NanumGothic", "Noto Sans KR", sans-serif`
  - 맑은 고딕 선두: 한글·라틴·숫자를 한 서체로 조판 → 기준선 불일치 방지.
  - NanumGothic/Noto Sans KR: Linux 개발 환경 대체 렌더 전용(저장소·설치본 미포함).
- 서식 대응: 제목·소제목(HY헤드라인M) → anchor/title 700 · ❖ 요약(맑은 고딕 15pt) → bodyStrong 결론형 한 줄 · • 2단(맑은 고딕 13pt) → body · ❍ 1단(휴먼명조) → 섹션 caption 라벨 · ▣ 추진부서(굴림) → 미사용. 한컴 동봉 서체는 화면 UI에 쓰지 않는다(인쇄 뷰에서 `local()` 존재 시 선택).

## 굵기·램프
| 역할 | normal | compact | 굵기 | 용도 |
|---|---|---|---|---|
| anchor | 28/36 | 24/32 | 700 | 위젯 날짜 — 뷰당 큰 글자 1개 |
| title | 20/28 | 18/24 | 700 | 인스펙터 엔티티명, 월 제목 |
| subtitle | 16/22 | 14/20 | 700 | 섹션·선택 항목명 |
| body | 14/20 | 14/20 | 400 | 업체명·일정 제목·값 |
| bodyStrong | 14/20 | 14/20 | 700 | 결론형 요약 한 줄 |
| caption | 12/16 | 12/16 | 400 | 라벨·상태 문구·건수·요일 헤더 |
| micro | 11/14 | 11/14 | 400 | 라틴/숫자 전용(단축키 칩, 모노그램). 한글 금지 |
- 400/700만. 맑은 고딕엔 Semibold가 없어 600은 합성 굵기 → 금지. 뷰당 Bold ≤2(앵커 + 선택/오늘 또는 요약).
- compact는 글자 크기를 내리지 않는다(한글 12px 하한, 램프 밖 13/15px 금지). 행 높이·패딩만 줄인다.
- Fluent v9 대응: title2 28/36 · subtitle1 20/28 · subtitle2 16/22 · body1 14/20 · body1Strong · caption1 12/16.

## 한글 규약
- 자간 0(한글에 대문자가 없으므로 uppercase tracking 규칙은 '자간 벌린 한글'만 남긴다). 라틴/숫자 라벨만 +0.02~0.05em, 위젯 날짜 숫자 −0.01em.
- `word-break: keep-all; overflow-wrap: anywhere;` 업체명은 2행 + 툴팁, 고정 높이 구간(위젯·기간표)은 말줄임 + 툴팁 전체명.
- line-height는 px 고정(`normal` 금지). 다행 산문(메모·이력·툴팁) 1.55. `65ch` 무효 → 산문 폭 상한 480~560px.
- 정렬: 전부 좌측. 가운데는 요일 1자·모노그램 글자만. 숫자 열 우측.
- 숫자: 같은 스택 + `font-variant-numeric: tabular-nums`. 시각 `HH:mm`(24h, 선행 0, 5ch), 날짜 `9/24(수)`, 전화 `010-0000-0000`. 맑은 고딕 tnum 지원은 Windows 실측 [미확인] → 미지원 시 숫자 슬롯 px 고정폭.

## Fluent v9 테마 오버라이드 (프로토타입·제품 공통)
```ts
import { webLightTheme, webDarkTheme, type Theme } from "@fluentui/react-components";
const fontFamilyBase = '"Malgun Gothic", "맑은 고딕", "Segoe UI Variable Text", "Segoe UI", "NanumGothic", "Noto Sans KR", sans-serif';
export const lightTheme: Theme = { ...webLightTheme, fontFamilyBase, fontFamilyNumeric: fontFamilyBase, fontWeightSemibold: 700 as never };
export const darkTheme: Theme  = { ...webDarkTheme,  fontFamilyBase, fontFamilyNumeric: fontFamilyBase, fontWeightSemibold: 700 as never };
```
- `fontWeightSemibold`를 700으로 올려 Fluent 컴포넌트의 600 요청을 실체 Bold로 보낸다(합성 굵기 방지). 전역 CSS: `html { font-variant-numeric: tabular-nums; word-break: keep-all; overflow-wrap: anywhere; }`.
- brand ramp만 액센트 후보(A ink-blue)로 교체. 그 외 Fluent 기본 유지.

## Windows 실측 항목(인계 체크리스트)
혼합 문자 한 줄의 700 굵기·기준선 · tnum 동작 · 125/150% DPI에서 한글 12px 가독성 · 18자 업체명 2행 처리.
