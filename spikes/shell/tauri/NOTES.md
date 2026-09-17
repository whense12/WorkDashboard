# Spike A — Tauri 2 shell prototype: implementation notes

**Scope.** This is the Tauri 2 half of the shell comparison. It implements the shared
verification surface and the three states (PASSIVE / ACTIVE / LAYOUT EDIT) and nothing else.
No Calendar, no 업체, no 행사, no tasks, no database. The only thing the surface persists is the
window's own position.

**Evidence available in this environment.** The container is Ubuntu 24.04 with no display
server. Nothing was executed. `cargo check --target x86_64-pc-windows-msvc` type-checks the
`#[cfg(windows)]` code paths, and that is the *only* evidence behind anything in this file.
Every runtime claim below is `NOT TESTED`.

---

## Layout

```
tauri/
  package.json              @tauri-apps/cli only; the UI has no bundler and no build step
  ui/index.html             plain HTML/CSS/JS, no framework, no CDN, no web fonts
  src-tauri/
    Cargo.toml              pinned tauri / plugins / windows crate
    build.rs                tauri_build::build()
    tauri.conf.json         window + bundle config
    capabilities/default.json
    icons/                  placeholder icon.png / icon.ico (generated flat colour, not art)
    src/main.rs             thin entry point
    src/lib.rs              all shell logic
    src/win_shell.rs        Windows message-hook layer (subclass on the public HWND) + no-op stub
    src/monitor_placement.rs  EXPERIMENT: monitor-normalized placement record + Win32 monitor geometry
```

---

## Capability → implementation map

| Capability | How | Where |
|---|---|---|
| frameless window | `decorations: false` | `tauri.conf.json` `app.windows[0]` |
| transparent / layered surface | `transparent: true` + `rgba(30,30,30,0.85)` on `#surface` | `tauri.conf.json`, `ui/index.html` |
| minimise taskbar presence | `skipTaskbar: true`, reinforced with `WS_EX_TOOLWINDOW` and clearing `WS_EX_APPWINDOW` | `tauri.conf.json`; `win::apply_styles` in `src/lib.rs` |
| Alt+Tab / switcher policy | **Policy: never appear in Alt+Tab, in any state.** `WS_EX_TOOLWINDOW` is set in every mode, not just PASSIVE | `win::apply_styles` |
| passive bottom-Z | `WebviewWindow::set_always_on_bottom(true)` **and** `SetWindowPos(HWND_BOTTOM, SWP_NOMOVE\|SWP_NOSIZE\|SWP_NOACTIVATE)` | `apply_mode`, `win::send_to_bottom` |
| no-activate (no focus steal) | `WS_EX_NOACTIVATE` set while PASSIVE, cleared on leaving it; `focus: false` and `visible: false` in config so the first paint is already styled | `win::apply_styles`, `tauri.conf.json`, `setup` |
| active-state transition | `set_mode` / `toggle_active` commands re-apply styles, call `SetWindowPos(HWND_TOP, SWP_NOMOVE\|SWP_NOSIZE\|SWP_NOACTIVATE)` and `set_focus()` | `set_mode_internal` → `apply_mode` → `win::release_from_bottom` |
| optional click-through | `WebviewWindow::set_ignore_cursor_events(bool)` **and** `WS_EX_TRANSPARENT`. `Ctrl+Alt+T` outside PASSIVE is a **no-op** and does not arm the preference for later | `apply_mode`, `win::apply_styles`, `toggle_click_through` |
| global shortcut activation | `tauri-plugin-global-shortcut`: `Ctrl+Alt+D` ACTIVE/PASSIVE, `Ctrl+Alt+L` LAYOUT EDIT, `Ctrl+Alt+T` click-through | `mod shortcuts`, `run()` |
| run-at-startup registration | `tauri-plugin-autostart` (Windows: `HKCU\…\Run`), exposed as `autostart_enabled` / `set_autostart` commands | `src/lib.rs` |
| position save + restore | Explicit JSON at `app_config_dir()/window-position.json`; written when LAYOUT EDIT is left **and** on window close; read in `setup` and only reused when the restored rect still overlaps the virtual screen by ≥ 48×48 logical px | `load_position`, `store_position`, `persist_current_position`, `is_position_visible`, `win::virtual_screen` |
| **standing bottom-Z, no-activate on click, activation recovery, display-change recovery** | comctl32 window **subclass** on the public `WebviewWindow::hwnd()` — `WM_WINDOWPOSCHANGING` / `WM_MOUSEACTIVATE` / `WM_ACTIVATE` / `WM_DISPLAYCHANGE`. Additive; the calls above still run | `src/win_shell.rs` |
| **EXPERIMENT: monitor-normalized placement** | separate file `window-normalized.experimental.json`, reached only through `experiment_save_normalized_placement` / `experiment_restore_normalized_placement`. `window-position.json` is unchanged and still owns the default path | `src/monitor_placement.rs` |
| LAYOUT EDIT drag only | `data-tauri-drag-region` is **added to and removed from** the surface and its text rows; outside LAYOUT EDIT the attribute is absent everywhere. It is never put on the two buttons, so the `[LAYOUT EDIT]` toggle stays clickable while dragging is armed | `ui/index.html` `render()` |

