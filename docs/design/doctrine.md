# 직거래 일정관리 — 디자인 독트린 v0.2

> 이 문서는 두 서드파티 디자인 스킬(anti-slop-design, open-codesign — MIT, 출처는 docs/review/sources.md)에서 "왜"만 증류하고, 명세 v2·토큰 v0.2·사용자 결정(사용성 우선, 맑은 고딕 400/700)에 맞춰 재서술한 프로젝트 규범이다. 스킬 원본은 저장소에 없다. 프로젝트 스킬 `.claude/skills/design-doctrine`은 이 문서의 요약본이며 충돌 시 이 문서와 토큰 v0.2가 우선한다.

> 근거 표기: `spec:줄`=docs/spec/spec_v2.md, `tok:줄`=docs/spec/design_tokens_v0.1.json(값은 v0.2가 우선), `spike:줄`=docs/spec/tauri_spike_order.md, `as/…`=anti-slop-design 스킬 파일(저장소 미포함), `oc/…`=open-codesign 스킬 파일(저장소 미포함), URL=웹 문서, [훈련지식]=구현 전 실측 필요.

## 목적
- 이 문서는 이 제품의 UI·디자인·문구·상태 작업 전에 Claude가 읽는 프로젝트 규칙이다. 규칙마다 근거를 붙인다. 근거 없는 규칙은 취향이므로 무효다.
- 제품: 바탕화면 상주 320×110 앰비언트 위젯 → Today/Upcoming → 캘린더 워크스페이스(월/주/기간표) → 인스펙터(spec:8, 67-144). 사용자는 매일 8시간 켜두는 1인 실무자, 데이터는 18자+ 한글 업체명·요일 참가계획·날짜별 예외·하루 25곳 동시 참가(spec:551-566).
- 사용자가 두 디자인 스킬을 올린 의도는 규칙 설치가 아니라 '설계 감각'의 이식과 "AI 평균 UI와 구별되되 Fluent에 맞는 상태"의 정의다. 따라서 값이 아니라 판단 순서와 검사법을 담는다(as/SKILL.md:28-109). 웹용 값(폰트 목록·히어로·bento·그레인·런타임 oklch)은 버렸고 사유는 각 절에 있다.
- 기존 시스템은 제안이 아니라 제약이다: Fluent 2 control behavior + Fluent System Icons + tok(oc/prompts/design-methodology.v1.txt:3-7). 차별화 질문은 "Fluent를 벗어나는가"가 아니라 "Fluent 안에서 근거 있게 선택했는가"다.
- 도메인 선언(모든 값의 근거): "Windows 데스크톱 앰비언트 업무 도구 / 반복 전문 사용자 / 고밀도 한글 업무정보". 코드·시안에 `/* Aesthetic: quiet-swiss-instrument (Fluent 2) */` 명시.

## 우선순위(사용성 > 차별화)
1. **사용성**: 모든 기능을 오류 없이, 시행착오 없이. '디자인'은 오류 방지(제약 입력·기본값·preview 후 확정, spec:515-547), 추측 없는 발견성(spec:168-174), 되돌리기(AuditLog, spec:321-328), 예측 가능한 Fluent 동작(spec:36-40), 설계된 빈/로딩/오류/충돌 상태, 단일 해석의 상태 문구, DPI/테마 견고성(spec:562-565)을 포함한다.
2. **차별화**: 사용성 비용이 0일 때만. 명료함과 개성을 맞바꾸는 규칙은 틀린 규칙이다.
- 충돌 해소 순서(고정): 접근성·오류 방지 > Windows/Fluent 2 관례 > 사용자 명시 요청 > 심미(차별화) > 성능 > 단순함(as/anti-slop-design-FULL-SPEC.md:1987-2008, 2순위를 플랫폼 관례로 치환). 차별화가 4순위이므로 Fluent 관례를 깨는 차별화는 정의상 성립하지 않는다.
- 각 절은 [사용성] 규칙을 먼저, [정체성] 메모를 나중에 쓴다. 정체성 메모를 전부 지워도 제품은 성립해야 한다.
- 이 제품의 '기본값'은 웹 기본값이 아니라 "Fluent UI v9를 옵션 없이 쓴 상태(brand 파랑·Segoe 400/600(Fluent 기본)·단일 radius·Bahnschrift 숫자)"다. 차별화 = 그 기본값 중 근거 있는 지점만 덮어쓰기(as/references/anti-patterns.md:13-51). 판정 문장: "실수 없이 쓸 수 있는가" → 그 다음 "누군가 설계했다고 보이는가"(as/SKILL.md:467-473).

