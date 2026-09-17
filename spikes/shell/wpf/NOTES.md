# Spike A — WPF (.NET 8) prototype notes

Neutral verification surface for the Windows shell comparison. Not product code, not product design.

> **Evidence status.** The only thing verified here is **compilation**. This prototype was built on a
> headless Ubuntu 24.04 container with no display server; a WPF window cannot be created, shown, or
> observed on that host. Every behavioural claim below is **NOT TESTED** and is stated as
> *what the API is documented to do*, not as something that was seen working.

---

## Build

```
export PATH="$HOME/.dotnet:$PATH"
cd /home/user/WorkDashboard/spikes/shell/wpf
dotnet build -c Release
```

Result: `Build succeeded. 0 Warning(s) 0 Error(s)`.

`EnableWindowsTargeting=true` is what makes `net8.0-windows` + `UseWPF` restore and compile on Linux.
Without it the restore fails with NETSDK1100.

Two extra facts measured on this host:

- The default `dotnet build -c Release` (no RID) emits a **Linux** apphost named `ShellSpike`
  next to `ShellSpike.dll`. That apphost is useless; it is an artifact of cross-building.
- `dotnet build -c Release -r win-x64 --self-contained false` also succeeds and emits a real
  `ShellSpike.exe` — verified as `PE32+ executable (GUI) x86-64, for MS Windows`, with the
  `PerMonitorV2` manifest embedded. That is the shape a Windows machine would actually run.

No NuGet `PackageReference` at all. WPF, `System.Text.Json` and `Microsoft.Win32.Registry` all ship
inside the `net8.0-windows` target framework, so there is nothing to pin.

---

## Files

| Path | Role |
|---|---|
| `ShellSpike.csproj` | `net8.0-windows`, `WinExe`, `UseWPF`, `EnableWindowsTargeting` |
| `app.manifest` | Per-monitor-V2 DPI awareness, Win10/11 `supportedOS` |
| `App.xaml` / `App.xaml.cs` | Brushes (the four spec colours only), font, toggle template |
| `MainWindow.xaml` | The surface: the fixed strings and the two toggles |
| `MainWindow.xaml.cs` | State machine, `WndProc` hook, hotkeys, placement |
| `Interop/NativeMethods.cs` | The entire P/Invoke surface |
| `Services/ShellState.cs` | `Passive` / `Active` / `LayoutEdit` |
| `Services/WindowPlacementStore.cs` | Window position JSON — `left` / `top` and nothing else (the only file this spike writes) |
| `Services/StartupRegistration.cs` | `HKCU\...\Run` read/write |

---

## Capability → what was used

### frameless window
`WindowStyle="None"`, `ResizeMode="NoResize"`, `Width/Height` pinned to 320×240 with matching
`Min*`/`Max*`. Pure WPF, no interop needed.

### transparent / layered surface
`AllowsTransparency="True"` with `Background="Transparent"` on the `Window`, and the visible fill on
an inner `Border` using `SolidColorBrush Color="#1E1E1E" Opacity="0.85"` plus a 1px `#3C3C3C`
`BorderThickness`.

The palette is exactly the four values the shared spec allows — `#1E1E1E`, `#3C3C3C`, `#E6E6E6`,
`#9A9A9A` — and nothing else. The two `ToggleButton`s follow the same rules as the Tauri buttons:
transparent background, 1px `#3C3C3C` border; checked → border `#E6E6E6` and text `#E6E6E6`;
unchecked → text `#9A9A9A`. No fill colour distinguishes the states, because a fifth and sixth
grey would be outside the spec.

WPF sets `WS_EX_LAYERED` itself when `AllowsTransparency="True"`. The interop layer deliberately does
**not** touch that bit — `SetLayeredWindowAttributes` / `UpdateLayeredWindow` against a window WPF
is already compositing is how you get a black or missing surface.

### minimise taskbar presence
`ShowInTaskbar="False"` plus `WS_EX_TOOLWINDOW`. Either alone is enough for the taskbar;
`WS_EX_TOOLWINDOW` is the one that also covers the switcher.

### Alt+Tab / switcher policy
**Policy: the window never appears in Alt+Tab, in any of the three states.**
`WS_EX_TOOLWINDOW` added and `WS_EX_APPWINDOW` removed via `GetWindowLong`/`SetWindowLong`
(`GWL_EXSTYLE`) in `ApplyBaseExStyles()`, followed by a `SetWindowPos(..., SWP_FRAMECHANGED)` because
an ex-style change does not take effect until the next frame change.

