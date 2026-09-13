# Fluent UI React v9 매핑 (9.74.7 / @fluentui/react-icons 2.0.339)

| 용도 | Fluent v9 / 구현 | 규칙 |
|---|---|---|
| Quick Add | Popover(비모달) + Field/Input/DatePicker/SpinButton | 제목+일시 필수, 해석 결과 한 줄, Enter=저장(조합 중 제외), Ctrl+Enter=저장 후 유지, Esc=닫기+초안 보존 |
| 계획 편집 / 하루만 변경 / 복원 / 삭제 | Dialog(modal) + preview 영역 | 제목에 범위, 버튼에 영향 수, 취소 기본 포커스, 닫힘 후 포커스 복귀, HC 2px 경계 |
| 하루만 변경 선택 | RadioGroup(이 날만 참가 / 이 날만 불참) + Textarea(이유) | 계획 필드 노출 금지 |
| 명령 팔레트 | Dialog(non-modal) + Combobox/listbox | Ctrl+K, 초성 검색, 단축키 표기, 최근 우선 |
| 컨텍스트 메뉴 | Menu(openOnContext) + MenuItem secondaryContent | 우클릭·Shift+F10·Menu 키 동일, 모든 drag에 명령 대체 |
| 툴팁 | Tooltip(400ms) | 키보드 포커스에도 표시, 전체 업체명·단축키·상태 설명 |
| 뷰 전환 / 명령바 | TabList + Toolbar | 단축키 1/2/3, 활성 탭만 accent |
| 요일 선택 | Checkbox/ToggleButton 7개(월~일) | 자유 입력 금지, 0개면 사유 |
| 업체/행사 선택 | Combobox(freeform 금지, 초성 검색) | 신규 생성은 명시 항목 `+ 새 업체` |
| 인라인 오류 / 시스템 오류 | Field validationMessage / MessageBar(intent=error) | 토스트로 오류 금지, 재시도 포함 |
| 저장 피드백/undo | Toaster + action "실행 취소" 8초 | 되돌릴 수 있는 모든 변경, 포커스 훔치지 않음 |
| 첫 사용 안내 | TeachingPopover 3단계 | 실제 요소 anchor, 모달 투어 금지 |
| 인스펙터 | InlineDrawer(도킹) / 분리 시 새 창 | 열림 200 / 닫힘 160 |
| 상태 표시 | 커스텀 marker + 텍스트 | Badge/pill 사용 안 함 |
| 목록 | 가상 스크롤 + 표준 button 행 | 페이지네이션 금지 |
| 캘린더·기간표·위젯 | 커스텀 role=grid + useArrowNavigationGroup | roving tabindex, DataGrid 미사용 |
| 로딩 | Skeleton(행 높이 유지) / ProgressBar | Spinner는 1초 넘는 Dialog 작업에만 |
| 포커스 | createFocusOutlineStyle(2px colorStrokeFocus2 + 1px colorStrokeFocus1, focus-visible) | outline:none 금지, forced-colors Highlight |
| 아이콘 | bundleIcon(Regular, Filled), 크기별 전용 컷(16/20/24) | regular=비활성, filled=활성, CSS 스케일·이모지 금지 |
| 모노그램 | 커스텀 | Avatar 금지 |
| 위젯 표면 | Mica(Tauri windowEffects, Win11) → 폴백 colorNeutralBackground2 | 투명·Acrylic 상시 금지 |

- 테마 오버라이드 화이트리스트: `fontFamilyBase`/`fontFamilyNumeric`, `fontWeightSemibold→700`, brand ramp(createLightTheme/createDarkTheme), duration 매핑, 위젯 surface. 그 외 Fluent 기본 유지.
- 우선 아이콘(spec:349-367) 19종은 `icons.ts`에 Regular/Filled 쌍으로 고정: CalendarAgenda, CalendarPeople, CalendarMultiple, CalendarCheckmark, BuildingPeople, PeopleTeam, TasksApp, Alert, Warning, History, Attach, PanelRightExpand/Contract, ReOrder, Search, Add, Edit, Delete, Clock, Link.
- 키보드: Tab 순서 논리적, 방향키는 복합 위젯 내부, Esc는 한 단계, F6 pane 순환, Shift+F10 컨텍스트 메뉴. 단축키는 `event.code` 판정.