---

## Windows message-hook shell layer — `src/win_shell.rs`

**Status: code exists and type-checks for `x86_64-pc-windows-msvc`. NOT TESTED.**
Nothing in this section has been observed. No window has ever been created.

The earlier spike recorded that Tauri 2 exposes no window-procedure hook, so four messages
were out of reach. This module reaches them through a **comctl32 window subclass** attached to
the HWND that the *public* `WebviewWindow::hwnd()` returns. No Tauri internal is used, nothing
in tao/wry is monkey-patched, and the module contains no UI or product code.

| Message | While PASSIVE it does | Why |
|---|---|---|
| `WM_WINDOWPOSCHANGING` | rewrites `WINDOWPOS.hwndInsertAfter = HWND_BOTTOM`, clears `SWP_NOZORDER`, sets `SWP_NOACTIVATE`, then calls `DefSubclassProc` with the edited struct | turns bottom-Z from the old **one-shot placement** into a **standing rule** re-applied on every reposition |
| `WM_MOUSEACTIVATE` | returns `MA_NOACTIVATE` | the click still reaches the surface. **Not** `MA_NOACTIVATEANDEAT`, which would swallow it |
| `WM_ACTIVATE` | lets the default handling run, then `SetWindowPos(HWND_BOTTOM, SWP_NOMOVE\|SWP_NOSIZE\|SWP_NOACTIVATE)` when `wParam != WA_INACTIVE` | recovery path for something that activated the window anyway |
| `WM_DISPLAYCHANGE` | (in **every** mode) re-reads `GetWindowRect` + the nearest monitor work area and slides the window back inside if it is stranded | the old code validated placement only once, at startup |
| `WM_NCDESTROY` | `RemoveWindowSubclass` | the documented teardown point; this is the only detach the app relies on |
| everything else | straight to `DefSubclassProc` | Tauri still sees every message it saw before |

**Raw Win32 APIs this module calls** (all through the `windows` crate, none through Tauri):

```
SetWindowSubclass        RemoveWindowSubclass     DefSubclassProc          (comctl32, Win32_UI_Shell)
SetWindowPos             GetWindowRect                                     (user32)
MonitorFromWindow        GetMonitorInfoW                                   (user32, Win32_Graphics_Gdi)
```
Messages/constants read: `WM_WINDOWPOSCHANGING`, `WM_MOUSEACTIVATE`, `WM_ACTIVATE`,
`WM_DISPLAYCHANGE`, `WM_NCDESTROY`, `WINDOWPOS`, `HWND_BOTTOM`, `MA_NOACTIVATE`, `WA_INACTIVE`,
`SWP_NOZORDER`, `SWP_NOACTIVATE`, `SWP_NOMOVE`, `SWP_NOSIZE`, `MONITORINFO`,
`MONITOR_DEFAULTTONEAREST`.

**Shared state.** The subclass procedure runs on the UI thread and must never block, so the
PASSIVE / ACTIVE / LAYOUT EDIT value it reads is a module-private `AtomicU8`, not a `Mutex`.
`lib.rs` publishes into it from `apply_mode`, *before* the Win32 calls in that function, so a
`WM_WINDOWPOSCHANGING` raised by those calls already sees the new mode. The mapping
`Mode -> u8` lives in `lib.rs` (`Mode::shell_code`) precisely so `win_shell` has no dependency
on the product-side `Mode` type. `Shell`'s existing `Mutex` is untouched and is never taken
from inside the window procedure.

**Attach point.** `setup()` attaches after the first `apply_mode` (mode already published as
PASSIVE) and before `window.show()`, by calling `win_shell::attach` **synchronously**.
`SetWindowSubclass` must run on the thread that owns the window, and the setup hook already runs
on the main thread before the event loop starts pumping.

An earlier revision dispatched this through `run_on_main_thread` and claimed it therefore landed
before `show()`. That was **inverted**: `run_on_main_thread` posts to the event loop, which does
not run until the loop is pumping — i.e. after `show()` has returned and its first
WM_WINDOWPOSCHANGING has already been dispatched. The synchronous call is what actually gets the
subclass in place first. **NOT TESTED** — this is read off the API contract, not observed.

**Non-Windows.** The whole implementation sits in a `#[cfg(windows)] mod imp`; a
`#[cfg(not(windows))] mod imp` supplies the same four entry points as no-ops, so
`cargo check` on Linux still builds. `is_attached()` is `false` there.

**Size.** `src/win_shell.rs` — 284 lines, 182 non-comment/non-blank. **12 `unsafe` blocks**,
plus 1 `unsafe extern "system" fn` declaration (the subclass procedure itself, which is an FFI
callback signature, not a block). `#[deny(unsafe_op_in_unsafe_fn)]` is applied to the module so
that every unsafe operation inside that `unsafe fn` still needs — and is counted in — an
explicit block; they are numbered `unsafe #1` … `unsafe #12` in comments.