Consequence accepted on purpose: there is no keyboard route *into* the window from the OS switcher.
The global shortcut is the only keyboard route in. If the window is ever wanted in the switcher while
ACTIVE, `WS_EX_TOOLWINDOW` would have to be toggled per state, which is not what this build does.

### passive bottom-Z behaviour
Three layers, because one is not enough:
1. `SetWindowPos(hwnd, HWND_BOTTOM, SWP_NOMOVE|SWP_NOSIZE|SWP_NOACTIVATE|SWP_NOOWNERZORDER)` on
   entering PASSIVE.
2. `WM_WINDOWPOSCHANGING` — the `WINDOWPOS` struct is marshalled in, `hwndInsertAfter` is rewritten
   to `HWND_BOTTOM`, `SWP_NOZORDER` is cleared and `SWP_NOACTIVATE` set, then marshalled back.
   This is what re-asserts the position against anything that tries to raise the window.
3. `WM_ACTIVATE` — if something activated us anyway, drop straight back down.

### no-activate / no focus steal
`WS_EX_NOACTIVATE` added in PASSIVE and removed in ACTIVE / LAYOUT EDIT, plus
`ShowActivated="False"` so the initial `Show()` does not activate, plus `WM_MOUSEACTIVATE` returning
`MA_NOACTIVATE` in PASSIVE. `MA_NOACTIVATE` (not `MA_NOACTIVATEANDEAT`) is deliberate: the click is
still delivered to the control, the window just does not become foreground.

### active-state transition
`ApplyState()` in `MainWindow.xaml.cs`. Entering ACTIVE or LAYOUT EDIT removes `WS_EX_NOACTIVATE`,
forces click-through off, `SetWindowPos(HWND_TOP, SWP_NOMOVE|SWP_NOSIZE|SWP_NOACTIVATE)`, then
`Activate()`.

Leaving LAYOUT EDIT through the `[ACTIVE / PASSIVE]` toggle **or** through `Ctrl+Alt+D` lands in
**ACTIVE**, never in PASSIVE, so the on-surface control and the global shortcut agree with each
other and with the Tauri `toggle_active`. It still counts as leaving LAYOUT EDIT, so the position
is saved on the way out.

The `[ACTIVE / PASSIVE]` `ToggleButton` reads as checked whenever the state is not PASSIVE —
LAYOUT EDIT included, because LAYOUT EDIT is an active surface (`SyncToggles`).

### optional click-through
`WS_EX_TRANSPARENT` toggled at runtime (`NativeMethods.SetExStyleBit`). Only meaningful in PASSIVE;
forced off on entering ACTIVE or LAYOUT EDIT so the surface cannot make itself unreachable.

`Ctrl+Alt+T` pressed outside PASSIVE is a **no-op**: `ToggleClickThrough` returns immediately and
does not flip `_clickThrough`, so nothing is armed for the next time the surface drops to PASSIVE.

The flag is **in-memory only**. It is not written to disk and is not read back at startup — it
always begins `false`. The window position is the one and only value this spike persists.

### global shortcut activation
`RegisterHotKey` / `UnregisterHotKey` on the window handle, with `WM_HOTKEY` arriving through an
`HwndSource.AddHook` hook. `MOD_NOREPEAT` set so held keys fire once.

| Shortcut | Effect |
|---|---|
| `Ctrl+Alt+D` | ACTIVE → PASSIVE, PASSIVE → ACTIVE, LAYOUT EDIT → ACTIVE |
| `Ctrl+Alt+L` | toggle LAYOUT EDIT ⟷ ACTIVE |
| `Ctrl+Alt+T` | toggle click-through; a no-op outside PASSIVE |

### run-at-startup registration
`Services/StartupRegistration.cs` writes `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`,
value `WorkDashboardShellSpike`, data = quoted `Environment.ProcessPath`. Per-user, no elevation.
Nothing in the UI calls it — it is a compiled-and-callable API surface for the spike, not a feature.

### window position save + restore
`%APPDATA%\WorkDashboard.ShellSpike\window.json`, `System.Text.Json`, written temp-then-`File.Move`
so a crash mid-write cannot truncate it. The record holds `left` and `top` and nothing else.
Saved on leaving LAYOUT EDIT and on close — those two points only. Restored in
`OnSourceInitialized`, but only if the rectangle still overlaps `SystemParameters.VirtualScreen*`
by at least 48×48 — otherwise it falls back to the default position. Default position is
`SystemParameters.WorkArea` bottom-right inset 24px.

