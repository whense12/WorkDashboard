# WorkDashboard — 직거래 일정관리 프로젝트 헌법

> 이 파일은 이 저장소에서 일하는 모든 Claude 세션이 먼저 읽는 규칙이다. 규칙마다 근거가 있고, 근거 없는 규칙은 취향이므로 무효다.
> 표기: [사용자 결정] [Claude 제안] [확인] [추정] [훈련지식] [미확인] [폐기: 사유]

## 0. 제품 한 줄
평소에는 바탕화면에서 조용히 존재하고, 의도가 생겼을 때 오늘 일정 → 캘린더 → 행사/업체 → 세부업무 순으로 펼쳐지는 Windows 일정·조율 작업 공간 (docs/spec/spec_v2.md:8). 직거래장터 참가업체(업체×행사×참가계획×예외일)를 관리하는 1인 실무자 도구.

## 1. 실행 주체와 범위 [사용자 결정 2026-09-09]
- 설계·문서·구현·테스트 전부 **Claude(이 저장소의 세션)**가 수행한다. Codex·Astra 등 외부 실행자는 없다(spec §15는 정오표 A-항목으로 개정).
- 현재 승인 범위: Phase 0(문서·헌법·스킬) + Phase 1(동작하는 프로토타입 시안 + 기능별·업무 시뮬레이션 테스트). Phase 3 이후는 별도 승인.
- 이 개발 환경은 Linux 컨테이너(webkit2gtk·gtk 없음 → `src-tauri`는 컴파일 불가; Windows 없음; 한글 UI 서체 없음 → NanumGothic 대체 렌더). **Windows 창 동작(always-on-bottom·click-through·Win+D·트레이·DPI·한글 IME 실기)은 여기서 검증할 수 없다.**

## 2. 우선순위 사다리 (ADR-0002) — 상위가 하위를 이긴다
0. 해석 렌즈: 모호하면 **오류·시행착오가 적은 쪽**. 독창성은 2순위. [사용자 결정]
1. `docs/spec/spec_v2.md`(원본, 무수정) + `docs/spec/spec_v2_errata.md`(정오표; 사용자 승인분 및 [Claude 제안] 기본값이 원문을 대체)
2. `docs/spec/design_tokens_v0.2.json` + `docs/spec/tauri_spike_order_v2.md` — 토큰은 제안이 아니라 제약
3. 사용자 작업 프로토콜(§5) — 대화 규약에서 어떤 스킬보다 우선
4. 이 헌법 + 프로젝트 스킬(`.claude/skills/design-doctrine`, `ux-acceptance`, `widget-shell`) + `docs/design/doctrine.md`
5. `docs/design/doctrine.md`에 출처·라이선스와 함께 발췌·재서술된 제3자 조항. 발췌되지 않은 제3자 문장은 효력 없음.
- 충돌 해소 순서: 접근성·오류 방지 > Windows/Fluent 2 관례 > 사용자 명시 요청 > 심미 > 성능 > 단순함.

## 3. 서드파티 스킬 정책 (ADR-0001)
- anti-slop-design, open-codesign은 **설치하지 않고 저장소에도 넣지 않는다**. 배울 것만 `docs/design/doctrine.md`와 프로젝트 스킬로 증류했다. 출처·해시·라이선스는 `docs/review/sources.md`, 고지는 `THIRD-PARTY-NOTICES.md`.
- 무효화 목록(읽더라도 따르지 않는다): open-codesign `prompts/workflow.v1.txt:3,:18`("묻지 말고 생성"·"서술 금지"), `craft-directives.v1.txt:5,:7,:61-67,:76-87,:90-105`(밀도 하한·LIVE/시계·모션·크래프트 쿼터), `artifact-types.v1.txt` 밀도표 전체, `output-rules.v1.txt` 전체(ZIP·Tailwind CDN·mobile-first); anti-slop `SKILL.md` Step 1-2 도메인 라우팅, Rule 1/3/6/9/12, 감사 #8/#9/#15, `assets/css/fluid-*.css`, `motion-tokens.css`, `templates/desktop/*`, `assets/svg/*`, `assets/fonts/font-stacks.json`.
- 자동 리젝트 4항목(어떤 산출물이든): 4열 KPI 타일 / 좌측 색 accent bar / LIVE·SYSTEM ONLINE·초 단위 시계 / Math.random 데이터.

## 4. 금지 패턴 요약 (spec_v2.md:50-61 + 독트린 슬롭 체크리스트 23항)
KPI 카드 상단 나열 · 전부 카드화 · `+N more` · 업체별 색 · mobile-first/햄버거 · max-width 중앙 컨테이너 · drag만으로 재배치 · 하루만/전체 변경을 같은 UI에서 · 참가계획과 날짜 이벤트를 같은 데이터로 · 요약 문자열 수동 작성 · 오늘=액센트 원형 배지 · 알약 상태 배지 · hover lift/press scale · stagger · 그레인/글래스 · 이모지 아이콘 · outline:none · 한글 자간 · 12px 미만 한글 · 램프 밖 크기(13/15px).

