# 직거래 일정관리 — 디자인·플랫폼 작업 명세 v2

## 0. 문서 목적
이 문서는 직거래 일정관리 프로그램을 실제 Windows 데스크톱 도구로 구현하기 위한 설계 기준이다.

핵심 제품 정의:

> 평소에는 바탕화면에서 조용히 존재하고, 사용자의 의도가 생겼을 때 오늘 일정 → 캘린더 → 행사/업체 → 세부업무 순으로 정보가 단계적으로 펼쳐지는 일정·조율 작업 공간.

본 문서는 디자인과 플랫폼을 분리해서 정의한다.

- **Window/Shell**: Windows에서 창이 어떻게 존재하는가.
- **Renderer/UI**: 창 내부를 HTML/CSS 또는 XAML 중 무엇으로 그리는가.
- **Application Logic**: 일정, 행사, 업체, 참가계획, 예외일, 업무를 어떻게 계산하는가.
- **Storage**: SQLite 및 첨부파일/백업을 어떻게 저장하는가.

---

# 1. 제품 원칙

## 1.1 최상위 디자인 원칙
다음 세 계열을 혼합한다.

### A. VS Code Design Philosophy
- Calm
- Focused
- Consistent
- Delightful
- **Quiet at rest, present on intent**

적용:
- 아무 조작을 하지 않을 때 화면 chrome 최소화
- hover/focus/selection 때만 관련 명령 노출
- 사용자의 한글/엑셀/브라우저 사용을 방해하지 않음

### B. Fluent 2
- Windows 문법에 맞는 control behavior
- 표준 Dialog / Popover / Tooltip / Context Menu / MenuButton
- Fluent System Icons regular/filled 사용
- 시각적 장식보다 platform convention 우선

### C. Swiss Information Hierarchy
- 한글 업무정보의 밀도를 grid와 typography로 해결
- 하나의 주 accent
- 불필요한 card를 만들지 않음
- 일정·업체명·상태가 가장 먼저 읽혀야 함

---

# 2. 채택하지 않을 패턴

- KPI 카드 4개를 상단에 자동으로 배치
- 모든 내용을 rounded card로 감싸기
- 업체명을 `+N more` 뒤에 숨기기
- 업체마다 다른 색을 무한 확장
- mobile-first navigation을 desktop에 복사
- 화면 중앙에 max-width container를 놓는 웹사이트형 구성
- drag를 유일한 재배치 방법으로 사용
- 특정 날짜 수정과 전체 일정 수정을 같은 UI에서 모호하게 처리
- 업체 참가계획과 날짜별 이벤트를 같은 데이터로 저장
- 사용자가 참가요약 문자열을 수동 작성

---

# 3. 목표 UX 구조

## Layer 0 — Ambient Widget
평상시 바탕화면에 존재.

표시:
- 오늘 날짜
- 오늘 일정 개수
- 확인 필요 개수
- 가장 가까운 일정 1~2건

행동:
- 기본 상태에서는 always-on-bottom
- 선택적으로 click-through
- 작업표시줄 숨김
- 전역 단축키로 활성화
- 클릭하면 Layer 1

금지:
- 전체 업체 목록
- 필터
- KPI
- 복잡한 버튼 줄
- 장식 이미지

## Layer 1 — Today / Upcoming
표시:
- 오늘 전체 일정
- 다음 일정
- 확인 필요/연락 필요
- 빠른 일정 추가

행동:
- 일정 체크
- 세부 열기
- 캘린더 열기

## Layer 2 — Calendar Workspace
View:
1. 월간
2. 주간
3. 기간표(Matrix)

월간:
- 날짜 셀에 업체명 직접 표시
- 업체가 많으면 해당 주의 높이를 증가
- 이름을 임의로 숨기지 않음
- 일반 사무일정은 업체 일정과 다른 작은 semantic marker 사용

기간표:
- 업체 × 날짜
- 참가계획 및 예외일 확인
- 업체 수가 20~30곳으로 늘 때 주력 보조 view

## Layer 3 — Inspector
선택한 entity에 맞춰 내용 변경.

### 업체
- 업체명
- 담당자/연락처
- 품목
- 참가 행사
- 참가기간/요일
- 특정 날짜 예외
- 당일 업무
- 첨부
- 변경 이력

### 행사
- 행사명/기간/장소
- 참가업체
- 행사별 업무
- 일정
- 첨부

### 일반 일정
- 제목/날짜/시간
- 메모
- 관련 행사/업체
- 첨부

---

# 4. 디자인 시안 3안

## A. Quiet Instrument
목적: 가장 적은 존재감.

Ambient:
- 280~340px 폭
- 72~132px 높이
- 날짜 + 가장 가까운 일정 위주
- 평소 버튼 숨김

Expanded:
- 오늘/다가오는 일정 세로 목록
- 캘린더 명령만 주요 CTA

적합:
- 하루 종일 띄워두기
- 작은 화면
- 최소 방해

