# 직거래 일정관리 — Tauri Widget Shell Spike 작업 계획 v2 (자기 작업 계획)

> **문서 성격**: `docs/spec/tauri_spike_order.md`(원본, 무수정 보존)를 Claude 단일 실행자 체제로 개정한 것. 원본은 Codex 발주서였으나 사용자 결정("너가 다해라", `docs/spec/spec_v2.md:613-634` §15 Work/Codex/Astra 분업은 폐기)에 따라 **Claude 자신의 작업 계획**이 되었다. 수신자는 두 곳이다.
> 1. **미래 Claude 세션(Linux 컨테이너)** — §13의 "Linux에서 가능한 것"을 구현·작성한다.
> 2. **사용자의 Windows PC** — §13의 "Windows에서만 가능한 것"을 실행·기입한다(`docs/risk/spike-handoff-checklist.md`).
>
> **환경 제약(확정)**: 이 컨테이너는 Linux(node 22 / pnpm 10 / cargo 1.94)이며 webkit2gtk·gtk3 개발 패키지가 없어 `src-tauri`는 `cargo check`조차 통과하지 못한다. 따라서 이 문서의 모든 Windows 창 동작은 **Windows에서 실행되기 전까지 [미검증]**이며, 원본 §12(`tauri_spike_order.md:291-294`) "검증하지 않은 항목을 '동작함'으로 주장하지 말 것"이 이 문서 전체를 지배한다.
>
> **근거 등급 범례(모든 주장에 부착)**
> - `[스킬 근거]` — 프로젝트 스킬(`.claude/skills/*`)·독트린(`docs/design/doctrine.md`)에서 온 규칙
> - `[제품문서 근거]` — `spec_v2.md` / 원본 발주서 / 검토 결과(발견 ID F·G)에서 온 요구
> - `[Windows·Tauri 1차 문서]` — docs.rs / v2.tauri.app / learn.microsoft.com / 공식 저장소·이슈에서 2026-09-09 확인한 사실(URL은 부록 A)
> - `[미검증]` — 훈련 지식·추론·Windows 실기 전에는 확정할 수 없는 것. 식별자·API명이 [미검증]이면 Windows 첫 컴파일에서 확정하고 이 문서를 갱신한다.
>
> **문서 언어**: 한국어 본문, 영어 식별자. 날짜 2026-09-09. 버전 고정값은 facts(부록 A) 조회 기준.

## 원본 대비 변경 요약

