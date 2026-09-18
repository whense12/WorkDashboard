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

---

## G. CI 자동화된 Win32 primitive probe (추가 절)

이 절은 **새로 추가된 행만** 담는다. A~F 의 기존 조건·판정은 하나도 바꾸지 않았다.
B~F 는 전부 `NOT TESTED` 그대로다.

> **지금 이 시점의 판정.**
> 아래 probe 는 `windows-latest` 에서 자동 실행되도록 CI 에 배선했지만,
> **이 컨테이너(headless Ubuntu)에서는 실행되지 않았다.** 따라서 G 절의 Windows 측 판정은
> 현재 전부 `NOT TESTED` 다. CI 가 1회 돌아간 뒤 artifact 의 실측값으로 채운다.
> **배선했다는 사실을 `PASS` 로 올리지 않는다.**

검증 위치:

| 무엇 | 어디 | CI step |
|---|---|---|
| Tauri probe | `tauri/src-tauri/src/win32_probe.rs` + `src/bin/win32-probe.rs` | `Win32 probe (GATE)` — tauri-windows |
| WPF probe | `wpf-probe/` (`Win32Probe.exe`) | `Win32 probe (GATE)` — wpf-windows |
| 매니페스트 리소스 검사 | `scripts/inspect-exe-manifest.ps1` | `RT_MANIFEST 리소스 검사 (GATE)` ×4 |

probe 는 실패 시 exit 1 이고 step 에 `continue-on-error` 가 없으므로 **job 을 실패시킨다.**

---

### G1. Application manifest (embedding)

| # | 항목 | Tauri | WPF | 방식 | 근거 |
|---|---|---|---|---|---|
| G1-1 | 명시적 manifest 파일 존재 | `PASS` | `PASS` | Automated | Tauri: `tauri/src-tauri/windows-app-manifest.xml` 신규, `build.rs` 가 `tauri_build::WindowsAttributes::app_manifest` 로 배선. WPF: 기존 `wpf/app.manifest`. 양쪽 XML well-formed 를 이 컨테이너에서 파싱 확인 |
| G1-2 | `.rc` 에 `1 24 { … }` (RT_MANIFEST) 로 들어간다 | `PASS` | `NOT APPLICABLE` | Automated | Tauri: 생성된 `target/.../out/resource.rc` 에 `1 24` 블록과 manifest 본문이 실제로 들어간 것을 확인. WPF 는 .rc 를 쓰지 않는다(SDK 가 apphost 에 직접 기록) |
| G1-3 | **exe 안의 RT_MANIFEST 리소스를 읽어** 선언을 검사 | `NOT TESTED` | `NOT TESTED` | Automated (CI) | `inspect-exe-manifest.ps1` 이 `FindResource`/`LoadResource`/`LockResource` 로 리소스를 꺼내 검사한다. **이 컨테이너에는 rc.exe 도 Windows 로더도 없어 실행 못 했다** |
| G1-4 | `Microsoft.Windows.Common-Controls` 6.0.0.0 선언 | `NOT TESTED` | `NOT APPLICABLE` | Automated (CI) | Tauri 는 요구 항목에 포함. WPF 프로토타입은 `SetWindowSubclass` 대신 `HwndSource.AddHook` 을 쓰므로 comctl32 v6 를 요구하지 않는다 — **기존 조건을 바꾸지 않기 위해 `wpf/app.manifest` 는 손대지 않았다** (아래 OPEN 참조) |
| G1-5 | `dpiAwareness = PerMonitorV2` + `dpiAware = true/pm` | `NOT TESTED` | `NOT TESTED` | Automated (CI) | 양쪽 exe 모두 CI 에서 리소스 검사 대상 |
| G1-6 | 내장된 manifest 가 well-formed XML | `NOT TESTED` | `NOT TESTED` | Automated (CI) | 파싱 불가 manifest 는 프로세스가 `0xC0000020` 으로 안 뜨게 만든다. smoke test 만으로는 원인을 알 수 없어 별도로 검사한다 |
| G1-7 | probe exe 도 같은 manifest 를 갖는다 | `NOT TESTED` | `NOT TESTED` | Automated (CI) | probe 가 측정하는 activation context 가 앱의 것과 같다는 근거. Tauri 는 `rustc-link-arg-bins` 로 패키지의 모든 bin 에 같은 리소스가 들어간다, WPF probe 는 자기 `app.manifest` 를 갖는다 |

