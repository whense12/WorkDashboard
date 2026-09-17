# Spike 실행 환경 (측정값)

이 Spike 를 실행한 기계의 실제 상태다. 추정이 아니라 명령 출력이다.

| 항목 | 값 |
|---|---|
| OS | Ubuntu 24.04.4 LTS (`Linux 6.18.44 x86_64`) |
| Windows 인가 | **아니오.** WSL 도 아님 (`/mnt/c` 없음, `powershell.exe` 없음, `$WINDIR` 없음) |
| 디스플레이 서버 | **없음.** `DISPLAY`·`WAYLAND_DISPLAY` 미설정, X11 소켓 없음 |
| node / npm / pnpm | v22.22.2 / 10.9.7 / 10.33.0 |
| rustc / cargo / rustup | 1.94.1 / 1.94.1 / 1.29.0 |
| Rust 타깃 | `x86_64-unknown-linux-gnu`, `x86_64-pc-windows-msvc` (이번에 추가) |
| webkit2gtk-4.1 | 2.52.6 (이번에 설치) + gtk3 dev |
| .NET SDK | 8.0.425 (`$HOME/.dotnet`, 이번에 설치) |
| MSBuild / PowerShell | 별도 설치 없음 (dotnet 내장 MSBuild 사용) |

## 이 환경이 Spike 에 부과하는 한계

1. **두 프로토타입 모두 실행할 수 없다.** Windows 가 아니고 GUI 도 없다.
   따라서 창 동작(frameless·transparent·bottom-Z·click-through·Alt+Tab·taskbar·
   global shortcut·위치 복원·DPI·multi-monitor)은 **한 건도 관측되지 않았다.**
2. **WPF**: `wpf` 프로젝트 템플릿이 Linux SDK 에 없다(실측). 그러나
   `<EnableWindowsTargeting>true</EnableWindowsTargeting>` 을 넣은 수기 `.csproj` 는
   **컴파일에 성공한다**(실측: `Build succeeded. 0 Error(s)`).
   컴파일만 가능하고 실행은 불가능하다.
3. **Tauri**: Linux 빌드 전제(webkit2gtk)는 설치했다.
   Windows 실행파일 생성은 MSVC 링커·Windows SDK·WebView2 가 필요해 이 기계에서 불가능하다.
   Windows 코드 경로는 `cargo check --target x86_64-pc-windows-msvc` 로 **타입 검사까지만** 가능하다.
4. 따라서 Acceptance Matrix 의 B~F 구간은 대부분 `NOT TESTED` 가 된다.
   이것은 구현 실패가 아니라 **실행 환경의 한계**다.

## 설치한 것

시스템 정책을 바꾸는 변경은 하지 않았다.

- `apt-get install libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev build-essential pkg-config`
- `dotnet-install.sh --channel 8.0 --install-dir $HOME/.dotnet` (사용자 홈 설치, 시스템 PATH 미변경)
- `rustup target add x86_64-pc-windows-msvc`
