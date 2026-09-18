# Integrated UX Prototype v0 — `spikes/integrated/product-flow-v0/`

`Ambient → Quick → Calendar Sheet → Object Lens → Focus Surface` 를 **하나의 연결된 프로토타입**으로
구현한 것이다. 15개 상태가 각각 따로 있는 화면 모음이 아니라, 한 세션에서 실제로 걸어서 오갈 수 있는
한 화면이다 (스크린샷 14장 전부 한 세션의 연속 조작에서 나왔다).

- 기술: plain HTML / CSS / vanilla JS. framework · bundler · CDN · 웹폰트 없음.
  devDependency 는 `@playwright/test@1.56.1` 하나. 정적 서버 `server.js` 는 직접 쓴 24줄짜리 의존성 없는 서버.
- 데이터: `fixtures.js` 에 하드코딩. **프로토타입 픽스처이고 도메인 모델 확정이 아니다.**
- 저장·영속화·백엔드·파일 처리 없음.

## 실행

```
cd spikes/integrated/product-flow-v0
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install
npx playwright test          # webServer 가 server.js 를 자동으로 띄운다
npm run serve                # 손으로 볼 때: http://127.0.0.1:4326/index.html
```

URL 로 상태 고정 (테스트·스크린샷용):
`?stage=idle|ambient|quick|calendar&view=month|matrix&density=compact|comfortable|dense2`
`&dday=3|20&collapsed=all&edit=1&open=vendor,v01,2026-09-23&focus=1&qa=2026-09-02`

---

## 1. 이미 내려진 결정을 어떻게 구현했나

| 결정 | 구현 | 강제하는 테스트 |
|---|---|---|
| Flow: Ambient → Quick → Calendar Sheet → Object Lens → Focus Surface | 한 SPA 의 stage/overlay 상태기계. 뒤로가기는 `back()` 한 곳에서 역순으로 푼다 | `Idle -> Ambient -> Quick -> Calendar …`, `Esc 로 Focus -> Lens -> Calendar -> Quick -> Ambient -> Idle …` |
| Calendar 기본: 가변 높이 week row · **조밀 1열** 업체 목록 · 본문 세로 스크롤 · 업체명 직접 표기 | `.week-row` 는 내용 높이로 커지고, `.cal-body` 가 **유일한** 스크롤러. `.v-list` 는 1열 | `Calendar 는 사무일정·행사·업체 참가를 한 캘린더에 담는다 …` (셀 독립 스크롤러 0개를 단언) |
| 보조: Vendor Matrix | `업체 × 날짜` 표. 같은 날짜 열의 업체 집합이 월 뷰와 동일함을 단언 | `Calendar <-> Vendor Matrix 는 같은 데이터의 두 표면이다` |
| `+N` · 숫자만 · 셀 독립 스크롤바 · 자동 2열 금지 | `+N`/`외 N건`/`N건 더`/`…` 패턴 0건, `text-overflow:ellipsis`·`line-clamp` 0건, 밀도 전환은 **사용자 조작만** | `ZERO +N 업체 overflow …` (3개 밀도 × 월/매트릭스) |
| 2열은 비기본 옵션으로만 | `조밀 2열` 은 세그먼트의 세 번째 선택지. 기본은 `조밀` | `body[data-density]` 기본값 단언 |
| Object Lens: origin 앵커 · **동시에 정확히 1개** · 새 객체 선택은 교체 · origin 화면 유지 · 닫으면 origin 으로 focus 복귀 · 위치 점수로 다른 항목 가림 회피 | `S.lens` 는 단일 슬롯. `placeLens()` 가 right/left/below/above 4후보를 점수로 고름 | `lens 는 정확히 하나다 …`, `lens 를 열어도 origin 이 …` (lens 자신의 위치까지 단언), `lens 자신이 모든 origin 에서 화면과 캘린더 본문 안에 머문다` (101개 origin 전수 + 매트릭스 뷰), `lens 를 닫으면 focus 가 origin 으로 …` |
| 상시 우측 inspector 없음 — 영원히 | 쉴 때 lens 0개. 어떤 상태에서도 "화면 오른쪽에 붙어 화면 높이의 60% 이상을 차지하는 폭 200~560px 고정 패널" 이 0개 | `상시 우측 inspector 는 어떤 상태에도 없다` (idle/ambient/quick/calendar/lens/focus/dday 7상태) |
| D-day: HYBRID — 사용자 표시 중요 항목은 독립 pin, 나머지는 긴급도 그룹(접힘 가능), 전부 도달 가능, 기능적 상한 없음, pin 이동은 Layout Edit 에서만 | pin 영역(절대좌표) + 긴급도 5버킷. ledger 가 `총 N = 고정 P + 그룹 G (접힘 C · 스크롤 밖 S)` 를 항상 표시 | `D-day 3건/20건 — HYBRID …` (개수), `D-day 3건/20건 — pin 과 그룹 항목 전부가 화면에서 실제로 도달 가능하다 (잘림 0)` (항목마다 스크롤 후 조상 overflow·viewport 로 잘리지 않았음을 기하로 확인), `D-day 20건: group 을 접어도 항목이 하나도 사라지지 않는다` |
| Layout Edit 에서만 자유 배치 | 모든 drag 진입점이 `S.layoutEdit` 를 먼저 보고 즉시 빠져나간다. 평상시 `data-draggable="false"` / `draggable="false"` / `cursor:grab` 0개 | `평상시에는 drag 가 불가능하고 …`, `평상시 어떤 요소에도 drag 가 걸려 있지 않다` |