## 5. 대화·작업 규약 (사용자 프로토콜 — 4분할)
- 모든 진술에 태그: 명시(사용자 발화) / 맥락 추론 / 관성으로 답한 것 / 모르는 것(미지-인지 vs 상호미지). 보유-미공개 상태는 존재 금지 → 즉시 공개.
- 권고·선택·다음 단계마다 **대안 2개 이상 + 기각 사유 1줄**. 단일 대안이면 "단일 대안"이라고 쓴다.
- 전제가 충돌하면 수리 질문("혹시 X 말인가?", "앞의 Y와 충돌한다") 후 진행. 같은 질문이 반복되면 층위를 바꾼다.
- **null 보고**: 찾았는데 없었던 것과 안 찾은 것을 구분해 적는다. 턴 말미 잔여 원장(열림/닫힘/철회).
- 사용자의 서식 문체 요구가 있으면 `goseong-official-doc` 스킬 규범을 따른다(결재 문안 한정).

## 6. 한글·타이포 상위 규칙 (ADR-0003)
- UI 서체 = 맑은 고딕(시스템) 선두 스택. 한글 커버리지 없는 서체를 primary로 두지 않는다. 웹폰트·CDN 금지.
- 굵기 400/700만, 뷰당 Bold ≤2, 뷰당 큰 글자(anchor) 1개. 한글 12px 하한, 자간 0, `word-break: keep-all`, 숫자 `tabular-nums`, line-height px 고정.
- 상태 5어휘 고정: 확정 / 확인 필요 / 이 날짜만 변경(셀: 변경됨) / 불참·취소 / 연결됨. 요약은 결론형 자동 생성.

## 7. Layer 0 위젯 상위 규칙
320×110 고정, 정보 4개(날짜·오늘 N·확인 필요 N·가장 가까운 일정 1건)만, rest에 버튼·입력·아이콘 줄·테두리·그림자 0, 텍스트 입력 요소 0(no-activate·IME), 초 단위 타이머·맥동 없음(분 단위 갱신·83ms 크로스페이드만), 개인정보(연락처) 표시 금지, 클릭=Layer 1.

## 8. 보안·개인정보 상위 규칙 (정오표 A-항목, G0/G3)
- Tauri 권한은 명령별 최소(permissions-map). 프런트에 `sql:*` 권한 0 — SQLite는 Rust command만. CSP 기본값 설정. 첨부는 앱 데이터 하위 상대경로·copy 모드, opener scope 한정.
- 연락처 등 개인정보: 인스펙터 기본 마스킹, AuditLog는 마스킹 저장·보존기간·업체 삭제 시 연쇄 파기, actor 기록. DB·백업은 `%LOCALAPPDATA%` 사용자 전용.
- 런타임 외부 네트워크 요청 0(서체·아이콘·업데이트 확인 포함).

## 9. 검증 주장 규칙
- Windows에서 실행하지 않은 것을 "동작함"이라고 쓰지 않는다. 결과표는 PASS / FAIL / **미검증(Linux 작성)** 3열.
- 프로토타입·도메인 로직은 이 환경에서 실제로 실행·테스트한다(vitest 골든, Playwright 시나리오). 실행하지 않은 테스트를 통과로 적지 않는다.
- 시안 조판은 Linux 대체 서체로 렌더되므로 "잠정"이다. font-guard가 렌더 서체명을 결과표에 남긴다.

## 10. 저장소 지도
- `docs/spec/` 원본 3문서(동결) · 정오표 · 토큰 v0.2 · 발주서 v2(자기 작업 계획) · 골든 테이블 · state-map
- `docs/decisions/` ADR · `docs/risk/` Windows 리스크 레지스터·배포 전제·인계 체크리스트 · `docs/review/` 검토 보고·출처 · `docs/design/doctrine.md`
- `.claude/skills/` design-doctrine(자동) · ux-acceptance(§12 흐름 대본) · widget-shell(수동 호출, Phase 3 절차)
- `design/prototype/` Phase 1 동작 프로토타입(Vite+React+TS+Fluent v9) · 도메인 모듈 · 픽스처 · Playwright 테스트 · 결과표
- (Phase 3+) `src/`, `src-tauri/` — 발주서 §10 구조 그대로 루트

## 11. 작업 규칙
- 브랜치 `claude/practical-dijkstra-s7zstq`에 커밋·푸시. PR은 요청 시에만.
- 원본 `docs/spec/spec_v2.md`·`design_tokens_v0.1.json`·`tauri_spike_order.md`는 수정하지 않는다(정오표·v2 문서로만 개정).
- 문서 언어: 한국어 본문 + 영어 식별자. 결재 문안 외에는 공문서 기호 체계를 쓰지 않는다.
- 커밋 메시지·코드·문서에 모델 식별자를 넣지 않는다.
- 새 규칙을 만들 때는 근거(spec 행·발견 ID·1차 문서 URL)를 붙이고, 대안 2개와 기각 사유를 ADR 또는 정오표에 남긴다.