---

## EXPERIMENT — monitor-normalized placement — `src/monitor_placement.rs`

**Status: code exists, type-checks for Windows, and its platform-independent half is unit
tested on this Linux host. The Windows geometry half is NOT TESTED.**

**This is an experiment, not a production contract, and it is purely additive.**
`window-position.json` (absolute physical pixels) is unchanged, is still written on leaving
LAYOUT EDIT and on close, and is still the only thing the startup path reads. The experiment
lives in its own file, `window-normalized.experimental.json`, and is reached **only** through
two IPC commands that nothing on the default path calls:

* `experiment_save_normalized_placement`
* `experiment_restore_normalized_placement`

The shared UI is untouched — no new control, exactly as with `autostart_enabled` (limitation
10). Off Windows both commands return an error rather than pretending.

**Record** (schema 1, identical on both platforms):

```json
{
  "schema": 1,
  "monitorId": "\\\\.\\DISPLAY1",
  "normX": 0.5,
  "normY": 1.0,
  "widthDip": 320,
  "heightDip": 240
}
```

*Save.* `MonitorFromWindow(MONITOR_DEFAULTTONEAREST)` → `GetMonitorInfoW` (`MONITORINFOEXW`)
gives the work area and `szDevice`; the origin from `GetWindowRect` is normalized against
`workArea size - widget size` and clamped to `0..1`. `monitorId` is the device name.

*Restore.* `EnumDisplayMonitors` looks the device name up again. If it is gone, the fallback is
the **primary** monitor's visible (work) area via `MonitorFromPoint({0,0}, MONITOR_DEFAULTTOPRIMARY)`.
The pixel origin is recomputed against the **current** work area and the **current** DPI of the
monitor being landed on (`GetDpiForMonitor(MDT_EFFECTIVE_DPI)`, falling back to
`GetDpiForWindow`, then to 96), then clamped so the widget stays fully inside that work area.

**Raw Win32 APIs this module calls:**

```
MonitorFromWindow   MonitorFromPoint    GetMonitorInfoW   EnumDisplayMonitors   (user32)
GetWindowRect                                                                   (user32)
GetDpiForMonitor    GetDpiForWindow                                             (shcore/user32)
```
Structures/constants: `MONITORINFO`, `MONITORINFOEXW` (`szDevice`), `MONITOR_DEFAULTTONEAREST`,
`MONITOR_DEFAULTTOPRIMARY`, `MDT_EFFECTIVE_DPI`, `POINT`, `RECT`.

**Byte-compatibility with the WPF side — MEASURED, not assumed.** The canonical form is exactly
what `serde_json::to_string_pretty` emits: two-space indent, LF, keys in the order above, no
trailing newline, floats rendered by ryu (`0.0`, `1.0`, `0.7333`, `9e-6`, `0.00001`). The WPF
prototype reproduces that rendering by hand in
`MonitorNormalizedPlacementStore.FormatNormalized`. Seven vectors — including `\\.\DISPLAY1`
escaping, a string containing `"` and `\`, both ryu exponent edge cases, and away-from-zero
rounding at the 6th decimal — were produced by **this** Rust writer and by the **WPF** writer's
formatting functions compiled as a plain `net8.0` console program on this Linux host. The two
outputs are byte-identical. (The harness was a throwaway and is **not in the tree**, so the
hash it printed is not reproducible and is deliberately not quoted here. An independent
reviewer re-ran the same comparison from the real source files and also found byte-identity.)
What this establishes:
the two *formatters* agree. What it does **not** establish: that either prototype ever wrote or
read such a file at runtime — neither has been run. **NOT TESTED at runtime.**

Readers on both sides are deliberately lenient (plain `serde_json` / `System.Text.Json`), so a
differently formatted but semantically equal file still loads. A golden-bytes unit test pins the
exact output; if it ever has to be edited, the WPF writer must change in the same commit.

**Size.** `src/monitor_placement.rs` — 467 lines total, 326 non-comment/non-blank
(256 excluding the test module, of which 109 are the `#[cfg(windows)] mod geom` interop block).
**8 `unsafe` blocks** (`unsafe #13` … `unsafe #20`), plus 1 `unsafe extern "system" fn`
(the `EnumDisplayMonitors` callback). A `#[cfg(not(windows))] mod geom` returns `None`/96 so the
crate still builds on Linux.

**Total for both new modules: 20 `unsafe` blocks, 2 FFI callback declarations.**

---

## Isolation — what the new code may and may not touch

* Both modules are leaves. Neither imports anything from the UI, and `ui/index.html` was not
  changed at all: no new control, no new event, no changed string.
* `lib.rs` gained exactly three things: `pub mod win_shell; pub mod monitor_placement;`, one
  `win_shell::publish_mode(...)` line inside `apply_mode`, a `#[cfg(windows)]` attach block in
  `setup`, and the two `experiment_*` commands. 131 added lines, **0 removed** — the existing
  save/restore path, the three states and the existing commands are byte-for-byte unchanged.
