// Windows 에서 앱과 함께 검은 콘솔 창이 뜨지 않게 한다.
// 이 속성이 없으면 릴리스 빌드도 콘솔 서브시스템으로 링크되어, 앱이 살아 있는 내내
// 콘솔 창이 옆에 남는다. 리눅스에서는 드러나지 않으므로 CI 가 빌드된 exe 의
// PE 서브시스템을 검사해 다시 들어오는 것을 막는다.
// 개발 빌드에서는 콘솔 로그가 필요하므로 릴리스에서만 건다.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    work_calendar_helper_lib::run();
}