## 사용성·오류 방지 규칙(흐름별)
### 공통 (모든 흐름)
- U1 되돌릴 수 있으면 묻지 않고, 되돌릴 수 없으면 보여주고 묻는다. 체크·상태 토글·단일 필드 수정 = 즉시 저장 + 8초 undo 토스트 + Ctrl+Z. 계획 편집·예외·복원·삭제·다건 변경 = preview 포함 확인(spec:531-547). AuditLog가 previous/new value를 가지므로 undo는 데이터 모델이 이미 지원(spec:321-328). 확인 대화상자는 학습되어 무시되고 되돌리기는 학습되어 신뢰된다 [훈련지식].
- U2 확인 버튼 라벨 = 동사 + 범위 + 영향 수: "10/3 하루만 저장", "계획 저장 · +3일 −5일", "현재 상태를 스냅샷으로 저장하고 복원". "확인/OK/예" 금지. 파괴적 대화상자는 취소가 기본 포커스, 닫힌 뒤 포커스는 트리거로 복귀 [훈련지식: Windows 대화상자 관례].
- U3 주 버튼을 말없이 비활성화하지 않는다. 필수값이 비면 버튼은 눌리고 첫 오류 필드로 포커스 + Field validationMessage 인라인 표시(토스트로 오류 알림 금지). preview 계산 전처럼 반드시 비활성이어야 할 때만 옆에 사유 한 줄("참가 요일을 1개 이상 선택").
- U4 제약 입력: 자유 텍스트는 제목·메모·이유뿐. 날짜 = DatePicker + 타이핑 파싱(9/24, 0924, 2026-09-24), 시각 = 5분 단위 SpinButton/Combobox(빈 값=종일), 종료<시작이면 자동 보정 + 안내, 전화 = 숫자만 받아 자동 하이픈, 요일 = 7개 토글, 업체·행사 = Combobox(freeform 금지, 유령 데이터 방지), 업체명 maxlength 없음(spec:557). 자연어 날짜 파싱 금지 — 대신 '오늘/내일/이번 금' 칩.
- U5 한글 IME: keydown의 Enter/Escape는 `event.isComposing || keyCode===229`면 무시하고 compositionend 이후에만 확정. 단축키는 `event.code`로 판정(한/영 상태 무관), 입력 필드 포커스 중 단일 문자 단축키는 무시. 텍스트 입력은 활성화된 창에서만 — no-activate/click-through인 Layer 0 rest에 입력 요소 0(spike:63-75) [훈련지식: 한글 IME Enter 2회 발화].
- U6 dirty 폼의 Escape: 변경 없으면 즉시 닫힘, 변경 있으면 "변경 내용을 버릴까요? [계속 편집] [버리기]". 바깥 클릭으로 dirty 폼은 닫히지 않는다. Escape 사다리: 메뉴 → 플라이아웃 → 대화상자 → 인스펙터 → Layer 1 → 위젯 rest, 한 번에 한 단계만; 열린 것이 없는 Layer 2에서 Esc는 무동작(창 닫기는 Ctrl+W).
- U7 삭제 = soft delete + undo 토스트. 연쇄 영향(업체 삭제 → 계획 N·예외 M·첨부 K)이 있으면 영향 수 preview 확인.
- U8 시각은 상대+절대 병기: 위젯/목록은 '오늘 14:30 · 내일 · 9/12(금)', 인스펙터·이력·백업은 절대시각 병기(oc/prompts/craft-directives.v1.txt:100). ISO 문자열 노출 금지.
- U9 기본값은 문맥에서 온다: Quick Add 날짜 = 보고 있는 날짜(없으면 오늘), 시각 = 다음 정시; 업체 등록의 행사 = 현재 선택 행사, 기간 = 그 행사 기간.

### 일정 등록 (Quick Add, spec:517-520)
- 위젯 기준 3번 이내: 전역 단축키(또는 클릭) → Layer 1 → `Ctrl+N`(또는 `N`) → 폼. 제목 + 일시만으로 저장, 업체/행사 연계는 접힌 '연결…' 한 줄(선택). 입력 아래 해석 결과 한 줄 상시 표시: "9월 24일(수) 14:00 · 업체 연결 없음" — 저장 전에 무엇이 저장되는지 읽게 한다.
- Enter = 저장 후 새 행 선택·포커스 + 토스트 "저장됨 · 실행 취소", Ctrl+Enter = 저장 후 폼 유지, Esc = 닫기(입력 중 초안은 다음 열기까지 보존 — 실수로 닫은 것의 undo).

### 업체 등록 (spec:522-529)
- 순서 고정: 기본정보 → 행사 선택 → 기간 → 참가요일 → 실제 참가일 preview → 저장. 스테퍼가 아니라 한 pane의 세로 섹션 — 앞 값을 보면서 뒤를 채워야 오류가 준다. 기간 기본값 = 행사 기간, 그 밖은 선택 불가.
- preview는 live: 기간·요일이 바뀔 때마다 "금·토 참가 · 12일 · 첫 9/12 · 마지막 10/31" + 미니 달력 강조. 요일 0개면 U3 사유. 요약문은 자동 생성, 수동 작성 금지(spec:61).
- 동명 업체: 차단 없이 인라인 경고 "같은 이름 1곳 있음 — 모노그램이 2음절로 승격됩니다" + 기존 업체 열기 링크. 행사 없이 업체만 등록 가능.

### 전체 일정 변경 (ParticipationPlan 편집, spec:531-535)
- 진입점은 인스펙터 '참가계획' 섹션의 [계획 편집]뿐. 날짜 셀 컨텍스트에서는 도달 불가(spec:59, 330-334). 진입점이 범위를 정하므로 사용자가 범위를 고를 일이 없다.
- Dialog 제목에 범위: "계획 편집 — 고성수산 × 가을장터 (9/12–10/31 · 26일)". 편집 중 diff preview: 추가되는 날 / 빠지는 날 두 열 + 개수. 기존 Exception 충돌(새 범위 밖, 같은 의미가 된 예외) 목록에 각각 [유지]/[삭제] 선택 전에는 저장 불가, 기본 유지. 저장 라벨 "계획 저장 · +3일 −5일" → undo 토스트 + AuditLog.

### 하루만 변경 (ParticipationException, spec:537-541)
- 진입: 날짜 셀 → 업체 → [이 날짜만 수정] (컨텍스트 메뉴와 인스펙터 참가일 목록 두 곳에 같은 라벨). 제목은 큰 날짜 하나 "10월 3일(금) · 고성수산 — 다른 날짜에는 영향 없음". 계획 편집과 시각 골격이 달라야 '지금 무엇을 바꾸는지' 보인다. 계획 필드(기간·요일)는 절대 노출하지 않는다.
- 본문: 계획상 상태를 고스트로("계획: 참가") → "이 날만 참가 / 이 날만 불참" RadioGroup(현재 상태 기본 선택) → 이유/메모 선택 → 효과 문장 "이 날짜만 불참으로 표시됩니다. 계획은 바뀌지 않습니다". 이미 예외가 있으면 '덮어쓰기'임을 표시하고 이전 값을 보여준다. 반대 오류 방지 링크 "반복 요일을 바꾸려면 계획 편집 →".
- 캘린더 표시: 예외일은 changed 마커 + 툴팁 "원래 계획: 불참 → 이 날만 참가", 선택 시 원래 계획 회색 고스트 병기. 기간표 Space는 즉시 저장이 아니라 이 대화상자를 연다.

### 복원 (spec:543-547)
- 백업 선택은 아무것도 덮어쓰지 않는다. 화면 순서: 백업 시각(절대+상대)·크기 → 변경량 preview(업체/행사/계획/예외/일정 ±n) → "현재 상태를 스냅샷으로 저장합니다" 문장 → 확인 버튼 "현재 상태를 스냅샷으로 저장하고 복원". preview 로딩 전에는 U3 사유와 함께 비활성. 진행은 ProgressBar.
- 복원 후 세션 내 상시 MessageBar "복원됨 · 복원 취소(스냅샷으로 되돌리기)", 같은 명령이 팔레트에도 남는다.