| 절 | 변경 | 근거(발견 ID) |
|---|---|---|
| 서문 | Codex 발주서 → Claude 자기 작업 계획, 수신자 2곳, 근거 등급 4단계 | F35, G1-4, 사용자 결정 ① |
| §1 | 버전 고정, `features=["tray-icon"]`, single-instance 첫 등록, CSP 기본 문자열, 오프라인 정책, sql 플러그인 미채택(rusqlite) | G0-2, G0-3, G2-1, facts |
| §3 | 위젯 배치 3변형(ADR-0004), 미해결 이슈 3건(skipTaskbar #10422 / decorations+shadow #14859 / WebView2 IME #5475) | F17, G1-1, G1-3, facts |
| §4 | 명령 ↔ permission 매핑표, "창 전이는 Rust command로 감싸고 프런트는 `core:default`만" | G0-0, G0-4 |
| §5 | Rust command 경유 저장, 스키마·seed 확정, `sql:*` 권한 0 | G0-2, G3-0, G5-1 |
| §6 | `StateFlags::POSITION`만, 복원 후 경계 가드, 모니터 식별 기록 | facts(window-state) |
| §7 | 원본 17항목 + 9항목(Win+D, IME, ACL, SmartScreen, 표준 계정, 혼합 DPI, WebView2, decorations/shadow, skipTaskbar 승격) | F17, G1-1, G1-3, G0-4, G4-0~2, facts |
| §8 | 측정 수단 명명, "목표 수치 없음·기준선 기록" | facts(WebView2 성능 문서에 수치 없음) |
| §9 | PASS/FAIL에 ACL·Win+D·IME 행 추가 | G0-4, G1-1, G1-3 |
| §10 | 원본 루트 구조 유지 + `capabilities/*.json`을 산출물로 | G0-4, plan §3-4 |
| §11 | CLAUDE.md·design-doctrine 스킬 참조, 맑은 고딕 400/700 | 사용자 결정 ④, F21/G1-0 |
| §12 | capabilities 전문·권한표·WebView2 전제·서명 상태·설치 모드·Linux 한계 문단 | G0-4, G4-0, G4-1, G4-2 |
| §13 | 신설: Linux 세션 / Windows 분담표 | 사용자 결정 ③ |

---

## 0. 목표

전체 일정관리 앱을 구현하지 않는다. `[제품문서 근거: tauri_spike_order.md:3-10]`

첫 번째 기술 Spike의 목적은 다음 두 질문에 답하는 것이다.

> **Q1 (창 동작)** Tauri 2 기반 창이 Windows에서 실제로 '업무를 방해하지 않는 바탕화면 위젯'으로 안정적으로 동작하는가? `[제품문서 근거: 원본 §0]`
>
> **Q2 (배포 가능성, 신설)** 그 창이 관리자 권한 없는 표준 계정·망분리 가능성이 있는 업무 PC에 WebView2 전제까지 포함해 **설치·자동 시작**될 수 있는가? `[제품문서 근거: G4-4 — Phase 4 게이트에 배포 축이 없었음]`

UI 완성도보다 window behavior 검증이 우선이다. 단, 이 스파이크는 `spec_v2.md:584-590` Phase 3(window behavior only) → Phase 4 Platform Gate의 유일한 입력이므로, **판정 근거를 남기는 것**(스크린샷·측정·capabilities 전문)이 구현 자체만큼 중요하다.

이 문서에서 "구현했다"는 Linux에서 작성·타입체크·프런트 빌드가 끝났다는 뜻이고, "동작한다"는 Windows 실기에서 PASS로 기입되었다는 뜻이다. 두 단어를 섞지 않는다.

---

## 1. 기술 스택

### 1.1 버전 고정 (2026-09-09 crates.io / npm 조회) `[Windows·Tauri 1차 문서]`

| 구성요소 | 버전 | 비고 |
|---|---|---|
| `tauri` (crate) | **2.11.5** | `features = ["tray-icon"]` 필수 — 트레이는 플러그인이 아니라 코어이며 이 피처 없이는 `tauri::tray` 자체가 컴파일되지 않는다 `[Windows·Tauri 1차 문서]` |
| `@tauri-apps/api` | **2.11.1** | 프런트는 `invoke`·`listen`만 사용(§4) |
| `tauri-plugin-window-state` | **2.4.1** | `StateFlags::POSITION`만(§6). 약 11개월 미갱신 상태임을 기록 |
| `tauri-plugin-global-shortcut` | **2.3.2** | Rust 측에서 등록(§4) |
| `tauri-plugin-autostart` | **2.5.1** | Rust command 경유. 약 11개월 미갱신 |
| `tauri-plugin-single-instance` | **2.4.4** | **반드시 첫 번째 `.plugin()`** (§1.3) |
| `tauri-plugin-notification` | **2.4.0** | 스파이크에서는 "활성화됨" 토스트 1회 스모크만 |
| `tauri-plugin-sql` | (미채택, 최신 2.4.1) | 프런트에 노출하지 않는다(§5). 의존성에서 제외 |
| `rusqlite` (`bundled` feature) | 미고정 | Windows 첫 `cargo build`에서 해석된 버전을 `Cargo.lock`에 고정하고 이 표에 기입 `[미검증: Linux에서 lock 생성 불가]` |
| `@fluentui/react-components` | **9.74.7** | 최소 컨트롤(Button, Tooltip)만. `fontFamilyBase` 오버라이드 필수(§11) |
| `@fluentui/react-icons` | **2.0.339** | 2.x 체계 — react-components(9.x)와 메이저 번호가 다른 것이 정상 |
| React / TypeScript / Vite | 미고정 | `create-tauri-app` 템플릿(react-ts) 기본값을 첫 설치 시 고정 |
| Rust toolchain | stable, Windows는 MSVC 타깃 | `x86_64-pc-windows-msvc` `[미검증: 사용자 PC 아키텍처]` |
| Node / pnpm | 22 / 10 | Linux 컨테이너 실측. Windows에서도 동일 메이저 사용 |

원칙(원본 유지): 가능하면 공식 Tauri plugin/API 우선. Win32 interop은 공식 API로 불가능한 항목에만 사용 — 현재 그 항목은 **Win+D 생존**(§3.4, ADR-0004) 하나뿐이다. `[제품문서 근거: tauri_spike_order.md:29-30]`

### 1.2 `Cargo.toml` 골격 `[미검증: Linux에서 컴파일 불가, 식별자는 Windows 첫 빌드에서 확정]`

```toml
[dependencies]
tauri = { version = "2.11.5", features = ["tray-icon"] }
tauri-plugin-single-instance = "2.4.4"
tauri-plugin-window-state = "2.4.1"
tauri-plugin-global-shortcut = "2.3.2"
tauri-plugin-autostart = "2.5.1"
tauri-plugin-notification = "2.4.0"
rusqlite = { version = "*", features = ["bundled"] }   # Windows 첫 빌드 후 정확한 버전으로 고정
serde = { version = "1", features = ["derive"] }
serde_json = "1"
chrono = "0.4"                                          # KST 고정 오프셋(+09:00) 계산용

[build-dependencies]
tauri-build = { version = "2", features = [] }
```

`rusqlite bundled`는 SQLite를 C 소스로 함께 컴파일하므로 Windows에 MSVC C 도구가 필요하다 — Tauri 자체가 이미 Visual Studio Build Tools를 요구하므로 추가 전제는 없다. `[미검증]`

### 1.3 플러그인 등록 순서 (코드 골격에 주석으로 고정)

```rust
tauri::Builder::default()
    // 1) single-instance는 반드시 첫 번째. 공식 문서: "must be the first one to be registered to work well"
    .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
        // 두 번째 실행 시: 새 프로세스 대신 기존 위젯을 표시·활성화
        window::show_and_activate(app);
    }))
    // 2) window-state: 위치만 저장/복원 (§6)
    .plugin(tauri_plugin_window_state::Builder::new()
        .with_state_flags(tauri_plugin_window_state::StateFlags::POSITION)
        .build())
    .plugin(tauri_plugin_global_shortcut::Builder::new().build())
    .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, None))
    .plugin(tauri_plugin_notification::init())
    .setup(|app| { tray::build(app)?; hotkey::register_default(app)?; window::bounds_guard_then_show(app)?; Ok(()) })
    .invoke_handler(tauri::generate_handler![ /* §4 */ ])
```

- single-instance 순서 제약: `[Windows·Tauri 1차 문서]` (https://v2.tauri.app/plugin/single-instance/). 어기면 "가끔 두 개가 뜬다"는 비결정적 증상이 된다.
- `StateFlags::POSITION` 존재: `[Windows·Tauri 1차 문서]`. `Builder::with_state_flags` 메서드명: `[미검증]`.
- 나머지 식별자(`MacosLauncher`, 클로저 시그니처): `[미검증]` — Windows 첫 컴파일에서 확정.

### 1.4 `tauri.conf.json` 보안·창 기본값

```jsonc
{
  "identifier": "app.workdashboard.widget",          // [Claude 제안] 역도메인 형식. 조직 도메인 확정 시 변경(데이터 경로에 쓰이므로 스파이크 이후 변경은 마이그레이션 대상)
  "productName": "WorkDashboard",                     // 번들 파일명에 쓰이므로 ASCII. 표시명은 창 title에서 한국어
  "app": {
    "windows": [{
      "label": "widget",
      "title": "직거래 일정관리",
      "width": 320, "height": 110,
      "resizable": false,
      "decorations": false,
      "transparent": true,
      "shadow": false,                                // 검증 대상: tauri#14859 (§3.5)
      "alwaysOnBottom": true,
      "skipTaskbar": true,                            // 검증 대상: tauri#10422 (§3.5)
      "focus": false,
      "visible": false                                // 경계 가드(§6) 통과 후 Rust에서 show()
    }],
    "security": {
      "csp": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' asset: http://asset.localhost data:; connect-src 'self' ipc: http://ipc.localhost; object-src 'none'; frame-src 'none'; base-uri 'none'",
      "devCsp": null                                  // dev 서버(HMR) 완화는 여기만. 릴리스 csp에 새지 않게 분리
    }
  }
}
```

- `alwaysOnBottom` / `skipTaskbar` / `transparent` / `decorations` 필드 존재와 Windows 지원: `[Windows·Tauri 1차 문서]` (docs.rs `tauri_utils::config::WindowConfig`). Windows에서 `transparent`+`decorations:false`는 macOS와 달리 private API가 필요 없다 `[Windows·Tauri 1차 문서]`.
- `shadow` / `focus` / `visible` / `resizable` / `devCsp` 필드명: `[미검증]` — 스키마 검증(`pnpm tauri build`의 conf 검사)은 Linux에서도 일부 가능하나 최종은 Windows.
- **CSP는 설정하지 않으면 아예 적용되지 않는다** `[Windows·Tauri 1차 문서]` (https://v2.tauri.app/security/csp/ "The CSP protection is only enabled if set on the Tauri configuration file."). 위 문자열은 **시작점**이며 `[미검증]`: Fluent UI v9(Griffel)의 런타임 스타일 주입이 `style-src`에 걸리면 Windows 실기에서 콘솔 CSP 위반 0건이 될 때까지 좁혀 간다(넓히지 않는다). `ipc:`·`http://ipc.localhost`·`asset:`는 Tauri 2 문서 관례 `[미검증: 검토 시 재확인 안 됨]`.

### 1.5 오프라인 정책 `[제품문서 근거: G2-1]`

- 런타임 외부 네트워크 요청 **0건**. 서체·아이콘·스크립트 전부 번들 또는 시스템. CDN(`fonts.googleapis.com`, `cdn.tailwindcss.com` 등) 링크는 코드 리뷰에서 자동 리젝트(CLAUDE.md 규칙).
- 서체: **맑은 고딕(Malgun Gothic) 시스템 서체, 400/700만** `[사용자 결정 ④]`. 번들 서체 0KB. Fluent `fontFamilyBase`에는 한글이 없으므로(§11) 테마 오버라이드로 강제.
- CSP `font-src 'self'; connect-src 'self' ipc: http://ipc.localhost`가 이 정책을 빌드 단계에서 강제한다.
- updater 플러그인은 스파이크에 넣지 않는다(§12, `docs/risk/deployment-prereqs.md`).

---

## 2. 구현 범위

### 2.1 단일 창 `[제품문서 근거: tauri_spike_order.md:34-57]`

기본 크기: width 320 / height 110, 고정(`resizable:false`). 최소 크기 별도 지정 불필요.

표시(원본 그대로):
- 오늘 날짜 — 형식 `M월 d일 (E)` `[제품문서 근거: 정오표 G5-4 토큰 date_format]`
- 오늘 일정 수
- 확인 필요 수
- 가장 가까운 일정 1건 — `HH:mm 제목`

```
┌────────────────────────┐
│ 9월 24일 (목)   확인 1 │
│ 오늘 3                 │
│ 14:00 업체 일정 확인   │
└────────────────────────┘
```

실제 일정 DB 구현은 불필요. SQLite에 seed 4~5건만 저장해 읽는다(§5).

### 2.2 스파이크 한정 추가 요소

| 요소 | 이유 | 범위 제한 |
|---|---|---|
| **IME 검증용 입력란 1개** (Activated 상태에서만 표시, `placeholder="한글 입력 검증용 · 스파이크 전용"`) | WebView2 한글 조합 중 포커스 이탈 크래시(#5475)를 재현하려면 위젯 안에 입력 요소가 있어야 한다 `[제품문서 근거: G1-3]` | Layer 0 "입력 요소 0" 규칙 `[스킬 근거: 독트린 U5]`의 **명시적 예외**. Resting에서는 DOM에 존재하지 않게 하고, Phase 5에서 제거 |
| **상태 배지** (Locked / Click-through / Edit / 배치 변형명) | 실기 스크린샷만으로 어떤 상태였는지 판독 가능해야 한다 | 8px 텍스트 금지 → 12px 하한 유지 `[스킬 근거]` |
| **진단 로그 창은 없음** — 대신 Rust `log` → stderr + `%LOCALAPPDATA%\<identifier>\logs\spike.log` | ACL 거부·핫키 등록 실패·경계 가드 이동을 파일로 남겨 체크리스트 근거로 첨부 | 로그에 개인정보 없음(seed 제목만) |

### 2.3 하지 않는 것

- Layer 1~3, 캘린더, 인스펙터, Quick Add 실제 저장 — 없음.
- 위젯 크기 조절, 테마 전환, 다국어 — 없음.
- 변형 2(WorkerW 재부모화) 본선 구현 — **분기 브랜치만 준비**(ADR-0004). 본선은 변형 1.

---

## 3. Window State

### 3.1 상태표

| 속성 | Resting / Locked | Activated | Layout Edit |
|---|---|---|---|
| `always_on_bottom` | true | true 유지(A안) / false 일시 해제(B안) — §7 #4에서 A/B 비교 | true |
| `ignore_cursor_events` (click-through) | **설정값** `widget.click_through` (기본 true) | false | false |
| 포커스 | 가져오지 않음(`focus:false` 생성, `set_focus()` 호출 금지) | `set_focus()` 1회 | 편집 중 포커스 허용 |
| `skip_taskbar` | true | true | true |
| 드래그 | 불가 | 불가 | handle mousedown → `start_dragging()` |
| 표시 요소 | 날짜·카운트·최근접 일정·잠금 배지 | + 닫기(Esc) 안내, IME 검증 입력란 | + drag handle, "저장" / "취소" |
| 진입 | 앱 시작 / 잠금 복귀 / Esc / 30초 무입력 | 전역 단축키 / 트레이 "위젯 활성화" / (click-through OFF일 때) 위젯 클릭 | 트레이 "레이아웃 편집" |
| 이탈 | → Activated / Layout Edit | Esc·30초 무입력 → Resting | 저장·취소 → Resting |

`[제품문서 근거: tauri_spike_order.md:61-83 원문 3상태]`. 30초 자동 잠금은 `[Claude 제안]` — "다시 잠그면 즉시 방해하지 않는 상태로 복귀"(원본 §7)를 사용자가 잊어도 성립시키기 위함. 값은 settings `widget.auto_lock_sec`.

### 3.2 전이는 전부 Rust에서

상태 전이는 `src-tauri/src/window/state.rs`의 `WidgetState` 상태기계 하나가 소유하고, 프런트는 `invoke('set_widget_mode', {...})`로 요청한 뒤 `widget://state-changed` 이벤트로 결과를 받는다. 이유: 창 setter 권한을 프런트에 주지 않기 위해(§4) + 트레이·핫키·UI 세 진입점이 같은 코드를 타게 하기 위해. `[제품문서 근거: G0-0]`

### 3.3 "focus를 가져오지 않음"의 구현 후보 `[미검증]`

- 생성 시 `focus: false`; Resting에서 `show()`만 호출하고 `set_focus()`는 호출하지 않는다.
- Windows에서 `ShowWindow`가 활성화를 동반하는지는 tao 구현에 달려 있어 실기에서만 판정된다(§7 #15, §9 PASS 1).
- 실패 시 대안: `set_focusable(false)` (tauri 2.x에 존재한다고 알려짐 `[미검증]`) → 그래도 실패면 Win32 `WS_EX_NOACTIVATE` 스타일 적용은 **변형 2 브랜치 범위**로 보내고 본선에서는 기록만 한다.

### 3.4 위젯 배치 3변형 → `docs/decisions/ADR-0004-widget-placement-3variants.md`

| 변형 | 요지 | 본 스파이크 |
|---|---|---|
| 1. `always_on_bottom` 단독 | Tauri 공식 API만. Win+D/바탕 화면 보기/Aero Peek에서 **가려짐이 예상됨** | **본선 구현 + 계측**(가려짐 시각·복귀 시각·복귀 위치 기록) |
| 2. WorkerW 재부모화 (`tauri-plugin-wallpaper` attach 계열) | 데스크톱 아이콘 뒤 WorkerW에 부모화. Win+D 생존. explorer 재시작 시 재부착 필요 | **분기 브랜치 `spike/placement-workerw` 준비**(의존성·capability·재부착 훅 스텁), 본선 판정 후 실행 |
| 3. 최소화 즉시 복원 훅 | Win+D 후 `WM_WINDOWPOSCHANGING`/최소화 감지 → 즉시 복원. 깜빡임 | 문서 기록만. 변형 2 실패 시 대안 |

핵심 사실: **`always_on_bottom`은 '다른 창 아래'만 보장하고 Win+D 생존을 보장하지 않는다.** `[Windows·Tauri 1차 문서]` (tauri-plugin-wallpaper README가 정확히 이 격차를 메우기 위해 존재; F17 문구 정정 — "함께 최소화"가 아니라 "상승한 바탕 화면에 가려짐", 해제 시 복귀 `[제품문서 근거: G1-1]`).

### 3.5 알려진 미해결 이슈 (본 스파이크의 실기 판정 대상)

| 이슈 | 내용 | 등급 | 스파이크 대응 |
|---|---|---|---|
| tauri#10422 `skipTaskbar` not working on Windows | v2에서 `"skipTaskbar": true`가 작업 표시줄에서 사라지지 않는다는 보고. 보고자는 `WS_EX_TOOLWINDOW` 우회도 실패. 열린 상태(needs-more-info)로 파악 — 현재 상태 확신도 낮음 | `[Windows·Tauri 1차 문서]` 본문 / `[미검증]` 현재 상태 | §7 #2·#26. 실패 시 `WS_EX_TOOLWINDOW` 우회를 변형 2 브랜치에서 시도, 본선은 기록 |
| tauri#14859 title bar visible when `decorations:false` + `shadow:false` | 이 조합에서 네이티브 타이틀바가 남는다는 보고 | `[Windows·Tauri 1차 문서]` | §7 #25. 재현 시 `shadow:true`로 A/B 스크린샷 |
| WebView2Feedback #5475 한글 IME 조합 중 포커스 이탈 시 크래시 (`RenderWidgetHostViewAura::InsertText`) | 2025-12-24 등록, 미해결. 이 위젯은 click-through 토글·핫키로 포커스가 수시로 드나들어 트리거 조건을 상시 만든다 | `[Windows·Tauri 1차 문서]` 본문 / `[미검증]` 재현 조건 | §7 #19, §9 PASS 13. 크래시 시 재현 절차·WebView2 Runtime 버전 기록 |

---

## 4. 반드시 구현할 명령 + 권한 매핑

### 4.1 방침 `[제품문서 근거: G0-0, G0-2, G0-4]`

1. **모든 창 상태 전이·플러그인 호출은 Rust `#[tauri::command]` 또는 트레이/핫키 핸들러 안에서 수행**한다. 프런트엔드는 `invoke()`와 `listen()`만 쓴다.
2. 따라서 `src-tauri/capabilities/default.json`의 permissions는 **`core:default` 하나**다. `core:window:allow-set-*`, `global-shortcut:*`, `autostart:*`, `window-state:*`, `sql:*`은 **부여하지 않는다**.
3. `core:window:default`에는 setter가 하나도 없다(`get_all_windows, scale_factor, inner_position, … is_always_on_top` 등 read-only만) `[Windows·Tauri 1차 문서]` (https://v2.tauri.app/reference/acl/core-permissions/). 그러므로 만약 프런트에서 `getCurrentWindow().setIgnoreCursorEvents()`를 직접 호출하는 코드가 생기면 그것은 **버그**이며 ACL 거부(콘솔 "not allowed" 계열 `[미검증: 정확한 문구]`)로 나타난다.
4. 앱 자체 command는 `build.rs`의 AppManifest에 commands를 선언하지 않는 한 기본 허용된다고 이해하고 있다 `[미검증]`. 스파이크는 선언하지 않는다. Windows 첫 실행에서 `invoke`가 거부되면 `src-tauri/permissions/`에 `allow-<command>`를 생성해 capability에 추가하고 이 절을 갱신한다.
5. ACL 오류를 `try/catch`로 삼키지 않는다. `bridge/tauri.ts`의 `invoke` 래퍼는 오류를 콘솔 `console.error('[ACL?]', cmd, err)`로 남기고 다시 던진다. `[제품문서 근거: G0-4]`

### 4.2 매핑표

| 원본 §4 명령 | 진입점 | Rust command / 핸들러 | 내부에서 호출하는 Tauri API | 프런트가 직접 호출했다면 필요했을 permission | Rust 래핑 시 프런트 권한 |
|---|---|---|---|---|---|
| 위젯 표시 | Tray | `show_widget` | `Window::show()` (focus 안 줌), 경계 가드(§6) | `core:window:allow-show` | 없음 |
| 위젯 활성화 | Tray / Hotkey / UI | `activate_widget` | `set_ignore_cursor_events(false)`, `set_focus()`, (B안) `set_always_on_bottom(false)` | `core:window:allow-set-ignore-cursor-events`, `allow-set-focus`, `allow-set-always-on-bottom` | 없음 |
| 잠금/클릭통과 전환 | Tray / UI(Esc) | `set_lock_mode { click_through: bool }` | `set_ignore_cursor_events(bool)`, `set_always_on_bottom(true)` | 위와 동일 | 없음 |
| 레이아웃 편집 진입 | Tray | `enter_layout_edit` | `set_ignore_cursor_events(false)`, 편집 UI 이벤트 | `core:window:allow-set-ignore-cursor-events` | 없음 |
| 드래그 시작 | UI handle mousedown | `start_layout_drag` | `Window::start_dragging()` | `core:window:allow-start-dragging` (`data-tauri-drag-region` 속성 사용 시에도 동일 권한 필요) | 없음 |
| 레이아웃 저장 / 취소 | UI | `save_layout` / `cancel_layout` | window-state `save_window_state(StateFlags::POSITION)` `[미검증: API명]`, settings 기록, Resting 복귀 | `window-state:allow-save-window-state` | 없음 |
| 시작프로그램 on/off | Tray | `set_autostart(enabled)` / `get_autostart` | `app.autolaunch().enable()/disable()/is_enabled()` `[미검증: API명]` | `autostart:allow-enable`, `allow-disable`, `allow-is-enabled` | 없음 |
| 종료 | Tray | `quit_app` | `app.exit(0)` | (JS라면 `tauri-plugin-process`의 `process:allow-exit`) | 없음 |
| 전역 단축키 등록/변경 | setup / Settings | `set_hotkey(combo)` | `global_shortcut().on_shortcut()` / `register()` `[미검증: API명]` | `global-shortcut:allow-register`, `allow-unregister`, `allow-is-registered` | 없음 |
| 오늘 요약 읽기 | UI mount / 1분 타이머 | `get_today_summary` | rusqlite (§5) | (`tauri-plugin-sql`이었다면 `sql:allow-load`, `sql:allow-select`) | 없음 |
| 설정 읽기/쓰기 | UI / Tray | `get_settings` / `set_setting` | rusqlite | 동상 | 없음 |
| 위젯 상태 조회 | UI mount | `get_widget_state` | 상태기계 읽기 | — | 없음 |
| 상태 변경 통지 | Rust → UI | 이벤트 `widget://state-changed` | `app.emit()` | `core:event:allow-listen` (`core:default`에 포함) | `core:default` |
| 위치 초기화 `[Claude 제안]` | Tray | `reset_position` | 기본 모니터 안전 영역으로 이동(§6) | `core:window:allow-set-position` | 없음 |
| 일정 영역 클릭 | UI | (없음 — Activated에서만 클릭 이벤트, 스파이크는 콘솔 로그 + 배지 강조) | — | — | — |
| 잠금 상태 표시 | UI | `get_widget_state` 결과 렌더 | — | — | — |

### 4.3 `src-tauri/capabilities/default.json` (산출물 §12-10)

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "widget-default",
  "description": "위젯 창 프런트엔드. 앱 command 호출과 이벤트 수신만 허용. core:window setter·플러그인 권한은 의도적으로 0.",
  "windows": ["widget"],
  "permissions": ["core:default"]
}
```

이 파일이 위 표와 다르면(권한이 하나라도 늘면) PR 설명에 이유를 적고 이 절을 갱신한다.

### 4.4 전역 단축키 `[제품문서 근거: tauri_spike_order.md:95-97]`

- 기본값 **`Ctrl+Alt+D`** `[Claude 제안 — plan §5 기본값]`. Win+ 계열은 OS 예약이라 후보 제외 `[Windows·Tauri 1차 문서: 플러그인 문서 + global-hotkey Error enum]`.
- 등록 결과를 반드시 확인한다: Windows 전역 핫키는 선착순이며, 하부 `global-hotkey` crate의 `Error::AlreadyRegistered` / `Error::FailedToRegister`가 실패를 구분한다 `[Windows·Tauri 1차 문서]` (플러그인 표면에서는 `GlobalHotkey(String)`으로 뭉개져 올라올 수 있음 `[Windows·Tauri 1차 문서]`).
- 실패 시 UX: 트레이 알림 "단축키 Ctrl+Alt+D를 다른 프로그램이 사용 중입니다. 트레이 메뉴 > 단축키 변경"; settings `hotkey.activate`에 대체 조합(`Ctrl+Alt+W`, `Ctrl+Shift+Alt+D`) 후보를 트레이 서브메뉴로 제공. 스파이크는 후보 3개 고정 목록으로 충분.
- 판정: `event.code` 기준이 아니라 OS 전역 등록이므로 한/영 상태와 무관 `[미검증]` — §7 #4에서 한글 IME 상태에서 20회 반복.

---

## 5. SQLite (Rust command 경유)

### 5.1 방침 `[제품문서 근거: G0-2, G3-0]`

- 프런트엔드에 `sql:*` 권한을 부여하지 않는다. `tauri-plugin-sql`은 의존성에서 제외한다(플러그인의 `sql:default`는 `select/load/close`만 포함하고 쓰기에는 `sql:allow-execute`가 필요한데, 이를 열면 렌더러에서 임의 SQL이 가능해진다 `[Windows·Tauri 1차 문서]` https://v2.tauri.app/plugin/sql/).
- SQL 문자열은 전부 `src-tauri/src/storage/` 안에만 존재한다.
- DB 경로: `%LOCALAPPDATA%\app.workdashboard.widget\app.db` — Tauri `app_local_data_dir()` `[미검증: API명, 실제 해석 경로는 Windows에서 로그로 확인]`. 로밍 프로필(`%APPDATA%`)·공유폴더 배치 금지 `[제품문서 근거: G3-0, plan §5 기본값]`.
- 파일 권한: 사용자 프로필 하위이므로 기본 NTFS ACL이 사용자 전용. 별도 조치 없음 `[미검증: 조직 정책]`.
- 암호화: 스파이크에서는 평문. 전략(BitLocker/EFS 위임 vs `bundled-sqlcipher`)은 Phase 4 게이트에서 택일 `[제품문서 근거: G3-3]`.

### 5.2 스키마 (v1)

```sql
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at INTEGER NOT NULL            -- UTC epoch ms
);
CREATE TABLE IF NOT EXISTS tasks (
  id         INTEGER PRIMARY KEY,
  title      TEXT    NOT NULL,
  starts_at  INTEGER NOT NULL,           -- UTC epoch ms (정오표 G5-1: 시각은 INTEGER UTC)
  status     TEXT    NOT NULL CHECK (status IN ('planned','needs_confirmation','done'))
);
INSERT OR IGNORE INTO settings(key, value, updated_at) VALUES ('schema_version', '1', 0);
```

`[제품문서 근거: tauri_spike_order.md:106-118 테이블 최소 + 정오표 G5-1 시간 타입]`. `journal_mode`는 기본(DELETE) 유지 — 단일 프로세스·소량 쓰기라 WAL 필요 없음 `[Claude 제안]`.

### 5.3 settings 키

| 키 | 값 | 기본 | 소유 |
|---|---|---|---|
| `schema_version` | `"1"` | 1 | storage |
| `widget.mode` | `locked` / `edit` | locked | window/state |
| `widget.click_through` | `0`/`1` | 1 | window/state |
| `widget.auto_lock_sec` | 정수 | 30 | window/state |
| `widget.placement` | `bottom` (변형 1) / `workerw` (변형 2 브랜치) | bottom | window/placement |
| `widget.last_monitor` | JSON `{name, x, y, w, h, scale}` (진단용) | — | window/bounds |
| `hotkey.activate` | `Ctrl+Alt+D` | Ctrl+Alt+D | hotkey |
| `autostart.enabled` | `0`/`1` (플러그인 상태의 미러, 진실은 `is_enabled()`) | 0 | commands |

창 **위치 자체**는 window-state 플러그인 파일이 소유하며 settings에 중복 저장하지 않는다(§6).

### 5.4 Seed (앱 최초 실행 시 1회, `tasks`가 비어 있을 때만)

오늘(Asia/Seoul, UTC+9 고정 — DST 없음 `[제품문서 근거: nullreports round2 날짜]`) 기준으로 생성:

| # | title | starts_at (오늘 KST) | status |
|---|---|---|---|
| 1 | 장터 부스 배치 확인 | 09:30 | planned |
| 2 | 업체 참가일 확인 | 11:00 | needs_confirmation |
| 3 | 업체 일정 확인 | 14:00 | planned |
| 4 | 주간 보고 정리 | 16:30 | planned |
| 5 | 다음 장 준비 회의 | 내일 10:00 | planned |

→ "오늘 3"은 `planned` 3건(#1·#3·#4), "확인 1"은 #2, 최근접은 현재 시각 이후 첫 건. 원본 "오늘 일정 3건 + 확인 필요 1건" 충족 `[제품문서 근거: tauri_spike_order.md:120-122]`. 업체 실명·연락처는 seed에 넣지 않는다 `[제품문서 근거: G3-4]`.

### 5.5 command 시그니처

```rust
#[derive(serde::Serialize)]
struct TodaySummary {
    date_label: String,               // "9월 24일 (목)"
    today_count: u32,                 // status='planned' AND KST 오늘
    needs_confirmation_count: u32,    // status='needs_confirmation' AND KST 오늘  [plan §5 기본 정의의 스파이크 축약]
    nearest: Option<NearestTask>,     // { time_label: "14:00", title } — now 이후 첫 건, 없으면 None
    read_latency_us: u64,             // §8 계측: Instant로 잰 쿼리 왕복
}
#[tauri::command] fn get_today_summary(state: State<Db>) -> Result<TodaySummary, String>
#[tauri::command] fn get_settings(state: State<Db>) -> Result<HashMap<String,String>, String>
#[tauri::command] fn set_setting(state: State<Db>, key: String, value: String) -> Result<(), String>
```

파생 계산(오늘 범위·최근접)은 `src/domain/`(TypeScript)과 `src-tauri/src/storage/derive.rs`(Rust) **양쪽에 같은 골든 케이스**로 테스트한다 — TS 쪽은 Linux에서 vitest로 통과시키고, Rust 쪽은 `cargo test -p workdashboard-domain`이 가능하도록 Tauri 비의존 crate로 분리한다(§10, §13).

---

## 6. 위치 복원

### 6.1 사실 `[Windows·Tauri 1차 문서]`

- window-state가 저장하는 항목은 `StateFlags` 6개(SIZE, POSITION, MAXIMIZED, VISIBLE, DECORATIONS, FULLSCREEN)뿐이고 **모니터 식별자는 저장하지 않는다**. 기본값 `all()`.
- 저장되는 좌표는 물리 좌표. 모니터 분리·배치 변경 시 화면 밖 복원 사례(clash-verge-rev#6945: 창 재생성 시 `.center()`를 덮어써 창이 보이지 않게 됨; `window_state.json`에 Windows 그림자 오프셋(-9,-9)까지 저장됨).

### 6.2 저장 `[제품문서 근거: tauri_spike_order.md:129-137]`

| 원본 요구 | 구현 | 저장 위치 |
|---|---|---|
| monitor identifier 가능한 범위 | `current_monitor().name()` + 물리 `position/size` + `scale_factor` | settings `widget.last_monitor` (진단·복원 판정용) |
| x/y | window-state `StateFlags::POSITION`만 | 플러그인 파일(`app_config_dir/.window-state.json` `[미검증: 파일명]`) |
| width/height | 저장하지 않음 — 320×110 고정. `SIZE` 플래그를 켜면 고정 크기 위젯이 깨질 수 있음 `[Windows·Tauri 1차 문서 함의]` | — |
| scale factor | `widget.last_monitor.scale` | settings |
| mode(locked/edit) | `widget.mode` — 단, 재시작 시 항상 `locked`로 시작 `[Claude 제안: 편집 중 종료돼도 다음 시작은 방해 없는 상태]` | settings |
| click-through setting | `widget.click_through` | settings |

### 6.3 복원 절차 (앱 시작 시, `visible:false` → 가드 → `show()`)

1. window-state가 창 생성 시 POSITION을 복원한다 `[미검증: 자동 복원 시점]`.
2. `bounds_guard(window)`:
   - `outer_position()` / `outer_size()`(물리)와 `available_monitors()`의 각 `position()`/`size()`(물리)를 비교 — **물리 좌표끼리만 비교**한다(DPI 혼동 방지 `[제품문서 근거: 원본 §6 "물리 픽셀/논리 좌표 혼동 방지"]`).
   - 어떤 모니터와도 위젯 면적의 **50% 이상** 겹치지 않으면 → `primary_monitor()`의 안전 영역으로 이동: `x = mon.x + mon.w - 320*scale - 16*scale`, `y = mon.y + 16*scale` (우상단, 작업 표시줄·바탕 화면 아이콘 열과 겹칠 확률이 낮음) `[Claude 제안]`. Tauri `Monitor::work_area()` 존재 여부 `[미검증]` — 있으면 work area 기준.
   - 이동했으면 로그 `bounds_guard: moved from (x,y) to (x',y') reason=offscreen|monitor_missing` + settings `widget.last_monitor` 갱신.
3. `show()`. 포커스는 주지 않는다.
4. 가드 재실행 시점: `WindowEvent::ScaleFactorChanged`, `WindowEvent::Moved`(디바운스 500ms) `[미검증: 이벤트명]`, 트레이 "위젯 표시", 트레이 "위치 초기화", single-instance 콜백. 모니터 분리 자체를 알려주는 Tauri 이벤트는 확인하지 못했으므로 `[미검증]` 절전 복귀 후에는 사용자가 트레이 "위젯 표시"로 복구할 수 있어야 한다(§9 PASS 5의 수동 복구 경로).

### 6.4 저장 시점

- Layout Edit "저장" → `save_window_state(StateFlags::POSITION)` 명시 호출 + `widget.mode=locked`.
- 앱 종료(트레이 "종료") → 플러그인 자동 저장 `[미검증]`. crash 시에는 마지막 명시 저장분이 남는다 — 이것이 "crash 후 재실행" 시나리오(§7 Lifecycle)의 기대치.

---

## 7. 검증 매트릭스

원본 §7의 5개 축(DPI / 해상도 / Monitor / App interaction / Lifecycle)을 유지하고 두 축(배포 전제 / ACL)을 추가한다. 번호표(§7.8)는 `spec_v2.md:479-496` 필수 검증 17항목 번호를 그대로 쓰고 18~26을 덧붙인다. **전 항목 Windows 실기 전 상태 = 미검증.** 기입은 `docs/risk/spike-handoff-checklist.md`.

### 7.1 DPI `[제품문서 근거: tauri_spike_order.md:141-146]`
100% / 125% / 150% / **175%** — 각각 스크린샷(§12-7). Linux에서는 Playwright `deviceScaleFactor`로 프런트 렌더만 사전 확인(§13).

### 7.2 해상도
1366×768 / 1920×1080 / 2560×1440 / 3840×2160. 사용자 PC에 있는 조합만 실측하고 없는 조합은 "미검증(장비 없음)"으로 남긴다.

### 7.3 Monitor
single / dual / secondary left·right / disconnect·reconnect + **혼합 DPI(예: 주 150% + 부 100%)에서 위젯을 부 모니터로 옮긴 뒤 재시작** (#23) `[제품문서 근거: facts implications]`.

### 7.4 App interaction
동시 실행: 한/글(HWP), Excel, Edge/Chrome, 파일 탐색기. 확인(원본 5문항 유지):
- 위젯이 입력 focus를 빼앗지 않는가 (#15)
- 클릭 통과가 실제로 동작하는가 (#3)
- always-on-bottom이 정상인가 (#1)
- 단축키 활성화 후 조작 가능한가 (#4)
- 다시 잠그면 즉시 방해하지 않는 상태로 복귀하는가 (#3)
- **추가** 한글 IME: Activated 입력란에 두벌식으로 "고성군농협직거래장터" 조합 중 ① click-through 토글 ② 핫키 ③ 다른 창 클릭으로 포커스를 뺏었다 되돌리기 각 5회, 한/영 전환 10회 — 글자 유실·중복·크래시 0 (#19) `[제품문서 근거: G1-3]`

### 7.5 Lifecycle
app restart / Windows sign-out·in / sleep·resume / **Explorer restart**(변형 2에서는 WorkerW 파괴 → 재부착 판정) / autostart / crash 후 재실행(작업 관리자에서 강제 종료 후 재실행) + **Win+D · 작업 표시줄 우측 끝 "바탕 화면 보기" · Aero Peek** 각 3회: 가려지는가, 해제 후 원위치로 돌아오는가, 복귀 지연(초) (#18) `[제품문서 근거: F17/G1-1]` + **미서명 빌드의 SmartScreen 경고 / 보안 SW의 실행·autostart(HKCU Run) 차단** (#21) `[제품문서 근거: G4-1]`.

### 7.6 배포 전제 (신설)
- WebView2 Runtime 존재 여부·버전 사전 기록, 없을 때 `webviewInstallMode` 선택에 따른 설치 성공 여부 (#24) `[제품문서 근거: G4-0]`
- 관리자 권한 없는 **표준 계정**에서 NSIS currentUser 설치 → 실행 → autostart 등록 → 재로그인 후 자동 실행 (#22) `[제품문서 근거: G4-2]`

### 7.7 ACL (신설)
- 위젯의 모든 명령(§4.2) 실행 후 WebView2 DevTools 콘솔과 `spike.log`에 ACL 거부("not allowed" 계열) 0건, `catch`로 삼킨 곳 0건(코드 grep) (#20) `[제품문서 근거: G0-4]`

### 7.8 번호표 (체크리스트와 1:1)

| # | 항목 | 출처 | 어디서 | 상태 |
|---|---|---|---|---|
| 1 | always-on-bottom(일반 창 아래 유지) | spec §11-1 | Windows | 미검증 |
| 2 | skip-taskbar(작업 표시줄·Alt+Tab 미노출) ★승격 | spec §11-2 + tauri#10422 | Windows | 미검증 |
| 3 | click-through ON/OFF 20회 | spec §11-3 | Windows | 미검증 |
| 4 | global hotkey activate 20회(한글 IME 상태 포함), A/B(always-on-bottom 유지/해제) | spec §11-4 | Windows | 미검증 |
| 5 | drag(Layout Edit) | spec §11-5 | Windows | 미검증 |
| 6 | position persistence(재시작·재부팅) | spec §11-6 | Windows | 미검증 |
| 7 | tray 6개 명령 | spec §11-7 | Windows | 미검증 |
| 8 | autostart on/off·재로그인 | spec §11-8 | Windows | 미검증 |
| 9 | single instance(두 번 실행 → 기존 창 활성화) | spec §11-9 | Windows | 미검증 |
| 10 | SQLite read/write(Rust command 경유, seed 읽기 + set_setting 쓰기) | spec §11-10 | Linux(도메인 테스트) / Windows(통합) | 미검증 |
| 11 | 100/125/150/175% DPI 스크린샷 | spec §11-11 | Linux(렌더만) / Windows | 미검증 |
| 12 | multi-monitor(dual, left/right, disconnect/reconnect) | spec §11-12 | Windows | 미검증 |
| 13 | sleep/resume | spec §11-13 | Windows | 미검증 |
| 14 | Explorer restart | spec §11-14 | Windows | 미검증 |
| 15 | 한/글·Excel·브라우저 focus 방해 여부 | spec §11-15 | Windows | 미검증 |
| 16 | cold start | spec §11-16 | Windows | 미검증 |
| 17 | idle memory/CPU | spec §11-17 | Windows | 미검증 |
| 18 | **Win+D / 바탕 화면 보기 / Aero Peek** 생존·복귀 | F17, G1-1 | Windows | 미검증(변형 1에서 가려짐 예상) |
| 19 | **한글 IME 조합 중 포커스 이탈** | G1-3, #5475 | Windows | 미검증 |
| 20 | **ACL 거부 0건·catch 은폐 0건** | G0-0, G0-4 | Linux(grep) / Windows(콘솔) | 미검증 |
| 21 | **SmartScreen / 보안 SW의 실행·autostart 차단** | G4-1 | Windows(대상 PC) | 미검증 |
| 22 | **표준 계정 설치→실행→autostart** | G4-2 | Windows(대상 PC) | 미검증 |
| 23 | **멀티모니터 혼합 DPI** | facts | Windows | 미검증 |
| 24 | **WebView2 Runtime 존재/오프라인 설치** | G4-0 | Windows(대상 PC) | 미검증 |
| 25 | **decorations:false + shadow:false 타이틀바 잔존** | tauri#14859 | Windows | 미검증 |
| 26 | **skipTaskbar 미동작 시 우회(WS_EX_TOOLWINDOW) 필요 여부 기록** | tauri#10422 | Windows(변형 2 브랜치) | 미검증 |

---

## 8. 계측

원칙(원본 유지): 절대 기준보다 비교 가능한 기록이 목적. **목표 수치를 이 문서에 적지 않는다** — Microsoft의 WebView2 성능 문서에는 MB·ms 수치가 하나도 없고("can vary by hardware and content complexity"), 창 하나여도 browser/renderer/GPU 다중 프로세스가 뜬다고만 기술한다 `[Windows·Tauri 1차 문서]` (https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/performance). 스파이크는 **기준선(baseline)을 최초로 기록**하는 단계다.

| 항목 | 수단 | 기록 형식 | 비고 |
|---|---|---|---|
| cold start ms | ① Rust `main()` 진입 `Instant` → 첫 `widget://first-paint` 이벤트 수신까지 로그 ② 스톱워치: 더블클릭/autostart 로그인 시점 → 위젯 첫 표시(육안), 3회 중앙값 | `cold_start_ms: {internal, stopwatch×3}` | 재부팅 직후(디스크 캐시 없음)와 재실행(캐시 있음)을 구분 기록 |
| idle RSS | Windows 작업 관리자 > 세부 정보: `WorkDashboard.exe` + 소속 `msedgewebview2.exe` 전 프로세스 합계(작업 관리자 "프로세스" 탭의 그룹 합계도 병기); 보조로 **Browser Task Manager**(WebView2 DevTools > More tools) | `idle_rss_mb: {exe, webview2_sum, group}` 5분 유휴 후 | `[Windows·Tauri 1차 문서]` 도구명 |
| idle CPU | 작업 관리자 60초 관찰 평균(스크린샷 2장) | `idle_cpu_pct` | 1분 타이머 갱신 외 활동 없음이 기대치 |
| activated memory | Activated 진입 후 30초 시점 위와 동일 | `activated_rss_mb` | |
| SQLite read latency | `get_today_summary` 응답의 `read_latency_us`(Rust `Instant`) + 프런트 `performance.now()`로 잰 `invoke` 왕복 | `sqlite_read_us: {rust, ipc_roundtrip}` 20회 중앙값 | |
| click-through toggle latency | 프런트 `performance.now()` before `invoke('set_lock_mode')` → `widget://state-changed` 수신; 체감은 5단계 메모 | `toggle_ms` 20회 중앙값 + 체감 | |
| (선택) ETW | `WebView2.wprp` 프로필로 Windows Performance Recorder 트레이스 1회(콜드 스타트) | `.etl` 파일명만 기록 | `[Windows·Tauri 1차 문서]` 프로필명. 분석은 범위 밖 |
| 절전 전략 후보 | 위젯 Resting 5분 경과 시 WebView2 `MemoryUsageTargetLevel=Low` / 장기 미사용 시 `TrySuspend` — Tauri에서 `with_webview`로 `ICoreWebView2` 접근이 가능한지 | 적용 전/후 RSS 비교(적용 가능할 때만) | 완화 수단 자체는 `[Windows·Tauri 1차 문서]`, Tauri 경유 접근성은 `[미검증]` — 실패해도 스파이크 FAIL 아님 |

측정 환경(CPU·RAM·Windows 버전·WebView2 Runtime 버전·전원 옵션)을 표 머리에 함께 기록한다. 서로 다른 PC의 수치를 비교하지 않는다.

---

## 9. Acceptance Criteria

### PASS (전부 충족)

| # | 조건 | 원본 대비 |
|---|---|---|
| 1 | 일반 작업(한/글·Excel·브라우저 입력 중) 중 focus stealing 없음 — 위젯 표시·1분 갱신·트레이 조작·활성화 해제 시 입력 커서가 다른 앱에 그대로 남음 | 유지 |
| 2 | click-through ON/OFF 20회 반복 안정 | 유지 |
| 3 | global shortcut 20회 반복 안정(한글 IME 상태 10회 포함) | 보강 |
| 4 | always-on-bottom: 다른 일반 창 아래 유지 (**Win+D 계열은 #12로 분리**) | 범위 명확화 |
| 5 | 모니터/DPI 변경 후 화면 밖으로 사라지지 않음 — 자동 가드 또는 트레이 "위젯 표시/위치 초기화"로 즉시 복구 | 복구 경로 명시 |
| 6 | 재실행·재부팅 후 위치 복원 | 유지 |
| 7 | tray 종료 정상(프로세스 잔존 0, `msedgewebview2.exe` 잔존 0) | 보강 |
| 8 | single-instance 정상 | 유지 |
| 9 | SQLite seed 읽기 정상 **(Rust command 경유, 프런트 sql 권한 0)** + `set_setting` 쓰기 정상 | 보강 |
| 10 | JS/Rust console에 반복 오류 없음 | 유지 |
| 11 | **ACL**: capabilities에 열거되지 않은 권한 0건, ACL 거부 로그 0건, 권한 오류를 catch로 은폐한 코드 0건 | 신설 `[제품문서 근거: G0-4]` |
| 12 | **Win+D / 바탕 화면 보기 / Aero Peek**: 3회 모두 동일한 동작이 기록되고, 해제 후 위젯이 **원위치로 복귀**한다(변형 1에서 일시 가려짐은 예상된 결과이며 스파이크 FAIL이 아님 — Phase 4 게이트 조건은 ADR-0004) | 신설 `[제품문서 근거: G1-1]` |
| 13 | **한글 IME**: 조합 중 포커스 이탈 15회 + 한/영 전환 10회에서 글자 유실·중복·크래시 0 | 신설 `[제품문서 근거: G1-3]` |
| 14 | **표준 계정 설치**: 관리자 권한 없는 계정에서 설치→실행→autostart→재로그인 자동 실행 1회 성공 | 신설 `[제품문서 근거: G4-2]` |
| 15 | **WebView2 전제 기록** 완료(설치 여부·버전·`webviewInstallMode` 선택·근거) — 판정 항목이 아니라 기록 완료 조건 | 신설 `[제품문서 근거: G4-0]` |

### FAIL (하나라도 해당)

- always-on-bottom이 빈번히 깨짐(일반 창 위로 올라옴)
- click-through 후 다시 상호작용 불가
- focus stealing
- monitor 변경 시 위치 소실(수동 복구 경로로도 복구 불가)
- sleep/resume 후 window state 오작동
- **Win+D 해제 후에도 위젯이 돌아오지 않음(영구 소실)** `[신설]`
- **한글 조합 중 포커스 이탈로 WebView2 크래시 1회 이상(재현 가능)** `[신설]`
- **ACL 거부가 창 동작 실패로 위장된 채 판정됨(= #11 미충족 상태의 PASS 주장)** `[신설]`
- **표준 계정에서 설치 또는 autostart가 보안 SW·권한으로 차단되고 우회 경로가 없음** `[신설]`

### FAIL 시

동일 UI/Acceptance Criteria로 WPF + Win32 Spike를 수행할 수 있도록 **문제와 재현 절차**(Windows 빌드·WebView2 Runtime 버전·DPI·보안 SW·재현 단계·스크린샷·`spike.log`)를 기록한다 `[제품문서 근거: tauri_spike_order.md:225-228]`. 결정은 Phase 4 게이트(`spec_v2.md:587-590`, ADR-0006 예정)에서 내리며, 게이트는 **창 동작(Q1)과 배포 가능성(Q2)의 병렬 조건**이다 `[제품문서 근거: G4-4]`.

---

## 10. 코드 구조

원본 §10의 루트 배치(`src/`, `src-tauri/`)를 유지한다 `[제품문서 근거: tauri_spike_order.md:230-251, plan §5 "스파이크 위치=루트"]`. DB / Window / Frontend를 한 파일에 섞지 않는다.

```
WorkDashboard/
  package.json  pnpm-lock.yaml  vite.config.ts  tsconfig.json  index.html
  THIRD-PARTY-NOTICES.md              # 설치본에 동봉(§12-15)
  src/
    main.tsx
    app/
      App.tsx                         # 상태 구독(widget://state-changed) → AmbientWidget
      theme.ts                        # Fluent 테마: fontFamilyBase 오버라이드(맑은 고딕), 액센트 1
    components/
      AmbientWidget/
        AmbientWidget.tsx             # Resting / Activated / Edit 뷰 (입력 요소는 Activated에서만 마운트)
        StateBadge.tsx
        ImeProbeInput.tsx             # 스파이크 전용 (§2.2)
    domain/                           # Tauri 비의존 · vitest 골든 테스트 (Phase 5로 이식)
      date.ts                         # KST 오늘 범위, M월 d일 (E)
      derive.ts                       # todayCount / needsConfirmation / nearest
      derive.test.ts
    design/
      tokens.ts                       # design_tokens_v0.2.json 소비
    bridge/
      tauri.ts                        # invoke/listen 래퍼(오류 재던지기·[ACL?] 로그), 명령 이름 상수
      mock.ts                         # 브라우저 단독 실행용(Linux 시안·Playwright)
  src-tauri/
    Cargo.toml  build.rs  tauri.conf.json
    icons/
    capabilities/
      default.json                    # §4.3 — core:default 하나
    src/
      main.rs                         # Builder 체인(§1.3) — 플러그인 순서 주석
      lib.rs
      commands/
        mod.rs  window_cmd.rs  storage_cmd.rs  settings_cmd.rs  autostart_cmd.rs  hotkey_cmd.rs
      window/
        state.rs                      # WidgetState 상태기계(Resting/Activated/Edit)
        placement.rs                  # 변형 1 always_on_bottom; 변형 2 훅 자리(feature = "workerw")
        bounds.rs                     # 경계 가드(§6.3)
        tray.rs                       # 트레이 메뉴 6개 + 위치 초기화 + 단축키 변경
        hotkey.rs
      storage/
        db.rs  schema.rs  seed.rs  derive.rs
    domain/                           # (선택) Tauri 비의존 crate: derive 골든 테스트를 Linux `cargo test`로
  docs/  design/  .claude/            # 기존
```

- `src/domain/`과 `src-tauri/domain/`은 같은 골든 테이블(`docs/spec/golden-expand-plan.md`의 파생 지표 케이스)을 공유한다.
- 변형 2는 브랜치 `spike/placement-workerw`에서 `placement.rs`만 바꾸고 `Cargo.toml`에 wallpaper 계열 플러그인을 추가한다(ADR-0004).

---

## 11. 디자인 규칙

이 Spike에서도 웹페이지처럼 보이면 안 된다 `[제품문서 근거: tauri_spike_order.md:255-275]`. 규칙의 본문은 **`CLAUDE.md`**(우선순위·자동 리젝트 4항)와 **`.claude/skills/design-doctrine/SKILL.md`**(`docs/design/doctrine.md`의 원본)에 있고 여기서는 스파이크에 걸리는 것만 요약한다 `[스킬 근거]`.

금지(원본 유지): top nav / hero / card grid / KPI cards / marketing style / 큰 rounded card 중첩.
권장(원본 유지): compact / restrained / desktop utility / one accent / Fluent icons / clear text hierarchy.

추가(독트린·사용자 결정):
- **서체**: `"Malgun Gothic","맑은 고딕","Segoe UI Variable Text","Segoe UI",sans-serif`, 굵기 **400/700만**(맑은 고딕에 Semibold 컷이 없음 — MS 문서 표에는 Regular만 등재 `[Windows·Tauri 1차 문서]`, Bold 파일 존재는 `[미검증: 훈련지식]`, 700이 합성 볼드로 렌더되는지 §7 #11 스크린샷에서 판독). Fluent `fontFamilyBase`에는 한글이 없고 마지막 폴백이 generic sans-serif이므로 `theme.ts`에서 오버라이드 필수 `[Windows·Tauri 1차 문서]`. `fontFamilyNumeric`(Bahnschrift)도 같은 스택으로 덮어쓴다.
- **숫자**: `font-variant-numeric: tabular-nums` 전역. 시각 `HH:mm`.
- **크기 하한 12px**, 한글 자간 0, `word-break: keep-all`, `overflow-wrap: normal` `[스킬 근거]`.
- **뷰당 큰 글자 1개(날짜), Bold ≤ 2**.
- **액센트 1색**, "확인 필요"는 색이 아니라 형태(아이콘 + 문구)로 먼저 구분 `[스킬 근거]`.
- **아이콘**: `@fluentui/react-icons` 크기별 전용 컷(위젯 20px: `Calendar20Regular`, `Alert20Regular`, `LockClosed20Regular`, `LockOpen20Regular`, `ReOrder20Regular` `[미검증: 정확한 export명 — import 스모크로 확정, G2-4]`), CSS 스케일 금지.
- **모션**: 위젯은 83ms 크로스페이드만. 초 단위 타이머 금지 — 갱신은 분 경계 1회 + 상태 변경 시 `[스킬 근거]`.
- **Layer 0에 입력 요소 0** — 예외는 §2.2 IME 검증 입력란(Activated 한정, Phase 5 제거).
- **투명 창의 배경**: `transparent:true`이므로 위젯 표면색은 CSS로 그린다. 그레인·텍스처 없음.
- 자동 리젝트 4항(CLAUDE.md): 4열 KPI 타일 / 좌측 색 accent bar / LIVE·SYSTEM ONLINE·초 단위 시계 / `Math.random` 데이터.

최종 UI가 아니라 window behavior test이므로 과도한 디자인 작업 금지(원본 유지).

---

## 12. 산출물

원본 9개를 유지하고 8개를 추가한다.

| # | 산출물 | 위치 | 생산지 |
|---|---|---|---|
| 1 | 실행 가능한 Windows project (Linux에서 작성, Windows에서 첫 컴파일) | 루트 `src/`, `src-tauri/` | Linux 작성 / Windows 빌드 |
| 2 | README (스파이크 절: 상태표 "Windows 실기 검증 N/26") | `README.md` | Linux |
| 3 | 빌드 방법 (Windows: Rust MSVC·VS Build Tools·WebView2·pnpm; `pnpm tauri build`) | README | Linux 작성 / Windows 확인 |
| 4 | 기능 체크리스트 | `docs/risk/spike-handoff-checklist.md` | Linux 작성 / Windows 기입 |
| 5 | 테스트 결과표 (§7 26항목) | 동상 | Windows 기입 |
| 6 | known issues (#10422, #14859, #5475 + 실기에서 발견분) | README + 리스크 레지스터 갱신 | 양쪽 |
| 7 | screenshot **100/125/150/175%** DPI (원본 150%까지 → 175% 추가) | `docs/risk/evidence/dpi-{100,125,150,175}.png` | Windows |
| 8 | cold start / memory 측정 (§8 표 형식, 환경 머리표 포함) | 체크리스트 §측정 | Windows |
| 9 | PASS/FAIL 결론 (§9) | 체크리스트 사인오프 | Windows |
| 10 | **`src-tauri/capabilities/*.json` 전문 + §4.2 명령↔permission 표** (실제 파일과 표가 일치함을 grep으로 확인한 로그) | capabilities 파일 + 이 문서 §4 | Linux |
| 11 | **WebView2 전제 기록** (대상 PC의 Runtime 유무·버전, 선택한 `webviewInstallMode`와 근거) | `docs/risk/deployment-prereqs.md` 사전 확인표 | Windows 기입 |
| 12 | **서명 상태** (미서명 / OV / EV, SmartScreen·보안 SW 실측 결과) | 동상 | Windows 기입 |
| 13 | **설치 모드·데이터 경로** (NSIS currentUser, `%LOCALAPPDATA%\<identifier>\app.db`, 로그 경로, 인수인계 시 삭제 목록) | 동상 + README | Linux 작성 / Windows 확인 |
| 14 | **Linux 한계 문단** (아래 템플릿) | README 스파이크 절 머리 | Linux |
| 15 | **THIRD-PARTY-NOTICES.md 설치본 동봉** (Fluent System Icons MIT 등) | 루트 파일 + `bundle.resources` | Linux 작성 / Windows 설치본 확인 |
| 16 | **측정 기준선 표** (§8) — 목표 수치 없음 | 체크리스트 | Windows |
| 17 | **ADR-0004 변형 2 브랜치 상태** (`spike/placement-workerw` 존재 여부, 컴파일 여부) | ADR-0004 상태 절 | Linux 준비 / Windows 판정 |

### Linux 한계 문단 (README에 그대로 싣는다)

> 이 스파이크의 코드는 Linux 컨테이너(webkit2gtk·gtk3 없음)에서 작성되었다. 그 환경에서 확인된 것은 ① 프런트엔드 타입체크·`pnpm build` ② `src/domain/`·`src-tauri/domain/`의 골든 테스트 ③ `capabilities/default.json`이 §4.2 표와 일치함 ④ 브라우저 목(mock)에서의 위젯 렌더와 DPI 100/125/150/175% 스크린샷뿐이다. `src-tauri`는 그 환경에서 **`cargo check`조차 실행되지 않았다.** always-on-bottom · click-through · skipTaskbar · 트레이 · 전역 단축키 · autostart · single-instance · 위치 복원 · Win+D · 한글 IME · DPI 실기 · 메모리·시작 시간은 **전부 Windows에서 실행되기 전까지 미검증**이며, 이 README의 결과표에서 "PASS"로 표시된 항목만이 검증된 것이다. 검증하지 않은 항목을 '동작함'으로 주장하지 않는다.

---

## 13. Linux 세션에서 가능한 것 / Windows에서만 가능한 것

| 작업 | Linux 세션(Claude) | Windows PC(사용자 + Claude 지시) | 비고 |
|---|---|---|---|
| 프런트 코드 작성·타입체크·`pnpm build` | ✅ | — | Vite 산출물까지 |
| `src/domain/` vitest 골든 테스트 | ✅ | — | Tauri 비의존 |
| 브라우저 목으로 위젯 렌더, Playwright DPI 100/125/150/175% 스크린샷 | ✅ (렌더만) | ✅ (실기) | Linux 서체는 대체 서체 → 조판 승인은 Windows 스크린샷 후 `[제품문서 근거: G2-3]` |
| `src-tauri` Rust 코드 작성 | ✅ (작성) | ✅ (첫 컴파일·수정) | Linux `cargo check` 불가 — **식별자 오류는 Windows에서 처음 드러난다** |
| `src-tauri/domain` crate `cargo test` | ✅ (Tauri 비의존 crate로 분리한 경우) | ✅ | |
| `capabilities/default.json` 작성·표 대조 grep | ✅ | — | ACL 실효는 Windows |
| `tauri.conf.json` 작성 | ✅ | ✅ (스키마 검증·빌드) | |
| `pnpm tauri build` (NSIS) | ❌ (크로스 빌드 미확인 `[미검증]`) | ✅ | Linux→Windows 크로스 빌드는 NSIS·WebView2 번들 문제로 기본 지원 대상이 아니라고 이해 `[미검증]` — 시도하지 않음 |
| 창 동작 26항목 실기 | ❌ | ✅ | §7 |
| 측정(§8) | ❌ | ✅ | |
| SmartScreen·보안 SW·표준 계정·WebView2 전제 | ❌ | ✅ (대상 PC) | `docs/risk/deployment-prereqs.md` |
| 체크리스트 작성 | ✅ | — | 기입은 Windows |
| 체크리스트 기입·사인오프 | ❌ | ✅ | |
| 리스크 레지스터 상태 갱신(열림→완화/닫힘) | ✅ (문서) | ✅ (근거 제공) | 근거 없이 상태를 바꾸지 않는다 |
| 변형 2 브랜치 준비(의존성·스텁) | ✅ | ✅ (실행·판정) | ADR-0004 |
| Phase 4 게이트 판정 | ❌ | ✅ | ADR-0006 예정 |

---

## 부록 A. 근거 출처 (2026-09-09 확인)

| 사실 | URL | 등급 |
|---|---|---|
| `WindowConfig.always_on_bottom / skip_taskbar / transparent / decorations` | https://docs.rs/tauri-utils/latest/tauri_utils/config/struct.WindowConfig.html | 1차 문서 |
| JS `setAlwaysOnBottom`, `setIgnoreCursorEvents` | https://v2.tauri.app/reference/javascript/api/namespacewindow/ | 1차 문서 |
| `core:window:default`는 read-only, setter는 `allow-set-*` 개별 | https://v2.tauri.app/reference/acl/core-permissions/ | 1차 문서 |
| CSP는 설정해야만 적용 | https://v2.tauri.app/security/csp/ | 1차 문서 |
| `sql:default` = close/load/select, execute 별도 | https://v2.tauri.app/plugin/sql/ | 1차 문서 |
| single-instance 첫 등록 | https://v2.tauri.app/plugin/single-instance/ | 1차 문서 |
| 공식 플러그인 목록·버전, tray-icon 피처 | https://github.com/tauri-apps/plugins-workspace | 1차 문서 |
| `StateFlags` 6개, 모니터 미저장 | https://docs.rs/tauri-plugin-window-state/latest/tauri_plugin_window_state/struct.StateFlags.html | 1차 문서 |
| 화면 밖 복원 사례 | https://github.com/clash-verge-rev/clash-verge-rev/issues/6945 | 1차 문서(사례) |
| 전역 핫키 충돌 Error 변형 | https://docs.rs/global-hotkey/latest/global_hotkey/enum.Error.html | 1차 문서 |
| Win+D 생존에는 WorkerW/pin 필요, explorer 재시작 재부착 | https://github.com/meslzy/tauri-plugin-wallpaper | 1차 문서(플러그인 README) |
| 대안 플러그인 | https://github.com/Charlie-XIAO/tauri-plugin-desktop-underlay | 1차 문서 |
| skipTaskbar 미동작 이슈 | https://github.com/tauri-apps/tauri/issues/10422 | 1차 문서(현재 상태 미확인) |
| decorations/shadow 이슈 | https://github.com/tauri-apps/tauri/issues/14859 | 1차 문서 |
| WebView2 한글 IME 크래시 | https://github.com/MicrosoftEdge/WebView2Feedback/issues/5475 | 1차 문서(재현 조건 미확인) |
| WebView2 성능 문서(수치 없음, 절전 수단) | https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/performance | 1차 문서 |
| Segoe UI에 한글 없음, 한국어 UI 서체 = Malgun Gothic(Regular만 등재) | https://learn.microsoft.com/en-us/windows/apps/design/signature-experiences/typography | 1차 문서 |
| Fluent `fontFamilyBase`에 한글 없음 | https://github.com/microsoft/fluentui/blob/master/packages/tokens/src/global/fonts.ts | 1차 문서 |
| react-icons 명명 규칙·크기별 컷 | https://github.com/microsoft/fluentui-system-icons/blob/main/packages/react-icons/README.md | 1차 문서 |
| NSIS currentUser, webviewInstallMode | https://v2.tauri.app/distribute/windows-installer/ | 1차 문서(원 조사 인용, 검토 시 재확인 안 됨) |
| 코드서명·SmartScreen | https://v2.tauri.app/distribute/sign/windows/ | 1차 문서(동상) |
| updater 서명 필수·엔드포인트 | https://v2.tauri.app/plugin/updater/ | 1차 문서(동상) |
| SQLCipher 미지원 요청 | https://github.com/tauri-apps/plugins-workspace/issues/2528 | 1차 문서(동상) |

확보 실패(null): Rainmeter 공식 문서·포럼(403), tauri#7847 댓글, Fluent 2 CJK 지침(없음), WebView2 수치(없음), Tauri 이슈 #10422 현재 상태(GitHub MCP 접근 거부). 상세는 `docs/review/2026-09-09-spec-skill-review.md`.
