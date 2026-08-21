use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
    Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder, WindowEvent,
};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};
use tauri_plugin_window_state::StateFlags;

/// 이 앱에는 메인 창이 없다. 세 조각이 각각 무장식·투명·작업표시줄 없음·항상 아래
/// (= 바탕화면 악세사리) 창으로 상주하고, 입력 폼만 pop 창으로 잠깐 열렸다 닫힌다.
/// 종료와 조각 보이기/숨기기는 트레이가 맡는다.
const PIECES: [&str; 3] = ["cal", "mini", "status"];

fn win(app: &tauri::AppHandle, label: &str) -> Result<WebviewWindow, String> {
    app.get_webview_window(label)
        .ok_or_else(|| format!("{label} window not found"))
}

/// WebView2 는 숨겼다 다시 띄운 창을 곧바로 다시 그리지 않고 검은 사각형으로 남겨 두는 일이 있다.
/// 창을 1px 늘렸다 되돌려 리페인트를 강제한다.
fn repaint(window: &WebviewWindow) {
    if let Ok(size) = window.outer_size() {
        let _ = window.set_size(tauri::PhysicalSize::new(size.width, size.height + 1));
        let _ = window.set_size(size);
    }
}

/// 조각은 바탕화면 레벨이다. 띄울 때 포커스를 뺏지 않는다 — 악세사리가 갑자기
/// 앞으로 튀어나오면 그게 곧 '창'이 되어 버린다.
fn reveal_piece(window: &WebviewWindow) {
    let _ = window.show();
    let _ = window.unminimize();
    repaint(window);
}

fn reveal_all(app: &tauri::AppHandle) {
    for label in PIECES {
        if let Some(w) = app.get_webview_window(label) {
            reveal_piece(&w);
        }
    }
}

/// 조각 창이 첫 렌더를 마쳤다고 알려 온다. 창은 `visible: false` 로 만들어 두고
/// 이 시점에 띄운다 — 빈 WebView2 가 먼저 뜨면 검은 사각형으로 보인다.
#[tauri::command]
fn piece_ready(window: WebviewWindow) {
    if PIECES.contains(&window.label()) {
        reveal_piece(&window);
    }
}

/// pop 창 안에서 첫 모달이 열렸다고 알려 온다. 창은 만들 때부터 보이지만,
/// 숨김→표시 전환에서 WebView2 가 검은/빈 사각형을 남기는 일이 있어 리페인트를 걸고
/// 포커스를 준다.
#[tauri::command]
fn pop_ready(window: WebviewWindow) {
    if window.label() == "pop" {
        let _ = window.show();
        repaint(&window);
        let _ = window.set_focus();
    }
}

/// pop 창은 마지막 모달이 닫히면 스스로 이 명령을 불러 사라진다.
#[tauri::command]
fn close_pop(window: WebviewWindow) {
    if window.label() == "pop" {
        let _ = window.close();
    }
}

/// URL 쿼리에 안전하게 넣기 위한 최소 퍼센트 인코딩.
fn urlenc(s: &str) -> String {
    let mut out = String::with_capacity(s.len() * 3);
    for b in s.as_bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(*b as char)
            }
            _ => out.push_str(&format!("%{:02X}", b)),
        }
    }
    out
}

