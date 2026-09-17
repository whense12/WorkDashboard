# Spike A — Tauri vs WPF 비교 결과

> **읽기 전 경고.** 이 Spike 는 headless Ubuntu 컨테이너에서 수행됐다. Windows 가 아니다.
> **두 프로토타입 중 어느 것도 실행되지 않았다.** 창 동작·focus·Z-order·DPI·성능은 **한 건도 관측되지 않았다.**
> 아래 "Verified" 는 전부 **빌드와 소스 수준**의 검증이다. 동작 검증이 아니다.
> 이 문서는 플랫폼을 선택하기에 **충분하지 않다.**

---

## Tauri

### Verified strengths

실제로 검증된 것만.

- `cargo check --target x86_64-pc-windows-msvc` 가 exit 0 으로 통과한다. `#[cfg(windows)]` 안의
  Win32 코드(`SetWindowPos`, `GetWindowLongPtrW`, `SetWindowLongPtrW`, `SystemParametersInfoW`,
  `GetSystemMetrics`)가 `windows` 0.61 시그니처에 대해 **타입 검사를 통과**한다.
  음성 대조로 확인했다 — Win32 모듈에 의도적 오류를 주입하니 `error[E0433]` 이 났고, 되돌렸다.
- 요구된 11개 shell 기능 전부에 대응 코드가 존재하고 컴파일된다.
- 외부 런타임 의존 없이 `tauri-plugin-global-shortcut`, `tauri-plugin-autostart` 로
  단축키·자동시작 경로를 확보했다.
- 프로토타입 본체 규모: `lib.rs` 621행 + `index.html` 158행.

### Verified failures

실제로 실패한 것만.

- **Linux 에서 Windows 실행파일을 만들지 못한다.** 모든 crate 컴파일에 성공한 뒤
  `error: linker 'link.exe' not found` 로 링크 실패. `.exe` 산출 0개.
  전체 기록: `results/TAURI_WINDOWS_BUILD.md`
- **(해소됨 — 아래 '2차 개정' 참조)** 이전 개정에서는 PASSIVE 의 bottom-Z 가 1회성 배치에
  그쳤다. 사용자 승인으로 Win32 서브클래스를 추가해 `WM_WINDOWPOSCHANGING` 을 가로채게 했다.
- **WebView2 자식 HWND 의 focus 는 여전히 미해결.** `WS_EX_NOACTIVATE` 는 top-level HWND 에만
  적용되고, WebView2 는 자체 자식 HWND 계층을 갖는다. 서브클래스가 `WM_MOUSEACTIVATE` 를
  `MA_NOACTIVATE` 로 답하지만, 자식 HWND 가 별도로 포커스를 요구하는 경로는 덮지 못한다.
  **NOT TESTED** — 실기에서만 확인 가능하다.

### Unknown

- Windows 실기에서의 빌드 성공 여부 (Visual C++ Build Tools 환경 미시험)
- B~F 전 항목 — 창 동작, 앱 동시 사용, 셸 이벤트, 다중 모니터/DPI, CPU·메모리
- WebView2 런타임 배포 부담
- `skipTaskbar` + `WS_EX_TOOLWINDOW` 의 실제 switcher 거동

---

## WPF

### Verified strengths

- **Linux 에서 진짜 Windows 실행파일이 나온다.**
  `dotnet build -c Release -r win-x64 --self-contained false` →
  `PE32+ executable (GUI) x86-64, for MS Windows, 6 sections`.
  `PerMonitorV2` DPI 매니페스트가 `.exe` 안에 실제로 내장된 것을 바이트 수준에서 확인했다.
- `dotnet build -c Release` 가 clean 상태에서 **0 warning / 0 error**, 약 1.2초.
- **NuGet 의존성 0개.** WPF·`System.Text.Json`·`Microsoft.Win32.Registry` 가 전부
  `net8.0-windows` 타깃 프레임워크에 포함돼 고정할 외부 패키지가 없다.
