# SPIKE C — Object Lens

`Calendar Sheet → Object Lens → Focus Surface` 구간을, **연 곳(origin)을 잃지 않는 detail 열기**가
실제로 가능한지 측정하기 위한 프로토타입이다.
**이것은 설계 확정이 아니라 측정 결과다.** 아래의 OPTION 은 제품 결정이 아니다.

실행: `npm install` → `npx playwright test` (headless chromium, webServer 는 `node server.js`, port 5183)

---

## 1. 무엇을 만들었나

| 파일 | 내용 |
|---|---|
| `index.html` / `styles.css` / `app.js` / `fixtures.js` | 프로토타입 (plain HTML/CSS/vanilla JS, 프레임워크·번들러·CDN 없음) |
| `server.js` | 의존성 없는 정적 서버 |
| `tests/lens.spec.js` | 요구 동작 검증 15개 |
| `tests/measure.spec.js` | 비교 옵션 계측 12개 → `measurements.json` |
| `screenshots/` | 테스트가 실제로 만든 PNG 14장 |

### surface 구성
- **Calendar Sheet** — 2026년 9월 월 그리드. 업체명·행사명·일정명을 **문자 그대로** 노출한다
  (`+N`·숫자·점으로 대체하지 않음 / KERNEL NEVER 3). 상태(확정·보류·불참·예정·진행·완료)와
  첨부 존재표시를 셀 안에서 바로 읽는다.
- **Work Track** — Calendar 아래의 두 번째 surface. 모든 객체의 업무/절차를 예정·진행·완료로
  가로질러 본다 (MUST 7, EXPERIENCE 3: 제품이 Calendar-only 가 아니다).
  이 행(row)도 Lens 의 origin 이 될 수 있다.
- **Object Lens** — lens 종류는 정확히 **3가지**: `vendor` / `event` / `general schedule`.
  origin 옆에 잠깐 떠 있는 overlay 이고, **고정된 우측 inspector 가 아니다** (KERNEL NEVER 2).
  쉴 때는 DOM 에 존재하지 않는다.
- **Focus Surface** — lens 에서 들어가고 lens 로 돌아온다. 업무/절차 전체, 연결(행사·업체·파일 존재표시),
  변경 이력, 그리고 **전체 참가계획 수정**(날짜예외는 보존)이 여기에 있다.

### KERNEL 대응
- NEVER 2 — 상시 우측 inspector 없음. 쉴 때 lens 0개, scrim 숨김, `main` 오른쪽에 고정 패널 없음. (테스트로 확인)
- NEVER 3 — 셀에 업체명 문자열. (테스트로 확인)
- EXPERIENCE 3 — Work Track 이 Calendar 밖의 두 번째 surface.
- MUST 7 — lens 에 `완료 n · 진행 n · 예정 n` 즉시 표시, Work Track 과 Focus Surface 에 전체 목록.
- MUST 8 — 첨부 **존재만** 표시 (`첨부3`, `5건 · 폴더 2 · 압축 1 · 문서 2`). 파일 처리는 만들지 않았다.
- MUST 3/4 — lens 의 상태 변경은 `범위: 이 날짜만`, Focus Surface 의 `전체 참가계획` 변경은 날짜예외를 건드리지 않는다.

---

## 2. OPTION (결정 아님)

### OPTION A — lens 위치
- **A1 `origin 앵커`** : origin 오른쪽/왼쪽/아래/위 4개 후보 중, origin 가림(가중치 8)과
  다른 sheet 항목 가림(가중치 1)의 합이 최소인 곳.
- **A2 `화면중앙 + tether`** : 화면 중앙에 띄우고 origin 까지 점선으로 연결.

### OPTION B — lens 중첩 규칙 (프로토타입 기본값은 O2 이지만 **기본값 ≠ 결정**)
- **O1 `교체`** : 두 번째 lens 가 첫 번째를 닫고 그 origin 표시를 해제한다.
- **O2 `스택(깊이 상한 2)`** : 두 번째는 쌓인다. **세 번째는 스택 맨 위를 교체**하므로 깊이는 2를 넘지 않는다.
  맨 위를 닫으면 아래 lens 로 focus 가 돌아간다. 두 origin 모두 표시를 유지한다.
- **O3 `거부`** : 두 번째 lens 를 열지 않고 안내만 띄운다. 첫 lens 가 focus 를 유지한다.