* The subclass never calls back into Tauri. `WM_DISPLAYCHANGE` re-validation is pure Win32,
  because re-entering the Tauri runtime from inside a window procedure is how deadlocks and
  re-entrancy bugs get written.
* `win_shell` does not know the `Mode` enum; `lib.rs` translates.

---

## State semantics

Rust owns the state; the WebView is a renderer. Both the on-surface toggles and the global
shortcuts call the *same* Rust commands, and Rust pushes the result back over the
`shell://state` event, so the two entry points cannot drift.

| | PASSIVE (default) | ACTIVE | LAYOUT EDIT |
|---|---|---|---|
| `WS_EX_NOACTIVATE` | set | cleared | cleared |
| `WS_EX_TOOLWINDOW` | set | set | set |
| Z-order | `HWND_BOTTOM` + `set_always_on_bottom(true)` | `HWND_TOP` | `HWND_TOP` |
| click-through | toggleable | forced off | forced off |
| drag | disabled | disabled | **enabled** |
| focus | never taken | `set_focus()` | `set_focus()` |

`click_through_pref` is remembered independently of the mode but is only *applied* in
PASSIVE (`Shell::snapshot`), so ACTIVE and LAYOUT EDIT are always clickable. It lives in
memory only and is never written to disk — the window position is the sole persisted value.
`Ctrl+Alt+T` outside PASSIVE returns the current snapshot untouched, so the shortcut cannot
silently arm click-through for the next time the surface drops to PASSIVE.

Leaving LAYOUT EDIT (by either toggle or either shortcut) persists `outer_position()` before
the mode change takes effect visually — this is the "position locks again and is saved" rule.
Window close is the second save point.

Leaving LAYOUT EDIT through `[ACTIVE / PASSIVE]` or `Ctrl+Alt+D` lands in **ACTIVE**, never in
PASSIVE (`toggle_active`), and the `[ACTIVE / PASSIVE]` control renders as pressed whenever the
mode is not PASSIVE — LAYOUT EDIT is an active surface too.

---

## Limitations and honest gaps

1. **Nothing was run.** No display server exists here. `cargo check` proves the code
   type-checks for `x86_64-pc-windows-msvc`; it proves nothing about window behaviour,
   Z-order, focus, or shortcut delivery. Do not promote any row above to `PASS`.

2. **`HWND_BOTTOM` is not sticky.** `SetWindowPos(HWND_BOTTOM, …)` is a one-shot placement,
   not a persistent state. Windows re-raises the window on activation, and the desktop/other
   apps can reorder it. Tauri's `set_always_on_bottom` maps to tao's
   `WindowExtWindows`-level handling, which on Windows also bottoms the window via
   `SetWindowPos` and is subject to the same limit. A truly sticky bottom band needs a
   `WM_WINDOWPOSCHANGING` hook that forces `hwndInsertAfter = HWND_BOTTOM` on every
   reposition, which requires a raw window-procedure subclass. Tauri 2 does not expose a
   supported `WndProc` hook on `WebviewWindow`, so this prototype implements the **closest
   stable behaviour** (bottom on every state application) and not a hard guarantee.
   *API involved:* `SetWindowPos` / `HWND_BOTTOM` / `WM_WINDOWPOSCHANGING`.

3. **`WS_EX_NOACTIVATE` vs. a WebView2 child.** The extended style is applied to the Tauri
   top-level HWND. WebView2 runs in its own child HWND hierarchy and, on mouse input, can
   still ask for focus. Whether a click on the surface in PASSIVE leaves the foreground app
   focused is exactly the kind of thing only a real run can answer.
   *API involved:* `WS_EX_NOACTIVATE`, `SetWindowLongPtrW(GWL_EXSTYLE)`.

4. **Alt+Tab suppression is a policy choice, not a Tauri feature.** Tauri has no
   `skipSwitcher` config. `WS_EX_TOOLWINDOW` is the mechanism, and it removes the window
   from Alt+Tab *and* the taskbar together — you cannot have one without the other through
   this API. `skipTaskbar: true` in `tauri.conf.json` is applied first; the manual
   `WS_EX_TOOLWINDOW` / `!WS_EX_APPWINDOW` write is belt-and-braces after any restyling.
   *API involved:* `WS_EX_TOOLWINDOW`, `WS_EX_APPWINDOW`.

5. **Extended-style changes need a frame change — now issued.** `win::apply_styles` follows
   every `SetWindowLongPtrW(GWL_EXSTYLE)` write with
   `SetWindowPos(hwnd, None, 0,0,0,0, SWP_NOMOVE|SWP_NOSIZE|SWP_NOZORDER|SWP_NOACTIVATE|SWP_FRAMECHANGED)`,
   matching the WPF side. `SWP_NOZORDER` keeps this call out of the Z-order decision, which
   stays owned by the `send_to_bottom` / `release_from_bottom` call that follows it. That the
   frame change actually lands is **NOT TESTED**; only that the call compiles.