### 위젯 이동 / 창 (spec:232-261, spike:63-82)
- 기본 Locked: 드래그 불가·포커스 없음(tok:76-79). Layout Edit 진입은 트레이·컨텍스트 메뉴·단축키 3경로. 편집 모드: 1px 경계 + drag handle + 모드 라벨, 방향키 1px / Shift+방향키 8px, [기본 위치], Enter 저장 후 Locked 복귀, Esc 취소·원위치.
- 위치는 작업 영역으로 clamp, 모니터 소실 시 primary 안전영역(spike:139-142). 트레이에 [위젯 위치 초기화] 상시. 전역 단축키는 항상 위젯을 보이는 곳으로 가져온다. 등록 실패를 감지해 즉시 설정 안내(spike:95-97). 모든 drag에 명령 대체(spec:261).
- 클릭통과 함정(이 위젯의 최대 시행착오 = "클릭했는데 반응 없음"): 켤 때 1회 알림 "클릭 통과 켜짐 · <단축키>로 활성화 · 트레이에서 끄기", 트레이 아이콘·툴팁에 상태 상시 표시, 단축키로 활성화됐을 때 첫 1회 같은 안내. 위젯은 hover를 못 받으므로 위젯 안 표시는 잠금 글리프(regular) 하나만.

### 발견성 (조용한 방향의 주 리스크, spec:168-174)
- 네 경로로 해결하고 버튼 줄 추가는 마지막 수단: ① hover/focus reveal ② 명령 팔레트+검색 ③ 모든 메뉴 항목에 단축키 표기 ④ 빈 상태·인스펙터 미선택 화면이 곧 안내(as/references/desktop.md:220-226).
- 첫 사용 가이드: 최초 1회 TeachingPopover 3단계(활성화 단축키 → 클릭하면 펼침/`N` → 트레이·기간표), 실제 요소에 anchor, 건너뛰기 가능, 트레이 [도움말 다시 보기]. 모달 투어 금지(spec:172).
- hover/focus reveal: 명령 슬롯을 항상 예약하고 opacity만 0→1(100ms). 레이아웃이 흔들리면 목록을 읽을 수 없다. 키보드 포커스에서도 같은 노출(as/references/desktop.md:173-180).
- Ctrl+K 명령 팔레트: 모든 명령 + 업체/행사/일정 검색, 한글 초성 검색(ㄱㅅ → 고성수산) [훈련지식], 항목마다 단축키, 최근 항목 우선. 모든 명령은 컨텍스트 메뉴와 팔레트 양쪽에 같은 라벨·같은 단축키로 존재(spec:173).
- 단축키 힌트: MenuItem secondaryContent, 모든 아이콘 버튼 Tooltip에 단축키, `?`로 단축키 시트. 컨텍스트 메뉴는 우클릭·Shift+F10·Menu 키에서 같은 항목.

### 상태·문구
- 상태 5종 고정 한국어(tok:59-65): confirmed=확정 / needs_attention=확인 필요 / changed=변경됨(툴팁·인스펙터 전체형 "이 날짜만 변경") / cancelled=불참(업체 참가)·취소(일정/행사) / linked=연결됨. 동의어 혼용('미확인', '체크 필요', '예외', '주의') 금지. 각 문구는 해석이 하나뿐이어야 한다.
- 요약은 결론형 자동 생성: "오늘 7건 · 확인 필요 3", "금·토 참가 · 12/25 제외"(spec:61; as/references/dataviz.md:100-113). 축 라벨형("오늘 일정", "참가 정보")만 있는 화면은 미완성.
- 빈 상태는 다음으로 유용한 사실: "오늘 일정 없음 · 다음 9/12(금) 고성청과". 삽화·점선 박스·범용 문장 금지.
- 로딩: 300ms 미만 무표시, 이상이면 행 높이 유지 Skeleton. 스피너는 1초 넘는 Dialog 작업에만(as/domain-map.json:283).
- 오류: 원인 + 다음 행동 한 줄, MessageBar(수동 닫기, 재시도). 사라지는 토스트로 오류를 알리지 않는다. 첨부 부재는 파일명 유지 + "파일 없음 · 위치 찾기".
- 충돌: 계획 밖 예외, 같은 업체×행사 중복 계획, 계획 편집으로 무의미해진 예외 = 셀 마커 + 인스펙터 '충돌' 섹션 + 해결 명령.

## 판단 원칙(왜)
- 진입점이 의미를 정한다: 같은 UI에서 범위를 고르게 하지 않는다(spec:59). 범위 선택 UI는 항상 잘못 선택된다.
- 되돌리기 > 확인. 라벨은 결과를 말한다: 버튼·제목·요약은 축 라벨이 아니라 결론.
- 위계는 두 축으로만: 크기 1회 + 굵기 배급 + 전경색 tier. 정렬축이 상자를 대신한다 — 같은 열의 텍스트는 같은 x에서 시작하고 숫자는 tabular로 세로 정합(spec:45, 53; as/references/dataviz.md:145-164).
- 색은 상태의 세 번째 채널: 형태·텍스트가 먼저(spec:373; as/references/color-systems.md:196-215). 두 출처가 독립적으로 같은 답 → 협상 불가.
- 밀도는 기능, 숨김은 실패: 존재 이유가 '누가 오는가'이므로 +N more는 기능 실패다(spec:54, 111). Layer 0에는 상한(정보 4개), Layer 2에는 하한(이름 완전 표시)이 걸린다.
- 절제는 두 종류: 밀도·모션·chrome은 devtools 프로필에서, 최소 글자 크기·색 단독 금지·이름 숨김 금지는 government 프로필에서 가져온다(as/domain-map.json:191-286, 570-666). 다크 기본과 bento는 가져오지 않는다.
- 정지가 기본, 움직임은 정보: 껐을 때 잃는 정보가 있으면 정적 표현으로 옮긴다(as/references/anti-patterns.md:154-155).
- 감각 테스트 4종을 리뷰 절차로 고정: 회색조 스크린샷 / 블록에 박스 그리기 / 문구 소리 내어 읽기 / 모션 0(as/references/anti-patterns.md:100-155).
- 실데이터 경계로만 검수: 18자+ 업체명, 0/1/23건, 동명 2곳, 하루 25곳, 예외 3개 겹친 주, 100~175% DPI(spec:551-566; oc/prompts/craft-directives.v1.txt:14-20).
- 목표는 '다르게'가 아니라 '의도적으로'. 최종 질문: "이 UI가 다른 일정 앱과 바꿔치기 가능한가?" 가능하면 업체×날짜·예외일·확인 필요 축에 다시 묶는다(oc/prompts/design-methodology.v1.txt:16-17).

