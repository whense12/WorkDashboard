//! Spike A — Windows desktop shell behaviour probe, Tauri 2 side.
//!
//! This is a *measurement surface*, not a product. It renders a fixed set of
//! hardcoded strings and exposes the three shell states the spike compares:
//! PASSIVE / ACTIVE / LAYOUT EDIT.
//!
//! No product data, no database, no date math. The only thing the surface persists is the
//! window's own position.

use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, Runtime, WebviewWindow, WindowEvent};

pub const MAIN_WINDOW: &str = "main";

/// Logical window size from the shared UI spec.
const WIN_W: f64 = 320.0;
const WIN_H: f64 = 240.0;
/// Inset from the work-area corner, in logical pixels.
const INSET: f64 = 24.0;
/// A restored rectangle must still overlap the virtual screen by at least this much,
/// in logical pixels, or the saved position is discarded. Mirrors the WPF check.
const MIN_VISIBLE: f64 = 48.0;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum Mode {
    Passive,
    Active,
    LayoutEdit,
}

impl Mode {
    fn from_str(s: &str) -> Option<Self> {
        match s.to_ascii_uppercase().replace(['-', ' '], "_").as_str() {
            "PASSIVE" => Some(Mode::Passive),
            "ACTIVE" => Some(Mode::Active),
            "LAYOUT_EDIT" => Some(Mode::LayoutEdit),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct ShellState {
    pub mode: Mode,
    /// Click-through is only honoured in PASSIVE; ACTIVE / LAYOUT EDIT force it off.
    pub click_through: bool,
    /// Mirrors `mode == LayoutEdit`; the UI uses it to arm the drag region.
    pub draggable: bool,
}

pub struct Shell {
    inner: Mutex<Inner>,
}

#[derive(Debug)]
struct Inner {
    mode: Mode,
    click_through_pref: bool,
}

impl Shell {
    fn new() -> Self {
        Self {
            inner: Mutex::new(Inner {
                mode: Mode::Passive,
                click_through_pref: false,
            }),
        }
    }

    fn snapshot(&self) -> ShellState {
        let g = self.inner.lock().expect("shell state poisoned");
        ShellState {
            mode: g.mode,
            click_through: g.mode == Mode::Passive && g.click_through_pref,
            draggable: g.mode == Mode::LayoutEdit,
        }
    }
}

// ---------------------------------------------------------------------------
// Position persistence (the only file this spike writes; autostart writes an HKCU Run value)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
struct SavedPosition {
    /// Physical pixels, as reported by `outer_position()`.
    x: i32,
    y: i32,
}

fn position_file<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("app_config_dir unavailable: {e}"))?;
    fs::create_dir_all(&dir).map_err(|e| format!("cannot create {}: {e}", dir.display()))?;
    Ok(dir.join("window-position.json"))
}

fn load_position<R: Runtime>(app: &AppHandle<R>) -> Option<SavedPosition> {
    let path = position_file(app).ok()?;
    let raw = fs::read_to_string(path).ok()?;
    serde_json::from_str::<SavedPosition>(&raw).ok()
}

fn store_position<R: Runtime>(app: &AppHandle<R>, pos: SavedPosition) -> Result<(), String> {
    let path = position_file(app)?;
    let raw = serde_json::to_string_pretty(&pos).map_err(|e| e.to_string())?;
    fs::write(&path, raw).map_err(|e| format!("cannot write {}: {e}", path.display()))
}

/// Default placement: bottom-right of the *work area*, inset 24 logical px.
fn default_position<R: Runtime>(window: &WebviewWindow<R>) -> Option<SavedPosition> {
    let scale = window.scale_factor().unwrap_or(1.0);

    #[cfg(windows)]
    {
        use windows::Win32::Foundation::RECT;
        use windows::Win32::UI::WindowsAndMessaging::{
            SystemParametersInfoW, SPI_GETWORKAREA, SYSTEM_PARAMETERS_INFO_UPDATE_FLAGS,
        };

        let mut rect = RECT::default();
        // SPI_GETWORKAREA returns the primary monitor's work area (taskbar excluded),
        // in physical pixels for a per-monitor-DPI-aware process.
        let ok = unsafe {
            SystemParametersInfoW(
                SPI_GETWORKAREA,
                0,
                Some(&mut rect as *mut RECT as *mut core::ffi::c_void),
                SYSTEM_PARAMETERS_INFO_UPDATE_FLAGS(0),
            )
        };
        if ok.is_ok() {
            let w = (WIN_W * scale).round() as i32;
            let h = (WIN_H * scale).round() as i32;
            let inset = (INSET * scale).round() as i32;
            return Some(SavedPosition {
                x: rect.right - w - inset,
                y: rect.bottom - h - inset,
            });
        }
    }

    // Non-Windows fallback: full monitor bounds, no taskbar subtraction available
    // through the portable API. Documented in NOTES.md.
    let monitor = window.primary_monitor().ok().flatten()?;
    let origin = monitor.position();
    let size = monitor.size();
    let w = (WIN_W * scale).round() as i32;
    let h = (WIN_H * scale).round() as i32;
    let inset = (INSET * scale).round() as i32;
    Some(SavedPosition {
        x: origin.x + size.width as i32 - w - inset,
        y: origin.y + size.height as i32 - h - inset,
    })
}

// ---------------------------------------------------------------------------
// Win32 shell plumbing
// ---------------------------------------------------------------------------

#[cfg(windows)]
mod win {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::WindowsAndMessaging::{
        GetSystemMetrics, GetWindowLongPtrW, SetWindowLongPtrW, SetWindowPos, GWL_EXSTYLE,
        HWND_BOTTOM, HWND_TOP, SM_CXVIRTUALSCREEN, SM_CYVIRTUALSCREEN, SM_XVIRTUALSCREEN,
        SM_YVIRTUALSCREEN, SWP_FRAMECHANGED, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE, SWP_NOZORDER,
        WS_EX_APPWINDOW, WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW, WS_EX_TRANSPARENT,
    };

