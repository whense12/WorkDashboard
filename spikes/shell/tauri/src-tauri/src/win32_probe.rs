//! Spike A — **headless Win32 primitive probe**, Tauri/Rust side.
//!
//! **Why this exists.** The shell layer in [`crate::win_shell`] and the placement experiment
//! in [`crate::monitor_placement`] were, up to now, backed by `cargo check` only: the Win32
//! calls type-checked and nobody had ever observed one of them run. A GUI user cannot be
//! faked on a CI runner, but a surprising amount of that risk needs no interactive desktop
//! at all — a hidden top-level HWND, a subclass that is actually invoked, an extended-style
//! roundtrip, Z-order, monitor enumeration and DPI all work in a non-interactive session.
//!
//! **What it deliberately does NOT claim.** Nothing here observes click-through, focus steal,
//! real Z-order against another application, global hotkeys, `Win+D`, or monitor hotplug.
//! Those stay `NOT TESTED` in `spikes/shell/acceptance.md`; a green probe must never be read
//! as evidence for them.
//!
//! **Where it runs.** `src/bin/win32-probe.rs` runs it as a gate in CI on windows-latest, and
//! that binary carries the same embedded `RT_MANIFEST` as the app (cargo links the
//! tauri-winres resource into every bin of the package), so the comctl32 v6 activation
//! context the probe measures is the app's activation context.
//!
//! Off Windows every check reports `NOT APPLICABLE` and nothing fails, so the Linux build and
//! `cargo test` stay green.

use std::fmt::Write as _;

/// The spike's four-word result vocabulary, unchanged. `NotTested` exists so the probe can
/// name a primitive it deliberately did not attempt (it needs an interactive desktop) without
/// dressing it up as `NOT APPLICABLE` or, worse, as `PASS`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Verdict {
    Pass,
    Fail,
    NotTested,
    NotApplicable,
}

impl Verdict {
    pub fn label(self) -> &'static str {
        match self {
            Verdict::Pass => "PASS",
            Verdict::Fail => "FAIL",
            Verdict::NotTested => "NOT TESTED",
            Verdict::NotApplicable => "NOT APPLICABLE",
        }
    }
}

/// One measured primitive.
#[derive(Debug, Clone)]
pub struct Check {
    pub name: &'static str,
    pub verdict: Verdict,
    pub detail: String,
}

/// The whole probe run.
#[derive(Debug, Default, Clone)]
pub struct Report {
    pub checks: Vec<Check>,
    /// Diagnostics that are *not* verdicts — module paths, DPI values, monitor counts.
    pub notes: Vec<String>,
}

impl Report {
    pub fn record(&mut self, name: &'static str, ok: bool, detail: impl Into<String>) {
        self.checks.push(Check {
            name,
            verdict: if ok { Verdict::Pass } else { Verdict::Fail },
            detail: detail.into(),
        });
    }

    pub fn not_applicable(&mut self, name: &'static str, detail: impl Into<String>) {
        self.checks.push(Check {
            name,
            verdict: Verdict::NotApplicable,
            detail: detail.into(),
        });
    }

    /// A primitive this probe deliberately does not attempt, because a CI runner has no
    /// interactive desktop. It must never turn into a `PASS`.
    pub fn not_tested(&mut self, name: &'static str, detail: impl Into<String>) {
        self.checks.push(Check {
            name,
            verdict: Verdict::NotTested,
            detail: detail.into(),
        });
    }

    pub fn note(&mut self, text: impl Into<String>) {
        self.notes.push(text.into());
    }

    pub fn count(&self, v: Verdict) -> usize {
        self.checks.iter().filter(|c| c.verdict == v).count()
    }

    pub fn failures(&self) -> usize {
        self.count(Verdict::Fail)
    }

    /// Plain text, one line per check, suitable for a CI log and for an artifact file.
    pub fn to_text(&self) -> String {
        let mut out = String::new();
        let width = self
            .checks
            .iter()
            .map(|c| c.name.len())
            .max()
            .unwrap_or(0)
            .max(4);
        for c in &self.checks {
            let _ = writeln!(
                out,
                "{:<14} {:<width$}  {}",
                c.verdict.label(),
                c.name,
                c.detail,
                width = width
            );
        }
        if !self.notes.is_empty() {
            out.push('\n');
            for n in &self.notes {
                let _ = writeln!(out, "note: {n}");
            }
        }
        let _ = writeln!(
            out,
            "\nsummary: {} PASS, {} FAIL, {} NOT TESTED, {} NOT APPLICABLE",
            self.count(Verdict::Pass),
            self.count(Verdict::Fail),
            self.count(Verdict::NotTested),
            self.count(Verdict::NotApplicable)
        );
        out
    }
}

