//! Spike A — **EXPERIMENT**: monitor-normalized placement record.
//!
//! This is explicitly **not** a production contract and **not** a replacement for the
//! prototype's existing save/restore. `window-position.json` (absolute physical pixels)
//! stays exactly as it was and stays the default path. This module writes a *second*,
//! separate file and is only reached through the two `experiment_*` commands, so the
//! behaviour the spike already measured is untouched.
//!
//! Record, identical on both platforms:
//!
//! ```json
//! {
//!   "schema": 1,
//!   "monitorId": "\\\\.\\DISPLAY1",
//!   "normX": 0.5,
//!   "normY": 1.0,
//!   "widthDip": 320,
//!   "heightDip": 240
//! }
//! ```
//!
//! *Save* normalizes the widget origin against `(work area size − widget size)` on the
//! monitor the widget currently sits on, clamped to `0..1`.
//! *Restore* looks the monitor up by `monitorId`, falls back to the **primary** monitor's
//! visible (work) area when it is gone, recomputes the pixel origin against the **current**
//! work area and the **current** DPI, and clamps so the widget stays fully on that monitor.
//!
//! **Byte-compatibility.** Both platforms must emit the same bytes for the same logical
//! placement. The canonical form is exactly what `serde_json::to_string_pretty` produces for
//! the struct below: two-space indent, LF line endings, keys in declaration order, no trailing
//! newline, and `f64` rendered by ryu (`0.0`, `1.0`, `0.7333`, `9e-6`). The WPF side reproduces
//! that rendering by hand in `MonitorNormalizedPlacementStore.FormatNormalized`, so this side
//! must stay on the plain serializer and must not "tidy" the float format — the golden test
//! at the bottom of this file pins the exact bytes and will fail loudly if a `serde_json`
//! bump changes them.
//! The *reader* is deliberately lenient, so a differently formatted but semantically equal
//! file still loads.
//!
//! **Evidence.** Nothing here has been executed. `cargo check --target
//! x86_64-pc-windows-msvc` is the only evidence. Every behavioural statement is **NOT TESTED**.

use serde::{Deserialize, Serialize};

/// Current record schema version. Bump only with a matching change on the WPF side.
pub const SCHEMA: u32 = 1;

/// File name of the experiment record. Sits beside `window-position.json`, never replaces it.
/// Same name the WPF prototype uses for its own copy, under each platform's own config dir.
pub const FILE_NAME: &str = "window-normalized.experimental.json";

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct NormalizedPlacement {
    pub schema: u32,
    #[serde(rename = "monitorId")]
    pub monitor_id: String,
    #[serde(rename = "normX")]
    pub norm_x: f64,
    #[serde(rename = "normY")]
    pub norm_y: f64,
    #[serde(rename = "widthDip")]
    pub width_dip: u32,
    #[serde(rename = "heightDip")]
    pub height_dip: u32,
}

/// Clamp to `0.0..=1.0`, mapping NaN and negative zero to a plain `0.0` so the canonical
/// writer can never emit `NaN` or `-0.000000`.
fn clamp01(v: f64) -> f64 {
    if v.is_nan() || v <= 0.0 {
        0.0
    } else if v >= 1.0 {
        1.0
    } else {
        v
    }
}

/// Round to the six decimals the canonical form stores, so save → load → save is stable.
fn round6(v: f64) -> f64 {
    (clamp01(v) * 1_000_000.0).round() / 1_000_000.0
}

impl NormalizedPlacement {
    pub fn new(monitor_id: String, norm_x: f64, norm_y: f64, width_dip: u32, height_dip: u32) -> Self {
        Self {
            schema: SCHEMA,
            monitor_id,
            norm_x: round6(norm_x),
            norm_y: round6(norm_y),
            width_dip,
            height_dip,
        }
    }

    /// The canonical byte form: `serde_json::to_string_pretty`, nothing added and nothing
    /// reformatted. See the module docs — the WPF side reproduces these exact bytes.
    pub fn to_canonical_json(&self) -> String {
        // Values were already clamped and rounded by `new` / `from_json`; re-clamp here so a
        // hand-built record can never emit NaN, -0.0 or an out-of-range normal.
        let safe = Self {
            schema: self.schema,
            monitor_id: self.monitor_id.clone(),
            norm_x: round6(self.norm_x),
            norm_y: round6(self.norm_y),
            width_dip: self.width_dip,
            height_dip: self.height_dip,
        };
        serde_json::to_string_pretty(&safe).unwrap_or_default()
    }