---

## 2. 어떤 측정이 어떤 선택을 끌었나

읽은 것은 세 branch 의 `NOTES.md` / `measurements.json` **뿐**이다 (코드·테스트는 열지 않았다).
아래 "측정" 은 그 문서의 수치이고, "이 프로토타입" 은 `measurements.json` 에 새로 실측한 값이다.

### 2.1 Calendar 밀도 — spike/calendar-density

- **측정**: 조밀(11.5px / pitch 15.17) 은 40개 업체를 642px 에, 여유(13px / pitch 23.5) 는 983.5px 에 담는다.
  여유 밀도는 20개(513.5px)가 한 화면(670px) 한계였다. 40개를 한 화면에 넣은 것은 조밀과 조밀 2열뿐.
- **그래서**: 기본을 **조밀 1열**로 두었다. 이 프로토타입 실측으로 조밀 pitch **15.2px** / 여유 **23.5px** —
  측정값이 그대로 재현된다. 20개 업체 목록 세로 비용은 조밀 **304px**, 여유 **470px**.
- **측정**: `cap`(행 고정 + 셀 내부 스크롤)은 40개에서 한 번에 7개만 읽히고 767px 이 단서 없이 스크롤 뒤에 남았다.
- **그래서**: 셀 독립 스크롤을 기본 구조에서 뺐다. 실측으로 **셀 스크롤러 0개**, 캘린더 본문만 668px 스크롤한다.
- **측정**: 2열은 세로 56% 절약 대신 이름이 두 줄로 꺾인다. 3열은 오히려 세로가 더 들어 폐기되었다.
- **그래서**: 2열은 비기본 옵션으로만 남겼다. **다만 이 프로토타입에서 2열의 절약은 10% 뿐이다**
  (조밀 1열 304px → 조밀 2열 274px, pitch 15.2 → 30.41px). 이유는 실측으로 설명된다: 1280px 폭에서
  날짜 칸 내부가 176px 이라 2열이면 열당 약 85px 이고, 한글 상호가 두 줄로 꺾인다. 측정 branch 의 56% 는
  날짜 칸이 더 넓은 조건의 값이다. **2열의 이득은 폭에 종속된다** — OPEN 으로 남긴다.
- **측정**: 매트릭스는 밀도에 둔감하고 1280px 폭에서 가로 스크롤 0px.
  **그래서** 보조 뷰로 유지. 실측: 업체 22행 × 날짜 10열, 표 1238×515px, 가로 스크롤 **0px**, 세로 스크롤 0px.

### 2.2 Object Lens — spike/object-lens

- **측정**: `A1 origin 앵커` 는 4/4 경우에서 origin 을 **0 px²** 가렸고, `A2 화면중앙+tether` 는 4개 중 2개에서
  origin 을 덮었다(최대 11,868 px²). 대신 A1 은 시선 이동이 116~763px 로 흔들렸다.