/// Run every checkable primitive once and return what actually happened.
pub fn run() -> Report {
    let mut report = Report::default();
    imp::run(&mut report);
    report
}

// ---------------------------------------------------------------------------
// Pure helpers — shared by the probe and by the unit tests, so the arithmetic the probe
// asserts is itself covered on Linux by `cargo test --lib`.
// ---------------------------------------------------------------------------

/// Is `v` inside the inclusive range `lo..=hi`?
pub fn within(v: i32, lo: i32, hi: i32) -> bool {
    v >= lo && v <= hi
}

/// Does a `w` x `h` rectangle placed at `(x, y)` sit fully inside the rectangle
/// `(wx, wy, ww, wh)`? Used to check what `monitor_placement::resolve` hands back.
#[allow(clippy::too_many_arguments)]
pub fn rect_inside(x: i32, y: i32, w: i32, h: i32, wx: i32, wy: i32, ww: i32, wh: i32) -> bool {
    // A work area smaller than the widget cannot contain it; the placement code pins the
    // widget to the work-area origin in that case, so accept exactly that.
    let fits_x = if ww < w { x == wx } else { within(x, wx, wx + ww - w) };
    let fits_y = if wh < h { y == wy } else { within(y, wy, wy + wh - h) };
    fits_x && fits_y
}

// ---------------------------------------------------------------------------
// Windows implementation
// ---------------------------------------------------------------------------

#[cfg(windows)]
#[deny(unsafe_op_in_unsafe_fn)]
mod imp {
    use super::{rect_inside, Report};

    use std::sync::atomic::{AtomicU32, Ordering};

    use windows::core::{w, BOOL, PCWSTR};
    use windows::Win32::Foundation::{HINSTANCE, HWND, LPARAM, LRESULT, RECT, WPARAM};
    use windows::Win32::Graphics::Gdi::{
        EnumDisplayMonitors, GetMonitorInfoW, MonitorFromWindow, HDC, HMONITOR, MONITORINFO,
        MONITOR_DEFAULTTONEAREST,
    };
    use windows::Win32::System::LibraryLoader::{GetModuleFileNameW, GetModuleHandleW};
    use windows::Win32::UI::HiDpi::GetDpiForWindow;
    use windows::Win32::UI::Shell::{DefSubclassProc, RemoveWindowSubclass, SetWindowSubclass};
    use windows::Win32::UI::WindowsAndMessaging::{
        CreateWindowExW, DefWindowProcW, DestroyWindow, GetWindowLongPtrW, GetWindowRect,
        RegisterClassExW, SendMessageW, SetWindowLongPtrW, SetWindowPos, UnregisterClassW,
        CW_USEDEFAULT, GWL_EXSTYLE, HWND_BOTTOM, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE, WM_APP,
        WM_NCDESTROY, WNDCLASSEXW, WS_CLIPCHILDREN, WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW,
        WS_EX_TRANSPARENT, WS_POPUP,
    };

    /// Window class of the hidden probe window. Unregistered again before returning.
    const CLASS_NAME: PCWSTR = w!("WorkDashboardSpikeAWin32Probe");

    /// Subclass id for the probe's *own* counting subclass. Deliberately different from the
    /// production id in `win_shell`, so both can be attached to the same HWND independently.
    const PROBE_SUBCLASS_ID: usize = 0x5052_4F42; // 'PROB'

    /// A private message. `WM_APP + n` is reserved for the application, so no Windows
    /// component can send it and inflate the counter behind our back.
    const WM_PROBE_PING: u32 = WM_APP + 0x51;

    /// Incremented by the counting subclass every time it sees `WM_PROBE_PING`. This is the
    /// proof that the subclass callback is genuinely invoked and not merely installed.
    static PING_HITS: AtomicU32 = AtomicU32::new(0);

    fn hits() -> u32 {
        PING_HITS.load(Ordering::Acquire)
    }