## 레이어별 규칙(Layer 0-3)
### 공통 — 공개 리듬
- 앞으로 = 클릭/Enter 1회, 뒤로 = Esc 1회, 되돌아오면 포커스는 떠난 자리로 복귀(as/references/desktop.md:195-200). L0→L1은 같은 창의 확장(구현 방식은 결정 사항), L1→L2는 별도 top-level 창, L2→L3는 창 안의 pane. F6로 pane 순환.

### Layer 0 — Ambient Widget (320×110, spec:67-88)
- [사용성] 표시는 날짜(요일) / 오늘 N / 확인 필요 N / 가장 가까운 일정 1(~2)건뿐. rest에서 버튼·입력·아이콘 줄·테두리·그림자 0. 클릭 = Layer 1(spec:81). 활성 상태 hover/focus 시 예약 슬롯에 명령 2개(펼치기/잠금)만 100ms opacity로 등장, 첫 1회 단축키 칩.
- [사용성] 시계 없음, 분 단위 갱신, 자정·절전 복귀·포커스 복귀 시 재계산(spike:192-198). 배경 불투명(Mica 또는 폴백), 텍스트 대비 4.5:1 바탕화면 무관 보장. 그라디언트·글래스 금지.
- [사용성] aria-label 완전 문장("9월 24일 수요일, 오늘 일정 3건, 확인 필요 1건, 다음 14시 고성수산"). 빈 상태 "오늘 일정 없음 · 다음 9/12(금) 고성청과". 로딩 = 마지막 값 유지 + 83ms 크로스페이드. DB 오류 시에도 날짜는 표시 + "데이터를 열 수 없음 · 클릭해 자세히". 빈 위젯은 존재하지 않는다.
- [사용성] 확인 필요는 빈 링 마커 + 숫자 + Bold로 표시하고 배경 채움·pill·맥동·빨간 배지 금지 — 주변시야 상시 경보는 방해 금지(spec:34) 위반. Layer 0에서 semantic 색은 확인 필요 1곳에만 저채도로 허용 [Claude 제안].
- [정체성] 큰 글자는 날짜 하나(28/36 Bold tnum), 가장 가까운 일정 14/20 Bold, 나머지 12/16 secondary. 앵커는 카운트가 아니라 '다음 일정 한 줄' — 건수는 행동을 유발하지 않고 다음 일정은 유발한다. 구분자 문법("9/24(수) · 3 · 확인 1 · 14:00 고성수산")은 툴팁·aria로 보완. 한 줄 절단 우선순위: 시각 > 업체명 > 업무명(업무명 먼저 줄임).

### Layer 1 — Today / Upcoming (spec:90-100)
- [사용성] 데이터로 시작한다. 순서: 오늘 전체 → 확인/연락 필요 → 다음 일정. 유일한 제목은 결론형 한 줄("오늘 7건 중 3건 확인 필요"); KPI 타일·통계 행 금지(spec:52).
- [사용성] 행 = [시각 tabular 5ch][모노그램/사무일정 마커 슬롯][업체·제목][상태 마커+문구][예약 명령 슬롯 2: 체크·열기]. 각 열 x좌표는 모든 행에서 동일. Space=체크(즉시 저장+undo), Enter=인스펙터, Ctrl+N=Quick Add, Ctrl+2=캘린더. 주 CTA는 [캘린더 열기] 하나(spec:161).
- [사용성] 상시 검색창 없음 — Ctrl+K 또는 타이핑 시작. 페이지네이션 금지, 가상 스크롤 + Home/End. 목록은 stagger 없이 컨테이너만 페이드. 닫기 = Esc / 단축키 재입력 / 바깥 클릭(dirty guard), 닫히면 Layer 0 크기·위치로 정확히 복귀.
- [사용성] 빈 상태: '다음 3건'을 대신 보여주고 마지막 줄에 "일정 추가 Ctrl+N · 캘린더 Ctrl+2" caption(발견성 경로 ④).
- [정체성] 가장 가까운 일정 1건이 시각적 주인공, 숫자는 그 옆 부가 정보. 선택 = 배경 subtle + 좌측 2px 액센트 레일, 텍스트 굵기는 바꾸지 않는다(레이아웃 흔들림 방지).

### Layer 2 — Calendar Workspace (spec:102-117)
- [사용성] 일반 top-level 창(작업표시줄·스냅·Alt+Tab 정상). 창을 채운다, max-width·햄버거 금지(spec:56-57). chrome은 명령 행 1줄: [월간|주간|기간표 TabList 1/2/3][◀ 오늘(T) ▶ 월 이름 `[` `]`][검색 `/`][명령 Ctrl+K]. 내비 rail 기본 OFF.
- [사용성] 월간: 업체명 직접 표시, +N more 금지(spec:109-111). 주 행 높이 = (헤더 24 + 행단위×n + 8)의 4px 정수배로만 성장, 애니메이션 없이 즉시 재조판. ≤8곳 1열, 9~16곳 셀 내부 2열, 17곳 이상 행 성장 + 셀 모서리 "이 주를 기간표에서 보기"(숨김이 아니라 뷰 전환 제안). 요일 헤더 1자(월…일).
- [사용성] 오늘 = 열 배경 1단계 + 날짜 Bold + 1px 상단 룰. 액센트 원형 배지 금지 — 액센트를 '오늘'에 소진하면 선택 표시와 충돌(oc/design-skills/calendar.jsx:75-82). 주말 = 배경 1단계.
- [사용성] 기간표: role=grid + roving tabindex + aria-colindex(as/references/accessibility.md:112), 고정 헤더 행/열, 업체명 열 고정폭(normal 200/compact 160, 초과 시 2행), 날짜 열 균등 + tabular 헤더. 셀 테두리 없음 — 주 경계 1px, 오늘·주말 열 배경만, hover 십자 하이라이트. 셀 내용은 상태 마커만, 색 범례 상시 노출 금지.
- [사용성] 키보드: 방향키 셀 이동, Enter=인스펙터, Space=하루만 변경 대화상자, Home/End, Menu 키/Shift+F10 컨텍스트 메뉴(새 일정 / 이 날짜만 수정 / 인스펙터에서 열기, 각 단축키). '계획 편집'은 여기 없음. 포커스 링 항상 표시.
- [사용성] 사무일정 vs 업체일정은 시작 글리프(모노그램 사각 vs 6px outline 사각)로 구분, 종류 2종 고정(spec:112). 예외일은 changed 마커 + 원래 계획 고스트. 로딩 = 이전 격자 유지 + Skeleton, 빈 달 = 격자 그대로, 오류 = pane 상단 MessageBar.
- [정체성] 기간표를 1급 뷰로(업체 20곳 이상이면 기본 뷰 후보, spec:114-117). 매트릭스 data-ink 최소화. 표면: 창 Base = Mica, pane = colorNeutralBackground1 + 1px stroke + radius 8, 그림자 없음.