- **그래서**: origin 앵커를 쓰되 **점수 함수에 거리를 실제로 넣었다.**
  `origin 가림 px² × 100 + 다른 항목 가림 px² ÷ 200 + 중심간 거리 px ÷ 10`.
  실측 7케이스: origin 가림 **전부 0 px²**, origin 은 전부 화면 안, 중심간 거리 **269~295px** (흔들림이 크지 않다).
  처음 구현은 거리 가중치가 너무 약해(÷40) 거리 488~577px 이 나왔다 — 가중치를 고쳐 좁혔다.
- **측정**: 공통 비용은 "origin 은 안 가리지만 sheet 의 다른 항목은 가린다" (최악 4/35).
  **그래서**: 점수에 남겨 두었고 없애지 못했다. 실측 최악 **8 / 101 항목** (절반 이상 덮인 항목 수).
  항목 수가 35 → 101 로 늘었으니 비율은 비슷하다. 이건 남은 문제다 (OPEN 2).
- **측정**: 중첩 규칙 O1(교체)/O2(스택≤2)/O3(거부) 는 어느 것도 채택되지 않았고, O2 만 두 객체 동시 열람을 준다.
- **그래서**: 이번 지시가 **교체(O1)** 로 결정했으므로 O1 만 구현했다. 스택 코드는 넣지 않았다.
  O2 가 주던 "두 객체 동시 비교" 는 이 프로토타입에 **없다** — 대신 Focus Surface 의 `연결` chip 이
  다른 객체 lens 로 넘겨 준다 (클릭 1회). 비교 비용은 측정하지 않았다.

### 2.3 D-day — spike/dday

- **측정**: 20건에서 independent 는 한 화면에 15개, stack 14개, group 10~11개를 담는다.
  group 머리줄이 세로를 먹기 때문(urgency 축 990px 중 약 230px).
  **대신 group 만 접힘을 갖고**, urgency 축 20건을 전부 접으면 990 → 560 이하로 떨어져 스크롤이 사라진다.
- **그래서**: HYBRID 결정을 그대로 구현했다. 실측(20건, group 영역 305px):
  펼침 `scrollHeight 587px / overflow 282px / 한 화면 8건`,
  전부 접음 `scrollHeight 159px / overflow 0px`. **접힘의 압축률(587→159, 73% 감소)이 측정과 같은 방향이다.**
- **측정**: event 축 grouping 은 8건에서 이미 넘쳤다(group 6개, 588 > 560). group 축을 잘게 쪼개는 비용이
  pin 수보다 먼저 온다. **그래서**: 축은 긴급도 하나만 구현했다(지시도 urgency 기반이다). event 축은 넣지 않았다.
- **측정**: 접힌 머리줄에 항목 제목이 전부 텍스트로 남아야 한다(숫자·점으로 치환 금지).
  **그래서**: 접힘 머리줄은 `건수 + 그 안의 모든 제목` 을 텍스트로 유지한다. 테스트가 제목 존재를 단언한다.
- **측정**: PRIORITY RULE P1(days 오름차순) / P2(title 코드포인트). **그래서**: 같은 규칙을 그대로 썼다.
- **측정**: `surface 크기 760×560 은 임의값이고 "몇 건 보이나" 는 전부 이 크기에 종속된다`(spike OPEN 6).
  **그래서**: 이 프로토타입의 D-day surface 는 396×최대 560px 이고, 위 수치는 그 크기의 값이다.
  다른 크기에서 다시 재야 한다.

### 2.4 시각 방향에서 온 구현 결정

- Segoe UI Variable Text → Segoe UI → Malgun Gothic → system-ui 순 시스템 스택. **웹폰트 0개.**
- Fluent 계열 기하로 직접 그린 inline SVG 심볼 16개 (`<defs>` 안, 외부 요청 0개).
- 단일 accent `#0f6cbd`. 상태(확정·보류·불참·예정·진행·완료·확인 필요)는 **색을 늘리지 않고**
  굵기 · 명도 · 2px 좌측 rule · 5px accent dot · 작은 라벨로만 구분한다.
