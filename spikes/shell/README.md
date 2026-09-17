# Spike A — Windows desktop shell 기술 비교

목적은 **shell behavior 비교**다. 제품 기능이 아니다.
Calendar · 업체 · 행사 · DB 는 이 Spike에서 구현하지 않는다.

비교 대상은 둘뿐이다.

- **A: Tauri 2** (`tauri/`)
- **B: WPF (.NET 8)** + 필요한 경우 Win32 interop (`wpf/`)

세 번째 플랫폼(WinUI 3 등)은 추가하지 않는다.

---

## 공통 테스트 UI

예쁜 제품 디자인을 만들지 않는다. 중립적인 검증용 surface 하나다.

```text
9/24 Thu

다음 일정
14:00 업체 확인

D-7 진주
D-23 공룡엑스포
D-40 경남박람회

[ACTIVE / PASSIVE]
[LAYOUT EDIT]
```

두 구현이 맞춰야 할 것:

| 항목 | 값 |
|---|---|
| 창 크기 | 320 × 240 (논리 픽셀) |
| 기본 위치 | 화면 작업영역 우측 하단에서 안쪽으로 24px |
| 배경 | 불투명도 약 85% 의 어두운 중립색 (`#1E1E1E`), 테두리 1px `#3C3C3C` |
| 글자색 | `#E6E6E6`, 보조 `#9A9A9A` |
| 서체 | 시스템 기본 (Segoe UI 계열). 웹폰트·번들폰트 금지 |
| 날짜/일정/D-day | **하드코딩된 고정 문자열**. 계산·저장·DB 없음 |
| 버튼 | `ACTIVE / PASSIVE` 토글 1개, `LAYOUT EDIT` 토글 1개 |

문자열은 위 블록 그대로 쓴다. 두 플랫폼이 같은 정보량·같은 배치를 갖는다.

---

## 상태 정의 (두 구현이 동일하게 따른다)

### PASSIVE (기본 상태)
- 다른 앱 사용을 방해하지 않는다
- 창이 **포커스를 가져가지 않는다**
- Z-순서상 **바닥(bottom)** 에 머문다
- click-through 를 켤 수 있다 (토글)
- **drag 금지** — 창이 움직이지 않는다

### ACTIVE
- 클릭 가능, 컨트롤 사용 가능
- 포커스를 받을 수 있다
- **drag 는 여전히 금지**

### LAYOUT EDIT
- **이 상태에서만** 창을 drag 해서 옮길 수 있다
- 상태를 벗어나면 위치가 다시 잠기고, 마지막 위치를 저장한다

상태 전환은 UI 버튼과 global shortcut 양쪽으로 가능해야 한다.

---

## 구현할 shell 기능

두 후보 모두:

**Window** — frameless · transparent surface · taskbar 노출 최소화 ·
Alt+Tab/switcher 정책 · passive bottom-Z · active 전환 · optional click-through ·
global shortcut 활성화 · startup 등록 가능 여부 · 위치 저장/복원

**Interaction** — 위 세 상태(PASSIVE / ACTIVE / LAYOUT EDIT)

---

## 결과 기록

- 체크리스트: `acceptance.md`
- 비교표: `results/COMPARISON.md`

결과는 `PASS` / `FAIL` / `NOT TESTED` / `NOT APPLICABLE` 넷 중 하나만 쓴다.
**미검증을 PASS 로 적지 않는다.** 자동화한 것과 수동 검증한 것을 구분해 적는다.
