# Windows 플랫폼 리스크 요약 (정본: docs/risk/windows-platform-risk-register.md)

1. always-on-bottom ≠ Win+D 생존 — 바탕 화면 보기/Aero Peek이 최하위 창도 가린다. 대응: ADR-0004 3안, explorer 재시작 재부착. [1차 문서]
2. Tauri 권한 미명세 — ACL 거부가 창 동작 실패로 위장. 대응: 권한 매핑표·Rust command 래핑·ACL 0건 PASS 조건.
3. 미해결 이슈 — skipTaskbar Windows(tauri#10422), decorations:false+shadow:false(tauri#14859), WebView2 한글 IME 크래시(WebView2Feedback #5475). 대응: 실기 검증 항목 승격, WPF 폴백 판단 기준.
4. 배포 전제 — WebView2 Runtime(오프라인 설치 모드), 미서명 exe SmartScreen, per-user 설치, 망분리 시 updater 불가. 대응: deployment-prereqs 사전 확인표.
5. 위치 복원 — window-state는 모니터 식별자 미저장. 대응: POSITION만 + 경계 가드.