    /// Bare window procedure; the probe needs a window, not behaviour.
    unsafe extern "system" fn probe_wndproc(
        h: HWND,
        msg: u32,
        wparam: WPARAM,
        lparam: LPARAM,
    ) -> LRESULT {
        unsafe { DefWindowProcW(h, msg, wparam, lparam) }
    }

    /// The counting subclass procedure. Same API the production shell layer uses
    /// (`SetWindowSubclass` / `DefSubclassProc`), with a counter bolted on.
    unsafe extern "system" fn counting_subclass_proc(
        h: HWND,
        msg: u32,
        wparam: WPARAM,
        lparam: LPARAM,
        _id: usize,
        _refdata: usize,
    ) -> LRESULT {
        if msg == WM_PROBE_PING {
            PING_HITS.fetch_add(1, Ordering::AcqRel);
        }
        if msg == WM_NCDESTROY {
            unsafe {
                let _ = RemoveWindowSubclass(h, Some(counting_subclass_proc), PROBE_SUBCLASS_ID);
            }
        }
        unsafe { DefSubclassProc(h, msg, wparam, lparam) }
    }

    /// `EnumDisplayMonitors` callback: counts monitors into an `isize` sink.
    unsafe extern "system" fn count_monitors(
        _mon: HMONITOR,
        _hdc: HDC,
        _clip: *mut RECT,
        data: LPARAM,
    ) -> BOOL {
        let sink = data.0 as *mut u32;
        if !sink.is_null() {
            unsafe { *sink += 1 };
        }
        BOOL(1)
    }

    /// File name behind a loaded module handle, for the diagnostic notes.
    fn module_path(name: PCWSTR) -> Option<String> {
        // SAFETY: GetModuleHandleW does not load anything; it only answers for modules that
        // are already mapped into this process.
        let module = unsafe { GetModuleHandleW(name) }.ok()?;
        let mut buf = [0u16; 260];
        let n = unsafe { GetModuleFileNameW(Some(module), &mut buf) } as usize;
        if n == 0 {
            return None;
        }
        Some(String::from_utf16_lossy(&buf[..n.min(buf.len())]))
    }