### Layer 3 — Inspector (spec:119-144)
- [사용성] 라벨-값 세로 목록, 섹션 순서 spec:122-144 그대로. 섹션 카드·원형 아이콘 배지·3열 균등·좌측 색 바 금지(spec:53). 섹션 구분 = 12px 공백 + Caption 라벨 + 1px 룰. 엔티티명 20/28 Bold keep-all 2행 허용.
- [사용성] 단일 필드는 인라인 편집(클릭→편집, Enter/blur 저장, Escape 복귀, undo 토스트). 참가계획·예외·삭제·복원은 전용 Dialog(범위 오류 방지). 참가 요약은 자동 생성 결론형, [계획 편집]이 전체 변경의 유일한 진입점.
- [사용성] 변경 이력 100건·첨부 20개 가상 스크롤, 이력 항목마다 [이 값으로 되돌리기] + 절대시각(spec:321-328, 559-560). 품목 8개+는 칩이 아니라 줄바꿈 텍스트 목록. 동명 업체 경고, 모노그램 오버라이드 필드, 충돌 섹션.
- [사용성] 미선택 상태 = 안내 화면("날짜·업체·행사를 선택하면 여기에 표시" + 단축키 8개). 위치 right/left/bottom/detach + [기본 배치]는 컨텍스트 메뉴·팔레트에 단축키와 함께 상시(spec:243-247, 261), drag는 Layout Edit에서만. 최소 320 / 최대 480, 비율 기억, 접힘 시 캘린더 100%. 열림 200ms, Esc 닫힘 160ms 후 포커스는 선택 셀로 복귀.
- [정체성] 캘린더:인스펙터 ≈ 2.4:1(1fr 1fr 금지). 액센트는 현재 선택 엔티티 표시 1곳뿐.

## 타이포그래피·한글 (ADR-0003 — 공무원 서식 기반 맑은 고딕)
- [사용성] 서체 결정 [사용자 결정]: 부서 보고서 양식(제목·소제목 HY헤드라인M / ❍ 1단 휴먼명조 / • 2단·❖ 요약 맑은 고딕 / ▣ 추진부서 굴림)을 따라 UI 본문·제목 서체는 **맑은 고딕(시스템)**. 스택 `"Malgun Gothic","맑은 고딕","Segoe UI Variable Text","Segoe UI","NanumGothic","Noto Sans KR",sans-serif` — 맑은 고딕을 선두에 두어 한글·라틴·숫자를 한 서체로 조판(기준선 불일치 방지). Fluent v9 `fontFamilyBase`는 테마에서 이 스택으로 오버라이드, `fontFamilyNumeric`(Bahnschrift) 금지. HY헤드라인M·휴먼명조·굴림은 한컴 동봉 인쇄용 서체라 화면 UI에 쓰지 않는다(인쇄 뷰에서 `local()` 존재 시 선택, Phase 6).
- [사용성] 서식 대응: 제목·소제목 → anchor/title(맑은 고딕 700), ❖ 요약 → bodyStrong 결론형 요약 한 줄, • 2단 항목 → body 14/20, ❍ 1단(명조) → 섹션 caption 라벨, ▣ 추진부서 → 미사용.
- [사용성] 굵기는 **400/700만**. 맑은 고딕에는 Semibold가 없어(Regular/Bold/Semilight) 600 요청은 합성 굵기가 된다 → 모든 강조는 700. 뷰당 Bold ≤2(앵커 + 선택/오늘). 300·italic 금지. 계층은 크기 + 전경색 tier(Foreground1/2/3) + 좌측 정렬선으로.
- [사용성] 램프(normal, 단계 건너뛰기 금지): anchor 28/36·700(위젯 날짜만) / title 20/28·700(인스펙터 엔티티명·월 제목) / subtitle 16/22·700(섹션·선택 항목명) / body 14/20·400 / bodyStrong 14/20·700(결론형 요약) / caption 12/16·400 secondary / micro 11/14(라틴·숫자 전용: 단축키 칩·모노그램). compact는 글자 크기를 내리지 않고 행 높이·패딩만 줄인다. 13px·15px 등 램프 밖 값 금지 — 2px 계단은 위계가 아니라 경사(as/references/typography.md:298-302). Fluent v9 대응: title2 28/36, subtitle1 20/28, subtitle2 16/22, body1 14/20, body1Strong, caption1 12/16.
- [사용성] 한글 하한 12px(125% DPI에서 자모가 뭉개진다 [훈련지식]; government 프로필의 최소 글자 크기 원리 as/domain-map.json:653-665).
- [사용성] 숫자 전부 `font-variant-numeric: tabular-nums`(날짜·시각·건수·전화). 시각 `HH:mm` 24시간 선행 0(5ch), 날짜 `9/24(수)` 우측 정렬, 전화 `010-0000-0000`. 맑은 고딕의 tnum 지원은 Windows 실측 항목 [미확인] — 미지원이면 숫자 슬롯을 px 고정폭으로.
- [사용성] 한글 자간 0. 영문/숫자 라벨(요일 약어·단축키)만 +0.02~0.05em, 위젯 날짜 숫자만 −0.01em. 대문자·자간 벌린 한글 라벨 금지(한글에 대문자 없음 → uppercase tracking 규칙은 '자간 벌린 한글'만 남긴다).
- [사용성] `word-break: keep-all` + `overflow-wrap: anywhere`(극단만). 업체명은 말줄임 대신 2행 + 툴팁; 고정 높이 구간(위젯·기간표)은 말줄임 + 툴팁 전체명 필수(spec:111). 정렬은 전부 좌측, 가운데는 요일 1자·모노그램 글자만, 숫자 열은 우측.
- [사용성] line-height는 항상 px 명시, `normal` 금지(맑은 고딕 메트릭 편차). 단행은 램프값, 다행 한글(메모·이력·툴팁)은 1.55 — 한글은 em-box를 채워 같은 px에서 라틴보다 빽빽하다 [훈련지식]. `65ch` measure는 한글에 무효(ch='0' 폭) → 산문 필드만 px 상한 480~560.
- [사용성] Linux 개발 환경에는 맑은 고딕이 없어 NanumGothic으로 대체 렌더한다(저장소 미포함). 프로토타입의 font-guard가 실제 렌더 서체를 화면·결과표에 기록하고, 조판 승인은 Windows 열람 후로 유보한다.
- [정체성] 폰트 교체가 아니라 tabular + 굵기 배급 + 정렬축이 이 제품의 목소리다. 화면에 큰 글자가 딱 하나뿐이라는 규율이 인상을 만든다.

