# PROJECT KERNEL

이 문서는 이 저장소의 제품 방향에 대한 **유일한 repo-level 기준**이다.
Spike를 수행하기 위한 최소 제품 경계이며, 여기에 새 제품 원칙을 덧붙이지 않는다.

---

## PRODUCT

WorkDashboard는 Windows 데스크톱에 조용히 상주하면서,
일반 사무일정과 행사·업체·업무를 하나의 시간/업무 체계로 관리하고,
사용자의 의도에 따라 점진적으로 깊어지는 개인 업무 도구다.

기본 공간 방향:

`Ambient → Quick → Calendar Sheet → Object Lens → Focus Surface`

---

## MUST

1. 일반 사무일정과 행사/업체 일정은 같은 체계에서 관리한다.
2. Calendar에서 참가 업체명을 직접 확인할 수 있어야 한다.
3. 업체 참가계획은 반복 패턴과 특정 날짜 예외를 표현할 수 있어야 한다.
4. 특정 날짜만 수정하는 것과 전체 참가계획 수정은 구별한다.
5. 빈 날짜에서 빠르게 일정을 추가할 수 있어야 한다.
6. 행사·업체·일정·업무는 서로 연결 가능해야 한다.
7. 미래·현재·완료 업무/절차를 모두 확인할 수 있어야 한다.
8. 관련 파일/폴더/압축파일을 연결할 수 있어야 한다.
9. 여러 D-day를 desktop에 pin할 수 있어야 한다.
10. 반복 업무/업체/절차를 template으로 재사용할 수 있어야 한다.
11. 실수 복구와 변경 이력을 제공해야 한다.
12. 화면 단순화를 이유로 위 기능을 삭제하거나 숨겨서는 안 된다.

---

## EXPERIENCE

1. `Quiet at rest, present on intent`.
2. Ambient 상태는 다른 업무를 방해하지 않아야 한다.
3. Calendar는 핵심 surface이지만 제품 전체가 Calendar-only여서는 안 된다.
4. 카드 장식보다 위치·간격·typography로 정보 위계를 만든다.
5. 높은 정보 밀도는 숨김보다 layout/density/view 전환으로 해결한다.
6. 자유 배치는 별도 Layout Edit 상태에서만 허용한다.
7. Command/search는 보조 경로이지 유일한 사용 경로가 아니다.

---

## NEVER

1. 일반적인 SaaS dashboard 구조를 기본값으로 사용하지 않는다.
2. `큰 앱 창 + Calendar + permanent right inspector`를 자동 기본안으로 삼지 않는다.
3. Calendar 업체명을 `+N`, 숫자, 점만으로 대체하지 않는다.
4. 모든 정보를 card/KPI/pill 구조로 쪼개지 않는다.
5. 평상시 모든 요소를 draggable 상태로 두지 않는다.
6. 구현 편의를 위해 제품 요구를 변경하지 않는다.
7. Claude가 중간 구현 결정을 새 영구 제품규칙으로 만들지 않는다.

---

이 Kernel은 이번 Spike를 수행하기 위한 최소 제품 경계다.
내용을 추가로 세분화하거나 새 제품 원칙을 만들어 넣지 마라.
