# 명령 ↔ permission 요약 (정본: docs/spec/tauri_spike_order_v2.md §4; 불일치 시 정본 우선)

원칙: 창 전이는 Rust command 안에서 수행하고 프런트에는 앱 명령 권한(`allow-<command>`)만 부여한다. Tauri core 권한 식별자는 1차 문서로 재확인할 것 [1차 문서 확인 필요].

| 기능 | 구현 위치 | 필요 권한(프런트 직접 호출 시) |
|---|---|---|
| 잠금/클릭통과 전환 | Rust `set_click_through(bool)` | `core:window:allow-set-ignore-cursor-events` |
| Resting(항상 아래·작업표시줄 숨김) | Rust 창 초기화 | `core:window:allow-set-always-on-bottom`, `core:window:allow-set-skip-taskbar` |
| 활성화(포커스) | Rust `activate_widget()` | `core:window:allow-set-focus`, `core:window:allow-show` |
| 레이아웃 편집(이동) | Rust `begin_layout_edit()` / drag-region | `core:window:allow-start-dragging`, `core:window:allow-set-position` |
| 위치 저장/복원 | window-state 플러그인 | `window-state:allow-save-window-state`, `window-state:allow-restore-state` |
| 전역 단축키 | global-shortcut 플러그인(Rust 측 등록) | `global-shortcut:allow-register`, `allow-unregister`, `allow-is-registered` |
| 시작프로그램 | autostart 플러그인 | `autostart:allow-enable`, `allow-disable`, `allow-is-enabled` |
| 트레이 | core tray API(Rust) | `core:tray:default` |
| 알림 | notification 플러그인 | `notification:default` |
| SQLite | Rust storage command(rusqlite) | 앱 명령 `allow-list-today-tasks`, `allow-upsert-task` 등. `sql:*` 부여 금지 |
| 첨부 열기 | opener 플러그인 scope 한정 | `opener:allow-open-path` + scope `$APPDATA/<id>/attachments/**` |

PASS 조건에 "capabilities에 열거되지 않은 권한 0건, ACL 거부('not allowed') 로그 0건, 권한 오류를 catch로 은폐하지 않음"을 포함한다.