- radius 4px 한 값만. pill 은 Focus Surface 의 `연결` chip 에만. 장식 그림자는 떠 있는 표면에만 2단계.
- KPI 타일 · gradient · hero · 상시 sidebar · 상시 inspector 없음.
- `Quiet at rest`: idle 에서 ambient `opacity .62`, hover/focus(의도)에서 1.0. 애니메이션 루프·알림 없음.
- ambient 는 어떤 화면 높이에서도 `viewport 높이의 56%` 를 넘지 않고, 넘치면 자기 본문이 스크롤한다
  (실측 1280×800 에서 441px = 55.2%). 다른 업무를 가리는 큰 패널이 되지 않게 하기 위한 구현 선택이다.

---

## 3. 15개 상태와 연결 경로

| # | 상태 | 어떻게 들어가나 | 어떻게 돌아오나 |
|---|---|---|---|
| 1 | Desktop Idle | 첫 화면. 한글 문서·표계산 창·작업표시줄이 그대로 보이고 ambient 는 `.62` 로 물러나 있다 | — |
| 2 | Ambient Active | ambient 클릭/hover → 오늘 · 다음 · 확인 필요 · 중요 D-day 4구획 | `Esc` → Idle |
| 3 | Quick | ambient `Quick` → 오늘 전체 목록 + 한 줄 추가 + 캘린더 진입 | `Esc` → Ambient |
| 4 | Calendar Month | Quick `캘린더로 들어가기` (또는 ambient `캘린더`) | `Esc` → Quick/Ambient |
| 5 | Dense Calendar | 09-23 (업체 20) 로 스크롤. 20개 이름이 1열로 전부 읽힌다 | 같은 표면 |
| 6 | Vendor Matrix | sheet 머리 `업체 매트릭스` | `월` 로 복귀 |
| 7 | Vendor Lens | 셀의 업체명 클릭 (또는 매트릭스 셀·행 헤더) | `Esc` / `닫기` → origin 으로 focus 복귀 |
| 8 | Event Lens | 셀의 행사명 클릭 — **기존 lens 를 교체한다** | 같음 |
| 9 | General Schedule Lens | 셀의 일반 사무일정 클릭 | 같음 |
| 10 | Focus Surface | lens `자세히 보기` → 절차 · 업무(예정/진행/완료) · 첨부 존재 · 변경 이력 · 참가계획 · 연결 | `Lens 로 돌아가기` / `Esc` → 같은 객체 lens |
| 11 | Quick Add | 빈 날짜(또는 셀 `+`) 클릭 → 날짜 미리 채움. 처음 보이는 입력은 제목 + 날짜 + 시간 3개뿐, 나머지는 `자세한 항목` 으로 펼침 | `Esc` → Calendar |
| 12 | D-day 3 | ambient/Quick `D-day` → `3건` | `Esc` → Ambient |
| 13 | D-day 20 | `20건` | 같음 |
| 14 | Layout Edit | ambient `배치 편집` (또는 D-day 머리 연필) → pin 이동 · ambient/D-day 위치 이동만 여기서 | `완료` / `Esc` → 배치는 남고 다시 잠긴다 |
| 15 | Return path | 위 전부. `Focus → Lens → Calendar → Quick → Ambient → Idle` 이 `Esc` 한 키로 역순으로 풀린다 | 테스트가 6단계를 실제로 걷는다 |

## 4. 픽스처 (프로토타입 전용)

행사 4건 · 업체 22개소 · 일반 사무일정 15건 · 업체 참가 76건(9월) · 참가계획 23개(반복 패턴 명시) ·
날짜예외 3건(불참 1 · 보류 2) · 업무 24건(예정 7 · 진행 10 · 완료 7) · 절차 8세트 · 첨부 존재표시 9객체 ·
변경 이력 8객체 · D-day 20건(그중 사용자 표시 pin 3건).
밀집일은 2026-09-23 (업체 20). 오늘은 2026-09-18 (금).

---

## 5. PASS / FAIL / NOT TESTED / NOT APPLICABLE