세 규칙 모두 코드에 있고, 셋 다 테스트로 단언했다 (`#overlap-rule` 로 전환).

---

## 3. 측정 결과 (실측, `measurements.json`)

### origin 생존 / 읽기 비용 — viewport 1360×900

| 옵션 | lens 종류 | origin 가려진 면적 | origin 화면 안 | 즉시 보이는 사실 | 추가 클릭 | 가려진 다른 항목 | 시선 이동 | 열림 |
|---|---|---|---|---|---|---|---|---|
| A1 앵커 | vendor | **0 px²** | true | 8 | 0 | 4 / 35 | 216 px | 25.1 ms |
| A1 앵커 | event | **0 px²** | true | 6 | 0 | 3 / 35 | 186 px | 28.0 ms |
| A1 앵커 | schedule | **0 px²** | true | 6 | 0 | 1 / 35 | 208 px | 22.9 ms |
| A1 앵커 | work track row | **0 px²** | true | 8 | 0 | 0 / 35 | 763 px | 27.8 ms |
| A2 중앙 | vendor | 0 px² | true | 8 | 0 | 6 / 35 | 437 px | 27.9 ms |
| A2 중앙 | event | 0 px² | true | 6 | 0 | 5 / 35 | 432 px | 27.2 ms |
| A2 중앙 | schedule | **5,107 px²** | true | 6 | 0 | 4 / 35 | 114 px | 23.0 ms |
| A2 중앙 | work track row | **11,868 px²** | true | 8 | 0 | 0 / 35 | 50 px | 29.2 ms |

측정에서 나온 것:
1. **A1 은 4/4 경우에서 origin 을 한 픽셀도 가리지 않았다.** A2 는 4개 중 2개에서 origin 을 덮었다
   (origin 이 화면 중앙에 가까울수록 자기 lens 에 덮인다). "연 곳을 잃지 않는다"는 목표에 대해
   두 옵션은 동등하지 않다.
2. 대신 **A2 는 시선 이동이 짧고 위치가 예측 가능**하다(중앙 고정). A1 은 origin 위치에 따라
   116~763 px 로 흔들린다.
3. 어느 옵션이든 **핵심 사실은 추가 클릭 0회**에 6~8개가 이미 떠 있다.
4. 열림 지연은 22.9~29.2 ms 로 옵션 간 차이가 없다 (측정 오차 범위).
5. 공통 비용: **lens 는 origin 이 아닌 다른 달력 항목을 가린다.** 전체 origin 17곳을 훑은 결과
   최악은 `s-budget@2026-09-11` 로 다른 35개 항목 중 **4개**를 절반 이상 덮었다.
   origin 은 절대 안 가리지만 sheet 의 다른 부분은 가린다 — 이건 남은 문제다 (아래 OPEN).

### 중첩 규칙

| 규칙 | 두 번째 열었을 때 lens 수 | origin 표시 유지 | 두 객체 동시 표시 | 아래 lens 가려짐 | 두 객체 비교 클릭 수 | origin 가려짐 |
|---|---|---|---|---|---|---|
| O1 교체 | 1 | 1 | 아니오 | 0 % | 2 | 0 px² |
| O2 스택(≤2) | 2 | 2 | 예 | **27 %** | 2 | 0 px² |
| O3 거부 | 1 | 1 | 아니오 | 0 % | 3 (먼저 닫아야 함) | 0 px² |

측정에서 나온 것: O2 만 두 객체를 동시에 읽을 수 있고 origin 두 개를 모두 유지한다.
다만 아래쪽 lens 의 27 % 가 위쪽 lens 에 덮인다(투명도 55 %로 후퇴시킨 상태). O3 는 비교에 클릭이 1회 더 든다.
**어느 것도 여기서 채택하지 않는다.**

---

## 4. PASS / FAIL / NOT TESTED

실행: `npx playwright test` → **27 passed, 0 failed** (chromium headless, 10.6 s).