## 색·상태·모노그램
- [사용성] 토큰 3계층(as/references/color-systems.md:44-89): 1계층 Fluent v9 theme 토큰(라이트/다크/HC 램프 검증됨) → 2계층 제품 semantic(surface.*, state.*, accent.*) → 3계층 컴포넌트. 컴포넌트에 hex 직접 기입·#fff/#000 하드코드 금지.
- [사용성] 액센트 1개, 의미는 "Enter가 향하는 곳"뿐: 선택 레일, 포커스, 활성 탭, 대화상자 primary 버튼(화면당 1개). 상태·브랜딩·'오늘'에 금지(spec:44; as/references/color-systems.md:257-260). Fluent 기본 brand 파랑을 검토 없이 쓰는 것은 '따름'이 아니라 '방치'. Fluent 컴포넌트가 brand를 쓰는 지점(Button primary, Checkbox checked, Tab selected)은 화이트리스트로 전수 점검.
- [사용성] 상태 5종 = 형태 + 텍스트 + 색 3중 부호. 형태 어휘: confirmed 채운 점 / needs_attention 빈 링 + 좌측 2px 실선 레일 / changed 점+사선 또는 점선 레일 + 원계획 고스트 / cancelled 이름 취소선 + Foreground3 / linked hairline 커넥터 + Link regular. 회색조 스크린샷에서 5종이 구분되어야 통과(as/references/accessibility.md:293).
- [사용성] 상태 색은 hue와 lightness가 모두 다르고 밝기 순서 고정: cancelled(가장 흐림) < linked < confirmed < changed < needs_attention(가장 진함)(as/references/color-systems.md:217-223). 액센트 hue와 changed hue는 oklch 60° 이상 이격. 값은 빌드 타임 oklch 계산 후 hex로 굽고 런타임 oklch() 없음.
- [사용성] 아이콘 regular=비활성 / filled=선택·활성(spec:344-346; tok:66-75)이 상태의 이중 부호. 이모지·혼합 패밀리 금지. 우선 에셋(spec:349-367) → icons.ts 매핑표 고정.
- [사용성] 업체별 색 배정 금지(spec:55). 모노그램: 법인격 접두어(주식회사/㈜/(주)/농업회사법인/영농조합법인/합자회사/유한회사) 제거 → 첫 1음절 → 충돌 시 2음절 → 재충돌 시 2음절+지역 → 사용자 오버라이드. 무채색 정사각(radius 4, 1px colorNeutralStroke1, 배경 없음, 700, 16/20px), 원형·해시 색·Avatar 금지(oc/prompts/artifact-types.v1.txt:44). 이름이 들어갈 폭이 있으면 이름이 우선.
- [사용성] 표면 6종(tok:51-58) 매핑: window=colorNeutralBackground1(창 Base는 Mica) / widget=Mica(불투명, Win11, Tauri windowEffects; 투명효과 OFF·Win10 폴백 colorNeutralBackground2) / pane=colorNeutralBackground1 / flyout=colorNeutralBackground1 + shadow16(Acrylic은 light-dismiss 표면에만 — learn.microsoft.com materials) / selected=colorNeutralBackground1Selected + 좌측 2px accent 레일 / attention=채움 없음, 레일 + Foreground1 텍스트. 그림자는 flyout/dialog에만.
- [사용성] 테마: Windows 라이트/다크 추종(prefers-color-scheme), 다크는 Fluent dark 토큰 그대로(순흑 금지). forced-colors: 배경 톤으로만 구분되던 오늘 열·주말·선택 행·레일은 1px CanvasText 경계 또는 Highlight/HighlightText로 치환, 비활성만 GrayText, 컨트롤 ButtonFace/ButtonText, flyout/dialog 2px 경계, 상태 형태 마커 유지(learn.microsoft.com high-contrast-themes; as/references/accessibility.md:239-277). 4개 내장 대비 테마 전부 테스트.
- [정체성] 위젯/pane 배경에만 warm tilt(chroma ≤0.01~0.02, 라이트 전용, 다크·HC 해제), 텍스트·보더·컨트롤은 Fluent 그대로(oc/prompts/anti-slop.v1.txt:26). 색이 늘어나지 않는데 상태가 늘어나는 것이 이 제품의 색 언어다.

## 간격·그리드·밀도
- [사용성] 4px 기준 그리드, spacing은 토큰 9종만(tok:15-24). 사용 규칙: pane 간 20/24, 섹션 12/16, 행 간 6(또는 행 높이가 리듬), 행 내부 4/2. 한 화면에 spacing 4종 이상 나타나야 계층이 있는 것(as/SKILL.md:199-207).
- [사용성] radius 4단계를 역할대로 정확히(tok:26-32 = Fluent borderRadiusMedium 4 / Large 6 / XLarge 8 / 2XLarge 12): control 4 / compact surface(칩) 6 / pane 8 / floating·flyout 12. 999px 알약·표면 중첩(카드 안 카드) 금지.
- [사용성] compact/normal은 배율이 아니라 두 조판: 행 높이 24/28(4의 배수), 셀 패딩 4/6, 모노그램 16/20, 컨트롤 28/32, 월간 셀 2열 임계 12곳/9곳, 기간표 날짜 열 최소 28/32. 글자 크기 고정. 기본값은 normal [Claude 제안], v0.1의 '중간'은 폐기(F38). 밀도 토글은 팔레트·설정에 노출, 즉시 반영·저장.
- [사용성] 클릭 타깃 최소 24×24, Fluent 컨트롤 32 [훈련지식: WCAG 2.5.8]. DPI: CSS px = DIP, 1px 경계는 1px CSS 유지, 소수 px 금지, 100/125/150/175% 스크린샷 검수(spike:147-152). 1366×768에서 하루 25곳이 기간표로 보이는지가 최소 요건(spec:556, 563).
- [사용성] 비대칭은 정보 비중만: 캘린더:인스펙터 ≈ 2.4:1, 위젯 날짜블록:일정블록 ≈ 1:2.6, 기간표 업체명 열 고정 + 날짜 열 균등. 7열 격자·날짜 열의 대칭은 비교 기능이므로 절대 보존(as/references/layout-spacing.md:555-563). bento·1fr 3열·오버랩 금지.
- [사용성] 그림자는 flyout/menu/분리 창에만(shadow16/28). pane·셀·행 없음.

