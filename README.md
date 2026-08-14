# Work Calendar Helper v5

업체별 D-day 카드 + 월간 캘린더 + 업무/업체 템플릿 + Windows용 Tauri 미니 도우미 프로젝트입니다.

## v5 변경사항

- 일정 상세에 **업무 내용 기록** 추가: 날짜/시간과 함께 누적 기록
- 일정 상세에 **파일 첨부** 추가: 문서/사진 등을 로컬 IndexedDB에 Blob으로 저장
- 상세창에서 **완료 / 현재 / 예정(미도래) 절차를 전부 표시**
- 완료된 절차도 삭제하지 않고 완료일과 함께 표시
- D-day 무제한/직접설정, 빈 날짜 클릭 일정 추가, 스크롤 캘린더, 업체/업무 템플릿 기능 유지
- ZIP 호환성을 위해 배포 파일/폴더명은 ASCII 영문 경로 사용

## 파일 첨부 주의

첨부파일은 웹 브라우저 또는 Tauri WebView의 **로컬 IndexedDB**에 저장됩니다. 같은 PC/사용자 프로필에서는 유지되지만, JSON 상태 데이터만 복사해서 다른 PC로 옮기면 첨부파일 Blob은 따라가지 않습니다. 실제 배포 전에는 `첨부파일 포함 전체 백업/복원` 또는 서버/공유폴더 연동을 추가하는 것이 좋습니다.

## 웹 실행

`web_standalone.html`을 Chrome/Edge에서 열어 사용할 수 있습니다.

## Tauri 개발 실행

Rust와 Node.js가 설치된 환경에서:

```bash
cd src-tauri
cargo tauri dev
```

또는 Tauri CLI 설치 후 프로젝트 루트의 환경에 맞춰 실행합니다.

## Windows 빌드

Windows 환경 또는 GitHub Actions `windows-latest` 러너에서 Tauri prerequisites를 설치한 뒤 빌드하는 것을 권장합니다.

## GitHub Actions로 Windows 자동 빌드

`.github/workflows/windows-build.yml`이 포함되어 있습니다. 저장소의 `main` 브랜치에 push하거나 Actions에서 수동 실행하면 `windows-latest`에서 JavaScript 구문 검사 후 Tauri NSIS `.exe` 설치파일을 빌드합니다. 결과는 Actions의 `work-calendar-helper-windows-x64` artifact에서 받을 수 있습니다.

이 채팅 환경은 Linux이며 Rust toolchain이 설치되어 있지 않아 여기서는 Windows `.exe`를 직접 컴파일할 수 없습니다. GitHub Actions Windows 러너를 연결하면 실제 Windows 빌드 로그와 결과물을 기준으로 반복 수정/검증할 수 있습니다.

## Codex handoff

Codex에서 이 저장소를 이어서 구현할 경우 먼저 다음 두 파일을 읽습니다.

- `AGENTS.md` — 절대 어기면 안 되는 UX/개발 지침
- `CODEX_IMPLEMENTATION_BRIEF.md` — 전체 맥락, 설계발주서, 데이터모델, 테스트/완료조건

Codex 작업 시작 시 `CODEX_START_PROMPT.txt` 내용을 그대로 첫 작업 지시로 사용할 수 있습니다.
