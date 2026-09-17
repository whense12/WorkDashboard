# Acceptance Matrix — Spike A (Windows desktop shell)

결과 어휘는 넷뿐이다. **`PASS` / `FAIL` / `NOT TESTED` / `NOT APPLICABLE`**
검증 방식은 셋으로 구분한다. **`Automated` / `Manual` / `Not tested`**

> **이 Spike 의 결정적 제약.**
> 실행 환경은 Windows 가 아니라 headless Ubuntu 24.04 컨테이너다(`results/ENVIRONMENT.md`).
> 디스플레이 서버가 없어 **두 프로토타입 중 어느 것도 실행되지 않았다.**
> 따라서 B~F 구간은 거의 전부 `NOT TESTED` 다. 이것은 구현 실패가 아니라 측정 불가다.
> **미검증을 `PASS` 로 올리지 않는다.**

---

## A. Build

| # | 항목 | Tauri | WPF | 방식 | 근거 |
|---|---|---|---|---|---|
| A1 | clean build | `PASS` (타입검사) | `PASS` | Automated | Tauri: `cargo check --target x86_64-pc-windows-msvc`, `Finished dev` exit 0, 소스 touch 후 강제 재검사. WPF: `rm -rf bin obj && dotnet build -c Release` → `Build succeeded. 0 Error(s)` |
| A2 | production / release build | `FAIL` | `PASS` | Automated | A3 참조 |
| A3 | 실행파일 생성 | `FAIL` | `PASS` | Automated | WPF: `dotnet build -c Release -r win-x64 --self-contained false` → `ShellSpike.exe` = `PE32+ executable (GUI) x86-64, for MS Windows, 6 sections`, 매니페스트에 `PerMonitorV2` 내장. Tauri: 아래 A3-note |
| A4 | 재빌드 가능 | `PASS` | `PASS` | Automated | 양쪽 모두 clean 삭제 후 재빌드 반복 성공 |
| A5 | Windows 실기에서의 빌드 | `NOT TESTED` | `NOT TESTED` | Not tested | Windows 기계가 없다. 위 결과는 전부 **Linux 크로스 빌드** 결과다 |

**A3-note (Tauri).** 이 기계에 MSVC 링커가 없다 — `link.exe` 없음, `x86_64-w64-mingw32-gcc` 없음
(`lld-link` 만 존재). Windows SDK import library 도 없다.
`cargo check` 는 링크를 하지 않으므로 통과하지만, 실제 `cargo build --target x86_64-pc-windows-msvc`
결과는 `results/TAURI_WINDOWS_BUILD.md` 에 실측값으로 기록했다.

**중요.** A1~A4 의 `PASS` 는 **컴파일/링크 단계만** 의미한다. 어느 산출물도 실행되지 않았다.

---

## B. Basic Window Behavior

전 항목 `NOT TESTED`. 코드는 작성돼 컴파일되지만, 창을 띄운 적이 없다.
"구현" 열은 *코드가 존재하고 컴파일된다*는 뜻이며 동작 보증이 아니다.

