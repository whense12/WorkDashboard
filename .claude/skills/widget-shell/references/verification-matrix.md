# 검증 항목 요약 (정본: docs/risk/spike-handoff-checklist.md)

원본 17항(spec §11) + 추가: 18 Win+D/바탕 화면 보기/Aero Peek 후 잔존·복귀 · 19 한글 IME 조합 중 포커스 이탈(click-through 토글·단축키) 시 손실/중복/크래시 없음 · 20 ACL 거부 0건 · 21 SmartScreen/보안 SW의 autostart 차단 여부 · 22 표준 사용자 계정 설치→실행→autostart · 23 멀티모니터 혼합 DPI · 24 WebView2 Runtime 존재/오프라인 설치 · 25 decorations:false+shadow 타이틀바 잔존 · 26 skipTaskbar 실동작.

결과는 PASS / FAIL / 미검증(Linux 작성) 3열. DPI 100/125/150/175% 스크린샷, cold start·idle RSS·CPU·활성 메모리·SQLite 지연 측정값 슬롯. 작성은 Linux 세션, 기입은 Windows.
