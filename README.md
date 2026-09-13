# WorkDashboard — 직거래 일정관리

평소에는 바탕화면에서 조용히 존재하고, 사용자의 의도가 생겼을 때 오늘 일정 → 캘린더 → 행사/업체 → 세부업무 순으로 정보가 단계적으로 펼쳐지는 Windows 일정·조율 작업 공간 (docs/spec/spec_v2.md:8).

## 상태 (2026-09-09)
| 항목 | 상태 |
|---|---|
| 명세 v2 + 정오표 | Phase 0 작성 중 |
| 디자인 토큰 | v0.2 (`docs/spec/design_tokens_v0.2.json`) |
| 독트린·프로젝트 스킬 | Phase 0 |
| 프로토타입 시안(Phase 1) | 진행 예정 — `design/prototype/` |
| **Windows 실기 검증** | **0건** — 개발 환경이 Linux라 창 동작·DPI·한글 IME는 미검증 |

## 문서 지도
- 헌법: `CLAUDE.md` (우선순위·금지 패턴·대화 규약·검증 주장 규칙)
- 명세: `docs/spec/spec_v2.md`(원본) → `docs/spec/spec_v2_errata.md`(정오표 A-01…) · `design_tokens_v0.2.json` · `tauri_spike_order_v2.md` · `golden-expand-plan.md` · `state-map.md`
- 결정: `docs/decisions/ADR-*.md`
- 리스크: `docs/risk/windows-platform-risk-register.md` · `deployment-prereqs.md` · `spike-handoff-checklist.md`
- 검토: `docs/review/2026-09-09-spec-skill-review.md` · `sources.md`
- 디자인 독트린: `docs/design/doctrine.md` · 스킬 `.claude/skills/`
- 고지: `THIRD-PARTY-NOTICES.md`

## 단계
Phase 0 문서·헌법·스킬 → Phase 1 동작 프로토타입 시안 + 시뮬레이션 테스트 → Phase 2 디자인 시스템 → Phase 3 Tauri 셸 스파이크(Windows 검증 필요) → Phase 4 플랫폼 게이트 → Phase 5 코어 프로토타입 → Phase 6 UX 하드닝 → Phase 7 Windows 릴리스 (docs/spec/spec_v2.md:569-609).