- `HwndSource.AddHook` 으로 임의의 Win32 메시지를 받을 수 있어,
  `WM_WINDOWPOSCHANGING`(bottom-Z 상시 재강제), `WM_MOUSEACTIVATE`(`MA_NOACTIVATE`),
  `WM_ACTIVATE`(활성화 복구), `WM_DISPLAYCHANGE`(배치 재검증) 를 **코드로 처리한다**.
- 프로토타입 본체 규모: 937행 / 10파일. P/Invoke 7건, 처리 메시지 5종.

### Verified failures

- 없음. 이 환경에서 시도한 모든 빌드가 성공했다.
  (동작 실패가 없다는 뜻이 **아니다** — 동작은 시험되지 않았다.)

### Unknown

- B~F 전 항목 — Tauri 와 동일하게 한 건도 관측되지 않았다
- `AllowsTransparency=True` 가 강제하는 소프트웨어 렌더링의 실제 성능 비용
- 포그라운드 잠금 하에서 `Activate()` 가 실제로 포커스를 얻는지
- .NET 8 데스크톱 런타임 배포 부담

---

## Direct comparison

| 항목 | Tauri | WPF |
|---|---|---|
| build | `PASS` (타입검사만, Windows 타깃) | `PASS` (clean Release, 0 error) |
| **Windows .exe 산출 (Linux 에서)** | **`FAIL` — `link.exe` 없음** | **`PASS` — PE32+ GUI 확인** |
| bottom-Z | `NOT TESTED` · 코드는 **서브클래스로 상시 재강제** (2차 개정) | `NOT TESTED` · 코드는 **메시지 훅으로 상시 재강제** |
| click-through | `NOT TESTED` · `set_ignore_cursor_events` + `WS_EX_TRANSPARENT` | `NOT TESTED` · `WS_EX_TRANSPARENT` |
| focus behavior | `NOT TESTED` · `WS_EX_NOACTIVATE` + `MA_NOACTIVATE` + `WM_ACTIVATE` 복구 (2차 개정). **WebView2 자식 HWND 는 여전히 미포함** | `NOT TESTED` · `WS_EX_NOACTIVATE` + `MA_NOACTIVATE` + `WM_ACTIVATE` 복구 |
| taskbar / Alt+Tab | `NOT TESTED` · `skipTaskbar` + `WS_EX_TOOLWINDOW` | `NOT TESTED` · `ShowInTaskbar=False` + `WS_EX_TOOLWINDOW` |
| restart persistence | `NOT TESTED` · 물리 픽셀, 48×48 검증 | `NOT TESTED` · DIP, 48×48 검증 + `WM_DISPLAYCHANGE` 재검증 |
| multi-monitor | `NOT TESTED` · 기본 배치는 주 모니터 작업영역 | `NOT TESTED` · 동일 |
| DPI | `NOT TESTED` · **매니페스트 없음**, `tauri-build` 기본값 의존 | `NOT TESTED` · `PerMonitorV2` 매니페스트 **내장 확인** |
| CPU / RAM | `NOT TESTED` · 표본 0 | `NOT TESTED` · 표본 0 |
| implementation complexity | 621행 Rust + 158행 HTML. 외부 crate 다수(tauri, wry, tao, windows 0.61, 플러그인 2종) | 937행 / 10파일. **NuGet 의존성 0**. P/Invoke 7건, 메시지 5종 |

---

## 이 표에서 읽어도 되는 것 / 읽으면 안 되는 것

**읽어도 되는 것 (측정됨)**
1. Linux CI 에서 Windows 산출물을 만들 수 있는 쪽은 **WPF 뿐**이다.
2. Windows 메시지 루프에 접근해야 하는 shell 동작(상시 bottom-Z, 클릭 시 활성화 거부,
   활성화 복구, 디스플레이 변경 대응)은 **WPF 에서는 프레임워크가 그대로 제공**하고
   (`HwndSource.AddHook`), **Tauri 에서는 Win32 서브클래스를 직접 붙여야 한다.**
   2차 개정에서 실제로 붙였고(`win_shell.rs`), 기능 격차는 코드 수준에서 닫혔다.
   남는 것은 **비용의 차이**다 — 아래 interop 부담 항목.