실제 실행: `npx playwright test` → **29 passed, 0 failed** (Chromium headless, Playwright 1.56.1, 1 worker).
viewport 는 config 에서 1280×800 으로 고정(devices 기본 1280×720 을 덮어쓴다), 스크린샷 spec 은 1280×800 과 1600×1000 두 번 돈다.

| 요구 | 결과 | 근거 |
|---|---|---|
| Idle→Ambient→Quick→Calendar 가 실제로 이어진다 | **PASS** | `Idle -> Ambient -> Quick -> Calendar 가 한 화면에서 이어진다` |
| 빈 날짜 클릭 → Quick Add, 날짜 미리 채움, 첫 입력 최소 | **PASS** | `빈 날짜를 클릭하면 …` (`#qa-date` 값 + 처음 보이는 input 3개 단언) |
| 밀집일 업체 20곳 이름 전부 도달 가능 | **PASS** | `Dense Calendar — 20개 업체명이 …` (20개 각각 visible + 높이 ≥ 글자 크기) |
| Calendar ↔ Matrix, 같은 데이터 | **PASS** | `Calendar <-> Vendor Matrix …` (같은 날짜 열의 업체 집합 동일) |
| Vendor / Event / General Schedule lens | **PASS** | `Vendor / Event / General Schedule 세 가지 lens …` |
| lens 교체 후 활성 lens == 1 | **PASS** | `lens 는 정확히 하나다 …` (4객체 연속 클릭) |
| origin 이 화면에 남는다 | **PASS** | `lens 를 열어도 origin 이 …` (5케이스, 가림 0 px² + viewport 안) |
| lens 자신이 화면·캘린더 본문 밖으로 나가지 않는다 | **PASS** | `lens 자신이 모든 origin 에서 …` (월 뷰 origin 101개 + 매트릭스 뷰 전수, viewport 밖 0px · 본문 밖 0px · origin 과 간격 ≤ 16px) |
| Focus 진입 / 복귀 | **PASS** | `Focus Surface 진입과 복귀 …` |
| D-day 3 / 20 | **PASS** | `D-day 3건/20건 — HYBRID …` (고정 + 그룹 = 총건수) |
| D-day 항목 전부가 실제로 화면에서 도달 가능 | **PASS** | `D-day 3건/20건 — pin 과 그룹 항목 전부가 …` (pin·항목 하나하나를 스크롤해 끌어온 뒤 조상 overflow·viewport clip 을 적용한 실제 보이는 박스가 자기 크기와 같음을 확인. 접었다 편 뒤 재확인) |
| 접힘으로 항목 0개 유실 | **PASS** | `D-day 20건: group 을 접어도 …` (제목 집합 동일 + 왕복 복귀) |
| 평상시 drag 불가 / Layout Edit 에서 가능 | **PASS** | `평상시에는 drag 가 불가능하고 …` (이동량 0 vs 정확히 +120/+90) |
| `Esc` / 뒤로 | **PASS** | `Esc 로 Focus -> Lens -> Calendar -> Quick -> Ambient -> Idle …`, `Esc 가 Quick Add 와 Layout Edit 도 …` |
| `+N` 업체 overflow 0건 | **PASS** | `ZERO +N 업체 overflow …` (3밀도 × 월/매트릭스, ellipsis·line-clamp 포함 검사) |
| 상시 우측 inspector 0개 | **PASS** | `상시 우측 inspector 는 어떤 상태에도 없다` (7상태) |
| MUST 4 — 이 날짜만 vs 전체 참가계획 | **PASS** | `이 날짜만 수정과 전체 참가계획 수정이 구별된다` |
| 스크린샷 14장 (1280×800, 1600×1000) | **PASS** | `tests/screens.spec.js` — 한 세션에서 연속 조작하며 촬영 |
| 실측치 기록 | **PASS** | `tests/measure.spec.js` → `measurements.json` (손으로 쓴 값 없음) |
| lens 위치 점수의 가중치 값 자체(거리 ÷10, 타 항목 가림 ÷200) | **NOT TESTED** | 현재 구현에서는 ÷40 으로 되돌려도 101개 origin 의 배치가 관측상 동일하다 (위 검증 보강 3). 관측 가능한 성질(화면·본문 안, origin 과 ≤16px)만 잠갔다 |
| 다른 해상도 / DPI / 창 크기 변경 | **NOT TESTED** | 1280×800 · 1600×1000 두 조합만. `resize` 는 재렌더하지만 검증하지 않았다 |
| 키보드 전용 경로 · tab 순서 · 스크린리더 | **NOT TESTED** | `Esc` 와 lens 닫힘 focus 복귀만 검증. `aria`/tab 순서는 검사하지 않았다 |
| 실제 Windows 데스크톱 상주(투명 창·always-on-top·다른 창 간섭) | **NOT TESTED** | 브라우저 안에서 데스크톱을 흉내낸 것이다 |
| 성능 (렌더 시간 · 스크롤 프레임) | **NOT TESTED** | 측정하지 않았다 |
| 업체 40개 이상 / 여러 날이 동시에 밀집 / D-day 100건 | **NOT TESTED** | 픽스처 최대치는 하루 20업체, D-day 20건 |
| 터치 · 펜 입력 | **NOT TESTED** | drag 는 mouse 이벤트로만 |
| 저장 · 영속화 · 실수 복구(MUST 11 의 복구 부분) | **NOT APPLICABLE** | 프로토타입 범위 밖. 변경 이력은 **표시만** 한다 |
| 파일/폴더 열기(MUST 8 의 처리 부분) | **NOT APPLICABLE** | 첨부는 **존재만** 표시한다 |
| template 재사용(MUST 10) | **NOT APPLICABLE** | 이번 프로토타입 범위에 없다 |

