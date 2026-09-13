---
name: widget-shell
description: Phase 3 Tauri 위젯 셸 스파이크(창 동작·권한·트레이·단축키·SQLite·위치 복원)와 Windows 인계 검증을 수행할 때 사용자가 수동으로 호출하는 절차 스킬. Linux 세션의 한계(컴파일·실기 불가)와 미검증 표기 규칙, 권한 매핑, 리스크 레지스터를 가리킨다.
disable-model-invocation: true
---

# widget-shell — Phase 3 스파이크 절차 (수동 호출)

정본: `docs/spec/tauri_spike_order_v2.md`(자기 작업 계획), `docs/risk/windows-platform-risk-register.md`, `docs/risk/spike-handoff-checklist.md`, `docs/risk/deployment-prereqs.md`, `docs/decisions/ADR-0004-widget-placement-3variants.md`.

## 이 환경에서 가능한 것 / 불가능한 것
- 가능(Linux): 프런트(React) 빌드·테스트, Tauri 비의존 도메인 모듈 테스트, `tauri.conf.json`·`capabilities/*.json`·Rust 소스 작성, 문서·체크리스트.
- 불가능(Linux): `src-tauri` 컴파일(webkit2gtk·gtk 없음), Windows 창 동작(always-on-bottom·click-through·Win+D·트레이·전역 단축키·DPI·한글 IME), 설치·서명·WebView2 확인. → 전부 **미검증(Linux 작성)** 으로 표기하고 인계 체크리스트에 넘긴다.

## 절차
1. `docs/spec/tauri_spike_order_v2.md` §1–§6을 읽고 버전을 고정한다(tauri 2.11.5 등). single-instance 플러그인을 첫 번째로 등록.
2. §4 권한 매핑표대로 `capabilities/widget.json`을 작성한다. 창 전이(잠금/활성/편집)는 Rust command로 감싸 프런트에는 `core:default` + 앱 명령만 노출. `sql:*` 권한은 프런트에 부여하지 않는다.
3. CSP를 `tauri.conf.json`에 설정하고, 런타임 외부 네트워크 요청이 0인지 코드로 확인한다.
4. 위치 복원: window-state는 `StateFlags::POSITION`만, 복원 직후 화면 경계 검사·중앙 이동 가드.
5. Win+D 대응은 ADR-0004의 1안(always_on_bottom + 계측)으로 구현하고 2안(WorkerW 부모화) 분기를 준비한다.
6. 검증은 `docs/risk/spike-handoff-checklist.md`의 3열(PASS/FAIL/미검증)로만 보고한다. 실행하지 않은 항목을 PASS로 적지 않는다.
7. Windows에서 실행할 사람(사용자)에게 넘길 README에는 빌드 전제(Rust MSVC, WebView2, pnpm), 검증 순서, 스크린샷 슬롯, 측정 수단을 명시한다.

## references
- `references/permissions-map.md` — 명령 ↔ permission 식별자 요약(정본은 발주서 v2 §4)
- `references/verification-matrix.md` — 검증 항목 요약과 인계 체크리스트 위치
- `references/windows-risk-register.md` — 최상위 리스크 5개 요약과 정본 위치
