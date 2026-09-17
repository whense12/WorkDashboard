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
| LAYOUT EDIT drag only | `data-tauri-drag-region` is **added to and removed from** the surface and its text rows; outside LAYOUT EDIT the attribute is absent everywhere. It is never put on the two buttons, so the `[LAYOUT EDIT]` toggle stays clickable while dragging is armed | `ui/index.html` `render()` |

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

---

## Verification actually performed

Commands, run in `spikes/shell/tauri/src-tauri`:

```
cargo check --target x86_64-pc-windows-msvc    # the one that matters: type-checks #[cfg(windows)]
cargo check                                    # Linux host
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

**Negative control.** Because a `#[cfg(windows)]` block that is never compiled would also
"pass", a deliberate error was injected into the newest Win32 function, `win::virtual_screen`,
and the check re-run:

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

`serde` / `serde_json` are left at `1.0`. No other dependencies were added; the UI pulls in
nothing at all.

---

## Where the two prototypes still diverge — and why

These are limits of each framework's **supported** API surface, not of Windows itself — the
Tauri crate already links `windows` and already holds the raw HWND, so an unsupported
`SetWindowSubclass` would close items 1-4. They are the spike's actual findings, and all of
them are **NOT TESTED**: they are read off the APIs each framework does and does not expose,
not off observed behaviour.
Everything else about the two surfaces has been aligned.

1. **Sticky bottom-of-Z.** WPF re-asserts `hwndInsertAfter = HWND_BOTTOM` from a
   `WM_WINDOWPOSCHANGING` hook, so anything that tries to raise the window in PASSIVE is
   pushed back down. Tauri 2 exposes no supported `WndProc` hook on `WebviewWindow`, so the
   Tauri side can only place the window at `HWND_BOTTOM` each time it applies a mode. One is a
   standing rule, the other is a one-shot placement.
   *API involved:* `WM_WINDOWPOSCHANGING`, `SetWindowPos(HWND_BOTTOM)`.

2. **Suppressing activation on click.** WPF returns `MA_NOACTIVATE` from `WM_MOUSEACTIVATE`
   while PASSIVE, so a click reaches the control without the window becoming foreground.
   Tauri has only `WS_EX_NOACTIVATE` on the top-level HWND; the WebView2 child hierarchy is
   outside that, and there is no hook to answer `WM_MOUSEACTIVATE`.
   *API involved:* `WM_MOUSEACTIVATE`, `MA_NOACTIVATE`.

3. **Recovering from an unwanted activation.** WPF drops back to the bottom on `WM_ACTIVATE`
   when something activated it anyway. Tauri has no equivalent, for the same missing-hook
   reason.
   *API involved:* `WM_ACTIVATE`.

4. **Reacting to a display-layout change.** WPF re-validates the position on
   `WM_DISPLAYCHANGE`. Tauri validates only at startup, in `is_position_visible`; there is no
   message hook to re-check while running.
   *API involved:* `WM_DISPLAYCHANGE`.

5. **Position units.** WPF `Left`/`Top` are DIPs against the primary monitor's scale; Tauri
   saves `outer_position()` in physical pixels. The two files are not interchangeable and
   behave differently across a DPI change. This is a framework coordinate-space difference,
   not a bug in either.

6. **Work-area lookup.** Both resolve the default corner from the same idea, but WPF reads
   `SystemParameters.WorkArea` (a WPF abstraction in DIPs) and Tauri calls
   `SystemParametersInfoW(SPI_GETWORKAREA)` directly. Neither is multi-monitor aware.

All six are **NOT TESTED** in this container; they are read off the APIs each framework does
and does not expose.
