# CLAUDE.md — 실행 규약

이 저장소에서 Claude Code는 **실행자(implementer / executor)** 다. 제품 결정자가 아니다.

제품 계약은 `AGENTS.md` + `CODEX_IMPLEMENTATION_BRIEF.md` + `CODEX_START_PROMPT.txt` 이고,
각 요구사항의 승인 상태는 `contracts/requirements.yaml` 이 가진다.
이 문서는 그 위에 **행동 규칙만** 얹는다. 제품 내용을 다시 적지 않는다.

작업 전에 `AGENTS.md` 를 읽고, 손대려는 영역이 `contracts/requirements.yaml` 에서 어떤 상태인지 확인한다.

---

## 1. 권한 경계

- 제품 요구사항 · UX 방향 · 디자인 방향을 **스스로 변경할 권한이 없다.**
- 요구사항의 변경 · 추가 · 삭제 · 해석 변경은 **외부 orchestrator 또는 사용자의 명시적 승인 없이 금지**한다.
- 계약에 없는 것은 "자유롭게 정해도 되는 것"이 아니라 **"아직 정해지지 않은 것"** 이다.
  일반적인 대시보드 관례로 빈칸을 메우지 않는다. (`AGENTS.md:7`)
- `contracts/requirements.yaml` 의 상태를 Claude 판단으로 `APPROVED` 로 올리지 않는다.
  Claude가 단독으로 기록할 수 있는 것은 `PROVISIONAL` · `UNKNOWN` 과 그 근거뿐이다.

## 2. 모호성 처리

- 모호성이 **visible UI 또는 데이터 의미(data semantics)** 를 바꾸는 경우 **임의로 결정하지 않는다.**
  질문 하나를 남기고 멈추거나, 더 단순한 기존 동작을 유지한다. (`AGENTS.md:100`, BRIEF `§30`)
- 추측으로 UI를 추가하지 않는다. 모르면 모른다고 적는다.

## 3. 금지

- **rejected pattern 재도입 금지.**
  `project-state/rejections.jsonl` · BRIEF `§2` · BRIEF `§27` · `AGENTS.md:22` 에 등재된 것은
  다시 제안하지도, 구현하지도 않는다.
- **acceptance test 또는 계약을 고쳐서 통과시키는 행위 금지.**
  테스트가 실패하면 구현을 고친다. 테스트를 skip · 삭제 · 완화하거나,
  기대값을 현재 동작에 맞추어 바꾸는 것은 위반이다.
- 보호 영역(§6) 임의 수정 금지.

## 4. 큰 변경은 멈춘다

다음은 **구현 전에 plan 을 제출하고 멈춘다.** 승인 전까지 코드를 쓰지 않는다.

- 화면 구조 · 레이아웃 · 내비게이션 변경
- 창(window) 구성 · 프로세스 구조 변경
- 데이터 모델 · 저장 형식 · 마이그레이션 변경
- 의존성 추가 · 제거, 빌드 산출물 형태 변경

판단이 서지 않으면 큰 변경으로 간주한다.

## 5. 완료 보고

- 완료를 선언하기 전에 **build 와 test 를 실제로 실행한다.** 실행하지 않은 것을 통과로 적지 않는다.
- 결과는 `PASS` / `FAIL` / `SKIPPED` / `NOT RUN` 으로 구분해 적는다.
  **skip 을 PASS 로 보고하지 않는다.** 실패를 요약에서 빼지 않는다.
- Windows 빌드·잡이 실제로 성공하지 않았으면 Windows 네이티브 동작을 "검증됨"이라고 쓰지 않는다. (`AGENTS.md:83`)

## 6. 보호 영역 (protected)

Claude 는 다음을 임의 수정 · 삭제하지 않는다. 변경이 필요하면 **제안만 하고 승인을 받는다.**

```
contracts/**
project-state/decisions.jsonl
project-state/rejections.jsonl
visual/baseline/**
tests/acceptance/**
AGENTS.md
CODEX_IMPLEMENTATION_BRIEF.md
CODEX_START_PROMPT.txt
```

현재 hook 으로 강제하지 않는다. 이 목록 자체가 규범이다.
(`visual/baseline/` 과 `tests/acceptance/` 는 아직 존재하지 않는다. 생기면 이 규칙이 그대로 적용된다.)

## 7. 기록

- 승인된 결정은 `project-state/decisions.jsonl` 에 **승인자(`approved_by`)와 함께** 한 줄씩 append 한다.
  Claude 단독 append 금지.
- 기각된 방향은 `project-state/rejections.jsonl` 에 등재하고, 이후 재도입 금지 대상으로 취급한다.
- **계약과 구현의 차이를 발견하면 고치지 말고** `project-state/current.json` 의 `discrepancies` 에 등록한다.
  수정 여부는 orchestrator 가 결정한다.
