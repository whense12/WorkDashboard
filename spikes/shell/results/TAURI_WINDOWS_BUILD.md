# Tauri — Windows 실행파일 생성 시도 (실측)

추론이 아니라 실제로 돌린 결과다.

## 명령

```
cd spikes/shell/tauri/src-tauri
cargo build --target x86_64-pc-windows-msvc
```

## 결과: **FAIL** (링크 단계)

의존 crate 는 **전부 컴파일에 성공**했다 — `webview2-com-sys`, `tao`, `wry`,
`tauri-runtime-wry`, `tauri 2.11.5`, `tauri-plugin-autostart`,
`tauri-plugin-global-shortcut`, 그리고 `spike-shell-tauri` 본체까지.
실패는 마지막 링크에서 났다.

```
   Compiling spike-shell-tauri v0.1.0 (/home/user/WorkDashboard/spikes/shell/tauri/src-tauri)
error: linker `link.exe` not found
  |
  = note: No such file or directory (os error 2)

note: the msvc targets depend on the msvc linker but `link.exe` was not found

note: please ensure that Visual Studio 2017 or later, or Build Tools for Visual Studio
      were installed with the Visual C++ option.

error: could not compile `spike-shell-tauri` (lib) due to 1 previous error
```

`target/x86_64-pc-windows-msvc/debug/` 에 `.exe` 는 생성되지 않았다.

## 이 기계의 링커 상황

| 링커 | 존재 |
|---|---|
| `link.exe` (MSVC) | 없음 |
| `x86_64-w64-mingw32-gcc` (mingw) | 없음 |
| `lld-link` | 있음 |
| `rust-lld` | rustc 번들 안에만 (linux-gnu 용) |

`lld-link` 가 있어도 Windows SDK 의 import library(`kernel32.lib`, `user32.lib` 등)와
WebView2 loader 가 없어 링크가 성립하지 않는다.

## 대조군 — WPF 는 같은 기계에서 성공한다

```
dotnet build -c Release -r win-x64 --self-contained false
→ Build succeeded. 0 Error(s)
→ bin/Release/net8.0-windows/win-x64/ShellSpike.exe
→ file: PE32+ executable (GUI) x86-64, for MS Windows, 6 sections
→ 내장 매니페스트에 PerMonitorV2 확인
```

## 해석 범위

- 이것은 **크로스 빌드 가능성**에 대한 결과다. Tauri 가 Windows 에서 빌드되지 않는다는 뜻이 **아니다**.
  Windows + Visual C++ Build Tools 환경에서는 정상 빌드될 것으로 보이나, **이 Spike 에서 확인하지 않았다**.
- 확인된 것은 하나다: **Linux CI 에서 Windows 산출물을 만드는 경로가 WPF 에는 있고 Tauri 에는 없다.**
- 타입 검사는 별개로 통과한다 — `cargo check --target x86_64-pc-windows-msvc` 는 exit 0.
  `#[cfg(windows)]` Win32 코드가 실제로 그 타깃에서 컴파일된다는 것은 음성 대조(의도적 오류 주입 후
  `error[E0433]` 확인, 되돌림)로 확인했다.
- **어느 쪽도 실행되지 않았다.** 이 문서는 빌드에 대한 것이지 동작에 대한 것이 아니다.