위험:
- 기능 발견성 부족

보완:
- 첫 사용 가이드
- Command/Search
- hover reveal

## B. Fluent Spatial Workspace
목적: 실제 업무 조율 작업.

구조:
- Calendar center
- Inspector right
- optional navigation rail
- pane를 right/left/bottom/detach 가능
- layout locked/edit 분리

적합:
- 행사/업체/업무 복합 관리
- 멀티모니터

위험:
- 사용자가 레이아웃을 과도하게 바꿈

보완:
- Default layout
- Reset layout
- Edit mode에서만 drag

## C. Swiss Operational Calendar
목적: 가장 빠른 일정 파악.

구조:
- 캘린더가 절대 중심
- 날짜/업체명/상태의 강한 텍스트 계층
- 최소 chrome
- inspector는 필요 시만 등장

적합:
- 업체가 많음
- 빠른 훑어보기
- 출력/보고

위험:
- 위젯 경험이 심심할 수 있음

---

# 5. 권장 혼합안

최종 주안은 세 시안 중 하나를 그대로 채택하지 않는다.

> **A의 존재 방식 + B의 작업 공간 + C의 정보 밀도**

구체적으로:

- Layer 0/1: Quiet Instrument
- Layer 2: Swiss 중심 Calendar + Fluent control behavior
- Layer 3: Fluent Inspector
- Layout Edit: Fluent Spatial Workspace

---

# 6. 자유 이동 설계

## 6.1 Window Movement
OS shell 수준:
- widget 위치 이동
- monitor 간 이동
- 위치 기억
- always-on-bottom
- skip taskbar

## 6.2 Workspace Layout
앱 내부:
- inspector right/left/bottom
- detach
- resize
- reset

## 6.3 모드
### Locked
- 일반 업무
- 위치 변경 금지

### Layout Edit
- drag handle 표시
- resize 표시
- pane 위치 명령 표시
- 저장 후 Locked 복귀

접근성:
- drag 외에 `왼쪽으로 이동`, `오른쪽으로 이동`, `하단으로 이동`, `분리`, `기본 배치` 제공

---

# 7. 데이터 모델

## Event
- id
- name
- start_date
- end_date
- location
- status
- notes

## Vendor
- id
- name
- contact_name
- contact_phone
- products
- status
- notes

## ParticipationPlan
- id
- event_id
- vendor_id
- start_date
- end_date
- weekdays[]
- status

## ParticipationException
- id
- participation_plan_id
- date
- type(include/exclude)
- reason

## Task
- id
- title
- starts_at
- due_at
- category
- event_id nullable
- vendor_id nullable
- status
- notes

## Attachment
- id
- owner_type
- owner_id
- file_path
- filename
- file_size
- added_at

## AuditLog
- id
- timestamp
- entity_type
- entity_id
- action
- previous_value
- new_value

핵심:
- 참가계획이 원본
- 날짜별 참가 여부는 계산
- 하루만 변경 = Exception
- 전체 계획 수정 = ParticipationPlan 수정

---

# 8. 그래픽 에셋

기본 소스:
Microsoft Fluent System Icons.

규칙:
- Regular = 일반/비활성
- Filled = 선택/활성
- semantic color는 상태에만 사용

우선 에셋:
- Calendar Agenda
- Calendar People
- Calendar Multiple
- Calendar Checkmark
- Building People
- People Team
- Tasks App
- Alert
- Warning
- History
- Attach
- Panel Right Expand/Contract
- Reorder
- Search
- Add
- Edit
- Delete
- Clock
- Link

업체 식별:
- 이름
- 1~2자 monogram
- 필요 시 작은 고정 shape
- 색은 식별자의 주 수단이 아님

---

# 9. Design Token v0.1 원칙

## Surface
- Window
- Widget
- Pane
- Flyout
- Selected
- Attention

## Spacing
2 / 4 / 6 / 8 / 12 / 16 / 20 / 24 / 32

## Radius
- control: 4
- compact surface: 6
- pane: 8
- floating widget/flyout: 12

## Motion
- hover: 100–140ms
- selection: 120–160ms
- pane expand: 160–220ms
- layout transition: 180–240ms
- reduced-motion: 즉시 또는 opacity 최소

## Density
- compact
- normal
두 가지를 제공.
사용자가 별도 설정하지 않으면 compact-normal 중간 수준.

---

# 10. 플랫폼 비교

## A. Tauri 2 + React/TypeScript
현재 1차 기술 Spike.

장점:
- always-on-bottom
- ignore cursor events(click-through)
- skip taskbar
- transparent/frameless
- tray
- global shortcut
- autostart
- window state
- SQLite
- UI 반복 속도

UI:
- Fluent UI React v9: 표준 control
- Fluent System Icons
- custom calendar / inspector / widget

위험:
- 웹사이트처럼 보일 수 있음
- native focus/context-menu/keyboard behavior를 의도적으로 구현해야 함

