# 직거래 일정관리 명세·스킬 검토 보고

- 일자: 2026-09-09
- 대상: `docs/spec/spec_v2.md`(명세 v2, 649행) · `docs/spec/design_tokens_v0.1.json`(79행) · `docs/spec/tauri_spike_order.md`(발주서, 294행) · 서드파티 스킬 2종(anti-slop-design, open-codesign — 저장소 밖 보관, `docs/review/sources.md` 참조)
- 작성: Claude(이 저장소의 실행 세션). 검토 환경: Linux 컨테이너(Windows 없음, webkit2gtk 없음) — **Windows 창 동작 실기 검증 0건**.
- 표기: `[확인]` 문서·1차 출처에서 직접 확인 / `[추정]` 맥락 추론 / `[훈련지식]` / `[미확인]` / `[정정]` / `[폐기: …]` / `[사용자 결정]` / `[Claude 제안]`
- 인용 규약: 명세는 `docs/spec/spec_v2.md:행`, 발주서는 `docs/spec/tauri_spike_order.md:행`, 토큰은 `docs/spec/design_tokens_v0.1.json:행`, 스킬은 `<skill>/<path>:행`. 서드파티 스킬은 구절 단위로만 인용한다(MIT 고지 의무·공공기관 저장소 어조 기준).
- 정제 고지: 스킬 원문의 비속어·외국어 은어·비업무 어조 선언은 재수록하지 않고 서술로 대체했다(§3-C F26).

---

## 0. 요약

### 0-1. 결론 5개

1. **명세 v2는 착수 가능하다. 그러나 "화면이 아니라 기능이 틀릴" 공백이 먼저다.** `[확인]` 원칙·레이어·데이터 모델 골격·검증 매트릭스는 정합하지만, 이 제품의 유일한 파생 엔진(참가계획+예외 → 날짜별 참가)의 골든 케이스(G5-0), 날짜 타입·시간대(G5-1), weekdays 인코딩·주 시작(G5-2), 불변식(G5-3), status enum(F19), "확인 필요/오늘 일정" 산식(F18/F22)이 전부 미정의다. 이것을 정오표(Phase 0)로 먼저 닫지 않으면 시안이 임의 규칙 위에 그려지고 구현이 그 규칙을 굳힌다. 사용자 1순위(오류·시행착오 없는 사용)와 직결.
2. **두 스킬은 규칙으로 설치하면 안 된다.** `[확인]` 둘 다 스크롤 웹 마케팅 페이지 생성기이며, 설치 시 자동 발동해 명세 §2 금지 패턴을 **통과 조건으로 강제**한다(스킬 결함·충돌 26건, §3-C). 그러나 사용자 의도(학습·차별화)대로 **"왜"는 이전된다**: 79 원리·74 슬롭 징후·41 지렛대를 증류해 사용성 우선 독트린 v0.2(231줄)를 얻었다(§8-2). 차별화의 원천은 장식이 아니라 조판(tabular 숫자·굵기 배급·정렬축·한글 규약)과 상태의 형태 부호화이며, 이는 오독 방지와 같은 방향이다.
3. **명세 밖의 미지가 넷 드러났다.** `[확인: 외부 1차 출처]` (a) always-on-bottom은 Win+D/바탕 화면 보기/Aero Peek에서 살아남지 않는다 — Win32 작업(WorkerW 재부모화 등) 필요, Phase 4 게이트의 실질 판정 항목(F17/G1-1); (b) 발주서에 Tauri 권한(capabilities) 명세가 0건이라 click-through·always-on-bottom 호출이 ACL 거부로 조용히 실패해 창 동작 실패와 구별되지 않는다(G0-0); (c) 배포 전제(WebView2 런타임·코드서명·per-user 설치·망분리)가 문서에 없어 Phase 7에서 플랫폼이 뒤집힐 수 있다(G4-0~4); (d) 개인정보(업체 연락처가 AuditLog 원문에 무기한, 행위자 없음, DB·백업 위치 미정, 마스킹 없음) — 공공기관 감사 지적 가능(G3-0~4).
4. **한글 서체가 미정의였다 → 사용자 결정으로 닫혔다.** `[확인]` Fluent UI v9 기본 스택·Segoe UI에 한글 글리프가 없고, 두 스킬의 서체 규칙도 전부 라틴 전용, 토큰 v0.1에 타이포 항목 자체가 없다(F01/F21/G1-0/G2-0). `[사용자 결정 4]` 공무원 서식 기반 → UI 서체 = **맑은 고딕(시스템)**, 굵기 400/700. Linux 시안 렌더에는 대체 서체를 쓰되 커밋하지 않고 font-guard로 실기 서체명을 기록한다(§2).
5. **실행 구조가 확정됐다.** `[사용자 결정 1~4]` 실행 주체=Claude 단독, 범위=Phase 0+1, 검증=동작 프로토타입+Playwright 시뮬레이션, 서체=맑은 고딕. 설계안 3개 심사(§8-1)는 세 안이 모두 "스킬 미설치·원본 미커밋·증류"로 일치했고, 합성안(2의 순서 + 0의 리스크 레지스터·ADR·정오표 번호 + 1의 구체 파일 계획·정적 검사)을 채택했다. 규범 우선순위는 `ADR-0002-precedence.md`, 스킬 처리는 `ADR-0001-skill-policy.md`에 고정한다.

### 0-2. 조하리/럼즈펠드 분류