3. WPF 는 외부 패키지 의존이 0이고, Tauri 는 상당한 crate 그래프를 끌어온다.

**읽으면 안 되는 것 (미측정)**
- 어느 쪽이 실제로 더 안정적인지 — 실행 표본이 0이다.
- 어느 쪽이 더 가볍고 빠른지 — CPU·메모리 측정이 0건이다.
- PASSIVE 위젯이 실제로 다른 앱을 방해하지 않는지 — 관측되지 않았다.
- "native 라서 더 안정적" / "현대적이라서 더 낫다" 류의 결론 — 근거가 없다.

**최종 플랫폼은 이 문서로 확정하지 않는다.**
확정하려면 Windows 기계에서 `acceptance.md` 의 B~F 를 실제로 수행해야 한다.


---

## 2차 개정 — Win32 interop 허용 이후 (2026-09-17)

사용자 승인으로 Tauri 측에 Windows 전용 Win32 서브클래스 계층을 추가했다.
목적은 "Tauri 순정 vs WPF 순정" 이 아니라 **각 플랫폼에서 현실적으로 쓸 아키텍처** 를 맞대는 것이다.

추가된 것 — `tauri/src-tauri/src/win_shell.rs`, `monitor_placement.rs`
`SetWindowSubclass` 로 `WM_WINDOWPOSCHANGING` · `WM_MOUSEACTIVATE` · `WM_ACTIVATE` ·
`WM_DISPLAYCHANGE` 를 처리한다. 공개 `WebviewWindow::hwnd()` 만 쓰고 Tauri 내부 API 에
의존하지 않는다(독립 검증됨). UI 코드와 분리된 `#[cfg(windows)]` 모듈이다.

### Native interop burden (독립 계수)

| | Tauri | WPF |
|---|---|---|
| 서로 다른 raw Win32 진입점 | **15** (이번에 10 신규) | **13** |
| unsafe block / DllImport 선언 | **27 unsafe block** (신규 모듈 20) | **13 DllImport**, `unsafe` 0 |
| Windows 전용 interop LOC (raw/code) | **478 / 355** | **332 / 213** (+ WndProc 훅 약 67/51) |
| 메시지 훅 획득 방법 | `SetWindowSubclass` 직접 부착 | `HwndSource.AddHook` (프레임워크 제공) |

**이 수치는 그대로 비교하면 안 된다.** WPF 의 13에는 32/64비트 분기로 중복 선언된
`GetWindowLongW/Ptr`·`SetWindowLongW/Ptr` 4건이 포함돼 부풀려져 있고, 반대로 Tauri 의 15에는
`tauri-plugin-global-shortcut` 이 의존성 안에서 호출하는 `RegisterHotKey` 가 빠져 있어
같은 기능인데도 과소 계상돼 있다.

### 2차 개정이 바꾸지 못한 것

- **여전히 아무것도 실행되지 않았다.** B~F 는 전부 `NOT TESTED` 그대로다.
- **링크는 한 번도 되지 않았다.** `cargo check` 는 링크를 하지 않으므로
  comctl32(`SetWindowSubclass`)·shcore(`GetDpiForMonitor`) 의 심볼 해석이 미검증이다.
- **서브클래스가 런타임에 무효화될 수 있다.** `SetWindowSubclass` 는 comctl32 v6 API 이고
  activation context 에 좌우된다. Tauri 측에는 `app.manifest` 가 없어 v5 가 로드되면
  `attach()` 가 실패하고 이전 동작으로 되돌아간다. **이 개정의 핵심 결과가 여기에 걸려 있다.**
  (WPF 측은 매니페스트를 갖고 있다.)
- **좌표 저장 실험은 양쪽이 같은 실험이 아니다.** WPF 는 기본 저장 때마다 자동으로 기록하고,
  Tauri 는 UI 에서 호출되지 않는 IPC 명령 뒤에만 있다. 두 파일은 서로 다른 config 디렉터리에
  쓰이므로 실기에서도 직접 맞대볼 수 없다.