/// 조각 창에서 입력 폼을 pop 창으로 연다. 폼 이름은 화이트리스트로만 받는다 —
/// 사용자 입력이 URL 로 흘러들지 않게 한다. payload 는 JSON 문자열 그대로
/// 퍼센트 인코딩되어 넘어가고, 화면 쪽이 다시 파싱한다.
#[tauri::command]
fn open_form(app: tauri::AppHandle, form: String, payload: String) -> Result<(), String> {
    let (w, h) = match form.as_str() {
        "schedule" => (620.0, 720.0),
        "work" => (620.0, 740.0),
        "detail" => (740.0, 780.0),
        "spend" => (620.0, 700.0),
        "budget" => (820.0, 680.0),
        "template" => (840.0, 720.0),
        "settings" => (620.0, 560.0),
        _ => return Err(format!("unknown form: {form}")),
    };
    let url = format!("index.html?w=pop&form={}&payload={}", form, urlenc(&payload));
    // 한 번에 하나. 이미 떠 있으면 같은 창을 새 폼으로 항해시킨다 — 닫고 다시 만들면
    // 같은 라벨이 아직 등록돼 있어 생성이 실패하는 경합이 있다.
    if let Some(existing) = app.get_webview_window("pop") {
        existing
            .eval(&format!("window.location.replace('/{url}')"))
            .map_err(|e| e.to_string())?;
        let _ = existing.set_size(tauri::LogicalSize::new(w, h));
        let _ = existing.show();
        repaint(&existing);
        let _ = existing.set_focus();
        return Ok(());
    }
    // 처음부터 보이게 만든다. visible:false 로 만들었다가 나중에 띄우는 방식은
    // 신호가 한 번이라도 어긋나면 "눌러도 아무 일도 안 일어나는" 보이지 않는 창을 남긴다.
    WebviewWindowBuilder::new(&app, "pop", WebviewUrl::App(url.into()))
        .title("입력 (pop)")
        .inner_size(w, h)
        .center()
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .skip_taskbar(true)
        .resizable(true)
        .maximizable(false)
        .visible(true)
        .focused(true)
        .build()
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// 설정의 '앱 종료' 버튼. 트레이 아이콘이 Windows 의 ^ 숨김 영역으로 들어가면
/// 사용자가 종료 경로를 못 찾는다 — 화면 안에도 하나 둔다.
#[tauri::command]
fn exit_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[tauri::command]
fn set_autostart(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    let manager = app.autolaunch();
    if enabled {
        manager.enable().map_err(|e| e.to_string())
    } else {
        manager.disable().map_err(|e| e.to_string())
    }
}

#[tauri::command]
fn is_autostart_enabled(app: tauri::AppHandle) -> Result<bool, String> {
    app.autolaunch().is_enabled().map_err(|e| e.to_string())
}

/// 조각이 이 화면 안에 온전히 들어와 있는가. 8px 는 그림자 여백 오차 허용.
fn fits(mon: &tauri::Monitor, pos: tauri::PhysicalPosition<i32>, size: tauri::PhysicalSize<u32>) -> bool {
    let mp = mon.position();
    let ms = mon.size();
    pos.x >= mp.x - 8
        && pos.y >= mp.y - 8
        && pos.x + size.width as i32 <= mp.x + ms.width as i32 + 8
        && pos.y + size.height as i32 <= mp.y + ms.height as i32 + 8
}

/// 첫 실행이거나 저장된 위치가 이 화면을 벗어나 있으면, 화면 크기에 맞춰 세 조각을
/// 다시 배치한다. 설정 파일의 고정 좌표는 1440px 이상 화면 기준이라, 그보다 좁은
/// 화면에서는 우측 열이 화면 밖으로 밀리고 시트가 잘렸다.
fn layout_pieces(app: &tauri::AppHandle) {
    let Ok(Some(mon)) = app.primary_monitor() else { return };
    let out_of_bounds = PIECES.iter().any(|l| {
        app.get_webview_window(l)
            .map(|w| match (w.outer_position(), w.outer_size()) {
                (Ok(p), Ok(s)) => !fits(&mon, p, s),
                _ => false,
            })
            .unwrap_or(false)
    });
    if !out_of_bounds {
        return; // 사용자가 잡아 둔 배치는 존중한다
    }
    let sf = mon.scale_factor();
    let px = |v: f64| (v * sf) as i32;
    let mp = mon.position();
    let ms = mon.size();
    let margin = px(14.0);
    let gap = px(12.0);
    let taskbar = px(52.0); // 작업 표시줄 자리
    let col_w = px(352.0).min(ms.width as i32 / 3);
    let usable_h = ms.height as i32 - taskbar - margin * 2;
    let right_x = mp.x + ms.width as i32 - margin - col_w;
    let cal_w = (right_x - gap) - (mp.x + margin);
    let mini_h = usable_h * 3 / 5;
    let status_h = usable_h - mini_h - gap;
    let place = |label: &str, x: i32, y: i32, w: i32, h: i32| {
        if let Some(win) = app.get_webview_window(label) {
            let _ = win.set_size(tauri::PhysicalSize::new(w.max(240) as u32, h.max(180) as u32));
            let _ = win.set_position(tauri::PhysicalPosition::new(x, y));
        }
    };
    place("cal", mp.x + margin, mp.y + margin, cal_w, usable_h);
    place("mini", right_x, mp.y + margin, col_w, mini_h);
    place("status", right_x, mp.y + margin + mini_h + gap, col_w, status_h);
}

fn toggle_piece(app: &tauri::AppHandle, label: &str) {
    if let Ok(w) = win(app, label) {
        if matches!(w.is_visible(), Ok(true)) {
            let _ = w.hide();
        } else {
            reveal_piece(&w);
        }
    }
}

/// ── 바닥 모드 ────────────────────────────────────────────────────────────────
/// 조각은 "창"이 아니라 바탕화면의 바닥이어야 한다 — 바탕화면 파일(아이콘) 뒤에.
/// Windows 에서 Progman 에 0x052C 를 보내면 배경화면을 그리는 WorkerW 가 아이콘
/// 레이어(SHELLDLL_DefView) 뒤에 생긴다. 조각 창을 그 WorkerW 의 자식으로 붙이면
/// 아이콘 뒤 바닥이 된다(DesktopCal·Wallpaper Engine 이 쓰는 기법).
///
/// 다만 이 자리에서는 클릭이 아이콘 레이어에 먹혀 조각에 닿지 않는 환경이 있다.
/// 붙인 직후 WindowFromPoint 로 "조각 한가운데를 가리키면 조각이 잡히는가"를
/// 실측해서, 닿지 않으면 즉시 원래 자리(아이콘 위·항상 아래)로 되돌린다 —
/// 바닥처럼 보이는 것보다 눌렀을 때 반응하는 것이 먼저다.
#[cfg(windows)]
mod floor {
    use windows_sys::Win32::Foundation::{HWND, LPARAM, POINT, RECT};
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        EnumWindows, FindWindowExW, FindWindowW, GetClassNameW, GetWindowRect, IsChild,
        SendMessageTimeoutW, SetParent, WindowFromPoint, SMTO_NORMAL,
    };

    fn wide(s: &str) -> Vec<u16> {
        s.encode_utf16().chain(std::iter::once(0)).collect()
    }

    unsafe extern "system" fn find_workerw(hwnd: HWND, lparam: LPARAM) -> i32 {
        let defview = wide("SHELLDLL_DefView");
        let workerw = wide("WorkerW");
        if !FindWindowExW(hwnd, std::ptr::null_mut(), defview.as_ptr(), std::ptr::null()).is_null()
        {
            // 아이콘 레이어를 가진 창의 다음 형제 WorkerW 가 배경화면 호스트다.
            let found =
                FindWindowExW(std::ptr::null_mut(), hwnd, workerw.as_ptr(), std::ptr::null());
            if !found.is_null() {
                *(lparam as *mut HWND) = found;
                return 0; // 찾았다 — 열거 중단
            }
        }
        1
    }

    fn class_of(hwnd: HWND) -> String {
        unsafe {
            let mut buf = [0u16; 128];
            let n = GetClassNameW(hwnd, buf.as_mut_ptr(), buf.len() as i32);
            String::from_utf16_lossy(&buf[..n.max(0) as usize])
        }
    }

    /// 배경화면 계층의 부모 창을 찾고, 판단의 매 단계를 log 에 남긴다.
    /// 구형(WorkerW 가 Progman 의 최상위 형제)과 24H2형(WorkerW 가 Progman 의
    /// 자식) 두 구조를 모두 시도한다. 어느 쪽도 없으면 Progman 자식 클래스
    /// 목록을 기록해 어떤 구조인지 사후에 알 수 있게 한다.
    fn wallpaper_host(log: &mut Vec<String>) -> Option<HWND> {
        unsafe {
            let progman_class = wide("Progman");
            let progman = FindWindowW(progman_class.as_ptr(), std::ptr::null());
            if progman.is_null() {
                log.push("host: Progman 창 자체가 없다".into());
                return None;
            }
            let mut result: usize = 0;
            SendMessageTimeoutW(progman, 0x052C, 0, 0, SMTO_NORMAL, 1000, &mut result);
            let mut found: HWND = std::ptr::null_mut();
            EnumWindows(Some(find_workerw), &mut found as *mut HWND as LPARAM);
            if !found.is_null() {
                log.push("host: WorkerW(최상위 형제) 발견 — 구형 구조".into());
                return Some(found);
            }
            let workerw = wide("WorkerW");
            let child =
                FindWindowExW(progman, std::ptr::null_mut(), workerw.as_ptr(), std::ptr::null());
            if !child.is_null() {
                log.push("host: WorkerW(Progman 자식) 발견 — 24H2형 구조".into());
                return Some(child);
            }
            // 진단: Progman 아래에 실제로 무엇이 있는지 남긴다.
            let mut kids: Vec<String> = Vec::new();
            let mut cur =
                FindWindowExW(progman, std::ptr::null_mut(), std::ptr::null(), std::ptr::null());
            while !cur.is_null() && kids.len() < 16 {
                kids.push(class_of(cur));
                cur = FindWindowExW(progman, cur, std::ptr::null(), std::ptr::null());
            }
            log.push(format!("host: WorkerW 없음. Progman 자식 = [{}]", kids.join(", ")));
            None
        }
    }

    /// 조각 한가운데를 가리켰을 때 실제로 조각(또는 그 안의 WebView 자식 창)이 잡히는가.
    /// 아니라면 무엇이 대신 잡혔는지 log 에 남긴다 — '왜 안 닿는가'를 추측하지 않기 위해.
    fn input_reaches(hwnd: HWND, log: &mut Vec<String>) -> bool {
        unsafe {
            let mut rc: RECT = std::mem::zeroed();
            if GetWindowRect(hwnd, &mut rc) == 0 {
                log.push("input: GetWindowRect 실패".into());
                return false;
            }
            let pt = POINT { x: (rc.left + rc.right) / 2, y: (rc.top + rc.bottom) / 2 };
            let hit = WindowFromPoint(pt);
            if hit.is_null() {
                log.push("input: WindowFromPoint 가 아무 창도 못 잡음".into());
                return false;
            }
            if hit == hwnd || IsChild(hwnd, hit) != 0 {
                log.push("input: 클릭이 조각에 닿는다".into());
                true
            } else {
                log.push(format!("input: 클릭을 '{}' 창이 가로챈다", class_of(hit)));
                false
            }
        }
    }

    /// 조각을 바닥에 붙인다. 클릭이 닿지 않으면 되돌리고 false.
    pub fn embed(hwnd: HWND, log: &mut Vec<String>) -> bool {
        let Some(host) = wallpaper_host(log) else { return false };
        unsafe {
            let prev = SetParent(hwnd, host);
            if prev.is_null() {
                log.push("embed: SetParent 실패".into());
                return false;
            }
            if input_reaches(hwnd, log) {
                log.push("embed: 바닥 유지".into());
                true
            } else {
                SetParent(hwnd, std::ptr::null_mut());
                log.push("embed: 클릭 불가 → 아이콘-위로 복귀".into());
                false
            }
        }
    }
}