### 구현 중 테스트가 잡은 실제 결함 (테스트를 낮추지 않고 구현을 고쳤다)

1. **`playwright.config.js` 의 `...devices['Desktop Chrome']` 가 내 `viewport` 를 덮어써서** 실제 테스트가
   1280×720 으로 돌고 있었다. `상시 우측 inspector` 테스트가 ambient 를 `높이 65%` 로 잡아내 드러났다.
   → spread 순서를 고쳐 1280×800 을 확정하고, 동시에 ambient 에 `viewport 56%` 상한 + 자기 본문 스크롤을 주어
   **어떤 화면 높이에서도** 오른쪽 column 이 되지 않게 했다. (단언을 느슨하게 하지 않았다.)
2. `#scrim`(z-index 30)이 `#sheet` 위에 그려져 캘린더 전체가 흐려 보였다 → sheet `z-index:35`,
   scrim 은 Focus 가 열릴 때만 45 로 올라간다.
3. ambient / D-day / Quick 을 전부 화면 오른쪽 열에 세로로 쌓았더니 서로 겹쳐서,
   Quick 의 닫기 버튼이 viewport 밖으로 나가고 Layout Edit 의 ambient drag 가 D-day 패널에 먹혔다
   (두 테스트가 각각 잡았다) → D-day/Quick 을 ambient 열 **왼쪽** 슬롯으로 옮기고 둘이 동시에 열리지 않게 했다.
4. lens 가 viewport 기준으로만 clamp 되어 Calendar Sheet 바깥(작업표시줄 위)까지 삐져나왔다
   → 캘린더 본문 영역으로 clamp 하도록 고쳤다. **처음에는 이 수정에 회귀 테스트가 없었다.**
   지금은 `lens 자신이 모든 origin 에서 화면과 캘린더 본문 안에 머문다` 가 막는다 (아래 검증 보강 참조).
5. lens 위치 점수의 거리 가중치가 너무 약해(÷40) 항상 화면 왼쪽 빈 곳으로 날아갔다(중심간 269→577px).
   `measurements.json` 이 그걸 보여줘서 가중치를 다시 잡았다.
   **다만 이 값은 지금 구현에서 회귀 테스트로 잠기지 않는다** — 아래 검증 보강 3 참조.
6. D-day pin 제목을 `nowrap + ellipsis` 로 두었더니 `제28회 가을 농특산물 대축제 개막` 이 잘렸다.
   pin 은 group 에 중복으로 들어가지 않으므로 그 잘림은 **정보 유실**이다 → 두 줄 허용 + pin 높이 74px 로 고쳤다.
