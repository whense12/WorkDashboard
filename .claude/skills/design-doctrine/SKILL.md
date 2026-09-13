---
name: design-doctrine
description: 직거래 일정관리(WorkDashboard)의 UI·디자인·문구·상태·토큰·컴포넌트 작업 규범. 위젯/Today/캘린더(월간·주간·기간표)/인스펙터/대화상자/시안/프로토타입/Fluent UI v9/토큰/한글 타이포/상태 마커/모노그램/모션/슬롭 검사 중 하나라도 건드리면 작업 전에 읽는다. 사용성(오류·시행착오 없음) > 차별화 순서를 강제하고, 23항 AI-슬롭 체크리스트와 자기검사로 산출물을 판정한다.
---

# design-doctrine — 이 제품의 디자인 규범 (요약본)

정본은 `docs/design/doctrine.md`(전문)와 `docs/spec/design_tokens_v0.2.json`(값)이다. 이 스킬은 작업 절차와 규칙 요약이며, 충돌 시 정본이 우선한다. 근거 표기 `spec:줄` = `docs/spec/spec_v2.md`.

## 언제·어떻게 쓰나
1. UI/디자인/문구 작업을 시작하기 전에 이 파일과 필요한 references를 읽는다.
2. 값은 토큰 v0.2에서만 가져온다(hex·px 직접 발명 금지). 없는 값이 필요하면 토큰에 추가하고 근거를 적는다.
3. 픽스처는 `references/fixtures.md`의 경계값으로만 검수한다(가짜 '업체A' 금지).
4. 산출물 완료 전 `references/slop-checklist.md`의 23항이 전부 "아니오", 자기검사의 사용성 항목이 전부 통과해야 한다. 통과 못 하면 미완성이라고 보고한다.
5. 차별화 아이디어는 사용성 비용이 0일 때만 채택하고, 채택·폐기 이유를 한 줄 남긴다.

## 우선순위 (사용자 결정)
1. **사용성**: 오류 없이, 시행착오 없이. 오류 방지(제약 입력·기본값·preview 후 확정), 발견성, 되돌리기, 예측 가능한 Fluent 동작, 빈/로딩/오류/충돌 상태, 단일 해석 문구, DPI/테마 견고성.
2. **차별화**: 그 다음. 명료함과 개성을 맞바꾸는 규칙은 틀린 규칙.
- 충돌 해소: 접근성·오류 방지 > Windows/Fluent 2 관례 > 사용자 명시 요청 > 심미 > 성능 > 단순함.
- 판정 문장: "실수 없이 쓸 수 있는가" → "누군가 설계했다고 보이는가" → "다른 일정 앱과 바꿔치기 가능한가(가능하면 실패)".

## 사용성 공통 규칙 U1–U9 (정본: doctrine.md '사용성·오류 방지 규칙')
- U1 되돌릴 수 있으면 묻지 않고(즉시 저장 + 8초 undo 토스트 + Ctrl+Z), 되돌릴 수 없으면 보여주고 묻는다(preview + 영향 수 확정).
- U2 확정 버튼 = 동사+범위+수량("10/3 하루만 저장", "계획 저장 · +3일 −5일"). "확인/OK" 금지. 파괴적 대화상자는 취소가 기본 포커스.
- U3 주 버튼을 말없이 비활성화하지 않는다: 눌리면 첫 오류 필드로 포커스 + 인라인 validationMessage. 불가피한 비활성에는 사유 한 줄.
- U4 자유 텍스트는 제목·메모·이유뿐. 날짜/시각/요일/업체/행사는 선택 컨트롤(Combobox freeform 금지). 자연어 날짜 파싱 금지.
- U5 한글 IME: `isComposing || keyCode===229`면 Enter/Escape 무시. 단축키는 `event.code`. 입력 중 단문자 단축키 무시. Layer 0에 입력 요소 0.
- U6 dirty 폼 Escape는 "버릴까요?" 확인, 바깥 클릭으로 닫히지 않음. Escape 사다리 한 단계씩. 포커스는 떠난 자리로 복귀.
- U7 삭제 = soft delete + undo. 연쇄 영향은 수치 preview.
- U8 시각은 상대+절대 병기, ISO 노출 금지. U9 기본값은 문맥에서(보고 있는 날짜, 다음 정시, 현재 행사).

