//! Spike A — Windows-only message-hook shell layer for the Tauri prototype.
//!
//! **What this is.** The prior spike recorded four shell behaviours that Tauri 2's
//! high-level API cannot reach, because `WebviewWindow` exposes no window-procedure hook:
//! `WM_WINDOWPOSCHANGING`, `WM_MOUSEACTIVATE`, `WM_ACTIVATE`, `WM_DISPLAYCHANGE`.
//! This module closes that gap with a **comctl32 window subclass** attached to the HWND
//! returned by the *public* [`tauri::WebviewWindow::hwnd`].
//!
//! **What this is not.** It does not touch Tauri internals, does not monkey-patch tao/wry,
//! and does not reach into the UI or any product code. The UI keeps calling exactly the same
//! Rust commands it called before; this layer only observes a mode value that `lib.rs`
//! publishes into it, and answers Windows messages.
//!
//! **Threading.** `SetWindowSubclass` must be called from the thread that owns the window,
//! and the subclass procedure is then invoked on that same UI thread, re-entrantly with
//! respect to the rest of the app. The shared state is therefore a lock-free
//! [`AtomicU8`](std::sync::atomic::AtomicU8) — never a `Mutex` that the UI thread could
//! block on while another thread holds it.
//!
//! **Evidence.** Nothing here has been executed. This container is headless Ubuntu; the only
//! evidence is `cargo check --target x86_64-pc-windows-msvc`. Every behavioural statement in
//! this file is **NOT TESTED**.

/// Mode codes shared with the subclass procedure. Deliberately plain `u8` rather than the
/// product-side `Mode` enum, so the shell layer has no dependency on UI/product types.
pub const MODE_PASSIVE: u8 = 0;
pub const MODE_ACTIVE: u8 = 1;
pub const MODE_LAYOUT_EDIT: u8 = 2;

#[cfg(windows)]
#[deny(unsafe_op_in_unsafe_fn)]
mod imp {
    use std::sync::atomic::{AtomicBool, AtomicU8, Ordering};

    use windows::Win32::Foundation::{HWND, LPARAM, LRESULT, RECT, WPARAM};
    use windows::Win32::Graphics::Gdi::{
        GetMonitorInfoW, MonitorFromWindow, MONITORINFO, MONITOR_DEFAULTTONEAREST,
    };
    use windows::Win32::UI::Shell::{DefSubclassProc, RemoveWindowSubclass, SetWindowSubclass};
    use windows::Win32::UI::WindowsAndMessaging::{
        GetWindowRect, SetWindowPos, HWND_BOTTOM, MA_NOACTIVATE, SWP_NOACTIVATE, SWP_NOMOVE,
        SWP_NOSIZE, SWP_NOZORDER, WA_INACTIVE, WINDOWPOS, WM_ACTIVATE, WM_DISPLAYCHANGE,
        WM_MOUSEACTIVATE, WM_NCDESTROY, WM_WINDOWPOSCHANGING,
    };

    /// Subclass id. Any value is legal; it only has to be unique per (HWND, proc) pair.
    /// `0x53_50_49_4B` is ASCII `SPIK`.
    const SUBCLASS_ID: usize = 0x5350_494B;

    /// The PASSIVE / ACTIVE / LAYOUT EDIT value the subclass reads. Written by the app
    /// thread through [`publish_mode`], read by the UI thread inside the subclass proc.
    /// An atomic, not a lock: the window procedure must never block.
    static MODE: AtomicU8 = AtomicU8::new(super::MODE_PASSIVE);
    static ATTACHED: AtomicBool = AtomicBool::new(false);

    fn hwnd(raw: isize) -> HWND {
        HWND(raw as *mut core::ffi::c_void)
    }

    /// Publish the current shell mode for the subclass procedure to read.
    pub fn publish_mode(mode: u8) {
        MODE.store(mode, Ordering::Release);
    }

    fn passive() -> bool {
        MODE.load(Ordering::Acquire) == super::MODE_PASSIVE
    }

    /// True once [`attach`] has succeeded and before [`detach`] / `WM_NCDESTROY`.
    pub fn is_attached() -> bool {
        ATTACHED.load(Ordering::Acquire)
    }

    fn clamp(v: i32, lo: i32, hi: i32) -> i32 {
        if hi < lo {
            lo
        } else if v < lo {
            lo
        } else if v > hi {
            hi
        } else {
            v
        }
    }

    /// Push the window to the bottom of the Z-order without activating it.
    /// Used from `WM_ACTIVATE` when something activated us anyway.
    fn force_bottom(h: HWND) {
        // unsafe #1
        unsafe {
            let _ = SetWindowPos(
                h,
                Some(HWND_BOTTOM),
                0,
                0,
                0,
                0,
                SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE,
            );
        }
    }

    /// `WM_DISPLAYCHANGE` handler body: if the window is now stranded outside the work area
    /// of the monitor nearest to it, slide it back inside. Pure Win32 — it deliberately does
    /// not call back into Tauri, because this runs inside the window procedure.
    ///
    /// **NOT TESTED.**
    fn revalidate_placement(h: HWND) {
        let mut rect = RECT::default();
        let mut mi = MONITORINFO {
            cbSize: core::mem::size_of::<MONITORINFO>() as u32,
            ..Default::default()
        };

        // unsafe #2 — three reads of window/monitor geometry, no writes.
        let ok = unsafe {
            if GetWindowRect(h, &mut rect).is_err() {
                false
            } else {
                let mon = MonitorFromWindow(h, MONITOR_DEFAULTTONEAREST);
                !mon.0.is_null() && GetMonitorInfoW(mon, &mut mi).as_bool()
            }
        };
        if !ok {
            return;
        }

        let work = mi.rcWork;
        let w = rect.right - rect.left;
        let hgt = rect.bottom - rect.top;
        let x = clamp(rect.left, work.left, work.right - w);
        let y = clamp(rect.top, work.top, work.bottom - hgt);
        if x == rect.left && y == rect.top {
            return;
        }

        // unsafe #3
        unsafe {
            let _ = SetWindowPos(
                h,
                None,
                x,
                y,
                0,
                0,
                SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE,
            );
        }
    }