    /// Lenient reader: any JSON that carries the six fields is accepted, whatever its
    /// spacing or number formatting. Values are clamped on the way in.
    pub fn from_json(raw: &str) -> Result<Self, String> {
        let mut rec: Self = serde_json::from_str(raw).map_err(|e| format!("parse: {e}"))?;
        if rec.schema != SCHEMA {
            return Err(format!(
                "unsupported schema {} (this build understands {SCHEMA})",
                rec.schema
            ));
        }
        rec.norm_x = round6(rec.norm_x);
        rec.norm_y = round6(rec.norm_y);
        Ok(rec)
    }
}

// ---------------------------------------------------------------------------
// Win32 geometry for the experiment
// ---------------------------------------------------------------------------

/// Work area and identity of one monitor, in physical pixels.
#[derive(Debug, Clone)]
pub struct MonitorWorkArea {
    pub id: String,
    pub left: i32,
    pub top: i32,
    pub width: i32,
    pub height: i32,
    /// Effective DPI of this monitor; 96 when Windows could not answer.
    pub dpi: u32,
}

#[cfg(windows)]
#[deny(unsafe_op_in_unsafe_fn)]
mod geom {
    use super::MonitorWorkArea;

    use windows::core::BOOL;
    use windows::Win32::Foundation::{HWND, LPARAM, POINT, RECT};
    use windows::Win32::Graphics::Gdi::{
        EnumDisplayMonitors, GetMonitorInfoW, MonitorFromPoint, MonitorFromWindow, HDC, HMONITOR,
        MONITORINFO, MONITORINFOEXW, MONITOR_DEFAULTTONEAREST, MONITOR_DEFAULTTOPRIMARY,
    };
    use windows::Win32::UI::HiDpi::{GetDpiForMonitor, GetDpiForWindow, MDT_EFFECTIVE_DPI};
    use windows::Win32::UI::WindowsAndMessaging::GetWindowRect;

    fn hwnd(raw: isize) -> HWND {
        HWND(raw as *mut core::ffi::c_void)
    }

    /// Effective DPI of a monitor. Falls back to 96 rather than failing the whole operation.
    fn monitor_dpi(mon: HMONITOR) -> u32 {
        let mut dx: u32 = 0;
        let mut dy: u32 = 0;
        // unsafe #13
        let ok = unsafe { GetDpiForMonitor(mon, MDT_EFFECTIVE_DPI, &mut dx, &mut dy) }.is_ok();
        if ok && dx > 0 {
            dx
        } else {
            96
        }
    }

    /// `MONITORINFOEXW` → (`szDevice` as a String, work-area RECT).
    fn info(mon: HMONITOR) -> Option<(String, RECT)> {
        if mon.0.is_null() {
            return None;
        }
        let mut mi = MONITORINFOEXW {
            monitorInfo: MONITORINFO {
                cbSize: core::mem::size_of::<MONITORINFOEXW>() as u32,
                ..Default::default()
            },
            szDevice: [0u16; 32],
        };
        // unsafe #14 — MONITORINFOEXW is passed as a MONITORINFO whose cbSize declares the
        // larger size; that is the documented calling convention for this API.
        let ok = unsafe {
            GetMonitorInfoW(mon, &mut mi as *mut MONITORINFOEXW as *mut MONITORINFO).as_bool()
        };
        if !ok {
            return None;
        }
        let len = mi.szDevice.iter().position(|&c| c == 0).unwrap_or(32);
        Some((
            String::from_utf16_lossy(&mi.szDevice[..len]),
            mi.monitorInfo.rcWork,
        ))
    }

    fn work_area(mon: HMONITOR) -> Option<MonitorWorkArea> {
        let (id, r) = info(mon)?;
        Some(MonitorWorkArea {
            id,
            left: r.left,
            top: r.top,
            width: r.right - r.left,
            height: r.bottom - r.top,
            dpi: monitor_dpi(mon),
        })
    }

    unsafe extern "system" fn collect(
        mon: HMONITOR,
        _hdc: HDC,
        _clip: *mut RECT,
        lparam: LPARAM,
    ) -> BOOL {
        let sink = lparam.0 as *mut Vec<HMONITOR>;
        if !sink.is_null() {
            // unsafe #15 — `sink` is the &mut Vec the caller below passed in, alive for the
            // whole EnumDisplayMonitors call.
            unsafe { (*sink).push(mon) };
        }
        BOOL(1)
    }