    fn hwnd(raw: isize) -> HWND {
        HWND(raw as *mut core::ffi::c_void)
    }

    fn ex_style(h: HWND) -> u32 {
        unsafe { GetWindowLongPtrW(h, GWL_EXSTYLE) as u32 }
    }

    fn set_ex_style(h: HWND, style: u32) {
        unsafe {
            SetWindowLongPtrW(h, GWL_EXSTYLE, style as isize);
        }
    }

    /// Re-apply the extended styles for a mode.
    ///
    /// * `WS_EX_TOOLWINDOW` is kept in every mode — it is what removes the window
    ///   from Alt+Tab and from the taskbar.
    /// * `WS_EX_NOACTIVATE` is only set in PASSIVE, so the surface never steals focus.
    /// * `WS_EX_TRANSPARENT` backs click-through at the Win32 level; Tauri's
    ///   `set_ignore_cursor_events` is applied on top of it.
    pub fn apply_styles(raw: isize, no_activate: bool, click_through: bool) {
        let h = hwnd(raw);
        let mut s = ex_style(h);
        s |= WS_EX_TOOLWINDOW.0;
        s &= !WS_EX_APPWINDOW.0;

        if no_activate {
            s |= WS_EX_NOACTIVATE.0;
        } else {
            s &= !WS_EX_NOACTIVATE.0;
        }

        if click_through {
            s |= WS_EX_TRANSPARENT.0;
        } else {
            s &= !WS_EX_TRANSPARENT.0;
        }

        set_ex_style(h, s);

        // A GWL_EXSTYLE write is not guaranteed to take effect until the window is told
        // its frame changed. Z-order, position and size are all left alone here; the
        // subsequent send_to_bottom / release_from_bottom call owns the Z-order.
        unsafe {
            let _ = SetWindowPos(
                h,
                None,
                0,
                0,
                0,
                0,
                SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED,
            );
        }
    }

    /// Push to the bottom of the Z-order without activating.
    pub fn send_to_bottom(raw: isize) {
        unsafe {
            let _ = SetWindowPos(
                hwnd(raw),
                Some(HWND_BOTTOM),
                0,
                0,
                0,
                0,
                SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE,
            );
        }
    }

