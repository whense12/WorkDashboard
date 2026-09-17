# SPIKE D — Desktop D-day

**이것은 spike 다. 최종 디자인이 아니고, 승자를 고르지 않는다.**
여러 배치 방식을 같은 조건에서 만들어 놓고 실제로 재보기 위한 프로토타입이다.
여기서 나온 수치는 측정 결과이지 제품 결정이 아니다.

- 위치: `spikes/ux/dday/`
- 기술: 순수 HTML + CSS + vanilla JS. framework/bundler/CDN 없음. devDependency 는 `@playwright/test` 하나.
- 서버: `server.js` (직접 쓴 42줄짜리 정적 서버, 127.0.0.1:4173). Playwright `webServer` 가 띄운다.
- 저장소/백엔드/영속성 없음. fixture 는 `fixtures.js` 에 하드코딩, 배치 상태는 메모리에만 있다.

## 실행

```
cd spikes/ux/dday
npm install          # PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 로 실행할 것
npx playwright test  # 서버 자동 기동, screenshots/ 와 measurements.json 생성
node server.js       # 손으로 볼 때
```

URL 로 조건 고정: `?f=3|8|20&arr=free|stack|grouped&axis=urgency|event&collapsed=all&edit=1`

---

## 무엇을 만들었나

데스크톱 배경에 실제 업무 문서를 깔아 두고, 그 위에 우측 상단으로 **D-day pin surface**
(760 x 560 고정)를 올렸다. 같은 fixture(3 / 8 / 20건)를 세 가지 배치로 렌더한다.

### 배치 A — independent (`arr=free`)
pin 하나하나가 따로 놓인다. 2D 좌표를 가지며, Layout Edit 안에서만 끌어 옮길 수 있다.
사용자가 옮기지 않은 pin 은 우선순위 순서대로 자동 흐름 배치(3열 x N행)를 따른다.
pin 크기 220 x 94.

### 배치 B — stack (`arr=stack`)
grouping 없이 우선순위 한 줄 목록. 한 건당 세로 약 38px. 자유 배치 없음.

### 배치 C — group (`arr=grouped`)
축을 골라 묶는다.
- `axis=urgency` — 기한 지남 / 오늘 / 7일 이내 / 30일 이내 / 그 이후
- `axis=event` — 행사·업무 단위 (가을 농특산물 대축제, 정산, 지도점검 …)

group 은 접힌다(collapse). 접히면 pin 본문이 `display:none` 이 되지만 **DOM 에서 사라지지 않는다.**
접힌 머리줄에는 건수와 함께 **그 안에 든 항목 제목이 전부 텍스트로 남는다**
(숫자·점으로 치환하지 않는다).

### 자리가 모자랄 때 — scroll
잘라내거나 상한을 두지 않는다. rail 이 넘치면 스크롤한다. **pin 개수에 기능적 상한이 없다.**
surface 머리에 원장(ledger)을 두어 `총 N건 — 지금 보이는 것 M건, 접힘 C건, 스크롤 밖 S건` 을
항상 표시한다. 세 숫자의 합은 항상 N이고, 테스트가 그것을 검증한다.

### PRIORITY RULE (명시 규칙)
좁은 자리를 누가 차지하는지는 다음 규칙으로 정한다. 구현 편의가 아니라 규칙이 먼저다.

- **P1** `days` 오름차순. 음수(기한 지남)가 가장 앞이다.
- **P2** 동률이면 `title` 코드포인트 오름차순.
- **P3** group 순서는 그 group 의 최우선 pin(P1/P2) 기준. 동률이면 group key 코드포인트.
- **P4** Layout Edit 에서 사용자가 옮긴 배치/순서는 P1~P3 을 덮어쓴다.
  단, 어떤 pin 도 목록에서 사라지게 하지 않는다.

테스트는 구현을 호출해서 기대값을 만들지 않는다. `tests/helpers.js` 에 손으로 적은
기대 순서와 비교한다.

### Kernel 대응
- **MUST 9** — 3 / 8 / 20건 모두 pin 되고, 어떤 배치에서도 한 건도 누락되지 않는다.
- **EXPERIENCE 6 / NEVER 5** — 자유 배치는 `Layout Edit` 상태에서만. 평상시에는 어떤 요소에도
  drag 가 걸리지 않는다. drag 진입점 전부가 `state.layoutEdit` 를 먼저 확인하고 즉시 빠져나가며,
  모든 pin 은 `data-draggable="false"` / `draggable="false"` 로 남는다. grab 커서도 나타나지 않는다.
- **EXPERIENCE 2** — 평상시 surface 는 opacity 0.62 로 물러나 있고, hover(의도) 시 1.0 으로 올라온다.
  Layout Edit 중에는 ambient 가 해제된다. 애니메이션 루프나 알림은 없다.