/// 조각들을 아이콘 뒤 바닥에 붙여 본다. 하나라도 클릭이 안 닿으면 전부 원래
/// 자리(아이콘 위)로 두고 항상-아래를 다시 건다 — 반쯤 섞인 상태를 만들지 않는다.
/// 매 단계의 판단을 앱 데이터 폴더의 floor.log 에 남긴다 — '왜 이 모드가 됐는가'를
/// 사후에 추측이 아니라 기록으로 답하기 위해서다. CI 가 이 파일을 증거로 올린다.
#[cfg(windows)]
fn embed_pieces(app: &tauri::AppHandle) {
    let mut log: Vec<String> = Vec::new();
    let handles: Vec<(tauri::WebviewWindow, isize)> = PIECES
        .iter()
        .filter_map(|l| {
            let w = app.get_webview_window(l)?;
            let h = w.hwnd().ok()?.0 as isize;
            Some((w, h))
        })
        .collect();
    if handles.len() != PIECES.len() {
        log.push("조각 핸들을 다 얻지 못해 바닥 모드를 시도하지 않음".into());
    } else {
        let mut all_ok = true;
        for (w, h) in &handles {
            log.push(format!("--- {} ---", w.label()));
            if !floor::embed(*h as windows_sys::Win32::Foundation::HWND, &mut log) {
                all_ok = false;
                break;
            }
        }
        if all_ok {
            log.push("결과: 세 조각 모두 바닥(파일 뒤) 모드".into());
        } else {
            log.push("결과: 아이콘-위 모드로 전체 복귀".into());
            for (w, h) in &handles {
                unsafe {
                    windows_sys::Win32::UI::WindowsAndMessaging::SetParent(
                        *h as windows_sys::Win32::Foundation::HWND,
                        std::ptr::null_mut(),
                    );
                }
                let _ = w.set_always_on_bottom(true);
            }
        }
    }
    if let Ok(dir) = app.path().app_data_dir() {
        let _ = std::fs::create_dir_all(&dir);
        let _ = std::fs::write(dir.join("floor.log"), log.join("\n"));
    }
}
#[cfg(not(windows))]
#[allow(dead_code)]
fn embed_pieces(_app: &tauri::AppHandle) {}