**G1-note.** E 절 "정적으로 확인된 차이" 의 *"Tauri 프로젝트에는 `app.manifest` 가 없다.
`tauri-build` 기본값에 의존한다"* 는 이 작업으로 **더 이상 사실이 아니다.**
원문은 당시 측정 기록이므로 고치지 않고 이 note 로 대체한다.
`tauri-build` 기본 manifest 는 comctl32 v6 만 선언하고 DPI 는 전혀 선언하지 않는다는 점은
이 컨테이너에서 `tauri-build 2.6.3` 소스로 확인했다.

---

### G2. Headless Win32 primitive probe — Tauri / Rust

`tauri/src-tauri/src/win32_probe.rs`. 각 항목은 probe 의 check 이름 그대로다.

| # | check | 결과 | 무엇을 증명하나 |
|---|---|---|---|
| G2-1 | `process.module_handle` | `NOT TESTED` | `GetModuleHandleW` |
| G2-2 | `hwnd.register_class` | `NOT TESTED` | `RegisterClassExW` |
| G2-3 | `hwnd.create_hidden_toplevel` | `NOT TESTED` | 보이지 않는 top-level HWND 생성 (`WS_POPUP`, `WS_VISIBLE` 없음) |
| G2-4 | `subclass.attach` | `NOT TESTED` | `SetWindowSubclass` 성공 |
| G2-5 | `subclass.callback_invoked` | `NOT TESTED` | **콜백이 실제로 불린다** — 전용 `WM_APP+0x51` 을 보내고 카운터가 1 이 되는지 본다 |
| G2-6 | `subclass.callback_repeats` | `NOT TESTED` | 3회 → 카운터 3. 1회성 훅이 아니다 |
| G2-7 | `subclass.remove` | `NOT TESTED` | `RemoveWindowSubclass` 성공 |
| G2-8 | `subclass.remove_stops_callback` | `NOT TESTED` | 제거 후 카운터가 **증가하지 않는다** (훅 누수 검출) |
| G2-9 | `win_shell.attach` | `NOT TESTED` | 프로토타입이 실제로 싣는 `win_shell::attach` 가 같은 HWND 에서 성공 |
| G2-10 | `win_shell.detach` | `NOT TESTED` | 같은 코드의 detach + `is_attached()` 복귀 |
| G2-11 | `exstyle.set_and_read_back` | `NOT TESTED` | `SetWindowLongPtrW(GWL_EXSTYLE)` — 비트가 **없었다는 것까지** 확인한 뒤 set, read back |
| G2-12 | `exstyle.restore` | `NOT TESTED` | 원래 값으로 복원 |
| G2-13 | `zorder.setwindowpos_hwnd_bottom` | `NOT TESTED` | `SetWindowPos(HWND_BOTTOM, SWP_NOACTIVATE)` 호출 성공 |
| G2-14 | `hwnd.get_window_rect` | `NOT TESTED` | `GetWindowRect` |
| G2-15 | `monitor.enumerate` | `NOT TESTED` | `EnumDisplayMonitors` + 모니터 개수 |
| G2-16 | `monitor.get_monitor_info` | `NOT TESTED` | `GetMonitorInfoW` 의 `rcWork` 가 유효 |
| G2-17 | `dpi.get_dpi_for_window` | `NOT TESTED` | `GetDpiForWindow` 가 0 이 아니다 |
| G2-18 | `placement.capture` | `NOT TESTED` | `monitor_placement::capture` 가 실제 geometry 에서 0..1 정규값을 낸다 |
| G2-19 | `placement.resolve_on_monitor` | `NOT TESTED` | `resolve` 가 monitorId 로 같은 모니터를 다시 찾고, 결과가 `rcWork` 안에 완전히 들어간다 |
| G2-20 | `placement.unknown_monitor_falls_back` | `NOT TESTED` | 없는 monitorId → 주 모니터 fallback, 그래도 화면 안 |
| G2-21 | `hwnd.destroy` / `hwnd.unregister_class` | `NOT TESTED` | teardown 누수 없음 |
| G2-22 | `zorder.observed_behind_other_app` | `NOT TESTED` | probe 가 **시도하지 않는다.** 대화형 데스크톱 필요 (B5 · C1~C4) |
| G2-23 | `placement.physical_monitor_hotplug` | `NOT TESTED` | probe 가 **시도하지 않는다.** 물리적 분리 필요 (E8) |