7. 밀집 주 행 스크린샷이 `row.offsetTop` 을 `#calBody` 기준으로 착각해 날짜 머리줄을 지나쳐 찍혔다
   → `getBoundingClientRect` 차이로 계산하도록 고쳤다.

### 검증 지적에 따른 보강 (테스트를 낮추지 않고 단언을 늘렸다)

독립 검증에서 "개수만 세고 실제로 보이는지는 아무도 확인하지 않는다" 는 지적을 받아, **구현은 그대로 두고
빠져 있던 단언을 추가했다.** acceptance 를 낮추거나 단언을 지우지 않았다 (테스트 수 26 → 29, 모두 추가).

1. **D-day `누락 0 · 전부 도달 가능`** — 기존 테스트는 `.pin` / `.dd-item` 의 **개수와 텍스트 집합**만 봤다.
   `D-day 3건/20건 — pin 과 그룹 항목 전부가 화면에서 실제로 도달 가능하다 (잘림 0)` 를 추가했다.
   항목마다 `scrollIntoViewIfNeeded` 로 끌어온 뒤, **조상의 `overflow` clip 과 viewport 를 모두 적용한
   실제 보이는 박스**(`helpers.visibleBoxOf`)가 자기 박스 크기와 같은지, 높이가 글자 크기 이상인지 본다.
   접었다 편 왕복 뒤에도 같은 집합을 다시 확인한다.
   - 변이 검증: 펼쳐진 `.dd-items` 에 `max-height:0;overflow:hidden` 을 넣으면
     **보강 전 26개 전부 통과 → 보강 후 2개 실패**(`dd-item 0 세로 잘림: 보이는 6 / 실제 23`).
   - 변이 검증: D-day 패널을 viewport 아래로 260px 밀면 역시 실패한다(`보이는 0 / 실제 23`).