- **EXPERIENCE 5** — 밀도는 숨김이 아니라 배치/접힘/스크롤로 처리했고, 접힘도 건수와 제목을 남긴다.
- **NEVER 4** — pin 을 KPI/pill 로 쪼개지 않고 D-숫자 + 제목 + 소속의 typographic 위계로만 세웠다.

---

## 측정 결과 (`measurements.json`, viewport 1440x900 / surface 760 x rail 560 고정)

한 화면에 온전히 들어오는 pin 수 (스크롤 없이):

| fixture | independent | stack | group(urgency) | group(event) | group 접힘(urgency) |
|---|---|---|---|---|---|
| 3  | 3 / 3   | 3 / 3   | 3 / 3   | 3 / 3   | 3건이 group 3개로, 스크롤 없음 |
| 8  | 8 / 8   | 8 / 8   | 8 / 8   | 7 / 8   | 8건이 group 5개로, 스크롤 없음 |
| 20 | 15 / 20 | 14 / 20 | 10 / 20 | 11 / 20 | 20건이 group 5개로, **스크롤 없음** |

필요한 세로 길이(`railScrollHeight`, 560을 넘으면 스크롤):

| case | scrollHeight | overflow |
|---|---|---|
| f20 independent | 778 | 218 |
| f20 stack | 751 | 191 |
| f20 group(urgency) | 990 | 430 |
| f20 group(event, group 8개) | 1134 | 574 |
| f20 group(urgency) 전부 접음 | 560 | 0 |
| f8 group(event, group 6개) | 588 | 28 |

읽히는 것:

1. **8건까지는 배치 방식이 크게 문제되지 않는다.** 세 배치 모두 스크롤 없이 다 들어온다.
   예외는 event 축 grouping 으로, 8건에 group 이 6개가 생겨 그때 이미 넘친다(588 > 560).
   group 축을 잘게 쪼개는 비용이 pin 수보다 먼저 온다.
2. **20건에서 갈린다.** independent 가 한 화면에 가장 많이(15) 담고, stack 이 14,
   group 은 10~11 로 가장 적다. group 머리줄이 세로를 먹기 때문이다
   (urgency 축 20건 기준 990px 중 group 머리 몫이 약 230px).
3. **대신 group 만 접힘을 갖는다.** urgency 축 20건을 전부 접으면 990 → 560 이하로 떨어져
   스크롤이 사라지고, 5줄로 20건 전부를 건수와 제목까지 유지한 채 요약한다.
   즉 group 은 "펼친 상태의 밀도"를 잃는 대신 "접은 상태의 압축률"을 얻는다.
4. **independent 는 자유 배치를 갖는 유일한 배치다.** stack/group 은 순서가 규칙에서 나오므로
   pin 을 개별로 옮길 수 없다. group 에서는 Layout Edit 이 대신 **group 순서 재정렬**을 준다.
   즉 Layout Edit 이 무엇을 편집하게 하느냐가 배치마다 다르다 — 이건 아직 미해결 문제다(아래 OPEN).
5. **event 축은 전역 우선순위를 깨뜨린다.** urgency 축은 bucket 이 단조라 평탄화 순서가
   전역 P1/P2 순서와 정확히 같지만, event 축은 같지 않다. 테스트가 이 차이를 명시적으로 고정해 둔다.

---

## 테스트 결과

실행: `npx playwright test` (headless chromium, 1 worker)

```
60 passed (21.6s)
```

- `tests/pins.spec.js` 36건 — 누락 없음 / 접힘 / 우선순위 / 스크롤
- `tests/layout-edit.spec.js` 6건 — drag 잠금·해제·재잠금 / ambient
- `tests/measure.spec.js` 18건 — 측정 + 스크린샷

| 항목 | 결과 |
|---|---|
| 3 / 8 / 20 fixture 가 세 배치 모두에서 DOM pin 수 == fixture 수 | **PASS** (9 케이스) |
| 접은 상태에서도 DOM pin 수 == fixture 수, group 건수 합 == fixture 수 | **PASS** (6 케이스, 두 축 x 세 fixture) |
| 접힌 group 요약에 모든 pin 제목이 남아 있음 | **PASS** |
| collapse → expand 왕복 후 pin 집합 동일 | **PASS** (6 케이스) |
| 개별 group 접기: 그 group 만 접히고 총 수 유지 | **PASS** |
| 평상시 drag **불가능** (좌표 불변 + `data-draggable="false"` + `draggable="false"`) | **PASS** (f8, f20) |
| Layout Edit 안에서 drag **가능** (이동량이 커서 이동량과 일치) | **PASS** (f8 +160/+120, f20 +100/+60) |
| Layout Edit 을 나가면 배치는 남고 다시 잠긴다 | **PASS** |
| group 재정렬도 Layout Edit 밖에서는 불가, 안에서는 가능 (group·pin 유실 없음) | **PASS** |
| 우선순위 순서가 손으로 적은 기대값과 정확히 일치 | **PASS** (3 fixture x 3 배치 = 9 케이스) |
| urgency group 순서 `overdue→today→week→month→later`, 건수 `[3,2,5,7,3]` | **PASS** |
| event group 순서가 P3(최우선 pin 기준)과 일치 | **PASS** |
| independent 자동 배치 좌표도 우선순위 순으로 흐름 | **PASS** |
| 20건은 세 배치 모두 스크롤 발생, 스크롤해도 총 수 20 | **PASS** |
| 3건은 세 배치 모두 스크롤 없음 | **PASS** |
| ambient: 평상시 opacity < 1, Layout Edit 시 1.0 | **PASS** |
| 실패 | **없음 (0 failed)** |