6. **Work-area detection is Windows-only.** `SPI_GETWORKAREA` gives the *primary* monitor's
   taskbar-excluded rectangle. The non-Windows fallback uses `primary_monitor()` bounds with
   no taskbar/panel subtraction, so the default position on Linux will sit under a panel.

   A restored position **is** now validated: `is_position_visible` builds the 320×240
   rectangle at the current scale factor, intersects it with the virtual screen from
   `GetSystemMetrics(SM_XVIRTUALSCREEN / SM_YVIRTUALSCREEN / SM_CXVIRTUALSCREEN /
   SM_CYVIRTUALSCREEN)`, and requires at least 48×48 logical px of overlap; otherwise the
   saved value is dropped and the default bottom-right corner is used. This is the same rule
   and the same threshold as the WPF `IsPlacementVisible`. It still only guards against gross
   off-screen restores — there is no clamp that nudges a partly-off window back on, and
   `GetSystemMetrics` has no non-Windows equivalent here, so off Windows the check returns
   `true` and validates nothing.
   *API involved:* `SystemParametersInfoW(SPI_GETWORKAREA)`, `GetSystemMetrics(SM_*VIRTUALSCREEN)`.

7. **DPI.** The 320×240 / 24px inset figures are logical; `default_position` multiplies by
   `scale_factor()` to reach the physical pixels `set_position` wants. The saved position is
   stored in physical pixels, so restoring after a DPI change restores the old physical
   point, not the old logical one.

8. **Global shortcuts are first-come-first-served.** If another process already owns
   `Ctrl+Alt+D/L/T`, `GlobalShortcut::register` fails. The failure is logged to stderr rather
   than being swallowed, but there is no fallback chord and no UI surface for the error —
   and with `windows_subsystem = "windows"` in release there is no console to read stderr from.

9. **The two toggle labels never change text.** The shared spec fixes the line content, so
    `[ACTIVE / PASSIVE]` and `[LAYOUT EDIT]` are rendered verbatim in every state. Current
    state is signalled through the control's own appearance (`aria-pressed` driving the
    border/foreground colour) and mirrored onto `body[data-mode]` / `body[data-click-through]`
    for inspection. `[ACTIVE / PASSIVE]` is pressed whenever the mode is **not** PASSIVE, so it
    stays pressed in LAYOUT EDIT — the same reading as the WPF `ToggleButton`. Pressed is
    border `#E6E6E6`; unpressed is text `#9A9A9A` over the unchanged `#3C3C3C` border. Only the
    four palette colours are used; the background stays transparent in both states.
    Consequence: on a still screenshot the mode is legible only from that styling, not from
    the text.

10. **Autostart is not reachable from the surface.** The shared UI spec permits exactly two
   toggles, so `autostart_enabled` / `set_autostart` exist as IPC commands only. The
   capability is implemented; it has no on-screen control by design.

11. **Click-through is a trap without the shortcut.** With click-through on in PASSIVE the
    two toggles cannot be clicked. `Ctrl+Alt+T` is the only way back. That is inherent to the
    feature, not a bug, but it is why the shortcut exists. Outside PASSIVE the shortcut does
    nothing at all — it returns the current state without touching `click_through_pref`, so it
    cannot leave click-through armed to switch on the next time the surface drops to PASSIVE.

12. **`transparent: true` + `decorations: false` disables the system drop shadow** and the
    native resize border. The window is fixed at 320×240 (`resizable: false`, min == max), so
    nothing is lost here, but a resizable transparent Tauri window would need its own
    hit-testing.

13. **Icons are placeholders.** `icons/icon.png` and `icons/icon.ico` are generated flat
    32×32 rectangles, present only because `tauri::generate_context!()` requires them to
    exist. They are not a design.

14. **`cargo check` does not exercise the bundler.** `tauri build` on Windows additionally
    runs resource embedding and WiX/NSIS packaging, none of which is verified here.

15. **The exit save hangs off `CloseRequested`, not off process teardown.** The position is
    written on leaving LAYOUT EDIT and again from a `WindowEvent::CloseRequested` handler
    registered in `setup`. `CloseRequested` fires while the window is still alive, so
    `outer_position()` is still answerable there — `Destroyed` and `RunEvent::Exit` are too
    late for that. A path that ends the process without a close request (`app.exit()`, a
    crash, `TerminateProcess`) therefore does not save. WPF's `OnClosed` has the same shape and
    the same hole. **NOT TESTED.**

16. **The vertical budget inside 240px is tight and `overflow: hidden` fails silently.** The
    surface has a 214px content box (240 − 2px border − 24px padding). At `line-height: 1.5`
    with 6px spacers the content computes to ≈194px, leaving ≈20px of slack — comparable to
    the WPF `StackPanel`. Before this, `line-height: 1.6` with 10px spacers computed to
    ≈216px, i.e. *over* budget, and `[LAYOUT EDIT]` could be clipped away with no error
    anywhere. The arithmetic above is from the CSS, not from a rendered window: the real
    metrics depend on the font Windows actually resolves for the Korean rows (`Segoe UI` has
    no Hangul, so a fallback such as Malgun Gothic supplies them, with its own line box).
    **NOT TESTED.** This is worth re-measuring on a real machine before trusting the slack.

