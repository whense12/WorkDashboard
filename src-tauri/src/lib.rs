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

/// 입력 폼이 떠 있는 동안만 켜진다. 폼은 조각 안에서 열리므로, 이 때까지 바닥으로
/// 되밀면 사용자가 글자를 넣는 창이 다른 프로그램 뒤로 숨는다. 폼을 닫으면 바로 꺼지고
/// 그 순간 다시 바닥에 꽂으므로 '평상시 항상 아래'는 그대로다.
static MODAL_OPEN: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

#[tauri::command]
fn set_modal_open(app: tauri::AppHandle, open: bool) {
    MODAL_OPEN.store(open, std::sync::atomic::Ordering::Relaxed);
    if !open {
        // 폼이 닫혔다 — 유예 중 위로 올라와 있던 조각을 즉시 바닥으로 되돌린다.
        for label in PIECES {
            if let Some(w) = app.get_webview_window(label) {
                let _ = w.set_always_on_bottom(true);
            }
        }
    }
}

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
                WindowEvent::Focused(true) => {
                    // 항상-아래는 창을 만들 때 한 번 바닥에 꽂을 뿐, 클릭으로 활성화되면
                    // Windows 가 창을 다른 프로그램 위로 끌어올린다 — 위젯이 순간 '창'이
                    // 되어 작업 중인 화면을 덮는다(실측: 메모장 겹침 게이트에서 검출).
                    // 포커스를 받을 때마다 바닥으로 되밀어 넣는다. 입력은 그대로 받는다.
                    // 단, 입력 폼이 떠 있는 동안은 유예한다 — 글자를 넣는 창을 바닥으로
                    // 밀어 버리면 사용자가 자기가 쓰는 화면을 못 본다.
                    if PIECES.contains(&label.as_str())
                        && !MODAL_OPEN.load(std::sync::atomic::Ordering::Relaxed)
                    {
                        let _ = window.set_always_on_bottom(true);
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
            set_modal_open,
            open_form,
            exit_app,
            set_autostart,
            is_autostart_enabled
        ])
        .run(tauri::generate_context!())
        .expect("error while running Tauri application");
}
