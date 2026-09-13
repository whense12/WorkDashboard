# 직거래 일정관리 프로토타입 (Phase 1)

React 18 + TypeScript + Fluent UI React v9. 브라우저에서 돌아간다. 창 동작(always-on-bottom ㆍ click-through ㆍ 트레이)은 이 환경에서 만들 수도 검증할 수도 없어 **없다**.

## 실행

```
pnpm install
pnpm dev                 # http://127.0.0.1:5173
pnpm build               # tsc --noEmit + vite build
pnpm test                # vitest 골든(expandPlan ㆍ 날짜 ㆍ 표기)
pnpm e2e                 # Playwright(F1~F5 ㆍ 레이어 ㆍ 키보드 ㆍ 복원 ㆍ CSV)
node scripts/shots.mjs   # 화면 촬영(라이트 ㆍ 다크 ㆍ 회색조) → scratchpad
```

## 결과표 (PASS / FAIL / 미검증(Linux 작성))

| 항목 | 결과 | 근거 |
|---|---|---|
| `tsc --noEmit` (strict, noUnused*) | PASS | 오류 0 |
| `vite build` | PASS | JS 665 kB(코드 분할 안 함) |
| vitest 골든 19건 | PASS | `tests/unit/expandPlan.test.ts` |
| Playwright 17건 | PASS | `tests/e2e/flows.spec.ts`, 14초 |
| `goseong-official-doc/scripts/style_check.py` (copy.ts 문장 125개) | 실행함 ㆍ 지적 0 | 기계로 잡히는 위반이 없다는 뜻이지 문장이 좋다는 뜻은 아님 |
| 렌더 서체 | 잠정 | 맑은 고딕 ㆍ HY헤드라인M ㆍ 휴먼명조 없음. 이 환경의 대체 렌더: 나눔고딕(본문) ㆍ 나눔명조(❖ㆍ❍ 명조) ㆍ 제목 서체 HY헤드라인M은 대체 없음(스택의 다음 서체). 조판 판단은 Windows 실측 전까지 보류 |
| Windows 창 동작 7종(spike §검증) | 미검증(Linux 작성) | 인계 체크리스트 |
| 한글 IME 실기 | 미검증 | e2e는 keyCode 229 합성 이벤트로만 검사 |
| Ctrl+2 | 미검증 | 브라우저가 탭 전환으로 가로챔. 트레이 명령으로 대체 검사 |
| CSV 한글 파일명 | 미검증 | 헤드리스 Chromium이 `download`로 바꿈(ASCII는 정상). 내용ㆍ가운뎃점(U+00B7)은 검사함 |
| 125/150% DPI ㆍ 1920×1080 ㆍ forced-colors | 미검증 | 촬영 안 함 |

## 화면 (`results/`)