### LAYOUT EDIT drag
`DragMove()` from `MouseLeftButtonDown` on the root `Border`, gated on `_state == LayoutEdit`.
PASSIVE and ACTIVE return immediately, so the window does not move. The call is wrapped in
`try/catch (InvalidOperationException)` because `DragMove` throws if the button was already released.

---

## Limitations hit

1. **Nothing was run.** No display server on the build host. Z-order, focus behaviour, transparency
   rendering, hotkey delivery and drag are all **NOT TESTED**. Compilation is the only evidence.

2. **`HWND_BOTTOM` is not a real "desktop layer".** Win32 has no supported API for parenting a window
   into the wallpaper layer. `HWND_BOTTOM` plus `WM_WINDOWPOSCHANGING` is the closest stable
   equivalent, and it is a *contest*, not a guarantee: a maximised window still covers it, and
   `Win+D` / "Show desktop" is expected to hide it along with everything else. The known alternative
   (finding `Progman`/`WorkerW` and `SetParent`-ing into it) is undocumented, breaks across Explorer
   restarts and Windows builds, and was deliberately not used.

3. **`WS_EX_NOACTIVATE` toggling is not a focus grab.** Removing the bit makes the window *eligible*
   for foreground; it does not make it foreground. `Activate()` is called, but Windows' foreground
   lock (`SPI_SETFOREGROUNDLOCKTIMEOUT`) can refuse a foreground change requested by a process that
   does not own the current foreground window. Whether `Ctrl+Alt+D` actually brings focus is exactly
   the kind of thing that needs a real machine. **NOT TESTED.**

4. **`RegisterHotKey` is first-come-first-served.** If another process already owns `Ctrl+Alt+D/L/T`,
   registration returns `false`. The failure is recorded in `_hotkeyRegistered[]` and swallowed —
   the on-surface toggles still work — but there is no UI telling the user the shortcut is dead.
   `RegisterHotKey` also cannot capture combinations reserved by the shell (anything with `Win` that
   Windows claims first).

5. **`AllowsTransparency="True"` forces software rendering of the window.** This is a documented WPF
   constraint on layered windows; it also means no `WindowChrome` hit-testing and no child HWNDs
   (WebView2, WinForms host) rendered inside the window. Irrelevant for this spike's content, but it
   is a real ceiling if the product surface later wants embedded content.

6. **`Window.Left`/`Top` are DIPs against the primary monitor's scale.** In a mixed-DPI multi-monitor
   setup, WPF's `Left`/`Top` do not map cleanly onto per-monitor physical coordinates, so a position
   saved on a 150% secondary monitor can restore a few pixels off. Doing this exactly means saving
   physical pixels via `GetWindowRect` and restoring via `SetWindowPos`. Not done here; the 48×48
   overlap check only protects against gross off-screen restores, not against small DPI drift.

7. **No on-surface click-through control.** The shared UI spec fixes the surface to exactly two
   toggles, and a `WS_EX_TRANSPARENT` window cannot be clicked to switch itself back. Click-through
   is therefore global-shortcut-only (`Ctrl+Alt+T`). Stated here rather than by adding a third
   control the spec does not have.

8. **`WS_EX_TOOLWINDOW` also removes the window from most third-party switchers and from
   `Alt+Esc`.** That is the intended policy, but it is a package deal — you cannot have
   "hidden from taskbar, present in Alt+Tab" with this bit.

9. **Startup registration is unexercised.** `HKCU\...\Run` cannot be written on Linux; the code
   compiles and every registry call is inside a `try/catch` returning `bool`, but it has never run.
   Also note `Environment.ProcessPath` returns the apphost path, which for a framework-dependent
   build is correct, but for `dotnet ShellSpike.dll` would be the `dotnet` host instead.

10. **Colour assignment inside the surface is a judgement call.** The spec gives a primary
    (`#E6E6E6`) and a secondary (`#9A9A9A`) but does not say which line is which. This build uses
    secondary for the `다음 일정` label only and primary for everything else, which is the same
    choice the Tauri `.dim` class makes, so the two surfaces agree on it.

11. **The two surfaces are aligned by rule, not by pixel.** Both now use the same four colours,
    the same toggle rendering rules, the same 13px type size and the same
    "secondary for `다음 일정` only" assignment. They are still a WPF `StackPanel` and a CSS flex
    column: the line boxes come from different text stacks (WPF `TextFormattingMode="Display"` vs.
    WebView2), and the Korean rows resolve to a fallback font on both sides with metrics this
    container cannot measure. Expect the same content and the same reading order, not identical
    pixel offsets. **NOT TESTED** — nothing was rendered.

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