## 모션
- [사용성] 예산표(코드 토큰으로 고정, 그 외 모션 0; tok:33-50 ↔ Fluent durations): hover in 120 / out 100, selection in 140 / out 120, paneExpand in 200 / out 160, layout 220, 위젯 데이터 크로스페이드 83 linear(Windows 'Bare Minimum'). exit < entry(as/references/animation-motion.md:36-38). 커브: 진입 curveDecelerateMid (0,0,0,1), 상태 전환 curveEasyEase (0.33,0,0.67,1), 퇴장 curveAccelerateMid. 스프링·바운스 금지.
- [사용성] reduced-motion은 제거가 아니라 대체: translate → opacity 83ms linear, stagger 0, 로딩·저장 진행 표시는 유지(spec:401; as/references/accessibility.md:196-209). 위젯은 켜고 끈 상태가 같아야 정상.
- [사용성] transform/opacity만 애니메이트. width/height/top/left/grid-template 금지. 인스펙터 폭 전환은 translate + clip, 주 행 높이 성장은 즉시 재조판(as/references/animation-motion.md:170-190).
- [사용성] 명명 키프레임 2개뿐: `paneExpand`(opacity + 4px translate), `attentionOnce`(확인 필요 항목 최초 등장 1회 fade). breathe/pulse/stagger/hover lift/scale/pressed scale 금지(oc/prompts/craft-directives.v1.txt:76-87 폐기). hover·pressed는 배경 토큰 1단계 전환만.
- [정체성] 위젯은 움직이지 않는다 — 83ms 크로스페이드가 유일한 모션. 정지가 결정이다(spec:34). 하루 수십 번 여는 표면에서 지속시간이 지각되면 이미 느리다.

## 컴포넌트·Fluent 매핑
| 용도 | Fluent UI React v9 / 구현 | 규칙 |
|---|---|---|
| Quick Add | Popover(비모달) 또는 인라인 폼 + Field/Input/DatePicker/SpinButton | 제목+일시 필수, 해석 결과 한 줄, Enter=저장(조합 중 제외), Esc=닫기+초안 보존 |
| 계획 편집 / 하루만 변경 / 복원 / 삭제 | Dialog(modal) + preview 영역 | 제목에 범위, 버튼에 영향 수, 취소 기본 포커스, 닫힘 후 포커스 복귀, HC 2px 경계 |
| 하루만 변경 선택 | RadioGroup(이 날만 참가/불참) + Textarea(이유) | 계획 필드 노출 금지 |
| 명령 팔레트 | Dialog(non-modal) + Combobox/listbox | Ctrl+K, 초성 검색, 단축키 표기, 최근 우선 |
| 컨텍스트 메뉴 | Menu(openOnContext) + MenuItem secondaryContent | 우클릭·Shift+F10·Menu 키 동일, 모든 drag에 명령 대체 |
| 툴팁 | Tooltip(400ms 지연) | 키보드 포커스에도 표시, 전체 업체명·단축키·상태 설명 |
| 뷰 전환 / 명령바 | TabList + Toolbar | 단축키 1/2/3, 활성 탭만 accent |
| 요일 선택 | Checkbox/ToggleButton 7개(월~일) | 자유 입력 금지, 0개면 U3 사유 |
| 업체/행사 선택 | Combobox(freeform 금지, 초성 검색) | 신규 생성은 명시 항목 `+ 새 업체` |
| 인라인 오류 / 시스템 오류 | Field validationMessage / MessageBar(intent=error) | 토스트로 오류 금지, 재시도 포함 |
| 저장 피드백/undo | Toaster + action "실행 취소" 8초 | 되돌릴 수 있는 모든 변경, 포커스 훔치지 않음 |
| 첫 사용 안내 | TeachingPopover 3단계 | 실제 요소 anchor, 모달 투어 금지 |
| 인스펙터 | InlineDrawer(도킹) / 분리 시 새 WebviewWindow | 열림 200 / 닫힘 160, IPC 동기화 |
| 상태 표시 | 커스텀 marker + 텍스트 | Badge/pill 사용 안 함 |
| 목록 | 가상 스크롤(react-window) + 표준 button 행 | 페이지네이션 금지 |
| 캘린더·기간표·위젯 | 커스텀 role=grid + useArrowNavigationGroup | roving tabindex, DataGrid 미사용(2D 고정 헤더) |
| 로딩 | Skeleton(행 높이 유지) / ProgressBar | Spinner는 1초 넘는 Dialog 작업에만 |
| 포커스 | createFocusOutlineStyle(2px colorStrokeFocus2 + 1px colorStrokeFocus1, ::after, focus-visible) | outline:none 금지, forced-colors Highlight, 커스텀 셀 포함 예외 없음 |
| 아이콘 | @fluentui/react-icons bundleIcon(Regular, Filled) | regular=비활성, filled=활성, 이모지·타 패밀리 금지 |
| 모노그램 | 커스텀 | Avatar 금지(원형·색) |
| 위젯 표면 | Mica(Tauri windowEffects, Win11) → 폴백 colorNeutralBackground2 | 투명·Acrylic 상시 금지 |
- 테마 오버라이드 화이트리스트: `fontFamilyBase`, brand ramp(createLightTheme/createDarkTheme), duration 매핑, 위젯 surface. 그 외 Fluent 기본 유지.
- Tauri: 잠금 창 focusable=false + ignoreCursorEvents 토글, Layer 1 이상은 활성화된 표면 [훈련지식]. DOM 내 flyout에는 OS 재질을 적용할 수 없으므로 불투명 + shadow16.

