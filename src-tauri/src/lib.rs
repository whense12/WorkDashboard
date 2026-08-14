use tauri::{Manager, WebviewWindow, WindowEvent};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};
use tauri_plugin_window_state::StateFlags;

/// 이번 실행이 자동 실행(도우미만)인지. 본체를 언제 띄울지 판단하는 데만 쓴다.
struct Launch {
    helper_only: bool,
}

fn win(app: &tauri::AppHandle, label: &str) -> Result<WebviewWindow, String> {
    app.get_webview_window(label)
        .ok_or_else(|| format!("{label} window not found"))
}

fn is_visible(app: &tauri::AppHandle, label: &str) -> bool {
    app.get_webview_window(label)
        .and_then(|w| w.is_visible().ok())
        .unwrap_or(false)
}

/// WebView2 는 숨겼다 다시 띄운 창을 곧바로 다시 그리지 않고 검은 사각형으로 남겨 두는 일이 있다.
/// 창을 1px 늘렸다 되돌려 리페인트를 강제한다.
fn repaint(window: &WebviewWindow) {
    if let Ok(size) = window.outer_size() {
        let _ = window.set_size(tauri::PhysicalSize::new(size.width, size.height + 1));
        let _ = window.set_size(size);
    }
}

fn reveal(window: &WebviewWindow) -> Result<(), String> {
    window.show().map_err(|e| e.to_string())?;
    let _ = window.unminimize();
    repaint(window);
    window.set_focus().map_err(|e| e.to_string())
}

#[tauri::command]
fn show_helper(app: tauri::AppHandle) -> Result<(), String> {
    reveal(&win(&app, "helper")?)
}

/// 도우미의 × 는 악세사리를 치우는 동작이다. 다만 본체까지 숨어 있으면 화면에 아무것도
/// 남지 않아 다시 부를 방법이 없다. 그때는 앱을 끝낸다 — 유령 프로세스를 남기지 않는다.
#[tauri::command]
fn hide_helper(app: tauri::AppHandle) -> Result<(), String> {
    win(&app, "helper")?.hide().map_err(|e| e.to_string())?;
    if !is_visible(&app, "main") {
        app.exit(0);
    }
    Ok(())
}

#[tauri::command]
fn show_main(app: tauri::AppHandle) -> Result<(), String> {
    reveal(&win(&app, "main")?)
}

/// 본체 화면이 첫 렌더를 마쳤다고 알려 온다. 창은 `visible: false` 로 만들어 두고
/// 이 시점에 띄운다 — 빈 WebView2 가 먼저 뜨면 검은 사각형으로 보인다.
#[tauri::command]
fn main_ready(app: tauri::AppHandle, launch: tauri::State<'_, Launch>) -> Result<(), String> {
    if launch.helper_only {
        return Ok(());
    }
    reveal(&win(&app, "main")?)
}

#[tauri::command]
fn set_helper_always_on_top(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    win(&app, "helper")?
        .set_always_on_top(enabled)
        .map_err(|e| e.to_string())
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // 자동 실행으로 한 번, 바탕화면 아이콘으로 또 한 번 — 두 벌이 동시에 뜨면
        // 같은 저장소를 두 프로세스가 쓰고 제목이 같은 창이 둘 생긴다.
        // 두 번째 실행은 기존 창을 앞으로 불러오고 끝낸다. 반드시 첫 플러그인이어야 한다.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = reveal(&w);
            } else if let Some(w) = app.get_webview_window("helper") {
                let _ = reveal(&w);
            }
        }))
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec!["--helper-only"]),
        ))
        // 위치와 크기만 기억한다. 기본값(all)은 표시 여부와 장식까지 복원해서,
        // 숨겨 두어야 할 본체가 저장된 기하만 안고 빈 창으로 되살아나거나
        // 무장식 도우미에 제목표시줄이 다시 붙는 일이 생긴다.
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(StateFlags::SIZE | StateFlags::POSITION)
                .build(),
        )
        // 첨부파일과 백업을 앱 전용 폴더에 실제 파일로 보관한다(발주서 §16.2).
        // 권한은 capabilities/main.json 에서 앱 데이터 디렉터리로만 좁혀 둔다.
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                // 창을 닫아도 앱을 끝내지 않는다. 본체를 닫으면 도우미가 바탕화면에 남고,
                // 거기서 '대시보드 열기'로 다시 부를 수 있어야 한다.
                api.prevent_close();
                let _ = window.hide();
                let app = window.app_handle();
                if !is_visible(app, "main") && !is_visible(app, "helper") {
                    if window.label() == "main" {
                        if let Some(helper) = app.get_webview_window("helper") {
                            let _ = reveal(&helper);
                        }
                    } else {
                        app.exit(0);
                    }
                }
            }
        })
        .setup(|app| {
            let helper_only = std::env::args().any(|arg| arg == "--helper-only");
            app.manage(Launch { helper_only });
            if helper_only {
                if let Some(helper) = app.get_webview_window("helper") {
                    let _ = helper.show();
                }
            } else {
                // 본체는 main_ready 가 올 때 띄운다. 화면 스크립트가 어떤 이유로든
                // 그 신호를 못 보내면 앱이 보이지 않는 채로 남으므로 안전망을 둔다.
                let handle = app.handle().clone();
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_secs(5));
                    if let Some(main) = handle.get_webview_window("main") {
                        if !matches!(main.is_visible(), Ok(true)) {
                            let _ = reveal(&main);
                        }
                    }
                });
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            show_helper,
            hide_helper,
            show_main,
            main_ready,
            set_helper_always_on_top,
            set_autostart,
            is_autostart_enabled
        ])
        .run(tauri::generate_context!())
        .expect("error while running Tauri application");
}