| 파일 | 내용 |
|---|---|
| light-00-widget | Layer 0. 320×110. 다음 운영일 ㆍ 행사 ㆍ 몇 곳 ㆍ 회신. 버튼 0 |
| light-01-today | Layer 1. 결론형 제목. 확인ㆍ연락 필요 / 나머지 / 날짜와 무관한 충돌 |
| light-02-matrix | Layer 2 기간표. 부서 양식(제목 이중선 ㆍ ❖ 요약 상자 ㆍ 기  간/장  소 ㆍ 머리행 #D9D9D9) |
| light-03-month | 월간. 이름 안 숨김(+N 없음). 짧은 이름 + 2행 |
| light-04-week | 주간. 누가 오는가가 축 |
| light-05-inspector-vendor | Layer 3. 동명 경고 ㆍ 연락처 가림 ㆍ 계획 요약 ㆍ 참가일 |
| light-06-day-exception | F4. 계획 필드 없음. 계획과 같으면 저장 비활성 |
| light-07-plan-edit | F3. diff 두 열. 의미 잃은 예외 유지/삭제 전 저장 불가 |
| light-08-quick-add | F1. 해석 문장 동기 |
| light-09-vendor-register | F2. 동명 인라인 경고 + 기존 업체 열기 ㆍ 참가일 미리보기 |
| light-10-restore | F5. 고르기만 해서는 불변 ㆍ 바뀌는 양 ㆍ 보관 후 복원 |
| light-11-matrix-E3 | 연말 경계(12월→1월) ㆍ 업체 2곳 |
| light-12-matrix-grayscale | 회색조. ■ □ ─ 와 예외 칸 테두리는 구분됨. 선택 행 배경은 거의 사라짐 |
| dark-01, dark-02 | 다크. 양식 회색은 CSS 변수로 갈아끼움 |

## 슬롭 체크리스트 23항 (doctrine.md) — "예"면 실패

FAIL ㆍ 판정불가만 적는다. 나머지는 PASS이며 근거는 화면 파일.

| # | 판정 | 내용 |
|---|---|---|
| 6 | 부분 FAIL | 상태 5종은 형태(■ □ ─ + 테두리)로 구분됨. 기간표 **선택 행**은 배경 tint뿐이라 회색조에서 거의 사라짐(light-12). 키보드 포커스 링은 남음 |
| 7 | 보류 | 인스펙터 행사 화면의 업체 목록 26개가 전부 링크 파랑. 액센트 과다인지 사용자 판단 |
| 9 | FAIL(문자 그대로) | 위젯ㆍ표면 배경이 순백 `oklch(1 0 0)`. government 프로필(GOV.UK 순백)을 따른 결과. 항목 9와 충돌 → 결정 필요 |
| 13 | PASS(이번 커밋) | 11/13/15px 전부 제거. 선택 탭 굵기 400으로 내려 뷰당 Bold 2(문서 제목 ㆍ 인스펙터 제목) |
| 18 | 판정불가 | 기간표 빈 상태 문구는 있으나 픽스처에 업체 0 행사가 없어 렌더 안 됨 |
| 23 | PASS | brand ramp 잉크블루(hue 250) 별도 정의. Bahnschrift 없음 |

## 산출물 자기검사 (doctrine.md 사용성)

| 항목 | 판정 |
|---|---|
| 계획 편집 ↔ 하루만 변경 진입점 분리, 제목ㆍ버튼이 범위를 말함 | PASS (e2e F3ㆍF4) |
| 되돌릴 수 없는 변경에 preview + 영향 수, 되돌릴 수 있는 변경에 확인 대화상자 없음 | PASS (F3 diff ㆍ F5 바뀌는 양 ㆍ 셀 회신 토글은 즉시+undo) |
| 모든 변경에 undo | PASS (토스트 8초 ㆍ Ctrl+Z ㆍ 복원 취소). 이력의 '이 값으로 되돌리기'는 **없음** |
| 잘못된 값 입력 불가 ㆍ 비활성 옆 사유 | PASS (요일 0개 → 버튼 눌리고 사유+포커스, 저장 불가 사유 표시) |
| 키보드만으로 위젯→…→대화상자 도달ㆍ복귀, Esc 한 단계씩, 포커스 복귀 | PASS (e2e). 셀→대화상자→셀 포커스 복귀는 dispatch 시점 기록으로 구현 |
| IME Enter 1회 = 1건 | 합성 이벤트만 PASS ㆍ 실기 미검증 |
| 빈/로딩/오류/충돌 상태 | 오늘 빈 상태(다음 3건) ㆍ 복원 로딩 ㆍ 충돌 3종 있음. **오류 상태(DB 잠김) 렌더 없음** |
| 상태 어휘 고정 | **바꿈** → 아래 결정 1 |
| 첫 사용 가이드 ㆍ 초성 검색 ㆍ 팔레트 | **없음** |
| 클릭통과 ON 안내 | 트레이 버튼 라벨(클릭 통과 끄기)만. 첫 실행 가이드 없음 |
| DPI ㆍ 고대비 4종 | 미검증 |
| 회색조 | light-12 ㆍ 위 항목 6 |
| 경계 픽스처 | 18자+ 3곳 ㆍ 동명 2곳 ㆍ 7건(확인 3) ㆍ 25곳 이상 날(9. 26. 22곳 + 계획 3건 겹침) ㆍ 고아 예외 ㆍ 겹친 계획 ㆍ 요일 0개 ㆍ 연말 경계 |

## 결정이 필요한 것 (사용자)

1. **상태 어휘.** 헌법 §6은 5어휘(확정 / 확인 필요 / 이 날짜만 변경 / 불참ㆍ취소 / 연결됨). 이 화면은 참가 / 회신 없음 / 그날만 나옴 / 그날만 빠짐 (업체) + 확정 / 확인 필요 / 처리함 (일정).
   - A. 헌법대로 되돌림 — 기각 사유: '확정'이 업체 참가와 사무 일정에 겹쳐 두 뜻이 됨. '연결됨'은 화면에 쓸 자리가 없었음.
   - B. 화면 어휘 채택 + 정오표로 §6 개정 — 제안. 부서 확인표의 □(미확인)와 대응됨.
   - C. 둘 다 두고 툴팁으로 잇기 — 기각: 어휘 수만 늘어남.
2. **순백 배경.** government 프로필 순백 vs 슬롭 항목 9. A. 순백 유지(제안: 부서 문서와 같은 흰 종이) / B. `oklch(0.985 0.002 260)`로 한 단 내림.
3. **달력 셀 짧은 이름.** 법인격 접두어ㆍ접미어를 뗀 이름(하이면친환경, 마암표고농장)을 월간ㆍ주간에만 씀. 운영표ㆍ인스펙터ㆍCSV는 정식 명칭. A. 유지(제안) / B. 정식 명칭 2행(주 높이 증가) / C. 말줄임 — 기각: 이름 숨김(spec §3).
4. **날짜 입력.** 네이티브 date input: 잘못된 날짜 입력 불가, 표시 형식은 OS 로캘(한국어 Windows면 `2026. 09. 12.`, 이 환경은 `09/12/2026`). A. 유지(오류 방지 우선, 제안) / B. 부서 표기 텍스트 입력 + 파서 — 기각: 오타 경로 생김.

## 없는 것 (만들지 않았고 있다고 쓰지 않는다)

검색 ㆍ 명령 팔레트 ㆍ 행사 등록(F6) ㆍ 위젯 방향키 이동(F7: 편집 모드 표시만) ㆍ 첨부 '위치 찾기' 동작 ㆍ 이력 되돌리기 ㆍ DB 오류 상태 ㆍ 첫 실행 가이드 ㆍ Windows 창 동작 전부 ㆍ 가상 스크롤.

## 구조

```
src/domain/     types ㆍ date ㆍ format(규정 §7⑤ 표기 ㆍ shortName) ㆍ expandPlan ㆍ derived ㆍ store(undo/redo ㆍ AuditLog)
src/fixtures/   sample-data(업체 28 ㆍ 행사 3 ㆍ 계획 32 ㆍ 예외 7 ㆍ 일정 33 ㆍ 첨부 20 ㆍ 이력 100 ㆍ 보관본 3)
src/theme.ts    Fluent 테마: radius 0 ㆍ shadow 없음 ㆍ duration 50~120ms ㆍ 맑은 고딕 스택 ㆍ 400/700
src/app/        context(레이어 ㆍ 선택 ㆍ 대화상자 ㆍ 단축키 ㆍ 포커스 복귀) ㆍ copy(문구 사전) ㆍ styles ㆍ Widget ㆍ Today ㆍ Workspace ㆍ Inspector ㆍ views/ ㆍ dialogs/
tests/unit ㆍ tests/e2e ㆍ scripts/shots.mjs ㆍ results/
```