    /// Leave the bottom band and come to the top of the non-topmost band, without
    /// activating. Same call the WPF side makes on entering ACTIVE / LAYOUT EDIT.
    pub fn release_from_bottom(raw: isize) {
        unsafe {
            let _ = SetWindowPos(
                hwnd(raw),
                Some(HWND_TOP),
                0,
                0,
                0,
                0,
                SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE,
            );
        }
    }

    /// The bounding rectangle of all monitors, as `(x, y, width, height)` physical px.
    /// `None` when Windows reports a degenerate (zero-area) virtual screen.
    pub fn virtual_screen() -> Option<(i32, i32, i32, i32)> {
        unsafe {
            let x = GetSystemMetrics(SM_XVIRTUALSCREEN);
            let y = GetSystemMetrics(SM_YVIRTUALSCREEN);
            let w = GetSystemMetrics(SM_CXVIRTUALSCREEN);
            let h = GetSystemMetrics(SM_CYVIRTUALSCREEN);
            if w <= 0 || h <= 0 {
                None
            } else {
                Some((x, y, w, h))
            }
        }
    }
}

/// Bounding rectangle of all monitors, `(x, y, width, height)` in physical pixels.
#[cfg(windows)]
fn virtual_screen_rect() -> Option<(i32, i32, i32, i32)> {
    win::virtual_screen()
}

/// No virtual-screen metric is available off Windows, so nothing can be validated.
#[cfg(not(windows))]
fn virtual_screen_rect() -> Option<(i32, i32, i32, i32)> {
    None
}

/// A saved position is only reused when a meaningful part of the 320x240 rectangle still
/// lands inside the virtual screen — otherwise an unplugged monitor strands the window
/// off-screen. At least `MIN_VISIBLE` x `MIN_VISIBLE` logical px must overlap, which is
/// the same rule and the same 48x48 threshold the WPF side applies in `IsPlacementVisible`.
fn is_position_visible<R: Runtime>(window: &WebviewWindow<R>, pos: SavedPosition) -> bool {
    let Some((vx, vy, vw, vh)) = virtual_screen_rect() else {
        // Nothing to validate against: keep the saved position rather than discarding it.
        return true;
    };

    let scale = window.scale_factor().unwrap_or(1.0);
    let w = (WIN_W * scale).round() as i32;
    let h = (WIN_H * scale).round() as i32;
    let min = (MIN_VISIBLE * scale).round() as i32;

    let overlap_w = (pos.x + w).min(vx + vw) - pos.x.max(vx);
    let overlap_h = (pos.y + h).min(vy + vh) - pos.y.max(vy);

    overlap_w >= min && overlap_h >= min
}

// ---------------------------------------------------------------------------
// Mode application
// ---------------------------------------------------------------------------

fn apply_mode<R: Runtime>(app: &AppHandle<R>) -> Result<ShellState, String> {
    let state = app.state::<Shell>().snapshot();
    let window = app
        .get_webview_window(MAIN_WINDOW)
        .ok_or_else(|| format!("window `{MAIN_WINDOW}` not found"))?;

    let passive = state.mode == Mode::Passive;

    // Portable layer: Tauri's own APIs.
    window
        .set_ignore_cursor_events(state.click_through)
        .map_err(|e| format!("set_ignore_cursor_events: {e}"))?;
    window
        .set_always_on_bottom(passive)
        .map_err(|e| format!("set_always_on_bottom: {e}"))?;

    // Windows layer: the parts Tauri does not expose.
    #[cfg(windows)]
    {
        let raw = window
            .hwnd()
            .map_err(|e| format!("hwnd: {e}"))?
            .0 as isize;
        let click_through = state.click_through;
        window
            .run_on_main_thread(move || {
                win::apply_styles(raw, passive, click_through);
                if passive {
                    win::send_to_bottom(raw);
                } else {
                    win::release_from_bottom(raw);
                }
            })
            .map_err(|e| format!("run_on_main_thread: {e}"))?;
    }

    if !passive {
        // ACTIVE and LAYOUT EDIT may take focus; PASSIVE deliberately does not.
        let _ = window.set_focus();
    }

    app.emit("shell://state", state.clone())
        .map_err(|e| format!("emit: {e}"))?;
    Ok(state)
}

fn set_mode_internal<R: Runtime>(app: &AppHandle<R>, next: Mode) -> Result<ShellState, String> {
    let previous = {
        let shell = app.state::<Shell>();
        let mut g = shell.inner.lock().expect("shell state poisoned");
        let previous = g.mode;
        g.mode = next;
        previous
    };

    // Leaving LAYOUT EDIT locks the position again and persists it.
    if previous == Mode::LayoutEdit && next != Mode::LayoutEdit {
        if let Err(e) = persist_current_position(app) {
            eprintln!("[spike] position save failed: {e}");
        }
    }

    apply_mode(app)
}

fn persist_current_position<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    let window = app
        .get_webview_window(MAIN_WINDOW)
        .ok_or_else(|| format!("window `{MAIN_WINDOW}` not found"))?;
    let p = window
        .outer_position()
        .map_err(|e| format!("outer_position: {e}"))?;
    store_position(app, SavedPosition { x: p.x, y: p.y })
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

#[tauri::command]
fn get_state(app: AppHandle) -> ShellState {
    app.state::<Shell>().snapshot()
}

#[tauri::command]
fn set_mode(app: AppHandle, mode: String) -> Result<ShellState, String> {
    let next = Mode::from_str(&mode).ok_or_else(|| format!("unknown mode `{mode}`"))?;
    set_mode_internal(&app, next)
}

/// The `[ACTIVE / PASSIVE]` toggle. Never lands in LAYOUT EDIT.
#[tauri::command]
fn toggle_active(app: AppHandle) -> Result<ShellState, String> {
    let current = app.state::<Shell>().snapshot().mode;
    let next = match current {
        Mode::Active => Mode::Passive,
        // Leaving LAYOUT EDIT via this toggle lands in ACTIVE.
        Mode::LayoutEdit => Mode::Active,
        Mode::Passive => Mode::Active,
    };
    set_mode_internal(&app, next)
}

/// The `[LAYOUT EDIT]` toggle. Leaving it returns to ACTIVE.
#[tauri::command]
fn toggle_layout_edit(app: AppHandle) -> Result<ShellState, String> {
    let current = app.state::<Shell>().snapshot().mode;
    let next = if current == Mode::LayoutEdit {
        Mode::Active
    } else {
        Mode::LayoutEdit
    };
    set_mode_internal(&app, next)
}

#[tauri::command]
fn set_click_through(app: AppHandle, enabled: bool) -> Result<ShellState, String> {
    {
        let shell = app.state::<Shell>();
        let mut g = shell.inner.lock().expect("shell state poisoned");
        g.click_through_pref = enabled;
    }
    apply_mode(&app)
}

/// Ctrl+Alt+T. Click-through is only meaningful in PASSIVE; outside it the shortcut is a
/// no-op that does **not** arm the preference for later, so it cannot switch itself on when
/// the surface next drops to PASSIVE. Same early-return the WPF side does.
#[tauri::command]
fn toggle_click_through(app: AppHandle) -> Result<ShellState, String> {
    let current = app.state::<Shell>().snapshot();
    if current.mode != Mode::Passive {
        return Ok(current);
    }

    let next = !current.click_through;
    set_click_through(app, next)
}

#[tauri::command]
fn save_position(app: AppHandle) -> Result<(), String> {
    persist_current_position(&app)
}

#[tauri::command]
fn autostart_enabled(app: AppHandle) -> Result<bool, String> {
    use tauri_plugin_autostart::ManagerExt;
    app.autolaunch().is_enabled().map_err(|e| e.to_string())
}

#[tauri::command]
fn set_autostart(app: AppHandle, enabled: bool) -> Result<bool, String> {
    use tauri_plugin_autostart::ManagerExt;
    let al = app.autolaunch();
    if enabled {
        al.enable().map_err(|e| e.to_string())?;
    } else {
        al.disable().map_err(|e| e.to_string())?;
    }
    al.is_enabled().map_err(|e| e.to_string())
}

// ---------------------------------------------------------------------------
// Global shortcuts
// ---------------------------------------------------------------------------

#[cfg(desktop)]
mod shortcuts {
    use tauri_plugin_global_shortcut::{Code, Modifiers, Shortcut};