    /// The subclass procedure. Runs on the UI thread, for every message the window receives.
    ///
    /// Only the four messages the spike named are touched; everything else goes straight to
    /// `DefSubclassProc`, which continues the subclass chain and finally reaches tao's own
    /// window procedure. Tauri therefore still sees every message it saw before.
    ///
    /// **NOT TESTED.**
    unsafe extern "system" fn subclass_proc(
        h: HWND,
        msg: u32,
        wparam: WPARAM,
        lparam: LPARAM,
        _id: usize,
        _refdata: usize,
    ) -> LRESULT {
        match msg {
            // Standing rule, not a one-shot placement: every reposition Windows is about to
            // perform is rewritten to land at the bottom of the Z-order, without activation.
            WM_WINDOWPOSCHANGING if passive() => {
                let wp = lparam.0 as *mut WINDOWPOS;
                if !wp.is_null() {
                    // unsafe #4 — the only pointer write in this module. `lparam` on
                    // WM_WINDOWPOSCHANGING is documented as a WINDOWPOS the receiver may edit.
                    unsafe {
                        (*wp).hwndInsertAfter = HWND_BOTTOM;
                        (*wp).flags &= !SWP_NOZORDER;
                        (*wp).flags |= SWP_NOACTIVATE;
                    }
                }
                // unsafe #5 — pass the edited WINDOWPOS down the chain.
                unsafe { DefSubclassProc(h, msg, wparam, lparam) }
            }

            // MA_NOACTIVATE, deliberately NOT MA_NOACTIVATEANDEAT: the click is still
            // delivered to the surface, the window just does not become foreground.
            WM_MOUSEACTIVATE if passive() => LRESULT(MA_NOACTIVATE as isize),

            // Something activated us anyway (a shell action, a stray SetForegroundWindow).
            // Let the default handling run first, then drop back to the bottom band.
            WM_ACTIVATE if passive() => {
                // unsafe #6
                let r = unsafe { DefSubclassProc(h, msg, wparam, lparam) };
                if (wparam.0 & 0xFFFF) as u32 != WA_INACTIVE {
                    force_bottom(h);
                }
                r
            }

            // Monitor layout changed underneath us.
            WM_DISPLAYCHANGE => {
                // unsafe #7
                let r = unsafe { DefSubclassProc(h, msg, wparam, lparam) };
                revalidate_placement(h);
                r
            }

            // Last message the window ever gets: unhook, as the subclass docs require.
            WM_NCDESTROY => {
                // unsafe #8
                unsafe {
                    let _ = RemoveWindowSubclass(h, Some(subclass_proc), SUBCLASS_ID);
                }
                ATTACHED.store(false, Ordering::Release);
                // unsafe #9
                unsafe { DefSubclassProc(h, msg, wparam, lparam) }
            }

            // unsafe #10 — everything else is untouched.
            _ => unsafe { DefSubclassProc(h, msg, wparam, lparam) },
        }
    }

    /// Attach the subclass to the public HWND. **Must be called on the UI thread.**
    pub fn attach(raw: isize) -> Result<(), String> {
        if raw == 0 {
            return Err("win_shell::attach: null HWND".to_string());
        }
        if ATTACHED.load(Ordering::Acquire) {
            return Ok(());
        }
        // unsafe #11
        let ok = unsafe { SetWindowSubclass(hwnd(raw), Some(subclass_proc), SUBCLASS_ID, 0) };
        if ok.as_bool() {
            ATTACHED.store(true, Ordering::Release);
            Ok(())
        } else {
            Err("SetWindowSubclass failed".to_string())
        }
    }

    /// Detach the subclass. **Must be called on the UI thread.** `WM_NCDESTROY` does this
    /// too, so this is only for an explicit early teardown.
    pub fn detach(raw: isize) -> Result<(), String> {
        if raw == 0 || !ATTACHED.load(Ordering::Acquire) {
            return Ok(());
        }
        // unsafe #12
        let ok = unsafe { RemoveWindowSubclass(hwnd(raw), Some(subclass_proc), SUBCLASS_ID) };
        ATTACHED.store(false, Ordering::Release);
        if ok.as_bool() {
            Ok(())
        } else {
            Err("RemoveWindowSubclass failed".to_string())
        }
    }
}

/// Non-Windows stub, so the crate still builds (and the Linux dev loop still works) on
/// targets that have no window procedure to subclass. Every entry point is a no-op.
#[cfg(not(windows))]
mod imp {
    use std::sync::atomic::{AtomicU8, Ordering};

    static MODE: AtomicU8 = AtomicU8::new(super::MODE_PASSIVE);

    pub fn publish_mode(mode: u8) {
        // Kept so the value is observable in a debugger on Linux; nothing reads it.
        MODE.store(mode, Ordering::Release);
    }

    pub fn is_attached() -> bool {
        false
    }

    pub fn attach(_raw: isize) -> Result<(), String> {
        Ok(())
    }

    pub fn detach(_raw: isize) -> Result<(), String> {
        Ok(())
    }
}

pub use imp::{attach, detach, is_attached, publish_mode};