/// 설치·업데이트 뒤에도 이전 버전 프로세스가 숨은 채 살아 있으면, 새 실행이
/// 단일 인스턴스 규칙에 밀려 이전(구버전) 화면만 다시 보게 된다. 사용자에게
/// "작업 관리자에서 끝내라"고 시키지 않는다 — 새 실행이 항상 이긴다.
#[cfg(windows)]
fn kill_stale_instances() {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    let me = std::process::id();
    let exe = std::env::current_exe()
        .ok()
        .and_then(|p| p.file_name().map(|s| s.to_string_lossy().into_owned()))
        .unwrap_or_else(|| "work-calendar-helper.exe".into());
    let _ = std::process::Command::new("taskkill")
        .args(["/F", "/IM", &exe, "/FI", &format!("PID ne {me}")])
        .creation_flags(CREATE_NO_WINDOW)
        .output();
}
#[cfg(not(windows))]
fn kill_stale_instances() {}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    kill_stale_instances();
    tauri::Builder::default()
        // 자동 실행으로 한 번, 바탕화면 아이콘으로 또 한 번 — 두 벌이 동시에 뜨면
        // 같은 저장소를 두 프로세스가 쓴다. 두 번째 실행은 조각들을 다시 보이고 끝낸다.
        // 반드시 첫 플러그인이어야 한다.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            reveal_all(app);
        }))
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))
        // 위치와 크기만 기억한다. 표시 여부까지 복원하면 visible:false 로 만들어 둔 조각이
        // piece_ready 전에 빈 채로 되살아난다. pop 은 매번 가운데 뜨는 일회성 창이라 뺀다.
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(StateFlags::SIZE | StateFlags::POSITION)
                .with_denylist(&["pop"])
                .build(),
        )
        // 첨부파일과 백업을 앱 전용 폴더에 실제 파일로 보관한다(발주서 §16.2).
        // 권한은 capabilities/main.json 에서 앱 데이터 디렉터리로만 좁혀 둔다.
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .on_window_event(|window, event| {
            let label = window.label().to_string();
            match event {
                WindowEvent::CloseRequested { api, .. } => {
                    // 조각에는 닫기 버튼이 없지만 Alt+F4 는 온다. 앱을 끝내는 대신 숨긴다 —
                    // 트레이에서 다시 부를 수 있다. 다만 마지막 조각까지 숨었으면 화면에
                    // 아무것도 남지 않는다. 그때는 앱을 끝낸다 — 트레이 아이콘이 숨김
                    // 영역에 들어가 있으면 유령 프로세스를 끝낼 방법이 없기 때문이다.
                    if PIECES.contains(&label.as_str()) {
                        api.prevent_close();
                        let _ = window.hide();
                        let app = window.app_handle();
                        let any_visible = PIECES.iter().any(|l| {
                            app.get_webview_window(l)
                                .and_then(|w| w.is_visible().ok())
                                .unwrap_or(false)
                        });
                        if !any_visible {
                            app.exit(0);
                        }
                    }
                }
                WindowEvent::Resized(_) => {
                    // Win+D(바탕화면 보기)는 이 창들도 최소화한다(Rainmeter 계열 공통 문제).
                    // 바탕화면 악세사리가 '바탕화면 보기'에 사라지면 존재 이유가 없다 — 즉시 복원한다.
                    if PIECES.contains(&label.as_str()) && matches!(window.is_minimized(), Ok(true))
                    {
                        let _ = window.unminimize();
                    }
                }
                _ => {}
            }
        })
        .setup(|app| {
            // 트레이 — 창이 없는 앱의 유일한 '관리 손잡이'.
            let cal = MenuItem::with_id(app, "toggle-cal", "달력 시트", true, None::<&str>)?;
            let mini = MenuItem::with_id(app, "toggle-mini", "미니 대시보드", true, None::<&str>)?;
            let status = MenuItem::with_id(app, "toggle-status", "현황", true, None::<&str>)?;
            let show_all = MenuItem::with_id(app, "show-all", "모두 표시", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "종료", true, None::<&str>)?;
            let menu = Menu::with_items(
                app,
                &[
                    &show_all,
                    &PredefinedMenuItem::separator(app)?,
                    &cal,
                    &mini,
                    &status,
                    &PredefinedMenuItem::separator(app)?,
                    &quit,
                ],
            )?;
            let icon = app
                .default_window_icon()
                .cloned()
                .expect("app icon missing");
            TrayIconBuilder::with_id("main-tray")
                .icon(icon)
                .menu(&menu)
                .show_menu_on_left_click(true)
                .tooltip("업체별 업무 일정 — 조각 보이기/숨기기·종료")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => app.exit(0),
                    "show-all" => reveal_all(app),
                    "toggle-cal" => toggle_piece(app, "cal"),
                    "toggle-mini" => toggle_piece(app, "mini"),
                    "toggle-status" => toggle_piece(app, "status"),
                    _ => {}
                })
                .build(app)?;

            // 창들이 아직 숨어 있는 지금 배치한다 — 뜬 뒤에 움직이면 화면이 튄다.
            layout_pieces(app.handle());
            // 바닥 모드: 조각을 바탕화면 파일(아이콘) 뒤 배경화면 계층에 붙인다.
            // 반드시 조각이 화면에 뜬 뒤에 걸어야 한다 — 입력 실측(WindowFromPoint)은
            // 보이는 창만 잡으므로, 숨은 채로 걸면 실측이 항상 실패해 조용히 되돌아간다
            // (0.4.0 이 그랬다). 클릭이 안 닿는 환경이면 아이콘-위로 자동 복귀하고,
            // 실제로 그려지는지는 CI 화면 증거(스크린샷 게이트)가 픽셀로 확인한다.
            #[cfg(windows)]
            {
                let handle = app.handle().clone();
                std::thread::spawn(move || {
                    for _ in 0..50 {
                        std::thread::sleep(std::time::Duration::from_millis(300));
                        let all_visible = PIECES.iter().all(|l| {
                            handle
                                .get_webview_window(l)
                                .map(|w| matches!(w.is_visible(), Ok(true)))
                                .unwrap_or(false)
                        });
                        if all_visible {
                            let h = handle.clone();
                            let _ = handle.run_on_main_thread(move || embed_pieces(&h));
                            break;
                        }
                    }
                });
            }

            // 화면 스크립트가 어떤 이유로든 piece_ready 를 못 보내면 앱이 보이지 않는 채로
            // 남으므로 안전망을 둔다.
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_secs(5));
                for label in PIECES {
                    if let Some(w) = handle.get_webview_window(label) {
                        if !matches!(w.is_visible(), Ok(true)) {
                            reveal_piece(&w);
                        }
                    }
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            piece_ready,
            pop_ready,
            close_pop,
            open_form,
            exit_app,
            set_autostart,
            is_autostart_enabled
        ])
        .run(tauri::generate_context!())
        .expect("error while running Tauri application");
}