## 레이어 요약 (정본: doctrine.md '레이어별 규칙')
- 공개 리듬: 앞=Enter/클릭 1회, 뒤=Esc 1회, 포커스 복귀. F6 pane 순환.
- **Layer 0 위젯 320×110**: 정보 4개(날짜·오늘 N·확인 필요 N·가장 가까운 일정 1건)만. rest에 버튼·입력·아이콘 줄·테두리·그림자 0. 시계·맥동·stagger 없음(분 단위 갱신, 83ms 크로스페이드). 큰 글자는 날짜 하나(anchor 28/36·700). 빈 상태 "오늘 일정 없음 · 다음 9/12(금) 고성청과". 개인정보 표시 금지.
- **Layer 1 Today**: 데이터로 시작(헤더·KPI 타일 금지). 유일한 제목은 결론형 한 줄. 행 = [시각 tabular 5ch][모노그램 슬롯][업체·제목][상태 마커+문구][예약 명령 슬롯]. Space=체크, Enter=인스펙터, Ctrl+N=Quick Add. 상시 검색창 없음(Ctrl+K).
- **Layer 2 캘린더**: 창을 채운다. 월간은 업체명 직접 표시, `+N more` 금지: ≤8곳 1열 → 9~16곳 셀 내 2열 → 17곳↑ 주 행 성장 + "이 주를 기간표에서 보기". 오늘 = 열 배경 + 날짜 700 + 1px 상단 룰(원형 배지 금지). 기간표 = role=grid, roving tabindex, 업체명 열 고정폭, 셀 테두리 없음. 사무일정은 6px outline 마커.
- **Layer 3 인스펙터**: 라벨-값 세로 목록(카드·아이콘 배지·색 바 금지). 단일 필드 인라인 편집, 계획·예외·복원·삭제는 전용 Dialog. 참가 요약 자동 생성. 변경 이력 항목마다 되돌리기. 미선택 = 안내 화면.

## 타이포·한글 (ADR-0003; 정본: references/typography-ko.md)
맑은 고딕 선두 스택 · 400/700만 · 뷰당 Bold ≤2 · anchor 28/36 / title 20/28 / subtitle 16/22 / body 14/20 / bodyStrong 14/20·700 / caption 12/16 / micro 11/14(라틴·숫자) · 한글 12px 하한 · 자간 0 · keep-all · tabular-nums · line-height px 고정 · 65ch 금지.

## 색·상태·모노그램 (정본: references/status-monogram.md)
액센트 1개 = "Enter가 향하는 곳"(선택 레일·포커스·활성 탭·화면당 primary 1개). 상태 5종 = 형태+문구(+색 보조): 확정 채운 점 / 확인 필요 빈 링+좌측 2px 레일 / 이 날짜만 변경 사선+고스트 / 불참·취소 취소선 / 연결됨 링크 아이콘. 회색조에서 구분되어야 통과. 업체별 색 금지, 모노그램은 무채색 사각 1~2음절.

## 간격·밀도·모션 (정본: doctrine.md)
4px 그리드, spacing 9종만, radius 4/6/8/12 역할대로, 그림자는 flyout/dialog만. compact/normal은 두 조판(글자 크기 고정). 모션 예산: hover 120/100, selection 140/120, pane 200/160, layout 220, 위젯 83ms; 키프레임 `paneExpand`·`attentionOnce`만; reduced-motion은 opacity 대체.

## Fluent v9 매핑 (정본: references/fluent-mapping.md)
Dialog(범위 제목·영향 수 버튼) / Popover Quick Add / Menu openOnContext + secondaryContent 단축키 / Tooltip 400ms / TabList / Combobox / Field validationMessage / MessageBar 오류 / Toaster undo / TeachingPopover 3단계 / 커스텀 role=grid / createFocusOutlineStyle / bundleIcon(Regular, Filled). 테마 오버라이드는 fontFamilyBase·brand ramp·duration·위젯 surface만.

## 자동 리젝트 4항목
4열 KPI 타일 · 좌측 색 accent bar · LIVE/SYSTEM ONLINE/초 단위 시계 · Math.random 데이터.

## 자기검사 (사용성 먼저 — 정본: references/slop-checklist.md 하단)
계획 편집/하루만 변경 진입점 분리 · 되돌릴 수 없는 변경마다 preview · 모든 변경에 undo · 잘못된 값 입력 불가 · 마우스 없이 전 경로 도달·복귀 · 한글 IME Enter 1회=1건 · 빈/로딩/오류/충돌 상태 · 5어휘 고정 · 발견성 4경로 · DPI 100~175%·1366×768·3테마 · 회색조 상태 구분 · 경계 픽스처 · reduced-motion 손실 0 · 슬롭 23항 전부 "아니오".

## references
- `references/typography-ko.md` — 서체 스택·램프·한글 규약·Fluent 테마 오버라이드 코드
- `references/status-monogram.md` — 상태 5종 형태·색·문구, 모노그램 알고리즘
- `references/fluent-mapping.md` — 컴포넌트 표, 포커스 링, forced-colors 매핑
- `references/slop-checklist.md` — 23항 + 자동 리젝트 + 감각 테스트 4종 + 자기검사
- `references/fixtures.md` — 검수 경계 픽스처(업체 40·18자·하루 25곳 등)