### 도중에 실제로 잡힌 실패 (구현을 고쳤다, 테스트를 낮추지 않았다)
- `Layout Edit 을 나가면 …` 최초 실행 FAIL: 빠져나갈 때 pin 이 세로로 23px 튀었다.
  원인은 Layout Edit 안내문이 `display:none ↔ block` 이라 surface 머리 높이가 변한 것.
  → 안내문이 항상 자리를 차지하도록(`visibility`) **CSS 를 고쳤다**. 상태 전환 시 커서 밑에서
  요소가 움직이지 않는다.
- `Ambient …` 최초 실행 FAIL: opacity transition 중간값(0.62)을 읽었다.
  → 단언을 느슨하게 하지 않고 `expect.poll` 로 **전이 종료 후의 최종값**을 확인하게 고쳤다.

### NOT TESTED
- 1440x900 외 해상도 / DPI. 열 수는 rail 너비에서 계산되지만 다른 폭에서는 재보지 않았다.
- 키보드 조작, 접근성(스크린리더), 포커스 순서.
- 20건보다 많은 경우(100건 등). 상한은 걸지 않았으나 성능/가독성을 재지 않았다.
- 실제 Windows 데스크톱 위 상주 동작(투명 창, always-on-top, 다른 창과의 간섭).
- 터치/펜 입력. drag 는 mouse 이벤트로만 구현·검증했다.
- 진짜 날짜 계산. `days` 는 fixture 에 고정 정수로 박아 두었다.

### NOT APPLICABLE
- 영속성/복구/이력(MUST 11) — spike 범위 밖이고 저장소를 쓰지 않는다.

---

## OPEN (제품 판단이 필요해 구현하지 않음)

1. **Layout Edit 이 배치마다 다른 것을 편집한다.** independent 에서는 pin 좌표를,
   group 에서는 group 순서를 편집하고, stack 에서는 편집할 것이 없다.
   하나의 "Layout Edit" 상태가 이렇게 다른 의미를 가져도 되는지는 제품 결정이다.
2. **두 배치를 오갈 때 사용자가 옮긴 좌표를 어떻게 할 것인가.** 지금은 좌표를 메모리에 들고 있다가
   independent 로 돌아오면 되살린다. 유지가 맞는지, 버리는 게 맞는지 정하지 않았다.
3. **접힘 요약 한 줄에 제목이 다 안 들어가는 경우.** 7건짜리 group 에서 뒤쪽 제목이 시각적으로
   잘린다(텍스트는 DOM 에 전부 있고 테스트로 확인됨). 두 줄 허용 / 폭 확대 / 다른 접힘 형태 중
   무엇이 맞는지는 제품 판단이다.
4. **group 축을 사용자가 고르는가, 제품이 정하는가.** urgency 와 event 를 둘 다 만들어 재봤을 뿐
   어느 쪽이 기본인지 정하지 않았다.
5. **"기한 지남" pin 이 영원히 맨 위를 차지하는가.** P1 상 음수가 항상 최우선이라
   방치된 항목이 계속 좁은 자리를 먹는다. 만료/보관 규칙이 필요한지는 제품 결정이다.
6. **surface 크기 760x560 은 임의로 고른 값이다.** 위 표의 "한 화면에 몇 건" 수치는 전부 이 크기에
   종속된다. 실제 상주 창 크기가 정해지면 다시 재야 한다.

---

## 스크린샷 (`screenshots/`, 전부 테스트가 실제로 찍은 것)

`f{3,8,20}-{free,stack,grouped}.png` · `f{3,8,20}-grouped-collapsed.png` ·
`f{3,8,20}-grouped-event.png` · `f20-free-edit-{off,on,relocked}.png` ·
`f20-grouped-edit-{off,on}.png` · `f8-ambient-at-rest.png` · `f8-ambient-on-intent.png`