## AI-슬롭 체크리스트(이 제품용)
각 항목은 "예"면 실패다.
1. 상단에 같은 크기의 stat 타일이 2개 이상 나란히 있는가?(spec:52)
2. 일정 한 건·인스펙터 섹션·위젯 줄이 각각 테두리+radius+패딩 카드로 감싸져 있는가?
3. 어떤 셀·목록에 "+N" / "외 N곳" 접기가 있는가?(spec:54)
4. 업체에 색이 배정되어 있거나 모노그램이 원형/채색/이름 해시인가?(spec:55, 369-373)
5. 오늘 날짜가 액센트 원형 배지인가?
6. 상태가 pill 배지·빨간 배지·맥동 점이거나 색만으로 구분되어 회색조에서 무너지는가?
7. 액센트가 선택·포커스·활성 탭·primary 버튼 외의 곳(상태·오늘·브랜딩)에 쓰였는가?
8. 모든 표면의 radius가 같거나 999px 알약이 있는가?
9. pane·셀·행에 그림자가 있거나 위젯 배경이 그라디언트/글래스/순백/순흑인가?
10. hover에 scale/translateY/그림자 상승, pressed에 scale이 있는가?
11. 목록 진입에 stagger가 있거나 위젯에 맥동·초 단위 시계·'동기화됨' 표시가 있는가?
12. 한글 라벨에 자간이 있거나, 한글이 12px 미만이거나, 요일이 영문 3자인가?
13. 굵기가 400/700 외에 있거나, 램프 밖 크기(13/15px)가 있거나, 한 뷰에 Bold가 3곳 이상인가?
14. 숫자 열이 tabular-nums 없이 비례폭이라 세로 정렬이 흔들리는가?
15. 시안/픽스처 데이터가 '업체A/행사1/Team Standup' 같은 가짜이거나 18자+ 이름·0건·25곳 경계가 없는가?
16. 캘린더가 창 폭을 채우지 않고 중앙 max-width 안에 있거나 햄버거·페이지네이션·상시 검색창이 있는가?(spec:57)
17. 위젯 rest 상태에 버튼·입력·아이콘 줄·☰ 메뉴가 있는가?(spec:83-88)
18. 빈 상태에 일러스트·점선 박스·"아직 일정이 없습니다"류 범용 문장이 있는가?
19. 이모지가 아이콘으로 쓰였거나 Fluent 외 아이콘 패밀리·승인되지 않은 웹폰트가 섞였는가?
20. `outline: none`으로 포커스 링을 지웠거나 hover로만 드러나고 키보드 포커스에서는 안 보이는 명령이 있는가?
21. 제목·요약이 결론이 아니라 축 라벨("오늘 일정", "참가 정보")뿐인가?
22. 텍스트 입력이 no-activate 위젯 창에 있거나, 한글 조합 중 Enter가 submit되는가?
23. Fluent 기본 brand 파랑·Bahnschrift 숫자를 검토 없이 쓰고 있는가?

## 산출물 자기검사(사용성 항목 먼저)
사용성(전부 통과해야 정체성 항목으로 넘어간다):
- [ ] 계획 편집과 하루만 변경의 진입점이 다르고, 대화상자 골격·제목·버튼 라벨이 범위를 말하는가?
- [ ] 되돌릴 수 없는 변경(계획/예외/복원/연쇄 삭제)마다 preview + 영향 수 확인이 있고, 되돌릴 수 있는 변경에는 확인 대화상자가 없는가?
- [ ] 모든 변경에 undo 경로(토스트 8초 / Ctrl+Z / 이력 되돌리기)가 있는가?
- [ ] 잘못된 값을 입력할 수 없는 컨트롤인가(날짜·시간·전화·요일·행사)? 비활성 버튼 옆에 사유가 있거나 버튼이 눌려 첫 오류로 가는가?
- [ ] 마우스 없이 위젯 → Layer 1 → 캘린더 → 기간표 셀 → 인스펙터 → 대화상자까지 도달·복귀되며 Escape가 한 단계씩 닫고 포커스가 떠난 자리로 복귀하는가?
- [ ] 한글 IME로 "고성수산" 입력 후 Enter 1회에 정확히 1건 저장되는가? 단축키가 한/영 상태와 무관한가? Layer 0 rest에 입력 요소가 없는가?
- [ ] 빈/로딩/오류/충돌 상태가 각 레이어에 설계되어 있고 문구가 다음 행동을 말하는가?
- [ ] 상태 문구가 고정 5어휘만 쓰고 각각 해석이 하나뿐인가?
- [ ] 첫 사용 가이드·Ctrl+K(초성 검색)·hover/focus reveal·단축키 힌트·트레이 [위치 초기화]·클릭통과 안내가 있는가? 모든 명령이 메뉴·팔레트·툴팁 중 두 곳 이상에 단축키와 함께 보이는가?
- [ ] 클릭통과 ON에서 열리지 않을 때 안내와 복귀 경로가 트레이·첫 실행 가이드에 있는가?
- [ ] 100/125/150/175% DPI, 1366×768, 라이트/다크/4개 고대비 테마에서 1px 경계·레일·포커스 링·오늘/주말/선택 구분이 유지되는가?
- [ ] 회색조 스크린샷에서 상태 5종과 선택이 구분되는가?
- [ ] 18자+ 업체명, 0/1/23건, 하루 25곳, 동명 2곳, 예외 3개 겹친 주 픽스처로 렌더했는가?
- [ ] reduced-motion에서 잃는 정보가 없는가? 명명 키프레임 2개 이하인가?
- [ ] 위 슬롭 체크리스트 23항이 전부 "아니오"인가?
정체성(사용성 통과 후):
- [ ] 화면의 큰 글자가 하나뿐이고, tnum이 켜져 있고, Bold 2곳 이하, 한글 자간 0인가?
- [ ] 회색조에서 날짜 / 업체명 / 상태 순서로 읽히는가? 레이아웃에 박스를 그렸을 때 같은 폭·가운데 정렬 블록의 반복이 없는가?
- [ ] 한 화면에 spacing 4종 이상, radius가 역할별로 다른가? accent가 "Enter가 향하는 곳"에만 있는가?
- [ ] 문구를 소리 내어 읽었을 때 어느 일정 앱에나 붙는 문장이 없는가?
- [ ] 이 UI가 다른 일정 앱과 바꿔치기 가능한가? 가능하면 업체×날짜·예외일·확인 필요 축에 묶어 다시 만든다.