| 요구 | 결과 | 근거 |
|---|---|---|
| lens 를 열어도 origin 을 잃지 않는다 (보이고, origin 으로 표시됨) | **PASS** | `lens.spec.js` `originStaysIntact` — 화면 안 + lens 와 겹침 0 px², 3개 lens 종류 + track row |
| 닫으면 origin 으로 focus 복귀 | **PASS** | `closing the lens returns focus to the origin` (`toBeFocused`) |
| 추가 클릭 없이 핵심 사실 확인 | **PASS** | lens 마다 `.lens-facts dd` 6~8개 모두 visible, 상태·업무·첨부 포함 |
| lens 안에서 상태 변경 → 달력 즉시 반영 | **PASS** | vendor 확정→보류→불참, schedule 진행→완료. lens 가 열린 채 `data-status` 변경 확인 |
| 첨부/업무 존재 표시 | **PASS** | 셀·lens·Focus Surface 세 곳. 파일 처리는 만들지 않음 |
| Focus Surface 진입·복귀 | **PASS** | lens → Focus → `Lens 로 돌아가기` → 같은 객체 lens, origin 유지 |
| 중첩 규칙 정의 및 검증 | **PASS** | O1/O2/O3 셋 다 단언 |
| MUST 4 (날짜 수정 vs 전체 계획 수정 구별) | **PASS** | 전체 계획 변경 후 09-19 불참 / 09-26 보류 예외 보존 |
| KERNEL NEVER 2 (상시 우측 inspector 없음) | **PASS** | 쉴 때 lens 0개, `main` 오른쪽 고정 패널 없음 |
| KERNEL NEVER 3 (업체명 문자 노출) | **PASS** | `+N` 없음 |
| MUST 7 (미래·현재·완료) | **PASS** | Work Track 필터 + Focus Surface 목록 |
| 여러 뷰포트/실제 Windows 데스크톱 | **NOT TESTED** | 1360×900 chromium 한 조합만 측정 |
| 키보드 전용 경로, 스크린리더 | **NOT TESTED** | Esc·focus 복귀만 있음. tab 순서·aria 검증 안 함 |
| 데이터가 많을 때(한 셀 5개 이상, 수백 객체) 동작 | **NOT TESTED** | fixture 는 17개 항목뿐 |
| 성능 (열림 지연) 의 실기기 값 | **NOT TESTED** | headless 측정값 22.9~29.2 ms 는 참고용 |
| Ambient / Quick 구간 | **NOT APPLICABLE** | 이 spike 범위 밖 |

### 수정한 실제 결함 (테스트가 잡아냄)
1. 전체화면 scrim 이 포인터를 가로채서 **lens 가 열린 동안 달력을 클릭할 수 없었다.**
   → scrim 을 `pointer-events:none` 으로 바꾸고 바깥 클릭은 document 리스너로 처리. 이게 없으면
   "중첩 규칙" 자체가 성립하지 않는다.
2. lens 배치가 origin 만 피하고 **다른 달력 항목은 덮어서** 그 아래 항목을 클릭할 수 없었다.
   → 배치 점수에 다른 항목 가림을 추가(가중치 1, origin 은 8). 완전히 없어지지는 않았다(위 5번).
3. Focus Surface 를 닫을 때 자기 자신을 지운 버튼의 클릭이 바깥 클릭으로 판정되어 lens 까지 닫혔다.
   → 분리된 노드 검사 + `stopPropagation`.

---

## 5. OPEN (결정하지 않음)

1. **OPTION A/B 중 무엇을 쓸지 정하지 않았다.** A1 이 origin 보존 면에서 측정상 낫지만
   위치 예측 가능성은 A2 가 낫다. 제품 판단이 필요하다.
2. **lens 가 다른 달력 항목을 가리는 문제** (최악 4/35). 남은 선택지: lens 폭을 줄인다 / 밀도가 낮은
   주(week) 쪽으로 밀어낸다 / sheet 를 부드럽게 스크롤한다 / 가려지는 것을 받아들인다.
   무엇이 맞는지는 측정만으로 결정되지 않는다.
3. **스택 깊이 상한 2는 임의값이다.** 1(=교체)과 3 이상을 비교 측정하지 않았다.
   상한 초과 시 "맨 위 교체"가 맞는지 "맨 아래 폐기"가 맞는지도 미정.
4. 한 셀에 항목이 많을 때 lens origin 표시를 어떻게 유지할지 (현재는 셀 단위가 아니라 항목 단위).
5. Work Track 이 Calendar 밑에 있는 가로 strip 인 것은 NEVER 2 를 피하려는 이번 프로토타입의
   구현 선택이다. **이것을 영구 제품규칙으로 올리지 않는다.**
6. lens 안의 상태 변경 범위가 항상 "이 날짜만"인 것이 맞는지 (현재 Focus Surface 에서만 전체 계획 변경 가능).