    pub fn run(report: &mut Report) {
        // --- the process itself -------------------------------------------------------
        let hinstance = match unsafe { GetModuleHandleW(PCWSTR::null()) } {
            Ok(m) => HINSTANCE(m.0),
            Err(e) => {
                report.record("process.module_handle", false, format!("{e}"));
                return;
            }
        };
        report.record("process.module_handle", true, "GetModuleHandleW(NULL) ok");
        if let Some(p) = module_path(PCWSTR::null()) {
            report.note(format!("running image: {p}"));
        }

        // --- hidden top-level window --------------------------------------------------
        let class = WNDCLASSEXW {
            cbSize: core::mem::size_of::<WNDCLASSEXW>() as u32,
            lpfnWndProc: Some(probe_wndproc),
            hInstance: hinstance,
            lpszClassName: CLASS_NAME,
            ..Default::default()
        };
        let atom = unsafe { RegisterClassExW(&class) };
        if atom == 0 {
            report.record(
                "hwnd.register_class",
                false,
                format!("RegisterClassExW failed: {}", last_error()),
            );
            return;
        }
        report.record("hwnd.register_class", true, "RegisterClassExW ok");

        // WS_POPUP and no WS_VISIBLE: a real top-level window that is never shown, which is
        // the closest a non-interactive session gets to the widget's own window.
        let hwnd = unsafe {
            CreateWindowExW(
                WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE,
                CLASS_NAME,
                w!("SpikeA Win32 probe (hidden)"),
                WS_POPUP | WS_CLIPCHILDREN,
                CW_USEDEFAULT,
                CW_USEDEFAULT,
                320,
                240,
                None,
                None,
                Some(hinstance),
                None,
            )
        };
        let hwnd = match hwnd {
            Ok(h) => {
                report.record(
                    "hwnd.create_hidden_toplevel",
                    true,
                    "CreateWindowExW(WS_POPUP, not visible) ok",
                );
                h
            }
            Err(e) => {
                report.record("hwnd.create_hidden_toplevel", false, format!("{e}"));
                let _ = unsafe { UnregisterClassW(CLASS_NAME, Some(hinstance)) };
                return;
            }
        };
        let raw = hwnd.0 as isize;

        // --- SetWindowSubclass: attach, prove invocation, remove ----------------------
        PING_HITS.store(0, Ordering::Release);
        let attached = unsafe {
            SetWindowSubclass(
                hwnd,
                Some(counting_subclass_proc),
                PROBE_SUBCLASS_ID,
                0,
            )
        }
        .as_bool();
        report.record(
            "subclass.attach",
            attached,
            if attached {
                "SetWindowSubclass ok".to_string()
            } else {
                format!("SetWindowSubclass failed: {}", last_error())
            },
        );
        if let Some(p) = module_path(w!("comctl32.dll")) {
            report.note(format!("comctl32 in use: {p}"));
        }

        if attached {
            // One ping, one increment. SendMessageW is synchronous, so the counter is already
            // updated by the time it returns — no sleeping, no message pump needed.
            let _ = unsafe { SendMessageW(hwnd, WM_PROBE_PING, None, None) };
            let after_one = hits();
            report.record(
                "subclass.callback_invoked",
                after_one == 1,
                format!("counter after 1 ping = {after_one} (expected 1)"),
            );

            // Twice more, to show it is a standing hook rather than a one-shot.
            let _ = unsafe { SendMessageW(hwnd, WM_PROBE_PING, None, None) };
            let _ = unsafe { SendMessageW(hwnd, WM_PROBE_PING, None, None) };
            let after_three = hits();
            report.record(
                "subclass.callback_repeats",
                after_three == 3,
                format!("counter after 3 pings = {after_three} (expected 3)"),
            );

            let removed = unsafe {
                RemoveWindowSubclass(hwnd, Some(counting_subclass_proc), PROBE_SUBCLASS_ID)
            }
            .as_bool();
            report.record(
                "subclass.remove",
                removed,
                if removed {
                    "RemoveWindowSubclass ok".to_string()
                } else {
                    format!("RemoveWindowSubclass failed: {}", last_error())
                },
            );

            // After removal the callback must be silent. This is the half of the contract a
            // leaked subclass would break.
            let before_silent = hits();
            let _ = unsafe { SendMessageW(hwnd, WM_PROBE_PING, None, None) };
            let after_silent = hits();
            report.record(
                "subclass.remove_stops_callback",
                removed && after_silent == before_silent,
                format!("counter {before_silent} -> {after_silent} (expected unchanged)"),
            );
        } else {
            report.not_applicable(
                "subclass.callback_invoked",
                "attach failed, so invocation was never attempted",
            );
            report.not_applicable("subclass.callback_repeats", "attach failed");
            report.not_applicable("subclass.remove", "attach failed");
            report.not_applicable("subclass.remove_stops_callback", "attach failed");
        }

        // --- the PRODUCTION shell layer, on this same HWND ---------------------------
        // This is the code the prototype actually ships (src/win_shell.rs). Running it here
        // is the only evidence that its SetWindowSubclass / RemoveWindowSubclass pair links
        // and succeeds; its message handling still needs a real desktop and stays NOT TESTED.
        match crate::win_shell::attach(raw) {
            Ok(()) => {
                let flagged = crate::win_shell::is_attached();
                report.record(
                    "win_shell.attach",
                    flagged,
                    format!("win_shell::attach ok, is_attached()={flagged}"),
                );
                match crate::win_shell::detach(raw) {
                    Ok(()) => report.record(
                        "win_shell.detach",
                        !crate::win_shell::is_attached(),
                        "win_shell::detach ok, is_attached()=false",
                    ),
                    Err(e) => report.record("win_shell.detach", false, e),
                }
            }
            Err(e) => {
                report.record("win_shell.attach", false, e);
                report.not_applicable("win_shell.detach", "attach failed");
            }
        }

        // --- SetWindowLongPtrW(GWL_EXSTYLE) roundtrip --------------------------------
        let original = unsafe { GetWindowLongPtrW(hwnd, GWL_EXSTYLE) };
        // The bit must be ABSENT first, or the roundtrip would pass without proving anything.
        let absent_before = original & WS_EX_TRANSPARENT.0 as isize == 0;
        let target = original | WS_EX_TRANSPARENT.0 as isize;
        let _ = unsafe { SetWindowLongPtrW(hwnd, GWL_EXSTYLE, target) };
        let read_back = unsafe { GetWindowLongPtrW(hwnd, GWL_EXSTYLE) };
        let bit_set = read_back & WS_EX_TRANSPARENT.0 as isize != 0;
        report.record(
            "exstyle.set_and_read_back",
            absent_before && bit_set,
            format!(
                "0x{original:X} -> 0x{read_back:X}, WS_EX_TRANSPARENT absent before = \
                 {absent_before}, set after = {bit_set}"
            ),
        );
        let _ = unsafe { SetWindowLongPtrW(hwnd, GWL_EXSTYLE, original) };
        let restored = unsafe { GetWindowLongPtrW(hwnd, GWL_EXSTYLE) };
        report.record(
            "exstyle.restore",
            restored == original,
            format!("restored 0x{restored:X}, original 0x{original:X}"),
        );

        // --- Z-order ------------------------------------------------------------------
        let bottom = unsafe {
            SetWindowPos(
                hwnd,
                Some(HWND_BOTTOM),
                0,
                0,
                0,
                0,
                SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE,
            )
        };
        report.record(
            "zorder.setwindowpos_hwnd_bottom",
            bottom.is_ok(),
            match &bottom {
                Ok(()) => "SetWindowPos(HWND_BOTTOM, NOACTIVATE) ok".to_string(),
                Err(e) => format!("{e}"),
            },
        );

        let mut rect = RECT::default();
        let have_rect = unsafe { GetWindowRect(hwnd, &mut rect) }.is_ok();
        report.record(
            "hwnd.get_window_rect",
            have_rect,
            format!(
                "({}, {}) {}x{}",
                rect.left,
                rect.top,
                rect.right - rect.left,
                rect.bottom - rect.top
            ),
        );

        // --- monitors -----------------------------------------------------------------
        let mut monitors: u32 = 0;
        let enumerated = unsafe {
            EnumDisplayMonitors(
                None,
                None,
                Some(count_monitors),
                LPARAM(&mut monitors as *mut u32 as isize),
            )
        }
        .as_bool();
        report.record(
            "monitor.enumerate",
            enumerated,
            format!("EnumDisplayMonitors returned {enumerated}, monitors = {monitors}"),
        );

        // A runner with no display device at all is a measurement gap, not an implementation
        // failure. Everything downstream of a monitor is then NOT TESTED, never FAIL.
        let has_display = enumerated && monitors >= 1;
        if !has_display {
            for name in [
                "monitor.get_monitor_info",
                "dpi.get_dpi_for_window",
                "placement.capture",
                "placement.resolve_on_monitor",
                "placement.unknown_monitor_falls_back",
            ] {
                report.not_tested(name, "this runner reports no display device");
            }
            report.not_tested(
                "zorder.observed_behind_other_app",
                "needs an interactive desktop and a second application; acceptance.md B5 / C1-C4",
            );
            report.not_tested(
                "placement.physical_monitor_hotplug",
                "needs a monitor to be physically unplugged; acceptance.md E8",
            );
            teardown(report, hwnd, hinstance);
            return;
        }

        let mon = unsafe { MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST) };
        let mut mi = MONITORINFO {
            cbSize: core::mem::size_of::<MONITORINFO>() as u32,
            ..Default::default()
        };
        let got_info = !mon.0.is_null() && unsafe { GetMonitorInfoW(mon, &mut mi) }.as_bool();
        let work = mi.rcWork;
        let work_w = work.right - work.left;
        let work_h = work.bottom - work.top;
        report.record(
            "monitor.get_monitor_info",
            got_info && work_w > 0 && work_h > 0,
            format!(
                "rcWork = ({}, {}, {}, {}) -> {work_w}x{work_h}",
                work.left, work.top, work.right, work.bottom
            ),
        );