| # | 항목 | 결과 | Tauri 구현 | WPF 구현 |
|---|---|---|---|---|
| B1 | frameless | `NOT TESTED` | `decorations:false` (tauri.conf.json) | `WindowStyle=None`, `ResizeMode=NoResize` |
| B2 | transparent / background | `NOT TESTED` | `transparent:true`, surface `rgba(30,30,30,.85)` | `AllowsTransparency=True`, alpha 배경 |
| B3 | taskbar 정책 | `NOT TESTED` | `skipTaskbar:true` + `WS_EX_TOOLWINDOW`, `WS_EX_APPWINDOW` 제거 | `ShowInTaskbar=False` + `WS_EX_TOOLWINDOW` |
| B4 | Alt+Tab / switcher 정책 | `NOT TESTED` | `WS_EX_TOOLWINDOW` 무조건 적용 — 세 상태 모두 switcher 비노출 | 동일 |
| B5 | bottom-Z behavior | `NOT TESTED` | `set_always_on_bottom(true)` + `SetWindowPos(HWND_BOTTOM,…)` + **`WM_WINDOWPOSCHANGING` 서브클래스로 매 재배치마다 재강제** + `WM_ACTIVATE` 복구 (win_shell.rs) | 동일 호출 + `WM_WINDOWPOSCHANGING` 훅으로 매 재배치마다 재강제 + `WM_ACTIVATE` 복구 |
| B6 | ACTIVE / PASSIVE 전환 | `NOT TESTED` | `WS_EX_NOACTIVATE` 토글, 진입 시 `HWND_TOP`, **`WM_MOUSEACTIVATE` → `MA_NOACTIVATE`** (win_shell.rs) | 동일 + `WM_MOUSEACTIVATE` → `MA_NOACTIVATE` |
| B7 | click-through on/off | `NOT TESTED` | `set_ignore_cursor_events` + `WS_EX_TRANSPARENT`, PASSIVE 에서만 | `WS_EX_TRANSPARENT`, PASSIVE 에서만 |
| B8 | global shortcut activation | `NOT TESTED` | `tauri-plugin-global-shortcut` | `RegisterHotKey` + `WM_HOTKEY` 훅 |
| B9 | Layout Edit drag | `NOT TESTED` | `data-tauri-drag-region`, LAYOUT EDIT 에서만 | `DragMove()`, LAYOUT EDIT 에서만 |
| B10 | 위치 저장 | `NOT TESTED` | `window-position.json` (물리 픽셀), LAYOUT EDIT 이탈 + 종료 시 | `window.json` (DIP), 동일 두 시점 + `WM_DISPLAYCHANGE` |
| B11 | 재시작 후 위치 복원 | `NOT TESTED` | 복원 시 가상화면 48×48 겹침 검증 | 동일 |
| B12 | startup 등록 | `NOT TESTED` | `tauri-plugin-autostart` (HKCU Run), IPC 로 호출 가능 | `StartupRegistration.cs` (HKCU Run) — **호출부 없음** |

공통 단축키: `Ctrl+Alt+D` = ACTIVE/PASSIVE, `Ctrl+Alt+L` = LAYOUT EDIT, `Ctrl+Alt+T` = click-through.

---

## C. Windows 앱과 동시 사용

전 항목 `NOT TESTED`. 대상 앱이 이 기계에 하나도 설치돼 있지 않고, 애초에 창을 띄울 수 없다.

| # | 대상 | 방해 여부 | focus 탈취 | Z-order |
|---|---|---|---|---|
| C1 | Explorer | `NOT TESTED` | `NOT TESTED` | `NOT TESTED` |
| C2 | Chrome / Edge | `NOT TESTED` | `NOT TESTED` | `NOT TESTED` |
| C3 | Excel | `NOT TESTED` | `NOT TESTED` | `NOT TESTED` |
| C4 | 한글 (HWP) | `NOT TESTED` | `NOT TESTED` | `NOT TESTED` |

### 수동 검증 절차 (Windows 기계에서 수행)

각 앱마다:
1. 앱을 최대화하고 위젯이 가려지는지 본다 → PASSIVE 에서 위젯이 앱 **뒤**에 있어야 한다.
2. 앱에 타이핑하는 중 위젯을 클릭한다 → 캐럿이 앱에 남아 있어야 한다(focus 미탈취).
3. click-through 를 켜고 위젯 위를 클릭한다 → 클릭이 **뒤의 앱**에 전달돼야 한다.
4. `Ctrl+Alt+D` 로 ACTIVE 전환 후 위젯 토글을 클릭한다 → 반응해야 한다.
5. 앱을 최소화/복원하고 위젯 Z-order 가 유지되는지 본다.
6. 각 단계의 화면을 캡처해 `results/` 에 남긴다.

---

## D. Windows Shell Events