    /// Ctrl+Alt+D — toggle ACTIVE / PASSIVE.
    pub fn toggle_active() -> Shortcut {
        Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyD)
    }
    /// Ctrl+Alt+L — toggle LAYOUT EDIT.
    pub fn toggle_layout_edit() -> Shortcut {
        Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyL)
    }
    /// Ctrl+Alt+T — toggle click-through (only meaningful in PASSIVE).
    pub fn toggle_click_through() -> Shortcut {
        Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyT)
    }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

pub fn run() {
    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        use tauri_plugin_global_shortcut::ShortcutState;

        builder = builder
            .plugin(tauri_plugin_autostart::init(
                tauri_plugin_autostart::MacosLauncher::LaunchAgent,
                Some(vec!["--autostarted"]),
            ))
            .plugin(
                tauri_plugin_global_shortcut::Builder::new()
                    .with_handler(|app, shortcut, event| {
                        if event.state() != ShortcutState::Pressed {
                            return;
                        }
                        let handle = app.clone();
                        let result = if shortcut == &shortcuts::toggle_active() {
                            toggle_active(handle).map(|_| ())
                        } else if shortcut == &shortcuts::toggle_layout_edit() {
                            toggle_layout_edit(handle).map(|_| ())
                        } else if shortcut == &shortcuts::toggle_click_through() {
                            toggle_click_through(handle).map(|_| ())
                        } else {
                            Ok(())
                        };
                        if let Err(e) = result {
                            eprintln!("[spike] shortcut handler failed: {e}");
                        }
                    })
                    .build(),
            );
    }

    builder
        .manage(Shell::new())
        .invoke_handler(tauri::generate_handler![
            get_state,
            set_mode,
            toggle_active,
            toggle_layout_edit,
            set_click_through,
            toggle_click_through,
            save_position,
            autostart_enabled,
            set_autostart,
        ])
        .setup(|app| {
            let handle = app.handle().clone();

            #[cfg(desktop)]
            {
                use tauri_plugin_global_shortcut::GlobalShortcutExt;
                let gs = app.global_shortcut();
                for sc in [
                    shortcuts::toggle_active(),
                    shortcuts::toggle_layout_edit(),
                    shortcuts::toggle_click_through(),
                ] {
                    if let Err(e) = gs.register(sc) {
                        // A shortcut already owned by another process is a real,
                        // reportable limitation — do not swallow it silently.
                        eprintln!("[spike] global shortcut registration failed: {e}");
                    }
                }
            }

            let window = handle
                .get_webview_window(MAIN_WINDOW)
                .expect("main window missing");

            // Restore the saved position, but only when it is still on-screen; otherwise
            // fall back to the spec default bottom-right corner.
            let restored = load_position(&handle)
                .filter(|p| is_position_visible(&window, *p))
                .or_else(|| default_position(&window));
            if let Some(p) = restored {
                let _ = window.set_position(PhysicalPosition::new(p.x, p.y));
            }

            // Enter PASSIVE before the surface is ever shown, so the first paint
            // already has WS_EX_NOACTIVATE / WS_EX_TOOLWINDOW applied.
            if let Err(e) = apply_mode(&handle) {
                eprintln!("[spike] initial mode apply failed: {e}");
            }
            let _ = window.show();
            if let Err(e) = apply_mode(&handle) {
                eprintln!("[spike] post-show mode apply failed: {e}");
            }

            // Second save point: application exit. `CloseRequested` is emitted while the
            // window is still alive, so `outer_position()` is still answerable. This is the
            // counterpart of the WPF `OnClosed` save.
            let close_handle = handle.clone();
            window.on_window_event(move |event| {
                if let WindowEvent::CloseRequested { .. } = event {
                    if let Err(e) = persist_current_position(&close_handle) {
                        eprintln!("[spike] exit position save failed: {e}");
                    }
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running the spike shell");
}
