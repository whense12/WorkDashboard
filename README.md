# 업체별 업무 일정 · D-day 도우미

업체별로 공사·업무의 절차 기한을 놓치지 않게 하는 Windows 데스크톱 앱입니다.
좌측에 다가오는 일정(D-day), 우측에 월간 캘린더를 함께 놓고, 상세는 클릭했을 때만 엽니다.

이 앱의 목적은 '관리'가 아니라 **누락 방지**입니다. 업체 N개 × 공사 M개 × 절차 8단계가
동시에 굴러가는 상황에서 기한을 놓치지 않는 것이 전부이고, 그래서 진척률·KPI·차트처럼
시스템이 실제로 알 수 없는 것을 만들어내는 표시는 의도적으로 넣지 않습니다.

제품 요구사항의 근거는 [`CODEX_IMPLEMENTATION_BRIEF.md`](CODEX_IMPLEMENTATION_BRIEF.md)와
[`AGENTS.md`](AGENTS.md)에 있습니다. 코드를 고치기 전에 두 문서를 먼저 읽으세요.

## 화면 구성

| 영역 | 답하는 질문 | 규칙 |
|---|---|---|
| 좌측 D-day 레일 | 지금 뭐가 급한가 | 업체당 가장 가까운 1건, 날짜순 |
| 우측 캘린더 | 이번 달이 어떻게 생겼나 | `업체명 · 일정명`, 세로 스크롤 |
| 상세 모달 | 지금까지 뭘 했고 다음은 뭔가 | 업무 기록, 첨부, 절차 전단계 |
| D-day 도우미 창 | (앱을 안 열어도) 놓친 게 있나 | 업체·일정·날짜·D-day 만 |

색은 시간 긴급도에만 씁니다 — 파랑(예정) → 주황(오늘) → 빨강(지남).
초록은 완료에만 씁니다.

## 실행

### 웹으로 바로 보기

`web_standalone.html`을 Chrome/Edge에서 엽니다. 저장소 안에서 열어야 폰트가 함께 잡힙니다.
`helper_preview.html`은 도우미 창 미리보기입니다.

> 두 파일은 `frontend/`에서 생성된 결과물입니다. 직접 고치지 말고 아래 빌드 명령을 쓰세요.

### 데스크톱(Tauri) 개발 실행

Rust와 Node.js가 설치된 환경에서:

```bash
npm ci
npx tauri dev
```

### Windows 설치파일 빌드

```powershell
.\build_windows.ps1
```

결과물: `src-tauri\target\release\bundle\nsis\*.exe`

GitHub Actions(`.github/workflows/windows-build.yml`)에서도 같은 빌드를 돌립니다.
`main` 또는 `claude/**` 브랜치에 push하면 실행되고, NSIS 설치파일이
`work-calendar-helper-windows-x64` artifact로 올라갑니다.

## 개발

```bash
npm ci                      # 의존성 (Playwright만)
npm run check               # JavaScript 구문 검사
npm run build:standalone    # frontend/ -> web_standalone.html, helper_preview.html
npm test                    # 브라우저 스모크 테스트
```

### 소스 구조

```
frontend/            단일 원본. 여기만 고칩니다.
  index.html         본 화면 + Lucide 아이콘 스프라이트(인라인)
  helper.html        D-day 도우미 창
  core.js            상태·저장·마이그레이션·날짜 계산
  app.js             본 화면 UI
  helper.js          도우미 UI
  styles.css         디자인 토큰 + 전체 스타일
  fonts/             Pretendard Variable (동봉)
src-tauri/           Tauri 2 네이티브 셸, 아이콘, NSIS 설정
tools/               build-standalone.mjs, make-icons.mjs
tests/smoke.mjs      브라우저 스모크 테스트
assets/app-icon.svg  앱 아이콘 원본
```

`web_standalone.html`과 `helper_preview.html`은 생성물입니다.
CI에서 `git diff --exit-code`로 원본과 어긋났는지 검사하므로,
`frontend/`를 고친 뒤 `npm run build:standalone`을 실행하고 함께 커밋하세요.

### 디자인 토큰

`frontend/styles.css`의 `:root`에 색·타입 스케일이 모여 있습니다.
**개별 규칙에서 `font-size`에 px를 직접 쓰지 마세요.** `--fs-xs/sm/md/lg`만 씁니다.

| 토큰 | 값 | 용도 |
|---|---|---|
| `--fs-xs` | 13px | 보조 텍스트 **하한** |
| `--fs-sm` | 15px | 기본 본문, 컨트롤 |
| `--fs-md` | 17px | 업체명, D-day 등 1순위 정보 |
| `--fs-lg` | 19px | 패널·모달 제목 |

13px 하한은 범정부 UI/UX 디자인시스템(KRDS)의 PC 최소 본문(`body-xsmall` 1.3rem)이자
발주서 §19.3의 요구입니다. 스모크 테스트가 렌더된 모든 글자를 실측해 이 하한을 지킵니다.

### 아이콘 재생성

`assets/app-icon.svg`를 고친 뒤:

```bash
npm install --no-save sharp png-to-ico
node tools/make-icons.mjs
```

Rust 툴체인이 있으면 `npx tauri icon assets/app-icon.svg`도 같은 일을 합니다.
NSIS 번들러는 `src-tauri/icons/icon.ico`를 요구하므로 이 파일이 없으면 Windows 빌드가 실패합니다.

## 데이터

- 상태는 데스크톱에서 Tauri Store, 웹에서 localStorage에 저장됩니다.
- 첨부파일은 **현재 두 환경 모두 브라우저 IndexedDB**에 Blob으로 들어갑니다.
- 스키마 버전은 상태의 `version` 필드와 `core.js`의 `migrate()`가 관리합니다.
  저장 키(`work-calendar-state-v5`)는 기존 데이터가 고아가 되지 않도록 고정입니다.
- 최초 실행 시에는 업체·업무 템플릿만 들어갑니다. 예시 공사·일정은
  `설정 → 예시 데이터 불러오기`로 넣고 뺄 수 있고, 실제 업무 데이터는 건드리지 않습니다.

### 알려진 한계

- **첨부파일은 백업되지 않습니다.** 상태 JSON만 옮기면 첨부 Blob은 따라가지 않습니다.
  PC를 교체하면 첨부가 사라집니다. 데스크톱 네이티브 파일 저장(발주서 §16.2)과
  첨부 포함 백업(§16.3)은 아직 구현하지 않았습니다.
- 모달에 포커스 트랩이 없습니다(§17.2-4).
- `tauri.conf.json`의 CSP가 `null`입니다(§26).

## 라이선스 / 서드파티

| 항목 | 라이선스 | 위치 |
|---|---|---|
| Pretendard Variable | SIL Open Font License 1.1 | `frontend/fonts/LICENSE.txt` |
| Lucide 아이콘 (9개 추출) | ISC | `frontend/index.html` 스프라이트 주석 |

색·타입 스케일은 [KRDS(범정부 UI/UX 디자인시스템)](https://www.krds.go.kr/) 라이트 테마
토큰 값을 참조해 자체 CSS로 구현했습니다. KRDS 코드·폰트 파일 자체는 포함하지 않습니다.
