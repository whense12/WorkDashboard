# 상태·색·모노그램

## 액센트
- 1개. 기본 후보 A ink-blue `oklch(0.50 0.14 250)` → light rest `#0465af` / hover `#00539b` / pressed `#004288` / subtle `#dbf1ff`; dark rest는 토큰 v0.2 참조. [Claude 제안]
- 용도는 "Enter가 향하는 곳"뿐: 선택 레일(좌측 2px), 포커스 링, 활성 탭, 화면당 primary 버튼 1개. 상태·브랜딩·'오늘'·업체 식별에 금지.
- Fluent 컴포넌트가 brand를 쓰는 지점(Button primary, Checkbox checked, Tab selected, Switch on)은 화이트리스트로 점검.

## 상태 5종 = 형태 + 문구 + 색(보조)
| 상태 | 문구(고정) | 형태 | light | dark | 밝기 순서 |
|---|---|---|---|---|---|
| needs_attention | 확인 필요 | 좌측 2px 실선 레일 + 빈 링 6px | `#942e00` | `#f19266` | 가장 진함 |
| changed | 이 날짜만 변경 (셀: 변경됨) | 사선 tick + 원계획 회색 고스트 | `#7e539c` | `#c79de6` | |
| confirmed | 확정 | 채운 점 6px | `#348f4f` | `#7ccd8e` | |
| linked | 연결됨 | Link regular 아이콘 / hairline 커넥터 | 색 없음 | 색 없음 | |
| cancelled | 불참(참가) / 취소(일정·행사) | 이름 취소선 + Foreground3 | `#a4a4a4` | `#717171` | 가장 흐림 |
- 회색조 스크린샷에서 5종이 구분되어야 통과. pill 배지·빨간 배지·맥동 금지. 동의어('미확인', '체크 필요', '예외', '주의') 금지.
- Layer 0에서 semantic 색은 '확인 필요' 1곳에만 저채도로 허용 [Claude 제안].
- 아이콘 regular=비활성 / filled=선택·활성이 상태의 이중 부호.

## 오늘·주말·선택
- 오늘 = 열 배경 colorNeutralBackground3 + 날짜 700 + 1px 상단 룰. 액센트 원형 배지 금지.
- 주말 = 열 배경 colorNeutralBackground2. 선택 = colorNeutralBackground1Selected + 좌측 2px 액센트 레일(텍스트 굵기 변경 없음).

## 모노그램 (업체 식별은 이름이 주, 색은 절대 아님)
- 알고리즘: 법인격 접두어 제거(주식회사/㈜/(주)/농업회사법인/영농조합법인/합자회사/유한회사/사단법인/재단법인) → 첫 1음절 → 충돌 시 2음절 → 재충돌 시 2음절+지역 → 사용자 지정(`Vendor.monogram_override`).
- 형태: 무채색 정사각 슬롯(normal 28×20 / compact 24×16), radius 4, 1px colorNeutralStroke1, 배경 없음, 글자 12px 700 colorNeutralForeground1. 원형·채색·이름 해시 색·Avatar 금지.
- 배치: 목록 행 선두만(Today, 참가업체 목록). 월간 셀·기간표 셀에는 쓰지 않는다(이름이 있으면 이름 우선).
- 사무일정 마커: 6px outline square, 모노그램과 같은 x축. 종류는 2종(업체 일정 / 사무 일정)으로 고정.

## 표면(토큰 v0.2 surface)
window colorNeutralBackground1 · widget Mica(폴백 colorNeutralBackground2, 라이트 한정 warm tilt chroma ≤0.02) · pane colorNeutralBackground1 + 1px colorNeutralStroke2 + radius 8 · flyout + shadow16 · selected + 좌측 2px 레일 · attention 채움 없음(레일+텍스트). 그림자는 flyout/dialog만.

## forced-colors
text CanvasText · selected Highlight/HighlightText · hairline 1px CanvasText · 오늘/주말은 배경 대신 1px 경계 · 상태 형태 마커 유지(forced-color-adjust:none 금지) · accent Highlight · disabled GrayText.