전 항목 `NOT TESTED`. Windows 셸이 없다.

| # | 이벤트 | 결과 | 기대 동작 |
|---|---|---|---|
| D1 | Win+D / 바탕화면 보기 | `NOT TESTED` | 위젯이 함께 최소화되지 않거나, 복귀 시 자동 재표시 |
| D2 | Explorer 재시작 | `NOT TESTED` | 위젯 생존, Z-order 재확립 |
| D3 | 잠금 → 해제 | `NOT TESTED` | 위치·상태 유지 |
| D4 | 절전 → 복귀 | `NOT TESTED` | 위치·상태 유지, 렌더 정상 |
| D5 | 앱 재시작 | `NOT TESTED` | 저장된 위치로 복원 |
| D6 | Windows 로그인/startup | `NOT TESTED` | autostart 등록 시 자동 기동 |

### 수동 검증 절차

1. 위젯 기동 → PASSIVE 확인 → `Win+D` → 바탕화면 노출 후 위젯 상태 기록.
2. 작업관리자에서 `explorer.exe` 종료 후 재시작 → 위젯 생존/Z-order 기록.
3. `Win+L` 잠금 → 해제 → 위치 좌표 비교.
4. 절전 진입 → 복귀 → 위치 좌표·렌더 상태 비교.
5. 앱 종료 → 재기동 → `window.json` / `window-position.json` 의 좌표와 실제 복원 위치 대조.
6. autostart 등록 후 로그오프 → 로그인 → 자동 기동 여부 기록.

D1~D4 는 자동화 불가로 판단한다. 수동 검증 + 화면 캡처로만 남긴다.

---

## E. Multi-monitor / DPI

전 항목 `NOT TESTED`. 모니터가 없다.

| # | 조합 | Tauri | WPF |
|---|---|---|---|
| E1 | 100% | `NOT TESTED` | `NOT TESTED` |
| E2 | 125% | `NOT TESTED` | `NOT TESTED` |
| E3 | 150% | `NOT TESTED` | `NOT TESTED` |
| E4 | 175% | `NOT TESTED` | `NOT TESTED` |
| E5 | single monitor | `NOT TESTED` | `NOT TESTED` |
| E6 | dual monitor | `NOT TESTED` | `NOT TESTED` |
| E7 | 서로 다른 DPI 조합 | `NOT TESTED` | `NOT TESTED` |
| E8 | 외부 모니터 분리/재연결 | `NOT TESTED` | `NOT TESTED` |
| E9 | off-screen 위치 복구 | `NOT TESTED` | `NOT TESTED` |

**정적으로 확인된 차이 (실행 아님, 코드/매니페스트 수준):**

- WPF 는 `app.manifest` 에 `PerMonitorV2` 를 명시하며, 생성된 `.exe` 안에 실제로 내장된 것을 확인했다.
- Tauri 프로젝트에는 `app.manifest` 가 없다. `tauri-build` 기본값에 의존한다.
- 좌표 단위가 다르다 — WPF 는 `Window.Left/Top`(DIP, 주 모니터 배율 기준),
  Tauri 는 `outer_position()`(물리 픽셀). **두 위치 파일은 서로 호환되지 않으며 DPI 변경 시 거동이 다르다.**
- 기본 배치의 작업영역 조회가 양쪽 모두 **주 모니터 기준**이다(`SPI_GETWORKAREA`). 다중 모니터 인식 없음.

### 수동 검증 절차

각 배율(100/125/150/175%)에서: 위젯 기동 → 텍스트 잘림·번짐 확인 → 캡처.
듀얼 모니터에서: 위젯을 보조 모니터로 옮기고 LAYOUT EDIT 종료 → 재시작 → 복원 좌표 대조.
E8: LAYOUT EDIT 로 보조 모니터에 배치 → 종료 → 모니터 분리 → 재기동 → 화면 안으로 복구되는지 확인
(양쪽 모두 48×48 겹침 검증 코드가 있으나 **검증되지 않았다**).