    /// The monitor the window currently sits on (nearest, never null).
    pub fn current(raw: isize) -> Option<MonitorWorkArea> {
        // unsafe #16
        let mon = unsafe { MonitorFromWindow(hwnd(raw), MONITOR_DEFAULTTONEAREST) };
        work_area(mon)
    }

    /// The primary monitor's visible (work) area — the documented fallback.
    pub fn primary() -> Option<MonitorWorkArea> {
        // unsafe #17
        let mon = unsafe { MonitorFromPoint(POINT { x: 0, y: 0 }, MONITOR_DEFAULTTOPRIMARY) };
        work_area(mon)
    }

    /// Look a monitor up again by the id stored in the record.
    pub fn by_id(id: &str) -> Option<MonitorWorkArea> {
        let mut sink: Vec<HMONITOR> = Vec::new();
        // unsafe #18
        unsafe {
            let _ = EnumDisplayMonitors(
                None,
                None,
                Some(collect),
                LPARAM(&mut sink as *mut Vec<HMONITOR> as isize),
            );
        }
        sink.into_iter()
            .filter_map(work_area)
            .find(|m| m.id == id)
    }

    /// Window origin and size in physical pixels.
    pub fn window_rect(raw: isize) -> Option<(i32, i32, i32, i32)> {
        let mut r = RECT::default();
        // unsafe #19
        if unsafe { GetWindowRect(hwnd(raw), &mut r) }.is_err() {
            return None;
        }
        Some((r.left, r.top, r.right - r.left, r.bottom - r.top))
    }

    /// DPI of the window itself; 96 when Windows could not answer.
    pub fn window_dpi(raw: isize) -> u32 {
        // unsafe #20
        let d = unsafe { GetDpiForWindow(hwnd(raw)) };
        if d == 0 {
            96
        } else {
            d
        }
    }
}

#[cfg(not(windows))]
mod geom {
    use super::MonitorWorkArea;

    pub fn current(_raw: isize) -> Option<MonitorWorkArea> {
        None
    }
    pub fn primary() -> Option<MonitorWorkArea> {
        None
    }
    pub fn by_id(_id: &str) -> Option<MonitorWorkArea> {
        None
    }
    pub fn window_rect(_raw: isize) -> Option<(i32, i32, i32, i32)> {
        None
    }
    pub fn window_dpi(_raw: isize) -> u32 {
        96
    }
}

// ---------------------------------------------------------------------------
// Save / restore maths — platform-independent, so it is the same arithmetic both
// platforms have to agree on.
// ---------------------------------------------------------------------------

/// Normalize an origin inside a work area: `(origin - workOrigin) / (workSize - widgetSize)`,
/// clamped to `0..1`. A work area no larger than the widget yields `0.0` (nothing to slide).
pub fn normalize(origin: i32, work_origin: i32, work_size: i32, widget_size: i32) -> f64 {
    let span = work_size - widget_size;
    if span <= 0 {
        return 0.0;
    }
    clamp01((origin - work_origin) as f64 / span as f64)
}

/// Inverse of [`normalize`], clamped so the widget stays fully inside the work area.
/// A work area no larger than the widget pins the widget to the work-area origin.
pub fn denormalize(norm: f64, work_origin: i32, work_size: i32, widget_size: i32) -> i32 {
    let span = work_size - widget_size;
    if span <= 0 {
        return work_origin;
    }
    let offset = (clamp01(norm) * span as f64).round() as i32;
    work_origin + offset.clamp(0, span)
}

/// Widget size in physical pixels at a given DPI.
pub fn dip_to_px(dip: u32, dpi: u32) -> i32 {
    let dpi = if dpi == 0 { 96 } else { dpi };
    ((dip as f64) * (dpi as f64) / 96.0).round() as i32
}

/// SAVE side. Reads the window's current rectangle and the work area of the monitor it sits
/// on, and produces the record. Windows-only; off Windows this returns `Err`.
///
/// **NOT TESTED.**
pub fn capture(hwnd_raw: isize, width_dip: u32, height_dip: u32) -> Result<NormalizedPlacement, String> {
    let (x, y, w, h) = geom::window_rect(hwnd_raw)
        .ok_or_else(|| "monitor-normalized experiment: window rect unavailable".to_string())?;
    let mon = geom::current(hwnd_raw)
        .ok_or_else(|| "monitor-normalized experiment: monitor info unavailable".to_string())?;

    Ok(NormalizedPlacement::new(
        mon.id,
        normalize(x, mon.left, mon.width, w),
        normalize(y, mon.top, mon.height, h),
        width_dip,
        height_dip,
    ))
}