Linux 에서 검증한 것 (실측):

- `cargo check --target x86_64-pc-windows-msvc --all-targets` → exit 0. `#[cfg(windows)]` 본문이
  실제로 타입검사된다는 것을 일부러 깨뜨려 확인했다(고의 오류 → error 2건 → 복구).
- `cargo test --lib` → **13 passed / 0 failed** (기존 6 + probe 산술 7).
- `cargo run --bin win32-probe` (Linux) → `0 PASS, 0 FAIL, 0 NOT TESTED, 24 NOT APPLICABLE`, exit 0.
  Linux 빌드를 깨지 않는다.

---

### G3. Headless Win32 primitive probe — WPF / .NET

`wpf-probe/` (`Win32Probe.exe`). 프로토타입의 **실제** interop 파일
(`wpf/Interop/NativeMethods.cs`, `wpf/Interop/MonitorNativeMethods.cs`,
`wpf/Experimental/MonitorNormalizedPlacementStore.cs`) 을 그대로 컴파일해 넣는다 —
검증 대상이 실제로 싣는 P/Invoke 선언이어야 하므로 복제하지 않았다.
`wpf/` 안의 파일은 **하나도 수정하지 않았다.**

| # | check | 결과 | 무엇을 증명하나 |
|---|---|---|---|
| G3-1 | `process.module_handle` · `hwnd.register_class` · `hwnd.create_hidden_toplevel` | `NOT TESTED` | G2-1~3 과 동일 |
| G3-2 | `subclass.attach` · `callback_invoked` · `callback_repeats` · `remove` · `remove_stops_callback` | `NOT TESTED` | comctl32 subclass 를 WPF 측에서도 도달 가능한지 (G2-4~8 과 동일 기준) |
| G3-3 | `hwndsource.create` | `NOT TESTED` | `HwndSource` 생성 — **프로토타입이 실제로 쓰는 메커니즘** (`MainWindow.xaml.cs`) |
| G3-4 | `hwndsource.hook_invoked` | `NOT TESTED` | `HwndSource.AddHook` 콜백이 **실제로 불린다** (카운터) |
| G3-5 | `hwndsource.hook_removed` | `NOT TESTED` | `RemoveHook` 후 카운터 정지 |
| G3-6 | `exstyle.set_and_read_back` · `exstyle.restore` | `NOT TESTED` | 프로토타입의 `NativeMethods.AddExStyle`/`HasExStyle`/`RemoveExStyle` 경유 |
| G3-7 | `exstyle.setwindowlongptr_roundtrip` | `NOT TESTED` | `SetWindowLongPtrW`/`GetWindowLongPtrW` 직접 호출 roundtrip |
| G3-8 | `zorder.setwindowpos_hwnd_bottom` | `NOT TESTED` | 프로토타입의 `NativeMethods.SetWindowPos(HWND_BOTTOM)` |
| G3-9 | `hotkey.register` / `hotkey.unregister` | `NOT TESTED` | `RegisterHotKey`/`UnregisterHotKey` 도달 가능성. **제품 조합(`Ctrl+Alt+D`)이 아니라** 충돌 가능성이 가장 낮은 `Ctrl+Alt+Shift+Win+F24` 로 API 자체만 본다 |
| G3-10 | `hwnd.get_window_rect` | `NOT TESTED` | 프로토타입의 `MonitorNativeMethods.GetWindowRect` |
| G3-11 | `placement.canonical_json_matches_rust_golden` | `NOT TESTED` | **C# 쪽 byte 계약이 처음으로 실행된다.** `MonitorNormalizedPlacementStore.Serialize` 출력이 `monitor_placement.rs::canonical_json_is_byte_stable` 의 golden bytes 와 byte 단위로 같은지 |
| G3-12 | `placement.float_rendering_matches_rust` | `NOT TESTED` | `0.0 / 1.0 / 0.5 / 0.7333 / 9e-6 / 0.00001` 이 serde_json(ryu) 과 같게 찍히는지 |
| G3-13 | `monitor.enumerate` · `monitor.get_monitor_info` | `NOT TESTED` | G2-15~16 과 동일 |
| G3-14 | `monitor.find_by_device_name` | `NOT TESTED` | `FindMonitorByDeviceName(szDevice)` 가 `MonitorFromWindow` 와 같은 HMONITOR 를 돌려준다. 깨져 있으면 모든 restore 가 조용히 주 모니터로 떨어진다 |
| G3-15 | `dpi.get_dpi_for_window` · `dpi.get_dpi_for_monitor` | `NOT TESTED` | `GetDpiForWindow`, shcore `GetDpiForMonitor` |
| G3-16 | `placement.capture` · `placement.resolve_on_monitor` · `placement.unknown_monitor_falls_back` | `NOT TESTED` | G2-18~20 과 동일 산술 (물리 픽셀 구간만. DIP 변환은 WPF `Window` 가 필요해 probe 밖) |
| G3-17 | `hwnd.destroy` / `hwnd.unregister_class` | `NOT TESTED` | teardown |
| G3-18 | `zorder.observed_behind_other_app` · `hotkey.actually_fires` · `placement.physical_monitor_hotplug` | `NOT TESTED` | probe 가 **시도하지 않는다.** 대화형 데스크톱 · 실제 키 입력 · 물리적 분리 필요 |