        let dpi = unsafe { GetDpiForWindow(hwnd) };
        report.record(
            "dpi.get_dpi_for_window",
            dpi > 0,
            format!("GetDpiForWindow = {dpi}"),
        );
        report.note(format!(
            "this runner reports {dpi} DPI; DPI *changes* (125/150/175%) still need a real \
             desktop and stay NOT TESTED"
        ));

        // --- normalized-placement computation on real geometry ------------------------
        match crate::monitor_placement::capture(raw, 320, 240) {
            Ok(rec) => {
                let sane = (0.0..=1.0).contains(&rec.norm_x)
                    && (0.0..=1.0).contains(&rec.norm_y)
                    && !rec.monitor_id.is_empty();
                report.record(
                    "placement.capture",
                    sane,
                    format!(
                        "monitorId={:?} normX={} normY={}",
                        rec.monitor_id, rec.norm_x, rec.norm_y
                    ),
                );
                match crate::monitor_placement::resolve(raw, &rec) {
                    Ok((x, y, exact)) => {
                        let w = crate::monitor_placement::dip_to_px(rec.width_dip, dpi.max(96));
                        let h = crate::monitor_placement::dip_to_px(rec.height_dip, dpi.max(96));
                        let inside =
                            rect_inside(x, y, w, h, work.left, work.top, work_w, work_h);
                        report.record(
                            "placement.resolve_on_monitor",
                            exact && inside,
                            format!(
                                "resolved ({x}, {y}) {w}x{h}, monitor matched by id = {exact}, \
                                 fully inside rcWork = {inside}"
                            ),
                        );
                    }
                    Err(e) => report.record("placement.resolve_on_monitor", false, e),
                }
            }
            Err(e) => {
                report.record("placement.capture", false, e);
                report.not_applicable("placement.resolve_on_monitor", "capture failed");
            }
        }