---

## F. Reliability

전 항목 `NOT TESTED`. 프로세스를 띄운 적이 없어 CPU·메모리 표본이 0개다.

| # | 항목 | Tauri | WPF |
|---|---|---|---|
| F1 | idle CPU | `NOT TESTED` | `NOT TESTED` |
| F2 | idle memory | `NOT TESTED` | `NOT TESTED` |
| F3 | ACTIVE/PASSIVE 100회 토글 | `NOT TESTED` | `NOT TESTED` |
| F4 | click-through 100회 토글 | `NOT TESTED` | `NOT TESTED` |
| F5 | global shortcut 100회 | `NOT TESTED` | `NOT TESTED` |
| F6 | 위치 save/restore 반복 | `NOT TESTED` | `NOT TESTED` |
| F7 | renderer / window crash | `NOT TESTED` | `NOT TESTED` |
| F8 | console / runtime error | `NOT TESTED` | `NOT TESTED` |

### 수동·반자동 검증 절차

- F1/F2: 10분 idle 후 작업관리자 또는 `Get-Process` 로 CPU%·Private Bytes 기록.
  Tauri 는 프로세스가 여럿(주 프로세스 + WebView2)이므로 **합산**해 비교한다.
- F3~F5: 단축키를 100회 반복 입력하는 스크립트(AutoHotkey 또는 `SendKeys`)로 반자동화 가능.
  매 20회마다 메모리를 기록해 단조 증가 여부를 본다.
- F6: LAYOUT EDIT 진입/이탈을 반복하고 위치 파일의 좌표가 드리프트하는지 본다.
- F8: Tauri 는 WebView2 DevTools 콘솔, WPF 는 디버그 출력에서 확인.

---

## 자동화 가능성 요약

| 구간 | Automated | Manual | 자동화 불가 판단 |
|---|---|---|---|
| A. Build | 전부 (`cargo check`, `dotnet build`) | — | — |
| B. Window | — | 전부 | Z-order·focus·click-through 는 실제 셸 없이는 관측 불가 |
| C. 앱 동시 사용 | — | 전부 | 대상 앱 설치 + 사람의 관찰 필요 |
| D. Shell events | — | 전부 | Win+D·잠금·절전은 CI 러너에서 재현 불가 |
| E. Monitor/DPI | 일부 가능(배율 변경 스크립트) | 대부분 | 물리적 모니터 분리/재연결은 수동 |
| F. Reliability | F3~F6 반자동 | F1·F2·F7·F8 | — |

**억지로 unit test 로 바꿔 PASS 를 만들지 않았다.** B~F 는 전부 `NOT TESTED` 로 남긴다.


---

## 부록 — 매트릭스에 아직 행이 없는 코드

아래는 이후 추가된 코드이고, **기존 조건을 바꾸지 않기 위해** 새 행을 만들지 않았다.
Windows 실측 때 어느 행으로 편입할지는 orchestrator 가 정한다.

| 코드 | 무엇 | 현재 상태 |
|---|---|---|
| `tauri/src-tauri/src/win_shell.rs` | Win32 서브클래스 — `WM_WINDOWPOSCHANGING` · `WM_MOUSEACTIVATE` · `WM_ACTIVATE` · `WM_DISPLAYCHANGE` | `NOT TESTED` (B5·B6 서술에 반영, 별도 행 없음) |
| `tauri/src-tauri/src/monitor_placement.rs` | 모니터 정규화 배치 **실험** | `NOT TESTED` · 실험이며 production contract 아님 |
| `wpf/Experimental/**` | 같은 실험의 WPF 측 | `NOT TESTED` · 동일 |
| `scripts/*.ps1` | 환경 수집 · 자원 측정 · 반복 안정성 · 스크린샷 | Windows 에서 실행된 적 없음 |

B~F 의 판정은 하나도 바뀌지 않았다. 전부 `NOT TESTED` 그대로다.