Linux 에서 검증한 것 (실측):

- `dotnet build -c Release` → `Build succeeded. 0 Warning(s) 0 Error(s)`.
- `dotnet build -c Release -r win-x64 --self-contained false` →
  `Win32Probe.exe` = `PE32+ executable (console) x86-64, for MS Windows, 6 sections`,
  바이트 스캔으로 `Microsoft.Windows.Common-Controls` · `6.0.0.0` · `PerMonitorV2` ·
  `true/pm` · `asInvoker` 확인.
- **실행은 못 했다.** net8.0-windows / WPF 런타임이 Linux 에 없다 → `NOT TESTED`.
- `wpf/` 프로토타입 재빌드 (`rm -rf bin obj` 후) → `Build succeeded`, `ShellSpike.exe` 정상 산출.
  probe 를 별도 디렉터리에 둔 덕에 프로토타입 빌드가 영향받지 않는다는 것을 확인.

---

### G4. CI 배선

| # | 항목 | 결과 | 근거 |
|---|---|---|---|
| G4-1 | windows-latest 에서 Tauri build · WPF build | `NOT TESTED` | 배선만 확인: 기존 두 job 유지 |
| G4-2 | Tauri tests (`cargo test --lib`) | `NOT TESTED` | 배선만 확인: 기존 step. (별개로 Linux 에서 `cargo test --lib` 13 passed — 이것은 G4 가 아니라 G1 의 근거다) |
| G4-3 | Tauri/Win32 probe step (GATE) | `NOT TESTED` | 배선만 확인: `continue-on-error` 없음 → 실패 시 job 실패 |
| G4-4 | WPF/Win32 probe build + step (GATE) | `NOT TESTED` | 배선만 확인: 동일 |
| G4-5 | RT_MANIFEST 리소스 검사 step ×4 (GATE) | `NOT TESTED` | 배선만 확인: 앱 exe 2개 + probe exe 2개 |
| G4-6 | artifact 업로드 | `NOT TESTED` | 배선만 확인: probe report · manifest report · 양쪽 exe 추가 |
| G4-7 | 대화형 데스크톱 항목이 PASS 로 올라가지 않는다 | `NOT TESTED` | 배선만 확인: smoke / `repeat-stability.ps1` 은 `continue-on-error` 유지, probe 는 해당 항목을 `NOT TESTED` 로만 출력한다 |