        // Restore-onto-a-vanished-monitor is the branch a CI runner cannot stage physically,
        // but the *fallback arithmetic* is checkable: an unknown monitorId must fall back to
        // the primary monitor and still land on-screen.
        let ghost = crate::monitor_placement::NormalizedPlacement::new(
            "\\\\.\\DISPLAY_THAT_DOES_NOT_EXIST".to_string(),
            1.0,
            1.0,
            320,
            240,
        );
        match crate::monitor_placement::resolve(raw, &ghost) {
            Ok((x, y, exact)) => {
                let w = crate::monitor_placement::dip_to_px(320, dpi.max(96));
                let h = crate::monitor_placement::dip_to_px(240, dpi.max(96));
                let inside = rect_inside(x, y, w, h, work.left, work.top, work_w, work_h);
                report.record(
                    "placement.unknown_monitor_falls_back",
                    !exact && inside,
                    format!(
                        "resolved ({x}, {y}), matched by id = {exact} (expected false), \
                         on-screen = {inside}"
                    ),
                );
            }
            Err(e) => report.record("placement.unknown_monitor_falls_back", false, e),
        }
        report.not_tested(
            "zorder.observed_behind_other_app",
            "needs an interactive desktop and a second application; acceptance.md B5 / C1-C4",
        );
        report.not_tested(
            "placement.physical_monitor_hotplug",
            "needs a monitor to be physically unplugged; acceptance.md E8",
        );

        teardown(report, hwnd, hinstance);
    }

    /// Destroy the probe window and unregister its class. Called on every exit path that got
    /// as far as creating the window, so a probe run never leaks either.
    fn teardown(report: &mut Report, hwnd: HWND, hinstance: HINSTANCE) {
        let destroyed = unsafe { DestroyWindow(hwnd) };
        report.record(
            "hwnd.destroy",
            destroyed.is_ok(),
            match &destroyed {
                Ok(()) => "DestroyWindow ok".to_string(),
                Err(e) => format!("{e}"),
            },
        );
        let unregistered = unsafe { UnregisterClassW(CLASS_NAME, Some(hinstance)) };
        report.record(
            "hwnd.unregister_class",
            unregistered.is_ok(),
            match &unregistered {
                Ok(()) => "UnregisterClassW ok".to_string(),
                Err(e) => format!("{e}"),
            },
        );
    }

    fn last_error() -> String {
        format!("{:?}", windows::core::Error::from_win32())
    }
}

#[cfg(not(windows))]
mod imp {
    use super::Report;

