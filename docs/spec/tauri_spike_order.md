# 직거래 일정관리 — Tauri Widget Shell Spike Codex 발주서

## 0. 목표
전체 일정관리 앱을 구현하지 않는다.

첫 번째 기술 Spike의 목적은 오직 다음 질문에 답하는 것이다.

> Tauri 2 기반 창이 Windows에서 실제로 ‘업무를 방해하지 않는 바탕화면 위젯’으로 안정적으로 동작하는가?

UI 완성도보다 window behavior 검증이 우선이다.

---

# 1. 기술 스택

- Tauri 2
- Rust stable
- React + TypeScript
- Vite
- Fluent UI React v9는 최소 control에만 사용 가능
- Fluent System Icons
- SQLite plugin
- window-state
- global shortcut
- autostart
- single-instance
- tray / notification

가능하면 공식 Tauri plugin/API 우선.
Win32 interop은 공식 API로 불가능한 항목에만 사용.

---

# 2. 구현 범위

## 단일 창
기본 크기:
- width: 320
- height: 110
- 최소 크기 고정 가능

표시:
- 오늘 날짜
- 오늘 일정 수
- 확인 필요 수
- 가장 가까운 일정 1건

예시:

┌────────────────────────┐
│ 9월 24일 목   확인 1   │
│ 오늘 3                 │
│ 14:00 업체 일정 확인   │
└────────────────────────┘

실제 일정 DB 구현은 불필요.
SQLite에 seed 3~5건만 저장해 읽을 것.

---

# 3. Window State

## Resting / Locked
- always-on-bottom
- skip taskbar
- click-through ON 선택 가능
- focus를 가져오지 않음
- window position persisted

## Activated
전역 단축키 또는 tray command:
- click-through OFF
- 상호작용 가능
- focus 가능
- 필요 시 always-on-bottom 유지/일시 해제 비교

## Layout Edit
- drag 가능
- 위치 변경
- 저장
- Locked 복귀

---

# 4. 반드시 구현할 명령

Tray:
- 위젯 표시
- 위젯 활성화
- 잠금/클릭통과 전환
- 레이아웃 편집
- 시작프로그램 on/off
- 종료

Global Shortcut:
- 위젯 활성화/비활성
- 기본값은 충돌 가능성이 낮은 조합으로 구현하되 설정 가능 구조

UI:
- 일정 영역 클릭
- 잠금 상태 표시
- 편집모드 drag handle

---

# 5. SQLite

테이블 최소:

settings
- key
- value

tasks
- id
- title
- starts_at
- status

Seed:
- 오늘 일정 3건
- 확인 필요 1건

목적:
- plugin과 Rust/Frontend 데이터 흐름이 정상인지 확인

---

# 6. 위치 복원

저장:
- monitor identifier 가능한 범위
- x/y
- width/height
- scale factor
- mode(locked/edit)
- click-through setting

복원:
- 해당 모니터가 없으면 primary monitor의 안전 영역으로 이동
- 화면 밖 위치는 clamp
- DPI 변경 시 물리 픽셀/논리 좌표 혼동 방지

---

# 7. 검증 매트릭스

## DPI
- 100%
- 125%
- 150%
- 175%

## 해상도
- 1366×768
- 1920×1080
- 2560×1440
- 3840×2160

## Monitor
- single
- dual
- secondary monitor left/right
- secondary monitor disconnect/reconnect

## App interaction
동시에 실행:
- 한글
- Excel
- Edge/Chrome
- File Explorer

확인:
- 위젯이 입력 focus를 빼앗지 않는가
- 클릭 통과가 실제로 동작하는가
- always-on-bottom이 정상인가
- 단축키 활성화 후 조작 가능한가
- 다시 잠그면 즉시 방해하지 않는 상태로 복귀하는가

## Lifecycle
- app restart
- Windows sign-out/in
- sleep/resume
- Explorer restart
- autostart
- crash 후 재실행

---

# 8. 계측

측정하여 README에 기록:
- cold start ms
- idle RSS memory
- idle CPU
- activated memory
- SQLite read latency
- click-through toggle latency 체감/측정

절대 기준보다 비교 가능한 기록이 목적.

---

# 9. Acceptance Criteria

PASS:
1. 일반 작업 중 focus stealing 없음
2. click-through ON/OFF 20회 반복 안정
3. global shortcut 20회 반복 안정
4. 항상 아래 동작이 정상
5. 모니터/DPI 변경 후 화면 밖으로 사라지지 않음
6. 재실행 후 위치 복원
7. tray 종료 정상
8. single-instance 정상
9. SQLite seed 읽기 정상
10. JS/Rust console에 반복 오류 없음

FAIL:
- always-on-bottom이 빈번히 깨짐
- click-through 후 다시 상호작용 불가
- focus stealing
- monitor 변경 시 위치 소실
- sleep/resume 후 window state 오작동

FAIL 시:
동일 UI/Acceptance Criteria로 WPF + Win32 Spike를 수행할 수 있도록 문제와 재현 절차를 기록할 것.

---

# 10. 코드 구조

권장:

src/
  app/
  components/
    AmbientWidget/
  design/
    tokens.ts
  bridge/
    tauri.ts

src-tauri/
  src/
    main.rs
    commands/
    window/
    storage/
  capabilities/

DB/Window/Frontend를 한 파일에 섞지 말 것.

---

# 11. 디자인 규칙

이 Spike에서도 웹페이지처럼 보이면 안 된다.

금지:
- top nav
- hero
- card grid
- KPI cards
- marketing style
- 큰 rounded card 중첩

권장:
- compact
- restrained
- desktop utility
- one accent
- Fluent icons
- clear text hierarchy

최종 UI가 아니라 window behavior test이므로 과도한 디자인 작업 금지.

---

# 12. 산출물

1. 실행 가능한 Windows project
2. README
3. 빌드 방법
4. 기능 체크리스트
5. 테스트 결과표
6. known issues
7. screenshot 100/125/150% DPI
8. cold start / memory 측정
9. PASS/FAIL 결론

Windows 빌드 및 검증이 불가능한 환경이라면:
- 가능한 부분까지 구현
- 미검증 항목을 명확히 구분
- 검증하지 않은 항목을 ‘동작함’으로 주장하지 말 것.