**G4 는 전부 `NOT TESTED` 다.** 이 workflow 는 아직 한 번도 돌지 않았다 — 초록이었던 job 도,
빨간 job 도 없다. 정적으로 확인한 것은 "배선이 그렇게 돼 있다" 까지이고, 그것은
`PASS` 가 아니다. 근거 column 의 "배선만 확인" 은 아래 항목들을 뜻한다:

- `windows-shell-spike.yml` → PyYAML `safe_load` 파싱 성공, job/step 구조 출력 확인.
- workflow 의 `run:` 블록 **20개 전부** 를 추출해 PowerShell 7.4 파서로 파싱 → 0 failures.
- `scripts/*.ps1` 6개 전부 파싱 → 0 failures.
- YAML block scalar 안에 PowerShell here-string 을 넣지 않았다. C# 인터롭은 `.ps1` 파일로
  분리했고, 여러 줄 텍스트는 전부 배열 + `Set-Content` 다.

`inspect-exe-manifest.ps1` 에 대해 Linux 에서 **실제로 실행한** 것과 못 한 것:

- 실행함 → `PASS`: C# `Add-Type` 블록이 컴파일된다.
- 실행함 → `PASS`: 매니페스트를 못 읽는 경로. 방금 빌드한 `Win32Probe.exe` 를 상대로
  스크립트를 그대로 돌리면 `RESULT: FAIL - no RT_MANIFEST resource could be read from this
  executable.` 에서 `exit 1` 한다. Linux 에 `LoadLibraryExW`/`FindResourceW` 가 없으니
  Linux 에서 실제 exe 를 넣어 도달할 수 있는 경로는 **이것 하나뿐이다.**
- **이전 판의 오기 정정.** 그 실행에서는 `## required declarations` 매칭 표가 찍히지
  않는다. 표는 위 `exit 1` **뒤** 에 있어서 그 경로에서는 도달 자체가 불가능하다.
  이전 판이 "요구 항목 매칭 표 · 실패 시 exit 1 경로가 Linux 에서 실제로 동작" 이라고
  쓴 것은 **틀렸다.** exit 1 경로만 동작했다.
- 그래서 `scripts/selftest-inspect-exe-manifest.ps1` 을 추가했고, 이것으로 매칭 표 쪽을
  실제로 실행했다 → `PASS` (26/26 checks). 이 self-test 는 스크립트를 고치지 않는다:
  `inspect-exe-manifest.ps1` 이 이미 자기 `Add-Type` 을
  `if (-not ('SpikeA.ManifestReader' -as [type]))` 로 감싸고 있어서, 같은 이름의 stub 타입을
  먼저 등록해 두면 나머지 스크립트가 **원문 그대로** 실행된다. 확인한 것:
  요구 항목 매칭 표 렌더링, 리소스 hit / raw-byte miss 구분, well-formed XML 검사,
  `RESULT: PASS` 와 `RESULT: FAIL` 각각의 exit code, `::error::` 주석, `-OutFile` 보고서.
  self-test 가 실제로 회귀를 잡는지도 확인했다 — XML 검사 한 줄을 지우면 26 중 2개가
  FAIL 로 뒤집히고 self-test 가 `exit 1` 한다 (변이 후 원상복구).