17. **`SetWindowSubclass` is a comctl32 v6 API.** The `windows` crate links it from
    `comctl32.dll`. Which comctl32 the process actually loads depends on the activation
    context, i.e. on the application manifest. This project has no `app.manifest` of its own
    (limitation 6 / acceptance E) and relies on whatever `tauri-build` embeds. If a v5 comctl32
    were loaded, `SetWindowSubclass` would fail and `attach` would log
    `win_shell attach failed` and leave the prototype behaving exactly as it did before —
    degraded, not broken. Whether that happens is **NOT TESTED**; `cargo check` does not link.
    *Workaround if it does:* add an explicit `app.manifest` with the
    `Microsoft.Windows.Common-Controls` 6.0 dependency, as the WPF side already has a manifest.

18. **Explicit unsafe blocks inside an `unsafe extern "system" fn`.** In edition 2021 the body
    of an `unsafe fn` is implicitly an unsafe block, so the individual `unsafe { … }` blocks
    would be reported as unnecessary and the "count the unsafe" requirement would be
    unanswerable. Both new modules therefore carry `#[deny(unsafe_op_in_unsafe_fn)]`, which
    makes each unsafe operation require — and be counted in — its own block.

19. **`GetMonitorInfoW` takes `*mut MONITORINFO`, but `MONITORINFOEXW` is what carries the
    device name.** The `windows` crate types the parameter as `*mut MONITORINFO`, so the
    larger struct is passed through a pointer cast with `cbSize` set to
    `size_of::<MONITORINFOEXW>()`. That is the documented calling convention for this API, but
    it is a cast, and it is `unsafe #14`.

20. **The HWND is carried across threads as an `isize`.** `HWND` is a raw `*mut c_void` and is
    not `Send`, so it cannot be moved into the `run_on_main_thread` closure. Both the existing
    code and the new attach path pass `hwnd.0 as isize` and rebuild the `HWND` on the far side —
    the same trick `win::apply_styles` already used.

21. **`WM_DISPLAYCHANGE` is handled in every mode, not only in PASSIVE.** A monitor being
    unplugged strands the window whatever state it is in, and the recovery only moves the
    window — it does not touch Z-order, activation or size. The other three messages are
    PASSIVE-only, because outside PASSIVE the window is supposed to be activatable.

22. **`WM_ACTIVATE` calls `DefSubclassProc` first, then drops to the bottom.** Doing it in the
    other order would push the window down and then let the default handling raise it again.
    Which order Windows actually rewards is **NOT TESTED**.

23. **Detach relies on `WM_NCDESTROY`.** `win_shell::detach` exists and is public, but nothing
    calls it: the subclass removes itself from the last message the window receives, which is
    the pattern the API documents. The consequence is that a teardown path that never delivers
    `WM_NCDESTROY` (`TerminateProcess`, a crash) leaves the subclass in place for exactly as
    long as the process lives, which is harmless. The same hole as limitation 15, for the same
    reason.

