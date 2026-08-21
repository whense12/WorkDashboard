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

/// pop 창 안에서 첫 모달이 열렸다고 알려 온다. 이때 띄워야 빈 창이 번쩍이지 않는다.
#[tauri::command]
fn pop_ready(window: WebviewWindow) {
    if window.label() == "pop" {
        let _ = window.show();
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
    // 한 번에 하나. 이미 떠 있으면 닫고 새로 연다 — 폼이 겹겹이 쌓이면 그게 또 창이다.
    if let Some(existing) = app.get_webview_window("pop") {
        let _ = existing.close();
    }
    let url = format!("index.html?w=pop&form={}&payload={}", form, urlenc(&payload));
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
        .visible(false) // pop_ready 가 올 때 띄운다
        .focused(true)
        .build()
        .map_err(|e| e.to_string())?;
    Ok(())
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

fn toggle_piece(app: &tauri::AppHandle, label: &str) {
    if let Ok(w) = win(app, label) {
        if matches!(w.is_visible(), Ok(true)) {
            let _ = w.hide();
        } else {
            reveal_piece(&w);
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
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
                    // 트레이에서 다시 부를 수 있다. 종료는 트레이의 '종료'만 한다.
                    if PIECES.contains(&label.as_str()) {
                        api.prevent_close();
                        let _ = window.hide();
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
            set_autostart,
            is_autostart_enabled
        ])
        .run(tauri::generate_context!())
        .expect("error while running Tauri application");
}