| 구분 | 내용 |
|---|---|
| **명시(사용자가 말한 것)** | 검토 요청; 기존 git 프로젝트 폐기; 스킬 제출 의도(학습·차별화); 사용성 최우선·독창성 2순위; 결정 4건(실행 주체·범위·검증·서체). `[확인: 사용자 발화]` |
| **맥락 추론** `[추정]` | 사용자=고성군 농식품유통과 실무자(세션의 다른 스킬에서 추론); 제품=직거래장터 참가업체 일정 관리; 단일 PC·단일 사용자; 관공서 PC(망분리·보안 SW·관리자 권한 없음 가능). "Codex"=OpenAI Codex, "Work"=이 세션, "Astra"=미상 → 결정 1로 용어 자체 폐기. |
| **관성으로 답할 뻔한 것** `[폐기]` | "스킬 설치 + 무효화 목록"(의도 확인 전 프레임) → 증류로 전환. "발견당 검증 에이전트 2개" → 배치 검증. "시각 시안부터" → 기능 정확성 정오표(Phase 0)를 시안 앞에 둠. "정적 HTML 시안" → 동작 프로토타입(결정 3). "Codex 발주서" → 자기 작업 계획(결정 1). |
| **이번에 드러난 미지** | Win+D 생존; Tauri ACL; skipTaskbar 미해결 이슈(tauri#10422); decorations:false+shadow:false 타이틀바 잔존(tauri#14859); WebView2 한글 조합 중 포커스 이탈 크래시(WebView2Feedback #5475); window-state의 모니터 미저장; Fluent 기본 스택의 한글 부재; 맑은 고딕에 Semibold 없음; anti-slop 허브의 존재하지 않는 도메인 라우팅; tauri-plugin-sql의 SQLCipher 미지원; MIT 고지 의무. |
| **여전히 모르는 것** `[미확인]` | Windows 실기 동작 전부; 대상 PC 환경(버전·DPI·관리자 권한·인터넷·보안 SW·WebView2 유무); 운영 규모·공유 PC 여부; 공휴일/인쇄 요구의 실제 수요. |

---

## 1. 검토 대상·방법

### 1-1. 대상
| 구분 | 파일 | 규모 | 비고 |
|---|---|---|---|
| 문서 | spec_v2.md | 12,375 B / 649행 | 명세 v2. 원본 무수정 반입 `[확인: sha256 일치]` |
| 문서 | design_tokens_v0.1.json | 1,565 B / 79행 | 최상위 키 9개, typography 없음 |
| 문서 | tauri_spike_order.md | 5,445 B / 294행 | Codex 발주서 → 결정 1로 '자기 작업 계획'으로 전환 예정 |
| 스킬 | anti-slop-design | 74파일 / 834,444 B | MIT © 2026 Cuuper22. 표준 frontmatter(자동 발동 가능) |
| 스킬 | open-codesign | 27파일 / 179,762 B | MIT © 2026 shenmian. 비표준 frontmatter(제어 필드 무시됨) |

### 1-2. 방법
- **워크플로 1(검토)**: 탐색 6(spec 내부 일관성 / anti-slop / open-codesign / 프로세스 적합성 / 플랫폼 외부 사실 / Claude Code 스킬 메커니즘) → 중복 제거 → 배치 검증(인용 전수 재확인, 과장 정정) → 완전성 비평 → 추가 탐색 6영역(Tauri ACL·CSP / Windows 동작 주장 근거 승격 / 라이선스·서체·아이콘 / 개인정보·저장 / 배포 전제 / 날짜 계산·시간대) → 검증 → 설계안 3(RISK-FIRST / MVP-FIRST / USER-FIRST).
- **워크플로 2(증류)**: 학습 3(원리 79·슬롭 징후 74·지렛대 41 코퍼스) → 독트린 초안 4(사용성 엔지니어·타이포그래퍼·Windows 플랫폼·앰비언트 UX) → 심사·합성.
- 에이전트 합계 38. 발견 69건 전부 검증 통과(폐기 0건), 문구 정정 7건·등급 조정 2건·반박 확인 1건(§4).
- **세션 한도**: 설계안 3개의 최종 심사 에이전트가 실패해 **Claude가 직접 채점**했다(§8-1, `[Claude 판정]`).
- 근거 등급: `evidence-confidence` confirmed/estimated/unverified × `source_type` explicit_in_docs/inferred_from_context/training_knowledge/external_verified. 외부 사실은 에이전트 WebFetch(2026-09-09) 기준이며, 검증 단계에서 재조회하지 않은 항목은 `unverified`로 남겼다(§5).

---

## 2. 사용자 결정 4건과 그 영향 `[확인: 사용자 발화]`

| # | 결정 | 영향 |
|---|---|---|
| 1 | 실행 주체: **"너가 다해라"** | 설계·문서·구현·테스트 전부 이 세션. Codex 발주 없음. spec §15(:613-634) 역할 분담은 "단일 실행자: Claude"로 개정(F35 해소), Work/Codex/Astra 용어 폐기. 발주서는 자기 작업 계획(`tauri_spike_order_v2.md`)으로 전환. F25(Codex 측 자동 발동 위험)는 대상 자체가 사라져 종결. |
| 2 | 착수 범위: **"시안까지"** | 이번 승인 = Phase 0(헌법·정오표·독트린·스킬) + Phase 1(시안). Phase 2 이후는 별도 승인. |
| 3 | 검증 수단: **"니가 빌드, 실제 기능별, 업무 시뮬레이션까지 다해라"** | 시안은 정적 그림이 아니라 브라우저에서 **동작하는 프로토타입**(Vite+React+Fluent v9, 외부 CDN 0, in-memory mock bridge). 기능별·업무 시나리오별 자동 시뮬레이션(Playwright, 사전 설치 Chromium)을 Claude가 돌려 결과표를 남긴다. **Windows 창 동작(always-on-bottom·click-through·Win+D·트레이·DPI 실기·IME 실기)은 이 환경에서 원리적으로 불가** → Phase 3에서 다룬다. DPI 배율은 `deviceScaleFactor` 100/125/150/175% 렌더 확인까지만 가능. `[폐기: 정적 HTML 3안 — 결정 3을 충족 못 하고 Phase 5에서 버려짐]` |
| 4 | 한글 서체: **"공무원 서식 기반"** | 부서 보고서 양식(제목 HY헤드라인M·본문 휴먼명조·2단/요약 맑은 고딕·추진부서 굴림)에서 **화면 UI 서체 = 맑은 고딕(시스템)**. HY헤드라인M·휴먼명조·굴림은 한컴 동봉 인쇄용·재배포 불가 → UI 미사용, Phase 6 인쇄/보고 뷰에서만 설치 시 선택 `[Claude 제안]`. 맑은 고딕은 Regular/Bold/Semilight만 있어 `[훈련지식]` 독트린의 600 슬롯은 700(Bold 실체)으로 매핑, 뷰당 Bold ≤2. Linux 시안 렌더는 대체 서체(fonts-nanum 또는 @fontsource/noto-sans-kr, OFL)로 하고 font-guard가 "실기=맑은 고딕" 배너를 띄우며, 대체 서체는 커밋하지 않는다. `[폐기: Pretendard 동봉(G2-3 권고) — 결정 4와 상충, 번들 1~2MB·OFL 고지 추가]` |

추가 지시 3건: ① "git에 저장된 기존 프로젝트 전부 폐기" → 이 저장소는 초기 커밋(README 1줄)뿐이라 폐기할 코드 없음, 그린필드. 다른 저장소를 뜻한다면 범위 밖 `[수리 질문 대상]`. ② 스킬 제출 이유 = 디자인 감각적 노하우의 **학습** + AI 산출물 획일성에서의 **차별화** → 스킬은 "설치할 규칙"이 아니라 "증류할 교재". ③ **우선순위 정정**: 독창성 2순위, 오류·시행착오 없이 기능을 쓰게 하는 UI/UX가 최우선 → 모든 산출물을 사용성 우선으로 재정렬.

---

## 3. 발견 69건

등급 = materiality(blocking / important / minor), 중요도 = severity/유형(high·medium·low / gap·defect·contradiction·risk·fact·reusable). "→ 정오표"는 `docs/spec/spec_v2_errata.md`의 A-번호 항목으로 연결된다(잠정 번호는 부록 A).

### 3-A. 명세 공백 — 기능 정확성 (19건)

**G5-0 — 참가일 전개 순수 함수의 골든 케이스·수용 기준이 전 문서에 없음** · blocking · high/gap · `[확인]`
근거: spec_v2.md:330-334("참가계획이 원본 / 날짜별 참가 여부는 계산"), :527("실제 참가일 preview"), :533("영향 받는 날짜 preview")는 기대 출력을 정의하지 않음; §13(:553-561)은 수량·DPI만 있고 날짜 경계 케이스 0건; §15 Codex에 "test"(:625) 한 단어; 세 문서에 vitest|golden|date-fns 0건. 월간·주간·기간표·인스펙터·위젯 카운트가 모두 이 함수를 공유한다.
조치: → 정오표. §12에 순수 함수 `expandPlan(plan, exceptions, range) → 로컬날짜[]`를 명시하고 Phase 5 완료 조건에 골든 9케이스(월 경계·단일일·빈 weekdays·요일 밖 include·요일 안 exclude·중첩 계획·end<start·range 겹침 3종·고아 Exception)를 표로 고정. `docs/spec/golden-expand-plan.md` + vitest.

**G5-1 — 날짜/시각 필드의 저장 타입·시간대 기준 미정(KST 자정 하루 밀림)** · blocking · high/risk · `[확인]`
근거: spec_v2.md:270-271, :289-291, :297, :304-305, :319, :323 — 전 시간 필드 타입 없음; 종일 날짜(start_date/end_date/Exception.date)와 시각(starts_at/due_at, 발주서:53 "14:00")이 구분 없이 혼재; UTC|timezone|epoch 0건. 상주 프로세스가 자정을 넘기는 것이 기본 상황(spec:492-493 sleep/resume·Explorer restart) `[정정: 발견 원문의 ':502' 인용은 오기, 실제 :492-493]`.
조치: → 정오표. 종일 날짜 = `TEXT 'YYYY-MM-DD'` 로컬(Asia/Seoul) 문자열 비교; 시각 = `INTEGER` UTC epoch ms, 표시 시점에만 로컬 변환; '오늘'은 자정 타이머 + resume 시 재계산.

**G5-2 — weekdays[] 인코딩·주 시작 요일 미정(Fluent compat 기본 일요일·영어)** · important · high/gap · `[확인]` (Fluent 기본값은 `[미확인: 에이전트 조회, 검증 단계 미재조회]`)
근거: spec_v2.md:291 "weekdays[]", :104-106 주간·기간표, :127·:526 "요일"만 출현, '월요일'·'일요일' 0건. Fluent v9 Calendar/DatePicker는 compat 패키지이며 `firstDayOfWeek` 기본 Sunday.
조치: → 정오표. ISO 1=월…7=일 오름차순 JSON 정수 배열 TEXT 저장; 주 시작 `[사용자 결정: 기본값 제안 월요일]`; `firstDayOfWeek`·ko-KR strings를 앱 전역 단일 상수에서 주입.

**G5-3 — "기존 Exception 충돌" 정의·데이터 불변식 없음** · important · medium/risk · `[확인]`
근거: spec_v2.md:534 "기존 Exception 충돌 표시" 요구; :285-292 ParticipationPlan에 (event_id, vendor_id) 유일·중첩 제약 없음; :294-299 Exception에 (plan_id, date) 유일·범위 제약 없음; :59가 금지한 모호함이 데이터 층에서 재발.
조치: → 정오표. ① end_date ≥ start_date ② (event, vendor) 기간 중첩 금지 ③ Exception > weekdays ④ 기간 밖 Exception은 저장 허용·전개 무시·'고아' 표시 ⑤ (plan, date) 유일 — 골든 케이스 ⑥⑦⑨와 통합.

**G5-4 — 한국어 날짜·시간 표기 규칙이 발주서 예시 한 줄뿐** · important · medium/gap · `[확인]`
근거: tauri_spike_order.md:51 "9월 24일 목 확인 1"(320px 한 줄), :53 "14:00"; spec_v2.md:471 320×110, :474-477, :141; 토큰에 typography·date_format 없음; Intl|locale|ko-KR 0건.
조치: → 정오표 + 토큰 v0.2 `date_format`: 위젯 `M월 d일 (E)`, 셀 `d`, 기간표 `d(E)`, 인스펙터 `yyyy년 M월 d일 (E)`, `HH:mm` 24시간제, `Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul'})`, 같은 해 기간은 연도 생략.

**F18 — Layer 0 "확인 필요 개수" 산출 규칙 부재** · important · high/gap · `[확인]`
근거: spec_v2.md:73, :94, :477; tauri_spike_order.md:45, :122(seed "확인 필요 1건" — 스파이크 한정); design_tokens_v0.1.json:59-65 semantic_states 5종이 어떤 (엔티티, status, 날짜조건)에도 매핑되지 않음. 위젯에 표시되는 숫자 두 개 중 하나의 정의가 없다.
조치: → 정오표 + `docs/spec/state-map.md`. §7 뒤 "파생 지표 정의" 절: 5상태 각각을 불린식으로, "확인 필요" = 합집합 카운트. `[사용자 결정: 무엇이 확인 필요를 만드는가 — 기본값 제안: Task.status=needs_confirmation ∪ 계획 밖 고아 Exception ∪ 계획 중첩 충돌(오늘 기준)]`

**F19 — status enum·전이 규칙 없음** · important · high/gap · `[확인]`
근거: spec_v2.md:273, :282, :292, :309 각 "- status" 필드명만; 유일하게 값이 열거된 필드는 :298 `type(include/exclude)`; tauri_spike_order.md:114-118 동일. Phase 2 state map(:581)·Phase 5 schema(:593)가 의존.
조치: → 정오표. 엔티티별 값 목록 리터럴(예: Event planned/active/done/cancelled, Plan draft/confirmed/changed/cancelled, Task open/needs_confirmation/done/cancelled) + semantic_states 1:1 표 `[Claude 제안]`.

**F22 — "오늘 일정 개수"의 대상 불명(Task가 3개념 겸함, category 값 없음)** · important · high/gap · `[확인]`
근거: spec_v2.md:72; :301-310 Task(category 값 없음); :129 "당일 업무", :136 "행사별 업무", :140-144 "일반 일정"이 모두 Task; :112 semantic marker 구분 요구. 업체 25곳 참가일에 3인지 28인지 결정 불가.
조치: → 정오표. "오늘 일정 = 오늘 starts_at Task + 오늘 유효 참가(예외 반영) 건수" 산식 + Task.category 리터럴(office/vendor_day/event_task). 위젯 일정 표시 건수 `[사용자 결정: 기본값 제안 1건]`.

**F20 — 월간 뷰 오버플로 정책 부재** · important · high/contradiction · `[확인]` `[정정: "물리적 불가"는 과장 — 한 주 행은 들어가고 그리드 전체가 넘침]`
근거: spec_v2.md:108-111(셀에 업체명 직접 표시·주 높이 증가·이름 숨김 금지), :54(+N more 금지), :556(하루 25곳), :557(18자), :563(1366×768); 완화 조항 :117(20~30곳이면 기간표 보조)은 전환 조건이 없음.
조치: → 정오표. ≤8곳 1열 → 9~16곳 셀 내 2열 → 17곳↑ 주 행 성장 + "이 주를 기간표로" 제안 배너. 프로토타입에서 8/12/17/25곳 자동 검증.

**F21 / G1-0 — 토큰에 타이포·색·한글 서체 전무** · important · high/gap · `[확인]` `[정정: F21의 "Segoe UI Variable 선택" 전제는 문서에 없음 — 결함은 미지정 그 자체(G1-0 재정식화)]`
근거: design_tokens_v0.1.json 최상위 키 9개(version/principles/spacing/radius/motion_ms/surfaces/semantic_states/icon_policy/layout_modes), font·type·hex 0건; spec_v2.md:43(typography로 밀도 해결), :203, :379-386(Surface 이름만); 세 문서에 segoe|malgun|font-family|서체 0건. Microsoft 문서: Segoe UI Variable은 Latin/Greek/Cyrillic, 한국어 UI 서체는 Malgun Gothic `[확인: learn.microsoft.com]`.
조치: → 토큰 v0.2 typography 블록(스택 `"Malgun Gothic","맑은 고딕","Segoe UI Variable Text","Segoe UI",sans-serif`, 램프 anchor 28/36·700 / title 20/28·700 / body 14/20·400 / caption 12/16·400 / micro 11/14 라틴·숫자 전용, tabular 전역, accent 후보 3, status 5색+형태, surface, density default, reduced_motion, date_format) + `ADR-0003-typography`. `[사용자 결정 4 반영]`

**F23 / G0-1 — 첨부 저장 정책(복사 vs 링크)·저장 루트·opener scope 미정, 복원 범위에 첨부 누락** · important · high/risk · `[확인]`
근거: spec_v2.md:15(§0이 Storage를 정의 대상으로 선언), :312-319 Attachment(file_path 기준 없음), :543-548 복원(DB만 상정), :559 첨부 20개; §16(:638-649)에 Storage 항목 없음; APPDATA|scope|경로 0건. opener는 scope 미지정 시 임의 경로 열기로 수렴.
조치: → 정오표. 루트 `$APPDATA/<id>/attachments/<owner_type>/<yyyy>/<uuid>.<ext>` 고정, 상대경로만 저장, 복사 고정, `opener:allow-open-path` scope를 그 루트로 한정, fs 광역 권한 미부여; §12 복원에 "첨부 포함 여부·누락 첨부 목록 preview".

**F32 — settings/레이아웃 영속화 모델이 §7에 없음** · important · medium/contradiction · `[확인]`
근거: tauri_spike_order.md:108-112 settings(key,value), :130-137 저장 항목 6개; spec_v2.md:265-329 §7에 settings/app_state 없음; :242-248 §6.2 저장 형태 없음; :194-195 Default/Reset layout은 이름뿐.
조치: → 정오표. §7에 settings(key, value) 정식 추가 + 키 표(widget_bounds, monitor_id, scale_factor, mode, click_through, workspace_layout_json, density)와 기본값.

**F34 — 공휴일 처리·Task 반복 규칙 부재** · important · medium/gap · `[추정: 운영 방식은 문서에 없음]`
근거: spec_v2.md:285-292, :294-299(Exception이 plan 단위라 행사 자체 휴장일 표현 불가), :301-310(반복 필드 없음); 공휴일|휴일|recurrence 0건. 데이터 원천(오프라인 번들 vs 공공데이터 API)도 미정.
조치: → 정오표 `[사용자 결정: v2 범위 — 기본값 제안: 범위 밖, 후보(holiday 테이블 + Plan.skip_holidays, 오프라인 N년치 JSON)만 기록]`.

**F36 — 인쇄/내보내기 요구 없음(§4-C "출력/보고"만)** · important · medium/gap · `[추정: 수요는 문서 밖]`
근거: spec_v2.md:207-210 유일 언급; 인쇄|print|내보내기|export 0건; §12·§14에 없음. 스킬 측 보완 불가(anti-slop pdf-print.md는 라틴 세리프 전제, 한글 0건).
조치: → 정오표 `[사용자 결정: 기본값 제안 — v2는 기간표 CSV만, A4 인쇄는 Phase 6]`.

**F35 — §15 Work / Codex / Astra 미정의** · important · medium/gap · `[확인]`
근거: spec_v2.md:613-634; Astra는 :631 단 1회; §0~§14에 정의 없음.
조치: → 정오표. `[사용자 결정 1]`로 종결: "단일 실행자: Claude(이 저장소의 세션). Codex·Astra 불사용."

**F37 — §16 미완료 2건의 성격 상이(Phase 1 즉시 가능 / Phase 3 이 환경 불가)** · important · medium/fact · `[확인]`
근거: spec_v2.md:640, :649 미완; :641-648 완료; tauri_spike_order.md:291-294(미검증 항목 구분 허용). Phase 1 선결 = F20·F21.
조치: → 정오표. §16을 "지금 가능"/"Windows 필요"로 분리, Phase 1 선결 항목 명시. README 상태표 "Windows 실기 검증 0건".

**F38 — density 기본값 자기모순·reduced-motion 토큰 누락** · important · medium/contradiction · `[확인]`
근거: spec_v2.md:403-407("두 가지 제공… 중간 수준"), design_tokens_v0.1.json:9-12 2값 배열·default 없음; spec:401 reduced-motion 요구 vs 토큰 motion_ms(:33-50) 4키만.
조치: → 정오표 + 토큰 v0.2: `density: {compact, normal, default: normal}`(20곳↑ compact 제안 `[Claude 제안]`), `motion_ms.reduced_motion: 0`(opacity-only 정책 병기).

null 파생(§6, v3 보강 후보): 행사(Event) 등록 흐름(§12에 없음, :524는 행사 존재 전제), 백업 형식·주기·세대, 종일 플래그, 다중 사용자, 고대비·다크 테마, 알림, 스키마 버전, Plan⊂Event 제약, "1~2건"(:74) vs "1건"(발주서:46), 기간표 임계 20~30(:117) vs 스트레스 40(:554), 검색 요구 부재. → 정오표(A-30 이후 잠정).

### 3-B. 보안·개인정보·배포·라이선스·Windows 플랫폼 (23건)

#### B-1. Tauri 권한·CSP·SQL (5건)

**G0-0 — 발주서 §4 명령 전부에 permission identifier 없음 → ACL 거부가 창 동작 실패로 위장** · blocking · high/defect · `[확인: 문서]` `[미확인: core:window:default 구성은 에이전트 조회, 검증 단계 미재조회]`
근거: tauri_spike_order.md:249 `capabilities/` 디렉터리명 1회가 전부, permission|scope|csp 0건; :63-66, :85-96 명령 목록; Tauri ACL 문서상 `core:window:default`는 read-only 명령만 포함하고 `allow-set-ignore-cursor-events`·`allow-set-always-on-bottom`·`allow-set-position`·`allow-start-dragging`은 별도 권한. 거부 증상이 §9 FAIL(:219-220)과 구별되지 않아 Phase 4 게이트가 Tauri를 오탈락시킬 수 있다.
조치: → 정오표(발주서 v2). 명령↔permission 매핑표; 창 상태 전이는 Rust command로 감싸고 프런트에는 core:default + 앱 command만 노출(그 경우 setter 권한 불필요). `[정정: 앱 command도 manifest에 선언하면 allow-<cmd> 필요; global-shortcut:default는 빈 세트라 allow-register 등 열거 필요]`

**G0-2 — sql:default에 allow-execute 없음; 열면 렌더러 임의 SQL** · important · high/risk · `[확인: 문서]` `[미확인: 기본 권한 세트]`
근거: tauri_spike_order.md:22, :57, :106-126; spec_v2.md:489 "SQLite read/write"; AuditLog(:321-329)·복원(:543-549) 신뢰성이 프런트 SQL 경로로 무너짐. `[정정: 발주서 §9 AC 9(:215)는 읽기만 요구하므로 스파이크 자체는 select로도 PASS 가능 — 제목의 "그대로는 실패"는 seed 삽입을 프런트에서 할 때만 성립]`
조치: → 정오표(발주서 v2). 프런트에 sql: 권한 0; SQLite 접근은 `src-tauri/src/storage/` Rust command만; SQL 문자열은 Rust 안에.

**G0-3 — CSP 0건(미설정 시 보호 없음)** · important · medium/gap · `[확인: 문서]` `[미확인: Tauri 동작은 에이전트 조회]`
근거: 세 문서·두 스킬 전체 csp|content-security 0건; anti-slop-design/references/desktop.md:116-118은 ACL만 언급; 발주서 §12 산출물 9개(:279-289)에 보안 설정 없음. 인스펙터(spec:119-147)는 사용자 입력 한글로 가득 → XSS 1건이 capability 전체로 확대.
조치: → 정오표(발주서 v2). `app.security.csp` 기본값(default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' asset: http://asset.localhost; connect-src 'self' ipc: http://ipc.localhost; font-src 'self'; object-src 'none'; frame-src 'none') 명시, dev 완화는 devUrl 전용.

**G0-4 — §9 AC·§12 산출물에 ACL 검증 항목 없음(AC 10 "콘솔 오류 없음"과 충돌)** · important · medium/defect · `[확인]`
근거: tauri_spike_order.md:204-216(AC 10 "JS/Rust console에 반복 오류 없음"), :279-289(capabilities 전문 없음), :291-294(미검증 구분 원칙). try/catch로 삼키면 권한 문제가 창 동작 문제로 위장.
조치: → 정오표(발주서 v2). 산출물 10 "capabilities/*.json 전문 + 매핑표", PASS 11 "ACL 거부('not allowed') 로그 0건·catch 은폐 없음".

**G3-3 — tauri-plugin-sql SQLCipher 미지원인데 §10이 'SQLite'를 장점으로만 기재** · minor · medium/risk · `[미확인: 플러그인 능력은 에이전트 조회]`
근거: spec_v2.md:413-425(장점 "- SQLite"), :15; tauri_spike_order.md:22, :29("공식 plugin 우선"); 암호|encrypt 0건. `[정정: 연락처는 법정 암호화 의무 항목이 아니고 스파이크 DB는 seed 수준이라 교체 비용 작음 — "미룰수록 비싸진다"는 과장]`
조치: → ADR-0006(Phase 4 게이트) 병렬 조건: 암호화 전략 (a) BitLocker/EFS 위임 vs (b) rusqlite+bundled-sqlcipher 택일.

#### B-2. 저장 위치·개인정보 (4건)

**G3-0 — DB·백업 파일의 위치·권한·평문 여부 미정(§0이 정의 대상으로 선언했음에도)** · important · high/gap · `[확인]`
근거: spec_v2.md:15, :543-547(복원 UX만), :602; tauri_spike_order.md:106-118(스키마만); 위치|경로|APPDATA|백업|권한 히트 중 :15·:544 외 전부 창 위치; 개인정보|암호|PII|SQLCipher 0건; :280 contact_phone, :316 file_path.
조치: → 정오표. `%LOCALAPPDATA%\<id>\app.db` 고정(로밍·공유폴더 금지), 백업 경로·보존 수·주기, 사용자 전용 ACL, 인수인계 삭제 목록, §16 체크박스. `[사용자 결정: 기본값 제안 — LOCALAPPDATA 사용자 전용]`

**G3-1 — AuditLog가 연락처 원문을 무기한 보관, 파기·연쇄 규칙 없음** · important · high/risk · `[확인]` `[정정: "보존한다고 정한 것"이 아니라 "정의하지 않음"; Vendor 삭제 기능 자체도 명세에 없음]`
근거: spec_v2.md:276-283(contact_name/phone), :321-328(previous_value/new_value), :560(이력 100건), :131(인스펙터에 이력 상시 노출); 파기|보존|retention 0건.
조치: → 정오표. 개인정보 필드는 마스킹값(`010-****-1234`) 또는 '변경됨' 플래그만 저장, Vendor 삭제 시 연쇄 파기(널링), 보존기간 `[사용자 결정: 기본값 제안 3년]`.

**G3-2 — AuditLog에 행위자 없음(공용 PC·인수인계)** · important · medium/defect · `[확인]` `[정정: "법적 요건 미충족" 단정은 과장 — 안전성 확보조치 기준 제8조는 개인정보처리시스템 대상이라 로컬 단일 사용자 앱 적용 여부는 해석 여지]`
근거: spec_v2.md:321-328(actor 없음); user|계정|로그인|actor 0건; 복원(:543-547) 판단 근거 약화.
조치: → 정오표. `actor` 필드(OS 계정명 자동 취득) 1줄 규정. 법적 의무가 아니라 인수인계·책임 추적 요구로 기술.

**G3-4 — 연락처 마스킹·자리비움 규칙 없음** · minor · medium/gap · `[확인]` `[정정: Layer 0 표시 목록(:70-74)에 연락처가 원래 없고 Layer 1 "연락 필요"(:94)는 상태 라벨 — 실질 갭은 Layer 3 기본 마스킹과 화면 잠금 처리 둘로 축소; 발주서 인용 :172-176은 :166-171의 오기]`
근거: spec_v2.md:83-88 금지 목록에 개인정보 항목 없음, :122-124 "담당자/연락처" 마스킹 규칙 없음.
조치: → 정오표. Layer 3 기본 마스킹 + 명시적 '보기/복사' 조작 시 원문; Layer 0 금지 목록에 "연락처 등 개인정보" 추가.

#### B-3. 배포 전제·라이선스·시안 환경 (9건)

**G4-0 — WebView2 Runtime 전제 없음(downloadBootstrapper는 인터넷 필요)** · important · high/gap · `[미확인: 설치 모드 옵션은 에이전트 조회]` `[정정: Win11·Edge 탑재 PC는 Evergreen이 이미 있어 "설치 실패 확정"이 아니라 "전제 미기록·미실측"]`
근거: WebView2|인터넷|오프라인 0건; tauri_spike_order.md:281, :291-294; spec_v2.md:604-605; anti-slop desktop.md:107, :124-125는 기술 설명뿐.
조치: → 정오표(발주서 v2) + `docs/risk/deployment-prereqs.md`. 대상 PC 사전 확인표(WebView2 유무·버전), `bundle.windows.webviewInstallMode` 명시(인터넷 가능 downloadBootstrapper / 망분리 offlineInstaller ≈127MB 또는 fixedRuntime).

**G4-1 — 코드서명·SmartScreen 0건, 미서명 autostart 차단 실패 모드 미검증** · important · high/gap · `[미확인: 서명 문서는 에이전트 조회]` `[정정: SmartScreen은 MotW 파일에 주로 발동해 USB·내부망 복사 배포 시 미발동 가능; 실질 위험은 백신·EDR의 미서명 실행·HKCU Run 등록 차단]`
근거: SmartScreen|signtool|NSIS|MSI|updater|백신|방화벽 실질 0건(:27 "Consistent" 오탐 1건); tauri_spike_order.md:180-186 Lifecycle "autostart"(:182 "sign-out/in"은 로그아웃).
조치: → 정오표(발주서 v2). 산출물에 서명 상태(미서명/OV/EV) 기록, Lifecycle에 "보안 SW의 autostart 차단·격리 여부" 대상 PC 실측 항목.

**G4-2 — 설치 권한 모델(per-user NSIS vs perMachine) 미결정** · important · high/risk · `[미확인]` `[정정: Tauri Windows 기본 번들이 NSIS currentUser라 "미결정"보다 "미기록"; tauri-plugin-sql 기본 경로는 AppConfig라 Program Files 쓰기는 명시 오설정 시에만]`
근거: tauri_spike_order.md:279-289(설치 모드·방법 없음); spec_v2.md:15; 설치|LOCALAPPDATA 0건.
조치: → 정오표(발주서 v2). NSIS currentUser 고정 권장 + 데이터 경로 README 명시 + 표준 계정에서 설치→실행→autostart 1회 실측.

**G4-3 — Phase 7 "update" 한 줄은 성립하지 않는 전제(updater는 서명 필수·HTTPS 필요)** · minor · medium/defect · `[미확인]` `[정정: 서명 키·pubkey는 Phase 7 빌드 시점까지만 결정되면 됨 — "지금 정해야" 과장]`
근거: spec_v2.md:604-609; updater|서명 0건.
조치: → 정오표. "업데이트 전달 경로 결정(외부 HTTPS 가능 여부 = 대상 PC 실측)·불가 시 updater 미채택·수동 재배포 + 마이그레이션".

**G4-4 — 플랫폼 게이트에 '배포 가능성' 축 없음** · important · medium/gap · `[추정: 관공서 PC 제약]` `[정정: 위험 항목 인용 행은 :433-435, :446-447, :460-461]`
근거: spec_v2.md:11-15(4계층에 Distribution 없음), :587-590(게이트는 window behavior만); WebView2|runtime|런타임|설치|관리자 히트 :605 1건.
조치: → 정오표. §10 A/B/C에 "런타임 전제 / 설치 권한 / 오프라인 설치" 행, Phase 4 Pass에 "관리자 권한 없이 설치 가능 실측" 병렬 조건(ADR-0006).

**G2-1 — 오프라인 정책 없음 → 스킬의 Google Fonts CDN 지시가 통과** · important · high/risk · `[확인]` `[정정: FULL-SPEC.md:456·:532는 아티팩트 모드(:454-455) 한정; 일반 규칙은 FULL-SPEC:437-439·SKILL.md:308-310·loading-snippet.html:8-9·:21·:87; display=swap이면 첫 프레임 대기가 아니라 스왑 깜빡임]`
근거: spec_v2.md에 오프라인|network|인터넷|CDN 0건(매치 4행은 SQLite); anti-slop-design/assets/fonts/loading-snippet.html:8-9, :21, :87; font-stacks.json:58 google_fonts_url.
조치: → 정오표. "모든 서체·아이콘 자산은 번들, 런타임 외부 요청 0건" 조항 + CSP font-src 'self'. 프로토타입 정적 검사에 외부 URL 0건.

**G2-2 — MIT 고지 계획 없음** · minor · medium/gap · `[확인]` `[정정: 배포물에 실리는 MIT 자산은 Fluent 아이콘뿐, 스킬은 개발 도구; 발췌 블록에 출처 한 줄이면 의무 이행 — "F16 이행 자체가 위반"은 불성립]`
근거: anti-slop-design/LICENSE:1-3, :12-13; open-codesign/LICENSE:1-3; Fluent System Icons LICENSE MIT © 2020 Microsoft Corporation `[확인: 에이전트 WebFetch]`; 세 문서에 라이선스|copyright|고지 0건.
조치: → `THIRD-PARTY-NOTICES.md` + 발췌 조항 머리에 출처·라이선스 표기(ADR-0001).

**G2-3 — Linux 검토 환경에 실기 한글 서체 없음 → 시안 조판 측정이 Windows와 어긋남** · important · medium/risk · `[확인: 컨테이너 실측]` `[정정: 발견이 전제한 "배포 대상 서체(맑은 고딕/Pretendard)"는 문서에 없었음 → 사용자 결정 4로 맑은 고딕 확정]`
근거: `fc-list :lang=ko` = Unifont 3·WenQuanYi 3뿐(총 59); spec_v2.md:369-373(이름으로 식별)·:557(18자)의 성립이 실제 렌더 폭에 의존.
조치: → Phase 1 방법. `[폐기: Pretendard woff2 동봉]` → fonts-nanum(OFL) 로컬 설치 또는 @fontsource/noto-sans-kr로 렌더, font-guard가 렌더 서체명을 화면·결과표에 기록, 조판 승인은 Windows 열람 후(ADR-0005 대기).

**G2-4 — 반박: §8 아이콘 이름 실재·MIT 재배포 가능** · minor · low/fact · `[확인: 에이전트 WebFetch(upstream assets/)]` `[미확인: npm export 식별자·크기 조합]`
근거: spec_v2.md:341, :344-345, :349-361; upstream assets/Tasks App, Panel Right Expand, Calendar People, Reorder 실재. `[정정: "Panel Right Expand/Contract"는 2종이라 19항목=20자산]`
조치: → 발주서 v2: 19항목(20자산)을 `@fluentui/react-icons`에서 한 파일에 import하는 스모크 1회.

#### B-4. Windows 창 동작 — 플랫폼 리스크 레지스터로 이관 (5건)

**F17 / G1-1 — Win+D·바탕 화면 보기·Aero Peek 검증 항목 부재** · blocking · high/gap · `[확인: 외부 1차 출처]` **상향** `[정정: "함께 최소화"가 아니라 "상승한 바탕화면에 가려짐(해제 시 복귀)"; 대응책(WorkerW 재부모화)은 spec:81 '클릭하면 Layer 1'과 충돌 가능해 검증 항목만 추가하고 선택은 스파이크 이후]`
근거: spec_v2.md:479-496 필수 검증 17항목·tauri_spike_order.md:206-223 AC에 Win+D|바탕화면 보기|Aero|Peek|WorkerW 0건; spec:68 "평상시 바탕화면에 존재", :77. 외부: Show Desktop은 바탕화면을 최상단으로 올림(Raymond Chen), tao PR #522의 HWND_BOTTOM은 "bottom most 보장 없음", MS Q&A 2127546, tauri-plugin-wallpaper README(WorkerW·WM_WINDOWPOSCHANGING 차단·TaskbarCreated 재부착).
조치: → 정오표(spec §11 항목 18, 발주서 §9 FAIL) + `ADR-0004-widget-placement-3variants`(always_on_bottom 단독 / WorkerW 부모화 / 최소화-즉시복원 비교표) + `docs/risk/windows-platform-risk-register.md`.

**G1-3 — 진짜 한글 입력 리스크는 WebView2의 미해결 한글 IME 버그, 검증 목록에 '한글 입력' 항목 없음** · important · medium/risk · `[미확인: WebView2Feedback #5475/#5637/#5625 — WebFetch 미허용, 2건은 지식 컷오프 이후]` `[정정: "실사용 첫날 크래시"는 재현 조건 미확인 상태의 추정]`
근거: spec_v2.md:95(Quick Add), :482(click-through 토글), :494("한글"은 한/글 앱과의 focus 간섭); tauri_spike_order.md:167("한글"=동시 실행 앱), :173, :72-74.
조치: → 정오표(spec §11 항목 19): "두벌식 조합 중 click-through 토글·단축키·창 비활성으로 포커스를 뺏었다 되돌릴 때 조합 손실·중복·크래시 없음" — 스파이크에 입력 필드 1개 한정. 프로토타입에서 `isComposing` 이벤트 시뮬레이션은 가능하나 WebView2 실기는 불가.

**F33 — 한글 IME 입력 검증 없음(no-activate 창 전제)** · important → **조건부(WPF fallback 채택 시에만)** · medium/risk · `[훈련지식]` **하향**
근거: tauri_spike_order.md:63-68, :70-75; spec_v2.md:518, :502; IME|입력기 0건. 그러나 입력은 Activated(focus 가능) 이후이며 no-activate는 :442 WPF 장점 목록에만 등장(G1-2).
조치: → 리스크 레지스터 조건부 항목. 본 항목의 실질은 G1-3으로 대체.

**G1-2 — F33 등급 부당: no-activate IME 주장은 근거 0건, 대상 플랫폼 오인(WPF)** · important · medium/defect · `[확인]`
근거: spec_v2.md:437-442; tauri_spike_order.md:67, :74; 두 스킬에 IME 실질 0건(FULL-SPEC.md:33 "RUNTIME ENVIRONMENT" 부분 문자열 오탐); WebView2Feedback·tauri 이슈 검색 0건(2회); WM_IME_STARTCOMPOSITION 문서에 '포커스 창에만' 문구 없음.
조치: → 리뷰 자체 정정(§4). 판정 근거란에 "문서 근거 0건 / 이슈 검색 0건" 명시.

**(연계) 발주서 외부 검증 보강 항목** · `[확인: 외부]` — skipTaskbar 미해결(tauri#10422), decorations:false+shadow:false 타이틀바 잔존(tauri#14859), window-state는 모니터 미저장(`StateFlags::POSITION`만 + 경계 가드), single-instance는 첫 `.plugin()`, tray는 `features=["tray-icon"]`, 전역 핫키 선착순(Win+ 제외, 실패 UX 필요), WebView2 성능 공개 수치 없음(실측만). → 발주서 v2 + 리스크 레지스터.

### 3-C. 두 스킬의 결함·충돌 (26건 — 설치 시 자동 적용되므로 전부 material)

#### C-1. 한글·플랫폼 공백(스킬 공통)

| ID | 등급 / 중요도 | 제목 | 핵심 근거 | 조치 |
|---|---|---|---|---|
| F01 / G2-0 | blocking / high·gap `[확인]` `[정정: modern-reset의 break-word는 음절 줄바꿈의 "원인"이 아님 — 처방(keep-all)은 맞음]` | 두 스킬 모두 한글/CJK 조판 지식 0, 권장·강제 서체에 한글 글리프 없음 | anti-slop: 루트 grep 한글·CJK 0건, `assets/fonts/font-stacks.json:13-69` 8스택 전부 라틴, government 스택 `domain-tokens/government.json:34-37` 'Noto Sans'(KR 아님)·font-stacks.json:61 "universal language coverage" 오도; `assets/css/modern-reset.css:30-33` overflow-wrap; open-codesign: `prompts/anti-slop.v1.txt:7-9` 라틴 서체, `:20` 65ch, README 다국어 절은 중↔영만 | 서체 규칙 전면 미채택. 독트린 한글 절(맑은 고딕·keep-all·12px 하한·400/700·자간 0·line-height px 고정·65ch 무효). → ADR-0002 무효화 |
| F05 | important / high·contradiction `[확인]` | 위젯 창 개념 0건; desktop.md는 command palette·drag&drop·multi-window·"창을 채워라" 필수 | 두 스킬 always-on-bottom|click-through|skip-taskbar|frameless grep 0; `anti-slop-design/references/desktop.md:64, :168-170, :214-216, :224-226, :241-247`; `open-codesign/prompts/output-rules.v1.txt:16` mobile-first ↔ spec:472, :59, :261, :84-88 | Layer 0는 스킬 적용 제외. 위젯 규칙은 widget-shell 스킬. desktop.md는 `:236-239`(트레이·창 상태 기억)만 참고 |
| G1-4 | important / medium·contradiction `[확인]` | 두 스킬 스스로 "native API를 다루지 않는다" 선언 → Windows 셸 판정 출처 불가 | `anti-slop-design/references/desktop.md:143-146`; Win+D|HWND|taskbar|click-through 0건; 'Tauri' 70건은 전부 스택 비교 | 근거 출처 4등급(스킬/제품문서/1차문서/미검증) 분리, Windows 셸은 리스크 레지스터로 |
| F24 | important / medium·contradiction `[확인]` `[정정: Heroicons·Phosphor도 outline/solid·regular/fill 쌍은 있음 — 문제는 패밀리 혼합; Rule 9는 권고형]` | 아이콘 규칙이 서로 다르고 둘 다 Fluent System Icons와 다름; 스킬에 Fluent 지식 0 | `anti-slop-design/SKILL.md:191-198` Rule 9(Heroicons/Lucide/Phosphor, 존재하지 않는 프로필 필드 참조); `open-codesign/prompts/output-rules.v1.txt:63` inline SVG only; fluent|griffel 0건 ↔ spec:340-347, tokens:66-74 | icon_policy만 유효. `@fluentui/react-icons` 단일 패밀리, 크기별 컷·CSS 축소 금지 |
| F13 | important / high·contradiction `[확인]` | 서체 금지/선호 목록 상호 배타·자기모순(Inter·Lato·Playfair) | `anti-slop-design/assets/fonts/font-stacks.json:2-11` banned ↔ `domain-map.json:46, :328, :515`; `open-codesign/prompts/anti-slop.v1.txt:5`("unless explicitly requested") ↔ `SKILL.md:117`(단서 삭제); Segoe UI는 banned에 없음(null) | 양쪽 목록 폐기, 단일 서체 정책(맑은 고딕) |

#### C-2. anti-slop-design 고유

| ID | 등급 / 중요도 | 제목 | 핵심 근거 | 조치 |
|---|---|---|---|---|
| F02 | important / high·defect `[확인]` | 허브 도메인 목록이 데이터와 불일치; 실재 8개 중 맞는 것 없음 | `SKILL.md:41-50`(saas/editorial/general) vs `domain-map.json` 키(fintech/healthcare/devtools/ecommerce/education/media/government/creative); `SKILL.md:58, :106`; `scripts/validate-skill.sh:359`는 개수만 검사; government=spacious·radius 0px·animation none·750px, devtools=dark-first·bento; compact 프로필 0 | Step 1-2 라우팅 폐기, `design_tokens` v0.2를 고정 프로필로 |
| F09 | blocking / high·defect `[확인]` `[정정: Rule 6 위반은 단일 --radius 토큰 정의 수준]` | Tauri 출발점 템플릿이 36px 타이틀바+220px 사이드바 앱 셸 | `templates/desktop/tauri-app.html:24-25, :28-29, :36, :60, :203-216`; `SKILL.md:349` 라우팅 ↔ spec:471 | 템플릿 채택 금지, `data-tauri-drag-region`(`:66-67`) 사용법만 참고 |
| F10 | blocking / high·contradiction `[확인]` | fluid clamp(vw) 간격·타입, 모션 160/240/360ms ↔ §9 고정 px·100~240ms; 감사 #9가 고정 px를 실패로 규정 | `assets/css/fluid-space-scale.css:12-20`, `fluid-type-scale.css:13`, `motion-tokens.css:11-15, :26`; `SKILL.md:203-204`; `references/anti-patterns.md:360`; `layout-spacing.md:534-535` ↔ spec:388, :397-400 (완화: `anti-patterns.md:292` 80/160ms 도메인 대안) | 세 CSS 미로드, 토큰 고정 px 생성, 감사 #9 waiver |
| F11 | important / high·contradiction `[확인]` `[정정: #8 단독 실패는 통과 가능(3개 초과 시 재작업) — 누적 실패가 현실적]` | Rule 3/12·감사 #8이 비대칭·bento·카드 변주를 통과 조건으로; dashboard.tsx는 금지된 KPI 행 | `SKILL.md:141-145, :223-224`; `references/anti-patterns.md:347-348, :359`; `templates/web/dashboard.tsx:141-143, :257-260`; `SKILL.md:341` ↔ spec:44-46, :52-53 | Rule 3/12·#8 waiver, dashboard.tsx 참조 제외 |
| F12 | important / high·defect `[확인]` | 지시하는 필드·에셋·reduced-motion 소재 다수 부재; 178/178 PASS는 구조 검사 | `SKILL.md:462-463`(shape.borderRadius/motion.level 없음), `:317-319`(spacing/content/icon 없음), `:283-285`(도메인별 color CSS 없음), `:280-281`(motion-tokens.css에 reduced-motion 없음 — 실제 `modern-reset.css:51`); `animation-motion.md:44-45` vs `motion-tokens.css:13`; `SKILL.md:150` 경로 불일치 | 178/178을 품질 근거로 쓰지 않음; reduced-motion 블록은 프로젝트 CSS에 직접 |
| F27 | important / medium·contradiction `[확인]` `[정정: 텍스처 부재 단독 실패 아님 — 실패 항목 1건; GPU 부하는 추론·미검증]` | SVG 텍스처가 감사 #15 통과 조건 ↔ Layer 0 장식 금지·투명 창 합성 | `references/anti-patterns.md:366, :242-244`; `SKILL.md:293-294, :106`; `assets/svg/*` 5종 ↔ spec:84-88, :33 | assets/svg·#15 전면 배제, 표면 구분은 Surface 명도 차만 |
| F28 | important / medium·contradiction `[확인]` | "Headless > pre-styled. Always" ↔ Fluent UI React v9 채택 | `references/web-react.md:44-45, :96-100`(예외 절 `:101`) ↔ spec:428-431, :37-40 (다크모드 `:416-418`은 정합) | 컴포넌트 라이브러리 절 waiver, FluentProvider 커스텀 테마 표준 |
| F26 | important / medium·risk `[확인]` | 문서 어조를 비업무용으로 스스로 선언하고 references/ 13개 파일 약 40곳에 아랍어 비속 감탄사가 삽입되어 있음 `[정정: 발견 원문 "최소 3곳"은 과소]` | `.planning/PROJECT.md:25, :40`, `.planning/STATE.md:22`(어조 선언); `references/desktop.md:9, :93, :122`, `accessibility.md:23, :279, :315`, `animation-motion.md`, `dataviz.md`, `web-landing.md`, `email.md`, `pdf-print.md`, `cli-terminal.md`, `mobile-*.md`, `layout-spacing.md`(삽입 위치) | 원본 미커밋(공공기관 저장소 부적합), 발췌는 재서술만, "산출물 문안 어조는 이 스킬을 따르지 않음"을 CLAUDE.md에 |
| F39 | minor / low·risk `[확인]` `[정정: "저자가 측정한 적 없다"는 공개 eval 부재까지만 입증; 발췌 목록에 desktop.md·tauri-app.html은 포함해야]` | 런타임 불필요 페이로드가 대부분(FULL-SPEC 271KB·.planning·scripts), 데스크톱 eval 0건 | 74파일 834,444B; README:5 배지 67(실제 74); `evals/evals.json` 12건 중 desktop 0 | 스킬 통째 미커밋; 데스크톱 가이드는 미검증 취급 |
| G2-1(스킬 측) | 위 B-3 참조 | Google Fonts CDN preconnect "항상 사용" | `assets/fonts/loading-snippet.html:8-9, :21, :87`; `SKILL.md:308-310` | 미채택 |

#### C-3. open-codesign 고유

| ID | 등급 / 중요도 | 제목 | 핵심 근거 | 조치 |
|---|---|---|---|---|
| F03 | blocking / high·contradiction `[확인]` `[정정: 계측은 발주서 §8(:188·:196); "Never ask which type"은 artifact-type 분류 한정이나 비교 없이 단일 산출물 전달(:3, :18)이라 Phase 1 비교 절차 우회 결론은 유지]` | 'rich' 기본 밀도·KPI 4+·LIVE/맥박/1초 시계·전 요소 hover transform ↔ spec §2·Layer 0 금지·Quiet at rest | `prompts/craft-directives.v1.txt:2, :5, :7, :64-65, :77, :87`; `prompts/artifact-types.v1.txt:21, :27`; `SKILL.md:73` ↔ spec:29, :33, :52, :84-89, :406-407 | craft-directives 채택 금지(`:84, :86, :89`만 발췌); 밀도 하한은 spec §3 Layer 0/1 표시 항목 |
| F06 | important / high·contradiction `[확인]` | "절대 묻지 말라·서술 금지" ↔ anti-slop "모호하면 질문" ↔ 사용자 4분할 프로토콜 | `prompts/workflow.v1.txt:3, :18`; `prompts/craft-directives.v1.txt:5` ↔ `anti-slop-design/SKILL.md:52-54` | 세 줄 무효화; 대화 규약은 사용자 프로토콜 > 모든 스킬(ADR-0002 사다리 3) |
| F04 | important / high·gap `[확인]` | safety.v1이 프로덕션 코드·시스템 명령을 범위 밖 선언 → Phase 3~7 무커버, 오작동 시 리다이렉트 | `prompts/safety.v1.txt:3-4, :15`; `anti-slop-design/.planning/PROJECT.md:27-30` ↔ spec:584-609, :468 | 적용 범위 한정. 결정 1로 Claude가 전 단계 수행 → 해당 조항 무효 |
| F07 | important / high·defect `[확인]` | calendar.jsx가 spec이 3번 금지한 `+N more`·이벤트별 색·80px 고정 셀을 구현, isToday 하드코딩 등 버그 | `design-skills/calendar.jsx:64, :65, :71, :84, :92-94, :103`; `SKILL.md:112` ↔ spec:54-55, :109-111, :373, :556 | 참조 금지 안티예제. 월간 규칙은 F20 정오표 |
| F08 | important / high·contradiction `[확인]` `[정정: `:73` full-bleed는 권고, `:99` scrollY 진행바는 선택지]` | 산출물 계약(자기완결 HTML 1000줄·Tailwind CDN·Google Fonts·mobile-first·ZIP→~/) ↔ 오프라인 Tauri 레포 | `prompts/output-rules.v1.txt:16-17, :20, :56`; `prompts/workflow.v1.txt:18` ↔ spec:56-57, :434; 발주서:230-251 | output-rules 전체·workflow 7단계 미채택; `:30-47` CSS custom properties 개념만 토큰 매핑에 |
| F14 | important / high·defect `[확인]` `[정정: (3) hover 규칙 충돌은 부분 — scale은 :active]` | prompts 내부 자기모순 4건(자기완결 vs 3파일, CDN 화이트리스트, hover, 기본 밀도) | `prompts/output-rules.v1.txt:5-10 ↔ :18`, `:20 ↔ :26`; `prompts/anti-slop.v1.txt:42 ↔ craft-directives.v1.txt:114-115`; `design-methodology.v1.txt:15 ↔ craft-directives.v1.txt:7` | 각 충돌을 한쪽으로 확정해 독트린에 기록(밀도=normal, hover=배경·보더 상태 변화만) |
| F15 | important / high·contradiction `[확인]` | dashboard.jsx가 금지 패턴 세트(4 KPI·좌측 accent bar·SYSTEM ONLINE·라이브 시계)를 시연, Math.random 데이터 | `design-skills/dashboard.jsx:31-36, :49, :51, :54, :60, :77`; `prompts/chart-rendering.v1.txt:18` 자기 규칙 위반 ↔ spec:46, :52-53 | **자동 리젝트 4항목**(ADR-0002): 4열 KPI / 좌측 accent bar / LIVE·시계 / Math.random |
| F25 | important / medium·risk `[확인]` | Codex/ChatGPT 메타데이터 동봉·암묵 호출 허용, 일상 어휘로 자동 발동 | `SKILL.md:12-16`(비표준 키), `:41`(트리거 어휘); `agents/openai.yaml:24-30` 및 `anti-slop-design/agents/openai.yaml:15-21` allow_implicit_invocation ↔ 발주서:275 | Claude Code는 밑줄 키 미인식(§5) → 제어 필드 사망. 결정 1로 Codex 호스트 없음 → 미설치로 종결 |
| F29 | important / medium·gap `[확인]` `[정정: breathe/pulse는 상한 목록이지 의무 아님; hover transform은 의무(`:81`, `:87`)]` | reduced-motion 0건, `:focus-visible`은 README에만 | grep 0건; `prompts/craft-directives.v1.txt:72-80, :81, :87, :88`; `README.md:108, :485` ↔ spec:401, tokens:33-49 | 독트린: reduced-motion 필수 분기, focus-visible 전용 링 |
| F30 | minor / medium·defect `[확인]` | data-table.jsx / chart-svg.jsx 재사용 가치 없음·버그 | `design-skills/data-table.jsx:23, :37-42`(문자열 금액 사전순), `:51`(페이지 간 전체선택); `chart-svg.jsx:38`(고정 id), aria-label|title|legend 0 ↔ `prompts/chart-rendering.v1.txt:20, :26, :29` | 기간표는 CSS Grid + sticky 자체 설계 |
| F31 | important / medium·defect `[확인]` `[정정: "그대로 실행하면 실패"는 개연성 수준]` | README/SKILL 스킬명 불일치, zh/en 설치 경로 상이, CLAUDE.md append 요구 | `README.md:1` vs `SKILL.md:3`; `README.md:203-208`, `:580-585`(`@skill` 지시문 — Claude Code에 없음); `README.md:114` 14종 vs `craft-directives.v1.txt:92-104` 13개 | 설치 절차 실행 금지, CLAUDE.md append 금지 |

### 3-D. 재사용 가치 (1건) — 독트린에 흡수

**F16 — 재사용 조항과 규범 우선순위·무효화 목록을 헌법에 고정** · blocking · high/reusable · `[확인]`
채택(발췌·재서술, 출처·MIT 표기): anti-slop `references/accessibility.md` 전체(forced-colors `:239-241` 시스템 색 `:275-278`, APG Combobox `:50`/Dialog `:73`/Data Grid `:114`/Live Regions `:141`, Color-Only Error `:406`), `references/anti-patterns.md:295-301` reduced-motion 블록·`:362-365` 감사 #11/#12/#14·`:291-292` 도메인별 duration(값은 spec으로 대체), `assets/css/motion-tokens.css:46-47` "NEVER animate width/height…" 규칙(문장만), `references/animation-motion.md:244-245`, `SKILL.md` Rule 2/4/5/7/10/13/14/15의 WHY, OKLCH는 검증 도구로만; open-codesign 7문장 — `prompts/design-methodology.v1.txt:4`(제공된 시스템은 제약이지 제안이 아니다), `anti-slop.v1.txt:22-23, :25, :27`(주 accent 1개), `:10-15`(단계 건너뛰기 금지 — 개념만), `output-rules.v1.txt:50-52, :60-63`(시맨틱 랜드마크·div onclick 금지·실제 콘텐츠), `workflow.v1.txt:17`(WCAG AA), `chart-rendering.v1.txt:26`(색 단독 구분 불가), `craft-directives.v1.txt:84, :86, :89, :111`(≥3 상태 변화·모든 컨트롤 동작·빈/로딩/오류·활성 표시는 색 외 수단). 이 목록이 독트린 v0.2의 코퍼스이며, 부록 A 매핑표가 감사 추적 문서다. → ADR-0001·ADR-0002.

---

## 4. 정정·등급 조정 7건 (및 등급 조정 2건·반박 확인 1건) — plan §2-E

| 대상 | 조정 | 내용 |
|---|---|---|
| F17 | **상향**(training_knowledge → external_verified) | Win+D 미생존이 1차 출처(Raymond Chen, tao PR #522, MS Q&A 2127546, tauri-plugin-wallpaper)로 확증. 문구 "함께 최소화" → "상승한 바탕화면에 가려짐(해제 시 복귀)". |
| F33 | **하향**(blocking → 조건부) | no-activate IME 주장은 문서·이슈 근거 0건, 대상은 WPF 폴백(spec:442). 진짜 리스크는 WebView2 #5475(G1-3)로 대체. |
| F01 | 문구 정정 | `modern-reset.css:32`의 break-word는 한글 음절 줄바꿈의 원인이 아님(브라우저 기본 동작). 처방 keep-all은 유지; 18자+ 업체명 오버플로 시 anywhere 필요. |
| F20 | 문구 정정 | "물리적 불가" → "월간 그리드 전체가 넘침"; spec:117이 기간표 전환을 예고하나 조건 없음. |
| G2-1 | 문구 정정 | Google Fonts CDN 지시는 FULL-SPEC:456·:532가 아티팩트 모드 한정; 일반 규칙은 loading-snippet.html·SKILL.md:308-310; FOUT 서술 정정. |
| G2-2 | 문구 정정 | 배포물에 실리는 MIT는 Fluent 아이콘뿐; 발췌는 출처 한 줄로 의무 이행. |
| G3-1 | 문구 정정 | "보존한다고 정함" → "미정의"; Vendor 삭제 기능도 명세에 없음. |
| G3-2 | 문구 정정 | 법적 요건 단정 삭제 → 인수인계·책임 추적 요구로. |
| G3-4 | 문구 정정 | Layer 0엔 연락처가 원래 없음; 갭은 Layer 3 마스킹·화면 잠금 둘로 축소. |
| G2-4 | 반박 확인 | §8 아이콘 이름 실재·MIT. 19항목=20자산. |

인용 행번호 보정(감사용): G5-1 ':502'→':492-493'; G3-4 발주서 ':172-176'→':166-171'; G4-4 위험 항목 ':431-433/:444-445/:459-460'→':433-435/:446-447/:460-461'; F03 발주서 '§7'→'§8(:188)'; G1-3 발주서 ':168'→':167'; F15 ±1행; F02 'radius {small…}'는 `border_radius`/`shape.--radius-*` 키; F12 `SKILL.md:462` shape.borderRadius는 domain-tokens/*.json에 존재(파일 포인터만 오류); G1-0 토큰 '80줄'→79행.

---

## 5. 외부 검증 사실 — plan §2-F `[확인: 에이전트 WebFetch 2026-09-09; 검증 단계 재조회 여부는 항목별 표기]`

### 5-1. Tauri 2 `[확인]`
- `alwaysOnBottom`/`set_always_on_bottom`, `setIgnoreCursorEvents`(Desktop only, 창 전체 토글 — 부분 통과 불가, hover 감지 별도 수단 필요), `skipTaskbar`(macOS만 미지원), `transparent`+`decorations:false`(private API는 macOS만) — https://docs.rs/tauri-utils/latest/tauri_utils/config/struct.WindowConfig.html , https://v2.tauri.app/reference/javascript/api/namespacewindow/
- 미해결 이슈: skipTaskbar Windows 미동작 https://github.com/tauri-apps/tauri/issues/10422 (WS_EX_TOOLWINDOW 우회도 실패 보고, needs-more-info) `[미확인: 현재 상태 — GitHub MCP는 이 저장소만 허용]`; decorations:false+shadow:false 타이틀바 잔존 https://github.com/tauri-apps/tauri/issues/14859
- 공식 플러그인 window-state / global-shortcut / autostart / single-instance / sql / notification 존재·Windows 지원 https://github.com/tauri-apps/plugins-workspace ; tray는 코어(`features=["tray-icon"]` 필수)
- single-instance는 첫 `.plugin()` https://v2.tauri.app/plugin/single-instance/
- window-state `StateFlags` = SIZE/POSITION/MAXIMIZED/VISIBLE/DECORATIONS/FULLSCREEN, 모니터 플래그 없음 → POSITION만 + 경계 가드 https://docs.rs/tauri-plugin-window-state/latest/tauri_plugin_window_state/struct.StateFlags.html
- 전역 핫키: 선착순, `global-hotkey` `AlreadyRegistered`/`FailedToRegister` https://docs.rs/global-hotkey/latest/global_hotkey/enum.Error.html ; Win+ 조합 제외
- ACL: `core:window:default`는 read-only 명령만, setter는 별도 `allow-*` https://v2.tauri.app/reference/acl/core-permissions/ `[미확인: 검증 단계 미재조회]`; sql:default = close/load/select https://v2.tauri.app/plugin/sql/ `[미확인]`; CSP는 설정해야만 적용 https://v2.tauri.app/security/csp/ `[미확인]`; opener scope https://v2.tauri.app/plugin/opener/ `[미확인]`
- 배포: webviewInstallMode(downloadBootstrapper 기본·인터넷 필요 / offlineInstaller ≈127MB / fixedRuntime), NSIS currentUser 기본 https://v2.tauri.app/distribute/windows-installer/ ; 서명·SmartScreen https://v2.tauri.app/distribute/sign/windows/ ; updater 서명 필수·비활성화 불가 https://v2.tauri.app/plugin/updater/ `[미확인: 세 건 모두 검증 단계 미재조회, 훈련지식과 일치]`

### 5-2. Windows Show Desktop / WorkerW `[확인]` `[추정: Rainmeter 내부 메커니즘 — 1차 출처 403]`
- Show Desktop은 바탕화면을 창 스택 최상단으로 올려 always-on-top 외 창을 가림(Raymond Chen, 'Minimize All vs Show Desktop') `[미확인: URL 미기록]`; tao PR #522 "no guarantee that the window will be the bottom most"; MS Q&A 2127546(HWND_BOTTOM은 Show Desktop 미해결).
- 생존 3안: WorkerW 부모화(explorer 재시작 시 TaskbarCreated 재부착 필수) / `WM_WINDOWPOSCHANGING` 차단 / 최소화 즉시 복원 — https://github.com/meslzy/tauri-plugin-wallpaper ; 대안 플러그인 tauri-plugin-desktop-underlay. Tauri 코어에는 없음.

### 5-3. Fluent UI v9 / Windows 타이포 / 아이콘 `[확인]`
- `@fluentui/react-components` 9.74.7(2026-08-24), Griffel; `fontFamilyBase`에 한글 없음('Segoe UI'… 'sans-serif'), `fontFamilyNumeric`=Bahnschrift(금지 대상) https://github.com/microsoft/fluentui/blob/master/packages/tokens/src/global/fonts.ts
- Segoe UI Variable = Latin/Greek/Cyrillic; 한국어 UI 서체 = Malgun Gothic(Regular만 등재) https://learn.microsoft.com/en-us/windows/apps/design/signature-experiences/typography , https://learn.microsoft.com/en-us/windows/apps/design/style/typography ; Windows 11 최소 14px Semibold / 12px Regular; Fluent 2 CJK 지침 없음(null)
- `@fluentui/react-icons` 2.0.339(2026-08-26), `{Name}{16|20|24|28|32|48}{Regular|Filled}` 크기별 픽셀 퍼펙트 드로잉 → CSS 축소 금지 https://github.com/microsoft/fluentui-system-icons/blob/main/packages/react-icons/README.md ; LICENSE MIT © 2020 Microsoft Corporation
- WebView2 성능 공개 수치 없음(정성 서술만; 다중 프로세스; "단순 UI에 WebView2 비권장"; `MemoryUsageTargetLevel=Low`·`TrySuspendAsync`) https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/performance `[unverified 유지 — 수치는 실측만]`
- WebView2 한글 IME: WebView2Feedback #5475(조합 중 포커스 이탈 크래시), #5637, #5625 `[미확인: WebFetch 미허용·2건은 지식 컷오프 이후]`

### 5-4. 버전(2026-09-09 조회) `[외부: 에이전트 조회]`
tauri 2.11.5 · @tauri-apps/api 2.11.1 · window-state 2.4.1 · global-shortcut 2.3.2 · autostart 2.5.1 · single-instance 2.4.4 · sql 2.4.1 · notification 2.4.0 · @fluentui/react-components 9.74.7 · @fluentui/react-icons 2.0.339 (react-icons는 2.x 체계 — 메이저 번호 상이).

### 5-5. Claude Code 스킬 메커니즘 `[확인]` https://code.claude.com/docs/en/skills.md , https://code.claude.com/docs/en/memory.md , https://code.claude.com/docs/en/claude-code-on-the-web.md
- 스킬 경로 `.claude/skills/<name>/SKILL.md`; frontmatter는 하이픈 필드만(`disable-model-invocation`, `user-invocable`, `allowed-tools` …) → open-codesign의 `schemaVersion`/`trigger`/`disable_model_invocation`/`user_invocable`는 **무시됨**(기본값 = 자동 발동 가능).
- CLAUDE.md에 `@skill` 지시문 없음(`@path`는 파일 import).
- 부속 파일은 읽기 전 컨텍스트 미진입. **스킬 간 우선순위 메커니즘 없음**(이름 충돌만 Enterprise>Personal>Project>Bundled; 지시 충돌은 CLAUDE.md 문맥 + 훅으로 강제). 원격 세션도 저장소 스킬 로드. SKILL.md 줄 수 한도 미문서화. `agents/openai.yaml`은 Claude Code 문서에 없음(OpenAI 메타데이터로 추정).

---

## 6. null 보고 — plan §2-G (검색했으나 없음 / 검토했으나 문제 없음 / 의도적 미수행)

### 6-1. 두 스킬 트리에서 찾았으나 없음 `[확인]`
Fluent/Griffel/@fluentui 0 · 위젯 창 개념(always-on-bottom·click-through·skip-taskbar·frameless·resizable:false·global hotkey) 0 · 한글/CJK/keep-all 0 · Windows DPI 가이드 0(인쇄·모바일 DPI만) · 데스크톱·한국어 eval 0 · phase/gate/acceptance 개념 0 · 규범 우선순위 조항 0(유일 근접 `open-codesign/prompts/design-methodology.v1.txt:4`) · SQLite/백업/보안/개인정보/배포/서명 0 · anti-slop 도메인 icon 필드·spacing/content 키·도메인별 color CSS·saas/editorial/general 토큰 파일 없음 · open-codesign reduced-motion 0·정량 접근성 기준 0·matrix/gantt 모듈 0·검증 자산 0·ESM export 없음(`Object.assign(window, …)`만).

### 6-2. 세 문서에서 찾았으나 없음 `[확인]`
CSP·permission·capabilities(디렉터리명 1회)·보안 절·암호화·APPDATA·백업 주기·개인정보·파기·actor·라이선스·SmartScreen·NSIS·WebView2·updater·vitest·timezone·ko-KR·공휴일·인쇄·다중 사용자·고대비·알림·스키마 버전·검색 요구 전부 0건. 행사 등록 흐름(§12)·백업 형식·종일 플래그·Plan⊂Event 제약·"1~2건 vs 1건"·기간표 임계(20~30 vs 40) 불일치는 §3-A null 파생으로 이관.

### 6-3. 외부에서 찾았으나 없음 / 확보 실패 `[확인]`
Fluent 2 CJK 타이포 지침 없음 · WebView2 메모리/시작 시간 수치 없음 · Rainmeter 문서·포럼 403 · tauri 이슈 댓글 미확보(GitHub MCP는 이 저장소만 허용, api.github.com 403) · IME+no-activate 이슈 0건(WebView2Feedback·tauri 각 검색) · v2.tauri.app/reference/config 본문 잘림(docs.rs로 대체) · Fluent storybook 본문 없음(소스로 대체) · learn.microsoft.com/typography/font-list/segoe-ui-variable 404(대체 URL 확인) · global-shortcut 플러그인 API 표면의 충돌 타입 구분 미확인.

### 6-4. 검토했으나 문제 없음 `[확인]`
두 LICENSE는 MIT라 발췌 허용(고지 조건) · `accessibility.md:239-282` forced-colors 블록은 Windows 고대비에 그대로 유효 · Segoe UI는 anti-slop banned_primary에 없음 · `web-react.md:416-418` 다크모드 요구는 정합 · spec §8 아이콘 19항목 실재(G2-4) · Tauri Windows 기본 번들이 이미 NSIS currentUser · tauri-plugin-sql 기본 경로는 AppConfig(Program Files 아님) · `anti-patterns.md:292` 도메인 duration(80/160ms)은 spec 범위와 정합 · design_tokens v0.1의 spacing/radius/motion 값은 spec §9와 일치.

### 6-5. 의도적 미수행
Windows 실기(창 동작·IME·서체 폴백·Win32) — 환경 없음 · anti-slop FULL-SPEC 271KB 정독(키워드 grep만: desktop 47·widget 1·Windows 6·Fluent/Korean/CJK 0) · 무관 플랫폼 레퍼런스 10종·템플릿 15종·open-codesign 모듈 8종 정독 · 도메인 팔레트 WCAG 전수 · `validate-skill.sh` 결과 해석 이상의 분석 · upstream 저장소 실재·최신성 네트워크 확인 · 관공서 보안 지침 원문·PIA 대상 판정·개인정보보호법 조문 전문 대조(근거 부족·기관별 상이) · WPF/WinUI 배포 요건(폴백 순위) · @fluentui/react-icons npm export 전수(스모크로 대체) · Codex 플랫폼의 `allow_implicit_invocation` 실제 존중 여부(결정 1로 무관).

---

## 7. 스킬 처리 결정과 폐기 대안 — plan §3-2 → `ADR-0001-skill-policy.md`

**채택 `[사용자 결정 + Claude 제안]`**: 두 스킬 모두 **미설치·미커밋**. 조항을 발췌해 한국어 프로젝트 스킬 3개(`design-doctrine` 자동 / `ux-acceptance` / `widget-shell` 수동 전용)와 `docs/design/doctrine.md`로 **재서술**하고, `THIRD-PARTY-NOTICES.md`(MIT © 2026 Cuuper22 / © 2026 shenmian / Fluent System Icons © 2020 Microsoft Corporation)를 둔다. 원본은 저장소 밖에 두고 `docs/review/sources.md`에 sha256·출처만 기록한다.

| 대안 | 판정 | 기각 사유 |
|---|---|---|
| ① 설치 as-is(둘 다) | `[폐기]` | anti-slop은 description(`SKILL.md:3-7` "desktop (Electron, Tauri)")로 자동 발동, open-codesign은 제어 필드가 무시돼 기본 자동 발동(§5-5); 라우팅 실패 또는 government/devtools 강제(F02); spec 준수 산출물이 감사 #8/#9/#13/#15로 슬롭 판정(F10/F11/F27); 질문·서술 금지가 사용자 프로토콜 파괴(F06); 26건 충돌이 매 산출물에 재발. |
| ② 설치 + override 계층(CLAUDE.md waiver) | `[폐기]` | Claude Code에 스킬-대-규칙 우선순위 메커니즘 없음(§5-5 `[확인]`); 무효화 조항(≥15)이 채택 조항보다 많음; 발동 자체는 못 막고 SKILL.md 22KB가 매번 컨텍스트에 실림; `disable-model-invocation:true` fork로 좁히면 남는 가치가 발췌본과 같다. |
| ③ vendor/ 커밋(로드되지 않는 경로에 원본 동봉) | `[폐기]` | 834KB 중 대부분 런타임 불필요(F39); 비업무 어조·외국어 비속 감탄사 약 40곳(F26)이 공공기관 저장소·결재·감사 맥락에 부적합; 출처 보존 목적은 sources.md의 sha256·URL로 충족. |
| ④ fork + 커스텀 도메인(`assets/tokens/_extensibility.md` 절차로 windows-utility 프로필) | `[폐기]` | 허브 결함(F02 라우팅 불일치·F12 부재 필드)을 상속; `_extensibility.md` §5 motion 매핑(minimal=150ms)이 spec 100~140ms와 불일치; 74파일 fork를 프로필 1개 때문에 유지·검증해야 함. |
| ⑤ 사용자 홈(`~/.claude/skills/`)에 `disable-model-invocation: true` fork | `[대안 유지: 선택]` | 저장소 밖·수동 `/anti-slop-design` 호출만·Codex 호스트 미설치·README 설치 절차(`@skill` append) 미실행 조건이면 원본 열람용으로 무해. 결정 1로 Codex가 없으므로 F25 위험도 없음. 기본값은 미설치. |
| ⑥ 완전 제외(아무것도 배우지 않음) | `[폐기]` | 사용자 의도(학습·차별화)와 상충; accessibility.md·reduced-motion 블록·모션 성능 규칙·7문장은 충돌 없이 유용(F16). |

---

## 8. 설계안·독트린 심사 요약

### 8-1. 설계안 3개 — plan §3-0 `[Claude 판정: 심사 에이전트 세션 한도 실패로 직접 채점]`

| 안 | 점수 | 강점 | 약점 |
|---|---|---|---|
| 2 USER-FIRST | **8.7** | 시안보다 "기능이 틀릴 수밖에 없는 공백"(Phase 0 정오표)을 앞세움 = 사용자 1순위; 사용자가 손대는 파일을 CLAUDE.md+정오표 2개로 제한; 스킬 3분할(design-doctrine 자동 / ux-acceptance / widget-shell 수동) | 문서 수가 많음 |
| 0 RISK-FIRST | 8.4 | Windows 리스크 레지스터·근거 4등급·ADR·번호 개정안(A-01…)·doctrine-lint 훅·도메인 모듈 조기 착수 | 시안 전 문서 부담 큼 |
| 1 MVP-FIRST | 8.2 | 가장 구체적(파일 목록·버전 고정·check-mockups 정적 검사·비교 index·서체 가드), Phase 2는 icon/state map만 | Phase 0 정오표가 얕음 |

세 안 모두 "스킬 미설치·원본 미커밋·증류" 결론 일치(각각 설치 as-is / override / vendor / fork를 독립적으로 기각). **합성**: 2의 순서 + 0의 리스크 레지스터·ADR·정오표 번호 + 1의 구체 파일 계획·정적 검사. 완전성 비평이 지적한 사각지대 10개(ACL·Windows 근거 승격·라이선스/서체·개인정보·배포·날짜 계산·공휴일·미개봉 파일·인쇄·리뷰 자체의 프로토콜 준수)는 추가 탐색 6영역과 본 보고 §6으로 흡수했다.

### 8-2. 독트린 초안 4 심사 — `scratchpad/wf2/judge_notes.md` `[Claude 판정]`

| 초안 | 관점 | 점수 | 판정 요지 |
|---|---|---|---|
| 0 | 사용성 엔지니어 | **8.6 (기반 채택)** | U1~U8 공통 규칙(되돌릴 수 있으면 묻지 않음·사유 없는 비활성 금지·제약 입력·isComposing·Escape 사다리·soft delete), §12 5흐름을 진입점·라벨·preview·undo까지 구체화, 5어휘 고정 문구. 약점: 레이어 전환 리듬·클릭통과 안내가 얕음. |
| 3 | 앰비언트 UX | 8.4 | "클릭했는데 반응 없음"을 최대 시행착오로 지목(1회 안내·트레이 표시), 공개 리듬(앞=Enter 1회/뒤=Esc 1회/포커스 복귀), `event.code` 단축키, 감각 테스트 4종을 리뷰 절차로, 판정 질문 "다른 일정 앱과 바꿔치기 가능한가". |
| 1 | 타이포그래퍼 | 8.0 | 한글 타이포 최고(65ch 무효·line-height px 고정·굵기 부재·절단 우선순위), "정렬축이 상자를 대신한다". 폐기: primary 버튼 액센트 금지, 인라인 편집 금지, compact 13px, subtitle1 20/26 오기(→20/28). |
| 2 | Windows 플랫폼 | 8.0 | Fluent 동작 정확성(Shift+F10·F6·Dialog 포커스 복귀), forced-colors 매핑, DPI 1px, Mica/Acrylic 구분, `fontFamilyBase` 오버라이드·Bahnschrift 회피. 폐기: attention 배경 채움, Semibold 14px 하한(모노그램과 모순), compact 행 22px(4px 그리드 위반), Quick Add 자연어 파싱 허용. |

합성본 v0.2 231줄(`scratchpad/wf2/doctrine_synthesized_v0.2.md` → `docs/design/doctrine.md`·`.claude/skills/design-doctrine/`). 구조: 목적 → 우선순위(사용성>차별화; 충돌 해소 순서 접근성·오류 방지 > Windows/Fluent 2 관례 > 사용자 명시 요청 > 심미 > 성능 > 단순함) → 흐름별 오류 방지 규칙 → 판단 원칙 → 레이어 규칙 → 타이포·한글 → 색·상태·모노그램 → 간격·밀도 → 모션 → Fluent 매핑 → 슬롭 체크리스트 23항 → 자기검사. 사용자 결정 4 반영: 600 → 700(맑은 고딕 Bold 실체), 뷰당 Bold ≤2. 미결 22건(액센트 hue, 테마 정책, Mica, 기본 밀도, Layer 1 창 구조, Layer 2 chrome, Quick Add 구현, Layer 0 semantic 색, changed hue, 주 시작, 전역 단축키, 단일 문자 단축키, Undo 범위, 위젯 1건/2건, 기간표 자동 전환, 상태 어휘, 확인 필요 정의, 첫 사용 가이드, 모노그램 사전, 인쇄 뷰, 초성 검색 등)은 정오표·ADR-0005에서 확인한다.

---

## 9. 잔여 원장 — plan §7

| 상태 | 항목 |
|---|---|
| 닫힘 | 워크플로 1·2 완료(설계안 심사만 Claude 대행) · 스킬 처리 결정(ADR-0001) · 규범 우선순위(ADR-0002) · 검증 방식(동작 프로토타입 + Playwright) · 우선순위(사용성>차별화) · 사용자 결정 ①~④ |
| 열림 `[사용자 확인 대기]` | 기본값 제안 13건(정오표에 `[Claude 제안]`으로 기록, 언제든 번복 가능): 리뷰 문서 커밋=예(정제본) / 원본 스킬 미커밋 / `%LOCALAPPDATA%` 사용자 전용 / 공휴일·반복=v2 범위 밖 / 인쇄=기간표 CSV만 / 밀도 기본 normal(20곳↑ compact 제안) / 주 시작 월요일 / 위젯 일정 1건 / 전역 단축키 Ctrl+Alt+D / 연락처 마스킹+AuditLog 3년+actor=OS 계정명 / 액센트=고정 저채도 블루 / 테마=라이트+다크 추종, forced-colors / 문서 언어=한국어 본문+영어 식별자 / "확인 필요" 정의 |
| 열림 | 혼합안 확정(ADR-0005 — Claude 판정 후 사용자 Windows 열람) · Windows 실기 검증 전부(Phase 3 이후, 인계 체크리스트 3열) · 대상 PC 환경 실측표(WebView2·관리자 권한·인터넷·보안 SW) · 독트린 미결 22건 |
| 철회 | "발견당 2 에이전트 검증" · "시안 우선 착수" · "정적 HTML 시안" · "Codex 발주서" · "Pretendard 동봉" · "스킬 설치+무효화 목록" 프레임 |
| 범위 밖 `[수리 질문 대상]` | "기존 git 프로젝트 폐기"가 다른 저장소를 뜻하는 경우 |

---

## 부록 A. 발견 ID → 정오표/ADR 매핑 (잠정)

정오표 번호는 plan §4 0.3의 순서에 따른 **잠정 번호** `[Claude 제안]`이며, `docs/spec/spec_v2_errata.md` 확정본의 번호가 우선한다. 스킬 관련 발견은 정오표가 아니라 ADR·헌법·프로젝트 스킬로 처리된다.

| 발견 ID | 처리 문서 | 잠정 번호 / 위치 |
|---|---|---|
| G5-0 | spec_v2_errata + golden-expand-plan.md | A-01 |
| G5-1 | spec_v2_errata | A-02 |
| G5-2 | spec_v2_errata | A-03 `[사용자 결정: 주 시작]` |
| G5-3 | spec_v2_errata (+ 골든 ⑥⑦⑨) | A-04 |
| G5-4 | spec_v2_errata + design_tokens_v0.2 `date_format` | A-05 |
| F18 | spec_v2_errata + state-map.md | A-06 `[사용자 결정: 확인 필요 정의]` |
| F19 | spec_v2_errata + state-map.md | A-07 |
| F22 | spec_v2_errata + state-map.md | A-08 |
| F20 | spec_v2_errata | A-09 |
| F21 / G1-0 | design_tokens_v0.2 + ADR-0003-typography | A-10 |
| F23 / G0-1 | spec_v2_errata (+ 발주서 v2 opener scope) | A-11 |
| F32 | spec_v2_errata | A-12 |
| F17 / G1-1 | spec_v2_errata(§11 항목 18) + ADR-0004 + risk register | A-13 |
| G1-3 (F33 조건부, G1-2 정정) | spec_v2_errata(§11 항목 19) + risk register | A-14 |
| G0-0 | tauri_spike_order_v2(권한 매핑표) | A-15 |
| G0-2 | tauri_spike_order_v2(sql 미부여) | A-16 |
| G0-3 | tauri_spike_order_v2(CSP) | A-17 |
| G0-4 | tauri_spike_order_v2(산출물 10·PASS 11) | A-18 |
| G3-0 | spec_v2_errata(Storage 배치) | A-19 `[사용자 결정: 저장 위치]` |
| G3-1 | spec_v2_errata(AuditLog 보존·파기) | A-20 `[사용자 결정: 보존기간]` |
| G3-2 | spec_v2_errata(actor) | A-21 |
| G4-0 | tauri_spike_order_v2 + deployment-prereqs.md | A-22 |
| G4-1 | tauri_spike_order_v2 + deployment-prereqs.md | A-23 |
| G4-2 | tauri_spike_order_v2 + deployment-prereqs.md | A-24 |
| G4-3 | spec_v2_errata(§14 Phase 7) | A-25 |
| G4-4 | spec_v2_errata(§10·Phase 4) + ADR-0006 | A-26 |
| F35 | spec_v2_errata(§15 단일 실행자) | A-27 `[사용자 결정 1]` |
| F37 | spec_v2_errata(§16 분리) | A-28 |
| F38 | spec_v2_errata + design_tokens_v0.2 | A-29 |
| F34 | spec_v2_errata | A-30 `[사용자 결정: 공휴일]` |
| F36 | spec_v2_errata | A-31 `[사용자 결정: 인쇄]` |
| G3-4 | spec_v2_errata(Layer 3 마스킹) | A-32 |
| G2-1 | spec_v2_errata(오프라인 조항) + 발주서 v2 CSP | A-33 |
| G3-3 | ADR-0006(Phase 4 병렬 조건) | 정오표 참조(Phase 4) |
| G2-2 | THIRD-PARTY-NOTICES.md + ADR-0001 | — |
| G2-3 | Phase 1 방법(font-guard) + ADR-0003 | — |
| G2-4 | tauri_spike_order_v2(아이콘 import 스모크) | — |
| null 파생(행사 등록 흐름·백업 형식·종일 플래그·다중 사용자·고대비·알림·스키마 버전·Plan⊂Event·1~2건·기간표 임계·검색) | spec_v2_errata | A-34 이후(정오표 참조) |
| F01/G2-0, F13, F24 | ADR-0002 무효화 + design-doctrine(한글·아이콘) | — |
| F02, F09, F10, F11, F12, F27, F28, F39 | ADR-0001 + ADR-0002 무효화 목록 | — |
| F03, F04, F06, F07, F08, F14, F15, F25, F29, F30, F31 | ADR-0001 + ADR-0002 무효화·자동 리젝트 | — |
| F05, G1-4 | widget-shell 스킬 + risk register + ADR-0002 | — |
| F26 | ADR-0001(미커밋 사유) + CLAUDE.md 어조 조항 | — |
| F16 | ADR-0001 발췌 목록 + design-doctrine 코퍼스 | — |