## B. WPF .NET 10 + Win32
Fallback/비교.

장점:
- HWND/Win32 제어 성숙
- bottom/no-activate/toolwindow/click-through 조정
- Fluent theme
- MVVM/DI/virtualization 성숙

위험:
- custom UI 반복 속도 낮음

## C. WinUI 3
Windows native 품질 비교.

장점:
- 최신 Windows App SDK
- AppWindow
- Mica
- Fluent native
- multi-window
- ItemsRepeater

위험:
- 특수 desktop-widget window behavior에 Win32 interop 필요 가능성

---

# 11. Tauri Widget Shell Spike

목적:
전체 제품 구현 전, 가장 위험한 가정인 `desktop widget behavior`를 검증.

화면:
320×110 전후의 단일 compact widget.

표시:
- 날짜
- 오늘 일정 수
- 가장 가까운 일정
- 확인 필요

필수 검증:
1. always-on-bottom
2. skip-taskbar
3. click-through ON/OFF
4. global hotkey activate
5. drag
6. position persistence
7. tray
8. autostart
9. single instance
10. SQLite read/write
11. 100/125/150/175% DPI
12. multi-monitor
13. sleep/resume
14. Explorer restart
15. 한글/Excel/브라우저 focus 방해 여부
16. cold start
17. idle memory/CPU

Pass:
- 일반 작업 focus를 뺏지 않음
- 잠금 시 클릭 통과 안정
- 단축키 호출 후 바로 상호작용
- DPI/monitor 변경 시 화면 밖으로 사라지지 않음
- 재부팅 후 위치 복원

Fail:
- always-on-bottom 불안정
- focus stealing 반복
- click-through 복귀 불안정
- monitor/DPI 위치 복원이 반복 실패

Fail이면 동일 요구로 WPF+Win32 Spike.

---

# 12. Core UX Flow Acceptance Criteria

## 일반 일정 등록
- Widget에서 3번 이내의 명령으로 Quick Add 진입
- 제목/일시만으로 저장 가능
- 업체/행사 연계는 선택

## 업체 등록
- 기본정보
- 행사 선택
- 기간
- 참가요일
- 실제 참가일 preview
- 저장
순서

## 전체 일정 변경
- ParticipationPlan 편집
- 영향 받는 날짜 preview
- 기존 Exception 충돌 표시
- 저장

## 하루만 변경
- 날짜 → 업체 → `이 날짜만 수정`
- include/exclude
- 이유/메모 선택
- Exception 저장

## 복원
- 백업 선택 즉시 덮어쓰지 않음
- 변경량 preview
- 현재 상태 snapshot
- 확인 후 복원

---

# 13. Stress Cases

반드시 디자인/구현에서 검증:
- 업체 5 / 20 / 40곳
- 행사 1 / 3 / 10개
- 하루 동시 참가업체 3 / 10 / 25곳
- 업체명 18자 이상
- 한 업체에 품목 8개 이상
- 첨부 20개
- 변경 이력 100건
- 일정 5,000건
- 125% / 150% DPI
- 1366×768 / FHD / QHD / 4K
- dual monitor
- 작은 widget이 화면 모서리에 위치

---

# 14. 단계별 구현

## Phase 1 — Visual Direction
- Quiet / Fluent Spatial / Swiss 3안
- 각 안 Layer 0~3 상태
- 비교 평가
- 혼합안 확정

## Phase 2 — Design System
- Token v1
- component inventory
- icon map
- state map
- interaction/motion map

## Phase 3 — Tauri Shell Spike
- window behavior only

## Phase 4 — Platform Gate
- Pass: Tauri 유지
- Fail: WPF Spike
- 필요 시 WinUI 비교

## Phase 5 — Core Prototype
- SQLite schema
- Event/Vendor/Plan/Exception/Task
- Widget → Calendar → Inspector

## Phase 6 — UX Hardening
- stress cases
- layout edit
- keyboard
- accessibility
- backup/restore

## Phase 7 — Windows Release
- installer
- autostart
- crash recovery
- update
- data migration

---

# 15. Codex/Work 권장 분업

## Work
- 레포 리서치
- 디자인 비교
- 요구사항 변경 반영
- 명세/체크리스트 유지
- 완성 산출물 리뷰

## Codex
- repository scaffold
- Tauri/Rust/React 구현
- Windows build
- test
- profiling
- packaging
- bug fixing

Astra가 사용 가능할 경우:
- Work에서 설계/요구사항 통합
- Codex에서 구현과 장기 기술 작업
을 우선.

---

# 16. 다음 완료 조건

- [ ] 3개 디자인 방향 Layer 0~3 구체 시안
- [x] 플랫폼 후보 비교
- [x] Tauri Spike 범위
- [x] WPF fallback 정의
- [x] 데이터 모델
- [x] design token v0.1
- [x] icon asset 방향
- [x] stress cases
- [x] UX acceptance criteria
- [ ] 실제 Tauri Widget Shell Windows 검증