2. **lens 자신의 위치** — 기존 테스트는 **origin** 만 검사했고 lens 자신은 아무도 보지 않았다.
   기존 `lens 를 열어도 origin 이 …` 에 lens 위치 단언을 더하고,
   `lens 자신이 모든 origin 에서 화면과 캘린더 본문 안에 머문다` 를 새로 추가했다
   (월 뷰 origin 101개 전수 + 매트릭스 뷰 전수: viewport 밖 0px · 캘린더 본문 밖 0px · origin 과 간격 ≤ 16px ·
   lens 가 찌그러지지 않음). 실측 최댓값은 viewport 밖 0 / 본문 밖 0 / 간격 10px(= `placeLens` 의 `GAP`).
   - 변이 검증: `placeLens` 의 clamp 를 항등함수로 바꾸면 **보강 전 전부 통과 → 보강 후 2개 실패**
     (월 뷰에서 위반 198건).
   - 변이 검증: clamp 를 viewport 기준으로만 되돌리면(결함 #4 를 그대로 재현) 역시 2개 실패한다.

3. **결함 #5 의 거리 가중치(÷40 → ÷10)는 회귀 테스트로 잠그지 않았다 — `NOT TESTED` 로 남긴다.**
   지금 구현에서 가중치를 ÷40 으로 되돌리고 origin 101개를 전수 측정하면
   중심간 거리 최대 **296px → 296px**, 평균 **261px → 264px**, origin 과의 간격 최대 **10px → 10px**,
   앵커 분포 `left 66→69 · above 17→15 · below 8→7 · right 10→10` 으로 **관측상 차이가 없다**.
   결함 #5 의 577px 은 결함 #3·#4 를 고치기 전 배치에서 나온 값이고, 본문 영역 clamp 가 들어온 뒤로는
   가중치가 배치를 좌우하지 않는다. 관측되지 않는 것을 통과시키려고 소스의 `/ 10` 이라는 숫자 자체를
   테스트로 굳히지는 않았다 — 그것은 프로토타입 내부 수치를 제품 규칙으로 승격하는 일이다.

---

## 6. 스크린샷

`screenshots/*.png` (1280×800) · `screenshots/1600x1000/*.png` (1600×1000). 전부 테스트가 실제로 찍은 것이고,
**한 세션에서 순서대로 조작하며** 나왔다 (04 → 05 는 스크롤, 07 → 08 은 lens 교체, 10 → 11 은 `Esc` 두 번 …).

`01-desktop-idle` `02-ambient-active` `03-quick` `04-calendar-month` `05-calendar-dense20`
`06-vendor-matrix` `07-vendor-lens` `08-event-lens` `09-schedule-lens` `10-focus-surface`
`11-quick-add` `12-dday-3` `13-dday-20` `14-layout-edit`

---

## 7. OPEN — 제품 판단이 필요해 구현하지 않은 것

1. **`조밀 2열` 의 이득이 폭에 종속된다.** 1280px 폭에서 실측 절약은 10% 뿐이고(304→274px) pitch 는
   15.2 → 30.41px 로 두 배가 된다. 측정 branch 의 56% 는 다른 폭 조건의 값이다. 2열을 언제 제공할지,
   폭 임계값을 둘지는 제품 판단이라 남긴다.
2. **lens 가 sheet 의 다른 항목을 가리는 문제가 남아 있다.** 실측 최악 8/101 항목. 점수 가중치를 바꿔
   거리와 맞바꿀 수는 있지만, "덜 가리기" 와 "origin 가까이" 중 무엇을 더 살지는 측정만으로 결정되지 않는다.
3. **교체(O1)로 두 객체 동시 비교가 없어졌다.** 지금은 Focus Surface 의 `연결` chip 으로 한 클릭에 넘어간다.
   이게 충분한지(업체 2곳의 참가 상태를 나란히 보는 일이 실제로 잦은지)는 사용 판단이다.
4. **ambient 가 요약에서 3건/2건만 보여준다.** 총 건수와 `Quick 에서 N건 전부 보기` 를 항상 같이 표시해
   숨김이 아님을 명시했지만, **ambient 에 몇 건을 둘 것인가**는 제품 결정이다(지금 값은 임의다).
5. **D-day surface 크기 396×560px 은 임의값이다.** "한 화면에 몇 건" 수치 전부가 이 크기에 종속된다.
   실제 상주 창 크기가 정해지면 다시 재야 한다.
6. **긴급도 그룹의 기본 접힘 상태를 정하지 않았다.** 지금은 전부 펼친 상태로 시작해 20건에서 282px 이
   스크롤 뒤에 남는다(ledger 가 `스크롤 밖 9` 로 밝힌다). 처음부터 접어서 시작할지는 제품 판단이다.
7. **그룹 머리줄의 접힘 요약이 한 줄을 넘을 때 뒤쪽 제목이 시각적으로 잘린다** (텍스트는 DOM 에 전부 있고
   테스트가 확인한다). 두 줄 허용 / 폭 확대 / 다른 접힘 형태 중 무엇이 맞는지 정하지 않았다.
   D-day 항목의 `소속` 도 같은 이유로 잘린다.
8. **"기한 지남" 항목이 계속 맨 위를 차지한다** (P1 상 음수가 항상 최우선). 만료·보관 규칙이 필요한지는
   제품 결정이다.
9. **셀 안의 위계 — 일반 사무일정/행사가 위, `참가 업체` 가 아래.** spike 가 남긴 OPEN 을 그대로 두었다.
   업체 20곳일 때 일반 일정이 목록에 묻히는 문제는 그대로 있다.
10. **Layout Edit 이 무엇을 편집하는가.** 지금은 pin 좌표 + ambient/D-day 패널 위치다. 그룹 순서 재정렬,
    캘린더 배치 등을 여기에 넣을지는 정하지 않았다.
11. **Quick Add 의 `자세한 항목` 에 무엇이 들어가야 하는가.** 지금 4개(분류·연결·반복·첨부 경로)는
    프로토타입 자리표시이고 제품 결정이 아니다.
12. **날짜 입력 표기.** `<input type="date">` 라서 브라우저 로케일 표기(`09/02/2026`)가 그대로 나온다.
    실제 Windows 앱의 날짜 입력 형식은 shell 결정과 엮여 있어 손대지 않았다.

이 문서의 수치는 **측정 결과**이고 제품 결정이 아니다. 여기서 새 제품 규칙을 만들지 않았다.