- **실행 못 함 → `NOT TESTED`:** Win32 인터롭 본체. 실제 PE 파일에서 RT_MANIFEST 를
  꺼내오는 것이 정말 되는지는 Windows CI job 이 돌기 전까지 모른다. self-test 의 `PASS` 는
  보고/매칭 로직에 대한 것이지, **어떤 exe 에도 매니페스트가 박혀 있다는 증거가 아니다.**

---

### G5. OPEN (구현하지 않음 — 사람이 결정할 것)

1. `wpf/app.manifest` 에 `Microsoft.Windows.Common-Controls` 6.0.0.0 을 넣을지.
   WPF 프로토타입은 `HwndSource.AddHook` 을 쓰므로 **지금은 필요하지 않다.** 다만 A~F 표가
   두 플랫폼을 나란히 비교하므로 manifest 선언을 맞출지는 판단이 필요하다.
   Task A1 이 Tauri 만 지정했고 기존 조건을 바꾸지 않기 위해 **건드리지 않았다.**
2. G 절의 probe 행을 A~F 의 어느 행으로 편입할지(예: G2-4~8 을 B5 의 근거로 승격할지).
   probe 는 **primitive 도달 가능성**만 보고, B5 가 요구하는 *동작*은 보지 않는다.
   승격은 제품/측정 판단이므로 orchestrator 가 정한다.
3. `hotkey.register` 가 러너에서 실패할 경우 이를 FAIL 로 둘지 `NOT TESTED` 로 내릴지.
   현재는 GATE 다 — API 도달 불가는 실제 위험이라고 보았다.

---

## 부록 추가 — 이번에 들어온 코드

| 코드 | 무엇 | 현재 상태 |
|---|---|---|
| `tauri/src-tauri/windows-app-manifest.xml` | 명시적 Windows application manifest (comctl32 v6 · PerMonitorV2 · `true/pm` · supportedOS · asInvoker) | 파일·`.rc` 배선은 확인, **exe embedding 은 `NOT TESTED`** (CI 가 확인) |
| `tauri/src-tauri/build.rs` | `WindowsAttributes::app_manifest` 로 위 파일을 리소스에 배선 | 동일 |
| `tauri/src-tauri/src/win32_probe.rs` | headless Win32 primitive probe (lib 모듈 + 순수 산술 unit test) | Linux: 타입검사 · 13 tests PASS. Windows 실행: `NOT TESTED` |
| `tauri/src-tauri/src/bin/win32-probe.rs` | 위 probe 의 CI 진입점 (console bin, 앱과 같은 RT_MANIFEST) | 동일 |
| `wpf-probe/**` | WPF 측 probe (`Win32Probe.exe`) + 자기 `app.manifest` | Linux: build PASS · exe 산출 확인. 실행: `NOT TESTED` |
| `scripts/inspect-exe-manifest.ps1` | exe 의 RT_MANIFEST 리소스를 읽어 선언 검사 | 파서 · `Add-Type` · 매니페스트를 못 읽는 `exit 1` 경로 실행 확인. 보고/매칭 로직은 self-test 로 실행 확인. **Win32 인터롭 실행: `NOT TESTED`** |
| `scripts/selftest-inspect-exe-manifest.ps1` | 위 스크립트의 보고·매칭·exit code 절반을 host 무관하게 실행하는 self-test (stub 타입 주입, 스크립트 원문 무수정) | Linux 에서 실행 → 26/26 `PASS`. 변이 주입으로 회귀 탐지력도 확인 |

**B~F 의 판정은 이번에도 하나도 바뀌지 않았다. 전부 `NOT TESTED` 그대로다.**