    pub fn run(report: &mut Report) {
        for name in [
            "process.module_handle",
            "hwnd.register_class",
            "hwnd.create_hidden_toplevel",
            "subclass.attach",
            "subclass.callback_invoked",
            "subclass.callback_repeats",
            "subclass.remove",
            "subclass.remove_stops_callback",
            "win_shell.attach",
            "win_shell.detach",
            "exstyle.set_and_read_back",
            "exstyle.restore",
            "zorder.setwindowpos_hwnd_bottom",
            "monitor.enumerate",
            "monitor.get_monitor_info",
            "dpi.get_dpi_for_window",
            "hwnd.get_window_rect",
            "placement.capture",
            "placement.resolve_on_monitor",
            "placement.unknown_monitor_falls_back",
            "zorder.observed_behind_other_app",
            "placement.physical_monitor_hotplug",
            "hwnd.destroy",
            "hwnd.unregister_class",
        ] {
            report.not_applicable(name, "not a Windows target");
        }
        report.note("built for a non-Windows target; no Win32 call was attempted");
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn within_is_inclusive() {
        assert!(within(0, 0, 10));
        assert!(within(10, 0, 10));
        assert!(!within(-1, 0, 10));
        assert!(!within(11, 0, 10));
    }

    #[test]
    fn rect_inside_accepts_the_corners_of_the_work_area() {
        // 1920x1040 work area, 320x240 widget: the legal origins are 0..1600 / 0..800.
        assert!(rect_inside(0, 0, 320, 240, 0, 0, 1920, 1040));
        assert!(rect_inside(1600, 800, 320, 240, 0, 0, 1920, 1040));
        assert!(!rect_inside(1601, 800, 320, 240, 0, 0, 1920, 1040));
        assert!(!rect_inside(0, -1, 320, 240, 0, 0, 1920, 1040));
    }

    #[test]
    fn rect_inside_honours_a_non_zero_work_area_origin() {
        // Secondary monitor to the left of the primary one, taskbar on top.
        assert!(rect_inside(-1920, 40, 320, 240, -1920, 40, 1920, 1000));
        assert!(!rect_inside(-1921, 40, 320, 240, -1920, 40, 1920, 1000));
    }

    #[test]
    fn rect_inside_pins_to_the_origin_when_the_work_area_is_too_small() {
        // Mirrors `monitor_placement::denormalize`, which returns the work-area origin when
        // there is nothing to slide.
        assert!(rect_inside(0, 0, 320, 240, 0, 0, 200, 200));
        assert!(!rect_inside(1, 0, 320, 240, 0, 0, 200, 200));
    }

    /// The probe asserts `resolve` lands inside `rcWork`; that assertion is only meaningful
    /// if the placement arithmetic agrees with `rect_inside` on the extremes.
    #[test]
    fn denormalized_extremes_are_inside_the_work_area() {
        use crate::monitor_placement::{denormalize, dip_to_px};
        let (wx, wy, ww, wh) = (0, 0, 1920, 1040);
        let w = dip_to_px(320, 144); // 150%
        let h = dip_to_px(240, 144);
        for n in [0.0_f64, 0.5, 1.0] {
            let x = denormalize(n, wx, ww, w);
            let y = denormalize(n, wy, wh, h);
            assert!(
                rect_inside(x, y, w, h, wx, wy, ww, wh),
                "n={n} -> ({x}, {y}) {w}x{h} escaped the work area"
            );
        }
    }

    #[test]
    fn report_counts_and_renders() {
        let mut r = Report::default();
        r.record("a.pass", true, "ok");
        r.record("b.fail", false, "nope");
        r.not_applicable("c.na", "not here");
        r.note("hello");
        assert_eq!(r.count(Verdict::Pass), 1);
        assert_eq!(r.failures(), 1);
        assert_eq!(r.count(Verdict::NotApplicable), 1);
        r.not_tested("d.nt", "needs a desktop");
        assert_eq!(r.count(Verdict::NotTested), 1);
        let text = r.to_text();
        assert!(text.contains("PASS"));
        assert!(text.contains("FAIL"));
        assert!(text.contains("NOT TESTED"));
        assert!(text.contains("NOT APPLICABLE"));
        assert!(text.contains("note: hello"));
        assert!(text.contains("summary: 1 PASS, 1 FAIL, 1 NOT TESTED, 1 NOT APPLICABLE"));
    }

    /// Off Windows the probe must stay silent rather than inventing verdicts.
    #[cfg(not(windows))]
    #[test]
    fn non_windows_run_reports_only_not_applicable() {
        let r = run();
        assert!(!r.checks.is_empty());
        assert_eq!(r.failures(), 0);
        assert_eq!(r.count(Verdict::Pass), 0);
        assert_eq!(r.count(Verdict::NotApplicable), r.checks.len());
        assert_eq!(r.count(Verdict::NotTested), 0);
    }
}