24. **The experiment's float format was converged onto the WPF side, not the other way round.**
    This module first wrote a fixed six-decimal format (`0.500000`). The WPF prototype on this
    branch had already pinned the canonical bytes to *serde_json's own* rendering and
    hand-reproduced ryu in C#. Matching the plain serializer was therefore the smaller change
    and removes a hand-written formatter, so `to_canonical_json` is now
    `serde_json::to_string_pretty` and nothing else. Two consequences worth knowing:
    a `serde_json` bump that changed float printing would silently break byte-compatibility —
    hence the golden test — and the values are rounded to 6 decimals *before* serialization
    (`f64::round`, away from zero, matching C#'s `MidpointRounding.AwayFromZero`) so that
    save → load → save is stable. One of my own expectations in that test was wrong
    (`0.00001` renders as `0.00001`, not `1e-5`) and the test caught it before the notes did.

25. **`GetDpiForMonitor` resolves through an API set
    (`api-ms-win-shcore-scaling-l1-1-1.dll`), and `cargo check` does not link.** Nothing here
    verifies that this symbol resolves in a real link, and the Tauri Windows link step is
    already `FAIL` in this container for the unrelated reason in `results/TAURI_WINDOWS_BUILD.md`.
    If it were a problem, the fallback chain is already written: monitor DPI → window DPI → 96.

26. **Restore uses the DPI of the monitor being landed on, not of the window's current
    monitor.** With two monitors at different scales, recomputing the 320x240 DIP box against
    the *source* monitor's DPI would size the clamp wrongly. This is a deliberate reading of
    "the CURRENT DPI" and it is **NOT TESTED**.

27. **A work area no larger than the widget normalizes to `0.0`.** The denominator is
    `workArea - widget`; when that is zero or negative there is nothing to slide along, so save
    stores `0.0` and restore pins the widget to the work-area origin rather than dividing by
    zero or letting it hang off the edge.

---

## Verification actually performed

Commands, run in `spikes/shell/tauri/src-tauri`:

```
cargo check --target x86_64-pc-windows-msvc    # the one that matters: type-checks #[cfg(windows)]
cargo check                                    # Linux host — proves the no-op stubs still build
cargo test --offline --lib                     # 6 host unit tests, arithmetic + JSON bytes only
```

Windows-target result — `SUCCEEDED`, real tail:

```
warning: spike-shell-tauri@0.1.0: GNU compiler is not supported for this target
warning: spike-shell-tauri@0.1.0: GNU compiler is not supported for this target
    Checking spike-shell-tauri v0.1.0 (/home/user/WorkDashboard/spikes/shell/tauri/src-tauri)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.48s
```

The two `GNU compiler is not supported for this target` lines come from a build script in the
dependency graph probing for a C toolchain while cross-compiling to MSVC from Linux. They are
warnings, not errors, and the check completes.

Linux host result — `SUCCEEDED`, no warnings:

```
    Checking spike-shell-tauri v0.1.0 (/home/user/WorkDashboard/spikes/shell/tauri/src-tauri)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.87s
```

Host unit tests — `PASS`, 6 of 6. These cover **only** the platform-independent half of
`monitor_placement`: the canonical JSON bytes, the ryu float renderings the WPF side
reproduces, NaN/out-of-range clamping, `normalize`/`denormalize` inverses and DIP→px scaling.
They say nothing about windows, monitors or Win32.

```
running 6 tests
test monitor_placement::tests::canonical_json_is_byte_stable ... ok
test monitor_placement::tests::float_rendering_matches_the_wpf_reproduction ... ok
test monitor_placement::tests::dip_to_px_follows_dpi ... ok
test monitor_placement::tests::normalize_denormalize_are_inverse_on_a_plain_work_area ... ok
test monitor_placement::tests::out_of_range_and_nan_are_clamped ... ok
test monitor_placement::tests::round_trips_through_its_own_bytes ... ok

test result: ok. 6 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
```

**Cross-platform byte check (Automated).** Seven placement vectors were emitted by this
crate's `to_canonical_json` and, separately, by the WPF prototype's `FormatNormalized` /
`EscapeJsonString` / canonical writer extracted into a plain `net8.0` console program built on
this Linux host. `diff` reports no difference; both files hash to
`1c8bbd8bfd6ff13ac1b5d96fcb4c0105`. This compares the two **formatters as they stand on this
branch**. It is not a runtime observation, and the WPF prototype was not run.

**Negative control — the new modules.** Two deliberate errors were injected, one in each new
`#[cfg(windows)]` module, and the Windows-target check re-run. Both were rejected:

```
error[E0433]: failed to resolve: use of undeclared type `NegativeControlSubclassProbeDoesNotExist`
   --> src/win_shell.rs:187:34
error: could not compile `spike-shell-tauri` (lib) due to 1 previous error

error[E0433]: failed to resolve: use of undeclared type `NegativeControlMonitorProbeDoesNotExist`
   --> src/monitor_placement.rs:232:26
error: could not compile `spike-shell-tauri` (lib) due to 1 previous error
```

With the `win_shell.rs` error still in place, plain `cargo check` (Linux host) still
**succeeded** — which is the other half of the control: it shows the subclass code really is
gated to Windows and really is only compiled under the Windows target, rather than being dead
text that both targets skip. Both errors were then reverted and both checks re-run clean.

**Negative control — the earlier Win32 code.** Because a `#[cfg(windows)]` block that is never
compiled would also "pass", a deliberate error was injected into `win::virtual_screen`, and the
check re-run:

```
error[E0433]: failed to resolve: use of undeclared type `NegativeControlProbeDoesNotExist`
274 |         let _probe: u8 = NegativeControlProbeDoesNotExist::nope();
    |                          ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ use of undeclared type `NegativeControlProbeDoesNotExist`
error: could not compile `spike-shell-tauri` (lib) due to 1 previous error
```

The error was raised and then reverted, which establishes that the Win32 code path really is
compiled under the Windows target and that the `SetWindowPos` / `GetWindowLongPtrW` /
`SetWindowLongPtrW` / `SystemParametersInfoW` / `GetSystemMetrics` signatures against
`windows` 0.61 are correct.

**What this does and does not establish.** It establishes that the code compiles for Windows.
It establishes nothing about behaviour. There is no display server in this container and
neither prototype was ever launched. Every behavioural row in the tables above is
`NOT TESTED` and must be run on a real Windows desktop before being recorded as `PASS`.

## Pinned versions

| Crate / package | Version |
|---|---|
| `tauri` | `=2.11.5` |
| `tauri-build` | `=2.6.3` |
| `tauri-plugin-global-shortcut` | `=2.3.2` |
| `tauri-plugin-autostart` | `=2.5.1` |
| `windows` (Windows target only) | `=0.61.3`, matching `tauri`'s own `^0.61` so `HWND` does not duplicate |
| `@tauri-apps/cli` (dev only) | `2.11.1` |

`serde` / `serde_json` are left at `1.0`. **No new dependency was added for this work** — only
three feature flags on the `windows` crate that is already there: `Win32_UI_Shell` (the three
subclass functions), `Win32_Graphics_Gdi` (monitor enumeration and `MONITORINFOEXW`) and
`Win32_UI_HiDpi` (`GetDpiForMonitor` / `GetDpiForWindow`). The version is unchanged, so `HWND`
still cannot duplicate against `tauri`'s own `windows` dependency. The UI pulls in nothing at
all and was not touched.

---

## Where the two prototypes still diverge — and why

**This section has changed.** It previously recorded four gaps as limits of Tauri's supported
API surface. Those four are now closed by `src/win_shell.rs`, using only the **public**
`WebviewWindow::hwnd()` plus a comctl32 subclass — no Tauri internal, nothing monkey-patched.
What that changes is what the two prototypes *can* be asked to do; it changes nothing about
what has been *observed*, which is still nothing. Everything below is **NOT TESTED**: it is
read off the APIs each framework does and does not expose, not off behaviour.
Everything else about the two surfaces has been aligned.

1. **Sticky bottom-of-Z — CLOSED.** Both sides now re-assert
   `hwndInsertAfter = HWND_BOTTOM` from a `WM_WINDOWPOSCHANGING` hook while PASSIVE, so bottom-Z
   is a standing rule on both, not a one-shot placement on the Tauri side. The Tauri hook also
   clears `SWP_NOZORDER` and sets `SWP_NOACTIVATE` on the incoming `WINDOWPOS`.
   *API involved:* `WM_WINDOWPOSCHANGING`, `SetWindowPos(HWND_BOTTOM)`. **NOT TESTED** on either.

2. **Suppressing activation on click — CLOSED at the top-level HWND.** Both sides now return
   `MA_NOACTIVATE` (not `MA_NOACTIVATEANDEAT`) from `WM_MOUSEACTIVATE` while PASSIVE.
   **The residual difference is not the hook, it is WebView2.** WPF's content is in the same
   HWND; Tauri's content is a WebView2 child hierarchy, and a click landing on a child window
   need not route `WM_MOUSEACTIVATE` to the parent this subclass is attached to. Whether the
   answer reaches the click is exactly what only a real run can tell.
   *API involved:* `WM_MOUSEACTIVATE`, `MA_NOACTIVATE`. **NOT TESTED.**

3. **Recovering from an unwanted activation — CLOSED.** Both sides drop back to
   `HWND_BOTTOM` on `WM_ACTIVATE` when something activated the window anyway.
   *API involved:* `WM_ACTIVATE`. **NOT TESTED.**

4. **Reacting to a display-layout change — CLOSED.** Both sides re-validate placement on
   `WM_DISPLAYCHANGE`. The Tauri handler clamps into the work area of the nearest monitor, which
   is a strictly stronger rule than the startup-only 48x48 virtual-screen overlap check in
   `is_position_visible` — that check is unchanged and still owns the startup path.
   *API involved:* `WM_DISPLAYCHANGE`. **NOT TESTED.**

4a. **What is genuinely left after closing 1-4.** The subclass is an *addition*, so the two
   prototypes now differ mainly in cost and risk, not capability: the Tauri side needs a
   comctl32 subclass, 20 `unsafe` blocks across two modules and an `AtomicU8` read on the UI
   thread to reach what WPF gets from `HwndSourceHook`, and it carries the WebView2 child-HWND
   question in item 2 that WPF does not have.

5. **Position units.** WPF `Left`/`Top` are DIPs against the primary monitor's scale; Tauri
   saves `outer_position()` in physical pixels. The two files are not interchangeable and
   behave differently across a DPI change. This is a framework coordinate-space difference,
   not a bug in either.

6. **Work-area lookup.** Both resolve the default corner from the same idea, but WPF reads
   `SystemParameters.WorkArea` (a WPF abstraction in DIPs) and Tauri calls
   `SystemParametersInfoW(SPI_GETWORKAREA)` directly. Neither is multi-monitor aware.

All of the above are **NOT TESTED** in this container; they are read off the APIs each
framework does and does not expose. Items 5 and 6 (coordinate space, work-area lookup) are
untouched by this work — the monitor-normalized **experiment** in `monitor_placement.rs` is a
*second, separate* record that addresses both, but it is an experiment, it is not on the default
path, and it does not change what `window-position.json` does.

**OPEN (not implemented, needs a product/spike decision).** `acceptance.md` rows B5 and B6
describe the Tauri implementation as a one-shot `SetWindowPos` / `WS_EX_NOACTIVATE`-only
approach. That description is now out of date on the implementation side. Those rows were left
untouched — their result column is `NOT TESTED` and must stay `NOT TESTED` — but someone who
owns that file should refresh the "Tauri 구현" column.
