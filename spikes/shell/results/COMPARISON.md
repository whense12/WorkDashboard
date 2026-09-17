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
- **PASSIVE 의 bottom-Z 가 1회성 배치에 그친다.** `WM_WINDOWPOSCHANGING` 을 가로챌 수 없어
  다른 창이 Z-order 를 바꾸면 되돌릴 방법이 없다.
  원인: Tauri 2 의 `WindowEvent` 에 raw 메시지 변형이 없다(`Resized`/`Moved`/`CloseRequested`/
  `Destroyed`/`Focused`/`ScaleFactorChanged`/`ThemeChanged`/`DragDrop` 뿐).
- **PASSIVE 의 focus 미탈취가 top-level HWND 에만 적용된다.** WebView2 는 자체 자식 HWND 계층을
  가지며 부모의 `WS_EX_NOACTIVATE` 가 이를 덮지 않는다. `WM_MOUSEACTIVATE` 를 답할 수단이 없다.

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
| bottom-Z | `NOT TESTED` · 코드는 **1회성 배치** | `NOT TESTED` · 코드는 **메시지 훅으로 상시 재강제** |
| click-through | `NOT TESTED` · `set_ignore_cursor_events` + `WS_EX_TRANSPARENT` | `NOT TESTED` · `WS_EX_TRANSPARENT` |
| focus behavior | `NOT TESTED` · `WS_EX_NOACTIVATE` **만** (WebView2 자식 HWND 미포함) | `NOT TESTED` · `WS_EX_NOACTIVATE` + `MA_NOACTIVATE` + `WM_ACTIVATE` 복구 |
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
   활성화 복구, 디스플레이 변경 대응)은 **WPF 에서는 지원되는 API 로 구현되고, Tauri 에서는 안 된다.**
   단, 이것은 Windows 의 한계가 아니라 **Tauri 2 의 지원 API 표면의 한계**다.
   Tauri crate 는 이미 `windows` 를 링크하고 raw HWND 도 쥐고 있어, 비지원 `SetWindowSubclass` 를
   쓰면 넷 다 닫힌다. 그 선택의 비용은 이 Spike 에서 평가하지 않았다.
3. WPF 는 외부 패키지 의존이 0이고, Tauri 는 상당한 crate 그래프를 끌어온다.

**읽으면 안 되는 것 (미측정)**
- 어느 쪽이 실제로 더 안정적인지 — 실행 표본이 0이다.
- 어느 쪽이 더 가볍고 빠른지 — CPU·메모리 측정이 0건이다.
- PASSIVE 위젯이 실제로 다른 앱을 방해하지 않는지 — 관측되지 않았다.
- "native 라서 더 안정적" / "현대적이라서 더 낫다" 류의 결론 — 근거가 없다.

**최종 플랫폼은 이 문서로 확정하지 않는다.**
확정하려면 Windows 기계에서 `acceptance.md` 의 B~F 를 실제로 수행해야 한다.