/// RESTORE side. Looks the monitor up by id, falls back to the primary monitor's work area,
/// recomputes the origin against the *current* work area and the *current* DPI of that
/// monitor, and clamps the widget fully on-monitor. Returns physical pixels.
///
/// **NOT TESTED.**
pub fn resolve(hwnd_raw: isize, rec: &NormalizedPlacement) -> Result<(i32, i32, bool), String> {
    let (mon, exact) = match geom::by_id(&rec.monitor_id) {
        Some(m) => (m, true),
        None => (
            geom::primary().ok_or_else(|| {
                "monitor-normalized experiment: no primary monitor work area".to_string()
            })?,
            false,
        ),
    };

    // "the CURRENT DPI": the effective DPI of the monitor we are about to land on, not the
    // one the window happens to be on right now. Falls back to the window's own DPI.
    let dpi = if mon.dpi == 0 {
        geom::window_dpi(hwnd_raw)
    } else {
        mon.dpi
    };
    let w = dip_to_px(rec.width_dip, dpi);
    let h = dip_to_px(rec.height_dip, dpi);

    Ok((
        denormalize(rec.norm_x, mon.left, mon.width, w),
        denormalize(rec.norm_y, mon.top, mon.height, h),
        exact,
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Golden bytes. This is the cross-platform contract: if this test ever has to be
    /// edited, the WPF writer has to change in the same commit.
    #[test]
    fn canonical_json_is_byte_stable() {
        let rec = NormalizedPlacement::new("\\\\.\\DISPLAY1".to_string(), 0.5, 1.0, 320, 240);
        assert_eq!(
            rec.to_canonical_json(),
            concat!(
                "{\n",
                "  \"schema\": 1,\n",
                "  \"monitorId\": \"\\\\\\\\.\\\\DISPLAY1\",\n",
                "  \"normX\": 0.5,\n",
                "  \"normY\": 1.0,\n",
                "  \"widthDip\": 320,\n",
                "  \"heightDip\": 240\n",
                "}"
            )
        );
    }

    /// The float renderings the WPF `FormatNormalized` hand-reproduces. Pinned so a
    /// `serde_json` / ryu change cannot silently break byte-compatibility.
    #[test]
    fn float_rendering_matches_the_wpf_reproduction() {
        let cases: [(f64, &str); 6] = [
            (0.0, "0.0"),
            (1.0, "1.0"),
            (0.5, "0.5"),
            (0.7333, "0.7333"),
            (0.000009, "9e-6"),
            (0.00001, "0.00001"),
        ];
        for (v, want) in cases {
            let rec = NormalizedPlacement::new("m".to_string(), v, 0.0, 320, 240);
            let line = format!("  \"normX\": {want},");
            assert!(
                rec.to_canonical_json().contains(&line),
                "{v} should render as {want}; got:\n{}",
                rec.to_canonical_json()
            );
        }
    }

    #[test]
    fn round_trips_through_its_own_bytes() {
        let rec = NormalizedPlacement::new("\\\\.\\DISPLAY2".to_string(), 0.333333, 0.0, 320, 240);
        let back = NormalizedPlacement::from_json(&rec.to_canonical_json()).expect("parses");
        assert_eq!(rec, back);
    }

    #[test]
    fn out_of_range_and_nan_are_clamped() {
        let rec = NormalizedPlacement::new("m".to_string(), -3.0, f64::NAN, 320, 240);
        assert_eq!(rec.norm_x, 0.0);
        assert_eq!(rec.norm_y, 0.0);
        assert!(!rec.to_canonical_json().contains("NaN"));
        assert!(!rec.to_canonical_json().contains("-0"));
    }

    #[test]
    fn normalize_denormalize_are_inverse_on_a_plain_work_area() {
        // 1920x1040 work area at origin 0,0; widget 320x240.
        assert_eq!(normalize(0, 0, 1920, 320), 0.0);
        assert_eq!(normalize(1600, 0, 1920, 320), 1.0);
        assert_eq!(denormalize(1.0, 0, 1920, 320), 1600);
        assert_eq!(denormalize(0.0, 0, 1920, 320), 0);
        // Clamped: a widget wider than the work area pins to the work-area origin.
        assert_eq!(normalize(50, 0, 200, 320), 0.0);
        assert_eq!(denormalize(0.9, 0, 200, 320), 0);
    }

    #[test]
    fn dip_to_px_follows_dpi() {
        assert_eq!(dip_to_px(320, 96), 320);
        assert_eq!(dip_to_px(320, 120), 400); // 125%
        assert_eq!(dip_to_px(240, 144), 360); // 150%
    }
}
